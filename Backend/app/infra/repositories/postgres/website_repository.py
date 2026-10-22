from collections.abc import Iterator
from contextlib import contextmanager
from dataclasses import asdict
from datetime import datetime
from hashlib import sha256

from fastapi_pagination import Page, Params
from sqlalchemy import func, select, update
from sqlalchemy.exc import DataError, IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.domain.entities.website_entity import WebsiteEntity
from app.domain.error.exceptions import ConflictException, ResourceNotFoundException, ValidationException
from app.infra.database.models import WebsiteRow
from app.interface.repository.website_repository_interface import IWebsiteRepository


def website_entity(row: WebsiteRow) -> WebsiteEntity:
    return WebsiteEntity(**{name: getattr(row, name) for name in WebsiteEntity.__dataclass_fields__})


@contextmanager
def website_constraints() -> Iterator[None]:
    try:
        yield
    except (IntegrityError, DataError) as error:
        code = getattr(error.orig, "sqlstate", None)
        if code == "23505":
            raise ConflictException("Website is unavailable") from None
        if code == "23503":
            raise ResourceNotFoundException("Website owner", "referenced account") from None
        if code in {"23502", "23514", "22001"}:
            raise ValidationException("Invalid website persistence state") from None
        raise


class SQLWebsiteRepository(IWebsiteRepository):
    """Caller owns the transaction; hostname locks last until its completion."""
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def _lock_hostname(self, hostname: str) -> None:
        key = int.from_bytes(sha256(("datano:website:" + hostname).encode("ascii")).digest()[:8], signed=True)
        await self.session.execute(select(func.pg_advisory_xact_lock(key)))

    async def claim(self, candidate: WebsiteEntity) -> WebsiteEntity:
        if (candidate.challenge_digest is not None or candidate.verified_at is not None
                or candidate.released_at is not None or candidate.updated_at != candidate.created_at):
            raise ValidationException("A website claim must be a new unverified reservation")
        await self._lock_hostname(candidate.hostname)
        # Read wall time after acquiring the lock, including any contention wait.
        now: datetime = (await self.session.execute(select(func.clock_timestamp()))).scalar_one()
        current = await self.session.scalar(select(WebsiteRow).where(
            WebsiteRow.hostname == candidate.hostname, WebsiteRow.released_at.is_(None)
        ).with_for_update().execution_options(populate_existing=True))
        if current is not None:
            if current.owner_id == candidate.owner_id:
                return website_entity(current)
            if current.verified_at is not None or now < current.reservation_expires_at:
                raise ConflictException("Website is unavailable")
        if not candidate.created_at <= now < candidate.reservation_expires_at:
            raise ValidationException("Website reservation is not current")
        if current is not None:
            current.released_at = current.updated_at = now
            await self.session.flush()
        row = WebsiteRow(**asdict(candidate))
        with website_constraints():
            self.session.add(row)
            await self.session.flush()
        return website_entity(row)

    async def get_by_id(self, website_id: str, owner_id: str) -> WebsiteEntity | None:
        row = await self.session.scalar(select(WebsiteRow).where(
            WebsiteRow.id == website_id, WebsiteRow.owner_id == owner_id, WebsiteRow.released_at.is_(None)
        ).execution_options(populate_existing=True))
        return website_entity(row) if row is not None else None

    async def get_by_owner(self, owner_id: str, params: Params) -> Page[WebsiteEntity]:
        criteria = (WebsiteRow.owner_id == owner_id, WebsiteRow.released_at.is_(None))
        total = await self.session.scalar(select(func.count()).select_from(WebsiteRow).where(*criteria)) or 0
        rows = await self.session.scalars(select(WebsiteRow).where(*criteria)
            .order_by(WebsiteRow.created_at, WebsiteRow.id)
            .offset((params.page - 1) * params.size).limit(params.size)
            .execution_options(populate_existing=True))
        return Page(items=[website_entity(row) for row in rows], total=total,
                    page=params.page, size=params.size, pages=max(1, (total + params.size - 1) // params.size))

    async def save_verification(self, source: WebsiteEntity, *, expected_updated_at: datetime) -> WebsiteEntity | None:
        await self._lock_hostname(source.hostname)
        current = await self.session.scalar(select(WebsiteRow).where(
            WebsiteRow.id == source.id, WebsiteRow.owner_id == source.owner_id,
            WebsiteRow.hostname == source.hostname, WebsiteRow.scheme == source.scheme,
            WebsiteRow.created_at == source.created_at, WebsiteRow.updated_at == expected_updated_at,
            WebsiteRow.released_at.is_(None),
        ).with_for_update().execution_options(populate_existing=True))
        if current is None:
            return None
        if current.verified_at is not None or source.released_at is not None or source.updated_at <= expected_updated_at:
            raise ValidationException("Website verification update is not permitted")
        with website_constraints():
            row = await self.session.scalar(update(WebsiteRow).where(WebsiteRow.id == source.id).values(
                challenge_digest=source.challenge_digest, challenge_issued_at=source.challenge_issued_at,
                challenge_expires_at=source.challenge_expires_at, verified_at=source.verified_at,
                reservation_expires_at=source.reservation_expires_at, updated_at=source.updated_at,
            ).returning(WebsiteRow).execution_options(populate_existing=True))
        return website_entity(row) if row is not None else None
