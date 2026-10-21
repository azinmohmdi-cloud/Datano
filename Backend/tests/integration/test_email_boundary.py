from unittest.mock import Mock

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.application.use_cases.auth.email import EmailDeliveryError, EmailFailure, OutboundEmail
from app.domain.error.exception_handlers import register_all_exception_handlers
from app.infra.core.config import Config
from app.infra.services.smtp_email_service import SMTPEmailSender
from app.main import create_app
from tests.unit.test_smtp_config import PRIVATE


def test_enabled_incomplete_smtp_fails_startup_before_database(monkeypatch):
    monkeypatch.setattr("app.main.Database.from_config", Mock(side_effect=AssertionError("must not open DB")))
    settings = Config(_env_file=None, SMTP_ENABLED=True, PUBLIC_ORIGIN="https://datano.test", CSRF_SECRET_KEY="x" * 32)
    with pytest.raises(EmailDeliveryError) as error:
        with TestClient(create_app(settings)):
            pass
    assert error.value.reason == EmailFailure.CONFIGURATION


def test_provider_secrets_and_message_code_never_reach_http_or_logs(monkeypatch, caplog):
    import smtplib
    smtp = Mock()
    smtp.login.side_effect = smtplib.SMTPAuthenticationError(535, b"private-smtp-password CODE=87654321")
    monkeypatch.setattr("smtplib.SMTP", Mock(return_value=smtp))
    sender = SMTPEmailSender(Config(_env_file=None, **PRIVATE))
    app = FastAPI()
    register_all_exception_handlers(app)

    # Test-only boundary; the production app has no send-mail/debug endpoint.
    @app.get("/boundary")
    async def boundary():
        await sender.send(OutboundEmail("recipient@example.test", "private subject", "87654321"))

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/boundary")
    assert response.status_code == 500 and response.json()["success"] is False
    for text in (response.text, caplog.text):
        assert "87654321" not in text and PRIVATE["SMTP_PASSWORD"] not in text
        assert PRIVATE["SMTP_USERNAME"] not in text
