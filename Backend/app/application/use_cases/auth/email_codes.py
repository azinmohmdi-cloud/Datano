"""Shared email proof only; account authorization and HTTP flows live elsewhere."""
from dataclasses import dataclass, field
from datetime import datetime
from email.headerregistry import Address
from enum import StrEnum
from typing import TYPE_CHECKING
from uuid import uuid4

from app.application.use_cases.auth.email import IEmailSender, OutboundEmail
from app.domain.identity import canonical_email

if TYPE_CHECKING:
    from app.interface.repository.email_code_repository_interface import IEmailCodeRepository


CODE_TTL_SECONDS = 600
CODE_MAX_ATTEMPTS = 5
CODE_RESEND_SECONDS = 60


class EmailCodePurpose(StrEnum):
    PASSWORD_RECOVERY = "password_recovery"
    ADMIN_EMAIL = "admin_email"
    EMAIL_CHANGE = "email_change"


@dataclass(frozen=True)
class EmailCodeContext:
    purpose: EmailCodePurpose
    subject: str = field(repr=False)
    recipient: str = field(repr=False)

    def __post_init__(self) -> None:
        invalid = not isinstance(self.purpose, EmailCodePurpose)
        invalid = invalid or not isinstance(self.subject, str) or not self.subject.strip()
        invalid = invalid or not isinstance(self.recipient, str)
        if invalid:
            raise ValueError("Invalid email code context")
        recipient = canonical_email(self.recipient)
        invalid = any(ord(char) < 32 or ord(char) == 127 for char in self.subject + recipient)
        try:
            (self.subject + recipient).encode("utf-8")
            address = Address(addr_spec=recipient)
            invalid = invalid or not address.username or not address.domain
        except ValueError:
            invalid = True
        if invalid:
            raise ValueError("Invalid email code context")
        object.__setattr__(self, "recipient", recipient)


@dataclass(frozen=True)
class CodeReservation:
    expires_at: datetime | None = None
    retry_after: int = 0
    collision: bool = False


@dataclass(frozen=True)
class EmailCodeIssue:
    issued: bool
    retry_after: int = 0


class EmailCodeUnavailable(Exception):
    def __init__(self) -> None:
        super().__init__("Email code service is unavailable")


class IEmailCodeCrypto:
    def generate(self) -> str:
        raise NotImplementedError

    def scope(self, context: EmailCodeContext) -> bytes:
        raise NotImplementedError

    def digest(self, context: EmailCodeContext, code: str) -> bytes:
        raise NotImplementedError


class EmailCodeService:
    def __init__(self, repository: "IEmailCodeRepository", codes: IEmailCodeCrypto, sender: IEmailSender) -> None:
        self._repository, self._codes, self._sender = repository, codes, sender

    async def issue(self, context: EmailCodeContext) -> EmailCodeIssue:
        scope = self._codes.scope(context)
        # Avoid reissuing the immediately previous numeric code, even with a
        # repeated RNG sample. Bounded retries are local generation only, never mail.
        for _ in range(16):
            code = self._codes.generate()
            digest = self._codes.digest(context, code)
            generation = uuid4().hex
            reservation = await self._repository.reserve(scope, digest, generation)
            if reservation.collision:
                continue
            if reservation.expires_at is None:
                return EmailCodeIssue(False, reservation.retry_after)
            # The reservation committed and invalidated the old code before I/O.
            # Pending codes are unusable on failure, timeout, cancellation or crash.
            await self._sender.send(OutboundEmail(context.recipient, "کد تأیید ایمیل دیتانو",
                f"کد تأیید شما: {code}\nاین کد تا ۱۰ دقیقه معتبر و فقط یک‌بار قابل استفاده است."))
            activated = await self._repository.activate(scope, generation)
            return EmailCodeIssue(activated)
        raise EmailCodeUnavailable()

    async def consume(self, context: EmailCodeContext, code: str) -> bool:
        return await self._repository.consume(self._codes.scope(context), self._codes.digest(context, code))
