import pytest
from fastapi.testclient import TestClient

from app.domain.entities import RoleEntity, UserEntity
from app.infra.core.config import Config
from app.infra.repositories.postgres.role_repository import SQLRoleRepository
from app.infra.repositories.postgres.user_repository import SQLUserRepository
from app.infra.repositories.postgres.session_repository import SQLSessionRepository
from app.application.use_cases.auth.session_service import SessionService
from app.infra.services import Argon2PasswordService, JoseTokenService
from app.infra.services.session_token_service import OpaqueSessionTokens
from app.infra.utils.auth.permission import Permission
from app.main import create_app
from tests.postgres import isolated_postgres_url, persistent_database

ORIGIN="https://datano.test"
KEY="test-only-csrf-key-never-for-deployment-0001"
COOKIE="__Host-datano_session"
CSRF_COOKIE="__Host-datano_csrf"
PASSWORD="Security fixture password 123!"


@pytest.fixture
async def security_app(persistent_database,isolated_postgres_url,monkeypatch):
    monkeypatch.setenv("PUBLIC_ORIGIN",ORIGIN)
    monkeypatch.setenv("CSRF_SECRET_KEY",KEY)
    return create_app(Config(_env_file=None,DATABASE_URL=isolated_postgres_url.render_as_string(hide_password=False)))


@pytest.fixture
async def actor(persistent_database):
    user=UserEntity.create(first_name="Security",last_name="Actor",email="security@example.test",username="security-actor",
        hashed_password=Argon2PasswordService().hash(PASSWORD))
    user.activate()
    async with persistent_database.transaction() as session:
        users,roles=SQLUserRepository(session),SQLRoleRepository(session)
        await users.create(user)
        role=await roles.create(RoleEntity.create("Fixture super",permission_ids=[Permission.Super_User.value]))
        await users.assign_role(user.id,role.id)
        issued=await SessionService(SQLSessionRepository(session),OpaqueSessionTokens()).issue(user.id)
    return user,role,issued


def bearer(user):
    return JoseTokenService().generate_access_token({"sub":user.id,"username":user.username})


@pytest.mark.parametrize("path",["/api/auth/me","/api/users/","/api/roles/","/api/auth/permissions"])
async def test_signed_legacy_jwt_cannot_authenticate_product(security_app,actor,path):
    user,_,_=actor
    with TestClient(security_app,base_url=ORIGIN) as client:
        assert client.get(path,headers={"Authorization":"Bearer "+bearer(user)}).status_code == 401


async def test_permissions_use_live_active_roles(security_app,actor,persistent_database):
    user,role,issued=actor
    with TestClient(security_app,base_url=ORIGIN) as client:
        headers={"Cookie":f"{COOKIE}={issued.token}"}
        assert client.get("/api/users/",headers=headers).status_code == 200
        async with persistent_database.transaction() as session:
            role.deactivate()
            await SQLRoleRepository(session).update(role)
        assert client.get("/api/users/",headers=headers).status_code == 403
        assert client.get("/api/auth/me",headers=headers).status_code == 200


@pytest.mark.parametrize("origin",[None,"null","https://evil.test","https://datano.test.evil.test","http://datano.test"])
async def test_unsafe_request_requires_trusted_origin(security_app,actor,origin):
    user,_,issued=actor
    headers={"Cookie":f"{COOKIE}={issued.token}","Authorization":"Bearer "+bearer(user)}
    if origin is not None:
        headers["Origin"]=origin
    with TestClient(security_app,base_url=ORIGIN) as client:
        response=client.post("/api/roles/",json={"name":"Must not exist"},headers=headers)
        assert response.status_code == 403


async def test_origin_alone_cannot_authorize_mutation(security_app,actor):
    user,_,issued=actor
    with TestClient(security_app,base_url=ORIGIN) as client:
        response=client.post("/api/roles/",json={"name":"Must not exist"},headers={
            "Origin":ORIGIN,"Cookie":f"{COOKIE}={issued.token}","Authorization":"Bearer "+bearer(user)})
        assert response.status_code == 403


async def test_bootstrap_login_and_session_bound_csrf(security_app,actor):
    user,_,_=actor
    with TestClient(security_app,base_url=ORIGIN) as client:
        initial=client.get("/api/auth/csrf")
        assert initial.status_code == 200
        anonymous=initial.json()["payload"]["csrf_token"]
        assert COOKIE not in client.cookies and CSRF_COOKIE in client.cookies
        assert client.cookies[CSRF_COOKIE] not in initial.text
        response=client.post("/api/auth/login",json={"email":user.email,"password":PASSWORD},headers={
            "Origin":ORIGIN,"X-CSRF-Token":anonymous})
        assert response.status_code == 200
        assert set(response.json()["payload"]) == {"user","effective_role","csrf_token"}
        current=response.json()["payload"]["csrf_token"]
        assert current != anonymous
        assert "refresh_token" not in client.cookies
        assert client.post("/api/roles/",json={"name":"Denied old csrf"},headers={
            "Origin":ORIGIN,"X-CSRF-Token":anonymous}).status_code == 403
        assert client.post("/api/roles/",json={"name":"Allowed current csrf"},headers={
            "Origin":ORIGIN,"X-CSRF-Token":current}).status_code == 200


@pytest.mark.parametrize("path",["/api/auth/login","/api/auth/register"])
async def test_anonymous_mutations_need_csrf_too(security_app,path):
    with TestClient(security_app,base_url=ORIGIN) as client:
        response=client.post(path,json={"first_name":"New","last_name":"Owner","email":"new@example.test","password":PASSWORD},
            headers={"Origin":ORIGIN})
        assert response.status_code == 403


def csrf_headers(client):
    response = client.get("/api/auth/csrf")
    assert response.status_code == 200
    return {"Origin": ORIGIN, "X-CSRF-Token": response.json()["payload"]["csrf_token"]}


@pytest.mark.parametrize("origin", [None, "null", "https://evil.test", "https://datano.test.evil.test",
    "http://datano.test", "https://datano.test:8443", "https://datano.test/", "https://datano.test?"])
async def test_bad_origin_is_rejected_even_with_valid_session_csrf(security_app, actor, persistent_database, origin):
    _, _, issued = actor
    with TestClient(security_app, base_url=ORIGIN) as client:
        client.cookies.set(COOKIE, issued.token)
        headers = csrf_headers(client)
        headers.pop("Origin")
        if origin is not None:
            headers["Origin"] = origin
        headers["Host"] = "evil.test"
        response = client.post("/api/roles/", json={"name": "Rejected origin"}, headers=headers)
        assert response.status_code == 403
        assert response.json()["payload"]["error_code"] == "CSRF_FAILED"
        assert response.headers["cache-control"] == "no-store"
    async with persistent_database.transaction() as session:
        assert await SQLRoleRepository(session).get_by_name("Rejected origin") is None


@pytest.mark.parametrize("method,path", [
    ("POST", "/api/roles/"), ("PUT", "/api/users/missing"),
    ("PATCH", "/api/roles/missing"), ("DELETE", "/api/roles/missing"),
    ("POST", "/api/auth/login"), ("POST", "/api/auth/register"),
    ("POST", "/api/auth/refresh"), ("POST", "/api/auth/logout"),
])
async def test_csrf_precedes_routing_body_validation_and_authentication(security_app, method, path):
    with TestClient(security_app, base_url=ORIGIN) as client:
        response = client.request(method, path, content=b"{malformed", headers={"Origin": ORIGIN})
        assert response.status_code == 403


@pytest.mark.parametrize("header", ["Origin", "X-CSRF-Token"])
async def test_duplicate_security_headers_are_rejected(security_app, actor, header):
    with TestClient(security_app, base_url=ORIGIN) as client:
        client.cookies.set(COOKIE, actor[2].token)
        headers = list(csrf_headers(client).items())
        headers.append((header, dict(headers)[header]))
        assert client.post("/api/roles/", json={"name": "Duplicate headers"}, headers=headers).status_code == 403


async def test_mac_is_bound_to_session_even_when_nonce_is_copied(security_app, actor, persistent_database):
    user, _, first = actor
    async with persistent_database.transaction() as session:
        second = await SessionService(SQLSessionRepository(session), OpaqueSessionTokens()).issue(user.id)
    with TestClient(security_app, base_url=ORIGIN) as client:
        client.cookies.set(COOKIE, first.token)
        headers = csrf_headers(client)
        nonce = client.cookies[CSRF_COOKIE]
        headers["Cookie"] = f"{COOKIE}={second.token}; {CSRF_COOKIE}={nonce}"
        assert client.post("/api/roles/", json={"name": "Cross session forgery"}, headers=headers).status_code == 403
        # Supplying the nonce itself as the header is not a signed double submit.
        headers["Cookie"] = f"{COOKIE}={first.token}; {CSRF_COOKIE}={nonce}"
        headers["X-CSRF-Token"] = nonce
        assert client.post("/api/roles/", json={"name": "Unsigned forgery"}, headers=headers).status_code == 403


async def test_legacy_refresh_explicitly_requires_credential_migration(security_app, actor):
    with TestClient(security_app, base_url=ORIGIN) as client:
        client.cookies.set("refresh_token", "old-refresh-token")
        headers = csrf_headers(client)
        headers["Authorization"] = "Bearer " + bearer(actor[0])
        response = client.post("/api/auth/refresh", headers=headers)
        assert response.status_code == 410
        assert response.json()["payload"]["error_code"] == "AUTH_MIGRATION_REQUIRED"
        assert COOKIE not in client.cookies


async def test_jwt_cannot_authorize_write_with_valid_anonymous_csrf(security_app, actor):
    with TestClient(security_app, base_url=ORIGIN) as client:
        headers = csrf_headers(client)
        headers["Authorization"] = "Bearer " + bearer(actor[0])
        assert client.post("/api/roles/", json={"name": "JWT write"}, headers=headers).status_code == 401
        client.cookies.set(COOKIE, bearer(actor[0]))
        headers = csrf_headers(client)
        assert client.post("/api/roles/", json={"name": "JWT cookie"}, headers=headers).status_code == 401


async def test_permissions_are_reloaded_without_super_user_bypass(security_app, actor, persistent_database):
    _, role, issued = actor
    async with persistent_database.transaction() as session:
        role.update_info(permission_ids=[Permission.Users_Read.value])
        await SQLRoleRepository(session).update(role)
    with TestClient(security_app, base_url=ORIGIN) as client:
        client.cookies.set(COOKIE, issued.token)
        assert client.get("/api/users/").status_code == 200
        assert client.get("/api/roles/").status_code == 403
        async with persistent_database.transaction() as session:
            role.update_info(permission_ids=[])
            await SQLRoleRepository(session).update(role)
        assert client.get("/api/users/").status_code == 403


async def test_csrf_bootstrap_cookie_cache_and_cors_contract(security_app):
    with TestClient(security_app, base_url=ORIGIN) as client:
        response = client.get("/api/auth/csrf", headers={"Origin": ORIGIN})
        token = response.json()["payload"]["csrf_token"]
        cookie = response.headers["set-cookie"]
        assert "HttpOnly" in cookie and "Secure" in cookie and "SameSite=lax" in cookie
        assert "Path=/" in cookie and "Domain=" not in cookie and "Max-Age=" not in cookie
        assert response.headers["cache-control"] == "no-store"
        assert {"cookie", "origin"} <= set(response.headers["vary"].lower().replace(" ", "").split(","))
        assert response.headers["access-control-allow-origin"] == ORIGIN
        assert response.headers["access-control-allow-credentials"] == "true"
        second = client.get("/api/auth/csrf")
        assert second.json()["payload"]["csrf_token"] == token
        assert "set-cookie" not in second.headers
        assert client.get("/api/auth/me").status_code == 401
        assert client.get("/api/auth/csrf", headers={"Origin": "https://evil.test"}).status_code == 403
        preflight = client.options("/api/roles/", headers={"Origin": ORIGIN,
            "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "X-CSRF-Token,Content-Type"})
        assert preflight.status_code == 200
        denied = client.options("/api/roles/", headers={"Origin": "https://evil.test",
            "Access-Control-Request-Method": "POST"})
        assert denied.status_code == 400 and "access-control-allow-origin" not in denied.headers


async def test_proxy_root_path_keeps_csrf_protection(security_app, actor):
    with TestClient(security_app, base_url=ORIGIN, root_path="/datano") as client:
        client.cookies.set(COOKIE, actor[2].token)
        assert client.post("/datano/api/roles/", json={"name": "Proxy bypass"}).status_code == 403
        headers = csrf_headers(client)
        assert client.post("/datano/api/roles/", json={"name": "Proxy authorized"}, headers=headers).status_code == 200


def test_serving_requires_security_configuration_but_schema_export_does_not():
    application = create_app(Config(_env_file=None, PUBLIC_ORIGIN=None, CSRF_SECRET_KEY=None, DATABASE_URL=None))
    assert "/api/auth/csrf" in application.openapi()["paths"]
    with pytest.raises(ValueError, match="PUBLIC_ORIGIN is required"):
        with TestClient(application):
            pass
    # Even a caller bypassing lifespan gets a closed write boundary.
    client = TestClient(application, base_url=ORIGIN)
    try:
        assert client.post("/api/auth/register", json={}).status_code == 503
    finally:
        client.close()


async def test_rejected_csrf_does_not_consume_auth_or_registration_quota(security_app, persistent_database):
    from sqlalchemy import text

    with TestClient(security_app, base_url=ORIGIN) as client:
        for path in ("/api/auth/login", "/api/auth/register"):
            assert client.post(path, content=b"x" * 9000, headers={"Origin": ORIGIN}).status_code == 403
    async with persistent_database.transaction() as session:
        assert (await session.execute(text("SELECT count(*) FROM registration_attempts"))).scalar_one() == 0


@pytest.mark.parametrize("path", ["/api/users/", "/api/roles/", "/api/auth/permissions"])
async def test_revoked_session_never_falls_back_to_jwt(security_app, actor, persistent_database, path):
    user, _, issued = actor
    async with persistent_database.transaction() as session:
        await SessionService(SQLSessionRepository(session), OpaqueSessionTokens()).revoke(issued.token)
    with TestClient(security_app, base_url=ORIGIN) as client:
        client.cookies.set(COOKIE, issued.token)
        assert client.get(path, headers={"Authorization": "Bearer " + bearer(user)}).status_code == 401


async def test_existing_opaque_session_and_csrf_survive_new_application(security_app, actor, caplog):
    from pathlib import Path

    with TestClient(security_app, base_url=ORIGIN) as first:
        first.cookies.set(COOKIE, actor[2].token)
        headers = csrf_headers(first)
        nonce = first.cookies[CSRF_COOKIE]
    replacement = create_app(security_app.state.settings)
    with TestClient(replacement, base_url=ORIGIN) as client:
        client.cookies.set(COOKIE, actor[2].token)
        client.cookies.set(CSRF_COOKIE, nonce)
        assert client.get("/api/users/").status_code == 200
        assert client.post("/api/roles/", json={"name": "After app restart"}, headers=headers).status_code == 200
    for private in (nonce, actor[2].token, headers["X-CSRF-Token"], KEY, PASSWORD):
        assert private not in caplog.text
        for path in Path("logs").glob("*.log"):
            assert private not in path.read_text()


async def test_openapi_separates_reset_only_recovery_and_product_session_security(security_app):
    with TestClient(security_app, base_url=ORIGIN) as client:
        schema = client.get("/openapi.json").json()
    assert set(schema["components"]["securitySchemes"]) == {"OpaqueSession", "PasswordRecovery"}
    assert set(schema["components"]["schemas"]["SessionLogin"]["properties"]) == {"user", "effective_role", "csrf_token"}
    for path, operations in schema["paths"].items():
        for method, operation in operations.items():
            recovery_security = any("PasswordRecovery" in item for item in operation.get("security", []))
            assert recovery_security is (path == "/api/auth/password-recovery/reset" and method == "post")
            if path.startswith("/api/") and method in {"post", "put", "patch", "delete"}:
                required = {p["name"] for p in operation["parameters"] if p.get("required") and p["in"] == "header"}
                assert {"Origin", "X-CSRF-Token"} <= required
                assert "403" in operation["responses"]
    for path in ("/api/users/", "/api/roles/", "/api/auth/me", "/api/auth/permissions"):
        assert schema["paths"][path]["get"]["security"] == [{"OpaqueSession": []}]
    refresh = schema["paths"]["/api/auth/refresh"]["post"]
    assert refresh["deprecated"] is True and "410" in refresh["responses"]
    logout = schema["paths"]["/api/auth/logout"]["post"]
    assert not logout.get("deprecated") and "410" not in logout["responses"]
    assert {"200", "403"} <= set(logout["responses"])
    assert logout["security"] == [{"OpaqueSession": []}, {}]
    assert schema["paths"]["/api/auth/password-recovery/reset"]["post"]["security"] == [{"PasswordRecovery": []}]


async def test_login_discards_legacy_refresh_cookie(security_app, actor):
    with TestClient(security_app, base_url=ORIGIN) as client:
        client.cookies.set("refresh_token", "old-refresh-token", domain="datano.test", path="/")
        headers = csrf_headers(client)
        response = client.post("/api/auth/login", json={"email": actor[0].email, "password": PASSWORD}, headers=headers)
        assert response.status_code == 200
        assert "refresh_token" not in client.cookies
        assert any("refresh_token=" in cookie and "Max-Age=0" in cookie for cookie in response.headers.get_list("set-cookie"))


async def test_explicit_local_http_csrf_profile(security_app, actor):
    settings = security_app.state.settings.model_copy(update={
        "public_origin": "http://localhost:3000", "session_allow_insecure_local_http": True})
    with TestClient(create_app(settings), base_url="http://localhost:8000") as client:
        bootstrap = client.get("/api/auth/csrf")
        cookie = bootstrap.headers["set-cookie"]
        assert "datano_csrf_dev=" in cookie and "Secure" not in cookie and "HttpOnly" in cookie
        response = client.post("/api/auth/login", json={"email": actor[0].email, "password": PASSWORD}, headers={
            "Origin": "http://localhost:3000", "X-CSRF-Token": bootstrap.json()["payload"]["csrf_token"]})
        assert response.status_code == 200
        assert "datano_session_dev" in client.cookies and COOKIE not in client.cookies
        assert client.post("/api/roles/", json={"name": "Local authorized"}, headers={
            "Origin": "http://localhost:3000", "X-CSRF-Token": response.json()["payload"]["csrf_token"]}).status_code == 200
