"""Outbound mail port; challenge generation and account flows belong to later tasks."""

from dataclasses import dataclass, field
from enum import StrEnum


@dataclass(frozen=True)
class OutboundEmail:
    recipient: str = field(repr=False)
    subject: str = field(repr=False)
    text: str = field(repr=False)


class EmailFailure(StrEnum):
    CONFIGURATION = "configuration"
    INVALID_MESSAGE = "invalid_message"
    TLS = "tls"
    AUTHENTICATION = "authentication"
    RECIPIENT_REJECTED = "recipient_rejected"
    SENDER_REJECTED = "sender_rejected"
    MESSAGE_REJECTED = "message_rejected"
    TIMEOUT = "timeout"
    CONNECTION = "connection"
    PROTOCOL = "protocol"


class EmailDeliveryError(Exception):
    """Safe diagnostics only; never retain provider responses, message or credentials."""

    def __init__(self, reason: EmailFailure, *, retryable: bool = False, delivery_unknown: bool = False):
        super().__init__(f"Email delivery failed: {reason.value}")
        self.reason = reason
        self.delivery_unknown = delivery_unknown
        self.retryable = retryable and not delivery_unknown


class IEmailSender:
    async def send(self, message: OutboundEmail) -> None:
        """Return only after the relay accepts DATA; not proof of inbox delivery."""
        raise NotImplementedError
