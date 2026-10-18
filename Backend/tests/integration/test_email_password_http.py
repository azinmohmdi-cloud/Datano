import bcrypt
import pytest
from tests.support.browser_client import BrowserClient as TestClient

from app.domain.entities import UserEntity
from app.infra.core.config import Config
from app.infra.repositories.postgres.user_repository import SQLUserRepository
from app.infra.services.password_service import Argon2PasswordService
from app.main import create_app
from tests.postgres import isolated_postgres_url, persistent_database


def application(url):
    return create_app(Config(_env_file=None, DATABASE_URL=url.render_as_string(hide_password=False)))


async def save_legacy(database, password="Secret123", *, active=True, stored=None):
    user = UserEntity.create(first_name="Legacy", last_name="User", email="Legacy@Example.TEST", username="legacy",
        hashed_password=stored if stored is not None else bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=4)).decode())
    if active:
        user.activate()
    async with database.transaction() as session:
        await SQLUserRepository(session).create(user)
    return user


async def test_email_login_upgrades_legacy_hash_and_survives_new_app(persistent_database, isolated_postgres_url, caplog):
    user = await save_legacy(persistent_database)
    with TestClient(application(isolated_postgres_url)) as client:
        response = client.post("/api/auth/login", json={"email":" \u2003LEGACY@example.test\u00a0", "password":"Secret123"})
        assert response.status_code == 200
        assert set(response.json()["payload"]) == {"user", "effective_role", "csrf_token"}
        assert "HttpOnly" in response.headers["set-cookie"]
        headers = {"Cookie":"__Host-datano_session=" + client.cookies["__Host-datano_session"]}
        current = client.get("/api/auth/me", headers=headers)
        assert current.status_code == 200
        assert "hashed_password" not in current.text and "email_key" not in current.text
    async with persistent_database.transaction() as session:
        saved = await SQLUserRepository(session).get_by_id(user.id)
        assert saved.hashed_password.startswith("$argon2id$")
        assert saved.updated_at == user.updated_at and saved.email == user.email
        upgraded_hash = saved.hashed_password
    with TestClient(application(isolated_postgres_url)) as client:
        assert client.post("/api/auth/login", json={"email":"legacy@example.test", "password":"Secret123"}).status_code == 200
    async with persistent_database.transaction() as session:
        assert (await SQLUserRepository(session).get_by_id(user.id)).hashed_password == upgraded_hash
    assert "Secret123" not in caplog.text and upgraded_hash not in caplog.text


@pytest.mark.parametrize("password,active,stored,code", [
    ("wrong", True, None, "CREDENTIALS_VALIDATION_ERROR"),
    ("Secret123", False, None, "INACTIVE_USER"),
    ("Secret123", True, "$argon2id$broken", "CREDENTIALS_VALIDATION_ERROR"),
    ("x" * 73, True, None, "PASSWORD_RESET_REQUIRED"),
    ("ف" * 37, True, None, "PASSWORD_RESET_REQUIRED"),
])
async def test_failed_login_does_not_change_legacy_hash_or_set_cookie(persistent_database, isolated_postgres_url, password, active, stored, code, caplog):
    user = await save_legacy(persistent_database, active=active, stored=stored)
    with TestClient(application(isolated_postgres_url)) as client:
        response = client.post("/api/auth/login", json={"email":"legacy@example.test", "password":password})
        assert response.status_code == 401
        assert response.json()["payload"]["error_code"] == code
        assert "set-cookie" not in response.headers
        assert password not in response.text and password not in caplog.text
    async with persistent_database.transaction() as session:
        assert (await SQLUserRepository(session).get_by_id(user.id)).hashed_password == user.hashed_password


@pytest.mark.parametrize("password", ["x" * 72, "ف" * 36])
async def test_bcrypt_exact_byte_boundary_upgrades_via_http(persistent_database, isolated_postgres_url, password):
    user = await save_legacy(persistent_database, password)
    with TestClient(application(isolated_postgres_url)) as client:
        assert client.post("/api/auth/login", json={"email":user.email, "password":password}).status_code == 200
    async with persistent_database.transaction() as session:
        saved = await SQLUserRepository(session).get_by_id(user.id)
        assert saved.hashed_password.startswith("$argon2id$")
        assert Argon2PasswordService().verify(password, saved.hashed_password)


def test_create_without_username_and_canonical_conflict(test_client, admin_auth):
    body = {"first_name":"Email", "last_name":"Identity", "email":"  First.Last+Tag@Example.TEST  ", "password":" رمز فارسی با فاصله "}
    result = test_client.post("/api/users/", headers=admin_auth, json=body)
    assert result.status_code == 200
    public = result.json()["payload"]
    assert public["email"] == body["email"].strip()
    assert "password" not in public and "hashed_password" not in public and "email_key" not in public
    assert test_client.post("/api/users/", headers=admin_auth, json={**body,"email":"first.last+tag@EXAMPLE.test"}).status_code == 409
    # Activation/public registration belongs to BE-006; existing creation remains protected/inactive.
    assert public["is_active"] is False
    assert test_client.post("/api/users/", headers={"Cookie":""}, json=body).status_code == 401


@pytest.mark.parametrize("password", ["x" * 14, "x" * 129, "😀" * 14])
def test_new_password_policy_errors_do_not_echo_secrets(test_client, admin_auth, password, caplog):
    response = test_client.post("/api/users/", headers=admin_auth, json={"first_name":"Length", "last_name":"Test", "email":"length@example.test", "password":password})
    assert response.status_code == 422
    assert response.json()["payload"]["details"]["field"] == "password"
    assert password not in response.text and password not in caplog.text


@pytest.mark.parametrize("identifiers", [{}, {"email":"person@example.test", "username":"person"}])
def test_login_requires_exactly_one_identifier_without_echoing_password(test_client, identifiers):
    password = "Sensitive fixture password!"
    response = test_client.post("/api/auth/login", json={**identifiers,"password":password})
    assert response.status_code == 422
    assert password not in response.text


def test_credential_structure_validation_does_not_echo_secret_input(test_client, admin_auth):
    password = "Sensitive fixture password!"
    response = test_client.post("/api/users/", headers=admin_auth, json={"last_name":"Test", "email":"shape@example.test", "password":password})
    assert response.status_code == 422 and password not in response.text
    response = test_client.post("/api/auth/login", json={"email":"shape@example.test", "password":[password]})
    assert response.status_code == 422 and password not in response.text


def test_openapi_email_identity_contract(test_client):
    schema = test_client.get("/openapi.json").json()["components"]["schemas"]
    for name in ("User", "UserCreate", "UserLogin"):
        assert "username" not in schema[name].get("required", [])
        assert schema[name]["properties"]["username"]["deprecated"] is True
    assert "email" in schema["UserLogin"]["properties"]
    for name in ("UserCreate", "UserLogin"):
        assert schema[name]["properties"]["password"]["writeOnly"] is True
    for name in ("User", "UserCreate", "UserLogin"):
        assert "email_key" not in schema[name]["properties"]


async def test_persistent_creation_without_username_and_full_unicode_login(persistent_database, isolated_postgres_url):
    from app.domain.entities import RoleEntity
    from app.infra.repositories.postgres.role_repository import SQLRoleRepository
    from app.infra.utils.auth.permission import Permission

    actor = await save_legacy(persistent_database)
    async with persistent_database.transaction() as session:
        role = await SQLRoleRepository(session).create(RoleEntity.create("Test actor", permission_ids=[Permission.Super_User.value]))
        await SQLUserRepository(session).assign_role(actor.id, role.id)
    password = "😀" * 128
    with TestClient(application(isolated_postgres_url)) as client:
        login = client.post("/api/auth/login", json={"email":actor.email,"password":"Secret123"})
        headers = {"Cookie":"__Host-datano_session=" + client.cookies["__Host-datano_session"]}
        response = client.post("/api/users/", headers=headers, json={"first_name":"Unicode", "last_name":"User", "email":"  NEW+Tag@Example.TEST  ", "password":password})
        assert response.status_code == 200
        identifier = response.json()["payload"]["id"]
        assert response.json()["payload"]["email"] == "NEW+Tag@Example.TEST"
        assert client.put(f"/api/users/{identifier}", headers=headers, json={"is_active":True}).status_code == 200
    with TestClient(application(isolated_postgres_url)) as client:
        response = client.post("/api/auth/login", json={"email":" new+TAG@example.test ","password":password})
        assert response.status_code == 200
        headers = {"Cookie":"__Host-datano_session=" + client.cookies["__Host-datano_session"]}
        assert client.get("/api/auth/me", headers=headers).json()["payload"]["id"] == identifier
        assert client.post("/api/auth/login", json={"email":"new+tag@example.test","password":"😀" * 18}).status_code == 401
    async with persistent_database.transaction() as session:
        saved = await SQLUserRepository(session).get_by_id(identifier)
        assert saved.hashed_password.startswith("$argon2id$")
        assert 3 <= len(saved.username) <= 50
