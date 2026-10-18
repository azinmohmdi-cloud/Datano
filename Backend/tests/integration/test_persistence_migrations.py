import pytest
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from app.domain.entities import RoleEntity, UserEntity
from app.infra.database.connection import Database
from app.infra.repositories.postgres.role_repository import SQLRoleRepository
from app.infra.repositories.postgres.user_repository import SQLUserRepository
from tests.postgres import isolated_postgres_url, persistent_database, migrate


async def test_upgrade_from_baseline_adds_only_identity_tables(isolated_postgres_url):
    database = Database(isolated_postgres_url)
    try:
        async with database.engine.begin() as connection:
            await connection.run_sync(migrate, "0001_database_baseline")
            await connection.execute(text("CREATE TABLE preservation_probe (id integer PRIMARY KEY)"))
            await connection.execute(text("INSERT INTO preservation_probe VALUES (42)"))
            await connection.run_sync(migrate, "0002_users_roles")
            tables = await connection.run_sync(lambda sync: inspect(sync).get_table_names())
            assert set(tables) == {"users", "roles", "user_roles", "alembic_version", "preservation_probe"}
            assert await connection.scalar(text("SELECT version_num FROM alembic_version")) == "0002_users_roles"
            await connection.run_sync(migrate, "0002_users_roles")
            assert await connection.scalar(text("SELECT id FROM preservation_probe")) == 42
        async with database.engine.begin() as connection:
            await connection.run_sync(lambda sync: migrate(sync, "0001_database_baseline", downgrade=True))
            tables = await connection.run_sync(lambda sync: inspect(sync).get_table_names())
            assert set(tables) == {"alembic_version", "preservation_probe"}
            assert await connection.scalar(text("SELECT id FROM preservation_probe")) == 42
            await connection.run_sync(migrate)
    finally:
        await database.dispose()


@pytest.mark.parametrize("statement,code", [
    ("UPDATE users SET email = 'first@example.test' WHERE username = 'second'", "23505"),
    ("UPDATE users SET username = 'first' WHERE username = 'second'", "23505"),
    ("INSERT INTO users SELECT * FROM users WHERE username = 'first'", "23505"),
    ("UPDATE roles SET name = 'First' WHERE name = 'Second'", "23505"),
    ("INSERT INTO roles SELECT * FROM roles WHERE name = 'First'", "23505"),
    ("INSERT INTO user_roles SELECT * FROM user_roles", "23505"),
    ("UPDATE user_roles SET role_id = 'missing-role'", "23503"),
    ("UPDATE user_roles SET user_id = 'missing-user'", "23503"),
    ("UPDATE users SET username = 'ab' WHERE username = 'first'", "23514"),
    ("UPDATE roles SET name = '   ' WHERE name = 'First'", "23514"),
    ("UPDATE users SET hashed_password = NULL WHERE username = 'first'", "23502"),
    ("UPDATE roles SET permission_ids = NULL WHERE name = 'First'", "23502"),
])
async def test_constraints_are_enforced_without_application_prechecks(persistent_database, statement, code):
    first = UserEntity.create(first_name="First", last_name="Test", email="first@example.test", username="first", hashed_password="test-hash")
    second = UserEntity.create(first_name="Second", last_name="Test", email="second@example.test", username="second", hashed_password="test-hash")
    role = RoleEntity.create("First")
    async with persistent_database.transaction() as session:
        users, roles = SQLUserRepository(session), SQLRoleRepository(session)
        await users.create(first)
        await users.create(second)
        await roles.create(role)
        await roles.create(RoleEntity.create("Second"))
        await users.assign_role(first.id, role.id)
    with pytest.raises(IntegrityError) as error:
        async with persistent_database.transaction() as session:
            await session.execute(text(statement))
    assert error.value.orig.sqlstate == code
    async with persistent_database.transaction() as session:
        assert (await SQLUserRepository(session).get_by_id(first.id)).email == first.email
        assert (await SQLRoleRepository(session).get_by_id(role.id)).name == "First"
        assert await session.scalar(text("SELECT count(*) FROM user_roles")) == 1


async def test_migration_metadata_matches_orm(persistent_database):
    from alembic.autogenerate import compare_metadata
    from alembic.migration import MigrationContext
    from app.infra.database.base import Base

    async with persistent_database.engine.begin() as connection:
        changes = await connection.run_sync(lambda sync: compare_metadata(MigrationContext.configure(sync), Base.metadata))
        assert changes == []
