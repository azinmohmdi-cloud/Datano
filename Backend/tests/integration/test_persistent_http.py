from fastapi.testclient import TestClient
from fastapi_pagination import Params
from pydantic import SecretStr

from app.infra.core.config import config
from app.infra.repositories.postgres.role_repository import SQLRoleRepository
from app.infra.repositories.postgres.user_repository import SQLUserRepository
from app.main import app
from tests.postgres import isolated_postgres_url, persistent_database


async def test_normal_lifespan_uses_database_and_never_seeds_a_password(persistent_database, isolated_postgres_url, monkeypatch):
    monkeypatch.setattr(config, "database_url", SecretStr(isolated_postgres_url.render_as_string(hide_password=False)))
    with TestClient(app) as client:
        assert client.get("/api/ping").status_code == 200
        async with persistent_database.transaction() as session:
            roles = await SQLRoleRepository(session).get_all(Params())
            assert {role.name for role in roles.items} == {"Admin", "User"}
            assert (await SQLUserRepository(session).get_all(Params())).items == []


async def test_http_records_survive_a_real_application_process_restart(persistent_database, isolated_postgres_url):
    import json
    import os
    from pathlib import Path
    import subprocess
    import sys

    environment = {**os.environ, "DATANO_TEST_DATABASE_URL":isolated_postgres_url.render_as_string(hide_password=False)}
    command = [sys.executable, "-m", "tests.support.persistence_worker"]
    first = subprocess.run([*command, "write"], cwd=Path(__file__).resolve().parents[2], env=environment,
        text=True, capture_output=True, timeout=30)
    assert first.returncode == 0, first.stderr
    manifest = json.loads(first.stdout)
    second = subprocess.run([*command, "read"], cwd=Path(__file__).resolve().parents[2],
        env={**environment,"DATANO_TEST_EXPECTED_RECORDS":json.dumps(manifest)}, text=True, capture_output=True, timeout=30)
    assert second.returncode == 0, second.stderr
    assert json.loads(second.stdout) == manifest


async def test_startup_keeps_existing_role_ids_and_permissions(persistent_database, isolated_postgres_url):
    from app.infra.core.config import Config
    from app.main import create_app

    settings = Config(_env_file=None, DATABASE_URL=isolated_postgres_url.render_as_string(hide_password=False))
    with TestClient(create_app(settings)):
        pass
    async with persistent_database.transaction() as session:
        repo = SQLRoleRepository(session)
        admin = await repo.get_by_name("Admin")
        original_id, original_created = admin.id, admin.created_at
        admin.update_info(is_active=False, permission_ids=[])
        await repo.update(admin)
    with TestClient(create_app(settings)):
        pass
    async with persistent_database.transaction() as session:
        roles = await SQLRoleRepository(session).get_all(Params())
        assert {role.name for role in roles.items} == {"Admin", "User"}
        reloaded = next(role for role in roles.items if role.name == "Admin")
        assert reloaded.id == original_id and reloaded.created_at == original_created
        assert reloaded.permission_ids == [] and reloaded.is_active is False


def test_startup_requires_database_configuration():
    import pytest
    from app.infra.core.config import Config
    from app.main import create_app

    settings = Config(_env_file=None, DATABASE_URL=None)
    with pytest.raises(ValueError, match="DATABASE_URL is required"):
        with TestClient(create_app(settings)):
            pass


async def test_startup_requires_explicit_migrations(isolated_postgres_url):
    import pytest
    from app.infra.core.config import Config
    from app.main import create_app

    application = create_app(Config(_env_file=None, DATABASE_URL=isolated_postgres_url.render_as_string(hide_password=False)))
    with pytest.raises(RuntimeError, match="run alembic upgrade head"):
        with TestClient(application):
            pass
    assert not hasattr(application.state, "database")


async def test_http_repositories_share_transaction_and_rollback(persistent_database, isolated_postgres_url):
    from fastapi import Depends
    from app.domain.entities import RoleEntity, UserEntity
    from app.domain.error.exceptions import ConflictException
    from app.infra.core.config import Config
    from app.interface.dependencies.user_dependencies import get_user_repository
    from app.interface.dependencies.role_dependencies import get_role_repository
    from app.main import create_app

    person = UserEntity.create(first_name="Atomic", last_name="Test", email="atomic@example.test", username="atomic", hashed_password="test-hash")
    role = RoleEntity.create("Atomic role")
    application = create_app(Config(_env_file=None, DATABASE_URL=isolated_postgres_url.render_as_string(hide_password=False)))
    sessions = []

    @application.post("/__tests/atomic")
    async def fail_operation(users=Depends(get_user_repository), roles=Depends(get_role_repository)):
        assert users.session is roles.session
        sessions.append(users.session)
        await users.create(person)
        await roles.create(role)
        await users.assign_role(person.id, role.id)
        raise ConflictException("Intentional test rollback")

    with TestClient(application) as client:
        assert client.post("/__tests/atomic").status_code == 409
        assert not sessions[0].in_transaction()
    async with persistent_database.transaction() as session:
        assert await SQLUserRepository(session).get_by_id(person.id) is None
        assert await SQLRoleRepository(session).get_by_id(role.id) is None
