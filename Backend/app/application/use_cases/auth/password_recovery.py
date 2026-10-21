"""Recovery proves mailbox ownership; it never authenticates a product session."""
from dataclasses import dataclass, field
from datetime import datetime
import asyncio
import logging
from typing import TYPE_CHECKING

from app.application.use_cases.auth.email_codes import EmailCodeContext, EmailCodePurpose, EmailCodeService
from app.application.use_cases.auth.interfaces import IPasswordService
from app.domain.entities import UserEntity
from app.domain.error.exceptions import CredentialsValidationException, ValidationException

if TYPE_CHECKING:
    from app.interface.repository.recovery_repository_interface import IRecoveryRepository


@dataclass(frozen=True)
class RecoveryAccount:
    user_id: str = field(repr=False)
    email: str = field(repr=False)
    state: bytes = field(repr=False)


@dataclass(frozen=True)
class RecoveryGrant:
    token: str = field(repr=False)
    expires_at: datetime


class IRecoveryTokens:
    def generate(self) -> str:
        raise NotImplementedError

    def digest(self, token: str | None) -> bytes | None:
        raise NotImplementedError


def recovery_context(account: RecoveryAccount | None, email: str) -> EmailCodeContext:
    # Password/email changes invalidate outstanding codes without storing their
    # plaintext or deleting another workflow's challenge rows.
    subject = f"{account.user_id}:{account.state.hex()}" if account else "unregistered"
    return EmailCodeContext(EmailCodePurpose.PASSWORD_RECOVERY, subject, email)


def invalid_recovery() -> CredentialsValidationException:
    return CredentialsValidationException("Invalid or expired password recovery authorization")


class PasswordRecoveryService:
    def __init__(self, repository: "IRecoveryRepository", codes: EmailCodeService,
                 tokens: IRecoveryTokens, *, grant_seconds: int = 600) -> None:
        if type(grant_seconds) is not int or not 1 <= grant_seconds <= 600:
            raise ValueError("Recovery grant lifetime must be between 1 and 600 seconds")
        self.repository, self.codes, self.tokens = repository, codes, tokens
        self.grant_seconds = grant_seconds

    async def dispatch(self, email: str) -> None:
        # Invoked only after the generic response body was sent. There is no
        # account lookup, SMTP wait or account-specific response before that.
        try:
            account = await self.repository.account(email)
            if account is not None:
                await self.codes.issue(recovery_context(account, account.email))
        except Exception as error:
            # Background failures remain observable without provider text/body,
            # credentials, email addresses, codes or account-existence responses.
            logging.warning("Password recovery dispatch failed (%s)", type(error).__name__)

    async def verify(self, email: str, code: str) -> RecoveryGrant:
        account = await self.repository.account(email)
        valid = await self.codes.consume(recovery_context(account, email), code)
        if account is None or not valid:
            raise invalid_recovery()
        token = self.tokens.generate()
        expires = await self.repository.grant(account, self.tokens.digest(token), seconds=self.grant_seconds)
        if expires is None:
            raise invalid_recovery()
        return RecoveryGrant(token, expires)


class ResetPasswordService:
    def __init__(self, repository: "IRecoveryRepository", tokens: IRecoveryTokens, passwords: IPasswordService) -> None:
        self.repository, self.tokens, self.passwords = repository, tokens, passwords

    async def execute(self, token: str | None, password: str, confirmation: str) -> None:
        digest = self.tokens.digest(token)
        if digest is None or not await self.repository.valid(digest):
            raise invalid_recovery()
        if password != confirmation:
            raise ValidationException("Password confirmation does not match", field="password_confirmation")
        UserEntity._validate_password(password)
        replacement = await asyncio.to_thread(self.passwords.hash, password)
        if not await self.repository.reset(digest, replacement):
            raise invalid_recovery()
