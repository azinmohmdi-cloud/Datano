"""Durable email proof, identity races and atomic privilege/session changes."""
import asyncio
from dataclasses import replace
from datetime import timedelta

import pytest
from sqlalchemy import text
from sqlalchemy.exc import OperationalError

from app.application.use_cases.auth.admin_policy import AdminEmailPolicy
from app.application.use_cases.auth.current_identity_use_case import GetCurrentIdentityUseCase
from app.application.use_cases.auth.email_change import EmailChangeService, email_change_context
from app.application.use_cases.auth.email_codes import EmailCodePurpose
from app.domain.entities import UserEntity
from app.domain.error.exceptions import ConflictException, CredentialsValidationException, ServiceUnavailableException
from app.infra.repositories.postgres.admin_grant_repository import SQLAdminGrantRepository
from app.infra.repositories.postgres.email_change_repository import PostgresEmailChangeRepository
from app.infra.repositories.postgres.recovery_repository import PostgresRecoveryRepository
from app.infra.repositories.postgres.role_repository import SQLRoleRepository
from app.infra.repositories.postgres.session_repository import SQLSessionRepository
from app.infra.repositories.postgres.user_repository import SQLUserRepository
from app.infra.services.session_token_service import OpaqueSessionTokens
from tests.integration.test_admin_grants import authority_account
from tests.integration.test_email_codes import Codes
from tests.postgres import isolated_postgres_url, persistent_database

TARGET = "changed@example.test"
OTHER_TARGET = "another@example.test"


@pytest.fixture
async def change(persistent_database, authority_account):
    codes = Codes(persistent_database)
    tokens = OpaqueSessionTokens()
    policy = AdminEmailPolicy.parse('["changed@example.test"]')
    repository = PostgresEmailChangeRepository(persistent_database, policy, clock=lambda: codes.now)
    token = tokens.generate()
    async with persistent_database.transaction() as session:
        role = await SQLRoleRepository(session).get_by_name("User")
        await SQLUserRepository(session).assign_role(authority_account.id, role.id)
        await SQLSessionRepository(session, clock=lambda: codes.now).create(tokens.digest(token), authority_account.id,
            remember_me=False, idle_seconds=1800, absolute_seconds=43200)
    return EmailChangeService(repository, codes.service(), tokens), codes, token, authority_account


async def identity(database, user_id, policy):
    async with database.transaction() as session:
        return await GetCurrentIdentityUseCase(SQLUserRepository(session), SQLRoleRepository(session),
            SQLAdminGrantRepository(session), policy).execute(user_id)


async def snapshot(database, user_id):
    async with database.transaction() as session:
        return {table: [dict(row) for row in (await session.execute(text(
            "SELECT * FROM " + table + " WHERE " + ("id" if table == "users" else "user_id") + "=:id ORDER BY 1"),
            {"id": user_id})).mappings()] for table in (
            "users", "user_roles", "admin_grants", "auth_sessions", "password_recovery_grants")}


async def another_account(database, flow, codes):
    user = UserEntity.create(first_name="Other", last_name="Owner", email="other@example.test",
        username="other-owner", hashed_password="other-test-only-hash")
    user.activate()
    token = flow.tokens.generate()
    async with database.transaction() as session:
        users = SQLUserRepository(session)
        await users.create(user)
        await users.assign_role(user.id, (await SQLRoleRepository(session).get_by_name("User")).id)
        await SQLSessionRepository(session, clock=lambda: codes.now).create(flow.tokens.digest(token), user.id,
            remember_me=True, idle_seconds=604800, absolute_seconds=2592000)
    return user, token


async def test_target_switch_and_other_browser_share_cooldown_and_five_attempts(persistent_database, change):
    flow, codes, token, user = change
    other = flow.tokens.generate()
    async with persistent_database.transaction() as session:
        await SQLSessionRepository(session, clock=lambda: codes.now).create(flow.tokens.digest(other), user.id,
            remember_me=True, idle_seconds=604800, absolute_seconds=2592000)
    await flow.dispatch(token, TARGET)
    code = codes.code()
    await flow.dispatch(other, OTHER_TARGET)
    assert codes.sender.send.await_count == 1
    for browser, target in [(token, TARGET), (other, OTHER_TARGET), (token, OTHER_TARGET), (other, TARGET), (token, TARGET)]:
        with pytest.raises(CredentialsValidationException):
            await flow.verify(browser, target, "99999999")
    with pytest.raises(CredentialsValidationException):
        await flow.verify(other, TARGET, code)
    context = email_change_context(await flow.require_actor(token), TARGET)
    assert (await codes.row(context))["attempts"] == 5
    assert (await identity(persistent_database, user.id, flow.repository.eligibility)).user.email == user.email


async def test_cross_target_resend_has_exact_sixty_second_boundary_and_invalidates_previous(change):
    flow, codes, token, user = change
    await flow.dispatch(token, TARGET)
    old = codes.code()
    codes.now += timedelta(seconds=59, microseconds=999999)
    await flow.dispatch(token, OTHER_TARGET)
    assert codes.sender.send.await_count == 1
    codes.now += timedelta(microseconds=1)
    await flow.dispatch(token, OTHER_TARGET)
    fresh = codes.code()
    assert fresh != old and codes.sender.send.await_count == 2
    for email, code in [(TARGET, old), (OTHER_TARGET, old), (TARGET, fresh)]:
        with pytest.raises(CredentialsValidationException):
            await flow.verify(token, email, code)
    issued = await flow.verify(token, OTHER_TARGET, fresh)
    assert issued.record.user_id == user.id


@pytest.mark.parametrize("seconds, allowed", [(599.999999, True), (600, False)])
async def test_email_change_code_expiry_exact_boundary(change, seconds, allowed):
    flow, codes, token, user = change
    await flow.dispatch(token, TARGET)
    code = codes.code()
    codes.now += timedelta(seconds=seconds)
    if allowed:
        assert (await flow.verify(token, TARGET, code)).record.user_id == user.id
    else:
        with pytest.raises(CredentialsValidationException):
            await flow.verify(token, TARGET, code)


async def test_proof_binds_account_target_and_purpose(persistent_database, change):
    flow, codes, token, user = change
    _, other_token = await another_account(persistent_database, flow, codes)
    await flow.dispatch(token, TARGET)
    code = codes.code()
    context = email_change_context(await flow.require_actor(token), TARGET)
    for altered in (replace(context, purpose=EmailCodePurpose.PASSWORD_RECOVERY),
                    replace(context, purpose=EmailCodePurpose.ADMIN_EMAIL), replace(context, subject="another-account")):
        assert not await codes.service().consume(altered, code)
    assert (await codes.row(context))["attempts"] == 0
    with pytest.raises(CredentialsValidationException):
        await flow.verify(other_token, TARGET, code)
    with pytest.raises(CredentialsValidationException):
        await flow.verify(token, OTHER_TARGET, code)
    assert (await flow.verify(token, " CHANGED@EXAMPLE.TEST ", code)).record.user_id == user.id


async def test_parallel_same_proof_has_exactly_one_winner(persistent_database, change):
    flow, codes, token, user = change
    await flow.dispatch(token, TARGET)
    code = codes.code()
    results = await asyncio.gather(*(flow.verify(token, TARGET, code) for _ in range(8)), return_exceptions=True)
    assert sum(not isinstance(result, Exception) for result in results) == 1
    assert all(not isinstance(result, Exception) or isinstance(result, CredentialsValidationException) for result in results)
    after = await snapshot(persistent_database, user.id)
    assert after["users"][0]["email_key"] == TARGET
    assert len(after["admin_grants"]) == 1
    assert sum(row["revoked_at"] is None for row in after["auth_sessions"]) == 1


async def test_two_accounts_competing_for_same_canonical_target_have_one_atomic_winner(persistent_database, change):
    flow, codes, token, user = change
    other, other_token = await another_account(persistent_database, flow, codes)
    await flow.dispatch(token, TARGET)
    first_code = codes.code()
    await flow.dispatch(other_token, " CHANGED@EXAMPLE.TEST ")
    second_code = codes.code()
    before = {account.id: await snapshot(persistent_database, account.id) for account in (user, other)}
    results = await asyncio.gather(flow.verify(token, TARGET, first_code),
        flow.verify(other_token, " CHANGED@EXAMPLE.TEST ", second_code), return_exceptions=True)
    assert sum(not isinstance(result, Exception) for result in results) == 1
    assert sum(isinstance(result, ConflictException) for result in results) == 1
    for index, account in enumerate((user, other)):
        after = await snapshot(persistent_database, account.id)
        if isinstance(results[index], ConflictException):
            assert after == before[account.id]
            assert await flow.require_actor((token, other_token)[index])
        else:
            assert after["users"][0]["email_key"] == TARGET
            assert len(after["admin_grants"]) == 1
            assert sum(row["revoked_at"] is None for row in after["auth_sessions"]) == 1


async def test_target_claimed_after_dispatch_preserves_every_losing_account_field(persistent_database, change):
    flow, codes, token, user = change
    await flow.dispatch(token, TARGET)
    code = codes.code()
    other, other_token = await another_account(persistent_database, flow, codes)
    async with persistent_database.transaction() as session:
        await session.execute(text("UPDATE users SET email=:email,email_key=:email WHERE id=:id"), {"email": TARGET, "id": other.id})
    before = await snapshot(persistent_database, user.id)
    unrelated = await snapshot(persistent_database, other.id)
    with pytest.raises(ConflictException) as caught:
        await flow.verify(token, TARGET, code)
    assert caught.value.__context__ is None
    assert await snapshot(persistent_database, user.id) == before
    assert await snapshot(persistent_database, other.id) == unrelated
    assert await flow.require_actor(token) and await flow.require_actor(other_token)


async def test_failure_after_session_insert_rolls_back_email_authority_and_all_revocations(
        persistent_database, change, monkeypatch):
    flow, codes, token, user = change
    recovery = PostgresRecoveryRepository(persistent_database, clock=lambda: codes.now)
    account = await recovery.account(user.email)
    assert await recovery.grant(account, b"r" * 32, seconds=600)
    await flow.dispatch(token, TARGET)
    code = codes.code()
    before = await snapshot(persistent_database, user.id)
    original = SQLSessionRepository.create
    async def failing(self, *args, **kwargs):
        await original(self, *args, **kwargs)
        raise OperationalError("private-driver-details", {}, Exception("private-driver-details"))
    with monkeypatch.context() as patch:
        patch.setattr(SQLSessionRepository, "create", failing)
        with pytest.raises(ServiceUnavailableException) as caught:
            await flow.verify(token, TARGET, code)
    assert caught.value.__context__ is None and "private-driver-details" not in str(caught.value)
    assert await snapshot(persistent_database, user.id) == before
    assert await flow.require_actor(token)
    assert await recovery.valid(b"r" * 32)
    with pytest.raises(CredentialsValidationException):
        await flow.verify(token, TARGET, code)


@pytest.mark.parametrize("change_kind", ["password", "email", "inactive", "revoke"])
async def test_account_or_session_changed_after_code_consumption_prevents_replacement(
        persistent_database, change, monkeypatch, change_kind):
    flow, codes, token, user = change
    await flow.dispatch(token, TARGET)
    code = codes.code()
    original = flow.codes.consume
    changed = None
    async def consume_then_change(context, candidate):
        nonlocal changed
        consumed = await original(context, candidate)
        assert consumed
        async with persistent_database.transaction() as session:
            if change_kind == "password":
                await session.execute(text("UPDATE users SET hashed_password='new-test-only-hash' WHERE id=:id"), {"id": user.id})
            elif change_kind == "email":
                await session.execute(text("UPDATE users SET email='externally-changed@example.test',email_key='externally-changed@example.test' WHERE id=:id"), {"id": user.id})
            elif change_kind == "inactive":
                await session.execute(text("UPDATE users SET is_active=false WHERE id=:id"), {"id": user.id})
            else:
                await SQLSessionRepository(session, clock=lambda: codes.now).revoke(flow.tokens.digest(token))
        changed = await snapshot(persistent_database, user.id)
        return consumed
    monkeypatch.setattr(flow.codes, "consume", consume_then_change)
    with pytest.raises(CredentialsValidationException):
        await flow.verify(token, TARGET, code)
    assert changed is not None and await snapshot(persistent_database, user.id) == changed


async def test_session_expiry_during_authority_change_rolls_back_every_write(persistent_database, change):
    flow, codes, token, user = change
    actor = await flow.require_actor(token)
    before = await snapshot(persistent_database, user.id)
    class Expiring(PostgresEmailChangeRepository):
        async def _authority(self, *args, **kwargs):
            await super()._authority(*args, **kwargs)
            codes.now += timedelta(seconds=1800)
    repository = Expiring(persistent_database, flow.repository.eligibility, clock=lambda: codes.now)
    with pytest.raises(CredentialsValidationException):
        await repository.replace_email(actor, TARGET, b"n" * 32, idle_seconds=1800, absolute_seconds=43200)
    assert await snapshot(persistent_database, user.id) == before


async def test_change_preserves_other_user_and_revokes_old_recovery_grant(persistent_database, change):
    flow, codes, token, user = change
    other, other_token = await another_account(persistent_database, flow, codes)
    unrelated = await snapshot(persistent_database, other.id)
    recovery = PostgresRecoveryRepository(persistent_database, clock=lambda: codes.now)
    assert await recovery.grant(await recovery.account(user.email), b"r" * 32, seconds=600)
    assert await recovery.grant(await recovery.account(other.email), b"o" * 32, seconds=600)
    unrelated = await snapshot(persistent_database, other.id)
    await flow.dispatch(token, TARGET)
    assert (await flow.verify(token, TARGET, codes.code())).record.user_id == user.id
    assert await snapshot(persistent_database, other.id) == unrelated
    assert await flow.require_actor(other_token)
    assert not await recovery.valid(b"r" * 32)
    assert await recovery.valid(b"o" * 32)


@pytest.mark.parametrize("reason", ["not-allowlisted", "inactive-admin", "missing-admin"])
async def test_new_mailbox_requires_current_private_policy_and_active_admin_role(
        persistent_database, change, reason):
    flow, codes, token, user = change
    if reason == "not-allowlisted":
        flow.repository.eligibility = AdminEmailPolicy()
    else:
        async with persistent_database.transaction() as session:
            if reason == "inactive-admin":
                await session.execute(text("UPDATE roles SET is_active=false WHERE name='Admin'"))
            else:
                await session.execute(text("DELETE FROM roles WHERE name='Admin'"))
    await flow.dispatch(token, TARGET)
    issued = await flow.verify(token, TARGET, codes.code())
    result = await identity(persistent_database, user.id, flow.repository.eligibility)
    assert result.user.email == TARGET and result.effective_role == "User"
    assert all(role.name != "Admin" for role in result.user.roles)
    assert issued.token != token
    assert not (await snapshot(persistent_database, user.id))["admin_grants"]


async def test_allowlist_removed_after_consumption_does_not_create_authority(persistent_database, change, monkeypatch):
    flow, codes, token, user = change
    await flow.dispatch(token, TARGET)
    original = flow.codes.consume
    async def consume_then_remove(context, code):
        consumed = await original(context, code)
        flow.repository.eligibility = AdminEmailPolicy()
        return consumed
    monkeypatch.setattr(flow.codes, "consume", consume_then_remove)
    issued = await flow.verify(token, TARGET, codes.code())
    assert issued.record.user_id == user.id
    assert (await identity(persistent_database, user.id, flow.repository.eligibility)).effective_role == "User"
    assert not (await snapshot(persistent_database, user.id))["admin_grants"]


async def test_inactive_user_role_is_not_reactivated_or_granted_by_change(persistent_database, change):
    flow, codes, token, user = change
    async with persistent_database.transaction() as session:
        await session.execute(text("UPDATE roles SET is_active=false WHERE name='User'"))
    await flow.dispatch(token, OTHER_TARGET)
    await flow.verify(token, OTHER_TARGET, codes.code())
    result = await identity(persistent_database, user.id, flow.repository.eligibility)
    assert result.effective_role is None
    async with persistent_database.transaction() as session:
        assert await session.scalar(text("SELECT is_active FROM roles WHERE name='User'")) is False


async def test_concurrent_names_update_is_preserved_by_narrow_email_write(persistent_database, change, monkeypatch):
    flow, codes, token, user = change
    await flow.dispatch(token, TARGET)
    consume = flow.codes.consume
    async def consume_then_edit_names(context, candidate):
        valid = await consume(context, candidate)
        async with persistent_database.transaction() as session:
            await SQLUserRepository(session).update_profile_names(user.id, first_name='نام تازه',
                last_name='هم‌زمان', updated_at=codes.now)
        return valid
    monkeypatch.setattr(flow.codes, 'consume', consume_then_edit_names)
    await flow.verify(token, TARGET, codes.code())
    result = await identity(persistent_database, user.id, flow.repository.eligibility)
    assert (result.user.first_name, result.user.last_name, result.user.email) == ('نام تازه', 'هم‌زمان', TARGET)
