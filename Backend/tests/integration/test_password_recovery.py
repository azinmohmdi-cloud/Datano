from datetime import UTC, datetime, timedelta
import asyncio

import pytest
from sqlalchemy import inspect, select, text
from sqlalchemy.exc import OperationalError, IntegrityError

from app.domain.entities import UserEntity
from app.infra.repositories.postgres.recovery_repository import PostgresRecoveryRepository
from app.infra.repositories.postgres.user_repository import SQLUserRepository
from app.infra.repositories.postgres.session_repository import SQLSessionRepository
from app.infra.services.password_service import Argon2PasswordService
from app.infra.services.recovery_token_service import RecoveryTokens
from app.infra.services.session_token_service import OpaqueSessionTokens
from app.infra.database.models import RecoveryGrantRow, UserRow
from app.domain.error.exceptions import ServiceUnavailableException
from tests.postgres import isolated_postgres_url, migrate, persistent_database

PASSWORD = 'Existing recovery password!'
NEW_PASSWORD = 'New exact recovery password!'
NOW = datetime(2026, 10, 21, tzinfo=UTC)


@pytest.fixture
async def recovery_account(persistent_database):
    user = UserEntity.create(first_name='Recovery', last_name='Owner', email='recover@example.test', username='recover-owner', hashed_password=Argon2PasswordService().hash(PASSWORD))
    user.activate()
    async with persistent_database.transaction() as session:
        await SQLUserRepository(session).create(user)
    return user


async def test_reset_is_atomic_single_use_and_revokes_all_account_sessions(persistent_database, recovery_account):
    tokens = RecoveryTokens()
    repository = PostgresRecoveryRepository(persistent_database, clock=lambda: NOW)
    account = await repository.account(recovery_account.email)
    token = tokens.generate()
    digest = tokens.digest(token)
    assert await repository.grant(account, digest, seconds=600) == NOW + timedelta(seconds=600)
    for remember in (True, False):
        async with persistent_database.transaction() as session:
            await SQLSessionRepository(session, clock=lambda: NOW).create(OpaqueSessionTokens().digest(OpaqueSessionTokens().generate()), account.user_id, remember_me=remember, idle_seconds=1800, absolute_seconds=43200)
    replacement = Argon2PasswordService().hash(NEW_PASSWORD)
    assert await repository.reset(digest, replacement)
    assert not await repository.valid(digest)
    assert not await repository.reset(digest, replacement)
    async with persistent_database.transaction() as session:
        user = await SQLUserRepository(session).get_by_id(account.user_id)
        assert Argon2PasswordService().verify(NEW_PASSWORD, user.hashed_password)
        assert await session.scalar(text('SELECT count(*) FROM auth_sessions WHERE revoked_at IS NULL')) == 0


async def test_migration_adds_only_recovery_grants(persistent_database):
    async with persistent_database.engine.connect() as connection:
        names = await connection.run_sync(lambda sync: [column['name'] for column in inspect(sync).get_columns('password_recovery_grants')])
    assert set(names) == {'digest', 'user_id', 'account_state', 'created_at', 'expires_at'}


@pytest.fixture
async def grant_state(persistent_database, recovery_account):
    now = [NOW]
    repository = PostgresRecoveryRepository(persistent_database, clock=lambda: now[0])
    account = await repository.account(recovery_account.email)
    token = RecoveryTokens().generate()
    digest = RecoveryTokens().digest(token)
    await repository.grant(account, digest, seconds=600)
    return repository, account, token, digest, now


@pytest.mark.parametrize('seconds,allowed', [(-1,False),(599.999999,True),(600,False),(601,False)])
async def test_grant_lifetime_is_absolute_and_does_not_extend(grant_state, seconds, allowed):
    repository, account, token, digest, now = grant_state
    assert await repository.valid(digest)
    now[0] += timedelta(seconds=seconds)
    assert await repository.valid(digest) is allowed


async def test_reverification_replaces_previous_grant(grant_state):
    repository, account, token, digest, now = grant_state
    other = RecoveryTokens().digest(RecoveryTokens().generate())
    await repository.grant(account, other, seconds=600)
    assert not await repository.valid(digest)
    assert await repository.valid(other)


@pytest.mark.parametrize('mutation', ["is_active=false", "email='new@example.test',email_key='new@example.test'", "hashed_password='changed-hash'"])
async def test_account_change_invalidates_grants_and_prevents_stale_issuance(persistent_database, grant_state, mutation):
    repository, account, token, digest, now = grant_state
    async with persistent_database.transaction() as session:
        await session.execute(text('UPDATE users SET '+mutation+' WHERE id=:id'), {'id':account.user_id})
    assert not await repository.valid(digest)
    assert not await repository.reset(digest, 'replacement-hash')
    assert await repository.grant(account, b'b'*32, seconds=600) is None


async def test_parallel_resets_have_one_winner(grant_state):
    repository, account, token, digest, now = grant_state
    results = await asyncio.gather(*(repository.reset(digest, f'test-hash-{i}') for i in range(8)))
    assert sum(results) == 1


async def test_recovery_transaction_rolls_back_password_grant_and_session_changes(monkeypatch, persistent_database, grant_state):
    repository, account, token, digest, now = grant_state
    async with persistent_database.transaction() as session:
        original = (await SQLUserRepository(session).get_by_id(account.user_id)).hashed_password
        await SQLSessionRepository(session, clock=lambda: NOW).create(b'a'*32, account.user_id, remember_me=False, idle_seconds=1800, absolute_seconds=43200)
    original_revoke = SQLSessionRepository.revoke_all
    async def fail_after_revoke(self, user_id):
        await original_revoke(self, user_id)
        raise OperationalError('private-driver-secret', {}, Exception('private-driver-secret'))
    with monkeypatch.context() as patch:
        patch.setattr(SQLSessionRepository, 'revoke_all', fail_after_revoke)
        with pytest.raises(ServiceUnavailableException) as caught:
            await repository.reset(digest, 'must-not-persist')
    assert caught.value.__context__ is None and 'private-driver-secret' not in str(caught.value)
    assert await repository.valid(digest)
    async with persistent_database.transaction() as session:
        assert (await SQLUserRepository(session).get_by_id(account.user_id)).hashed_password == original
        assert await session.scalar(text('SELECT count(*) FROM auth_sessions WHERE revoked_at IS NULL')) == 1


async def test_other_account_sessions_survive_reset(persistent_database, grant_state):
    repository, account, token, digest, now = grant_state
    other = UserEntity.create(first_name='Other', last_name='Owner', email='other@example.test', username='other-owner', hashed_password='test-hash')
    other.activate()
    async with persistent_database.transaction() as session:
        await SQLUserRepository(session).create(other)
        await SQLSessionRepository(session, clock=lambda: NOW).create(b'b'*32, other.id, remember_me=True, idle_seconds=1800, absolute_seconds=43200)
    assert await repository.reset(digest, 'replacement')
    async with persistent_database.transaction() as session:
        assert await SQLSessionRepository(session, clock=lambda: NOW).resolve(b'b'*32)


async def test_grant_survives_a_new_database_pool(persistent_database, isolated_postgres_url, grant_state):
    from app.infra.database.connection import Database
    _, _, _, digest, _ = grant_state
    database = Database(isolated_postgres_url)
    try:
        assert await PostgresRecoveryRepository(database, clock=lambda: NOW).valid(digest)
    finally:
        await database.dispose()


async def test_recovery_user_lock_serializes_against_inflight_session_issue(persistent_database, grant_state):
    from app.application.use_cases.auth.authenticate_use_case import AuthenticateUserUseCase
    from app.application.use_cases.auth.current_identity_use_case import GetCurrentIdentityUseCase
    from app.application.use_cases.auth.login_use_case import LoginUseCase
    from app.application.use_cases.auth.models import LoginRequest
    from app.application.use_cases.auth.session_service import SessionService
    from app.domain.error.exceptions import CredentialsValidationException
    from app.infra.repositories.postgres.role_repository import SQLRoleRepository
    repository, account, token, digest, now = grant_state
    waiting, reset_locked, release = asyncio.Event(), asyncio.Event(), asyncio.Event()
    class PausedReset(PostgresRecoveryRepository):
        async def _locked(self, session, digest):
            value = await super()._locked(session, digest)
            reset_locked.set()
            await release.wait()
            return value
    class SignallingSessions(SQLSessionRepository):
        async def _lock_user(self, user_id):
            waiting.set()
            return await super()._lock_user(user_id)
    async def pending_login():
        async with persistent_database.transaction() as session:
            users = SQLUserRepository(session)
            login = LoginUseCase(AuthenticateUserUseCase(users, Argon2PasswordService()),
                SessionService(SignallingSessions(session, clock=lambda: NOW), OpaqueSessionTokens()),
                GetCurrentIdentityUseCase(users, SQLRoleRepository(session)))
            return await login.execute(LoginRequest(email=account.email, password=PASSWORD))
    reset = asyncio.create_task(PausedReset(persistent_database, clock=lambda: NOW).reset(digest, Argon2PasswordService().hash(NEW_PASSWORD)))
    task = None
    try:
        await asyncio.wait_for(reset_locked.wait(), 5)
        task = asyncio.create_task(pending_login())
        await asyncio.wait_for(waiting.wait(), 5)
        release.set()
        assert await asyncio.wait_for(reset, 5)
        with pytest.raises(CredentialsValidationException):
            await asyncio.wait_for(task, 5)
    finally:
        release.set()
        await asyncio.gather(reset, return_exceptions=True)
        if task is not None and not task.done():
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
    async with persistent_database.transaction() as session:
        assert await session.scalar(text('SELECT count(*) FROM auth_sessions WHERE revoked_at IS NULL')) == 0


@pytest.mark.parametrize('mutation', ["digest=decode('aa','hex')", "account_state=decode('aa','hex')", "expires_at=created_at", "expires_at=created_at+interval '11 minutes'"])
async def test_recovery_database_constraints(persistent_database, grant_state, mutation):
    with pytest.raises(IntegrityError):
        async with persistent_database.transaction() as session:
            await session.execute(text('UPDATE password_recovery_grants SET '+mutation))


async def test_recovery_migration_preserves_populated_identity_and_sessions(isolated_postgres_url):
    from app.infra.database.connection import Database
    database = Database(isolated_postgres_url)
    try:
        async with database.engine.begin() as connection:
            await connection.run_sync(migrate, '0006_email_codes')
        user = UserEntity.create(first_name='Keep', last_name='Owner', email='keep@example.test', username='keep-owner', hashed_password='kept-hash')
        user.activate()
        async with database.transaction() as session:
            await SQLUserRepository(session).create(user)
            await SQLSessionRepository(session, clock=lambda: NOW).create(b'a'*32, user.id, remember_me=False, idle_seconds=1800, absolute_seconds=43200)
        async with database.engine.begin() as connection:
            snapshots = {table:[dict(row) for row in (await connection.execute(text('SELECT * FROM '+table))).mappings()]
                for table in ('users','roles','user_roles','registration_attempts','auth_sessions','email_code_challenges')}
            await connection.run_sync(migrate, '0007_password_recovery')
            await connection.run_sync(migrate, '0007_password_recovery')
            assert await connection.scalar(text('SELECT version_num FROM alembic_version')) == '0007_password_recovery'
            await connection.run_sync(lambda sync: migrate(sync,'0006_email_codes',downgrade=True))
            for table, before in snapshots.items():
                assert [dict(row) for row in (await connection.execute(text('SELECT * FROM '+table))).mappings()] == before
            await connection.run_sync(migrate)
    finally:
        await database.dispose()


async def test_startup_refuses_schema_without_recovery_grants(isolated_postgres_url):
    from fastapi.testclient import TestClient
    from app.infra.core.config import Config
    from app.infra.database.connection import Database
    from app.main import create_app
    database=Database(isolated_postgres_url)
    try:
        async with database.engine.begin() as connection:
            await connection.run_sync(migrate,'0006_email_codes')
        application=create_app(Config(_env_file=None,DATABASE_URL=isolated_postgres_url.render_as_string(hide_password=False)))
        with pytest.raises(RuntimeError,match='run alembic upgrade head'):
            with TestClient(application):
                pass
    finally:
        await database.dispose()
