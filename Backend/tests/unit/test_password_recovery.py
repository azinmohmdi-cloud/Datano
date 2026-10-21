from unittest.mock import AsyncMock, Mock
from datetime import UTC, datetime

import pytest

from app.application.use_cases.auth.password_recovery import PasswordRecoveryService, RecoveryAccount, RecoveryGrant, ResetPasswordService
from app.domain.error.exceptions import CredentialsValidationException, ValidationException
from app.infra.services.recovery_token_service import RecoveryTokens
from app.infra.services.session_token_service import OpaqueSessionTokens
from app.interface.repository.recovery_repository_interface import IRecoveryRepository


def test_recovery_token_is_random_digest_only_and_cannot_be_a_normal_session():
    tokens = RecoveryTokens()
    token = tokens.generate()
    assert token != tokens.generate()
    assert len(tokens.digest(token)) == 32
    assert OpaqueSessionTokens().digest(token) is None
    assert tokens.digest(OpaqueSessionTokens().generate()) is None


async def test_reset_consumes_grant_without_creating_login_or_accepting_user_id():
    repository = AsyncMock(spec=IRecoveryRepository)
    repository.valid.return_value = repository.reset.return_value = True
    passwords = Mock()
    passwords.hash.return_value = 'test-only-argon2-hash'
    token = 'recovery.' + 'x' * 43
    service = ResetPasswordService(repository, RecoveryTokens(), passwords)
    assert await service.execute(token, 'a sufficiently long password', 'a sufficiently long password') is None
    repository.reset.assert_awaited_once_with(RecoveryTokens().digest(token), 'test-only-argon2-hash')


@pytest.mark.parametrize('token', [None, '', 'x'*43, 'recovery.short', 'recovery.'+'x'*44, 'recovery.'+'ع'*43, 'recovery.'+'x'*43+'\n'])
def test_wrong_recovery_credentials_never_digest(token):
    assert RecoveryTokens().digest(token) is None


@pytest.mark.parametrize('password,confirmation', [('short','short'), ('x'*129,'x'*129), ('x'*15,'different'), ('\ud800'*15,'\ud800'*15)])
async def test_new_password_policy_and_exact_confirmation_are_required(password, confirmation):
    repository = AsyncMock(spec=IRecoveryRepository)
    repository.valid.return_value = True
    passwords = Mock()
    with pytest.raises(ValidationException):
        await ResetPasswordService(repository, RecoveryTokens(), passwords).execute('recovery.'+'x'*43, password, confirmation)
    passwords.hash.assert_not_called()
    repository.reset.assert_not_awaited()


async def test_unknown_and_inactive_accounts_never_send_or_provision_grant():
    repository, codes = AsyncMock(spec=IRecoveryRepository), AsyncMock()
    repository.account.return_value = None
    codes.consume.return_value = False
    service = PasswordRecoveryService(repository, codes, RecoveryTokens())
    await service.dispatch('unknown@example.test')
    codes.issue.assert_not_awaited()
    with pytest.raises(CredentialsValidationException):
        await service.verify('unknown@example.test', '12345678')
    codes.consume.assert_awaited_once()
    repository.grant.assert_not_awaited()


async def test_dispatch_error_is_observable_without_private_text(caplog):
    repository, codes = AsyncMock(spec=IRecoveryRepository), AsyncMock()
    repository.account.return_value = RecoveryAccount('id', 'owner@example.test', b'a'*32)
    codes.issue.side_effect = RuntimeError('private-provider-secret CODE=87654321')
    await PasswordRecoveryService(repository, codes, RecoveryTokens()).dispatch('owner@example.test')
    assert 'dispatch failed' in caplog.text
    assert 'private-provider-secret' not in caplog.text and '87654321' not in caplog.text


async def test_changed_account_after_verification_cannot_issue_grant():
    repository, codes = AsyncMock(spec=IRecoveryRepository), AsyncMock()
    repository.account.return_value = RecoveryAccount('id', 'owner@example.test', b'a'*32)
    repository.grant.return_value = None
    codes.consume.return_value = True
    with pytest.raises(CredentialsValidationException):
        await PasswordRecoveryService(repository, codes, RecoveryTokens()).verify('owner@example.test','12345678')


def test_recovery_objects_hide_capability_and_identity():
    token = RecoveryTokens().generate()
    assert token not in repr(RecoveryGrant(token, datetime.now(UTC)))
    assert 'owner@example.test' not in repr(RecoveryAccount('id','owner@example.test',b'a'*32))


async def test_grant_revoked_during_hashing_cannot_reset():
    repository=AsyncMock(spec=IRecoveryRepository)
    repository.valid.return_value=True
    repository.reset.return_value=False
    passwords=Mock()
    passwords.hash.return_value='synthetic-hash'
    with pytest.raises(CredentialsValidationException):
        await ResetPasswordService(repository,RecoveryTokens(),passwords).execute('recovery.'+'x'*43,'a sufficiently long password','a sufficiently long password')


@pytest.mark.parametrize('seconds',[0,601,True])
def test_internal_service_rejects_invalid_grant_lifetime(seconds):
    with pytest.raises(ValueError):
        PasswordRecoveryService(AsyncMock(),AsyncMock(),RecoveryTokens(),grant_seconds=seconds)
