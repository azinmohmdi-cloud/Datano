import pytest
from pydantic import ValidationError

from app.infra.core.config import Config
from app.application.use_cases.auth.email import EmailDeliveryError, EmailFailure
from app.infra.services.smtp_email_service import SMTPEmailSender


PRIVATE = {
    "SMTP_ENABLED": True, "SMTP_HOST": "smtp.private.example.test", "SMTP_PORT": 587,
    "SMTP_SECURITY": "starttls", "SMTP_USERNAME": "private-smtp-user",
    "SMTP_PASSWORD": "private-smtp-password", "SMTP_FROM_EMAIL": "sender@example.test",
}


def test_private_smtp_settings_are_available_and_redacted():
    settings = Config(_env_file=None, **PRIVATE)
    assert settings.smtp_enabled is True
    assert settings.smtp_password.get_secret_value() == PRIVATE["SMTP_PASSWORD"]
    for output in (str(settings), repr(settings), settings.model_dump_json()):
        assert PRIVATE["SMTP_PASSWORD"] not in output
        assert PRIVATE["SMTP_USERNAME"] not in output


def test_invalid_smtp_setting_diagnostics_hide_supplied_values():
    with pytest.raises(ValidationError) as error:
        Config(_env_file=None, **{**PRIVATE, "SMTP_PORT": PRIVATE["SMTP_PASSWORD"]})
    assert PRIVATE["SMTP_PASSWORD"] not in str(error.value)


@pytest.mark.parametrize("key", ["SMTP_HOST", "SMTP_USERNAME", "SMTP_PASSWORD", "SMTP_FROM_EMAIL"])
def test_enabled_adapter_requires_every_private_setting(key):
    with pytest.raises(EmailDeliveryError) as error:
        SMTPEmailSender(Config(_env_file=None, **{**PRIVATE, key: None}))
    assert error.value.reason == EmailFailure.CONFIGURATION


@pytest.mark.parametrize("changes", [
    {"SMTP_ENABLED": False}, {"SMTP_HOST": "smtp://private.example.test"},
    {"SMTP_HOST": "private.example.test:587"}, {"SMTP_HOST": "private\n87654321"},
    {"SMTP_FROM_EMAIL": "sender@example.test\r\nBcc: extra@example.test"},
    {"SMTP_FROM_EMAIL": "not an address"}, {"SMTP_USERNAME": "private\n87654321"},
    {"SMTP_USERNAME": "کاربر"}, {"SMTP_PASSWORD": "رمز خصوصی"},
    {"SMTP_CA_FILE": "/nonexistent/private-87654321.pem"},
])
def test_invalid_private_adapter_settings_fail_safely(changes):
    with pytest.raises(EmailDeliveryError) as error:
        SMTPEmailSender(Config(_env_file=None, **{**PRIVATE, **changes}))
    assert error.value.reason == EmailFailure.CONFIGURATION
    assert "87654321" not in str(error.value) and error.value.__context__ is None


@pytest.mark.parametrize("changes", [
    {"SMTP_PORT": 0}, {"SMTP_PORT": 65536}, {"SMTP_SECURITY": "plain"},
    {"SMTP_TIMEOUT_SECONDS": 0}, {"SMTP_TIMEOUT_SECONDS": float("nan")},
])
def test_insecure_modes_or_unbounded_socket_settings_are_rejected(changes):
    with pytest.raises(ValidationError):
        Config(_env_file=None, **{**PRIVATE, **changes})
