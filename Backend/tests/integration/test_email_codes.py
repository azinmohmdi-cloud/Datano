import asyncio
import re
from dataclasses import replace
from datetime import UTC, datetime, timedelta
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import func, inspect, select, text
from sqlalchemy.exc import IntegrityError, OperationalError

from app.application.use_cases.auth.email import EmailDeliveryError, EmailFailure, IEmailSender
from app.application.use_cases.auth.email_codes import EmailCodeService, EmailCodeUnavailable, EmailCodePurpose
from app.infra.database.models import EmailCodeRow
from app.infra.repositories.postgres.email_code_repository import PostgresEmailCodeRepository
from app.infra.services.email_code_crypto import EmailCodeCrypto
from tests.postgres import isolated_postgres_url, migrate, persistent_database
from tests.unit.test_email_codes import CONTEXT, KEY


async def test_code_survives_repository_recreation_and_can_be_consumed_only_once(persistent_database):
    sender = AsyncMock(spec=IEmailSender)
    now = datetime(2026, 10, 21, tzinfo=UTC)
    def service():
        return EmailCodeService(PostgresEmailCodeRepository(persistent_database, clock=lambda: now), EmailCodeCrypto(KEY), sender)
    assert (await service().issue(CONTEXT)).issued
    code = re.search(r"[0-9]{8}", sender.send.call_args.args[0].text).group()
    assert await service().consume(CONTEXT, code)
    assert not await service().consume(CONTEXT, code)


async def test_migration_adds_digest_only_email_challenges(persistent_database):
    async with persistent_database.engine.connect() as connection:
        columns = await connection.run_sync(lambda sync: inspect(sync).get_columns("email_code_challenges"))
    names = {column['name'] for column in columns}
    assert {'scope', 'digest', 'generation', 'issued_at', 'expires_at', 'attempts', 'delivered', 'consumed_at'} == names


class Codes:
    def __init__(self, database):
        self.database = database
        self.now = datetime(2026, 10, 21, tzinfo=UTC)
        self.sender = AsyncMock(spec=IEmailSender)
        self.crypto = EmailCodeCrypto(KEY)
        self.sequence = iter(f'{number:08d}' for number in range(1, 100))
        self.crypto.generate = lambda: next(self.sequence)

    def service(self):
        return EmailCodeService(PostgresEmailCodeRepository(self.database, clock=lambda: self.now), self.crypto, self.sender)

    def code(self):
        return re.search(r'[0-9]{8}', self.sender.send.call_args.args[0].text).group()

    async def row(self, context=CONTEXT):
        async with self.database.transaction() as session:
            return dict((await session.execute(select(EmailCodeRow.__table__).where(EmailCodeRow.scope == self.crypto.scope(context)))).mappings().one())


@pytest.fixture
def codes(persistent_database):
    return Codes(persistent_database)


@pytest.mark.parametrize('purpose', list(EmailCodePurpose))
async def test_scoped_issue_stores_only_hmac_and_returns_no_code(codes, purpose, caplog):
    context = replace(CONTEXT, purpose=purpose)
    result = await codes.service().issue(context)
    code = codes.code()
    row = await codes.row(context)
    assert row['digest'] == codes.crypto.digest(context, code)
    assert row['scope'] == codes.crypto.scope(context)
    assert row['expires_at'] == codes.now + timedelta(minutes=10)
    assert row['attempts'] == 0 and row['delivered'] and row['consumed_at'] is None
    for output in (repr(result), str(row), caplog.text):
        assert code not in output and KEY.decode() not in output and context.recipient not in output
    assert await codes.service().consume(context, code)


@pytest.mark.parametrize('seconds,allowed', [(599.999999, True), (600, False), (601, False), (-1, False)])
async def test_expiry_has_exact_boundary_and_rejects_clock_rollback(codes, seconds, allowed):
    await codes.service().issue(CONTEXT)
    code = codes.code()
    codes.now += timedelta(seconds=seconds)
    assert await codes.service().consume(CONTEXT, code) is allowed


async def test_fifth_attempt_may_succeed_but_sixth_is_rejected(codes):
    await codes.service().issue(CONTEXT)
    code = codes.code()
    for bad in ('bad', '１２３４５６７８', '۱۲۳۴۵۶۷۸', '99999999'):
        assert not await codes.service().consume(CONTEXT, bad)
    assert (await codes.row())['attempts'] == 4
    assert await codes.service().consume(CONTEXT, code)
    assert not await codes.service().consume(CONTEXT, code)
    assert (await codes.row())['attempts'] == 5


async def test_five_wrong_guesses_permanently_exhaust_current_code(codes):
    await codes.service().issue(CONTEXT)
    code = codes.code()
    results = await asyncio.gather(*(codes.service().consume(CONTEXT, '99999999') for _ in range(12)))
    assert not any(results)
    assert (await codes.row())['attempts'] == 5
    assert not await codes.service().consume(CONTEXT, code)


async def test_resend_boundary_invalidates_old_and_resets_budget(codes):
    await codes.service().issue(CONTEXT)
    old = codes.code()
    for _ in range(5):
        assert not await codes.service().consume(CONTEXT, '99999999')
    codes.now += timedelta(seconds=59, microseconds=999999)
    result = await codes.service().issue(CONTEXT)
    assert not result.issued and result.retry_after == 1
    assert codes.sender.send.await_count == 1
    codes.now += timedelta(microseconds=1)
    assert (await codes.service().issue(CONTEXT)).issued
    new = codes.code()
    assert old != new and (await codes.row())['attempts'] == 0
    assert not await codes.service().consume(CONTEXT, old)
    assert await codes.service().consume(CONTEXT, new)


async def test_duplicate_random_sample_is_regenerated_instead_of_reviving_old_code(codes):
    codes.sequence = iter(['00000001', '00000001', '00000002'])
    await codes.service().issue(CONTEXT)
    codes.now += timedelta(seconds=60)
    assert (await codes.service().issue(CONTEXT)).issued
    assert codes.code() == '00000002' and codes.sender.send.await_count == 2


async def test_parallel_initial_and_repeat_issues_send_only_one_message_per_window(codes):
    for _ in range(2):
        results = await asyncio.gather(*(codes.service().issue(CONTEXT) for _ in range(10)))
        assert sum(result.issued for result in results) == 1
        assert sorted(result.retry_after for result in results) == [0] + [60] * 9
        codes.now += timedelta(seconds=60)
    assert codes.sender.send.await_count == 2


async def test_parallel_valid_consumptions_have_only_one_winner(codes):
    await codes.service().issue(CONTEXT)
    results = await asyncio.gather(*(codes.service().consume(CONTEXT, codes.code()) for _ in range(10)))
    assert sum(results) == 1 and (await codes.row())['attempts'] == 1


@pytest.mark.parametrize('changes', [{'purpose': EmailCodePurpose.ADMIN_EMAIL}, {'subject': 'another-account'}, {'recipient': 'other@example.test'}])
async def test_code_cannot_be_replayed_in_other_context(codes, changes):
    await codes.service().issue(CONTEXT)
    code = codes.code()
    assert not await codes.service().consume(replace(CONTEXT, **changes), code)
    assert (await codes.row())['attempts'] == 0
    assert await codes.service().consume(CONTEXT, code)


async def test_canonical_email_shares_cooldown_and_challenge(codes):
    await codes.service().issue(CONTEXT)
    alias = replace(CONTEXT, recipient=' OWNER@EXAMPLE.TEST ')
    result = await codes.service().issue(alias)
    assert not result.issued and result.retry_after == 60
    assert await codes.service().consume(alias, codes.code())


async def test_failed_or_ambiguous_send_leaves_new_code_unusable_and_old_invalid(codes):
    await codes.service().issue(CONTEXT)
    old = codes.code()
    codes.now += timedelta(seconds=60)
    codes.sender.send.side_effect = EmailDeliveryError(EmailFailure.TIMEOUT, delivery_unknown=True)
    with pytest.raises(EmailDeliveryError):
        await codes.service().issue(CONTEXT)
    assert not await codes.service().consume(CONTEXT, old)
    assert not await codes.service().consume(CONTEXT, codes.code())
    assert not (await codes.row())['delivered']
    assert not (await codes.service().issue(CONTEXT)).issued
    assert codes.sender.send.await_count == 2


async def test_pending_send_and_cancellation_never_activate_proof(codes):
    sending, release = asyncio.Event(), asyncio.Event()
    async def pause(message):
        sending.set()
        await release.wait()
    codes.sender.send.side_effect = pause
    task = asyncio.create_task(codes.service().issue(CONTEXT))
    try:
        await asyncio.wait_for(sending.wait(), 5)
        assert not await codes.service().consume(CONTEXT, codes.code())
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
        assert not (await codes.row())['delivered']
    finally:
        if not task.done():
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)


async def test_delayed_old_send_cannot_activate_superseding_generation(codes):
    sending, release = asyncio.Event(), asyncio.Event()
    calls = 0
    async def pause_first(message):
        nonlocal calls
        calls += 1
        if calls == 1:
            sending.set()
            await release.wait()
        else:
            raise EmailDeliveryError(EmailFailure.AUTHENTICATION)
    codes.sender.send.side_effect = pause_first
    task = asyncio.create_task(codes.service().issue(CONTEXT))
    try:
        await asyncio.wait_for(sending.wait(), 5)
        codes.now += timedelta(seconds=60)
        with pytest.raises(EmailDeliveryError):
            await codes.service().issue(CONTEXT)
        release.set()
        assert not (await task).issued
        assert not (await codes.row())['delivered']
    finally:
        release.set()
        await asyncio.gather(task, return_exceptions=True)


async def test_delivery_after_expiration_never_activates(codes):
    async def delay(message):
        codes.now += timedelta(seconds=600)
    codes.sender.send.side_effect = delay
    assert not (await codes.service().issue(CONTEXT)).issued
    assert not await codes.service().consume(CONTEXT, codes.code())


async def test_expiry_is_sampled_after_waiting_for_row_lock(codes):
    await codes.service().issue(CONTEXT)
    code = codes.code()
    waiting = asyncio.Event()
    class SignallingRepository(PostgresEmailCodeRepository):
        async def _lock(self, session, scope):
            waiting.set()
            return await super()._lock(session, scope)
    service = EmailCodeService(SignallingRepository(codes.database, clock=lambda: codes.now), codes.crypto, codes.sender)
    task = None
    try:
        async with codes.database.transaction() as session:
            await session.execute(select(EmailCodeRow).with_for_update())
            task = asyncio.create_task(service.consume(CONTEXT, code))
            await asyncio.wait_for(waiting.wait(), 5)
            codes.now += timedelta(seconds=600)
        assert not await asyncio.wait_for(task, 5)
        assert (await codes.row())['attempts'] == 0
    finally:
        if task is not None and not task.done():
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)


async def test_production_clock_and_new_database_pool_preserve_pending_and_active_state(persistent_database, isolated_postgres_url):
    from app.infra.database.connection import Database
    scope, digest = EmailCodeCrypto(KEY).scope(CONTEXT), EmailCodeCrypto(KEY).digest(CONTEXT, '00000000')
    repository = PostgresEmailCodeRepository(persistent_database)
    async with persistent_database.transaction() as session:
        before = await session.scalar(select(func.clock_timestamp()))
    reservation = await repository.reserve(scope, digest, 'a' * 32)
    async with persistent_database.transaction() as session:
        after = await session.scalar(select(func.clock_timestamp()))
    assert before <= reservation.expires_at - timedelta(seconds=600) <= after
    other = Database(isolated_postgres_url)
    try:
        repository = PostgresEmailCodeRepository(other)
        assert not await repository.consume(scope, digest)
        assert await repository.activate(scope, 'a' * 32)
        assert await repository.consume(scope, digest)
    finally:
        await other.dispose()


@pytest.mark.parametrize('bad', [b'', b'x' * 31, 'not-bytes'])
async def test_invalid_digest_cannot_touch_store(codes, bad):
    repository = PostgresEmailCodeRepository(codes.database)
    with pytest.raises(ValueError, match='32 bytes'):
        await repository.consume(bad, codes.crypto.digest(CONTEXT, '12345678'))


async def test_bad_generation_and_naive_clock_cannot_create_challenge(codes):
    repository = PostgresEmailCodeRepository(codes.database, clock=lambda: codes.now.replace(tzinfo=None))
    scope, digest = codes.crypto.scope(CONTEXT), codes.crypto.digest(CONTEXT, '12345678')
    with pytest.raises(ValueError, match='generation'):
        await repository.reserve(scope, digest, 'bad-generation')
    with pytest.raises(ValueError, match='timezone aware'):
        await repository.reserve(scope, digest, 'a' * 32)
    async with codes.database.transaction() as session:
        assert await session.scalar(text('SELECT count(*) FROM email_code_challenges')) == 0


async def test_attempts_commit_even_if_outer_account_transaction_rolls_back(codes):
    await codes.service().issue(CONTEXT)
    with pytest.raises(ValueError):
        async with codes.database.transaction():
            assert not await codes.service().consume(CONTEXT, 'bad')
            raise ValueError('account workflow failed')
    assert (await codes.row())['attempts'] == 1


async def test_database_outage_fails_closed_without_driver_secret_or_context(monkeypatch, codes):
    from contextlib import asynccontextmanager
    @asynccontextmanager
    async def broken():
        raise OperationalError('private-driver-secret', {}, Exception('private-driver-secret'))
        yield
    monkeypatch.setattr(codes.database, 'transaction', broken)
    with pytest.raises(EmailCodeUnavailable) as caught:
        await codes.service().issue(CONTEXT)
    assert caught.value.__context__ is None and 'private-driver-secret' not in str(caught.value)
    codes.sender.send.assert_not_awaited()


@pytest.mark.parametrize('mutation', ["digest=decode('00','hex')", "scope=decode('00','hex')", "generation='bad'",
    'attempts=-1', 'attempts=6', "expires_at=issued_at+interval '11 minutes'", 'consumed_at=issued_at'])
async def test_database_rejects_invalid_challenge_state(codes, mutation):
    repository = PostgresEmailCodeRepository(codes.database, clock=lambda: codes.now)
    await repository.reserve(codes.crypto.scope(CONTEXT), codes.crypto.digest(CONTEXT, '12345678'), 'a'*32)
    with pytest.raises(IntegrityError) as caught:
        async with codes.database.transaction() as session:
            await session.execute(text('UPDATE email_code_challenges SET ' + mutation))
    assert caught.value.orig.sqlstate == '23514'


async def test_migration_upgrade_replay_downgrade_preserves_existing_tables(isolated_postgres_url):
    from app.infra.database.connection import Database
    database = Database(isolated_postgres_url)
    try:
        async with database.engine.begin() as connection:
            await connection.run_sync(migrate, '0005_opaque_sessions')
            await connection.execute(text('CREATE TABLE preservation_probe (id int PRIMARY KEY)'))
            await connection.execute(text('INSERT INTO preservation_probe VALUES (42)'))
            await connection.execute(text("""INSERT INTO users
                (id, first_name, last_name, email, email_key, username, hashed_password, created_at, updated_at, is_active)
                VALUES ('preserved-user', 'First', 'Last', 'keep@example.test', 'keep@example.test', 'kept-user', 'test-hash', now(), now(), true)"""))
            await connection.execute(text("""INSERT INTO roles VALUES
                ('preserved-role', 'User', ARRAY[]::text[], now(), now(), true)"""))
            await connection.execute(text("INSERT INTO user_roles VALUES ('preserved-user', 'preserved-role')"))
            await connection.execute(text("""INSERT INTO registration_attempts VALUES
                (repeat('a',64), now(), now()+interval '10 minutes', 2)"""))
            await connection.execute(text("""INSERT INTO auth_sessions VALUES
                (decode(repeat('ab',32),'hex'), 'preserved-user', false, 1800, now(), now(), now()+interval '30 minutes', now()+interval '12 hours', NULL)"""))
            snapshots = {}
            for table in ('users', 'roles', 'user_roles', 'registration_attempts', 'auth_sessions'):
                snapshots[table] = [dict(row) for row in (await connection.execute(text('SELECT * FROM ' + table))).mappings()]
            before = set(await connection.run_sync(lambda sync: inspect(sync).get_table_names()))
            await connection.run_sync(migrate)
            await connection.run_sync(migrate)
            assert await connection.scalar(text('SELECT version_num FROM alembic_version')) == '0006_email_codes'
            assert set(await connection.run_sync(lambda sync: inspect(sync).get_table_names())) == before | {'email_code_challenges'}
            for table, records in snapshots.items():
                assert [dict(row) for row in (await connection.execute(text('SELECT * FROM ' + table))).mappings()] == records
        async with database.engine.begin() as connection:
            await connection.run_sync(lambda sync: migrate(sync, '0005_opaque_sessions', downgrade=True))
            assert set(await connection.run_sync(lambda sync: inspect(sync).get_table_names())) == before
            assert await connection.scalar(text('SELECT id FROM preservation_probe')) == 42
            for table, records in snapshots.items():
                assert [dict(row) for row in (await connection.execute(text('SELECT * FROM ' + table))).mappings()] == records
            await connection.run_sync(migrate)
    finally:
        await database.dispose()
