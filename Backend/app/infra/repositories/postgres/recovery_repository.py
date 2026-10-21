from collections.abc import AsyncIterator, Callable
from contextlib import asynccontextmanager
from datetime import datetime, timedelta
from functools import wraps
from collections.abc import Awaitable
from typing import ParamSpec, TypeVar
import hashlib
import hmac
import json

from sqlalchemy import delete, func, select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.auth.password_recovery import RecoveryAccount
from app.domain.error.exceptions import ServiceUnavailableException
from app.domain.identity import canonical_email
from app.infra.database.connection import Database
from app.infra.database.models import RecoveryGrantRow, UserRow
from app.infra.repositories.postgres.session_repository import SQLSessionRepository
from app.infra.repositories.postgres.user_repository import SQLUserRepository
from app.interface.repository.recovery_repository_interface import IRecoveryRepository

P = ParamSpec("P")
T = TypeVar("T")


def safe_storage(operation: Callable[P, Awaitable[T]]) -> Callable[P, Awaitable[T]]:
    @wraps(operation)
    async def wrapped(*args: P.args, **kwargs: P.kwargs) -> T:
        try:
            return await operation(*args, **kwargs)
        except SQLAlchemyError:
            pass
        # Raise after the whole operation/context manager has unwound, so even
        # failures thrown into a yielding transaction retain no driver context.
        raise ServiceUnavailableException("Password recovery is temporarily unavailable")
    return wrapped


class PostgresRecoveryRepository(IRecoveryRepository):
    def __init__(self, database: Database, *, clock: Callable[[], datetime] | None = None) -> None:
        self.database, self.clock = database, clock

    @asynccontextmanager
    async def _transaction(self) -> AsyncIterator[AsyncSession]:
        async with self.database.transaction() as session:
            yield session

    async def _now(self, session: AsyncSession) -> datetime:
        now = self.clock() if self.clock else await session.scalar(select(func.clock_timestamp()))
        if now.tzinfo is None or now.utcoffset() is None:
            raise ValueError("Recovery clock must be timezone aware")
        return now

    @staticmethod
    def _snapshot(user: UserRow) -> RecoveryAccount:
        # A one-way fingerprint of the existing salted hash/email binds proofs
        # to the current credential state, without duplicating a password hash.
        state = hashlib.sha256(json.dumps(["datano-recovery-state-v1", user.id,
            user.email_key, user.hashed_password], separators=(",", ":")).encode()).digest()
        return RecoveryAccount(user.id, user.email_key, state)

    @staticmethod
    def _digest(value: bytes) -> None:
        if not isinstance(value, bytes) or len(value) != 32:
            raise ValueError("Recovery digest must be 32 bytes")

    @safe_storage
    async def account(self, email: str) -> RecoveryAccount | None:
        async with self._transaction() as session:
            user = await session.scalar(select(UserRow).where(UserRow.email_key == canonical_email(email)))
            return self._snapshot(user) if user is not None and user.is_active else None

    @safe_storage
    async def grant(self, account: RecoveryAccount, digest: bytes, *, seconds: int) -> datetime | None:
        self._digest(digest)
        if type(seconds) is not int or not 1 <= seconds <= 600:
            raise ValueError("Invalid recovery grant lifetime")
        async with self._transaction() as session:
            user = await session.scalar(select(UserRow).where(UserRow.id == account.user_id).with_for_update())
            if user is None or not user.is_active or not hmac.compare_digest(self._snapshot(user).state, account.state):
                return None
            now = await self._now(session)
            await session.execute(delete(RecoveryGrantRow).where(RecoveryGrantRow.user_id == user.id))
            expires = now + timedelta(seconds=seconds)
            session.add(RecoveryGrantRow(digest=digest, user_id=user.id, account_state=account.state,
                created_at=now, expires_at=expires))
            return expires

    async def _locked(self, session: AsyncSession, digest: bytes) -> tuple[UserRow, RecoveryGrantRow] | None:
        self._digest(digest)
        owner = await session.scalar(select(RecoveryGrantRow.user_id).where(RecoveryGrantRow.digest == digest))
        if owner is None:
            return None
        # Same user-before-session ordering as login/rotation and revoke_all.
        user = await session.scalar(select(UserRow).where(UserRow.id == owner).with_for_update())
        grant = await session.scalar(select(RecoveryGrantRow).where(RecoveryGrantRow.digest == digest).with_for_update())
        now = await self._now(session)
        if (user is None or not user.is_active or grant is None or not grant.created_at <= now < grant.expires_at
                or not hmac.compare_digest(grant.account_state, self._snapshot(user).state)):
            return None
        return user, grant

    @safe_storage
    async def valid(self, digest: bytes) -> bool:
        async with self._transaction() as session:
            return await self._locked(session, digest) is not None

    @safe_storage
    async def reset(self, digest: bytes, password_hash: str) -> bool:
        async with self._transaction() as session:
            locked = await self._locked(session, digest)
            if locked is None:
                return False
            user, _ = locked
            if not await SQLUserRepository(session).replace_password_hash(user.id, user.hashed_password, password_hash):
                return False
            user.updated_at = await self._now(session)
            await SQLSessionRepository(session, clock=self.clock).revoke_all(user.id)
            await session.execute(delete(RecoveryGrantRow).where(RecoveryGrantRow.user_id == user.id))
            return True
