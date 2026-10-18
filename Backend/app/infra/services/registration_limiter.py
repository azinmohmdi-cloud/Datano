"""PostgreSQL registration counters shared by workers and application lifetimes."""
import hashlib
import math
from collections.abc import Callable
from datetime import UTC, datetime, timedelta
from ipaddress import ip_address

from sqlalchemy import delete, func, select, tuple_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import SQLAlchemyError

from app.application.use_cases.auth.interfaces import IRegistrationLimiter, RegistrationLimitDecision
from app.domain.error.exceptions import ServiceUnavailableException
from app.infra.database.connection import Database
from app.infra.database.models import RegistrationAttemptRow


def registration_peer_key(peer: str | None, *, namespace: str = "registration") -> str:
    try:
        address = ip_address(peer or "")
        if address.version == 6 and address.ipv4_mapped is not None:
            address = address.ipv4_mapped
        identity = address.packed
    except ValueError:
        # Missing/unparseable peers share one restrictive bucket, never a bypass.
        identity = b"unknown"
    return hashlib.sha256(namespace.encode("ascii") + b":" + identity).hexdigest()


class PostgresRegistrationLimiter(IRegistrationLimiter):
    def __init__(self, database: Database, *, limit: int, window_seconds: int,
                 clock: Callable[[], datetime] | None = None, namespace: str = "registration") -> None:
        if not 1 <= limit <= 2147483646 or window_seconds < 1:
            raise ValueError("Registration limits must be positive and fit the database counter")
        self._database = database
        self._limit = limit
        self._window_seconds = window_seconds
        self._clock = clock
        if namespace not in {"registration", "login"}:
            raise ValueError("Unsupported authentication counter namespace")
        self._namespace = namespace

    async def consume(self, peer: str | None) -> RegistrationLimitDecision:
        row = RegistrationAttemptRow
        try:
            # This short transaction commits even if account/body validation fails.
            async with self._database.transaction() as session:
                now = self._clock() if self._clock is not None else await session.scalar(select(func.clock_timestamp()))
                if now.tzinfo is None:
                    raise ValueError("Registration clock must be timezone-aware")
                start = datetime.fromtimestamp(
                    math.floor(now.timestamp() / self._window_seconds) * self._window_seconds, UTC
                )
                expires = start + timedelta(seconds=self._window_seconds)
                # Bounded cleanup uses only expired windows, never the current
                # bucket. Skip locked rows instead of delaying another request.
                expired = (select(row.peer_key, row.window_start)
                    .where(row.expires_at <= now).order_by(row.expires_at, row.peer_key)
                    .limit(100).with_for_update(skip_locked=True))
                await session.execute(delete(row).where(tuple_(row.peer_key, row.window_start).in_(expired)))
                statement = insert(row).values(
                    peer_key=registration_peer_key(peer, namespace=self._namespace), window_start=start,
                    expires_at=expires, attempts=1,
                ).on_conflict_do_update(
                    index_elements=[row.peer_key, row.window_start],
                    set_={"attempts":func.least(row.attempts, self._limit) + 1},
                ).returning(row.attempts)
                count = await session.scalar(statement)
            allowed = count <= self._limit
            return RegistrationLimitDecision(allowed, 0 if allowed else max(1, math.ceil((expires - now).total_seconds())))
        except SQLAlchemyError:
            # An unavailable counter store must never enable unlimited signup.
            raise ServiceUnavailableException(f"{self._namespace.title()} is temporarily unavailable") from None
