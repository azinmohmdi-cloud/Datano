from collections.abc import Callable
from datetime import datetime, timedelta

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.auth.session_models import SessionPolicy, SessionRecord
from app.domain.error.exceptions import ConflictException, ResourceNotFoundException
from app.infra.database.models import SessionRow, UserRow
from app.interface.repository.session_repository_interface import ISessionRepository


class SQLSessionRepository(ISessionRepository):
    """Caller owns the transaction. Lock account before session for every mutation.

    Account locking also serializes issuance with revoke_all. Sample the database
    wall clock after waiting for locks; transaction-start time could revive expiry.
    No role/active-user authorization is inferred from a valid session record.
    """
    def __init__(self, session: AsyncSession, *, clock: Callable[[], datetime] | None = None) -> None:
        self.session = session
        self._clock = clock

    async def _now(self) -> datetime:
        now = self._clock() if self._clock is not None else await self.session.scalar(select(func.clock_timestamp()))
        if now.tzinfo is None or now.utcoffset() is None:
            raise ValueError("Session clock must be timezone aware")
        return now

    @staticmethod
    def _validate_digest(digest: bytes) -> None:
        if not isinstance(digest, bytes) or len(digest) != 32:
            raise ValueError("Session digest must be 32 bytes")

    async def _lock_user(self, user_id: str) -> bool:
        return await self.session.scalar(select(UserRow.id).where(UserRow.id == user_id).with_for_update()) is not None

    async def _lock_record(self, digest: bytes) -> SessionRow | None:
        self._validate_digest(digest)
        user_id = await self.session.scalar(select(SessionRow.user_id).where(SessionRow.digest == digest))
        if user_id is None or not await self._lock_user(user_id):
            return None
        return await self.session.scalar(select(SessionRow).where(SessionRow.digest == digest)
            .with_for_update().execution_options(populate_existing=True))

    @staticmethod
    def _record(row: SessionRow) -> SessionRecord:
        return SessionRecord(digest=row.digest, user_id=row.user_id, remember_me=row.remember_me,
            idle_timeout_seconds=row.idle_timeout_seconds, created_at=row.created_at,
            last_seen_at=row.last_seen_at, idle_expires_at=row.idle_expires_at,
            absolute_expires_at=row.absolute_expires_at, revoked_at=row.revoked_at)

    async def create(self, digest: bytes, user_id: str, *, remember_me: bool,
                     idle_seconds: int, absolute_seconds: int) -> SessionRecord:
        self._validate_digest(digest)
        SessionPolicy(idle_seconds=idle_seconds, absolute_seconds=absolute_seconds)
        if not await self._lock_user(user_id):
            raise ResourceNotFoundException("User", user_id)
        now = await self._now()
        row = SessionRow(digest=digest, user_id=user_id, remember_me=remember_me,
            idle_timeout_seconds=idle_seconds, created_at=now, last_seen_at=now,
            idle_expires_at=now + timedelta(seconds=idle_seconds),
            absolute_expires_at=now + timedelta(seconds=absolute_seconds), revoked_at=None)
        self.session.add(row)
        try:
            await self.session.flush()
        except IntegrityError:
            raise ConflictException("Session could not be stored") from None
        return self._record(row)

    async def resolve(self, digest: bytes, *, touch: bool = True) -> SessionRecord | None:
        row = await self._lock_record(digest)
        if row is None:
            return None
        now = await self._now()
        if not self._record(row).is_valid_at(now):
            return None
        if touch:
            row.last_seen_at = now
            row.idle_expires_at = min(now + timedelta(seconds=row.idle_timeout_seconds), row.absolute_expires_at)
            await self.session.flush()
        return self._record(row)

    async def revoke(self, digest: bytes) -> bool:
        row = await self._lock_record(digest)
        if row is None or row.revoked_at is not None:
            return False
        row.revoked_at = max(await self._now(), row.last_seen_at)
        await self.session.flush()
        return True

    async def revoke_all(self, user_id: str) -> int:
        if not await self._lock_user(user_id):
            return 0
        now = await self._now()
        result = await self.session.execute(update(SessionRow)
            .where(SessionRow.user_id == user_id, SessionRow.revoked_at.is_(None))
            .values(revoked_at=func.greatest(now, SessionRow.last_seen_at))
            .execution_options(synchronize_session=False))
        return result.rowcount

    async def rotate(self, previous_digest: bytes, digest: bytes, user_id: str, *,
                     remember_me: bool, idle_seconds: int, absolute_seconds: int) -> SessionRecord:
        self._validate_digest(previous_digest)
        previous_user = await self.session.scalar(
            select(SessionRow.user_id).where(SessionRow.digest == previous_digest)
        )
        # Account switches can involve two users. Lock them in a stable order
        # before the existing create/revoke methods reacquire their own locks.
        owners = {user_id} | ({previous_user} if previous_user is not None else set())
        await self.session.execute(select(UserRow.id).where(UserRow.id.in_(owners))
            .order_by(UserRow.id).with_for_update())
        record = await self.create(digest, user_id, remember_me=remember_me,
            idle_seconds=idle_seconds, absolute_seconds=absolute_seconds)
        await self.revoke(previous_digest)
        return record
