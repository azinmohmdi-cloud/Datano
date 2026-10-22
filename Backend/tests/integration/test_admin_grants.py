import pytest
from sqlalchemy import text

from app.application.use_cases.auth.admin_policy import AdminEmailPolicy
from app.domain.entities import UserEntity
from app.infra.database.bootstrap import ensure_required_roles
from app.infra.repositories.postgres.admin_grant_repository import SQLAdminGrantRepository
from app.infra.repositories.postgres.admin_proof_repository import PostgresAdminProofRepository
from app.infra.repositories.postgres.role_repository import SQLRoleRepository
from app.infra.repositories.postgres.user_repository import SQLUserRepository

from tests.postgres import isolated_postgres_url, persistent_database


async def test_latest_migration_has_persistent_admin_authority_without_auto_provisioning(persistent_database):
    async with persistent_database.transaction() as session:
        assert await session.scalar(text("SELECT to_regclass('admin_grants')")) is not None
        assert await session.scalar(text("SELECT count(*) FROM admin_grants")) == 0


@pytest.fixture
async def authority_account(persistent_database):
    user = UserEntity.create(first_name="Authority",last_name="Owner",email="authority@example.test",
        username="authority-owner",hashed_password="test-only-hash")
    user.activate()
    async with persistent_database.transaction() as session:
        await ensure_required_roles(session)
        await SQLUserRepository(session).create(user)
    return user


@pytest.mark.parametrize("change",["email","activation"])
async def test_changing_away_and_back_does_not_restore_old_authority(persistent_database, authority_account, change):
    repository = PostgresAdminProofRepository(persistent_database,AdminEmailPolicy.parse('["authority@example.test"]'))
    assert await repository.provision(authority_account.id)
    async with persistent_database.transaction() as session:
        users = SQLUserRepository(session)
        admin = await SQLRoleRepository(session).get_by_name("Admin")
        assert await SQLAdminGrantRepository(session).verified(authority_account.id,authority_account.email,admin)
        user = await users.get_by_id(authority_account.id)
        if change == "email": user.update_info(email="changed@example.test")
        else: user.deactivate()
        await users.update(user)
        if change == "email": user.update_info(email=authority_account.email)
        else: user.activate()
        await users.update(user)
        assert not await SQLAdminGrantRepository(session).verified(user.id,user.email,admin)


@pytest.mark.parametrize('mutation',[
    "email_key=' Authority@example.test '","email_key=''",
    "role_state=decode('aa','hex')","method='unverified'",
    "user_id='missing-user'","role_id='missing-role'",
])
async def test_authority_database_constraints(persistent_database,authority_account,mutation):
    from sqlalchemy.exc import IntegrityError
    assert await PostgresAdminProofRepository(persistent_database,
        AdminEmailPolicy.parse('["authority@example.test"]')).provision(authority_account.id)
    with pytest.raises(IntegrityError):
        async with persistent_database.transaction() as session:
            await session.execute(text('UPDATE admin_grants SET '+mutation))


@pytest.mark.parametrize('table',['users','roles'])
async def test_deleted_account_or_role_cascades_authority(persistent_database,authority_account,table):
    assert await PostgresAdminProofRepository(persistent_database,
        AdminEmailPolicy.parse('["authority@example.test"]')).provision(authority_account.id)
    async with persistent_database.transaction() as session:
        if table == 'users':
            await session.execute(text('DELETE FROM users WHERE id=:id'),{'id':authority_account.id})
        else:
            await session.execute(text("DELETE FROM roles WHERE name='Admin'"))
        assert await session.scalar(text('SELECT count(*) FROM admin_grants')) == 0


async def test_admin_migration_preserves_existing_identity_sessions_and_recovery(isolated_postgres_url):
    from sqlalchemy import inspect
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext
    from app.infra.database.connection import Database
    from app.infra.database.models import Base
    from app.infra.repositories.postgres.session_repository import SQLSessionRepository
    from tests.postgres import migrate
    database=Database(isolated_postgres_url)
    try:
        async with database.engine.begin() as connection:
            await connection.run_sync(migrate,'0007_password_recovery')
        user=UserEntity.create(first_name='Existing',last_name='Owner',email='existing@example.test',
            username='existing-owner',hashed_password='test-only-retained-hash')
        user.activate()
        async with database.transaction() as session:
            await ensure_required_roles(session)
            await SQLUserRepository(session).create(user)
            role=await SQLRoleRepository(session).get_by_name('Admin')
            await SQLUserRepository(session).assign_role(user.id,role.id)
            await SQLSessionRepository(session).create(b'a'*32,user.id,remember_me=True,
                idle_seconds=604800,absolute_seconds=2592000)
        async with database.engine.begin() as connection:
            tables=await connection.run_sync(lambda sync:inspect(sync).get_table_names())
            tables.remove('alembic_version')
            snapshots={table:[dict(row) for row in (await connection.execute(text('SELECT * FROM '+table))).mappings()] for table in tables}
            await connection.run_sync(migrate,'0008_admin_grants')
            await connection.run_sync(migrate,'0008_admin_grants')
            assert await connection.scalar(text('SELECT version_num FROM alembic_version')) == '0008_admin_grants'
            assert await connection.scalar(text('SELECT count(*) FROM admin_grants')) == 0
            assert set(await connection.run_sync(lambda sync:inspect(sync).get_table_names())) == set(tables)|{'alembic_version','admin_grants'}
            await connection.run_sync(lambda sync:migrate(sync,'0007_password_recovery',downgrade=True))
            for table,before in snapshots.items():
                assert [dict(row) for row in (await connection.execute(text('SELECT * FROM '+table))).mappings()] == before
            await connection.run_sync(migrate)
            assert await connection.run_sync(lambda sync:compare_metadata(MigrationContext.configure(sync),Base.metadata)) == []
    finally:
        await database.dispose()


async def test_startup_refuses_schema_without_admin_authority(isolated_postgres_url):
    from fastapi.testclient import TestClient
    from app.infra.core.config import Config
    from app.infra.database.connection import Database
    from app.main import create_app
    from tests.postgres import migrate
    database=Database(isolated_postgres_url)
    try:
        async with database.engine.begin() as connection:
            await connection.run_sync(migrate,'0007_password_recovery')
        app=create_app(Config(_env_file=None,DATABASE_URL=isolated_postgres_url.render_as_string(hide_password=False)))
        with pytest.raises(RuntimeError,match='run alembic upgrade head'):
            with TestClient(app):
                pass
    finally:
        await database.dispose()
