"""Self profile contract, using the existing isolated authenticated HTTP fixture."""
import json

import pytest


def test_session_owner_can_edit_names_without_replacing_session(test_client, admin_auth):
    current=test_client.get('/api/auth/me',headers=admin_auth)
    assert current.status_code == 200
    before=current.json()['payload']
    response=test_client.patch('/api/auth/me',headers=admin_auth,
        json={'first_name':'نام تازه','last_name':'نام خانوادگی تازه'})
    assert response.status_code == 200
    after=response.json()['payload']
    assert after['first_name'] == 'نام تازه' and after['last_name'] == 'نام خانوادگی تازه'
    for field in ('id','email','username','is_active','roles','effective_role','created_at'):
        assert after[field] == before[field]
    assert response.headers['cache-control'] == 'no-store'
    assert 'set-cookie' not in response.headers
    assert test_client.get('/api/auth/me',headers=admin_auth).json()['payload'] == after


@pytest.mark.parametrize('body',[
    {}, {'first_name':None}, {'last_name':None}, {'first_name':42}, {'last_name':False},
    {'first_name':[]}, {'first_name':'','last_name':'Valid'}, {'first_name':'Valid','last_name':'\u2003\t '},
    {'first_name':'\ud800'}, {'last_name':'bad\x00name'},
    {'first_name':'Forged','role':'Admin'}, {'first_name':'Forged','roles':[]},
    {'first_name':'Forged','is_active':False}, {'first_name':'Forged','email':'forged@example.test'},
    {'first_name':'Forged','username':'forged'}, {'first_name':'Forged','password':'private-input-must-not-echo'},
    {'first_name':'Forged','user_id':'someone-else'}, {'first_name':'Forged','id':'someone-else'},
])
def test_invalid_or_privilege_changing_patch_is_atomic(test_client,admin_auth,body):
    before=test_client.get('/api/auth/me',headers=admin_auth).json()['payload']
    response=test_client.patch('/api/auth/me',headers=admin_auth|{'Content-Type':'application/json'},
        content=json.dumps(body,ensure_ascii=True))
    assert response.status_code == 422
    assert 'private-input-must-not-echo' not in response.text
    after=test_client.get('/api/auth/me',headers=admin_auth).json()['payload']
    assert after == before


def test_profile_changes_require_origin_and_bound_csrf(test_client,admin_auth):
    before=test_client.get('/api/auth/me',headers=admin_auth).json()['payload']
    for headers in ({'X-CSRF-Token':'wrong'},{'Origin':'https://attacker.test'}):
        response=test_client.patch('/api/auth/me',json={'first_name':'Denied'},headers=admin_auth|headers)
        assert response.status_code == 403
    assert test_client.get('/api/auth/me',headers=admin_auth).json()['payload'] == before


def test_missing_cookie_and_legacy_bearer_cannot_read_or_change_profile(test_client):
    for headers in ({},{'Authorization':'Bearer legacy-untrusted'}):
        assert test_client.get('/api/auth/me',headers=headers).status_code == 401
        assert test_client.patch('/api/auth/me',json={'first_name':'Denied'},headers=headers).status_code == 401


def test_partial_update_ignores_query_identity_and_preserves_omitted_name(test_client,admin_auth):
    before=test_client.get('/api/auth/me',headers=admin_auth).json()['payload']
    response=test_client.patch('/api/auth/me?user_id=another-account&role=Admin',headers=admin_auth,
        json={'last_name':'نام تازه'})
    assert response.status_code == 200
    after=response.json()['payload']
    assert after['id'] == before['id'] and after['first_name'] == before['first_name']
    assert after['last_name'] == 'نام تازه'
    assert test_client.get('/api/auth/me?user_id=another-account',headers=admin_auth).json()['payload'] == after


def test_openapi_exposes_only_optional_nonnullable_names_for_self_patch(test_client):
    schema=test_client.get('/openapi.json').json()
    operation=schema['paths']['/api/auth/me']['patch']
    assert operation['security'] == [{'OpaqueSession':[]}]
    assert {'200','401','403','422'} <= operation['responses'].keys()
    assert {p['name'] for p in operation['parameters']} >= {'Origin','X-CSRF-Token'}
    body=schema['components']['schemas']['OwnProfileUpdate']
    assert body['additionalProperties'] is False
    assert set(body['properties']) == {'first_name','last_name'}
    assert body['minProperties'] == 1
    for name in body['properties'].values():
        assert name['type'] == 'string' and 'anyOf' not in name
