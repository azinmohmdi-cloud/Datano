from collections.abc import Awaitable, Callable
from datetime import datetime
from functools import wraps
import hmac
from typing import ParamSpec, TypeVar

from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.website.proof import IWebsiteProofRepository, WebsiteProofSnapshot
from app.domain.entities import WebsiteEntity
from app.domain.error.exceptions import CredentialsValidationException, ResourceNotFoundException, ServiceUnavailableException, WebsiteChallengeException
from app.infra.database.connection import Database
from app.infra.database.models import UserRow, WebsiteRow
from app.infra.repositories.postgres.session_repository import SQLSessionRepository
from app.infra.repositories.postgres.website_repository import SQLWebsiteRepository, lock_website_hostname, website_entity

P = ParamSpec("P")
T = TypeVar("T")


def safe_proof_storage(operation: Callable[P, Awaitable[T]]) -> Callable[P, Awaitable[T]]:
    @wraps(operation)
    async def wrapped(*args: P.args, **kwargs: P.kwargs) -> T:
        try:
            return await operation(*args, **kwargs)
        except SQLAlchemyError:
            pass
        raise ServiceUnavailableException("Website ownership is temporarily unavailable")
    return wrapped


class SQLWebsiteProofRepository(IWebsiteProofRepository):
    def __init__(self, database: Database, *, clock: Callable[[], datetime] | None = None) -> None:
        self.database, self.clock = database, clock

    async def _now(self, session: AsyncSession) -> datetime:
        return self.clock() if self.clock is not None else await session.scalar(select(func.clock_timestamp()))

    async def _owner(self, session: AsyncSession, digest: bytes, *, touch: bool = False) -> str:
        # Session repository consistently locks account, then session. Final writes
        # therefore serialize with logout, password reset and account deactivation.
        record = await SQLSessionRepository(session, clock=self.clock).resolve(digest, touch=touch)
        if record is None: raise CredentialsValidationException()
        user = await session.scalar(select(UserRow).where(UserRow.id == record.user_id)
            .execution_options(populate_existing=True))
        if user is None or not user.is_active: raise CredentialsValidationException()
        return user.id

    @safe_proof_storage
    async def snapshot(self, session_digest: bytes, website_id: str) -> WebsiteProofSnapshot:
        async with self.database.transaction() as session:
            owner = await self._owner(session, session_digest, touch=True)
            website = await SQLWebsiteRepository(session).get_by_id(website_id, owner)
            if website is None: raise ResourceNotFoundException("Website", "requested record")
            return WebsiteProofSnapshot(website, website.challenge_status(await self._now(session)) == "pending")

    async def _locked(self, session: AsyncSession, owner: str, expected: WebsiteEntity) -> WebsiteEntity:
        if owner != expected.owner_id: raise ResourceNotFoundException("Website", "requested record")
        await lock_website_hostname(session, expected.hostname)
        row = await session.scalar(select(WebsiteRow).where(WebsiteRow.id == expected.id,
            WebsiteRow.owner_id == owner, WebsiteRow.hostname == expected.hostname,
            WebsiteRow.released_at.is_(None)).with_for_update().execution_options(populate_existing=True))
        if row is None: raise ResourceNotFoundException("Website", "requested record")
        return website_entity(row)

    @safe_proof_storage
    async def issue(self, session_digest: bytes, expected: WebsiteEntity, digest: bytes) -> WebsiteEntity:
        async with self.database.transaction() as session:
            owner = await self._owner(session, session_digest)
            current = await self._locked(session, owner, expected)
            await self._owner(session, session_digest)
            if current != expected: raise WebsiteChallengeException()
            issued = current.issue_challenge(digest, now=await self._now(session))
            saved = await SQLWebsiteRepository(session).save_verification(issued, expected_updated_at=current.updated_at)
            if saved is None: raise WebsiteChallengeException()
            return saved

    @safe_proof_storage
    async def confirm(self, session_digest: bytes, expected: WebsiteEntity) -> WebsiteEntity:
        async with self.database.transaction() as session:
            owner = await self._owner(session, session_digest)
            current = await self._locked(session, owner, expected)
            await self._owner(session, session_digest)
            # Concurrent confirmations of the identical challenge are idempotent;
            # a rotated challenge or released/replaced record can never succeed.
            if (current.verified_at is not None and current.challenge_digest is not None
                    and expected.challenge_digest is not None
                    and hmac.compare_digest(current.challenge_digest, expected.challenge_digest)):
                return current
            if current != expected: raise WebsiteChallengeException()
            verified = current.verify_challenge(now=await self._now(session))
            saved = await SQLWebsiteRepository(session).save_verification(verified, expected_updated_at=current.updated_at)
            if saved is None: raise WebsiteChallengeException()
            return saved
