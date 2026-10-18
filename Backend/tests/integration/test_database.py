import asyncio
import os
import subprocess
import sys
from collections.abc import AsyncIterator
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config as AlembicConfig
from sqlalchemy import inspect, text
from sqlalchemy.engine import URL, Connection, make_url
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncEngine, create_async_engine
from sqlalchemy.pool import NullPool
from sqlalchemy.schema import CreateSchema, DropSchema

from app.infra.database.connection import Database


@pytest.fixture
async def postgres_url() -> AsyncIterator[URL]:
    raw = os.environ.get("DATANO_TEST_DATABASE_URL")
    if not raw:
        pytest.fail("Set DATANO_TEST_DATABASE_URL to a dedicated PostgreSQL test database")
    url = make_url(raw)
    if url.drivername != "postgresql+psycopg" or not (url.database or "").startswith("datano_test"):
        pytest.fail("Database integration tests require postgresql+psycopg and a datano_test* database")
    schema = f"be003_{uuid4().hex}"
    admin = create_async_engine(url, poolclass=NullPool, hide_parameters=True)
    try:
        async with admin.begin() as connection:
            await connection.execute(CreateSchema(schema))
        try:
            yield url.set(query={**url.query, "options": f"-csearch_path={schema}"})
        finally:
            async with admin.begin() as connection:
                await connection.execute(DropSchema(schema, cascade=True))
    finally:
        await admin.dispose()


@pytest.fixture
async def probe_engine(postgres_url: URL) -> AsyncIterator[AsyncEngine]:
    engine = create_async_engine(postgres_url, poolclass=NullPool, hide_parameters=True)
    try:
        async with engine.begin() as connection:
            await connection.execute(text(
                "CREATE TABLE transaction_probe (id integer PRIMARY KEY, label text NOT NULL UNIQUE)"
            ))
        yield engine
    finally:
        await engine.dispose()


@pytest.fixture
async def database(postgres_url: URL) -> AsyncIterator[Database]:
    database = Database(postgres_url)
    try:
        yield database
    finally:
        await database.dispose()


async def test_transaction_commits_on_success(database: Database, probe_engine: AsyncEngine) -> None:
    async with database.transaction() as session:
        await session.execute(text("INSERT INTO transaction_probe VALUES (1, 'committed')"))
    async with probe_engine.connect() as reader:
        assert await reader.scalar(text("SELECT label FROM transaction_probe WHERE id = 1")) == "committed"


async def test_transaction_rolls_back_all_writes_on_error(
    database: Database, probe_engine: AsyncEngine
) -> None:
    with pytest.raises(ValueError, match="operation failed"):
        async with database.transaction() as session:
            await session.execute(text("INSERT INTO transaction_probe VALUES (1, 'first')"))
            await session.execute(text("INSERT INTO transaction_probe VALUES (2, 'second')"))
            raise ValueError("operation failed")
    async with probe_engine.connect() as reader:
        assert await reader.scalar(text("SELECT count(*) FROM transaction_probe")) == 0


async def test_constraint_failure_rolls_back_and_next_transaction_works(
    database: Database, probe_engine: AsyncEngine
) -> None:
    with pytest.raises(IntegrityError):
        async with database.transaction() as session:
            await session.execute(text("INSERT INTO transaction_probe VALUES (1, 'duplicate')"))
            await session.execute(text("INSERT INTO transaction_probe VALUES (2, 'duplicate')"))
    async with probe_engine.connect() as reader:
        assert await reader.scalar(text("SELECT count(*) FROM transaction_probe")) == 0
    async with database.transaction() as session:
        await session.execute(text("INSERT INTO transaction_probe VALUES (3, 'recovered')"))
    async with probe_engine.connect() as reader:
        assert await reader.scalar(text("SELECT label FROM transaction_probe")) == "recovered"


async def test_cancelled_operation_rolls_back(database: Database, probe_engine: AsyncEngine) -> None:
    with pytest.raises(asyncio.CancelledError):
        async with database.transaction() as session:
            await session.execute(text("INSERT INTO transaction_probe VALUES (1, 'cancelled')"))
            raise asyncio.CancelledError
    async with probe_engine.connect() as reader:
        assert await reader.scalar(text("SELECT count(*) FROM transaction_probe")) == 0


async def test_overlapping_transactions_have_separate_sessions(database: Database) -> None:
    async with database.transaction() as first:
        async with database.transaction() as second:
            assert first is not second
            first_pid = await first.scalar(text("SELECT pg_backend_pid()"))
            second_pid = await second.scalar(text("SELECT pg_backend_pid()"))
            assert first_pid != second_pid
    assert not first.in_transaction()
    assert not second.in_transaction()


def _migrate(connection: Connection, direction: str, revision: str) -> None:
    config = AlembicConfig(str(Path(__file__).resolve().parents[2] / "alembic.ini"))
    config.attributes["connection"] = connection
    if direction == "upgrade":
        command.upgrade(config, revision)
    else:
        command.downgrade(config, revision)


async def test_migration_upgrades_an_empty_postgresql_schema(database: Database) -> None:
    async with database.engine.begin() as connection:
        assert await connection.run_sync(lambda sync: inspect(sync).get_table_names()) == []
        await connection.run_sync(_migrate, "upgrade", "head")
        tables = await connection.run_sync(lambda sync: inspect(sync).get_table_names())
        assert tables == ["alembic_version"]
    async with database.engine.connect() as reader:
        assert await reader.scalar(text("SELECT version_num FROM alembic_version")) == "0001_database_baseline"


async def test_migration_replay_and_downgrade_preserve_existing_data(database: Database) -> None:
    async with database.engine.begin() as connection:
        await connection.execute(text("CREATE TABLE preservation_probe (id integer PRIMARY KEY)"))
        await connection.execute(text("INSERT INTO preservation_probe VALUES (42)"))
        await connection.run_sync(_migrate, "upgrade", "head")
        await connection.run_sync(_migrate, "upgrade", "head")
    async with database.engine.begin() as connection:
        await connection.run_sync(_migrate, "downgrade", "base")
    async with database.engine.connect() as reader:
        assert await reader.scalar(text("SELECT id FROM preservation_probe")) == 42
        assert await reader.scalar(text("SELECT count(*) FROM alembic_version")) == 0
    async with database.engine.begin() as connection:
        await connection.run_sync(_migrate, "upgrade", "head")
    async with database.engine.connect() as reader:
        assert await reader.scalar(text("SELECT id FROM preservation_probe")) == 42
        assert await reader.scalar(text("SELECT version_num FROM alembic_version")) == "0001_database_baseline"


async def test_migration_cli_uses_private_environment_url(
    postgres_url: URL, database: Database
) -> None:
    result = subprocess.run(
        [sys.executable, "-m", "alembic", "-c", "alembic.ini", "upgrade", "head"],
        cwd=Path(__file__).resolve().parents[2],
        env={**os.environ, "DATABASE_URL": postgres_url.render_as_string(hide_password=False)},
        capture_output=True, text=True, timeout=20,
    )
    assert result.returncode == 0, result.stderr
    if postgres_url.password:
        assert postgres_url.password not in result.stdout + result.stderr
    async with database.engine.connect() as reader:
        version_exists = await reader.run_sync(lambda sync: inspect(sync).has_table("alembic_version"))
        assert version_exists
