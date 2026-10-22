"""Real PostgreSQL and the normal cookie/CSRF boundary, with independent accounts."""
import asyncio
from dataclasses import asdict, replace
from datetime import UTC, datetime, timedelta
from threading import Barrier

import pytest
from fastapi import Depends
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.application.use_cases.auth.admin_policy import AdminEmailPolicy
from app.domain.entities import UserEntity, WebsiteEntity
from app.infra.core.config import Config
from app.infra.database.bootstrap import ensure_required_roles
from app.infra.database.models import WebsiteRow
from app.infra.repositories.postgres.admin_proof_repository import PostgresAdminProofRepository
from app.infra.repositories.postgres.role_repository import SQLRoleRepository
from app.infra.repositories.postgres.user_repository import SQLUserRepository
from app.infra.repositories.postgres.website_repository import SQLWebsiteRepository
from app.infra.services import Argon2PasswordService, JoseTokenService
from app.interface.dependencies.database_dependencies import get_database_session
from app.interface.dependencies.website_dependencies import get_website_repository
from app.main import create_app
from tests.postgres import isolated_postgres_url, persistent_database
from tests.support.browser_client import BrowserClient

PASSWORD = "Website fixture password!"
COOKIE = "__Host-datano_session"
ROOT = "/api/websites/"
PUBLIC_FIELDS = {"id", "hostname", "scheme", "url", "is_verified", "challenge_status",
                 "reservation_expires_at", "challenge_expires_at", "verified_at", "created_at", "updated_at"}


def application(url, **settings):
    return create_app(Config(_env_file=None, DATABASE_URL=url.render_as_string(hide_password=False), **settings))


@pytest.fixture
async def accounts(persistent_database):
    hashed = Argon2PasswordService().hash(PASSWORD)
    users = [UserEntity.create(first_name=name, last_name="Owner", email=name.lower() + "@example.test",
             username=name.lower() + "-owner", hashed_password=hashed) for name in ("Self", "Other")]
    async with persistent_database.transaction() as session:
        await ensure_required_roles(session)
        role = await SQLRoleRepository(session).get_by_name("User")
        for user in users:
            user.activate()
            await SQLUserRepository(session).create(user)
            await SQLUserRepository(session).assign_role(user.id, role.id)
    return users


def login(client, user):
    response = client.post("/api/auth/login", json={"email": user.email, "password": PASSWORD})
    assert response.status_code == 200
    return response


async def test_session_owner_registers_and_reads_canonical_website(persistent_database, isolated_postgres_url, accounts):
    with BrowserClient(application(isolated_postgres_url)) as client:
        login(client, accounts[0])
        response = client.post(ROOT, json={"url": "https://EXAMPLE.COM./"})
        assert response.status_code == 200, response.text
        site = response.json()["payload"]
        assert set(site) == PUBLIC_FIELDS
        assert site["hostname"] == "example.com" and site["url"] == "https://example.com/"
        assert site["is_verified"] is False and site["challenge_status"] == "not-issued"
        assert client.get(ROOT + site["id"]).json()["payload"] == site
        listing = client.get(ROOT).json()["payload"]
        assert listing["items"] == [site] and listing["total"] == 1


async def snapshots(database):
    async with database.transaction() as session:
        return [dict(row) for row in (await session.execute(text("SELECT * FROM websites ORDER BY id"))).mappings()]


@pytest.mark.parametrize("url,hostname,scheme", [
    ("HTTP://Example.COM:80", "example.com", "http"),
    ("https://www.example.com/", "www.example.com", "https"),
    ("https://shop.example.com/", "shop.example.com", "https"),
    ("https://مثال.ایران/", "xn--mgbh0fb.xn--mgba3a4f16a", "https"),
    ("https://BÜCHER.de.:443/", "xn--bcher-kva.de", "https"),
    ("https://faß.de/", "xn--fa-hia.de", "https"),
])
async def test_http_url_contract_matches_canonical_domain_rules(persistent_database, isolated_postgres_url, accounts, url, hostname, scheme):
    with BrowserClient(application(isolated_postgres_url)) as client:
        login(client, accounts[0])
        response = client.post(ROOT, json={"url": url})
        assert response.status_code == 200, response.text
        assert response.json()["payload"]["hostname"] == hostname
        assert response.json()["payload"]["scheme"] == scheme
    rows = await snapshots(persistent_database)
    assert len(rows) == 1 and rows[0]["owner_id"] == accounts[0].id
    assert rows[0]["challenge_digest"] is rows[0]["verified_at"] is None


async def test_duplicate_registration_reuses_same_owner_without_refresh_or_scheme_change(persistent_database, isolated_postgres_url, accounts):
    with BrowserClient(application(isolated_postgres_url)) as client:
        login(client, accounts[0])
        first = client.post(ROOT, json={"url": "http://Example.COM/"})
        assert first.status_code == 200, first.text
        second = client.post(ROOT, json={"url": "https://example.com.:443/"})
        assert second.status_code == 200 and second.json() == first.json()
        assert len(await snapshots(persistent_database)) == 1


async def test_owner_hints_cannot_select_a_different_account(persistent_database, isolated_postgres_url, accounts):
    with BrowserClient(application(isolated_postgres_url)) as client:
        login(client, accounts[0])
        created = client.post(ROOT + "?owner_id=" + accounts[1].id, json={"url": "https://example.com"})
        assert created.status_code == 200, created.text
        site = created.json()["payload"]
        assert client.get(ROOT + "?owner_id=" + accounts[1].id).json()["payload"]["items"] == [site]
        assert client.get(ROOT + site["id"] + "?owner_id=" + accounts[1].id).json()["payload"] == site
    assert (await snapshots(persistent_database))[0]["owner_id"] == accounts[0].id


async def test_foreign_and_missing_ids_share_private_404(persistent_database, isolated_postgres_url, accounts):
    with BrowserClient(application(isolated_postgres_url)) as client:
        login(client, accounts[0])
        created = client.post(ROOT, json={"url": "https://private.example"})
        assert created.status_code == 200, created.text
        site = created.json()["payload"]
        login(client, accounts[1])
        foreign = client.get(ROOT + site["id"])
        missing = client.get(ROOT + "unknown-id")
        assert foreign.status_code == missing.status_code == 404
        assert foreign.json() == missing.json()
        assert foreign.headers.get("cache-control") == missing.headers.get("cache-control") == "no-store"
        assert all(value not in foreign.text for value in (site["hostname"], accounts[0].id, accounts[0].email))
        listing = client.get(ROOT)
        assert listing.json()["payload"]["items"] == []
        assert listing.json()["payload"]["total"] == 0
        conflict = client.post(ROOT, json={"url": "http://PRIVATE.EXAMPLE/"})
        assert conflict.status_code == 409
        assert conflict.json()["message"] == "Website is unavailable" and conflict.json()["payload"]["details"] == {}
        assert accounts[0].id not in conflict.text and accounts[0].email not in conflict.text


@pytest.mark.parametrize("url", [
    "ftp://example.com/", "https://user:private@example.com/", "https://example.com:8000/",
    "https://example.com/a/..", "https://example.com/?", "https://example.com/#",
    "https://127.0.0.1/", "http://2130706433/", "http://0x7f000001/", "http://[::1]/",
    "https://localhost/", "https://app.local/", "https://example.com\\@evil.example/",
])
async def test_invalid_url_returns_safe_error_and_creates_nothing(persistent_database, isolated_postgres_url, accounts, url):
    with BrowserClient(application(isolated_postgres_url)) as client:
        login(client, accounts[0])
        response = client.post(ROOT, json={"url": url})
        assert response.status_code == 422
        assert "private" not in response.text and url not in response.text
        assert response.headers.get("cache-control") == "no-store"
    assert await snapshots(persistent_database) == []


@pytest.mark.parametrize("body", [
    {}, {"url": None}, {"url": 123}, {"url": ["https://example.com"]},
    {"url": "https://example.com", "owner_id": "forbidden-owner"},
    {"url": "https://example.com", "is_verified": True},
    {"url": "https://example.com", "challenge_digest": "private-proof"},
    {"url": "https://example.com", "roles": ["Admin"]},
    {"url": "https://example.com", "password": "private-credential"},
])
async def test_strict_creation_dto_does_not_echo_credential_or_owner_fields(persistent_database, isolated_postgres_url, accounts, body):
    with BrowserClient(application(isolated_postgres_url)) as client:
        login(client, accounts[0])
        response = client.post(ROOT, json=body)
        assert response.status_code == 422
        assert all(set(error) <= {"type", "loc", "msg"} for error in response.json()["detail"])
        assert "private-proof" not in response.text and "private-credential" not in response.text
        assert "forbidden-owner" not in response.text
    assert await snapshots(persistent_database) == []


async def test_pagination_and_site_identity_survive_application_restart(persistent_database, isolated_postgres_url, accounts):
    with BrowserClient(application(isolated_postgres_url)) as client:
        login(client, accounts[0])
        sites = []
        for hostname in ("example.com", "www.example.com", "shop.example.com"):
            created = client.post(ROOT, json={"url": "https://" + hostname})
            assert created.status_code == 200, created.text
            sites.append(created.json()["payload"])
        token = client.cookies[COOKIE]
        first, second = client.get(ROOT + "?size=2"), client.get(ROOT + "?size=2&page=2")
        assert first.json()["payload"]["items"] == sites[:2]
        assert second.json()["payload"]["items"] == sites[2:]
        assert first.json()["payload"]["total"] == 3 and first.json()["payload"]["pages"] == 2
        assert client.get(ROOT + "?size=2&page=20").json()["payload"]["items"] == []
        for query in ("page=0", "size=0", "size=101", "page=bad"):
            assert client.get(ROOT + "?" + query).status_code == 422
    with BrowserClient(application(isolated_postgres_url)) as restarted:
        assert restarted.get(ROOT, headers={"Cookie": COOKIE + "=" + token}).json()["payload"]["items"] == sites


@pytest.mark.parametrize("state", ["missing", "invalid", "revoked", "expired", "inactive", "bearer"])
async def test_invalid_session_cannot_read_or_register(persistent_database, isolated_postgres_url, accounts, state):
    with BrowserClient(application(isolated_postgres_url)) as client:
        login(client, accounts[0])
        headers = {}
        if state in {"missing", "invalid", "bearer"}:
            client.cookies.clear()
            if state == "invalid":
                client.cookies.set(COOKIE, "x" * 43)
            if state == "bearer":
                token = JoseTokenService().generate_access_token({"sub": accounts[0].id, "username": accounts[0].username})
                headers["Authorization"] = "Bearer " + token
        else:
            async with persistent_database.transaction() as session:
                if state == "inactive":
                    await session.execute(text("UPDATE users SET is_active=false WHERE id=:id"), {"id": accounts[0].id})
                elif state == "revoked":
                    await session.execute(text("UPDATE auth_sessions SET revoked_at=clock_timestamp() WHERE user_id=:id"), {"id": accounts[0].id})
                else:
                    await session.execute(text("UPDATE auth_sessions SET created_at=clock_timestamp()-interval '2 days', last_seen_at=clock_timestamp()-interval '1 day', idle_expires_at=clock_timestamp()-interval '1 hour', absolute_expires_at=clock_timestamp()-interval '1 minute' WHERE user_id=:id"), {"id": accounts[0].id})
        assert client.get(ROOT, headers=headers).status_code == 401
        assert client.get(ROOT + "unknown", headers=headers).status_code == 401
        assert client.post(ROOT, json={"url": "https://example.com"}, headers=headers).status_code == 401
    assert await snapshots(persistent_database) == []


async def test_csrf_origin_missing_and_cross_session_tokens_are_rejected(persistent_database, isolated_postgres_url, accounts):
    app = application(isolated_postgres_url)
    with BrowserClient(app) as first, BrowserClient(application(isolated_postgres_url)) as second:
        login(first, accounts[0])
        login(second, accounts[1])
        wrong_token = second.get("/api/auth/csrf").json()["payload"]["csrf_token"]
        with TestClient(application(isolated_postgres_url), base_url="https://testserver") as raw:
            for headers in ({}, {"Origin": "https://testserver"}, {"Origin": "https://evil.test", "X-CSRF-Token": wrong_token},
                            {"Origin": "https://testserver", "X-CSRF-Token": wrong_token}):
                response = raw.post(ROOT, json={"url": "https://example.com"}, headers={**headers, "Cookie": "; ".join(k + "=" + v for k, v in first.cookies.items())})
                assert response.status_code == 403
                assert response.headers["cache-control"] == "no-store"
    assert await snapshots(persistent_database) == []


async def test_proved_admin_still_cannot_read_another_owners_site(persistent_database, isolated_postgres_url, accounts):
    policy = AdminEmailPolicy.parse('["' + accounts[0].email + '"]')
    assert await PostgresAdminProofRepository(persistent_database, policy).provision(accounts[0].id)
    app = application(isolated_postgres_url, ADMIN_EMAIL_ALLOWLIST='["' + accounts[0].email + '"]')
    with BrowserClient(app) as client:
        login(client, accounts[1])
        created = client.post(ROOT, json={"url": "https://private.example"})
        assert created.status_code == 200, created.text
        assert login(client, accounts[0]).json()["payload"]["effective_role"] == "Admin"
        assert client.get(ROOT).json()["payload"]["items"] == []
        assert client.get(ROOT + created.json()["payload"]["id"]).status_code == 404
        assert client.post(ROOT, json={"url": "https://private.example"}).status_code == 409


@pytest.mark.parametrize("same_owner", [False, True])
async def test_http_concurrent_claims_are_atomic(persistent_database, isolated_postgres_url, accounts, same_owner):
    app = application(isolated_postgres_url)
    barrier = Barrier(2)
    def claim(client, url):
        barrier.wait(timeout=10)
        return client.post(ROOT, json={"url": url})
    with BrowserClient(app) as first, BrowserClient(application(isolated_postgres_url)) as second:
        login(first, accounts[0])
        login(second, accounts[0] if same_owner else accounts[1])
        results = await asyncio.wait_for(asyncio.gather(
            asyncio.to_thread(claim, first, "https://RACE.EXAMPLE./"),
            asyncio.to_thread(claim, second, "http://race.example/")), 15)
        if same_owner:
            assert [response.status_code for response in results] == [200, 200]
            assert results[0].json()["payload"]["id"] == results[1].json()["payload"]["id"]
        else:
            assert sorted(response.status_code for response in results) == [200, 409]
    assert len(await snapshots(persistent_database)) == 1


@pytest.mark.parametrize("verified", [False, True])
async def test_expired_reservation_can_be_replaced_but_verified_site_cannot(persistent_database, isolated_postgres_url, accounts, verified):
    old = WebsiteEntity.create(accounts[0].id, "example.com", now=datetime.now(UTC) - timedelta(days=2))
    if verified:
        issued = old.created_at + timedelta(seconds=1)
        old = replace(old, challenge_digest=b"d" * 32, challenge_issued_at=issued,
                      challenge_expires_at=issued + timedelta(hours=24), reservation_expires_at=issued + timedelta(hours=24),
                      updated_at=issued, verified_at=issued)
    async with persistent_database.transaction() as session:
        session.add(WebsiteRow(**asdict(old)))
    with BrowserClient(application(isolated_postgres_url)) as client:
        login(client, accounts[1])
        claimed = client.post(ROOT, json={"url": "https://EXAMPLE.COM./"})
        assert claimed.status_code == (409 if verified else 200), claimed.text
        if not verified:
            fresh = claimed.json()["payload"]
            assert fresh["id"] != old.id and fresh["is_verified"] is False
            login(client, accounts[0])
            assert client.get(ROOT).json()["payload"]["items"] == []
            assert client.get(ROOT + old.id).status_code == 404
        else:
            login(client, accounts[0])
            public = client.get(ROOT + old.id).json()["payload"]
            assert public["is_verified"] and public["challenge_status"] == "verified"
            assert set(public) == PUBLIC_FIELDS and "digest" not in str(public)


async def test_failed_registration_transaction_never_reports_or_persists_success(persistent_database, isolated_postgres_url, accounts):
    class FailingWebsites(SQLWebsiteRepository):
        async def claim(self, candidate):
            await super().claim(candidate)
            raise RuntimeError("Injected website failure")
    async def repository(session=Depends(get_database_session)):
        return FailingWebsites(session)
    app = application(isolated_postgres_url)
    app.dependency_overrides[get_website_repository] = repository
    with BrowserClient(app, raise_server_exceptions=False) as client:
        login(client, accounts[0])
        response = client.post(ROOT, json={"url": "https://example.com"})
        assert response.status_code == 500 and "Injected" not in response.text
    assert await snapshots(persistent_database) == []


async def test_registration_uses_database_time_despite_application_clock_skew(persistent_database, isolated_postgres_url, accounts, monkeypatch):
    original = WebsiteEntity.create
    def skewed_factory(owner_id, hostname, **kwargs):
        # Simulate the application's default clock ahead of the database, while
        # respecting an explicitly supplied authoritative creation instant.
        kwargs.setdefault("now", datetime.now(UTC) + timedelta(minutes=5))
        return original(owner_id, hostname, **kwargs)
    monkeypatch.setattr(WebsiteEntity, "create", skewed_factory)
    with BrowserClient(application(isolated_postgres_url)) as client:
        login(client, accounts[0])
        created = client.post(ROOT, json={"url": "https://example.com"})
        assert created.status_code == 200, created.text
    row = (await snapshots(persistent_database))[0]
    assert row["created_at"] < datetime.now(UTC) + timedelta(seconds=1)


def test_openapi_documents_owner_only_operations_without_private_models():
    schema = create_app(Config(_env_file=None)).openapi()
    collection = schema["paths"][ROOT]
    assert set(collection) == {"get", "post"}
    assert set(schema["paths"][ROOT + "{website_id}"]) == {"get"}
    models = schema["components"]["schemas"]
    assert models["WebsiteCreate"]["required"] == ["url"]
    assert set(models["WebsiteCreate"]["properties"]) == {"url"}
    assert models["WebsiteCreate"]["additionalProperties"] is False
    assert set(models["Website"]["properties"]) == PUBLIC_FIELDS
    for operation in [collection["post"], collection["get"], schema["paths"][ROOT + "{website_id}"]["get"]]:
        assert operation["security"] == [{"OpaqueSession": []}]
        assert "401" in operation["responses"]
    assert {"Origin", "X-CSRF-Token"} <= {item["name"] for item in collection["post"]["parameters"]}
    assert "409" in collection["post"]["responses"] and "403" in collection["post"]["responses"]


@pytest.mark.parametrize("expired", [False, True])
async def test_pending_or_expired_challenge_is_public_metadata_without_proof(persistent_database, isolated_postgres_url, accounts, expired):
    issued = datetime.now(UTC) - (timedelta(days=2) if expired else timedelta(seconds=1))
    site = WebsiteEntity.create(accounts[0].id, "example.com", now=issued)
    site = replace(site, challenge_digest=b"d" * 32, challenge_issued_at=issued,
                   challenge_expires_at=site.reservation_expires_at)
    async with persistent_database.transaction() as session:
        session.add(WebsiteRow(**asdict(site)))
    with BrowserClient(application(isolated_postgres_url)) as client:
        login(client, accounts[0])
        public = client.get(ROOT + site.id).json()["payload"]
        assert public["challenge_status"] == ("expired" if expired else "pending")
        assert public["is_verified"] is False and set(public) == PUBLIC_FIELDS
        assert "challenge_digest" not in public and "owner_id" not in public
        repeated = client.post(ROOT, json={"url": "https://example.com"})
        assert repeated.status_code == 200, repeated.text
        assert repeated.json()["payload"] == public


@pytest.mark.parametrize("body", ['{"url":"https://example.com","password":"private-value",', 'null', '[]'])
async def test_malformed_body_does_not_echo_private_input(persistent_database, isolated_postgres_url, accounts, body):
    with BrowserClient(application(isolated_postgres_url)) as client:
        login(client, accounts[0])
        response = client.post(ROOT, content=body, headers={"Content-Type": "application/json"})
        assert response.status_code == 422
        assert "private-value" not in response.text
        assert all(set(error) <= {"type", "loc", "msg"} for error in response.json()["detail"])
        assert response.headers["cache-control"] == "no-store"
    assert await snapshots(persistent_database) == []
