"""Mailbox proof upgrades an existing account, never public address text alone."""
from dataclasses import dataclass, field
import logging

from app.application.use_cases.auth.admin_policy import AdminEmailPolicy
from app.application.use_cases.auth.email_codes import EmailCodeContext, EmailCodePurpose, EmailCodeService
from app.application.use_cases.auth.interfaces import ISessionTokens
from app.application.use_cases.auth.session_models import IssuedSession, SessionPolicy, SessionRecord
from app.domain.error.exceptions import CredentialsValidationException
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.interface.repository.admin_proof_repository_interface import IAdminProofRepository


@dataclass(frozen=True)
class AdminActor:
    user_id: str = field(repr=False)
    email: str = field(repr=False)
    account_state: bytes = field(repr=False)
    session: SessionRecord = field(repr=False)


def admin_email_context(actor: AdminActor) -> EmailCodeContext:
    # A single scope per account/mailbox/credential state shares cooldown and
    # attempt limits across all its browsers. Another account cannot redeem it.
    return EmailCodeContext(EmailCodePurpose.ADMIN_EMAIL,
        f"{actor.user_id}:{actor.account_state.hex()}", actor.email)


def invalid_admin_proof() -> CredentialsValidationException:
    return CredentialsValidationException("Invalid or expired administrator email proof")


class AdminEmailService:
    def __init__(self, repository: "IAdminProofRepository", codes: EmailCodeService,
                 tokens: ISessionTokens, eligibility: AdminEmailPolicy,
                 sessions: SessionPolicy | None = None) -> None:
        self.repository, self.codes, self.tokens, self.eligibility = repository, codes, tokens, eligibility
        self.sessions = sessions or SessionPolicy()

    async def require_actor(self, token: str | None) -> AdminActor:
        digest = self.tokens.digest(token)
        actor = None if digest is None else await self.repository.actor(digest)
        if actor is None:
            raise invalid_admin_proof()
        return actor

    async def dispatch(self, token: str | None) -> None:
        try:
            actor = await self.require_actor(token)
            if self.eligibility.allows(actor.email):
                await self.codes.issue(admin_email_context(actor))
        except Exception as error:
            logging.warning("Administrator email dispatch failed (%s)", type(error).__name__)

    async def verify(self, token: str | None, code: str) -> IssuedSession:
        actor = await self.require_actor(token)
        if not self.eligibility.allows(actor.email) or not await self.codes.consume(admin_email_context(actor), code):
            raise invalid_admin_proof()
        fresh = self.tokens.generate()
        digest = self.tokens.digest(fresh)
        if digest is None:
            raise ValueError("Session token generator returned an invalid identifier")
        idle, absolute = self.sessions.timeouts(actor.session.remember_me)
        record = await self.repository.promote(actor, digest, idle_seconds=idle, absolute_seconds=absolute)
        if record is None:
            raise invalid_admin_proof()
        return IssuedSession(fresh, record)
