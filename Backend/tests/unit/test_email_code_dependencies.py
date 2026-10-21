from types import SimpleNamespace
from unittest.mock import Mock

import pytest

from app.application.use_cases.auth.email_codes import EmailCodeUnavailable
from app.infra.core.config import Config
from app.interface.dependencies.email_code_dependencies import get_email_code_service


def test_private_hmac_configuration_is_optional_but_redacted_when_provisioned():
    settings = Config(_env_file=None, EMAIL_CODE_HMAC_KEY="test-only-private-email-code-key-0001")
    assert settings.email_code_hmac_key.get_secret_value() == "test-only-private-email-code-key-0001"
    assert "test-only-private-email-code-key-0001" not in repr(settings) + settings.model_dump_json()


def test_missing_key_fails_closed_without_creating_an_implicit_secret():
    request = SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(settings=Config(_env_file=None))))
    with pytest.raises(EmailCodeUnavailable) as caught:
        get_email_code_service(request)
    assert caught.value.__context__ is None


def test_dependency_wires_existing_database_and_mail_sender_without_sending():
    sender = Mock()
    state = SimpleNamespace(settings=Config(_env_file=None, EMAIL_CODE_HMAC_KEY="test-only-private-email-code-key-0001"), database=Mock(), email_sender=sender)
    service = get_email_code_service(SimpleNamespace(app=SimpleNamespace(state=state)))
    assert service._repository._database is state.database
    assert service._sender is sender
    sender.send.assert_not_called()


@pytest.mark.parametrize('key', ['', 'short', '\ud800' * 32])
def test_bad_private_key_has_safe_configuration_failure(key):
    state = SimpleNamespace(settings=Config(_env_file=None, EMAIL_CODE_HMAC_KEY=key))
    with pytest.raises(EmailCodeUnavailable) as caught:
        get_email_code_service(SimpleNamespace(app=SimpleNamespace(state=state)))
    assert caught.value.__context__ is None
