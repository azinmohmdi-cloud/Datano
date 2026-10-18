import json
from datetime import UTC, datetime

import pytest
from tests.support.browser_client import BrowserClient as TestClient
from sqlalchemy import func, select

from app.infra.core.config import Config
from app.infra.database.models import UserRow
from app.infra.repositories.postgres.user_repository import SQLUserRepository
from app.infra.repositories.postgres.role_repository import SQLRoleRepository
from app.main import create_app
from tests.postgres import isolated_postgres_url, persistent_database

PASSWORD = " رمز ثبت نام فارسی ۱۲۳ "
BODY = {"first_name": "کاربر", "last_name": "نمونه", "email": "  New+Tag@Example.TEST  ", "password": PASSWORD}


@pytest.fixture
def fixed_registration_window(monkeypatch):
    """Keep quota assertions independent of a wall-clock window boundary.

    Dependency wiring and all SQL remain real; only these tests' clock is fixed.
    Other HTTP tests exercise the normal PostgreSQL clock.
    """
    from app.interface.dependencies import registration_dependencies
    from app.infra.services.registration_limiter import PostgresRegistrationLimiter

    def limiter(database, *, limit, window_seconds):
        return PostgresRegistrationLimiter(database, limit=limit, window_seconds=window_seconds,
            clock=lambda:datetime(2026, 10, 18, 0, 0, 1, tzinfo=UTC))

    monkeypatch.setattr(registration_dependencies, "PostgresRegistrationLimiter", limiter)


def application(url):
    return create_app(Config(_env_file=None, DATABASE_URL=url.render_as_string(hide_password=False)))


async def test_public_registration_creates_active_user_and_survives_restart(persistent_database, isolated_postgres_url, caplog):
    with TestClient(application(isolated_postgres_url)) as client:
        response = client.post("/api/auth/register", json=BODY)
        assert response.status_code == 201
        assert response.json()["success"] is True
        user = response.json()["payload"]
        assert user["is_active"] is True and user["email"] == BODY["email"].strip()
        assert [role["name"] for role in user["roles"]] == ["User"]
        assert "set-cookie" not in response.headers
        for secret in (PASSWORD, "hashed_password", "email_key", "access_token", "refresh_token"):
            assert secret not in response.text
    async with persistent_database.transaction() as session:
        saved = await SQLUserRepository(session).get_by_id(user["id"])
        assert saved.is_active and saved.hashed_password.startswith("$argon2id$")
        assert [role.name for role in saved.roles] == ["User"]
        assert saved.roles[0].permission_ids == []
    with TestClient(application(isolated_postgres_url)) as client:
        response = client.post("/api/auth/login", json={"email":" new+TAG@example.test ","password":PASSWORD})
        assert response.status_code == 200
        headers = {"Cookie":"__Host-datano_session=" + client.cookies["__Host-datano_session"]}
        assert client.get("/api/auth/me", headers=headers).json()["payload"]["id"] == user["id"]
        assert client.get("/api/users/", headers=headers).status_code == 403
    assert PASSWORD not in caplog.text


@pytest.mark.parametrize("extra", [
    {"role":"Admin"}, {"roles":["Admin"]}, {"role_ids":["admin"]},
    {"permission_ids":["super:user"]}, {"is_active":False}, {"username":"admin"},
    {"id":"chosen-id"}, {"hashed_password":"attacker-controlled-hash"},
])
async def test_privilege_and_identity_fields_are_rejected(persistent_database, isolated_postgres_url, extra):
    with TestClient(application(isolated_postgres_url)) as client:
        response = client.post("/api/auth/register", json={**BODY,**extra})
        assert response.status_code == 422 and PASSWORD not in response.text
    async with persistent_database.transaction() as session:
        assert await SQLUserRepository(session).get_by_email(BODY["email"]) is None


async def test_duplicate_email_is_canonical_and_does_not_create_a_second_account(persistent_database, isolated_postgres_url):
    with TestClient(application(isolated_postgres_url)) as client:
        first = client.post("/api/auth/register", json=BODY)
        assert first.status_code == 201
        second = client.post("/api/auth/register", json={**BODY,"email":"\u2003new+TAG@example.test\u00a0"})
        assert second.status_code == 409
        assert second.json()["payload"]["error_code"] == "CONFLICT"
        assert PASSWORD not in second.text
    async with persistent_database.transaction() as session:
        assert await session.scalar(select(func.count()).select_from(UserRow).where(UserRow.email_key == "new+tag@example.test")) == 1
        assert (await SQLUserRepository(session).get_by_email(BODY["email"])).id == first.json()["payload"]["id"]


@pytest.mark.parametrize("changes", [
    {"password":"x" * 14}, {"password":"x" * 129}, {"password":"😀" * 14},
    {"password":"\ud800" * 15}, {"first_name":" \u2003 "}, {"last_name":"\t\n"}, {"email":"not-an-email"},
])
async def test_invalid_registration_does_not_persist_a_user(persistent_database, isolated_postgres_url, changes):
    with TestClient(application(isolated_postgres_url)) as client:
        response = client.post("/api/auth/register", content=json.dumps({**BODY,**changes}), headers={"content-type":"application/json"})
        assert response.status_code == 422
        assert PASSWORD not in response.text
    async with persistent_database.transaction() as session:
        assert await SQLUserRepository(session).get_by_email(BODY["email"]) is None


async def test_structural_validation_never_echoes_credential_body(persistent_database, isolated_postgres_url):
    with TestClient(application(isolated_postgres_url)) as client:
        for body in ({"email":BODY["email"],"password":PASSWORD}, {**BODY,"password":[PASSWORD]}):
            response = client.post("/api/auth/register", json=body)
            assert response.status_code == 422 and PASSWORD not in response.text


async def test_invalid_attempts_are_throttled_before_password_hashing(persistent_database, isolated_postgres_url, fixed_registration_window):
    from app.interface.dependencies.user_dependencies import get_password_service

    class NoHashing:
        def hash(self, password):
            pytest.fail("A rejected/throttled request must not hash a password")

    app = application(isolated_postgres_url)
    app.dependency_overrides[get_password_service] = NoHashing
    with TestClient(app) as client:
        for _ in range(5):
            assert client.post("/api/auth/register", json={**BODY,"password":"short"}).status_code == 422
        response = client.post("/api/auth/register", json=BODY)
        assert response.status_code == 429
        assert 1 <= int(response.headers["retry-after"]) <= 600
        assert response.json()["payload"]["error_code"] == "RATE_LIMITED"
        # Unrelated routes remain usable while this peer is throttled.
        assert client.get("/api/ping").status_code == 200
    async with persistent_database.transaction() as session:
        assert await SQLUserRepository(session).get_by_email(BODY["email"]) is None


async def test_throttle_survives_new_app_and_ignores_forwarded_headers(persistent_database, isolated_postgres_url, fixed_registration_window):
    with TestClient(application(isolated_postgres_url)) as client:
        for _ in range(5):
            assert client.post("/api/auth/register", json={**BODY,"password":"short"}).status_code == 422
    with TestClient(application(isolated_postgres_url)) as client:
        response = client.post("/api/auth/register", json=BODY, headers={"x-forwarded-for":"198.51.100.99", "forwarded":"for=198.51.100.99", "x-real-ip":"198.51.100.99"})
        assert response.status_code == 429


async def test_malformed_json_counts_towards_registration_limit(persistent_database, isolated_postgres_url, fixed_registration_window):
    with TestClient(application(isolated_postgres_url)) as client:
        for _ in range(5):
            response = client.post("/api/auth/register", content='{"password":"Sensitive fixture password!",', headers={"content-type":"application/json"})
            assert response.status_code == 422 and "Sensitive fixture password!" not in response.text
        assert client.post("/api/auth/register", json=BODY).status_code == 429


@pytest.mark.parametrize("chunked", [False, True])
async def test_registration_body_is_bounded_before_json_processing(persistent_database, isolated_postgres_url, chunked):
    with TestClient(application(isolated_postgres_url)) as client:
        data = b"x" * 8193
        content = iter([data[:4096], data[4096:]]) if chunked else data
        response = client.post("/api/auth/register", content=content, headers={"content-type":"application/json"})
        assert response.status_code == 413
        assert "x" * 100 not in response.text


@pytest.mark.parametrize("state", ["missing", "inactive"])
async def test_missing_or_inactive_default_role_fails_without_partial_account(persistent_database, isolated_postgres_url, state):
    with TestClient(application(isolated_postgres_url)) as client:
        async with persistent_database.transaction() as session:
            repo = SQLRoleRepository(session)
            role = await repo.get_by_name("User")
            if state == "missing":
                await repo.delete(role.id)
            else:
                role.deactivate()
                await repo.update(role)
        response = client.post("/api/auth/register", json=BODY)
        assert response.status_code == 503
    async with persistent_database.transaction() as session:
        assert await SQLUserRepository(session).get_by_email(BODY["email"]) is None


async def test_registration_openapi_is_public_and_rejects_extra_fields(persistent_database, isolated_postgres_url):
    with TestClient(application(isolated_postgres_url)) as client:
        schema = client.get("/openapi.json").json()
        operation = schema["paths"]["/api/auth/register"]["post"]
        assert not operation.get("security")
        assert "201" in operation["responses"] and "429" in operation["responses"]
        name = operation["requestBody"]["content"]["application/json"]["schema"]["$ref"].split("/")[-1]
        model = schema["components"]["schemas"][name]
        assert set(model["properties"]) == {"first_name","last_name","email","password"}
        assert model["additionalProperties"] is False
        assert model["properties"]["password"]["writeOnly"] is True


async def test_startup_rejects_missing_registration_migration(isolated_postgres_url):
    from app.infra.database.connection import Database
    from tests.postgres import migrate
    database = Database(isolated_postgres_url)
    try:
        async with database.engine.begin() as connection:
            await connection.run_sync(migrate, "0003_email_identity")
        with pytest.raises(RuntimeError, match="run alembic upgrade head"):
            with TestClient(application(isolated_postgres_url)):
                pass
    finally:
        await database.dispose()


async def test_role_assignment_failure_rolls_back_account_but_keeps_attempt(persistent_database, isolated_postgres_url):
    from fastapi import Depends
    from sqlalchemy import text
    from app.domain.error.exceptions import ConflictException
    from app.interface.dependencies.database_dependencies import get_database_session
    from app.interface.dependencies.user_dependencies import get_user_repository

    class FailingAssignment(SQLUserRepository):
        async def assign_role(self, user_id, role_id):
            await super().assign_role(user_id, role_id)
            raise ConflictException("Intentional failure after assignment")

    async def failing_repository(session=Depends(get_database_session)):
        return FailingAssignment(session)

    app = application(isolated_postgres_url)
    app.dependency_overrides[get_user_repository] = failing_repository
    with TestClient(app) as client:
        assert client.post("/api/auth/register", json=BODY).status_code == 409
    async with persistent_database.transaction() as session:
        assert await SQLUserRepository(session).get_by_email(BODY["email"]) is None
        assert await session.scalar(text("SELECT sum(attempts) FROM registration_attempts")) == 1


async def test_concurrent_canonical_duplicate_registration_has_one_winner(persistent_database, isolated_postgres_url):
    import asyncio
    from concurrent.futures import ThreadPoolExecutor

    with TestClient(application(isolated_postgres_url)) as client:
        def compete():
            with ThreadPoolExecutor(max_workers=2) as executor:
                futures = [executor.submit(client.post, "/api/auth/register", json={**BODY,"email":email})
                    for email in ("Race@Example.test", "\u2003race@EXAMPLE.test\u00a0")]
                return [future.result(timeout=15) for future in futures]
        responses = await asyncio.to_thread(compete)
        assert sorted(response.status_code for response in responses) == [201,409]
    async with persistent_database.transaction() as session:
        assert await session.scalar(select(func.count()).select_from(UserRow).where(UserRow.email_key == "race@example.test")) == 1
        user = await SQLUserRepository(session).get_by_email("race@example.test")
        assert user.is_active and [role.name for role in user.roles] == ["User"]


async def test_counter_store_failure_never_allows_registration(persistent_database, isolated_postgres_url):
    from sqlalchemy import text
    with TestClient(application(isolated_postgres_url)) as client:
        async with persistent_database.transaction() as session:
            await session.execute(text("DROP TABLE registration_attempts"))
        response = client.post("/api/auth/register", json=BODY)
        assert response.status_code == 503
        assert "registration_attempts" not in response.text and PASSWORD not in response.text
    async with persistent_database.transaction() as session:
        assert await SQLUserRepository(session).get_by_email(BODY["email"]) is None


async def test_registration_validation_redacts_password_with_proxy_root_path(persistent_database, isolated_postgres_url):
    with TestClient(application(isolated_postgres_url), root_path="/service") as client:
        response = client.post("/service/api/auth/register", json={"email":BODY["email"],"password":PASSWORD})
        assert response.status_code == 422 and PASSWORD not in response.text


async def test_registration_accepts_the_exact_body_byte_limit(persistent_database, isolated_postgres_url):
    body = json.dumps(BODY).encode("utf-8")
    body += b" " * (8192-len(body))
    with TestClient(application(isolated_postgres_url)) as client:
        response = client.post("/api/auth/register", content=body, headers={"content-type":"application/json"})
        assert response.status_code == 201
