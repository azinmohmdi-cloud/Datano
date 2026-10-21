import ssl
import smtplib
import traceback
from email.message import EmailMessage
from email.utils import parsedate_to_datetime
from unittest.mock import Mock

import pytest

from app.application.use_cases.auth.email import EmailDeliveryError, EmailFailure, OutboundEmail
from app.infra.core.config import Config
from app.infra.services.smtp_email_service import SMTPEmailSender
from tests.unit.test_smtp_config import PRIVATE


@pytest.mark.parametrize("security,port", [("starttls", 587), ("tls", 465)])
async def test_authenticated_tls_delivery_uses_explicit_envelope_and_unicode_message(monkeypatch, security, port):
    smtp = Mock()
    smtp.send_message.return_value = {}
    factory = Mock(return_value=smtp)
    monkeypatch.setattr("smtplib.SMTP" if security == "starttls" else "smtplib.SMTP_SSL", factory)
    sender = SMTPEmailSender(Config(_env_file=None, **{**PRIVATE, "SMTP_SECURITY": security, "SMTP_PORT": port}))
    await sender.send(OutboundEmail("recipient@example.test", "پیام دیتانو", "کد محرمانه: ۰۱۲۳۴۵۶۷"))
    kwargs = factory.call_args.kwargs
    assert kwargs["host"] == PRIVATE["SMTP_HOST"] and kwargs["port"] == port
    assert kwargs["timeout"] == 10
    context = smtp.starttls.call_args.kwargs["context"] if security == "starttls" else kwargs["context"]
    assert context.check_hostname and context.verify_mode == ssl.CERT_REQUIRED
    smtp.login.assert_called_once_with(PRIVATE["SMTP_USERNAME"], PRIVATE["SMTP_PASSWORD"])
    delivered = smtp.send_message.call_args.args[0]
    assert isinstance(delivered, EmailMessage)
    assert str(delivered["Subject"]) == "پیام دیتانو"
    assert delivered.get_content().strip() == "کد محرمانه: ۰۱۲۳۴۵۶۷"
    assert smtp.send_message.call_args.kwargs == {"from_addr": PRIVATE["SMTP_FROM_EMAIL"], "to_addrs": ["recipient@example.test"]}
    assert "Bcc" not in delivered and "Cc" not in delivered
    assert parsedate_to_datetime(delivered["Date"]).utcoffset().total_seconds() == 0
    assert delivered["Message-ID"].endswith("@example.test>")
    assert smtp.login.call_count == smtp.send_message.call_count == 1
    smtp.close.assert_called_once()


@pytest.mark.parametrize("stage,error,reason,retryable,unknown", [
    ("connect", TimeoutError("secret: 87654321"), EmailFailure.TIMEOUT, True, False),
    ("connect", OSError("secret: 87654321"), EmailFailure.CONNECTION, True, False),
    ("starttls", ssl.SSLCertVerificationError("secret: 87654321"), EmailFailure.TLS, False, False),
    ("starttls", smtplib.SMTPNotSupportedError("secret: 87654321"), EmailFailure.TLS, False, False),
    ("login", smtplib.SMTPAuthenticationError(535, b"secret: 87654321"), EmailFailure.AUTHENTICATION, False, False),
    ("send_message", smtplib.SMTPRecipientsRefused({"private@example.test": (450, b"secret: 87654321")}), EmailFailure.RECIPIENT_REJECTED, True, False),
    ("send_message", smtplib.SMTPSenderRefused(550, b"secret: 87654321", "private@example.test"), EmailFailure.SENDER_REJECTED, False, False),
    ("send_message", smtplib.SMTPDataError(451, b"secret: 87654321"), EmailFailure.MESSAGE_REJECTED, True, False),
    ("send_message", TimeoutError("secret: 87654321"), EmailFailure.TIMEOUT, False, True),
    ("send_message", smtplib.SMTPServerDisconnected("secret: 87654321"), EmailFailure.CONNECTION, False, True),
    ("send_message", smtplib.SMTPException("secret: 87654321"), EmailFailure.PROTOCOL, False, True),
    ("send_message", smtplib.SMTPNotSupportedError("secret: 87654321"), EmailFailure.PROTOCOL, False, False),
    ("login", smtplib.SMTPHeloError(421, b"secret: 87654321"), EmailFailure.PROTOCOL, True, False),
    ("send_message", ValueError("secret: 87654321"), EmailFailure.INVALID_MESSAGE, False, False),
])
async def test_safe_failures_are_distinguishable_and_never_automatically_retried(monkeypatch, caplog, stage, error, reason, retryable, unknown):
    smtp = Mock()
    smtp.send_message.return_value = {}
    factory = Mock(side_effect=error) if stage == "connect" else Mock(return_value=smtp)
    if stage != "connect": getattr(smtp, stage).side_effect = error
    monkeypatch.setattr("smtplib.SMTP", factory)
    sender = SMTPEmailSender(Config(_env_file=None, **PRIVATE))
    message = OutboundEmail("recipient@example.test", "private subject", "secret: 87654321")
    with pytest.raises(EmailDeliveryError) as caught:
        await sender.send(message)
    safe = caught.value
    assert safe.reason == reason and safe.retryable is retryable and safe.delivery_unknown is unknown
    assert safe.__context__ is None and safe.__cause__ is None
    assert "secret" not in str(safe) and "87654321" not in repr(message)
    assert "87654321" not in "".join(traceback.format_exception(safe))
    assert "87654321" not in caplog.text and PRIVATE["SMTP_PASSWORD"] not in caplog.text
    factory.assert_called_once()
    if stage != "connect": smtp.close.assert_called_once()


@pytest.mark.parametrize("recipient,subject,text", [
    ("x@example.test\r\nBcc: extra@example.test", "safe", "87654321"),
    ("x@example.test,extra@example.test", "safe", "87654321"),
    ("not an address", "safe", "87654321"),
    ("missing-domain", "safe", "87654321"),
    ("recipient@example.test", "subject\n87654321", "87654321"),
    ("recipient@example.test", "safe", "\ud80087654321"),
])
async def test_malformed_message_never_opens_smtp_or_echoes_input(monkeypatch, recipient, subject, text):
    factory = Mock()
    monkeypatch.setattr("smtplib.SMTP", factory)
    sender = SMTPEmailSender(Config(_env_file=None, **PRIVATE))
    with pytest.raises(EmailDeliveryError) as error:
        await sender.send(OutboundEmail(recipient, subject, text))
    assert error.value.reason == EmailFailure.INVALID_MESSAGE
    assert "87654321" not in str(error.value)
    factory.assert_not_called()


async def test_quit_or_close_error_after_acceptance_does_not_turn_success_into_retry(monkeypatch):
    smtp = Mock()
    smtp.send_message.return_value = {}
    smtp.quit.side_effect = smtplib.SMTPServerDisconnected("87654321")
    smtp.close.side_effect = OSError("87654321")
    monkeypatch.setattr("smtplib.SMTP", Mock(return_value=smtp))
    await SMTPEmailSender(Config(_env_file=None, **PRIVATE)).send(OutboundEmail("recipient@example.test", "subject", "87654321"))
    smtp.send_message.assert_called_once()


async def test_refused_result_is_not_reported_as_success(monkeypatch):
    smtp = Mock()
    smtp.send_message.return_value = {"recipient@example.test": (550, b"87654321")}
    monkeypatch.setattr("smtplib.SMTP", Mock(return_value=smtp))
    with pytest.raises(EmailDeliveryError, match="recipient_rejected"):
        await SMTPEmailSender(Config(_env_file=None, **PRIVATE)).send(OutboundEmail("recipient@example.test", "subject", "87654321"))
