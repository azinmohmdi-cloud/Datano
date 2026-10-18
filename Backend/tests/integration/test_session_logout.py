from http.cookies import SimpleCookie
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.application.use_cases.auth.session_service import SessionService
from app.domain.entities import UserEntity
from app.infra.core.config import Config
from app.infra.repositories.postgres.session_repository import SQLSessionRepository
from app.infra.repositories.postgres.user_repository import SQLUserRepository
from app.infra.services import Argon2PasswordService, JoseTokenService
from app.infra.services.session_token_service import OpaqueSessionTokens
from app.main import create_app
from tests.postgres import isolated_postgres_url, persistent_database

ORIGIN = "https://datano.test"
KEY = "logout-test-only-csrf-key-not-for-deployment-0001"
COOKIE = "__Host-datano_session"
CSRF_COOKIE = "__Host-datano_csrf"
PASSWORD = "Logout fixture password 123!"


@pytest.fixture
async def logout_app(persistent_database, isolated_postgres_url):
    return create_app(Config(_env_file=None, PUBLIC_ORIGIN=ORIGIN, CSRF_SECRET_KEY=KEY,
        DATABASE_URL=isolated_postgres_url.render_as_string(hide_password=False)))


@pytest.fixture
async def logout_actor(persistent_database):
    user = UserEntity.create(first_name="Logout", last_name="Owner", email="logout@example.test",
        username="logout-owner", hashed_password=Argon2PasswordService().hash(PASSWORD))
    user.activate()
    async with persistent_database.transaction() as session:
        await SQLUserRepository(session).create(user)
        issued = await SessionService(SQLSessionRepository(session), OpaqueSessionTokens()).issue(user.id)
    return user, issued


def csrf_headers(client):
    response = client.get("/api/auth/csrf")
    assert response.status_code == 200
    return {"Origin": client.app.state.settings.public_origin,
        "X-CSRF-Token": response.json()["payload"]["csrf_token"]}


@pytest.mark.parametrize("remember", [False, True])
@pytest.mark.parametrize("local_http", [False, True])
async def test_logout_revokes_current_session_and_clears_matching_cookie(
    logout_app, logout_actor, persistent_database, remember, local_http, caplog,
):
    origin = "http://localhost:8000" if local_http else ORIGIN
    settings = logout_app.state.settings.model_copy(update={
        "public_origin": origin, "session_allow_insecure_local_http": local_http})
    application = create_app(settings)
    cookie_name = "datano_session_dev" if local_http else COOKIE
    csrf_cookie = "datano_csrf_dev" if local_http else CSRF_COOKIE
    with TestClient(application, base_url=origin) as client:
        response = client.post("/api/auth/login", headers=csrf_headers(client), json={
            "email": logout_actor[0].email, "password": PASSWORD, "remember_me": remember})
        assert response.status_code == 200
        token = client.cookies[cookie_name]
        nonce = client.cookies[csrf_cookie]
        headers = {"Origin": origin, "X-CSRF-Token": response.json()["payload"]["csrf_token"]}
        response = client.post("/api/auth/logout", headers=headers)
        assert response.status_code == 200
        assert response.json() == {"success": True, "message": "Logged out successfully", "payload": None}
        assert response.headers["cache-control"] == "no-store"
        assert cookie_name not in client.cookies and csrf_cookie not in client.cookies
        cookies = SimpleCookie()
        for value in response.headers.get_list("set-cookie"):
            cookies.load(value)
        for name in (cookie_name, csrf_cookie):
            cookie = cookies[name]
            assert cookie["max-age"] == "0" and cookie["expires"]
            assert cookie["httponly"] and bool(cookie["secure"]) is (not local_http)
            assert cookie["samesite"].lower() == "lax" and cookie["path"] == "/"
            assert not cookie["domain"]
        assert token not in response.text and nonce not in response.text
        assert token not in caplog.text and nonce not in caplog.text
        assert client.get("/api/auth/me").status_code == 401
    async with persistent_database.transaction() as session:
        row = (await session.execute(text("SELECT revoked_at, last_seen_at FROM auth_sessions WHERE digest=:digest"),
            {"digest": OpaqueSessionTokens().digest(token)})).one()
        assert row.revoked_at is not None and row.revoked_at >= row.last_seen_at
    # A fresh application rejects the captured credential, independently of its jar.
    with TestClient(create_app(settings), base_url=origin) as client:
        replay = {"Cookie": f"{cookie_name}={token}; {csrf_cookie}={nonce}"}
        for path in ("/api/auth/me", "/api/users/", "/api/roles/", "/api/auth/permissions"):
            assert client.get(path, headers=replay).status_code == 401
        replay.update(headers)
        assert client.post("/api/roles/", headers=replay, json={"name": "Revoked writer"}).status_code == 401
    for path in Path("logs").glob("*.log"):
        assert token not in path.read_text() and nonce not in path.read_text()


async def test_logout_leaves_other_sessions_and_users_usable(logout_app, logout_actor, persistent_database):
    user, current = logout_actor
    other_user = UserEntity.create(first_name="Other", last_name="Owner", email="other-logout@example.test",
        username="other-logout", hashed_password="unused-test-hash")
    other_user.activate()
    async with persistent_database.transaction() as session:
        await SQLUserRepository(session).create(other_user)
        sessions = SessionService(SQLSessionRepository(session), OpaqueSessionTokens())
        same_account = await sessions.issue(user.id)
        different_account = await sessions.issue(other_user.id)
    with TestClient(logout_app, base_url=ORIGIN) as client:
        client.cookies.set(COOKIE, current.token)
        response = client.post("/api/auth/logout", headers=csrf_headers(client), json={
            "session_token": different_account.token, "user_id": other_user.id, "all_sessions": True})
        assert response.status_code == 200
        for issued in (same_account, different_account):
            assert client.get("/api/auth/me", headers={"Cookie": f"{COOKIE}={issued.token}"}).status_code == 200
        assert client.get("/api/auth/me", headers={"Cookie": f"{COOKIE}={current.token}"}).status_code == 401


@pytest.mark.parametrize("state", ["absent", "empty", "malformed", "unknown", "expired", "revoked", "inactive"])
async def test_logout_is_idempotent_and_does_not_require_active_identity(
    logout_app, logout_actor, persistent_database, state,
):
    user, issued = logout_actor
    token = {"absent": None, "empty": "", "malformed": "malformed-cookie", "unknown": "X" * 43}.get(state, issued.token)
    async with persistent_database.transaction() as session:
        if state == "expired":
            await session.execute(text("""UPDATE auth_sessions SET created_at=created_at-interval '1 hour',
                last_seen_at=last_seen_at-interval '1 hour', idle_expires_at=idle_expires_at-interval '1 hour'
                WHERE digest=:digest"""), {"digest": OpaqueSessionTokens().digest(token)})
        elif state == "revoked":
            await SessionService(SQLSessionRepository(session), OpaqueSessionTokens()).revoke(token)
        elif state == "inactive":
            user.deactivate()
            await SQLUserRepository(session).update(user)
    with TestClient(logout_app, base_url=ORIGIN) as client:
        if token is not None:
            client.cookies.set(COOKIE, token, domain="datano.test", path="/")
        headers = csrf_headers(client)
        raw_cookie = f"{COOKIE}={token}; {CSRF_COOKIE}={client.cookies[CSRF_COOKIE]}" if token is not None else f"{CSRF_COOKIE}={client.cookies[CSRF_COOKIE]}"
        response = client.post("/api/auth/logout", headers=headers)
        assert response.status_code == 200 and response.json()["success"] is True
        assert COOKIE not in client.cookies and CSRF_COOKIE not in client.cookies
        # An identical network retry remains safe even after server revocation.
        assert client.post("/api/auth/logout", headers={**headers, "Cookie": raw_cookie}).status_code == 200


@pytest.mark.parametrize("bad", ["missing-origin", "foreign-origin", "missing-token", "forged-token"])
async def test_csrf_rejection_never_revokes_or_clears_cookies(logout_app, logout_actor, persistent_database, bad):
    with TestClient(logout_app, base_url=ORIGIN) as client:
        client.cookies.set(COOKIE, logout_actor[1].token)
        headers = csrf_headers(client)
        if bad == "missing-origin":
            headers.pop("Origin")
        elif bad == "foreign-origin":
            headers["Origin"] = "https://evil.test"
        elif bad == "missing-token":
            headers.pop("X-CSRF-Token")
        else:
            headers["X-CSRF-Token"] = "X" * 43
        response = client.post("/api/auth/logout", headers=headers)
        assert response.status_code == 403 and "set-cookie" not in response.headers
        assert client.get("/api/auth/me").status_code == 200
    async with persistent_database.transaction() as session:
        assert await SessionService(SQLSessionRepository(session), OpaqueSessionTokens()).resolve(logout_actor[1].token, touch=False) is not None


async def test_legacy_credentials_cannot_select_a_session_to_revoke(logout_app, logout_actor):
    user, issued = logout_actor
    with TestClient(logout_app, base_url=ORIGIN) as client:
        client.cookies.set("refresh_token", "legacy-refresh", domain="datano.test", path="/")
        headers = csrf_headers(client)
        headers["Authorization"] = "Bearer " + JoseTokenService().generate_access_token({"sub": user.id, "username": user.username})
        assert client.post("/api/auth/logout", headers=headers).status_code == 200
        assert "refresh_token" not in client.cookies and COOKIE not in client.cookies
        assert client.get("/api/auth/me").status_code == 401
        assert client.get("/api/auth/me", headers={"Cookie": f"{COOKIE}={issued.token}"}).status_code == 200


@pytest.mark.parametrize("status", [503, 500])
async def test_failed_transaction_keeps_cookie_and_rolls_back_revocation(logout_app, logout_actor, persistent_database, status):
    from fastapi import Request
    from app.domain.error.exceptions import ServiceUnavailableException
    from app.interface.dependencies.database_dependencies import get_database_session

    async def fail_before_commit(request: Request):
        async with request.app.state.database.transaction() as session:
            yield session
            # The handler has written its cookie headers, but the transaction
            # must still finish before any successful response reaches the client.
            if status == 503:
                raise ServiceUnavailableException("Logout is temporarily unavailable")
            raise RuntimeError("Injected transaction finalization failure")

    logout_app.dependency_overrides[get_database_session] = fail_before_commit
    with TestClient(logout_app, base_url=ORIGIN, raise_server_exceptions=False) as client:
        client.cookies.set(COOKIE, logout_actor[1].token)
        response = client.post("/api/auth/logout", headers=csrf_headers(client))
        assert response.status_code == status and response.json()["success"] is False
        assert "set-cookie" not in response.headers
        assert client.cookies[COOKIE] == logout_actor[1].token
        assert logout_actor[1].token not in response.text
    async with persistent_database.transaction() as session:
        assert await SessionService(SQLSessionRepository(session), OpaqueSessionTokens()).resolve(logout_actor[1].token, touch=False) is not None


async def test_concurrent_logout_retries_are_idempotent(logout_app, logout_actor):
    import asyncio
    from concurrent.futures import ThreadPoolExecutor
    from threading import Barrier

    with TestClient(logout_app, base_url=ORIGIN) as client:
        client.cookies.set(COOKIE, logout_actor[1].token)
        headers = csrf_headers(client)
        headers["Cookie"] = f"{COOKIE}={logout_actor[1].token}; {CSRF_COOKIE}={client.cookies[CSRF_COOKIE]}"
        barrier = Barrier(2)

        def submit():
            barrier.wait(timeout=10)
            return client.post("/api/auth/logout", headers=headers)

        def run():
            with ThreadPoolExecutor(max_workers=2) as executor:
                futures = [executor.submit(submit) for _ in range(2)]
                return [future.result(timeout=20) for future in futures]

        responses = await asyncio.to_thread(run)
        assert [response.status_code for response in responses] == [200, 200]
        assert all(response.json()["success"] for response in responses)
        assert client.get("/api/auth/me", headers={"Cookie": headers["Cookie"]}).status_code == 401


async def test_logout_allows_fresh_bootstrap_and_login(logout_app, logout_actor):
    with TestClient(logout_app, base_url=ORIGIN) as client:
        client.cookies.set(COOKIE, logout_actor[1].token, domain="datano.test", path="/")
        old_headers = csrf_headers(client)
        assert client.post("/api/auth/logout", headers=old_headers).status_code == 200
        assert client.post("/api/auth/login", headers=old_headers, json={
            "email": logout_actor[0].email, "password": PASSWORD}).status_code == 403
        fresh_headers = csrf_headers(client)
        assert fresh_headers["X-CSRF-Token"] != old_headers["X-CSRF-Token"]
        response = client.post("/api/auth/login", headers=fresh_headers, json={
            "email": logout_actor[0].email, "password": PASSWORD})
        assert response.status_code == 200 and client.cookies[COOKIE] != logout_actor[1].token
        assert client.get("/api/auth/me").status_code == 200
        assert client.get("/api/auth/me", headers={"Cookie": f"{COOKIE}={logout_actor[1].token}"}).status_code == 401
