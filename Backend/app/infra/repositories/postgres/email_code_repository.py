from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
import hmac
import math
import re

from sqlalchemy import func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.auth.email_codes import CODE_MAX_ATTEMPTS, CODE_RESEND_SECONDS, CODE_TTL_SECONDS, CodeReservation, EmailCodeUnavailable
from app.infra.database.connection import Database
from app.infra.database.models import EmailCodeRow
from app.interface.repository.email_code_repository_interface import IEmailCodeRepository


class PostgresEmailCodeRepository(IEmailCodeRepository):
    """Short committed operations; no locks/transaction survive SMTP I/O.

    A per-scope advisory transaction lock serializes even first issuance when
    there is no row yet. Row locks serialize consumption, resend and activation.
    Wall time is sampled after locks so waiting cannot revive an expired proof.
    """
    def __init__(self, database: Database, *, clock: Callable[[], datetime] | None = None) -> None:
        self._database, self._clock = database, clock

    @asynccontextmanager
    async def _transaction(self) -> AsyncIterator[AsyncSession]:
        failed = False
        try:
            async with self._database.transaction() as session:
                yield session
        except SQLAlchemyError:
            failed = True
        if failed:
            # Keep raw driver exceptions/DSNs outside public exception context.
            raise EmailCodeUnavailable()

    async def _now(self, session: AsyncSession) -> datetime:
        now = self._clock() if self._clock else await session.scalar(select(func.clock_timestamp()))
        if now.tzinfo is None or now.utcoffset() is None:
            raise ValueError("Email code clock must be timezone aware")
        return now

    @staticmethod
    def _validate(*digests: bytes) -> None:
        if any(not isinstance(value, bytes) or len(value) != 32 for value in digests):
            raise ValueError("Email code digest must be 32 bytes")

    async def _lock(self, session: AsyncSession, scope: bytes) -> EmailCodeRow | None:
        self._validate(scope)
        return await session.scalar(select(EmailCodeRow).where(EmailCodeRow.scope == scope)
            .with_for_update().execution_options(populate_existing=True))

    async def reserve(self, scope: bytes, digest: bytes, generation: str) -> CodeReservation:
        self._validate(scope, digest)
        if not isinstance(generation, str) or not re.fullmatch(r"[0-9a-f]{32}", generation):
            raise ValueError("Invalid email code generation")
        async with self._transaction() as session:
            await session.execute(select(func.pg_advisory_xact_lock(int.from_bytes(scope[:8], "big", signed=True))))
            row = await self._lock(session, scope)
            now = await self._now(session)
            if row is not None:
                remaining = (row.issued_at + timedelta(seconds=CODE_RESEND_SECONDS) - now).total_seconds()
                if remaining > 0:
                    return CodeReservation(retry_after=math.ceil(remaining))
                if hmac.compare_digest(row.digest, digest):
                    return CodeReservation(collision=True)
            else:
                row = EmailCodeRow(scope=scope)
                session.add(row)
            row.digest, row.generation = digest, generation
            row.issued_at, row.expires_at = now, now + timedelta(seconds=CODE_TTL_SECONDS)
            row.attempts, row.delivered, row.consumed_at = 0, False, None
            return CodeReservation(expires_at=row.expires_at)

    async def activate(self, scope: bytes, generation: str) -> bool:
        async with self._transaction() as session:
            row = await self._lock(session, scope)
            now = await self._now(session)
            if (row is None or row.generation != generation or row.consumed_at is not None
                    or not row.issued_at <= now < row.expires_at):
                return False
            row.delivered = True
            return True

    async def consume(self, scope: bytes, digest: bytes) -> bool:
        self._validate(scope, digest)
        async with self._transaction() as session:
            row = await self._lock(session, scope)
            now = await self._now(session)
            if (row is None or not row.delivered or row.consumed_at is not None
                    or row.attempts >= CODE_MAX_ATTEMPTS or not row.issued_at <= now < row.expires_at):
                return False
            row.attempts += 1
            if not hmac.compare_digest(row.digest, digest):
                return False
            row.consumed_at = now
            return True
