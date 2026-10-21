"""Real PostgreSQL authority, code policy, concurrency and transaction boundaries."""
import asyncio
from dataclasses import replace
from datetime import timedelta

import pytest
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.application.use_cases.auth.admin_email import AdminEmailService, admin_email_context
from app.application.use_cases.auth.admin_policy import AdminEmailPolicy
from app.application.use_cases.auth.email_codes import EmailCodePurpose
from app.domain.error.exceptions import CredentialsValidationException, ServiceUnavailableException
from app.infra.repositories.postgres.admin_grant_repository import SQLAdminGrantRepository
from app.infra.repositories.postgres.admin_proof_repository import PostgresAdminProofRepository
from app.infra.repositories.postgres.role_repository import SQLRoleRepository
from app.infra.repositories.postgres.session_repository import SQLSessionRepository
from app.infra.services.session_token_service import OpaqueSessionTokens
from tests.integration.test_admin_grants import authority_account
from tests.integration.test_email_codes import Codes
from tests.postgres import isolated_postgres_url, persistent_database


@pytest.fixture
async def proof(persistent_database,authority_account):
    codes=Codes(persistent_database)
    policy=AdminEmailPolicy.parse('["authority@example.test"]')
    tokens=OpaqueSessionTokens()
    repository=PostgresAdminProofRepository(persistent_database,policy,clock=lambda:codes.now)
    token=tokens.generate()
    async with persistent_database.transaction() as session:
        await SQLSessionRepository(session,clock=lambda:codes.now).create(tokens.digest(token),authority_account.id,
            remember_me=False,idle_seconds=1800,absolute_seconds=43200)
    service=AdminEmailService(repository,codes.service(),tokens,policy)
    return service,codes,token,authority_account


async def test_other_account_purpose_and_mailbox_cannot_redeem_proof(proof):
    flow,codes,token,user=proof
    actor=await flow.require_actor(token)
    context=admin_email_context(actor)
    await flow.dispatch(token)
    code=codes.code()
    for changed in (replace(context,purpose=EmailCodePurpose.PASSWORD_RECOVERY),
                    replace(context,purpose=EmailCodePurpose.EMAIL_CHANGE),
                    replace(context,subject='another-account'),replace(context,recipient='another@example.test')):
        assert not await codes.service().consume(changed,code)
    assert (await flow.verify(token,code)).record.user_id == user.id


async def test_cooldown_and_attempts_are_shared_across_sessions(persistent_database,proof):
    flow,codes,token,user=proof
    other=flow.tokens.generate()
    async with persistent_database.transaction() as session:
        await SQLSessionRepository(session,clock=lambda:codes.now).create(flow.tokens.digest(other),user.id,
            remember_me=True,idle_seconds=604800,absolute_seconds=2592000)
    await flow.dispatch(token)
    code=codes.code()
    await flow.dispatch(other)
    assert codes.sender.send.await_count == 1
    for candidate in (token,other,token,other,token):
        with pytest.raises(CredentialsValidationException):
            await flow.verify(candidate,'bad')
    with pytest.raises(CredentialsValidationException):
        await flow.verify(other,code)
    assert (await codes.row(admin_email_context(await flow.require_actor(token))))['attempts'] == 5


async def test_resend_invalidates_previous_code_at_sixty_seconds(proof):
    flow,codes,token,user=proof
    await flow.dispatch(token)
    old=codes.code()
    codes.now+=timedelta(seconds=59)
    await flow.dispatch(token)
    assert codes.sender.send.await_count == 1
    codes.now+=timedelta(seconds=1)
    await flow.dispatch(token)
    fresh=codes.code()
    assert fresh != old and codes.sender.send.await_count == 2
    with pytest.raises(CredentialsValidationException):
        await flow.verify(token,old)
    assert (await flow.verify(token,fresh)).record.user_id == user.id


@pytest.mark.parametrize('seconds,allowed',[(599.999999,True),(600,False)])
async def test_admin_code_expiry_exact_boundary(proof,seconds,allowed):
    flow,codes,token,user=proof
    await flow.dispatch(token)
    code=codes.code()
    codes.now+=timedelta(seconds=seconds)
    if allowed:
        assert (await flow.verify(token,code)).record.user_id == user.id
    else:
        with pytest.raises(CredentialsValidationException):
            await flow.verify(token,code)


@pytest.mark.parametrize('change',["email='changed@example.test',email_key='changed@example.test'",
    "hashed_password='changed-test-hash'","is_active=false"])
async def test_outstanding_code_cannot_elevate_changed_account(persistent_database,proof,change):
    flow,codes,token,user=proof
    await flow.dispatch(token)
    code=codes.code()
    async with persistent_database.transaction() as session:
        await session.execute(text('UPDATE users SET '+change+' WHERE id=:id'),{'id':user.id})
    with pytest.raises(CredentialsValidationException):
        await flow.verify(token,code)
    async with persistent_database.transaction() as session:
        assert await session.scalar(text('SELECT count(*) FROM admin_grants')) == 0


async def test_parallel_proof_has_exactly_one_winner(persistent_database,proof):
    flow,codes,token,user=proof
    await flow.dispatch(token)
    code=codes.code()
    results=await asyncio.gather(*(flow.verify(token,code) for _ in range(8)),return_exceptions=True)
    assert sum(not isinstance(result,Exception) for result in results) == 1
    assert all(not isinstance(result,Exception) or isinstance(result,CredentialsValidationException) for result in results)
    async with persistent_database.transaction() as session:
        assert await session.scalar(text('SELECT count(*) FROM admin_grants')) == 1
        assert await session.scalar(text('SELECT count(*) FROM auth_sessions WHERE revoked_at IS NULL')) == 1


async def test_failed_promotion_rolls_back_grant_role_and_revocation(monkeypatch,persistent_database,proof):
    flow,codes,token,user=proof
    await flow.dispatch(token)
    code=codes.code()
    original=SQLSessionRepository.create
    async def failing(self,*args,**kwargs):
        await original(self,*args,**kwargs)
        raise OperationalError('private-driver-content',{},Exception('private-driver-content'))
    with monkeypatch.context() as patch:
        patch.setattr(SQLSessionRepository,'create',failing)
        with pytest.raises(ServiceUnavailableException) as caught:
            await flow.verify(token,code)
    assert caught.value.__context__ is None and 'private-driver-content' not in str(caught.value)
    async with persistent_database.transaction() as session:
        assert await session.scalar(text('SELECT count(*) FROM admin_grants')) == 0
        assert await session.scalar(text("SELECT count(*) FROM user_roles ur JOIN roles r ON r.id=ur.role_id WHERE r.name='Admin'")) == 0
        assert await session.scalar(text('SELECT count(*) FROM auth_sessions WHERE revoked_at IS NULL')) == 1
    assert await flow.require_actor(token)
    # Consumed proof is deliberately burned on failed promotion, never reusable.
    with pytest.raises(CredentialsValidationException):
        await flow.verify(token,code)


async def test_session_expiring_during_grant_rolls_back_every_write(persistent_database,proof):
    flow,codes,token,user=proof
    actor=await flow.require_actor(token)
    class Expiring(PostgresAdminProofRepository):
        async def _grant(self,*args,**kwargs):
            value=await super()._grant(*args,**kwargs)
            codes.now+=timedelta(seconds=1800)
            return value
    repository=Expiring(persistent_database,flow.eligibility,clock=lambda:codes.now)
    with pytest.raises(CredentialsValidationException):
        await repository.promote(actor,b'n'*32,idle_seconds=1800,absolute_seconds=43200)
    async with persistent_database.transaction() as session:
        assert await session.scalar(text('SELECT count(*) FROM admin_grants')) == 0
        assert await session.scalar(text('SELECT count(*) FROM auth_sessions WHERE revoked_at IS NULL')) == 1


@pytest.mark.parametrize('reason',['ineligible','inactive','missing','inactive-role','missing-role'])
async def test_private_provisioning_requires_all_server_preconditions(persistent_database,authority_account,reason):
    policy=AdminEmailPolicy.parse('["authority@example.test"]' if reason != 'ineligible' else '[]')
    async with persistent_database.transaction() as session:
        if reason == 'inactive':
            await session.execute(text('UPDATE users SET is_active=false WHERE id=:id'),{'id':authority_account.id})
        if reason == 'inactive-role':
            await session.execute(text("UPDATE roles SET is_active=false WHERE name='Admin'"))
        if reason == 'missing-role':
            await session.execute(text("DELETE FROM roles WHERE name='Admin'"))
    assert not await PostgresAdminProofRepository(persistent_database,policy).provision(
        'missing-id' if reason == 'missing' else authority_account.id)
    async with persistent_database.transaction() as session:
        assert await session.scalar(text('SELECT count(*) FROM admin_grants')) == 0


async def test_role_edit_and_reactivation_do_not_restore_previous_proof(persistent_database,authority_account):
    repository=PostgresAdminProofRepository(persistent_database,AdminEmailPolicy.parse('["authority@example.test"]'))
    assert await repository.provision(authority_account.id)
    async with persistent_database.transaction() as session:
        roles=SQLRoleRepository(session)
        role=await roles.get_by_name('Admin')
        role.deactivate()
        await roles.update(role)
        role.activate()
        await roles.update(role)
        assert not await SQLAdminGrantRepository(session).verified(authority_account.id,authority_account.email,role)


@pytest.mark.parametrize('change',['revoke','password','role'])
async def test_state_change_after_consumption_cannot_promote(persistent_database,proof,change,monkeypatch):
    flow,codes,token,user=proof
    await flow.dispatch(token)
    code=codes.code()
    original=flow.codes.consume
    async def consume_then_change(context,code):
        consumed=await original(context,code)
        assert consumed
        async with persistent_database.transaction() as session:
            if change == 'revoke':
                await SQLSessionRepository(session,clock=lambda:codes.now).revoke(flow.tokens.digest(token))
            elif change == 'password':
                await session.execute(text("UPDATE users SET hashed_password='new-test-hash' WHERE id=:id"),{'id':user.id})
            else:
                await session.execute(text("UPDATE roles SET is_active=false WHERE name='Admin'"))
        return consumed
    monkeypatch.setattr(flow.codes,'consume',consume_then_change)
    with pytest.raises(CredentialsValidationException):
        await flow.verify(token,code)
    async with persistent_database.transaction() as session:
        assert await session.scalar(text('SELECT count(*) FROM admin_grants')) == 0
        assert await session.scalar(text('SELECT count(*) FROM auth_sessions')) == 1


async def test_failed_authority_read_is_sanitized_and_never_treated_as_admin(persistent_database,authority_account,monkeypatch):
    async with persistent_database.transaction() as session:
        role=await SQLRoleRepository(session).get_by_name('Admin')
        async def broken(*args,**kwargs):
            raise OperationalError('private-reader-details',{},Exception('private-reader-details'))
        monkeypatch.setattr(session,'scalar',broken)
        with pytest.raises(ServiceUnavailableException) as caught:
            await SQLAdminGrantRepository(session).verified(authority_account.id,authority_account.email,role)
        assert caught.value.__context__ is None and 'private-reader-details' not in str(caught.value)
        role.deactivate()
        assert not await SQLAdminGrantRepository(session).verified(authority_account.id,authority_account.email,role)


async def test_elevation_preserves_other_account_sessions(persistent_database,proof):
    from app.domain.entities import UserEntity
    from app.infra.repositories.postgres.user_repository import SQLUserRepository
    flow,codes,token,user=proof
    other=UserEntity.create(first_name='Other',last_name='Owner',email='other@example.test',
        username='other-owner',hashed_password='test-only-hash')
    other.activate()
    async with persistent_database.transaction() as session:
        await SQLUserRepository(session).create(other)
        await SQLSessionRepository(session,clock=lambda:codes.now).create(b'o'*32,other.id,
            remember_me=True,idle_seconds=604800,absolute_seconds=2592000)
    await flow.dispatch(token)
    await flow.verify(token,codes.code())
    async with persistent_database.transaction() as session:
        assert await SQLSessionRepository(session,clock=lambda:codes.now).resolve(b'o'*32)
