from dataclasses import replace
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock, Mock
from types import SimpleNamespace

import pytest
from pydantic import ValidationError

from app.application.use_cases.auth.email_change import EmailChangeActor, EmailChangeService, email_change_context
from app.application.use_cases.auth.session_models import SessionRecord
from app.domain.error.exceptions import CredentialsValidationException, ServiceUnavailableException
from app.infra.core.config import Config
from app.infra.services.session_token_service import OpaqueSessionTokens
from app.interface.dto.email_change_dto import EmailChangeRequest
from app.interface.email_change_route import get_email_change_limiter
from app.interface.repository.email_change_repository_interface import IEmailChangeRepository


@pytest.fixture
def flow():
    now = datetime(2026, 10, 22, tzinfo=UTC)
    record = SessionRecord(b'a'*32, 'own-account', False, 1800, now, now,
        now + timedelta(minutes=30), now + timedelta(hours=12))
    actor = EmailChangeActor('own-account', 'old@example.test', b's'*32, record)
    repository = AsyncMock(spec=IEmailChangeRepository)
    repository.actor.return_value = actor
    repository.available.return_value = True
    repository.replace_email.return_value = replace(record, digest=b'b'*32)
    codes = AsyncMock()
    codes.consume.return_value = True
    return EmailChangeService(repository, codes, OpaqueSessionTokens()), actor


@pytest.mark.parametrize('token', [None, '', 'bad-token'])
async def test_invalid_cookie_never_reads_account_or_consumes_code(flow, token):
    service, actor = flow
    with pytest.raises(CredentialsValidationException):
        await service.verify(token, 'new@example.test', '12345678')
    service.repository.actor.assert_not_awaited()
    service.codes.consume.assert_not_awaited()


async def test_missing_or_revoked_actor_never_dispatches_or_changes(flow):
    service, actor = flow
    service.repository.actor.return_value = None
    token = service.tokens.generate()
    await service.dispatch(token, 'new@example.test')
    with pytest.raises(CredentialsValidationException):
        await service.verify(token, 'new@example.test', '12345678')
    service.codes.issue.assert_not_awaited()
    service.repository.replace_email.assert_not_awaited()


async def test_current_email_cannot_repurpose_email_change_for_admin_proof(flow):
    service, actor = flow
    token = service.tokens.generate()
    await service.dispatch(token, ' OLD@EXAMPLE.TEST ')
    with pytest.raises(CredentialsValidationException):
        await service.verify(token, ' OLD@EXAMPLE.TEST ', '12345678')
    service.codes.issue.assert_not_awaited()
    service.codes.consume.assert_not_awaited()


async def test_dispatch_hides_provider_details_and_code(flow, caplog):
    service, actor = flow
    service.codes.issue.side_effect = RuntimeError('private-provider-string code=87654321')
    await service.dispatch(service.tokens.generate(), 'new@example.test')
    assert 'Email change dispatch failed (RuntimeError)' in caplog.text
    assert 'private-provider-string' not in caplog.text and '87654321' not in caplog.text
    assert 'new@example.test' not in caplog.text


@pytest.mark.parametrize('remember', [False, True])
async def test_proof_passes_only_canonical_target_and_preserves_session_policy(flow, remember):
    service, actor = flow
    actor = replace(actor, session=replace(actor.session, remember_me=remember))
    service.repository.actor.return_value = actor
    result = await service.verify(service.tokens.generate(), ' NEW@EXAMPLE.TEST ', '12345678')
    service.codes.consume.assert_awaited_once_with(email_change_context(actor, 'new@example.test'), '12345678')
    service.repository.replace_email.assert_awaited_once_with(actor, 'new@example.test', service.tokens.digest(result.token),
        idle_seconds=604800 if remember else 1800, absolute_seconds=2592000 if remember else 43200)
    assert actor.email not in repr(actor) and actor.user_id not in repr(actor)


async def test_changed_account_during_commit_cannot_complete_proof(flow):
    service, actor = flow
    service.repository.replace_email.return_value = None
    with pytest.raises(CredentialsValidationException):
        await service.verify(service.tokens.generate(), 'new@example.test', '12345678')


async def test_invalid_generator_cannot_mutate_account(flow):
    service, actor = flow
    service.tokens = Mock(wraps=service.tokens)
    service.tokens.generate.return_value = 'invalid-generator-result'
    with pytest.raises(ValueError, match='invalid identifier'):
        await service.verify(OpaqueSessionTokens().generate(), 'new@example.test', '12345678')
    service.repository.replace_email.assert_not_awaited()


@pytest.mark.parametrize('email', ['a@local', 'space in@example.test', 'bad\x00@example.test', '\ud800@example.test'])
def test_change_target_obeys_existing_email_entity_validation(email):
    with pytest.raises(ValidationError):
        EmailChangeRequest(email=email)


@pytest.mark.parametrize('setting,value', [('EMAIL_CHANGE_IP_LIMIT', 0), ('EMAIL_CHANGE_IP_LIMIT', 2147483647),
    ('EMAIL_CHANGE_WINDOW_SECONDS', 0), ('EMAIL_CHANGE_MAX_BODY_BYTES', 0)])
def test_invalid_quota_configuration_is_rejected(setting, value):
    with pytest.raises(ValidationError):
        Config(_env_file=None, **{setting: value})


def test_missing_quota_database_fails_closed():
    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace()))
    with pytest.raises(ServiceUnavailableException):
        get_email_change_limiter(request)
