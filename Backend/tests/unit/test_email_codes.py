import hashlib
import hmac
import json
from dataclasses import replace
from datetime import UTC, datetime
from unittest.mock import AsyncMock

import pytest

from app.application.use_cases.auth.email import EmailDeliveryError, EmailFailure, IEmailSender
from app.application.use_cases.auth.email_codes import CodeReservation, EmailCodeContext, EmailCodePurpose, EmailCodeService, EmailCodeUnavailable
from app.infra.services.email_code_crypto import EmailCodeCrypto
from app.interface.repository.email_code_repository_interface import IEmailCodeRepository


KEY = b"test-only-email-code-key-not-a-deployment-key"
CONTEXT = EmailCodeContext(EmailCodePurpose.PASSWORD_RECOVERY, "account-one", "owner@example.test")


@pytest.mark.parametrize('sample,code', [(0, '00000000'), (42, '00000042'), (99_999_999, '99999999')])
def test_generator_preserves_leading_zeroes_and_uses_secure_randomness(monkeypatch, sample, code):
    random = []
    monkeypatch.setattr("secrets.randbelow", lambda limit: random.append(limit) or sample)
    assert EmailCodeCrypto(KEY).generate() == code
    assert random == [100_000_000]


def test_digest_is_keyed_bound_and_not_plain_sha256():
    crypto = EmailCodeCrypto(KEY)
    digest = crypto.digest(CONTEXT, "12345678")
    assert len(digest) == 32 and digest != hashlib.sha256(b"12345678").digest()
    assert digest != EmailCodeCrypto(KEY + b"different").digest(CONTEXT, "12345678")
    assert hmac.compare_digest(digest, crypto.digest(CONTEXT, "12345678"))


async def test_consumption_passes_only_digest_to_repository():
    repository = AsyncMock(spec=IEmailCodeRepository)
    repository.consume.return_value = True
    crypto = EmailCodeCrypto(KEY)
    service = EmailCodeService(repository, crypto, AsyncMock(spec=IEmailSender))
    assert await service.consume(CONTEXT, "12345678")
    repository.consume.assert_awaited_once_with(crypto.scope(CONTEXT), crypto.digest(CONTEXT, "12345678"))


def test_hmac_matches_framed_sha256_vector_and_canonical_email():
    crypto = EmailCodeCrypto(KEY)
    frame = json.dumps(["datano-email-code-scope-v1", "password_recovery", "account-one", "owner@example.test"], separators=(",", ":")).encode()
    scope = hmac.digest(KEY, frame, 'sha256')
    assert crypto.scope(CONTEXT) == scope
    assert crypto.digest(CONTEXT, "12345678") == hmac.digest(KEY, b'datano-email-code-v1:' + scope + b'code:12345678', 'sha256')
    assert crypto.scope(replace(CONTEXT, recipient=" OWNER@EXAMPLE.TEST ")) == scope
    assert CONTEXT.recipient not in repr(CONTEXT) and CONTEXT.subject not in repr(CONTEXT)
    assert KEY.decode() not in repr(crypto)


@pytest.mark.parametrize('context', [replace(CONTEXT, purpose=EmailCodePurpose.ADMIN_EMAIL),
    replace(CONTEXT, purpose=EmailCodePurpose.EMAIL_CHANGE), replace(CONTEXT, subject='account-two'),
    replace(CONTEXT, recipient='other@example.test'), replace(CONTEXT, recipient='owner+tag@example.test')])
def test_hmac_is_bound_to_purpose_account_and_exact_canonical_recipient(context):
    crypto = EmailCodeCrypto(KEY)
    assert crypto.scope(context) != crypto.scope(CONTEXT)
    assert crypto.digest(context, '12345678') != crypto.digest(CONTEXT, '12345678')


def test_email_change_shares_scope_across_targets_but_binds_proof_to_target():
    crypto = EmailCodeCrypto(KEY)
    first = replace(CONTEXT, purpose=EmailCodePurpose.EMAIL_CHANGE)
    second = replace(first, recipient='new@example.test')
    assert crypto.scope(first) == crypto.scope(second)
    assert crypto.digest(first, '12345678') != crypto.digest(second, '12345678')
    assert crypto.digest(second, '12345678') == crypto.digest(replace(second, recipient=' NEW@EXAMPLE.TEST '), '12345678')


@pytest.mark.parametrize('key', [None, '', b'', b'short', b'x' * 31])
def test_missing_or_short_key_has_no_fallback_or_secret_echo(key):
    with pytest.raises(ValueError):
        EmailCodeCrypto(key)


@pytest.mark.parametrize('changes', [{'purpose': 'invented'}, {'subject': ''}, {'subject': 'id\x00bad'}, {'subject': '\ud800'},
    {'recipient': 'not-an-email'}, {'recipient': 'owner@example.test\r\nBcc: x@example.test'}, {'recipient': None}])
def test_invalid_context_rejected_without_echoing_inputs(changes):
    with pytest.raises(ValueError, match='Invalid email code context'):
        replace(CONTEXT, **changes)


@pytest.mark.parametrize('code', ['', '1234567', '123456789', '۱۲۳۴۵۶۷۸', '１２３４５６７８', ' 12345678', '12345678\n', None, 12345678])
async def test_malformed_attempts_still_reach_repository_without_plaintext(code):
    repository = AsyncMock(spec=IEmailCodeRepository)
    repository.consume.return_value = False
    crypto = EmailCodeCrypto(KEY)
    assert not await EmailCodeService(repository, crypto, AsyncMock()).consume(CONTEXT, code)
    repository.consume.assert_awaited_once()
    assert repository.consume.call_args.args[1] != crypto.digest(CONTEXT, '12345678')


async def test_issue_exposes_no_code_and_does_not_send_when_throttled():
    repository, sender = AsyncMock(spec=IEmailCodeRepository), AsyncMock(spec=IEmailSender)
    repository.reserve.return_value = CodeReservation(retry_after=60)
    result = await EmailCodeService(repository, EmailCodeCrypto(KEY), sender).issue(CONTEXT)
    assert not result.issued and result.retry_after == 60
    sender.send.assert_not_awaited()
    repository.activate.assert_not_awaited()


async def test_repeat_rng_sample_is_bounded_and_never_sends_duplicate_code():
    repository, sender = AsyncMock(spec=IEmailCodeRepository), AsyncMock(spec=IEmailSender)
    repository.reserve.return_value = CodeReservation(collision=True)
    with pytest.raises(EmailCodeUnavailable):
        await EmailCodeService(repository, EmailCodeCrypto(KEY), sender).issue(CONTEXT)
    assert repository.reserve.await_count == 16
    sender.send.assert_not_awaited()


async def test_uncertain_mail_failure_is_not_retried_or_activated():
    repository, sender = AsyncMock(spec=IEmailCodeRepository), AsyncMock(spec=IEmailSender)
    repository.reserve.return_value = CodeReservation(expires_at=datetime(2026, 10, 21, tzinfo=UTC))
    sender.send.side_effect = EmailDeliveryError(EmailFailure.TIMEOUT, delivery_unknown=True)
    with pytest.raises(EmailDeliveryError) as caught:
        await EmailCodeService(repository, EmailCodeCrypto(KEY), sender).issue(CONTEXT)
    assert caught.value.delivery_unknown and not caught.value.retryable
    repository.activate.assert_not_awaited()
    sender.send.assert_awaited_once()
