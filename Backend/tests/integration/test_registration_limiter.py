import asyncio
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, insert, select
from sqlalchemy.exc import IntegrityError

from app.infra.database.models import RegistrationAttemptRow
from app.infra.services.registration_limiter import PostgresRegistrationLimiter
from tests.postgres import isolated_postgres_url, persistent_database

NOW = datetime(2026, 10, 18, 0, 0, 1, tzinfo=UTC)


async def test_concurrent_limits_have_exactly_five_admissions(persistent_database):
    async def attempt():
        limiter = PostgresRegistrationLimiter(persistent_database, limit=5, window_seconds=600, clock=lambda:NOW)
        return await limiter.consume("203.0.113.12")
    results = await asyncio.gather(*(attempt() for _ in range(12)))
    assert sum(result.allowed for result in results) == 5
    assert {result.retry_after for result in results if not result.allowed} == {599}
    async with persistent_database.transaction() as session:
        assert await session.scalar(select(RegistrationAttemptRow.attempts)) == 6


async def test_window_resets_at_exact_boundary_without_extending_on_denial(persistent_database):
    current = [NOW]
    limiter = PostgresRegistrationLimiter(persistent_database, limit=1, window_seconds=600, clock=lambda:current[0])
    assert (await limiter.consume("203.0.113.12")).allowed
    assert (await limiter.consume("203.0.113.12")).retry_after == 599
    current[0] += timedelta(seconds=598)
    assert (await limiter.consume("203.0.113.12")).retry_after == 1
    current[0] += timedelta(seconds=1)
    assert (await limiter.consume("203.0.113.12")).allowed


async def test_peers_are_independent_and_address_spellings_cannot_bypass_limit(persistent_database):
    limiter = PostgresRegistrationLimiter(persistent_database, limit=1, window_seconds=600, clock=lambda:NOW)
    assert (await limiter.consume("203.0.113.12")).allowed
    assert not (await limiter.consume("::ffff:203.0.113.12")).allowed
    assert (await limiter.consume("203.0.113.13")).allowed
    assert (await limiter.consume("2001:db8::1")).allowed
    assert not (await limiter.consume("2001:0db8:0:0:0:0:0:1")).allowed
    assert (await limiter.consume(None)).allowed
    assert not (await limiter.consume("not-an-address")).allowed


async def test_expired_counter_cleanup_is_bounded_and_preserves_live_windows(persistent_database):
    old = NOW - timedelta(days=1)
    async with persistent_database.transaction() as session:
        await session.execute(insert(RegistrationAttemptRow), [{
            "peer_key":f"{i:064x}","window_start":old,"expires_at":old+timedelta(seconds=600),"attempts":1,
        } for i in range(105)])
    limiter = PostgresRegistrationLimiter(persistent_database, limit=1, window_seconds=600, clock=lambda:NOW)
    assert (await limiter.consume("203.0.113.12")).allowed
    async with persistent_database.transaction() as session:
        assert await session.scalar(select(func.count()).select_from(RegistrationAttemptRow).where(RegistrationAttemptRow.window_start==old)) == 5
    assert (await limiter.consume("203.0.113.13")).allowed
    assert not (await limiter.consume("203.0.113.12")).allowed
    async with persistent_database.transaction() as session:
        assert await session.scalar(select(func.count()).select_from(RegistrationAttemptRow).where(RegistrationAttemptRow.window_start==old)) == 0


async def test_maximum_configured_counter_saturates_without_integer_overflow(persistent_database):
    from app.infra.services.registration_limiter import registration_peer_key
    limit = 2147483646
    async with persistent_database.transaction() as session:
        await session.execute(insert(RegistrationAttemptRow).values(peer_key=registration_peer_key("203.0.113.12"),
            window_start=NOW.replace(second=0), expires_at=NOW.replace(second=0)+timedelta(seconds=600), attempts=limit+1))
    limiter = PostgresRegistrationLimiter(persistent_database, limit=limit, window_seconds=600, clock=lambda:NOW)
    assert not (await limiter.consume("203.0.113.12")).allowed


@pytest.mark.parametrize("change,code", [
    ({"attempts":0},"23514"), ({"attempts":None},"23502"),
    ({"peer_key":"short"},"23514"), ({"expires_at":NOW},"23514"),
])
async def test_counter_constraints_are_enforced_by_postgresql(persistent_database, change, code):
    values = {"peer_key":"a"*64,"window_start":NOW,"expires_at":NOW+timedelta(seconds=600),"attempts":1,**change}
    with pytest.raises(IntegrityError) as error:
        async with persistent_database.transaction() as session:
            await session.execute(insert(RegistrationAttemptRow).values(**values))
    assert error.value.orig.sqlstate == code
