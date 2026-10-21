"""Real persistence and server ownership; no application DB or external service."""
import asyncio
from datetime import UTC, datetime

import pytest
from fastapi import Depends
from sqlalchemy import text

from app.application.use_cases.auth.admin_policy import AdminEmailPolicy
from app.domain.entities import UserEntity
from app.infra.core.config import Config
from app.infra.database.bootstrap import ensure_required_roles
from app.infra.repositories.postgres.admin_proof_repository import PostgresAdminProofRepository
from app.infra.repositories.postgres.role_repository import SQLRoleRepository
from app.infra.repositories.postgres.user_repository import SQLUserRepository
from app.infra.services import Argon2PasswordService, JoseTokenService
from app.interface.dependencies.database_dependencies import get_database_session
from app.interface.dependencies.user_dependencies import get_user_repository
from app.main import create_app
from tests.postgres import isolated_postgres_url, persistent_database
from tests.support.browser_client import BrowserClient

PASSWORD='Profile fixture password!'
COOKIE='__Host-datano_session'


def application(url,**settings):
    return create_app(Config(_env_file=None,DATABASE_URL=url.render_as_string(hide_password=False),**settings))


@pytest.fixture
async def accounts(persistent_database):
    password_hash=Argon2PasswordService().hash(PASSWORD)
    users=[UserEntity.create(first_name=name,last_name='Owner',email=name.lower()+'@example.test',
        username=name.lower()+'-owner',hashed_password=password_hash) for name in ('Self','Other')]
    async with persistent_database.transaction() as session:
        await ensure_required_roles(session)
        role=await SQLRoleRepository(session).get_by_name('User')
        for user in users:
            user.activate()
            await SQLUserRepository(session).create(user)
            await SQLUserRepository(session).assign_role(user.id,role.id)
    return users


def login(client,user):
    response=client.post('/api/auth/login',json={'email':user.email,'password':PASSWORD})
    assert response.status_code == 200
    return response


async def snapshots(database):
    async with database.transaction() as session:
        return [dict(row) for row in (await session.execute(text('SELECT * FROM users ORDER BY id'))).mappings()]


async def test_ordinary_user_edits_only_self_and_names_persist_after_restart(persistent_database,isolated_postgres_url,accounts):
    owner,other=accounts
    before=await snapshots(persistent_database)
    with BrowserClient(application(isolated_postgres_url)) as client:
        assert login(client,owner).json()['payload']['effective_role'] == 'User'
        token=client.cookies[COOKIE]
        assert client.get('/api/users/').status_code == 403
        assert client.put('/api/users/'+other.id,json={'first_name':'Denied'}).status_code == 403
        changed=client.patch('/api/auth/me?user_id='+other.id,json={'first_name':'  آوا\u200cآذری  ','last_name':'Cafe\u0301'})
        assert changed.status_code == 200
        body=changed.json()['payload']
        assert body['id'] == owner.id and body['effective_role'] == 'User'
        assert body['first_name'] == '  آوا\u200cآذری  ' and body['last_name'] == 'Cafe\u0301'
        assert body['email'] == owner.email and body['is_active']
        assert not {'hashed_password','email_key','digest'} & body.keys()
        assert client.cookies[COOKIE] == token and 'set-cookie' not in changed.headers
        assert client.patch('/api/auth/me/'+other.id,json={'first_name':'Denied'}).status_code == 404
    after=await snapshots(persistent_database)
    for row,original in zip(after,before):
        if row['id'] == other.id:
            assert row == original
        else:
            assert {k:v for k,v in row.items() if k not in {'first_name','last_name','updated_at'}} == {
                k:v for k,v in original.items() if k not in {'first_name','last_name','updated_at'}}
    with BrowserClient(application(isolated_postgres_url)) as restarted:
        response=restarted.get('/api/auth/me',headers={'Cookie':COOKIE+'='+token})
        assert response.status_code == 200 and response.json()['payload'] == body


@pytest.mark.parametrize('body',[{'first_name':'Must not persist','last_name':' '},
    {'first_name':'Must not persist','is_active':False}, {'first_name':'Must not persist','roles':['Admin']}])
async def test_invalid_patch_keeps_all_database_user_fields(persistent_database,isolated_postgres_url,accounts,body):
    before=await snapshots(persistent_database)
    with BrowserClient(application(isolated_postgres_url)) as client:
        login(client,accounts[0])
        response=client.patch('/api/auth/me',json=body)
        assert response.status_code == 422
    assert await snapshots(persistent_database) == before


async def test_failed_write_rolls_back_names_and_keeps_current_cookie(persistent_database,isolated_postgres_url,accounts):
    class FailingUsers(SQLUserRepository):
        async def update_profile_names(self,*args,**kwargs):
            await super().update_profile_names(*args,**kwargs)
            raise RuntimeError('Injected profile write failure')
    async def repository(session=Depends(get_database_session)):
        return FailingUsers(session)
    app=application(isolated_postgres_url)
    app.dependency_overrides[get_user_repository]=repository
    before=await snapshots(persistent_database)
    with BrowserClient(app,raise_server_exceptions=False) as client:
        login(client,accounts[0])
        token=client.cookies[COOKIE]
        response=client.patch('/api/auth/me',json={'first_name':'Must not persist','last_name':'Must not persist'})
        assert response.status_code == 500 and 'Injected profile write failure' not in response.text
        assert 'set-cookie' not in response.headers and client.cookies[COOKIE] == token
        assert client.get('/api/auth/me').json()['payload']['first_name'] == accounts[0].first_name
    assert await snapshots(persistent_database) == before


async def test_narrow_write_cannot_overwrite_newer_identity_or_omitted_name(persistent_database,accounts):
    owner=accounts[0]
    async with persistent_database.transaction() as session:
        await session.execute(text("UPDATE users SET hashed_password='new-test-hash', email='new@example.test',email_key='new@example.test',last_name='Newest surname' WHERE id=:id"),{'id':owner.id})
    async with persistent_database.transaction() as session:
        updated=await SQLUserRepository(session).update_profile_names(owner.id,first_name='New given name',
            last_name=None,updated_at=datetime.now(UTC))
        assert updated.hashed_password == 'new-test-hash' and updated.email == 'new@example.test'
        assert updated.last_name == 'Newest surname' and updated.first_name == 'New given name'


async def test_parallel_disjoint_patches_preserve_both_names(persistent_database,accounts):
    async def change(**names):
        async with persistent_database.transaction() as session:
            return await SQLUserRepository(session).update_profile_names(accounts[0].id,
                first_name=names.get('first_name'),last_name=names.get('last_name'),updated_at=datetime.now(UTC))
    await asyncio.gather(change(first_name='Concurrent given'),change(last_name='Concurrent surname'))
    async with persistent_database.transaction() as session:
        user=await SQLUserRepository(session).get_by_id(accounts[0].id)
        assert user.first_name == 'Concurrent given' and user.last_name == 'Concurrent surname'


@pytest.mark.parametrize('state',['missing','inactive'])
async def test_narrow_write_never_creates_or_reactivates_account(persistent_database,accounts,state):
    owner=accounts[0]
    async with persistent_database.transaction() as session:
        if state == 'missing': await SQLUserRepository(session).delete(owner.id)
        else: await session.execute(text('UPDATE users SET is_active=false WHERE id=:id'),{'id':owner.id})
        assert await SQLUserRepository(session).update_profile_names(owner.id,first_name='Denied',
            last_name=None,updated_at=datetime.now(UTC)) is None


@pytest.mark.parametrize('state',['expired','revoked','inactive','deleted'])
async def test_invalid_session_cannot_edit_even_with_valid_legacy_bearer(persistent_database,isolated_postgres_url,accounts,state):
    owner=accounts[0]
    with BrowserClient(application(isolated_postgres_url)) as client:
        login(client,owner)
        token=client.cookies[COOKIE]
        async with persistent_database.transaction() as session:
            if state == 'expired':
                await session.execute(text("UPDATE auth_sessions SET created_at=created_at-interval '1 hour',last_seen_at=last_seen_at-interval '1 hour',idle_expires_at=idle_expires_at-interval '1 hour' WHERE user_id=:id"),{'id':owner.id})
            elif state == 'revoked':
                await session.execute(text('UPDATE auth_sessions SET revoked_at=last_seen_at WHERE user_id=:id'),{'id':owner.id})
            elif state == 'inactive':
                await session.execute(text('UPDATE users SET is_active=false WHERE id=:id'),{'id':owner.id})
            else: await SQLUserRepository(session).delete(owner.id)
        before=await snapshots(persistent_database)
        bearer=JoseTokenService().generate_access_token({'sub':owner.id,'username':owner.username})
        response=client.patch('/api/auth/me',json={'first_name':'Denied'},headers={'Authorization':'Bearer '+bearer})
        assert response.status_code == 401 and token not in response.text
        assert client.get('/api/auth/me').status_code == 401
    assert await snapshots(persistent_database) == before


@pytest.mark.parametrize('verified',[False,True])
async def test_profile_write_preserves_verified_authority_and_never_exposes_raw_admin_assignment(
        persistent_database,isolated_postgres_url,accounts,verified):
    owner=accounts[0]
    policy=AdminEmailPolicy.parse('["self@example.test"]')
    async with persistent_database.transaction() as session:
        role=await SQLRoleRepository(session).get_by_name('Admin')
        await SQLUserRepository(session).assign_role(owner.id,role.id)
    if verified: assert await PostgresAdminProofRepository(persistent_database,policy).provision(owner.id)
    with BrowserClient(application(isolated_postgres_url,ADMIN_EMAIL_ALLOWLIST='["self@example.test"]')) as client:
        login(client,owner)
        response=client.patch('/api/auth/me',json={'last_name':'Updated'})
        assert response.status_code == 200
        body=response.json()['payload']
        assert body['effective_role'] == ('Admin' if verified else 'User')
        assert any(role['name']=='Admin' for role in body['roles']) is verified
        assert client.get('/api/users/').status_code == (200 if verified else 403)
    async with persistent_database.transaction() as session:
        assert await session.scalar(text('SELECT count(*) FROM admin_grants WHERE user_id=:id'),{'id':owner.id}) == int(verified)
