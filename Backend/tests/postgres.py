"""Real PostgreSQL fixtures; never fall back to an application database."""
import os
from collections.abc import AsyncIterator
from pathlib import Path
from uuid import uuid4

import pytest
from alembic import command
from alembic.config import Config as AlembicConfig
from sqlalchemy.engine import Connection, URL, make_url
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.pool import NullPool
from sqlalchemy.schema import CreateSchema, DropSchema

from app.infra.database.connection import Database


def migrate(connection: Connection, revision: str = "head", *, downgrade: bool = False) -> None:
    config = AlembicConfig(str(Path(__file__).resolve().parents[1] / "alembic.ini"))
    config.attributes["connection"] = connection
    (command.downgrade if downgrade else command.upgrade)(config, revision)


@pytest.fixture
async def isolated_postgres_url() -> AsyncIterator[URL]:
    raw = os.environ.get("DATANO_TEST_DATABASE_URL")
    if not raw:
        pytest.fail("Set DATANO_TEST_DATABASE_URL to a dedicated PostgreSQL test database")
    url = make_url(raw)
    if url.drivername != "postgresql+psycopg" or not (url.database or "").startswith("datano_test"):
        pytest.fail("Tests require postgresql+psycopg and a datano_test* database")
    schema = f"be004_{uuid4().hex}"
    engine = create_async_engine(url, poolclass=NullPool, hide_parameters=True, connect_args={"connect_timeout": 5})
    try:
        async with engine.begin() as connection:
            await connection.execute(CreateSchema(schema))
        try:
            yield url.set(query={**url.query, "options": f"-csearch_path={schema}"})
        finally:
            async with engine.begin() as connection:
                await connection.execute(DropSchema(schema, cascade=True))
    finally:
        await engine.dispose()


@pytest.fixture
async def persistent_database(isolated_postgres_url: URL) -> AsyncIterator[Database]:
    database = Database(isolated_postgres_url)
    try:
        async with database.engine.begin() as connection:
            await connection.run_sync(migrate)
        yield database
    finally:
        await database.dispose()
