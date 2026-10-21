from datetime import UTC, datetime
from http.cookies import SimpleCookie
import re
from unittest.mock import AsyncMock

import pytest
from sqlalchemy import text

from app.application.use_cases.auth.email import IEmailSender
from app.infra.core.config import Config
from app.infra.services.session_token_service import OpaqueSessionTokens
from app.main import create_app
from tests.postgres import isolated_postgres_url, persistent_database
from tests.support.browser_client import BrowserClient

ROOT = "/api/auth/admin-email"
COOKIE = "__Host-datano_session"
EMAIL = "eligible@example.test"
PASSWORD = "Administrator fixture password!"


def admin_app(url, **settings):
    defaults = dict(DATABASE_URL=url.render_as_string(hide_password=False),
        ADMIN_EMAIL_ALLOWLIST='[" ELIGIBLE@example.test ","private-other@example.test"]',
        EMAIL_CODE_HMAC_KEY="test-only-admin-mailbox-hmac-key-0001")
    return create_app(Config(_env_file=None, **(defaults | settings)))


@pytest.mark.parametrize("remember", [False, True])
async def test_mailbox_proof_rotates_current_session_and_revokes_all_older_sessions(persistent_database, isolated_postgres_url, remember):
    application = admin_app(isolated_postgres_url)
    sender = AsyncMock(spec=IEmailSender)
    with BrowserClient(application) as client, BrowserClient(admin_app(isolated_postgres_url)) as other:
        application.state.email_sender = sender
        registered = client.post("/api/auth/register", json={"first_name":"Proof", "last_name":"Owner", "email":EMAIL, "password":PASSWORD})
        assert registered.status_code == 201
        user_id = registered.json()["payload"]["id"]
        login = client.post("/api/auth/login", json={"email":EMAIL, "password":PASSWORD, "remember_me":remember})
        assert login.status_code == 200 and login.json()["payload"]["effective_role"] == "User"
        previous, old_csrf = client.cookies[COOKIE], login.json()["payload"]["csrf_token"]
        assert other.post("/api/auth/login",json={"email":EMAIL,"password":PASSWORD,"remember_me":not remember}).status_code == 200
        other_token = other.cookies[COOKIE]
        async with persistent_database.transaction() as session:
            previous_absolute = await session.scalar(text("SELECT absolute_expires_at FROM auth_sessions WHERE digest=:d"), {"d":OpaqueSessionTokens().digest(previous)})
        requested = client.post(ROOT+"/request", json={})
        assert requested.status_code == 200
        sender.send.assert_awaited_once()
        assert sender.send.call_args.args[0].recipient == EMAIL
        code = re.search(r"[0-9]{8}",sender.send.call_args.args[0].text).group()
        assert code not in requested.text
        verified = client.post(ROOT+"/verify",json={"code":code})
        assert verified.status_code == 200
        fresh = client.cookies[COOKIE]
        assert fresh != previous and fresh not in verified.text and code not in verified.text
        assert verified.json()["payload"]["effective_role"] == "Admin"
        assert "private-other@example.test" not in verified.text
        cookies = SimpleCookie()
        for value in verified.headers.get_list("set-cookie"): cookies.load(value)
        assert cookies[COOKIE]["secure"] and cookies[COOKIE]["httponly"]
        assert cookies[COOKIE]["samesite"].lower() == "lax" and not cookies[COOKIE]["domain"]
        assert bool(cookies[COOKIE]["max-age"]) is remember
        assert client.get("/api/auth/me").json()["payload"]["effective_role"] == "Admin"
        assert client.get("/api/users/").status_code == 200
        for old in (previous,other_token):
            assert client.get("/api/auth/me",headers={"Cookie":COOKIE+"="+old}).status_code == 401
        assert client.post(ROOT+"/verify",json={"code":code},headers={"X-CSRF-Token":old_csrf}).status_code == 403
        assert client.post(ROOT+"/verify",json={"code":code}).status_code == 401
        async with persistent_database.transaction() as session:
            assert await session.scalar(text("SELECT count(*) FROM admin_grants WHERE user_id=:id AND method='email'"),{"id":user_id}) == 1
            assert await session.scalar(text("SELECT count(*) FROM auth_sessions WHERE user_id=:id AND revoked_at IS NULL"),{"id":user_id}) == 1
            absolute = await session.scalar(text("SELECT absolute_expires_at FROM auth_sessions WHERE digest=:d"),{"d":OpaqueSessionTokens().digest(fresh)})
            assert absolute == previous_absolute


def register_and_login(client, email=EMAIL):
    registered=client.post('/api/auth/register',json={'first_name':'Proof','last_name':'Owner','email':email,'password':PASSWORD})
    assert registered.status_code == 201
    assert client.post('/api/auth/login',json={'email':email,'password':PASSWORD}).status_code == 200
    return registered.json()['payload']['id']


@pytest.mark.parametrize('eligible',[False,True])
async def test_acknowledgement_does_not_disclose_eligibility_and_raw_assignment_grants_nothing(
        persistent_database,isolated_postgres_url,eligible):
    app=admin_app(isolated_postgres_url,ADMIN_EMAIL_ALLOWLIST='["eligible@example.test"]' if eligible else '[]')
    sender=AsyncMock(spec=IEmailSender)
    with BrowserClient(app) as client:
        app.state.email_sender=sender
        user_id=register_and_login(client)
        async with persistent_database.transaction() as session:
            await session.execute(text("INSERT INTO user_roles(user_id,role_id) SELECT :id,id FROM roles WHERE name='Admin'"),{'id':user_id})
        identity=client.get('/api/auth/me')
        assert identity.json()['payload']['effective_role'] == 'User'
        assert all(role['name'] != 'Admin' for role in identity.json()['payload']['roles'])
        assert client.get('/api/users/').status_code == 403
        response=client.post(ROOT+'/request',json={})
        assert response.status_code == 200
        assert response.json() == {'success':True,'message':'If eligible, a verification code will be sent to the account mailbox','payload':None}
        assert response.headers['cache-control'] == 'no-store'
        assert sender.send.await_count == int(eligible)
        assert client.post(ROOT+'/verify',json={'code':'not-a-code'}).status_code == 401
        assert client.get('/api/auth/me').json()['payload']['effective_role'] == 'User'


@pytest.mark.parametrize('action',['request','verify'])
async def test_proof_requires_cookie_csrf_origin_and_strict_self_only_body(persistent_database,isolated_postgres_url,action):
    app=admin_app(isolated_postgres_url)
    with BrowserClient(app) as client:
        app.state.email_sender=AsyncMock(spec=IEmailSender)
        register_and_login(client)
        body={} if action == 'request' else {'code':'12345678'}
        path=ROOT+'/'+action
        assert client.post(path,json=body,headers={'X-CSRF-Token':'bad'}).status_code == 403
        assert client.post(path,json=body,headers={'Origin':'https://attacker.test'}).status_code == 403
        for extra in ({'email':'private-other@example.test'},{'role':'Admin'},{'user_id':'other'}):
            response=client.post(path,json=body|extra)
            assert response.status_code == 422
            assert extra[next(iter(extra))] not in response.text
        client.cookies.clear()
        assert client.post(path,json=body,headers={'Authorization':'Bearer legacy'}).status_code == 401
        app.state.email_sender.send.assert_not_awaited()


async def test_proof_limits_body_and_ip_before_validation(persistent_database,isolated_postgres_url,monkeypatch):
    from app.interface import admin_email_route
    from app.infra.services.registration_limiter import PostgresRegistrationLimiter
    monkeypatch.setattr(admin_email_route,'PostgresRegistrationLimiter',lambda database,**settings:
        PostgresRegistrationLimiter(database,clock=lambda:datetime(2026,10,21,tzinfo=UTC),**settings))
    app=admin_app(isolated_postgres_url,ADMIN_PROOF_MAX_BODY_BYTES=80,ADMIN_PROOF_IP_LIMIT=2)
    with BrowserClient(app) as client:
        app.state.email_sender=AsyncMock(spec=IEmailSender)
        register_and_login(client)
        assert client.post(ROOT+'/request',content='x'*81).status_code == 413
        assert client.post(ROOT+'/verify',json={'code':'bad'}).status_code == 401
        limited=client.post(ROOT+'/request',json={})
        assert limited.status_code == 429 and 1 <= int(limited.headers['retry-after']) <= 600
        app.state.email_sender.send.assert_not_awaited()


async def test_smtp_failure_is_generic_and_pending_code_cannot_promote(persistent_database,isolated_postgres_url,caplog):
    app=admin_app(isolated_postgres_url)
    sender=AsyncMock(spec=IEmailSender)
    sender.send.side_effect=RuntimeError('private-provider-error')
    with BrowserClient(app) as client:
        app.state.email_sender=sender
        register_and_login(client)
        response=client.post(ROOT+'/request',json={})
        assert response.status_code == 200
        code=re.search(r'[0-9]{8}',sender.send.call_args.args[0].text).group()
        assert client.post(ROOT+'/verify',json={'code':code}).status_code == 401
        assert 'private-provider-error' not in response.text + caplog.text
        assert code not in response.text + caplog.text
        assert client.get('/api/auth/me').json()['payload']['effective_role'] == 'User'


async def test_empty_mail_configuration_fails_closed_without_exposing_secrets(persistent_database,isolated_postgres_url):
    app=admin_app(isolated_postgres_url,EMAIL_CODE_HMAC_KEY=None)
    with BrowserClient(app) as client:
        register_and_login(client)
        response=client.post(ROOT+'/request',json={})
        assert response.status_code == 503
        assert 'private-other@example.test' not in response.text
        assert client.get('/api/auth/me').json()['payload']['effective_role'] == 'User'


async def test_allowlist_removal_immediately_removes_effective_authority(persistent_database,isolated_postgres_url):
    app=admin_app(isolated_postgres_url)
    with BrowserClient(app) as client:
        app.state.email_sender=AsyncMock(spec=IEmailSender)
        register_and_login(client)
        assert client.post(ROOT+'/request',json={}).status_code == 200
        code=re.search(r'[0-9]{8}',app.state.email_sender.send.call_args.args[0].text).group()
        assert client.post(ROOT+'/verify',json={'code':code}).status_code == 200
        token=client.cookies[COOKIE]
    with BrowserClient(admin_app(isolated_postgres_url)) as restarted:
        identity=restarted.get('/api/auth/me',headers={'Cookie':COOKIE+'='+token})
        assert identity.status_code == 200 and identity.json()['payload']['effective_role'] == 'Admin'
        assert restarted.get('/api/users/',headers={'Cookie':COOKIE+'='+token}).status_code == 200
    with BrowserClient(admin_app(isolated_postgres_url,ADMIN_EMAIL_ALLOWLIST='[]')) as restarted:
        identity=restarted.get('/api/auth/me',headers={'Cookie':COOKIE+'='+token})
        assert identity.status_code == 200 and identity.json()['payload']['effective_role'] == 'User'
        assert restarted.get('/api/users/',headers={'Cookie':COOKIE+'='+token}).status_code == 403


def test_actual_openapi_has_self_only_proof_contract_without_private_configuration():
    # Schema generation does not connect, migrate, provision or send mail.
    app=admin_app(__import__('sqlalchemy').engine.make_url('postgresql+psycopg://localhost/datano_test_schema'))
    schema=app.openapi()
    for action,model in [('request','AdminEmailRequest'),('verify','AdminEmailCode')]:
        operation=schema['paths'][ROOT+'/'+action]['post']
        assert {'200','401','413','429','503'} <= operation['responses'].keys()
        definition=schema['components']['schemas'][model]
        assert definition['additionalProperties'] is False
        assert set(definition.get('properties',{})) == ({'code'} if action == 'verify' else set())
    serialized=str(schema)
    assert 'private-other@example.test' not in serialized and 'ADMIN_EMAIL_ALLOWLIST' not in serialized
