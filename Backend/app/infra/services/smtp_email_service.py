"""TLS SMTP adapter. No debug output, plaintext fallback, or implicit retry."""

import asyncio
import ipaddress
import re
import smtplib
import ssl
from datetime import UTC, datetime
from email.headerregistry import Address
from email.message import EmailMessage
from email.policy import SMTP
from email.utils import format_datetime, make_msgid

from app.application.use_cases.auth.email import EmailDeliveryError, EmailFailure, IEmailSender, OutboundEmail
from app.infra.core.config import Config


def mailbox(value: str) -> Address:
    """One explicit mailbox; callers cannot inject headers or extra recipients."""
    if not value or any(ord(char) < 32 or ord(char) == 127 for char in value):
        raise ValueError("Invalid mailbox")
    address = Address(addr_spec=value)
    if not address.username or not address.domain:
        raise ValueError("Invalid mailbox")
    return address


class SMTPEmailSender(IEmailSender):
    def __init__(self, settings: Config) -> None:
        valid = settings.smtp_enabled
        required = (settings.smtp_host, settings.smtp_username, settings.smtp_password, settings.smtp_from_email)
        valid = valid and all(value is not None and value.get_secret_value() for value in required)
        if not valid:
            raise EmailDeliveryError(EmailFailure.CONFIGURATION)
        # Required values narrowed above. Config retains SecretStr, not plaintext copies.
        self._settings = settings
        failed = False
        try:
            host = settings.smtp_host.get_secret_value()
            try:
                ipaddress.ip_address(host)
            except ValueError:
                if not re.fullmatch(r"[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?", host):
                    raise ValueError("Invalid SMTP host") from None
            if not settings.smtp_username.get_secret_value().isascii() or not settings.smtp_password.get_secret_value().isascii():
                raise ValueError("SMTP AUTH requires ASCII credentials")
            if any(char in settings.smtp_username.get_secret_value() for char in "\r\n\x00"):
                raise ValueError("Invalid SMTP username")
            self._sender = mailbox(settings.smtp_from_email.get_secret_value()).addr_spec
            self._context = ssl.create_default_context(cafile=settings.smtp_ca_file)
            self._context.minimum_version = ssl.TLSVersion.TLSv1_2
        except (ValueError, OSError):
            failed = True
        if failed:
            # Raise outside except: provider/config exception context is not retained.
            raise EmailDeliveryError(EmailFailure.CONFIGURATION)

    async def send(self, message: OutboundEmail) -> None:
        invalid = False
        try:
            recipient = mailbox(message.recipient)
            if not message.subject or any(ord(char) < 32 or ord(char) == 127 for char in message.subject):
                raise ValueError("Invalid subject")
            mail = EmailMessage(policy=SMTP)
            mail["From"] = Address(display_name="دیتانو", addr_spec=self._sender)
            mail["To"] = recipient
            mail["Subject"] = message.subject
            mail["Date"] = format_datetime(datetime.now(UTC))
            mail["Message-ID"] = make_msgid(domain=mailbox(self._sender).domain)
            # Seven-bit transport works for Persian text even without 8BITMIME.
            mail.set_content(message.text, charset="utf-8", cte="quoted-printable")
        except (ValueError, TypeError, UnicodeError):
            invalid = True
        if invalid:
            raise EmailDeliveryError(EmailFailure.INVALID_MESSAGE)
        # SMTP is synchronous; never block FastAPI's event loop with socket I/O.
        await asyncio.to_thread(self._send, mail, recipient.addr_spec)

    def _send(self, mail: EmailMessage, recipient: str) -> None:
        settings = self._settings
        client = None
        failure: EmailDeliveryError | None = None
        stage = "connect"
        try:
            options = dict(host=settings.smtp_host.get_secret_value(), port=settings.smtp_port,
                timeout=settings.smtp_timeout_seconds)
            if settings.smtp_security == "tls":
                client = smtplib.SMTP_SSL(**options, context=self._context)
            else:
                client = smtplib.SMTP(**options)
                stage = "tls"
                client.ehlo()
                client.starttls(context=self._context)
                client.ehlo()
            stage = "authentication"
            client.login(settings.smtp_username.get_secret_value(), settings.smtp_password.get_secret_value())
            stage = "send"
            refused = client.send_message(mail, from_addr=self._sender, to_addrs=[recipient])
            if refused:
                failure = EmailDeliveryError(EmailFailure.RECIPIENT_REJECTED)
        except ssl.SSLError:
            failure = EmailDeliveryError(EmailFailure.TLS)
        except smtplib.SMTPAuthenticationError:
            failure = EmailDeliveryError(EmailFailure.AUTHENTICATION)
        except smtplib.SMTPRecipientsRefused as error:
            failure = EmailDeliveryError(EmailFailure.RECIPIENT_REJECTED,
                retryable=bool(error.recipients) and all(400 <= value[0] < 500 for value in error.recipients.values()))
        except smtplib.SMTPSenderRefused as error:
            failure = EmailDeliveryError(EmailFailure.SENDER_REJECTED, retryable=400 <= error.smtp_code < 500)
        except smtplib.SMTPDataError as error:
            failure = EmailDeliveryError(EmailFailure.MESSAGE_REJECTED, retryable=400 <= error.smtp_code < 500)
        except smtplib.SMTPNotSupportedError:
            failure = EmailDeliveryError(EmailFailure.TLS if stage == "tls" else EmailFailure.PROTOCOL)
        except TimeoutError:
            failure = EmailDeliveryError(EmailFailure.TIMEOUT, retryable=True, delivery_unknown=stage == "send")
        except smtplib.SMTPServerDisconnected:
            failure = EmailDeliveryError(EmailFailure.CONNECTION, retryable=True, delivery_unknown=stage == "send")
        except smtplib.SMTPResponseException as error:
            failure = EmailDeliveryError(EmailFailure.PROTOCOL, retryable=400 <= error.smtp_code < 500)
        except smtplib.SMTPException:
            failure = EmailDeliveryError(EmailFailure.PROTOCOL, delivery_unknown=stage == "send")
        except (ValueError, UnicodeError):
            failure = EmailDeliveryError(EmailFailure.INVALID_MESSAGE)
        except OSError:
            failure = EmailDeliveryError(EmailFailure.CONNECTION, retryable=True, delivery_unknown=stage == "send")
        finally:
            if client is not None:
                # DATA acceptance is final even when QUIT fails; no duplicate retry.
                try:
                    client.quit()
                except OSError:
                    pass
                finally:
                    try:
                        client.close()
                    except OSError:
                        pass
        if failure is not None:
            raise failure
