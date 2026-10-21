from datetime import UTC, datetime, timedelta
from http.cookies import SimpleCookie

import pytest
from tests.support.browser_client import BrowserClient as TestClient
from sqlalchemy import text

from app.domain.entities import RoleEntity, UserEntity
from app.infra.core.config import Config
from app.infra.repositories.postgres.role_repository import SQLRoleRepository
from app.infra.repositories.postgres.user_repository import SQLUserRepository
from app.infra.services import Argon2PasswordService, JoseTokenService
from app.infra.services.session_token_service import OpaqueSessionTokens
from app.application.use_cases.auth.admin_policy import AdminEmailPolicy
from app.infra.repositories.postgres.admin_proof_repository import PostgresAdminProofRepository
from app.main import create_app
from tests.postgres import isolated_postgres_url, persistent_database

COOKIE = "__Host-datano_session"
PASSWORD = " رمز ورود فارسی ۱۲۳ "
BODY = {"email": "  LOGIN@example.test  ", "password": PASSWORD}


def application(url, **settings):
    return create_app(Config(_env_file=None, DATABASE_URL=url.render_as_string(hide_password=False),
        ADMIN_EMAIL_ALLOWLIST='["login@example.test"]', **settings))


@pytest.fixture(autouse=True)
def fixed_login_window(monkeypatch):
    from app.interface import login_route
    from app.infra.services.registration_limiter import PostgresRegistrationLimiter
    current=[datetime(2026,10,18,0,0,1,tzinfo=UTC)]
    def limiter(database,**settings):
        return PostgresRegistrationLimiter(database,clock=lambda:current[0],**settings)
    monkeypatch.setattr(login_route,"PostgresRegistrationLimiter",limiter)
    return current


@pytest.fixture
async def account(persistent_database):
    user = UserEntity.create(first_name="Login", last_name="Owner", email="login@example.test",
        username="login-owner", hashed_password=Argon2PasswordService().hash(PASSWORD))
    user.activate()
    async with persistent_database.transaction() as session:
        users, roles = SQLUserRepository(session), SQLRoleRepository(session)
        await users.create(user)
        role = await roles.create(RoleEntity.create("User"))
        await users.assign_role(user.id, role.id)
    return user


@pytest.mark.parametrize("remember", [False, True])
async def test_login_sets_secure_cookie_and_returns_server_identity(persistent_database, isolated_postgres_url, account, remember, caplog):
    import time
    from pathlib import Path
    started=time.time()
    with TestClient(application(isolated_postgres_url), base_url="https://datano.test") as client:
        response = client.post("/api/auth/login", json={**BODY, "remember_me": remember})
        assert response.status_code == 200
        cookies = SimpleCookie()
        for value in response.headers.get_list("set-cookie"):
            cookies.load(value)
        assert COOKIE in cookies
        cookie = cookies[COOKIE]
        assert cookie["secure"] and cookie["httponly"]
        assert cookie["samesite"].lower() == "lax" and cookie["path"] == "/" and not cookie["domain"]
        assert cookie["max-age"] == ("2592000" if remember else "")
        assert not cookie["expires"]
        assert "refresh_token" not in cookies
        assert cookies["__Host-datano_csrf"]["secure"] and cookies["__Host-datano_csrf"]["httponly"]
        payload = response.json()["payload"]
        assert payload["user"]["id"] == account.id and payload["effective_role"] == "User"
        assert cookie.value not in response.text
        assert not {"hashed_password", "email_key", "digest"} & payload["user"].keys()
        current = client.get("/api/auth/me")
        assert current.status_code == 200
        assert current.json()["payload"]["id"] == account.id
        assert current.json()["payload"]["effective_role"] == "User"
        assert cookie.value not in caplog.text and PASSWORD not in caplog.text
        for path in Path("logs").glob("*.log"):
            if path.stat().st_mtime >= started:
                logged=path.read_text()
                assert cookie.value not in logged and PASSWORD not in logged
    async with persistent_database.transaction() as session:
        row = (await session.execute(text("SELECT * FROM auth_sessions WHERE digest=:digest"),
            {"digest":OpaqueSessionTokens().digest(cookie.value)})).mappings().one()
        assert row["user_id"] == account.id and row["remember_me"] is remember
        assert row["absolute_expires_at"]-row["created_at"] == (timedelta(days=30) if remember else timedelta(hours=12))


async def test_login_rotates_and_revokes_previous_identifier(persistent_database, isolated_postgres_url, account):
    with TestClient(application(isolated_postgres_url), base_url="https://datano.test") as client:
        assert client.post("/api/auth/login", json=BODY).status_code == 200
        first = client.cookies[COOKIE]
        assert client.post("/api/auth/login", json=BODY).status_code == 200
        second = client.cookies[COOKIE]
        assert first != second
        assert client.get("/api/auth/me", headers={"Cookie":f"{COOKIE}={first}"}).status_code == 401
        assert client.get("/api/auth/me").status_code == 200
    async with persistent_database.transaction() as session:
        assert await session.scalar(text("SELECT revoked_at IS NOT NULL FROM auth_sessions WHERE digest=:d"),
            {"d":OpaqueSessionTokens().digest(first)}) is True


async def test_failed_login_preserves_current_session(persistent_database, isolated_postgres_url, account):
    with TestClient(application(isolated_postgres_url), base_url="https://datano.test") as client:
        assert client.post("/api/auth/login", json=BODY).status_code == 200
        first = client.cookies.get(COOKIE)
        response = client.post("/api/auth/login", json={**BODY,"password":"wrong password"})
        assert response.status_code == 401 and "set-cookie" not in response.headers
        assert client.cookies.get(COOKIE) == first
        current=client.get("/api/auth/me")
        assert current.status_code == 200 and current.json()["payload"]["id"] == account.id


async def test_cookie_survives_new_application_and_roles_are_live(persistent_database, isolated_postgres_url, account):
    with TestClient(application(isolated_postgres_url), base_url="https://datano.test") as client:
        response=client.post("/api/auth/login", json=BODY)
        token=client.cookies.get(COOKIE)
        assert token
    async with persistent_database.transaction() as session:
        user=await SQLUserRepository(session).get_by_id(account.id)
        user.first_name="Changed on server"
        await SQLUserRepository(session).update(user)
        admin=await SQLRoleRepository(session).get_by_name("Admin")
        await SQLUserRepository(session).assign_role(user.id,admin.id)
    with TestClient(application(isolated_postgres_url), base_url="https://datano.test") as client:
        current=client.get("/api/auth/me",headers={"Cookie":f"{COOKIE}={token}"})
        assert current.status_code == 200
        assert current.json()["payload"]["first_name"] == "Changed on server"
        assert current.json()["payload"]["effective_role"] == "User"
        assert client.get("/api/users/",headers={"Cookie":f"{COOKIE}={token}"}).status_code == 403
    proof=PostgresAdminProofRepository(persistent_database,AdminEmailPolicy.parse('["login@example.test"]'))
    assert await proof.provision(account.id)
    with TestClient(application(isolated_postgres_url), base_url="https://datano.test") as client:
        assert client.get("/api/auth/me",headers={"Cookie":f"{COOKIE}={token}"}).status_code == 401
        renewed=client.post("/api/auth/login",json=BODY)
        assert renewed.status_code == 200 and renewed.json()["payload"]["effective_role"] == "Admin"
        assert renewed.json()["payload"]["user"]["first_name"] == "Changed on server"


@pytest.mark.parametrize("state", ["inactive", "missing", "wrong"])
async def test_invalid_credentials_never_issue_sessions(persistent_database, isolated_postgres_url, account, state):
    if state == "inactive":
        async with persistent_database.transaction() as session:
            user=await SQLUserRepository(session).get_by_id(account.id)
            user.deactivate()
            await SQLUserRepository(session).update(user)
    body={**BODY}
    if state == "missing":
        body["email"]="unknown@example.test"
    if state == "wrong":
        body["password"]="wrong password"
    with TestClient(application(isolated_postgres_url),base_url="https://datano.test") as client:
        response=client.post("/api/auth/login",json=body)
        assert response.status_code == 401 and "set-cookie" not in response.headers
        assert PASSWORD not in response.text
    async with persistent_database.transaction() as session:
        assert await session.scalar(text("SELECT count(*) FROM auth_sessions WHERE user_id=:id"),{"id":account.id}) == 0


@pytest.mark.parametrize("cookie", ["", "invalid", "A"*43], ids=["empty","malformed","unknown"])
async def test_bad_session_never_falls_back_to_valid_bearer(persistent_database, isolated_postgres_url, account, cookie):
    with TestClient(application(isolated_postgres_url),base_url="https://datano.test") as client:
        response=client.post("/api/auth/login",json=BODY)
        from app.infra.services import JoseTokenService
        legacy=JoseTokenService().generate_access_token({"sub":account.id,"username":account.username})
        current=client.get("/api/auth/me",headers={"Authorization":f"Bearer {legacy}","Cookie":f"{COOKIE}={cookie}"})
        assert current.status_code == 401


async def test_inactive_account_cannot_use_existing_session(persistent_database, isolated_postgres_url, account):
    with TestClient(application(isolated_postgres_url),base_url="https://datano.test") as client:
        assert client.post("/api/auth/login",json=BODY).status_code == 200
        assert client.cookies.get(COOKIE)
        async with persistent_database.transaction() as session:
            user=await SQLUserRepository(session).get_by_id(account.id)
            user.deactivate()
            await SQLUserRepository(session).update(user)
        assert client.get("/api/auth/me").status_code == 401


@pytest.mark.parametrize("role_state,expected", [("admin","Admin"),("inactive-admin","User"),("no-active-roles",None),("custom-super",None)])
async def test_effective_role_comes_only_from_active_server_roles(persistent_database, isolated_postgres_url, account, role_state, expected):
    app=application(isolated_postgres_url)
    with TestClient(app,base_url="https://datano.test") as client:
        async with persistent_database.transaction() as session:
            roles,users=SQLRoleRepository(session),SQLUserRepository(session)
            admin=await roles.get_by_name("Admin")
            if role_state in {"admin","inactive-admin"}:
                await users.assign_role(account.id,admin.id)
            if role_state in {"no-active-roles","custom-super"}:
                user_role=await roles.get_by_name("User")
                user_role.deactivate()
                await roles.update(user_role)
            if role_state == "custom-super":
                custom=RoleEntity.create("Custom",permission_ids=["super:user"])
                await roles.create(custom)
                await users.assign_role(account.id,custom.id)
        if role_state in {"admin","inactive-admin"}:
            assert await PostgresAdminProofRepository(persistent_database,
                AdminEmailPolicy.parse('["login@example.test"]')).provision(account.id)
        if role_state == "inactive-admin":
            async with persistent_database.transaction() as session:
                roles=SQLRoleRepository(session)
                admin=await roles.get_by_name("Admin")
                admin.deactivate()
                await roles.update(admin)
        response=client.post("/api/auth/login",json=BODY)
        assert response.status_code == 200
        assert response.json()["payload"].get("effective_role","MISSING") == expected
        current=client.get("/api/auth/me")
        assert current.status_code == 200
        assert current.json()["payload"].get("effective_role","MISSING") == expected


async def test_login_attempts_are_bounded_independently_of_registration(persistent_database, isolated_postgres_url, account):
    with TestClient(application(isolated_postgres_url),base_url="https://datano.test") as client:
        for _ in range(10):
            assert client.post("/api/auth/login",json={**BODY,"password":"wrong"}).status_code == 401
        response=client.post("/api/auth/login",json=BODY)
        assert response.status_code == 429
        assert 1 <= int(response.headers["retry-after"]) <= 600
        assert "set-cookie" not in response.headers
        # Login activity cannot consume the separate signup allowance.
        response=client.post("/api/auth/register",json={"first_name":"New","last_name":"Owner",
            "email":"separate@example.test","password":PASSWORD})
        assert response.status_code == 201


@pytest.mark.parametrize("url,opt_in,name,secure", [
    ("http://localhost",False,COOKIE,True),
    ("http://localhost",True,"datano_session_dev",False),
    ("http://127.0.0.1",True,"datano_session_dev",False),
    ("http://datano.test",True,COOKIE,True),
    ("https://localhost",True,COOKIE,True),
])
async def test_http_exception_is_explicit_local_and_separately_named(persistent_database,isolated_postgres_url,account,url,opt_in,name,secure):
    with TestClient(application(isolated_postgres_url,SESSION_ALLOW_INSECURE_LOCAL_HTTP=opt_in),base_url=url) as client:
        response=client.post("/api/auth/login",json=BODY)
        assert response.status_code == 200
        cookie=SimpleCookie()
        for header in response.headers.get_list("set-cookie"):
            cookie.load(header)
        assert name in cookie and bool(cookie[name]["secure"]) is secure
        assert cookie[name]["httponly"] and cookie[name]["samesite"].lower() == "lax"
        expected=200 if url.startswith("https:") or not secure else 401
        assert client.get("/api/auth/me").status_code == expected


@pytest.mark.parametrize("state",["expired","revoked","deleted"])
async def test_unusable_session_is_denied_even_with_valid_legacy_token(persistent_database,isolated_postgres_url,account,state):
    with TestClient(application(isolated_postgres_url),base_url="https://datano.test") as client:
        response=client.post("/api/auth/login",json=BODY)
        assert response.status_code == 200
        token=client.cookies[COOKIE]
        async with persistent_database.transaction() as session:
            if state == "expired":
                await session.execute(text("""UPDATE auth_sessions SET
                    created_at=created_at-interval '1 hour', last_seen_at=last_seen_at-interval '1 hour',
                    idle_expires_at=idle_expires_at-interval '1 hour' WHERE digest=:d"""),
                    {"d":OpaqueSessionTokens().digest(token)})
            elif state == "revoked":
                await session.execute(text("UPDATE auth_sessions SET revoked_at=last_seen_at WHERE digest=:d"),
                    {"d":OpaqueSessionTokens().digest(token)})
            else:
                await session.execute(text("DELETE FROM users WHERE id=:id"),{"id":account.id})
        response=client.get("/api/auth/me",headers={"Authorization":"Bearer "+JoseTokenService().generate_access_token({"sub":account.id,"username":account.username})})
        assert response.status_code == 401 and token not in response.text


@pytest.mark.parametrize("changes",[{"remember_me":"false"},{"remember_me":1},{"role":"Admin"},{"is_active":True}])
async def test_login_rejects_coercion_and_caller_privileges(persistent_database,isolated_postgres_url,account,changes):
    with TestClient(application(isolated_postgres_url),base_url="https://datano.test") as client:
        response=client.post("/api/auth/login",json={**BODY,**changes})
        assert response.status_code == 422 and PASSWORD not in response.text
        assert "set-cookie" not in response.headers


async def test_current_identity_is_not_selected_by_bearer_or_client_role(persistent_database,isolated_postgres_url,account):
    with TestClient(application(isolated_postgres_url),base_url="https://datano.test") as client:
        assert client.post("/api/auth/login",json=BODY).status_code == 200
        first=client.cookies[COOKIE]
        body={"first_name":"Other","last_name":"Owner","email":"other-login@example.test","password":PASSWORD}
        other=client.post("/api/auth/register",json=body).json()["payload"]
        response=client.post("/api/auth/login",json={"email":body["email"],"password":PASSWORD})
        assert response.status_code == 200 and response.json()["payload"]["user"]["id"] == other["id"]
        # Account switching rotates the previous browser session as well.
        assert client.get("/api/auth/me",headers={"Cookie":f"{COOKIE}={first}"}).status_code == 401
        second=client.cookies[COOKIE]
        # A bearer for the first user cannot replace the valid cookie's identity.
        from app.infra.services import JoseTokenService
        bearer=JoseTokenService().generate_access_token({"sub":account.id,"username":account.username})
        current=client.get("/api/auth/me",headers={"Cookie":f"{COOKIE}={second}","Authorization":f"Bearer {bearer}","X-Role":"Admin"})
        assert current.status_code == 200
        assert current.json()["payload"]["id"] == other["id"]
        assert current.json()["payload"]["effective_role"] == "User"


async def test_failed_rotation_rolls_back_both_records_and_keeps_cookie(persistent_database,isolated_postgres_url,account):
    from fastapi import Depends
    from app.infra.repositories.postgres.session_repository import SQLSessionRepository
    from app.interface.dependencies.database_dependencies import get_database_session
    from app.interface.dependencies.session_dependencies import get_session_repository
    class FailingRotation(SQLSessionRepository):
        async def rotate(self,*args,**kwargs):
            await super().rotate(*args,**kwargs)
            raise RuntimeError("Injected rotation failure")
    async def repository(session=Depends(get_database_session)):
        return FailingRotation(session)
    app=application(isolated_postgres_url)
    app.dependency_overrides[get_session_repository]=repository
    with TestClient(app,base_url="https://datano.test",raise_server_exceptions=False) as client:
        assert client.post("/api/auth/login",json=BODY).status_code == 200
        original=client.cookies[COOKIE]
        failed=client.post("/api/auth/login",json=BODY)
        assert failed.status_code == 500 and "set-cookie" not in failed.headers
        assert original not in failed.text and PASSWORD not in failed.text
        assert client.cookies[COOKIE] == original
        assert client.get("/api/auth/me").status_code == 200
    async with persistent_database.transaction() as session:
        assert await session.scalar(text("SELECT count(*) FROM auth_sessions WHERE user_id=:id"),{"id":account.id}) == 1
        assert await session.scalar(text("SELECT revoked_at FROM auth_sessions WHERE digest=:d"),
            {"d":OpaqueSessionTokens().digest(original)}) is None


@pytest.mark.parametrize("change",["inactive","deleted","password","rehash"])
async def test_account_change_during_authentication_cannot_issue_session(persistent_database,isolated_postgres_url,account,change):
    from fastapi import Depends
    from app.application.use_cases.auth.authenticate_use_case import AuthenticateUserUseCase
    from app.interface.dependencies.auth_dependencies import get_authenticate_user_usecase,get_password_service
    from app.interface.dependencies.user_dependencies import get_user_repository
    app=application(isolated_postgres_url)
    class RacingAuthentication(AuthenticateUserUseCase):
        raced=False
        async def execute(self,*args,**kwargs):
            user=await super().execute(*args,**kwargs)
            if self.raced:
                return user
            self.raced=True
            async with app.state.database.transaction() as session:
                users=SQLUserRepository(session)
                latest=await users.get_by_id(user.id)
                if change == "deleted":
                    await users.delete(user.id)
                else:
                    if change == "inactive":
                        latest.deactivate()
                    else:
                        latest.hashed_password=Argon2PasswordService().hash(PASSWORD if change == "rehash" else "Different replacement password")
                    await users.update(latest)
            return user
    async def authenticate(users=Depends(get_user_repository),passwords=Depends(get_password_service)):
        return RacingAuthentication(users,passwords)
    app.dependency_overrides[get_authenticate_user_usecase]=authenticate
    with TestClient(app,base_url="https://datano.test") as client:
        response=client.post("/api/auth/login",json=BODY)
        if change == "rehash":
            assert response.status_code == 200 and COOKIE in client.cookies
        else:
            assert response.status_code == 401 and "set-cookie" not in response.headers
    async with persistent_database.transaction() as session:
        assert await session.scalar(text("SELECT count(*) FROM auth_sessions WHERE user_id=:id"),{"id":account.id}) == (1 if change == "rehash" else 0)


async def test_malformed_attempts_throttle_before_hashing_and_survive_restart(persistent_database,isolated_postgres_url,account,fixed_login_window):
    from app.interface.dependencies.auth_dependencies import get_password_service
    class NoHashing:
        def verify_and_rehash(self,*args):
            pytest.fail("Malformed or throttled requests must not hash")
    app=application(isolated_postgres_url,LOGIN_IP_LIMIT=2)
    app.dependency_overrides[get_password_service]=NoHashing
    with TestClient(app,base_url="https://datano.test") as client:
        for _ in range(2):
            response=client.post("/api/auth/login",content='{"password":"private-fixture",',headers={"content-type":"application/json"})
            assert response.status_code == 422 and "private-fixture" not in response.text
    with TestClient(application(isolated_postgres_url,LOGIN_IP_LIMIT=2),base_url="https://datano.test") as client:
        response=client.post("/api/auth/login",json=BODY,headers={"X-Forwarded-For":"198.51.100.100"})
        assert response.status_code == 429
        fixed_login_window[0]+=timedelta(seconds=600)
        assert client.post("/api/auth/login",json=BODY).status_code == 200


@pytest.mark.parametrize("chunked",[False,True])
async def test_login_body_is_bounded_before_processing(persistent_database,isolated_postgres_url,account,chunked):
    with TestClient(application(isolated_postgres_url),base_url="https://datano.test") as client:
        body=b"x"*8193
        response=client.post("/api/auth/login",content=iter([body[:4096],body[4096:]]) if chunked else body,
            headers={"content-type":"application/json"})
        assert response.status_code == 413 and "set-cookie" not in response.headers


async def test_login_counter_failure_cannot_bypass_limit(persistent_database,isolated_postgres_url,account):
    with TestClient(application(isolated_postgres_url),base_url="https://datano.test") as client:
        async with persistent_database.transaction() as session:
            await session.execute(text("DROP TABLE registration_attempts"))
        response=client.post("/api/auth/login",json=BODY)
        assert response.status_code == 503 and "set-cookie" not in response.headers
        assert "registration_attempts" not in response.text and PASSWORD not in response.text


async def test_session_contract_openapi_and_private_cache_headers(persistent_database,isolated_postgres_url,account):
    with TestClient(application(isolated_postgres_url),base_url="https://datano.test") as client:
        schema=client.get("/openapi.json").json()
        assert schema["components"]["schemas"]["UserLogin"]["properties"]["remember_me"]["default"] is False
        assert schema["components"]["schemas"]["UserLogin"]["additionalProperties"] is False
        assert {"OpaqueSession":[]} in schema["paths"]["/api/auth/me"]["get"]["security"]
        assert not schema["paths"]["/api/auth/login"]["post"].get("security")
        assert schema["components"]["securitySchemes"]["OpaqueSession"] == {
            "type":"apiKey","in":"cookie","name":COOKIE}
        response=client.post("/api/auth/login",json=BODY)
        assert response.status_code == 200 and response.headers["cache-control"] == "no-store"
        current=client.get("/api/auth/me")
        assert current.status_code == 200 and current.headers["cache-control"] == "no-store"


async def test_caller_chosen_identifier_cannot_fix_the_new_session(persistent_database,isolated_postgres_url,account):
    chosen="F"*43
    with TestClient(application(isolated_postgres_url),base_url="https://datano.test") as client:
        response=client.post("/api/auth/login",json=BODY,headers={"Cookie":f"{COOKIE}={chosen}"})
        assert response.status_code == 200 and client.cookies[COOKIE] != chosen
        assert client.get("/api/auth/me").status_code == 200
        assert client.get("/api/auth/me",headers={"Cookie":f"{COOKIE}={chosen}"}).status_code == 401


async def test_opposite_account_switches_do_not_deadlock(persistent_database,account):
    import asyncio
    from app.application.use_cases.auth.session_service import SessionService
    from app.infra.repositories.postgres.session_repository import SQLSessionRepository
    other=UserEntity.create(first_name="Other",last_name="Owner",email="switch@example.test",username="switch-owner",hashed_password="test-only-hash")
    async with persistent_database.transaction() as session:
        await SQLUserRepository(session).create(other)
        store=SessionService(SQLSessionRepository(session),OpaqueSessionTokens())
        first=await store.issue(account.id)
        second=await store.issue(other.id)
    ready=asyncio.Event()
    arrived=0
    async def switch(user_id,previous):
        nonlocal arrived
        async with persistent_database.transaction() as session:
            arrived+=1
            if arrived == 2:
                ready.set()
            await ready.wait()
            return await SessionService(SQLSessionRepository(session),OpaqueSessionTokens()).issue(user_id,previous_token=previous)
    switched=await asyncio.wait_for(asyncio.gather(switch(other.id,first.token),switch(account.id,second.token)),timeout=10)
    async with persistent_database.transaction() as session:
        store=SessionService(SQLSessionRepository(session),OpaqueSessionTokens())
        assert await store.resolve(first.token) is None and await store.resolve(second.token) is None
        assert (await store.resolve(switched[0].token)).user_id == other.id
        assert (await store.resolve(switched[1].token)).user_id == account.id


async def test_concurrent_legacy_hash_upgrade_and_account_switch_do_not_deadlock(persistent_database,isolated_postgres_url,account):
    import asyncio
    import bcrypt
    from concurrent.futures import ThreadPoolExecutor
    from fastapi import Depends
    from app.application.use_cases.auth.authenticate_use_case import AuthenticateUserUseCase
    from app.application.use_cases.auth.session_service import SessionService
    from app.infra.repositories.postgres.session_repository import SQLSessionRepository
    from app.interface.dependencies.auth_dependencies import get_authenticate_user_usecase,get_password_service
    from app.interface.dependencies.user_dependencies import get_user_repository
    legacy=bcrypt.hashpw(PASSWORD.encode(),bcrypt.gensalt(rounds=4)).decode()
    other=UserEntity.create(first_name="Other",last_name="Legacy",email="legacy-switch@example.test",username="legacy-switch",hashed_password=legacy)
    other.activate()
    async with persistent_database.transaction() as session:
        users=SQLUserRepository(session)
        first_user=await users.get_by_id(account.id)
        first_user.hashed_password=legacy
        await users.update(first_user)
        await users.create(other)
        store=SessionService(SQLSessionRepository(session),OpaqueSessionTokens())
        first=await store.issue(account.id)
        second=await store.issue(other.id)
    ready=asyncio.Event()
    arrived=0
    class RendezvousAuthentication(AuthenticateUserUseCase):
        arrived=False
        async def execute(self,*args,**kwargs):
            nonlocal arrived
            user=await super().execute(*args,**kwargs)
            if not self.arrived:
                self.arrived=True
                arrived+=1
                if arrived == 2:
                    ready.set()
                await asyncio.wait_for(ready.wait(),timeout=10)
            return user
    async def authenticate(users=Depends(get_user_repository),passwords=Depends(get_password_service)):
        return RendezvousAuthentication(users,passwords)
    app=application(isolated_postgres_url)
    app.dependency_overrides[get_authenticate_user_usecase]=authenticate
    with TestClient(app,base_url="https://datano.test",raise_server_exceptions=False) as client:
        def compete():
            with ThreadPoolExecutor(max_workers=2) as executor:
                requests=[executor.submit(client.post,"/api/auth/login",json={"email":user.email,"password":PASSWORD},
                    headers={"Cookie":f"{COOKIE}={previous}"}) for user,previous in ((account,second.token),(other,first.token))]
                return [request.result(timeout=20) for request in requests]
        responses=await asyncio.to_thread(compete)
        assert [response.status_code for response in responses] == [200,200]
    async with persistent_database.transaction() as session:
        for user in (account,other):
            assert (await SQLUserRepository(session).get_by_id(user.id)).hashed_password.startswith("$argon2id$")
