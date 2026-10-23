from dataclasses import asdict

import pytest
from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from fastapi.testclient import TestClient
from sqlalchemy import inspect, text

from app.domain.entities import UserEntity, WebsiteEntity
from app.infra.core.config import Config
from app.infra.database.base import Base
from app.infra.database.bootstrap import ensure_required_roles
from app.infra.database.connection import Database
from app.infra.database.models import WebsiteRow
from app.infra.repositories.postgres.session_repository import SQLSessionRepository
from app.infra.repositories.postgres.user_repository import SQLUserRepository
from app.main import create_app
from tests.postgres import isolated_postgres_url, migrate


async def test_upgrade_from_prior_revision_preserves_all_existing_rows_and_downgrade_is_scoped(isolated_postgres_url):
    database = Database(isolated_postgres_url)
    try:
        async with database.engine.begin() as connection:
            await connection.run_sync(migrate, "0008_admin_grants")
        actor = UserEntity.create(first_name="Existing", last_name="Owner", email="existing@example.test",
                                  username="existing-owner", hashed_password="test-only-hash")
        async with database.transaction() as session:
            await ensure_required_roles(session)
            await SQLUserRepository(session).create(actor)
            await SQLSessionRepository(session).create(b"s" * 32, actor.id, remember_me=False,
                                                       idle_seconds=1800, absolute_seconds=43200)
        async with database.engine.begin() as connection:
            tables = set(await connection.run_sync(lambda sync: inspect(sync).get_table_names())) - {"alembic_version"}
            snapshots = {table: [dict(row) for row in (await connection.execute(text("SELECT * FROM " + table))).mappings()] for table in tables}
            await connection.run_sync(migrate)
            await connection.run_sync(migrate)
            assert await connection.scalar(text("SELECT version_num FROM alembic_version")) == "0010_integrations"
            assert set(await connection.run_sync(lambda sync: inspect(sync).get_table_names())) == tables | {
                "alembic_version", "websites", "integrations", "integration_credentials"}
            assert await connection.run_sync(lambda sync: compare_metadata(MigrationContext.configure(sync), Base.metadata)) == []
            for table, before in snapshots.items():
                assert [dict(row) for row in (await connection.execute(text("SELECT * FROM " + table))).mappings()] == before
        async with database.transaction() as session:
            session.add(WebsiteRow(**asdict(WebsiteEntity.create(actor.id, "example.com"))))
        async with database.engine.begin() as connection:
            await connection.run_sync(migrate)
            assert await connection.scalar(text("SELECT count(*) FROM websites")) == 1
            await connection.run_sync(lambda sync: migrate(sync, "0008_admin_grants", downgrade=True))
            assert "websites" not in await connection.run_sync(lambda sync: inspect(sync).get_table_names())
            for table, before in snapshots.items():
                assert [dict(row) for row in (await connection.execute(text("SELECT * FROM " + table))).mappings()] == before
            await connection.run_sync(migrate)
            assert await connection.scalar(text("SELECT count(*) FROM websites")) == 0
    finally:
        await database.dispose()


async def test_startup_requires_website_revision_without_creating_schema(isolated_postgres_url):
    database = Database(isolated_postgres_url)
    try:
        async with database.engine.begin() as connection:
            await connection.run_sync(migrate, "0008_admin_grants")
        settings = Config(_env_file=None, DATABASE_URL=isolated_postgres_url.render_as_string(hide_password=False))
        with pytest.raises(RuntimeError, match="run alembic upgrade head"):
            with TestClient(create_app(settings)):
                pass
        async with database.engine.begin() as connection:
            assert "websites" not in await connection.run_sync(lambda sync: inspect(sync).get_table_names())
    finally:
        await database.dispose()
