from types import SimpleNamespace
from unittest.mock import AsyncMock, Mock

import pytest

from app.application.use_cases.auth.email import EmailDeliveryError, EmailFailure
from app.interface.dependencies.email_dependencies import get_email_sender
from scripts.send_test_email import main
from tests.unit.test_smtp_config import PRIVATE


def test_missing_email_sender_never_returns_fake_success():
    with pytest.raises(EmailDeliveryError, match="configuration"):
        get_email_sender(SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace())))
    sender = object()
    assert get_email_sender(SimpleNamespace(app=SimpleNamespace(state=SimpleNamespace(email_sender=sender)))) is sender


@pytest.fixture
def smtp_file(tmp_path):
    path = tmp_path / "test-only.env"
    path.write_text("\n".join(f"{key}={str(value).lower() if isinstance(value, bool) else value}" for key,value in PRIVATE.items()))
    return path


def test_smoke_defaults_to_offline_validation_without_sending(monkeypatch, smtp_file, capsys):
    smtp = Mock()
    monkeypatch.setattr("smtplib.SMTP", smtp)
    assert main(["--env-file", str(smtp_file)]) == 0
    smtp.assert_not_called()
    assert "no connection or message attempted" in capsys.readouterr().out


def test_smoke_requires_explicit_recipient_and_send_flag(monkeypatch, smtp_file):
    smtp = Mock()
    monkeypatch.setattr("smtplib.SMTP", smtp)
    with pytest.raises(SystemExit):
        main(["--env-file", str(smtp_file), "--send"])
    smtp.assert_not_called()


def test_controlled_smoke_submits_once_and_does_not_claim_inbox_delivery(monkeypatch, smtp_file, capsys):
    send = AsyncMock()
    monkeypatch.setattr("app.infra.services.smtp_email_service.SMTPEmailSender.send", send)
    assert main(["--env-file", str(smtp_file), "--to", "approved@example.test", "--send"]) == 0
    send.assert_awaited_once()
    assert send.call_args.args[0].recipient == "approved@example.test"
    assert "87654321" not in send.call_args.args[0].text
    output = capsys.readouterr().out
    assert "relay accepted one" in output and "confirmed separately" in output
    assert "approved@example.test" not in output and PRIVATE["SMTP_PASSWORD"] not in output


def test_smoke_reports_safe_failure_without_retry(monkeypatch, smtp_file, capsys):
    send = AsyncMock(side_effect=EmailDeliveryError(EmailFailure.CONNECTION, delivery_unknown=True))
    monkeypatch.setattr("app.infra.services.smtp_email_service.SMTPEmailSender.send", send)
    assert main(["--env-file", str(smtp_file), "--to", "approved@example.test", "--send"]) == 3
    assert "delivery_unknown=True" in capsys.readouterr().err
    send.assert_awaited_once()


def test_missing_or_invalid_smoke_settings_do_not_print_inputs(tmp_path, capsys):
    path = tmp_path / "missing.env"
    assert main(["--env-file", str(path)]) == 2
    path.write_text("SMTP_PORT=87654321-private-secret\nSMTP_PASSWORD=private-password\n")
    assert main(["--env-file", str(path)]) == 2
    output = capsys.readouterr()
    assert "87654321" not in output.err and "private-password" not in output.err


def test_configuration_import_failure_cannot_dump_private_exception(monkeypatch, smtp_file, capsys):
    import builtins
    original = builtins.__import__

    def fail_private_config(name, *args, **kwargs):
        if name == "app.infra.core.config":
            raise ValueError("private-password 87654321")
        return original(name, *args, **kwargs)

    monkeypatch.setattr(builtins, "__import__", fail_private_config)
    assert main(["--env-file", str(smtp_file)]) == 2
    text = capsys.readouterr().err
    assert "could not be loaded" in text and "87654321" not in text
