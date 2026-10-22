"""Self-owned mailbox proof; replacing identity is a separate atomic operation."""
from dataclasses import dataclass, field
import logging
from typing import TYPE_CHECKING

from app.application.use_cases.auth.email_codes import EmailCodeContext, EmailCodePurpose, EmailCodeService
from app.application.use_cases.auth.interfaces import ISessionTokens
from app.application.use_cases.auth.session_models import IssuedSession, SessionPolicy, SessionRecord
from app.domain.entities import UserEntity
from app.domain.error.exceptions import CredentialsValidationException, ValidationException

if TYPE_CHECKING:
    from app.interface.repository.email_change_repository_interface import IEmailChangeRepository


@dataclass(frozen=True)
class EmailChangeActor:
    user_id: str = field(repr=False)
    email: str = field(repr=False)
    account_state: bytes = field(repr=False)
    session: SessionRecord = field(repr=False)


def email_change_target(value: str) -> str:
    target = EmailCodeContext(EmailCodePurpose.EMAIL_CHANGE, "email-validation", value).recipient
    try:
        UserEntity._validate_email(target)
    except ValidationException:
        raise ValueError("Invalid email address") from None
    return target


def email_change_context(actor: EmailChangeActor, email: str) -> EmailCodeContext:
    return EmailCodeContext(EmailCodePurpose.EMAIL_CHANGE,
        f"{actor.user_id}:{actor.account_state.hex()}", email_change_target(email))


def invalid_email_change() -> CredentialsValidationException:
    return CredentialsValidationException("Invalid or expired email change proof")


class EmailChangeService:
    def __init__(self, repository: "IEmailChangeRepository", codes: EmailCodeService,
                 tokens: ISessionTokens, sessions: SessionPolicy | None = None) -> None:
        self.repository, self.codes, self.tokens = repository, codes, tokens
        self.sessions = sessions or SessionPolicy()

    async def require_actor(self, token: str | None) -> EmailChangeActor:
        digest = self.tokens.digest(token)
        actor = None if digest is None else await self.repository.actor(digest)
        if actor is None:
            raise invalid_email_change()
        return actor

    async def dispatch(self, token: str | None, email: str) -> None:
        try:
            actor = await self.require_actor(token)
            context = email_change_context(actor, email)
            if context.recipient != actor.email and await self.repository.available(context.recipient):
                await self.codes.issue(context)
        except Exception as error:
            # Provider/driver strings and the message body may contain secrets.
            logging.warning("Email change dispatch failed (%s)", type(error).__name__)

    async def verify(self, token: str | None, email: str, code: str) -> IssuedSession:
        actor = await self.require_actor(token)
        context = email_change_context(actor, email)
        if context.recipient == actor.email or not await self.codes.consume(context, code):
            raise invalid_email_change()
        fresh = self.tokens.generate()
        digest = self.tokens.digest(fresh)
        if digest is None:
            raise ValueError("Session token generator returned an invalid identifier")
        idle, absolute = self.sessions.timeouts(actor.session.remember_me)
        record = await self.repository.replace_email(actor, context.recipient, digest,
            idle_seconds=idle, absolute_seconds=absolute)
        if record is None:
            raise invalid_email_change()
        return IssuedSession(fresh, record)
