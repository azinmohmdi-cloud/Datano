"""Own-mailbox changes use real PostgreSQL and a captured private mail adapter."""
from datetime import UTC, datetime
from http.cookies import SimpleCookie
import re
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import text
from sqlalchemy.engine import make_url

from app.application.use_cases.auth.admin_policy import AdminEmailPolicy
from app.application.use_cases.auth.email import IEmailSender
from app.infra.core.config import Config
from app.infra.repositories.postgres.admin_proof_repository import PostgresAdminProofRepository
from app.infra.services import JoseTokenService
from app.infra.services.session_token_service import OpaqueSessionTokens
from app.main import create_app
from tests.postgres import isolated_postgres_url, persistent_database
from tests.support.browser_client import BrowserClient

ROOT = "/api/auth/email-change"
COOKIE = "__Host-datano_session"
EMAIL = "original@example.test"
TARGET = "eligible@example.test"
PASSWORD = "Email change fixture password!"
ACK = {"success": True, "message": "If eligible, a verification code will be sent to the new mailbox", "payload": None}


def email_change_app(url, **settings):
    defaults = dict(DATABASE_URL=url.render_as_string(hide_password=False),
        ADMIN_EMAIL_ALLOWLIST='["eligible@example.test", "private-other@example.test"]',
        EMAIL_CODE_HMAC_KEY="test-only-email-change-hmac-key-0001")
    return create_app(Config(_env_file=None, **(defaults | settings)))


def register_and_login(client, email=EMAIL, *, remember=False):
    registered = client.post("/api/auth/register", json={"first_name": "Mailbox", "last_name": "Owner",
        "email": email, "password": PASSWORD})
    assert registered.status_code == 201
    login = client.post("/api/auth/login", json={"email": email, "password": PASSWORD, "remember_me": remember})
    assert login.status_code == 200
    return registered.json()["payload"]["id"], login


def delivered_code(sender):
    message = sender.send.call_args.args[0]
    return re.search(r"[0-9]{8}", message.text).group()


@pytest.mark.parametrize("remember", [False, True])
async def test_new_mailbox_proof_precedes_change_and_rotates_all_sessions(
        persistent_database, isolated_postgres_url, remember):
    application = email_change_app(isolated_postgres_url)
    sender = AsyncMock(spec=IEmailSender)
    with BrowserClient(application) as client, BrowserClient(email_change_app(isolated_postgres_url)) as other:
        application.state.email_sender = sender
        user_id, login = register_and_login(client, remember=remember)
        previous, old_csrf = client.cookies[COOKIE], login.json()["payload"]["csrf_token"]
        assert other.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD,
            "remember_me": not remember}).status_code == 200
        other_token = other.cookies[COOKIE]
        async with persistent_database.transaction() as session:
            before = (await session.execute(text("SELECT * FROM users WHERE id=:id"), {"id": user_id})).mappings().one()
            previous_absolute = await session.scalar(text("SELECT absolute_expires_at FROM auth_sessions WHERE digest=:d"),
                {"d": OpaqueSessionTokens().digest(previous)})
        requested = client.post(ROOT + "/request", json={"email": "  ELIGIBLE@EXAMPLE.TEST  "})
        assert requested.status_code == 200 and requested.json() == ACK
        assert requested.headers["cache-control"] == "no-store"
        sender.send.assert_awaited_once()
        assert sender.send.call_args.args[0].recipient == TARGET
        code = delivered_code(sender)
        assert code not in requested.text and TARGET not in requested.text
        unchanged = client.get("/api/auth/me").json()["payload"]
        assert unchanged["email"] == EMAIL and unchanged["effective_role"] == "User"
        assert client.get("/api/users/").status_code == 403
        verified = client.post(ROOT + "/verify", json={"email": " ELIGIBLE@EXAMPLE.TEST ", "code": code})
        assert verified.status_code == 200
        payload = verified.json()["payload"]
        assert payload["user"]["id"] == user_id and payload["user"]["email"] == TARGET
        assert payload["effective_role"] == "Admin"
        fresh = client.cookies[COOKIE]
        assert fresh != previous and fresh not in verified.text and code not in verified.text
        assert payload["csrf_token"] != old_csrf
        assert verified.headers["cache-control"] == "no-store"
        cookies = SimpleCookie()
        for value in verified.headers.get_list("set-cookie"):
            cookies.load(value)
        assert cookies[COOKIE]["secure"] and cookies[COOKIE]["httponly"]
        assert cookies[COOKIE]["samesite"].lower() == "lax" and not cookies[COOKIE]["domain"]
        assert cookies[COOKIE]["path"] == "/" and bool(cookies[COOKIE]["max-age"]) is remember
        assert client.get("/api/users/").status_code == 200
        for old in (previous, other_token):
            assert client.get("/api/auth/me", headers={"Cookie": COOKIE + "=" + old}).status_code == 401
        assert client.post(ROOT + "/verify", json={"email": TARGET, "code": code},
            headers={"X-CSRF-Token": old_csrf}).status_code == 403
        assert client.post(ROOT + "/verify", json={"email": TARGET, "code": code}).status_code == 401
        async with persistent_database.transaction() as session:
            after = (await session.execute(text("SELECT * FROM users WHERE id=:id"), {"id": user_id})).mappings().one()
            preserved = set(before) - {"email", "email_key", "updated_at"}
            assert {key: after[key] for key in preserved} == {key: before[key] for key in preserved}
            assert after["email_key"] == TARGET
            assert await session.scalar(text("SELECT count(*) FROM auth_sessions WHERE user_id=:id AND revoked_at IS NULL"),
                {"id": user_id}) == 1
            assert await session.scalar(text("SELECT absolute_expires_at FROM auth_sessions WHERE digest=:d"),
                {"d": OpaqueSessionTokens().digest(fresh)}) == previous_absolute
            assert await session.scalar(text("SELECT count(*) FROM admin_grants WHERE user_id=:id AND email_key=:email AND method='email'"),
                {"id": user_id, "email": TARGET}) == 1
    with BrowserClient(email_change_app(isolated_postgres_url)) as restarted:
        identity = restarted.get("/api/auth/me", headers={"Cookie": COOKIE + "=" + fresh})
        assert identity.status_code == 200 and identity.json()["payload"]["email"] == TARGET
        assert identity.json()["payload"]["effective_role"] == "Admin"
        assert restarted.post("/api/auth/login", json={"email": EMAIL, "password": PASSWORD}).status_code == 401
        assert restarted.post("/api/auth/login", json={"email": " ELIGIBLE@EXAMPLE.TEST ", "password": PASSWORD}).status_code == 200


async def test_proved_administrator_becomes_user_after_proving_ordinary_target(persistent_database, isolated_postgres_url):
    application = email_change_app(isolated_postgres_url)
    sender = AsyncMock(spec=IEmailSender)
    with BrowserClient(application) as client:
        application.state.email_sender = sender
        user_id, _ = register_and_login(client, email=TARGET)
        assert await PostgresAdminProofRepository(persistent_database, AdminEmailPolicy.parse('["eligible@example.test"]')).provision(user_id)
        login = client.post("/api/auth/login", json={"email": TARGET, "password": PASSWORD})
        assert login.status_code == 200 and login.json()["payload"]["effective_role"] == "Admin"
        previous = client.cookies[COOKIE]
        assert client.post(ROOT + "/request", json={"email": "ordinary@example.test"}).status_code == 200
        assert client.get("/api/auth/me").json()["payload"]["effective_role"] == "Admin"
        verified = client.post(ROOT + "/verify", json={"email": "ordinary@example.test", "code": delivered_code(sender)})
        assert verified.status_code == 200 and verified.json()["payload"]["effective_role"] == "User"
        assert all(role["name"] != "Admin" for role in verified.json()["payload"]["user"]["roles"])
        assert client.cookies[COOKIE] != previous
        assert client.get("/api/users/").status_code == 403
        assert client.get("/api/auth/me", headers={"Cookie": COOKIE + "=" + previous}).status_code == 401
        async with persistent_database.transaction() as session:
            assert await session.scalar(text("SELECT count(*) FROM admin_grants WHERE user_id=:id"), {"id": user_id}) == 0


async def test_raw_admin_assignment_and_target_text_never_grant_before_proof(persistent_database, isolated_postgres_url):
    application = email_change_app(isolated_postgres_url)
    with BrowserClient(application) as client:
        application.state.email_sender = AsyncMock(spec=IEmailSender)
        user_id, _ = register_and_login(client)
        async with persistent_database.transaction() as session:
            await session.execute(text("INSERT INTO user_roles(user_id,role_id) SELECT :id,id FROM roles WHERE name='Admin'"), {"id": user_id})
        assert client.post(ROOT + "/request", json={"email": TARGET}).status_code == 200
        identity = client.get("/api/auth/me").json()["payload"]
        assert identity["email"] == EMAIL and identity["effective_role"] == "User"
        assert all(role["name"] != "Admin" for role in identity["roles"])
        assert client.post(ROOT + "/verify", json={"email": TARGET, "code": "invalid"}).status_code == 401
        assert client.get("/api/users/").status_code == 403


@pytest.mark.parametrize("target", [EMAIL, "occupied@example.test"])
async def test_current_or_occupied_target_has_generic_ack_without_delivery(persistent_database, isolated_postgres_url, target):
    application = email_change_app(isolated_postgres_url)
    sender = AsyncMock(spec=IEmailSender)
    with BrowserClient(application) as client:
        application.state.email_sender = sender
        assert client.post("/api/auth/register", json={"first_name": "Other", "last_name": "Owner",
            "email": "occupied@example.test", "password": PASSWORD}).status_code == 201
        register_and_login(client)
        response = client.post(ROOT + "/request", json={"email": target.upper()})
        assert response.status_code == 200 and response.json() == ACK
        assert response.headers["cache-control"] == "no-store"
        sender.send.assert_not_awaited()
        assert client.post(ROOT + "/verify", json={"email": target, "code": "12345678"}).status_code == 401
        assert client.get("/api/auth/me").json()["payload"]["email"] == EMAIL


@pytest.mark.parametrize("action", ["request", "verify"])
async def test_cookie_csrf_origin_and_strict_self_only_body(persistent_database, isolated_postgres_url, action):
    application = email_change_app(isolated_postgres_url)
    with BrowserClient(application) as client:
        application.state.email_sender = AsyncMock(spec=IEmailSender)
        user_id, _ = register_and_login(client)
        body = {"email": TARGET} | ({"code": "12345678"} if action == "verify" else {})
        path = ROOT + "/" + action
        assert client.post(path, json=body, headers={"X-CSRF-Token": "bad"}).status_code == 403
        assert client.post(path, json=body, headers={"Origin": "https://attacker.test"}).status_code == 403
        for extra in ({"user_id": "other-account-secret"}, {"role": "private-role-secret"}, {"is_active": False}):
            response = client.post(path, json=body | extra)
            assert response.status_code == 422
            assert TARGET not in response.text and "12345678" not in response.text
            assert "other-account-secret" not in response.text and "private-role-secret" not in response.text
        client.cookies.clear()
        bearer = JoseTokenService().generate_access_token({"sub": user_id, "username": "legacy"})
        assert client.post(path, json=body, headers={"Authorization": "Bearer " + bearer}).status_code == 401
        application.state.email_sender.send.assert_not_awaited()


@pytest.mark.parametrize("action", ["request", "verify"])
@pytest.mark.parametrize("email", [None, 42, "not-an-address-private", "secret@example.test\r\nBcc: private@example.test"])
async def test_invalid_email_is_rejected_without_echo(persistent_database, isolated_postgres_url, action, email):
    application = email_change_app(isolated_postgres_url)
    with BrowserClient(application) as client:
        application.state.email_sender = AsyncMock(spec=IEmailSender)
        register_and_login(client)
        body = {"email": email} | ({"code": "private-code-input"} if action == "verify" else {})
        response = client.post(ROOT + "/" + action, json=body)
        assert response.status_code == 422
        assert "not-an-address-private" not in response.text and "private-code-input" not in response.text
        assert "secret@example.test" not in response.text and "private@example.test" not in response.text
        application.state.email_sender.send.assert_not_awaited()


async def test_body_and_ip_limits_run_before_validation(persistent_database, isolated_postgres_url, monkeypatch):
    from app.interface import email_change_route
    from app.infra.services.registration_limiter import PostgresRegistrationLimiter
    monkeypatch.setattr(email_change_route, "PostgresRegistrationLimiter", lambda database, **settings:
        PostgresRegistrationLimiter(database, clock=lambda: datetime(2026, 10, 22, tzinfo=UTC), **settings))
    application = email_change_app(isolated_postgres_url, EMAIL_CHANGE_MAX_BODY_BYTES=80, EMAIL_CHANGE_IP_LIMIT=2)
    with BrowserClient(application) as client:
        application.state.email_sender = AsyncMock(spec=IEmailSender)
        register_and_login(client)
        assert client.post(ROOT + "/request", content="x" * 81).status_code == 413
        assert client.post(ROOT + "/verify", json={"email": TARGET, "code": "bad"}).status_code == 401
        limited = client.post(ROOT + "/request", json={"email": TARGET})
        assert limited.status_code == 429 and 1 <= int(limited.headers["retry-after"]) <= 600
        application.state.email_sender.send.assert_not_awaited()


async def test_smtp_failure_does_not_activate_proof_or_expose_provider_details(
        persistent_database, isolated_postgres_url, caplog):
    application = email_change_app(isolated_postgres_url)
    sender = AsyncMock(spec=IEmailSender)
    sender.send.side_effect = RuntimeError("private-provider-error")
    with BrowserClient(application) as client:
        application.state.email_sender = sender
        register_and_login(client)
        response = client.post(ROOT + "/request", json={"email": TARGET})
        assert response.status_code == 200 and response.json() == ACK
        code = delivered_code(sender)
        assert client.post(ROOT + "/verify", json={"email": TARGET, "code": code}).status_code == 401
        assert "private-provider-error" not in response.text + caplog.text
        assert code not in response.text + caplog.text and TARGET not in caplog.text
        identity = client.get("/api/auth/me").json()["payload"]
        assert identity["email"] == EMAIL and identity["effective_role"] == "User"


@pytest.mark.parametrize("setting", [{"EMAIL_CODE_HMAC_KEY": None}, {"SMTP_HOST": None}])
async def test_missing_private_configuration_fails_closed(persistent_database, isolated_postgres_url, setting):
    application = email_change_app(isolated_postgres_url, **setting)
    with BrowserClient(application) as client:
        register_and_login(client)
        response = client.post(ROOT + "/request", json={"email": TARGET})
        assert response.status_code == 503
        assert "private-other@example.test" not in response.text
        assert client.get("/api/auth/me").json()["payload"]["email"] == EMAIL


def test_actual_openapi_declares_only_own_email_and_proof_and_hides_private_configuration():
    schema = email_change_app(make_url("postgresql+psycopg://localhost/datano_test_schema")).openapi()
    for action, properties in [("request", {"email"}), ("verify", {"email", "code"})]:
        operation = schema["paths"][ROOT + "/" + action]["post"]
        assert {"200", "401", "413", "429", "503"} <= operation["responses"].keys()
        assert operation["security"] == [{"OpaqueSession": []}]
        reference = operation["requestBody"]["content"]["application/json"]["schema"]["$ref"]
        definition = schema["components"]["schemas"][reference.rsplit("/", 1)[1]]
        assert definition["additionalProperties"] is False
        assert set(definition["properties"]) == properties and set(definition["required"]) == properties
        for value in definition["properties"].values():
            assert value["writeOnly"] is True
    serialized = str(schema)
    assert "private-other@example.test" not in serialized and "ADMIN_EMAIL_ALLOWLIST" not in serialized
    assert "test-only-email-change-hmac-key-0001" not in serialized


async def test_target_claimed_after_request_returns_safe_conflict_and_preserves_old_identity(
        persistent_database, isolated_postgres_url, caplog):
    application = email_change_app(isolated_postgres_url)
    sender = AsyncMock(spec=IEmailSender)
    with BrowserClient(application) as client:
        application.state.email_sender = sender
        register_and_login(client)
        previous = client.cookies[COOKIE]
        assert client.post(ROOT + '/request', json={'email': TARGET}).status_code == 200
        code = delivered_code(sender)
        # The other account takes a differently spelled but canonical-equal address.
        assert client.post('/api/auth/register', json={'first_name':'Another', 'last_name':'Owner',
            'email':'ELIGIBLE@EXAMPLE.TEST', 'password':PASSWORD}).status_code == 201
        response = client.post(ROOT + '/verify', json={'email':TARGET, 'code':code})
        assert response.status_code == 409 and response.json()['success'] is False
        assert TARGET not in response.text + caplog.text and code not in response.text + caplog.text
        assert client.cookies[COOKIE] == previous
        identity = client.get('/api/auth/me').json()['payload']
        assert identity['email'] == EMAIL and identity['effective_role'] == 'User'
        assert client.post(ROOT + '/verify', json={'email':TARGET, 'code':code}).status_code == 401
