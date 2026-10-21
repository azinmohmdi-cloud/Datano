"""Loopback protocol fixtures, never an external SMTP provider or real mailbox."""

import base64
import ipaddress
import socketserver
import ssl
import threading
from contextlib import contextmanager
from datetime import UTC, datetime, timedelta
from email import policy
from email.parser import BytesParser

import pytest
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID

from app.application.use_cases.auth.email import EmailDeliveryError, EmailFailure, OutboundEmail
from app.infra.core.config import Config
from app.infra.services.smtp_email_service import SMTPEmailSender
from tests.unit.test_smtp_config import PRIVATE


@pytest.fixture
def certificate(tmp_path):
    # cryptography is already in the locked python-jose dependency set.
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, "localhost")])
    now = datetime.now(UTC)
    cert = (x509.CertificateBuilder().subject_name(name).issuer_name(name)
        .public_key(key.public_key()).serial_number(x509.random_serial_number())
        .not_valid_before(now - timedelta(minutes=1)).not_valid_after(now + timedelta(days=1))
        .add_extension(x509.BasicConstraints(ca=True, path_length=None), critical=True)
        .add_extension(x509.SubjectAlternativeName([x509.DNSName("localhost"), x509.IPAddress(ipaddress.ip_address("127.0.0.1"))]), critical=False)
        .sign(key, hashes.SHA256()))
    cert_file, key_file = tmp_path / "loopback-cert.pem", tmp_path / "loopback-key.pem"
    cert_file.write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    key_file.write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    key_file.chmod(0o600)
    context = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
    context.load_cert_chain(cert_file, key_file)
    return cert_file, context


@contextmanager
def smtp_peer(context, *, implicit=False, reject_auth=False, advertise_tls=True):
    received, commands, credentials = [], [], []

    class Handler(socketserver.StreamRequestHandler):
        def handle(self):
            encrypted = False
            self.connection.settimeout(5)

            def reply(text):
                self.wfile.write(text.encode("ascii") + b"\r\n"); self.wfile.flush()

            def upgrade():
                self.connection = context.wrap_socket(self.connection, server_side=True)
                self.rfile = self.connection.makefile("rb")
                self.wfile = self.connection.makefile("wb")

            try:
                if implicit:
                    upgrade(); encrypted = True
                reply("220 loopback test peer")
                while line := self.rfile.readline():
                    command, _, value = line.rstrip(b"\r\n").partition(b" ")
                    command = command.upper()
                    commands.append(command.decode("ascii"))
                    if command == b"EHLO":
                        reply("250-loopback")
                        if advertise_tls and not encrypted: reply("250-STARTTLS")
                        reply("250 AUTH PLAIN")
                    elif command == b"STARTTLS":
                        reply("220 Start TLS"); upgrade(); encrypted = True
                    elif command == b"AUTH":
                        assert encrypted, "AUTH must never precede verified TLS"
                        credentials.append(base64.b64decode(value.split(b" ", 1)[1]))
                        reply("535 Rejected" if reject_auth else "235 Authenticated")
                    elif command in {b"MAIL", b"RCPT", b"RSET"}: reply("250 OK")
                    elif command == b"DATA":
                        reply("354 Send data")
                        data = []
                        while (part := self.rfile.readline()) != b".\r\n":
                            if not part: return
                            data.append(part[1:] if part.startswith(b"..") else part)
                        received.append(b"".join(data)); reply("250 Accepted")
                    elif command == b"QUIT":
                        reply("221 Bye"); return
                    else: reply("502 Unsupported")
            except (ssl.SSLError, ConnectionError):
                # Expected when the client refuses this test-only certificate.
                pass

    class Server(socketserver.ThreadingTCPServer):
        allow_reuse_address = True
        daemon_threads = True

    with Server(("127.0.0.1", 0), Handler) as server:
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            yield server.server_address[1], received, commands, credentials
        finally:
            server.shutdown(); worker.join(timeout=5)


@pytest.mark.parametrize("security", ["starttls", "tls"])
async def test_real_loopback_tls_smtp_roundtrip_preserves_persian_without_logging(certificate, caplog, capsys, security):
    cert_file, context = certificate
    with smtp_peer(context, implicit=security == "tls") as (port, received, commands, credentials):
        sender = SMTPEmailSender(Config(_env_file=None, **{**PRIVATE, "SMTP_HOST": "127.0.0.1", "SMTP_PORT": port,
            "SMTP_SECURITY": security, "SMTP_CA_FILE": str(cert_file)}))
        await sender.send(OutboundEmail("recipient@example.test", "پیام خصوصی دیتانو", ".خط نخست\nکد آزمایشی 87654321"))
    assert len(received) == 1
    message = BytesParser(policy=policy.default).parsebytes(received[0])
    assert str(message["Subject"]) == "پیام خصوصی دیتانو"
    assert message.get_content().replace("\r\n", "\n").strip() == ".خط نخست\nکد آزمایشی 87654321"
    assert credentials == [b"\0private-smtp-user\0private-smtp-password"]
    if security == "starttls": assert commands.index("STARTTLS") < commands.index("AUTH") < commands.index("DATA")
    assert "87654321" not in caplog.text and PRIVATE["SMTP_PASSWORD"] not in caplog.text
    output = capsys.readouterr()
    assert "87654321" not in output.err + output.out


@pytest.mark.parametrize("scenario", ["untrusted_certificate", "auth_rejected", "missing_starttls"])
async def test_wire_failures_never_send_message_or_fall_back_to_plaintext(certificate, scenario):
    cert_file, context = certificate
    with smtp_peer(context, reject_auth=scenario == "auth_rejected", advertise_tls=scenario != "missing_starttls") as (port, received, commands, _):
        sender = SMTPEmailSender(Config(_env_file=None, **{**PRIVATE, "SMTP_HOST": "127.0.0.1", "SMTP_PORT": port,
            "SMTP_CA_FILE": str(cert_file) if scenario != "untrusted_certificate" else None}))
        with pytest.raises(EmailDeliveryError) as error:
            await sender.send(OutboundEmail("recipient@example.test", "subject", "87654321"))
    assert received == [] and "DATA" not in commands
    assert error.value.reason == (EmailFailure.AUTHENTICATION if scenario == "auth_rejected" else EmailFailure.TLS)
    if scenario != "auth_rejected": assert "AUTH" not in commands
