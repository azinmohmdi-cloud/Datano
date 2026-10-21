from unittest.mock import AsyncMock
import json
import re
from http.cookies import SimpleCookie
from types import SimpleNamespace

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text

from app.application.use_cases.auth.email import IEmailSender
from app.infra.core.config import Config
from app.main import create_app
from tests.postgres import isolated_postgres_url, persistent_database
from tests.integration.test_password_recovery import recovery_account
from tests.support.browser_client import BrowserClient
from tests.integration.test_password_recovery import PASSWORD, NEW_PASSWORD
from app.infra.repositories.postgres.user_repository import SQLUserRepository
from app.infra.services.csrf_service import CsrfService
from app.interface.dependencies.recovery_dependencies import get_password_recovery_flow
from app.interface.recovery_route import get_recovery_limiter
from app.application.use_cases.auth.interfaces import RegistrationLimitDecision
from app.infra.services.registration_limiter import PostgresRegistrationLimiter
from datetime import UTC, datetime

ROOT = '/api/auth/password-recovery'


@pytest.fixture(autouse=True)
def stable_peer_window(monkeypatch):
    # Quota tests do not depend on crossing a wall-clock window boundary.
    monkeypatch.setattr('app.interface.recovery_route.PostgresRegistrationLimiter',
        lambda database, **settings: PostgresRegistrationLimiter(database, clock=lambda: datetime(2026,10,21,0,0,1,tzinfo=UTC), **settings))


def recovery_app(url, **settings):
    return create_app(Config(_env_file=None, DATABASE_URL=url.render_as_string(hide_password=False), EMAIL_CODE_HMAC_KEY='test-only-recovery-email-code-key-0001', **settings))


async def test_known_unknown_inactive_requests_have_identical_response(persistent_database, isolated_postgres_url, recovery_account):
    application = recovery_app(isolated_postgres_url)
    sender = AsyncMock(spec=IEmailSender)
    with BrowserClient(application) as client:
        application.state.email_sender = sender
        known = client.post(ROOT + '/request', json={'email': recovery_account.email})
        unknown = client.post(ROOT + '/request', json={'email': 'unknown@example.test'})
        assert known.status_code == unknown.status_code == 200
        assert known.content == unknown.content
        assert 'set-cookie' not in known.headers and 'set-cookie' not in unknown.headers
        assert sender.send.await_count == 1
        repeated = client.post(ROOT + '/request', json={'email': recovery_account.email})
        assert repeated.content == known.content and sender.send.await_count == 1
        async with persistent_database.transaction() as session:
            await session.execute(text('UPDATE users SET is_active=false WHERE id=:id'), {'id':recovery_account.id})
        inactive = client.post(ROOT + '/request', json={'email':recovery_account.email})
        assert inactive.content == known.content and inactive.status_code == 200
        assert sender.send.await_count == 1


@pytest.fixture
def recovered_browser(isolated_postgres_url, recovery_account):
    application = recovery_app(isolated_postgres_url, RECOVERY_IP_LIMIT=100)
    sender = AsyncMock(spec=IEmailSender)
    with BrowserClient(application) as client:
        application.state.email_sender = sender
        assert client.post(ROOT + '/request', json={'email':recovery_account.email}).status_code == 200
        code = re.search(r'[0-9]{8}', sender.send.call_args.args[0].text).group()
        response = client.post(ROOT + '/verify', json={'email':recovery_account.email,'code':code})
        assert response.status_code == 200
        yield client, application, sender, code, response


async def test_real_flow_revokes_all_sessions_and_requires_normal_login(persistent_database, isolated_postgres_url, recovery_account):
    application = recovery_app(isolated_postgres_url, RECOVERY_IP_LIMIT=100)
    sender = AsyncMock(spec=IEmailSender)
    with BrowserClient(recovery_app(isolated_postgres_url)) as first, BrowserClient(recovery_app(isolated_postgres_url)) as second, BrowserClient(application) as recovery:
        application.state.email_sender = sender
        for client, remember in ((first,False),(second,True)):
            login = client.post('/api/auth/login',json={'email':recovery_account.email,'password':PASSWORD,'remember_me':remember})
            assert login.status_code == 200
        original_tokens = [first.cookies['__Host-datano_session'],second.cookies['__Host-datano_session']]
        assert recovery.post(ROOT+'/request',json={'email':' RECOVER@EXAMPLE.TEST '}).status_code == 200
        code = re.search(r'[0-9]{8}', sender.send.call_args.args[0].text).group()
        verified = recovery.post(ROOT+'/verify',json={'email':recovery_account.email,'code':code})
        assert verified.status_code == 200
        assert set(verified.json()['payload']) == {'expires_in','csrf_token'}
        assert '__Host-datano_session' not in recovery.cookies
        raw_grant = recovery.cookies['__Host-datano_recovery']
        assert raw_grant not in verified.text and code not in verified.text
        reset = recovery.post(ROOT+'/reset',json={'password':NEW_PASSWORD,'password_confirmation':NEW_PASSWORD})
        assert reset.status_code == 200 and reset.json()['payload'] is None
        assert '__Host-datano_recovery' not in recovery.cookies
        assert '__Host-datano_session' not in recovery.cookies
        for token in original_tokens:
            assert recovery.get('/api/auth/me', headers={'Cookie':'__Host-datano_session='+token}).status_code == 401
        assert recovery.get('/api/auth/me').status_code == 401
        assert recovery.post('/api/auth/login',json={'email':recovery_account.email,'password':PASSWORD}).status_code == 401
        assert recovery.post('/api/auth/login',json={'email':recovery_account.email,'password':NEW_PASSWORD}).status_code == 200
        replay = recovery.post(ROOT+'/reset',json={'password':NEW_PASSWORD,'password_confirmation':NEW_PASSWORD},headers={'Cookie':'__Host-datano_recovery='+raw_grant})
        assert replay.status_code == 401


def test_recovery_cookie_is_secure_and_not_a_product_credential(recovered_browser):
    client, application, sender, code, verified = recovered_browser
    cookies = SimpleCookie()
    for value in verified.headers.get_list('set-cookie'):
        cookies.load(value)
    cookie = cookies['__Host-datano_recovery']
    assert cookie['secure'] and cookie['httponly'] and cookie['path']=='/'
    assert cookie['samesite'].lower()=='lax' and not cookie['domain'] and cookie['max-age']=='600'
    token = client.cookies['__Host-datano_recovery']
    for path in ('/api/auth/me','/api/users/','/api/roles/'):
        assert client.get(path,headers={'Cookie':'__Host-datano_session='+token}).status_code == 401
    assert client.post('/api/auth/login',json={'email':'recover@example.test','password':token}).status_code == 401


@pytest.mark.parametrize('credential', ['none','normal','jwt','code'])
def test_reset_accepts_only_the_restricted_recovery_cookie(recovered_browser, credential):
    client, application, sender, code, response = recovered_browser
    client.cookies.delete('__Host-datano_recovery')
    headers = {}
    if credential == 'normal':
        login = client.post('/api/auth/login',json={'email':'recover@example.test','password':PASSWORD})
        assert login.status_code == 200
        headers['Cookie']='__Host-datano_recovery='+client.cookies['__Host-datano_session']
    elif credential == 'jwt':
        headers['Authorization']='Bearer old-token-cannot-authorize-reset'
    elif credential == 'code':
        headers['Cookie']='__Host-datano_recovery='+code
    result = client.post(ROOT+'/reset',json={'password':NEW_PASSWORD,'password_confirmation':NEW_PASSWORD},headers=headers)
    assert result.status_code == 401


@pytest.mark.parametrize('password,confirmation', [('short','short'),('x'*129,'x'*129),('A long valid password','a different password')])
def test_invalid_new_password_keeps_grant_for_retry(recovered_browser, password, confirmation):
    client, _, _, _, _ = recovered_browser
    result=client.post(ROOT+'/reset',json={'password':password,'password_confirmation':confirmation})
    assert result.status_code == 422
    assert password not in result.text and confirmation not in result.text
    assert client.post(ROOT+'/reset',json={'password':NEW_PASSWORD,'password_confirmation':NEW_PASSWORD}).status_code == 200


def test_reset_uses_exact_unicode_password_and_works_when_smtp_is_disabled(recovered_browser):
    client, application, _, _, _ = recovered_browser
    application.state.email_sender = None
    password = ' رمز جدید فارسی ۱۲۳۴۵۶۷۸ '
    assert client.post(ROOT+'/reset',json={'password':password,'password_confirmation':password}).status_code == 200
    assert client.post('/api/auth/login',json={'email':'recover@example.test','password':password}).status_code == 200
    assert client.post('/api/auth/login',json={'email':'recover@example.test','password':password.strip()}).status_code == 401


def test_code_replay_and_unknown_identity_are_rejected(recovered_browser):
    client, _, _, code, _ = recovered_browser
    replay=client.post(ROOT+'/verify',json={'email':'recover@example.test','code':code})
    unknown=client.post(ROOT+'/verify',json={'email':'unknown@example.test','code':code})
    assert replay.status_code == unknown.status_code == 401 and replay.content == unknown.content


@pytest.mark.parametrize('endpoint,body', [('request',{}),('verify',{'email':'recover@example.test'}),('reset',{'password':'secret-not-for-output'})])
def test_request_validation_redacts_all_credential_inputs(recovered_browser, endpoint, body):
    client, _, _, _, _ = recovered_browser
    body={**body,'unexpected_secret':'private-provider-secret CODE=87654321'}
    result=client.post(ROOT+'/'+endpoint,json=body)
    assert result.status_code == 422
    assert '87654321' not in result.text and 'private-provider-secret' not in result.text
    assert 'secret-not-for-output' not in result.text
    assert all(set(error) <= {'loc','msg','type'} for error in result.json()['detail'])


@pytest.mark.parametrize('endpoint', ['request','verify','reset'])
async def test_origin_and_csrf_precede_recovery_body_or_account_access(persistent_database, isolated_postgres_url, endpoint):
    application=recovery_app(isolated_postgres_url)
    with TestClient(application,base_url='https://testserver') as client:
        result=client.post(ROOT+'/'+endpoint,content='invalid body',headers={'Origin':'https://evil.test'})
        assert result.status_code == 403
    async with persistent_database.transaction() as session:
        assert await session.scalar(text('SELECT count(*) FROM registration_attempts')) == 0


async def test_peer_quota_is_shared_by_recovery_steps_and_is_separate_from_login(persistent_database, isolated_postgres_url):
    application=recovery_app(isolated_postgres_url, RECOVERY_IP_LIMIT=2)
    sender=AsyncMock(spec=IEmailSender)
    with BrowserClient(application) as client:
        application.state.email_sender=sender
        assert client.post(ROOT+'/request',json={'email':'unknown@example.test'}).status_code == 200
        assert client.post(ROOT+'/verify',json={'email':'unknown@example.test','code':'bad'}).status_code == 401
        result=client.post(ROOT+'/reset',json={'password':NEW_PASSWORD,'password_confirmation':NEW_PASSWORD})
        assert result.status_code == 429 and int(result.headers['retry-after']) > 0
        assert client.post('/api/auth/login',json={'email':'unknown@example.test','password':PASSWORD}).status_code == 401


async def test_recovery_body_limit_precedes_schema_validation(persistent_database, isolated_postgres_url):
    application=recovery_app(isolated_postgres_url, RECOVERY_MAX_BODY_BYTES=128)
    with BrowserClient(application) as client:
        assert client.post(ROOT+'/request',content='x'*129).status_code == 413


async def test_missing_mail_or_hmac_is_uniformly_unavailable(persistent_database, isolated_postgres_url):
    application=recovery_app(isolated_postgres_url)
    with BrowserClient(application) as client:
        known=client.post(ROOT+'/request',json={'email':'recover@example.test'})
        unknown=client.post(ROOT+'/request',json={'email':'unknown@example.test'})
        assert known.status_code == unknown.status_code == 503 and known.content == unknown.content
        application.state.settings.email_code_hmac_key = None
        assert client.post(ROOT+'/request',json={'email':'unknown@example.test'}).status_code == 503


async def test_response_body_is_sent_before_any_account_lookup(persistent_database, isolated_postgres_url):
    application=recovery_app(isolated_postgres_url)
    events=[]
    async def dispatch(email):
        assert any(item['type']=='http.response.body' for item in events)
        events.append({'type':'account-lookup'})
    application.dependency_overrides[get_password_recovery_flow]=lambda: SimpleNamespace(dispatch=dispatch)
    limiter=AsyncMock()
    limiter.consume.return_value=RegistrationLimitDecision(True)
    application.dependency_overrides[get_recovery_limiter]=lambda request: limiter
    service=CsrfService.from_config(application.state.settings)
    nonce=service.nonce()
    body=json.dumps({'email':'unknown@example.test'}).encode()
    scope={'type':'http','asgi':{'version':'3.0'},'http_version':'1.1','method':'POST','scheme':'https',
        'path':ROOT+'/request','raw_path':(ROOT+'/request').encode(),'query_string':b'', 'root_path':'',
        'server':('testserver',443),'client':('127.0.0.1',1234),'headers':[(b'host',b'testserver'),(b'content-type',b'application/json'),
        (b'origin',b'https://testserver'),(b'cookie',('__Host-datano_csrf='+nonce).encode()),(b'x-csrf-token',service.token(nonce,None).encode())]}
    async def receive():
        return {'type':'http.request','body':body,'more_body':False}
    async def send(message):
        events.append(message)
    await application(scope,receive,send)
    assert events[-1]['type']=='account-lookup'


async def test_mail_failure_preserves_same_public_acknowledgement(persistent_database, isolated_postgres_url, recovery_account, caplog):
    application=recovery_app(isolated_postgres_url)
    sender=AsyncMock(spec=IEmailSender)
    sender.send.side_effect=RuntimeError('private-provider-secret CODE=87654321')
    with BrowserClient(application) as client:
        application.state.email_sender=sender
        known=client.post(ROOT+'/request',json={'email':recovery_account.email})
        unknown=client.post(ROOT+'/request',json={'email':'unknown@example.test'})
        assert known.status_code == unknown.status_code == 200 and known.content == unknown.content
        assert 'dispatch failed' in caplog.text
        assert 'private-provider-secret' not in caplog.text and '87654321' not in caplog.text


async def test_code_attempt_limit_is_enforced_through_public_verify(persistent_database, isolated_postgres_url, recovery_account):
    application=recovery_app(isolated_postgres_url, RECOVERY_IP_LIMIT=100)
    sender=AsyncMock(spec=IEmailSender)
    with BrowserClient(application) as client:
        application.state.email_sender=sender
        assert client.post(ROOT+'/request',json={'email':recovery_account.email}).status_code == 200
        code=re.search(r'[0-9]{8}',sender.send.call_args.args[0].text).group()
        for _ in range(5):
            assert client.post(ROOT+'/verify',json={'email':recovery_account.email,'code':'bad'}).status_code == 401
        assert client.post(ROOT+'/verify',json={'email':recovery_account.email,'code':code}).status_code == 401
        assert '__Host-datano_recovery' not in client.cookies


async def test_password_change_invalidates_previously_issued_mail_code(persistent_database, isolated_postgres_url, recovery_account):
    application=recovery_app(isolated_postgres_url)
    sender=AsyncMock(spec=IEmailSender)
    with BrowserClient(application) as client:
        application.state.email_sender=sender
        assert client.post(ROOT+'/request',json={'email':recovery_account.email}).status_code == 200
        code=re.search(r'[0-9]{8}',sender.send.call_args.args[0].text).group()
        async with persistent_database.transaction() as session:
            assert await SQLUserRepository(session).replace_password_hash(recovery_account.id,recovery_account.hashed_password,'changed-hash')
        assert client.post(ROOT+'/verify',json={'email':recovery_account.email,'code':code}).status_code == 401


def test_successful_reset_also_expires_retired_refresh_cookie(recovered_browser):
    client, _, _, _, _ = recovered_browser
    client.cookies.set('refresh_token','retired-test-token',domain='testserver.local',path='/')
    result=client.post(ROOT+'/reset',json={'password':NEW_PASSWORD,'password_confirmation':NEW_PASSWORD})
    assert result.status_code == 200
    assert 'refresh_token' not in client.cookies
