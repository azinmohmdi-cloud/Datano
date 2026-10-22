"""Real cookie, CSRF, database and challenge APIs; HTML source is controlled here."""
from datetime import timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, update

from app.application.use_cases.website.html import HTMLFetchError, HTMLFetchFailure, IWebsiteHTMLFetcher, WebsiteHTML
from app.infra.database.models import UserRow, WebsiteRow
from app.interface.dependencies.website_dependencies import get_website_html_fetcher
from app.main import create_app
from app.infra.core.config import Config
from tests.integration.test_websites_http import accounts, application, login, ROOT, COOKIE
from tests.postgres import isolated_postgres_url, persistent_database
from tests.support.browser_client import BrowserClient
from tests.integration.test_website_html_wire import certificate, peer, Resolver, LoopbackBackend


class HTML(IWebsiteHTMLFetcher):
    def __init__(self): self.markup, self.calls, self.error = "<html><head></head></html>", [], None
    async def fetch(self, address):
        self.calls.append(address)
        if self.error is not None: raise self.error
        return WebsiteHTML(address.url, "text/html; charset=utf-8", self.markup.encode())


def app_and_source(url, **settings):
    app, source = application(url, **settings), HTML()
    app.dependency_overrides[get_website_html_fetcher] = lambda: source
    return app, source


def create(client, hostname="example.test"):
    response = client.post(ROOT, json={"url": f"https://{hostname}/"})
    assert response.status_code == 200
    return response.json()["payload"]


def issue(client, identifier):
    response = client.post(f"{ROOT}{identifier}/challenge", json={})
    assert response.status_code == 200, response.text
    return response.json()["payload"]


async def test_issue_verify_private_output_digest_and_idempotence(persistent_database, isolated_postgres_url, accounts, caplog):
    app, source = app_and_source(isolated_postgres_url)
    with BrowserClient(app) as client:
        login(client, accounts[0]); site = create(client)
        response = client.post(f"{ROOT}{site['id']}/challenge", json={})
        assert response.status_code == 200 and response.headers["cache-control"] == "no-store"
        challenge = response.json()["payload"]; token = challenge["token"]
        assert len(token) == 43 and challenge["meta_tag"] == f'<meta name="datano-verification" content="{token}">'
        pending = challenge["website"]
        assert not pending["is_verified"] and pending["challenge_status"] == "pending"
        async with persistent_database.transaction() as session:
            row = await session.scalar(select(WebsiteRow).where(WebsiteRow.id == site["id"]))
            assert isinstance(row.challenge_digest, bytes) and len(row.challenge_digest) == 32
            assert row.challenge_expires_at - row.challenge_issued_at == timedelta(hours=24)
            assert row.reservation_expires_at == row.challenge_expires_at
        assert token not in client.get(ROOT).text + client.get(ROOT + site["id"]).text
        source.markup = f"<!DOCTYPE html><html><head>{challenge['meta_tag']}</head><body>متن</body></html>"
        verified = client.post(f"{ROOT}{site['id']}/verify", json={})
        assert verified.status_code == 200 and verified.headers["cache-control"] == "no-store"
        data = verified.json()["payload"]
        assert data["is_verified"] and data["challenge_status"] == "verified" and data["verified_at"]
        assert not {"owner_id", "token", "challenge_digest"}.intersection(data)
        assert client.get(ROOT + site["id"]).json()["payload"] == data
        assert client.post(f"{ROOT}{site['id']}/verify", json={}).json()["payload"] == data and len(source.calls) == 1
        assert client.post(f"{ROOT}{site['id']}/challenge", json={}).status_code == 409
        assert token not in verified.text + caplog.text


@pytest.mark.parametrize("method", ["challenge", "verify"])
async def test_foreign_missing_and_query_owner_hints_never_disclose_or_fetch(persistent_database, isolated_postgres_url, accounts, method):
    app, source = app_and_source(isolated_postgres_url)
    with BrowserClient(app) as client:
        login(client, accounts[0]); site = create(client)
        challenge = issue(client, site["id"])
        login(client, accounts[1])
        foreign = client.post(f"{ROOT}{site['id']}/{method}?owner_id={accounts[0].id}", json={})
        missing = client.post(f"{ROOT}missing/{method}", json={})
        assert foreign.status_code == missing.status_code == 404 and foreign.json() == missing.json()
        assert foreign.headers["cache-control"] == "no-store"
        assert challenge["token"] not in foreign.text and accounts[0].email not in foreign.text
        assert not source.calls


@pytest.mark.parametrize("body", [{"owner_id": "private-owner"}, {"token": "private-token"}, {"url": "http://169.254.169.254"},
    {"is_verified": True}, {"expires_at": "private-date"}, [], None])
@pytest.mark.parametrize("method", ["challenge", "verify"])
async def test_proof_inputs_cannot_choose_owner_token_url_or_verification_state(persistent_database, isolated_postgres_url, accounts, body, method):
    app, source = app_and_source(isolated_postgres_url)
    with BrowserClient(app) as client:
        login(client, accounts[0]); site = create(client)
        response = client.post(f"{ROOT}{site['id']}/{method}", json=body)
        assert response.status_code == 422 and response.headers["cache-control"] == "no-store"
        for private in ["private-owner", "private-token", "169.254", "private-date"]: assert private not in response.text
        assert not source.calls
        assert client.get(ROOT + site["id"]).json()["payload"]["challenge_status"] == "not-issued"


@pytest.mark.parametrize("case", ["unissued", "wrong", "body_only", "expired", "rotated"])
async def test_invalid_missing_expired_or_rotated_proof_does_not_grant(persistent_database, isolated_postgres_url, accounts, case):
    app, source = app_and_source(isolated_postgres_url)
    with BrowserClient(app) as client:
        login(client, accounts[0]); site = create(client)
        if case != "unissued":
            challenge = issue(client, site["id"])
            source.markup = f"<head>{challenge['meta_tag']}</head>"
            if case == "wrong": source.markup = '<head><meta name="datano-verification" content="' + "x"*43 + '"></head>'
            elif case == "body_only": source.markup = f"<head></head><body>{challenge['meta_tag']}</body>"
            elif case == "rotated": issue(client, site["id"])
            elif case == "expired":
                async with persistent_database.transaction() as session:
                    delta = timedelta(days=2)
                    await session.execute(update(WebsiteRow).where(WebsiteRow.id == site["id"]).values(
                        created_at=WebsiteRow.created_at-delta, updated_at=WebsiteRow.updated_at-delta,
                        challenge_issued_at=WebsiteRow.challenge_issued_at-delta, challenge_expires_at=WebsiteRow.challenge_expires_at-delta,
                        reservation_expires_at=WebsiteRow.reservation_expires_at-delta))
        response = client.post(f"{ROOT}{site['id']}/verify", json={})
        assert response.status_code == 409
        assert response.json()["payload"]["error_code"] == "WEBSITE_CHALLENGE_INVALID"
        assert not client.get(ROOT + site["id"]).json()["payload"]["is_verified"]
        if case in {"expired", "unissued"}: assert not source.calls


@pytest.mark.parametrize("reason", list(HTMLFetchFailure))
async def test_safe_fetch_failures_never_publish_ownership_or_provider_diagnostics(persistent_database, isolated_postgres_url, accounts, reason):
    app, source = app_and_source(isolated_postgres_url); source.error = HTMLFetchError(reason)
    with BrowserClient(app) as client:
        login(client, accounts[0]); site = create(client); challenge = issue(client, site["id"])
        response = client.post(f"{ROOT}{site['id']}/verify", json={})
        assert response.status_code == 503 and response.headers["cache-control"] == "no-store"
        assert challenge["token"] not in response.text
        assert response.json()["payload"]["error_code"] == "SERVICE_UNAVAILABLE"
        assert not client.get(ROOT + site["id"]).json()["payload"]["is_verified"]


@pytest.mark.parametrize("scenario", ["anonymous", "invalid", "revoked", "inactive"])
async def test_invalid_sessions_never_issue_or_fetch(persistent_database, isolated_postgres_url, accounts, scenario):
    app, source = app_and_source(isolated_postgres_url)
    with BrowserClient(app) as client:
        login(client, accounts[0]); site = create(client)
        if scenario == "anonymous": client.cookies.clear()
        elif scenario == "invalid": client.cookies.set(COOKIE, "x"*43)
        elif scenario == "revoked": client.post("/api/auth/logout")
        else:
            async with persistent_database.transaction() as session:
                await session.execute(update(UserRow).where(UserRow.id == accounts[0].id).values(is_active=False))
        for method in ["challenge", "verify"]:
            response = client.post(f"{ROOT}{site['id']}/{method}", json={})
            assert response.status_code == 401
        assert not source.calls


async def test_csrf_body_limit_and_shared_proof_quota_precede_fetch(persistent_database, isolated_postgres_url, accounts):
    app, source = app_and_source(isolated_postgres_url, WEBSITE_PROOF_IP_LIMIT=1)
    with BrowserClient(app) as client:
        login(client, accounts[0]); site = create(client)
        invalid = TestClient.post(client, f"{ROOT}{site['id']}/challenge", json={}, headers={"Origin": "https://evil.test", "X-CSRF-Token": "bad"})
        assert invalid.status_code == 403
        issue(client, site["id"])
        limited = client.post(f"{ROOT}{site['id']}/verify", json={})
        assert limited.status_code == 429 and int(limited.headers["retry-after"]) > 0 and not source.calls
    other, source = app_and_source(isolated_postgres_url, WEBSITE_PROOF_MAX_BODY_BYTES=5)
    with BrowserClient(other) as client:
        login(client, accounts[0])
        large = client.post(f"{ROOT}{site['id']}/verify", content=b'{"private":"large"}', headers={"Content-Type": "application/json"})
        assert large.status_code == 413 and "private" not in large.text and not source.calls


def test_openapi_proof_contract_keeps_server_selected_inputs_and_cookie_csrf():
    schema = create_app(Config(_env_file=None)).openapi()
    for suffix in ["challenge", "verify"]:
        operation = schema["paths"]["/api/websites/{website_id}/"+suffix]["post"]
        assert operation["security"] == [{"OpaqueSession": []}]
        assert {p["name"] for p in operation["parameters"]} >= {"website_id", "Origin", "X-CSRF-Token"}
        assert {"401", "403", "404", "409", "413", "422", "429", "503"} <= set(operation["responses"])
    assert schema["components"]["schemas"]["WebsiteProofInput"]["additionalProperties"] is False
    assert schema["components"]["schemas"]["WebsiteProofInput"]["properties"] == {}


@pytest.mark.parametrize("placement", ["head", "script", "template", "body"])
async def test_real_tls_html_and_database_verify_only_actual_head_metadata(persistent_database, isolated_postgres_url, accounts, certificate, placement):
    import asyncio
    from app.infra.services.website_html_fetcher import SafeWebsiteHTMLFetcher
    server_context, client_context = certificate
    app = application(isolated_postgres_url)
    with BrowserClient(app) as client:
        login(client, accounts[0]); site = create(client); challenge = issue(client, site["id"])
        tag = challenge["meta_tag"]
        if placement == "head": markup = f"<html><head>{tag}</head><body>متن واقعی</body></html>"
        elif placement == "body": markup = f"<html><head></head><body>{tag}</body></html>"
        else: markup = f"<html><head><{placement}>{tag}</{placement}></head></html>"
        payload = markup.encode()
        response_bytes = b"HTTP/1.1 200 OK\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: " + str(len(payload)).encode() + b"\r\n\r\n" + payload
        async with peer([response_bytes], tls=server_context) as (port, requests, _):
            app.dependency_overrides[get_website_html_fetcher] = lambda: SafeWebsiteHTMLFetcher(
                resolver=Resolver(), network_backend=LoopbackBackend(port), ssl_context=client_context)
            response = await asyncio.to_thread(client.post, f"{ROOT}{site['id']}/verify", json={})
        assert response.status_code == (200 if placement == "head" else 409)
        assert client.get(ROOT + site["id"]).json()["payload"]["is_verified"] is (placement == "head")
        assert len(requests) == 1 and b"Host: example.test\r\n" in requests[0] and b"Cookie:" not in requests[0]
