import pytest
import base64
from dataclasses import asdict
from datetime import timedelta

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from fastapi.testclient import TestClient
from sqlalchemy import func, inspect, select, text

from app.domain.entities import UserEntity, WebsiteEntity
from app.domain.entities.integration_entity import IntegrationEntity
from app.infra.database.base import Base
from app.infra.database.bootstrap import ensure_required_roles
from app.infra.core.config import Config
from app.infra.database.connection import Database
from app.infra.database.models import IntegrationCredentialRow, IntegrationRow, WebsiteRow
from app.infra.services.integration_credentials import AESCredentialCipher
from app.infra.repositories.postgres.user_repository import SQLUserRepository
from app.main import create_app
from tests.postgres import isolated_postgres_url, migrate
from tests.integration.test_integration_persistence import cipher, sites, store, persistent_database


async def test_startup_requires_integration_revision(isolated_postgres_url):
    database = Database(isolated_postgres_url)
    try:
        async with database.engine.begin() as connection:
            await connection.run_sync(migrate, "0009_websites")
        settings = Config(_env_file=None, DATABASE_URL=isolated_postgres_url.render_as_string(hide_password=False))
        with pytest.raises(RuntimeError, match="run alembic upgrade head"):
            with TestClient(create_app(settings)):
                pass
    finally:
        await database.dispose()


async def test_upgrade_preserves_previous_data_and_downgrade_only_removes_integration_schema(isolated_postgres_url):
    database = Database(isolated_postgres_url)
    try:
        async with database.engine.begin() as connection:
            await connection.run_sync(migrate, "0009_websites")
        actor = UserEntity.create(first_name="Existing", last_name="Owner", email="prior@example.test",
            username="prior-owner", hashed_password="test-only-hash")
        async with database.transaction() as session:
            await ensure_required_roles(session)
            await SQLUserRepository(session).create(actor)
            now = await session.scalar(select(func.clock_timestamp()))
            website = WebsiteEntity.create(actor.id, "prior.example.com", now=now - timedelta(seconds=1))
            session.add(WebsiteRow(**asdict(website)))
        async with database.engine.begin() as connection:
            tables = set(await connection.run_sync(lambda sync: inspect(sync).get_table_names())) - {"alembic_version"}
            snapshots = {table: list((await connection.execute(text("SELECT * FROM " + table))).mappings()) for table in tables}
            await connection.run_sync(migrate)
            await connection.run_sync(migrate)
            assert await connection.scalar(text("SELECT version_num FROM alembic_version")) == "0010_integrations"
            assert set(await connection.run_sync(lambda sync: inspect(sync).get_table_names())) == tables | {
                "alembic_version", "integrations", "integration_credentials"}
            assert await connection.run_sync(lambda sync: compare_metadata(MigrationContext.configure(sync), Base.metadata)) == []
            for table, rows in snapshots.items():
                assert list((await connection.execute(text("SELECT * FROM " + table))).mappings()) == rows
            integration = IntegrationEntity.create(actor.id, website.id, "gsc", "prior-property", now=now)
            await connection.execute(IntegrationRow.__table__.insert().values(**asdict(integration)))
            from app.application.use_cases.integration.credentials import OAuthCredential
            encrypted = AESCredentialCipher(b"k" * 32).encrypt(OAuthCredential("test-only-refresh"), integration.credential_context())
            await connection.execute(IntegrationCredentialRow.__table__.insert().values(integration_id=integration.id, ciphertext=encrypted))
            assert await connection.scalar(text("SELECT count(*) FROM integration_credentials")) == 1
            await connection.run_sync(lambda sync: migrate(sync, "0009_websites", downgrade=True))
            assert set(await connection.run_sync(lambda sync: inspect(sync).get_table_names())) == tables | {"alembic_version"}
            for table, rows in snapshots.items():
                assert list((await connection.execute(text("SELECT * FROM " + table))).mappings()) == rows
            assert "uq_websites_id_owner" not in {item["name"] for item in await connection.run_sync(lambda sync: inspect(sync).get_unique_constraints("websites"))}
            await connection.run_sync(migrate)
            assert await connection.scalar(text("SELECT count(*) FROM integrations")) == 0
    finally:
        await database.dispose()


async def test_startup_without_key_is_allowed_only_before_credentials_exist(persistent_database, isolated_postgres_url, sites, cipher, monkeypatch):
    monkeypatch.delenv("INTEGRATION_CREDENTIAL_KEY", raising=False)
    settings = Config(_env_file=None, DATABASE_URL=isolated_postgres_url.render_as_string(hide_password=False))
    with TestClient(create_app(settings)) as client:
        assert client.get("/api/ping").status_code == 200
    await store(persistent_database, *sites[0], cipher)
    with pytest.raises(RuntimeError, match="INTEGRATION_CREDENTIAL_KEY is required"):
        with TestClient(create_app(settings)):
            pass
    configured = Config(_env_file=None, DATABASE_URL=isolated_postgres_url.render_as_string(hide_password=False),
        INTEGRATION_CREDENTIAL_KEY=base64.urlsafe_b64encode(b"k" * 32).decode())
    with TestClient(create_app(configured)) as client:
        assert client.get("/api/ping").status_code == 200


def test_malformed_configured_key_fails_before_database_connection():
    configured = Config(_env_file=None, INTEGRATION_CREDENTIAL_KEY="test-only-invalid-key")
    with pytest.raises(ValueError, match="INTEGRATION_CREDENTIAL_KEY must be") as error:
        with TestClient(create_app(configured)):
            pass
    assert "test-only-invalid-key" not in str(error.value)
