from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import inspect, text

from app.application.use_cases.auth.session_service import SessionService
from app.domain.entities import UserEntity
from app.infra.repositories.postgres.session_repository import SQLSessionRepository
from app.infra.repositories.postgres.user_repository import SQLUserRepository
from app.infra.services.session_token_service import OpaqueSessionTokens
from tests.postgres import isolated_postgres_url, persistent_database, migrate

NOW=datetime(2026,10,18,tzinfo=UTC)


@pytest.fixture
async def session_user(persistent_database):
    user=UserEntity.create(first_name="Session",last_name="Owner",email="session-owner@example.test",username="session-owner",hashed_password="test-only-hash")
    user.activate()
    async with persistent_database.transaction() as session:
        await SQLUserRepository(session).create(user)
    return user


def service(session, current):
    return SessionService(SQLSessionRepository(session,clock=lambda:current[0]),OpaqueSessionTokens())


@pytest.mark.parametrize("remember,idle,absolute", [(False,1800,43200),(True,604800,2592000)])
async def test_issue_stores_only_digest_and_snapshots_lifetimes(persistent_database, session_user, remember, idle, absolute):
    current=[NOW]
    async with persistent_database.transaction() as session:
        issued=await service(session,current).issue(session_user.id,remember_me=remember)
        record=issued.record
        assert record.created_at == NOW and record.last_seen_at == NOW
        assert record.idle_expires_at == NOW+timedelta(seconds=idle)
        assert record.absolute_expires_at == NOW+timedelta(seconds=absolute)
        assert record.remember_me is remember and record.idle_timeout_seconds == idle
        assert record.digest == OpaqueSessionTokens().digest(issued.token)
    async with persistent_database.transaction() as session:
        stored=dict((await session.execute(text("SELECT * FROM auth_sessions WHERE digest=:digest"),{"digest":record.digest})).mappings().one())
        assert not {"token","session_id","raw_token"} & stored.keys()
        assert issued.token not in repr(stored)
        assert (await service(session,current).resolve(issued.token,touch=False)) == record
        assert await service(session,current).resolve(record.digest.hex()) is None


@pytest.mark.parametrize("remember,idle", [(False,1800),(True,604800)])
@pytest.mark.parametrize("delta,valid", [(-1,True),(0,False),(1,False)])
async def test_idle_expiry_boundary_and_no_resurrection(persistent_database, session_user, remember, idle, delta, valid):
    current=[NOW]
    async with persistent_database.transaction() as session:
        issued=await service(session,current).issue(session_user.id,remember_me=remember)
    current[0]=NOW+timedelta(seconds=idle,microseconds=delta)
    async with persistent_database.transaction() as session:
        result=await service(session,current).resolve(issued.token,touch=False)
        assert (result is not None) is valid
        if not valid:
            assert await service(session,current).resolve(issued.token) is None
            assert await session.scalar(text("SELECT last_seen_at FROM auth_sessions WHERE digest=:d"),{"d":issued.record.digest}) == NOW


@pytest.mark.parametrize("remember,idle,absolute", [(False,1800,43200),(True,604800,2592000)])
async def test_activity_slides_idle_but_never_absolute_cap(persistent_database, session_user, remember, idle, absolute):
    current=[NOW]
    async with persistent_database.transaction() as session:
        issued=await service(session,current).issue(session_user.id,remember_me=remember)
    for elapsed in range(idle//2,absolute,idle//2):
        current[0]=NOW+timedelta(seconds=elapsed)
        async with persistent_database.transaction() as session:
            record=await service(session,current).resolve(issued.token)
            assert record is not None and record.last_seen_at == current[0]
            assert record.absolute_expires_at == issued.record.absolute_expires_at
            assert record.idle_expires_at == min(current[0]+timedelta(seconds=idle),record.absolute_expires_at)
    current[0]=NOW+timedelta(seconds=absolute)
    current[0]-=timedelta(microseconds=1)
    async with persistent_database.transaction() as session:
        record=await service(session,current).resolve(issued.token)
        assert record is not None and record.idle_expires_at == record.absolute_expires_at
    current[0]+=timedelta(microseconds=1)
    async with persistent_database.transaction() as session:
        assert await service(session,current).resolve(issued.token) is None


async def test_revoke_is_idempotent_and_cannot_be_undone_by_activity(persistent_database, session_user):
    current=[NOW]
    async with persistent_database.transaction() as session:
        issued=await service(session,current).issue(session_user.id)
    current[0]+=timedelta(minutes=1)
    async with persistent_database.transaction() as session:
        store=service(session,current)
        assert await store.revoke(issued.token) is True
        assert await store.revoke(issued.token) is False
        assert await store.resolve(issued.token) is None
        assert await store.resolve("Z"*43) is None
        assert await store.revoke("Z"*43) is False


async def test_revoke_all_is_account_scoped(persistent_database,session_user):
    other=UserEntity.create(first_name="Other",last_name="Owner",email="other-owner@example.test",username="other-owner",hashed_password="test-only-hash")
    current=[NOW]
    async with persistent_database.transaction() as session:
        await SQLUserRepository(session).create(other)
        store=service(session,current)
        first=await store.issue(session_user.id)
        second=await store.issue(session_user.id,remember_me=True)
        untouched=await store.issue(other.id)
    async with persistent_database.transaction() as session:
        store=service(session,current)
        assert await store.revoke_all(session_user.id) == 2
        assert await store.revoke_all(session_user.id) == 0
        assert await store.resolve(first.token) is None and await store.resolve(second.token) is None
        assert await store.resolve(untouched.token) is not None
        assert await store.revoke_all("missing-user") == 0


async def test_session_migration_adds_digest_table_without_touching_existing_data(isolated_postgres_url):
    from app.infra.database.connection import Database
    database=Database(isolated_postgres_url)
    try:
        async with database.engine.begin() as connection:
            await connection.run_sync(migrate,"0004_registration_attempts")
            await connection.execute(text("CREATE TABLE preservation_probe (id integer PRIMARY KEY)"))
            await connection.execute(text("INSERT INTO preservation_probe VALUES (42)"))
            await connection.execute(text("""INSERT INTO users VALUES
                ('preserved', 'First', 'Last', 'keep@example.test', 'preserved',
                 'unchanged-hash', now(), now(), true, 'keep@example.test')"""))
            await connection.execute(text("""INSERT INTO registration_attempts VALUES
                (repeat('a',64), now(), now()+interval '10 minutes', 2)"""))
            identity_before=dict((await connection.execute(text("SELECT * FROM users"))).mappings().one())
            counter_before=dict((await connection.execute(text("SELECT * FROM registration_attempts"))).mappings().one())
            # Characterize the session revision explicitly; newer technical
            # migrations must not change what this BE-007 regression tests.
            await connection.run_sync(migrate, "0005_opaque_sessions")
            assert "auth_sessions" in await connection.run_sync(lambda sync:inspect(sync).get_table_names())
            assert await connection.scalar(text("SELECT version_num FROM alembic_version")) == "0005_opaque_sessions"
            assert await connection.scalar(text("SELECT id FROM preservation_probe")) == 42
            assert dict((await connection.execute(text("SELECT * FROM users"))).mappings().one()) == identity_before
            assert dict((await connection.execute(text("SELECT * FROM registration_attempts"))).mappings().one()) == counter_before
            await connection.run_sync(migrate, "0005_opaque_sessions")
        async with database.engine.begin() as connection:
            await connection.run_sync(lambda sync:migrate(sync,"0004_registration_attempts",downgrade=True))
            assert "auth_sessions" not in await connection.run_sync(lambda sync:inspect(sync).get_table_names())
            assert await connection.scalar(text("SELECT id FROM preservation_probe")) == 42
            assert dict((await connection.execute(text("SELECT * FROM users"))).mappings().one()) == identity_before
            assert dict((await connection.execute(text("SELECT * FROM registration_attempts"))).mappings().one()) == counter_before
            await connection.run_sync(migrate)
    finally:
        await database.dispose()


@pytest.mark.parametrize("operation", ["issue", "touch", "revoke", "revoke_all"])
async def test_session_writes_participate_in_caller_rollback(persistent_database, session_user, operation):
    current=[NOW]
    async with persistent_database.transaction() as session:
        issued=await service(session,current).issue(session_user.id)
    current[0]+=timedelta(minutes=1)
    with pytest.raises(RuntimeError, match="rollback probe"):
        async with persistent_database.transaction() as session:
            store=service(session,current)
            if operation == "issue":
                rolled_back=await store.issue(session_user.id)
            elif operation == "touch":
                await store.resolve(issued.token)
            elif operation == "revoke":
                await store.revoke(issued.token)
            else:
                await store.revoke_all(session_user.id)
            raise RuntimeError("rollback probe")
    async with persistent_database.transaction() as session:
        store=service(session,current)
        assert await store.resolve(issued.token,touch=False) == issued.record
        if operation == "issue":
            assert await store.resolve(rolled_back.token) is None


@pytest.mark.parametrize("mutation", [
    "digest=decode('01','hex')", "idle_timeout_seconds=0",
    "last_seen_at=created_at-interval '1 second'",
    "idle_expires_at=last_seen_at", "idle_expires_at=absolute_expires_at+interval '1 second'",
    "revoked_at=last_seen_at-interval '1 second'", "user_id='missing-user'",
], ids=["digest","idle","last-seen","idle-expiry","absolute-cap","revocation","foreign-key"])
async def test_database_rejects_invalid_session_rows(persistent_database,session_user,mutation):
    from sqlalchemy.exc import IntegrityError
    current=[NOW]
    async with persistent_database.transaction() as session:
        issued=await service(session,current).issue(session_user.id)
    with pytest.raises(IntegrityError):
        async with persistent_database.transaction() as session:
            await session.execute(text("UPDATE auth_sessions SET "+mutation+" WHERE digest=:d"),{"d":issued.record.digest})
    async with persistent_database.transaction() as session:
        assert await service(session,current).resolve(issued.token,touch=False) == issued.record


async def test_identity_deletion_cascades_sessions(persistent_database,session_user):
    current=[NOW]
    async with persistent_database.transaction() as session:
        issued=await service(session,current).issue(session_user.id)
    async with persistent_database.transaction() as session:
        await session.execute(text("DELETE FROM users WHERE id=:id"),{"id":session_user.id})
    async with persistent_database.transaction() as session:
        assert await service(session,current).resolve(issued.token) is None
        assert await session.scalar(text("SELECT count(*) FROM auth_sessions WHERE digest=:d"),{"d":issued.record.digest}) == 0


async def test_database_clock_and_policy_snapshot(persistent_database,session_user):
    from types import SimpleNamespace
    from app.application.use_cases.auth.session_models import SessionPolicy
    from app.infra.core.config import Config
    from app.interface.dependencies.session_dependencies import get_session_repository, get_session_service
    async with persistent_database.transaction() as session:
        before=await session.scalar(text("SELECT clock_timestamp()"))
        request=SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(settings=Config(_env_file=None))))
        store=get_session_service(request,await get_session_repository(session))
        issued=await store.issue(session_user.id)
        after=await session.scalar(text("SELECT clock_timestamp()"))
        assert before <= issued.record.created_at <= after
    # A different runtime policy must neither shorten nor extend an issued record.
    current=[issued.record.created_at+timedelta(minutes=1)]
    async with persistent_database.transaction() as session:
        store=SessionService(SQLSessionRepository(session,clock=lambda:current[0]),OpaqueSessionTokens(),
            SessionPolicy(idle_seconds=10,absolute_seconds=20))
        record=await store.resolve(issued.token)
        assert record.idle_timeout_seconds == 1800
        assert record.idle_expires_at == current[0]+timedelta(minutes=30)
        assert record.absolute_expires_at == issued.record.absolute_expires_at
        fresh=await store.issue(session_user.id)
        assert fresh.token != issued.token
        assert fresh.record.idle_expires_at == current[0]+timedelta(seconds=10)


async def test_digest_collision_fails_without_leaking_or_overwriting(persistent_database,session_user):
    from app.domain.error.exceptions import ConflictException
    current=[NOW]
    async with persistent_database.transaction() as session:
        issued=await service(session,current).issue(session_user.id)
    with pytest.raises(ConflictException) as error:
        async with persistent_database.transaction() as session:
            await SQLSessionRepository(session,clock=lambda:NOW).create(issued.record.digest,session_user.id,
                remember_me=True,idle_seconds=604800,absolute_seconds=2592000)
    assert issued.token not in str(error.value) and issued.record.digest.hex() not in str(error.value)
    async with persistent_database.transaction() as session:
        assert await service(session,current).resolve(issued.token,touch=False) == issued.record


async def test_missing_identity_cannot_receive_session(persistent_database):
    from app.domain.error.exceptions import ResourceNotFoundException
    with pytest.raises(ResourceNotFoundException):
        async with persistent_database.transaction() as session:
            await service(session,[NOW]).issue("missing-user")
    async with persistent_database.transaction() as session:
        assert await session.scalar(text("SELECT count(*) FROM auth_sessions")) == 0


async def test_naive_clock_and_invalid_digest_cannot_write_session(persistent_database,session_user):
    from dataclasses import replace
    async with persistent_database.transaction() as session:
        issued=await service(session,[NOW]).issue(session_user.id)
        with pytest.raises(ValueError,match="timezone aware"):
            issued.record.is_valid_at(NOW.replace(tzinfo=None))
        # Metadata must not make a revoked record valid at an earlier time either.
        assert not replace(issued.record,revoked_at=NOW).is_valid_at(NOW)
        repo=SQLSessionRepository(session,clock=lambda:NOW.replace(tzinfo=None))
        with pytest.raises(ValueError,match="timezone aware"):
            await repo.resolve(issued.record.digest)
        with pytest.raises(ValueError,match="32 bytes"):
            await repo.create(b"invalid",session_user.id,remember_me=False,idle_seconds=1800,absolute_seconds=43200)
    async with persistent_database.transaction() as session:
        assert await service(session,[NOW]).resolve(issued.token,touch=False) == issued.record


async def test_bulk_revocation_serializes_with_inflight_issuance(persistent_database,session_user):
    import asyncio
    waiting=asyncio.Event()
    class SignallingRepository(SQLSessionRepository):
        async def _lock_user(self,user_id):
            waiting.set()
            return await super()._lock_user(user_id)
    async def revoke_waiting():
        async with persistent_database.transaction() as session:
            return await SignallingRepository(session,clock=lambda:NOW).revoke_all(session_user.id)
    task=None
    try:
        async with persistent_database.transaction() as session:
            issued=await service(session,[NOW]).issue(session_user.id)
            task=asyncio.create_task(revoke_waiting())
            await asyncio.wait_for(waiting.wait(),timeout=5)
        assert await asyncio.wait_for(task,timeout=5) == 1
    finally:
        if task is not None and not task.done():
            task.cancel()
            await asyncio.gather(task,return_exceptions=True)
    async with persistent_database.transaction() as session:
        assert await service(session,[NOW]).resolve(issued.token) is None


@pytest.mark.parametrize("interleaving", ["revoke", "expire", "revoke_all"])
async def test_waiting_resolution_cannot_revive_revoked_or_expired_session(persistent_database,session_user,interleaving):
    import asyncio
    current=[NOW]
    async with persistent_database.transaction() as session:
        issued=await service(session,current).issue(session_user.id)
    waiting=asyncio.Event()
    class SignallingRepository(SQLSessionRepository):
        async def _lock_user(self,user_id):
            waiting.set()
            return await super()._lock_user(user_id)
    async def resolve_waiting():
        async with persistent_database.transaction() as session:
            store=SessionService(SignallingRepository(session,clock=lambda:current[0]),OpaqueSessionTokens())
            return await store.resolve(issued.token)
    task=None
    try:
        async with persistent_database.transaction() as session:
            # Hold the shared lock while the competing request has read ownership.
            store=service(session,current)
            if interleaving == "revoke":
                await store.revoke(issued.token)
            elif interleaving == "revoke_all":
                await store.revoke_all(session_user.id)
            else:
                await store.resolve(issued.token,touch=False)
            task=asyncio.create_task(resolve_waiting())
            await asyncio.wait_for(waiting.wait(),timeout=5)
            if interleaving == "expire":
                current[0]=NOW+timedelta(minutes=30)
        assert await asyncio.wait_for(task,timeout=5) is None
    finally:
        if task is not None and not task.done():
            task.cancel()
            await asyncio.gather(task,return_exceptions=True)


async def test_session_survives_a_fresh_application_process(persistent_database,isolated_postgres_url,session_user):
    import asyncio
    import json
    import sys
    async with persistent_database.transaction() as session:
        issued=await service(session,[NOW]).issue(session_user.id)
    process=await asyncio.create_subprocess_exec(sys.executable,"-m","tests.support.session_worker",
        stdin=asyncio.subprocess.PIPE,stdout=asyncio.subprocess.PIPE,stderr=asyncio.subprocess.PIPE)
    # Credentials travel over stdin, never process arguments or stdout.
    payload={"url":isolated_postgres_url.render_as_string(hide_password=False),"token":issued.token,"now":NOW.isoformat()}
    stdout,stderr=await asyncio.wait_for(process.communicate(json.dumps(payload).encode()),timeout=15)
    assert process.returncode == 0
    assert json.loads(stdout) == {"user_id":session_user.id,"valid":True}
    assert issued.token.encode() not in stdout+stderr


async def test_clock_rollback_fails_closed_but_allows_revocation(persistent_database,session_user):
    current=[NOW]
    async with persistent_database.transaction() as session:
        issued=await service(session,current).issue(session_user.id)
    current[0]-=timedelta(seconds=1)
    async with persistent_database.transaction() as session:
        store=service(session,current)
        assert await store.resolve(issued.token) is None
        assert await store.revoke(issued.token)
        assert await session.scalar(text("SELECT revoked_at FROM auth_sessions WHERE digest=:d"),{"d":issued.record.digest}) == NOW


async def test_startup_rejects_missing_session_migration(isolated_postgres_url):
    from fastapi.testclient import TestClient
    from app.infra.core.config import Config
    from app.infra.database.connection import Database
    from app.main import create_app
    database = Database(isolated_postgres_url)
    try:
        async with database.engine.begin() as connection:
            await connection.run_sync(migrate, "0004_registration_attempts")
        settings = Config(_env_file=None, DATABASE_URL=isolated_postgres_url.render_as_string(hide_password=False))
        with pytest.raises(RuntimeError, match="run alembic upgrade head"):
            with TestClient(create_app(settings)):
                pass
    finally:
        await database.dispose()


async def test_startup_rejects_inverted_session_policy_before_connecting():
    from fastapi.testclient import TestClient
    from app.infra.core.config import Config
    from app.main import create_app
    app=create_app(Config(_env_file=None,SESSION_IDLE_SECONDS=43201,SESSION_ABSOLUTE_SECONDS=43200))
    with pytest.raises(ValueError,match="idle <= absolute"):
        with TestClient(app):
            pass
    assert not hasattr(app.state,"database")
