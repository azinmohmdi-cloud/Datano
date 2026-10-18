import pytest
from sqlalchemy import inspect, text
from sqlalchemy.exc import IntegrityError

from app.domain.entities import UserEntity
from app.domain.error.exceptions import ConflictException
from app.infra.database.connection import Database
from app.infra.repositories.postgres.user_repository import SQLUserRepository
from tests.postgres import isolated_postgres_url, persistent_database, migrate


async def insert_legacy(connection, identifier, email):
    await connection.execute(text("""
        INSERT INTO users (id, first_name, last_name, email, username, hashed_password,
                           created_at, updated_at, is_active)
        VALUES (:id, 'Legacy', 'User', :email, :username, 'unchanged-legacy-hash',
                '2025-01-02T03:04:05Z', '2025-02-03T04:05:06Z', true)
    """), {"id": identifier, "username": identifier, "email": email})


async def test_backfill_preserves_accounts_roles_hashes_and_unicode_identity(isolated_postgres_url):
    database = Database(isolated_postgres_url)
    try:
        async with database.engine.begin() as connection:
            await connection.run_sync(migrate, "0002_users_roles")
            await insert_legacy(connection, "legacy", "\u2003İ.Σ+Tag@Example.TEST\u00a0")
            await connection.execute(text("""INSERT INTO roles VALUES
                ('role', 'User', '{}', now(), now(), true)"""))
            await connection.execute(text("INSERT INTO user_roles VALUES ('legacy', 'role')"))
            before = (await connection.execute(text("SELECT * FROM users"))).mappings().one()
            await connection.run_sync(migrate, "0003_email_identity")
            after = (await connection.execute(text("SELECT * FROM users"))).mappings().one()
            assert after["email_key"] == before["email"].strip().lower()
            assert {key: after[key] for key in before} == dict(before)
            assert await connection.scalar(text("SELECT count(*) FROM user_roles")) == 1
            assert await connection.scalar(text("SELECT version_num FROM alembic_version")) == "0003_email_identity"
            await connection.run_sync(migrate, "0003_email_identity")
        async with database.engine.begin() as connection:
            await connection.run_sync(lambda sync: migrate(sync, "0002_users_roles", downgrade=True))
            assert "email_key" not in await connection.run_sync(
                lambda sync: {col["name"] for col in inspect(sync).get_columns("users")}
            )
            assert dict((await connection.execute(text("SELECT * FROM users"))).mappings().one()) == dict(before)
            await connection.run_sync(migrate, "0003_email_identity")
    finally:
        await database.dispose()


@pytest.mark.parametrize("second", ["user@EXAMPLE.test", "\u2003User@Example.test\u00a0"])
async def test_canonical_collision_aborts_all_ddl_without_merging_accounts(isolated_postgres_url, second):
    database = Database(isolated_postgres_url)
    try:
        async with database.engine.begin() as connection:
            await connection.run_sync(migrate, "0002_users_roles")
            await insert_legacy(connection, "first", "User@Example.test")
            await insert_legacy(connection, "second", second)
        with pytest.raises(RuntimeError, match="canonical email collision"):
            async with database.engine.begin() as connection:
                await connection.run_sync(migrate)
        async with database.engine.begin() as connection:
            columns = await connection.run_sync(lambda sync: {c["name"] for c in inspect(sync).get_columns("users")})
            assert "email_key" not in columns
            assert await connection.scalar(text("SELECT version_num FROM alembic_version")) == "0002_users_roles"
            assert (await connection.execute(text("SELECT id, email FROM users ORDER BY id"))).all() == [
                ("first", "User@Example.test"), ("second", second),
            ]
    finally:
        await database.dispose()


async def test_sql_canonical_lookup_update_and_unique_constraint(persistent_database):
    first = UserEntity.create(first_name="First", last_name="User", email="İ.Σ+Tag@Example.TEST", username="first", hashed_password="test-hash")
    second = UserEntity.create(first_name="Second", last_name="User", email="other@example.test", username="second", hashed_password="test-hash")
    async with persistent_database.transaction() as session:
        repo = SQLUserRepository(session)
        await repo.create(first)
        await repo.create(second)
        assert (await repo.get_by_email("\u2003İ.Σ+TAG@EXAMPLE.test\u00a0")).id == first.id
        assert await repo.get_by_email("İΣ+Tag@example.test") is None
        assert await repo.get_by_email("İ.Σ@example.test") is None
    duplicate = UserEntity.create(first_name="Duplicate", last_name="User", email="İ.Σ+TAG@EXAMPLE.test", username="duplicate", hashed_password="test-hash")
    with pytest.raises(ConflictException):
        async with persistent_database.transaction() as session:
            await SQLUserRepository(session).create(duplicate)
    second.update_info(email=" New+Tag@Example.TEST ")
    async with persistent_database.transaction() as session:
        repo = SQLUserRepository(session)
        await repo.update(second)
        assert (await repo.get_by_email("new+tag@example.test")).id == second.id
        assert await repo.get_by_email("other@example.test") is None
        assert await session.scalar(text("SELECT email_key FROM users WHERE id=:id"), {"id": second.id}) == "new+tag@example.test"
    with pytest.raises(IntegrityError) as error:
        async with persistent_database.transaction() as session:
            await session.execute(text("UPDATE users SET email_key=:key WHERE id=:id"), {"key": first.email.lower(), "id": second.id})
    assert error.value.orig.sqlstate == "23505"


async def test_invalid_empty_legacy_key_aborts_migration(isolated_postgres_url):
    database = Database(isolated_postgres_url)
    try:
        async with database.engine.begin() as connection:
            await connection.run_sync(migrate, "0002_users_roles")
            await insert_legacy(connection, "invalid", "\u2003\u00a0")
        with pytest.raises(RuntimeError, match="empty canonical email"):
            async with database.engine.begin() as connection:
                await connection.run_sync(migrate)
        async with database.engine.begin() as connection:
            assert await connection.scalar(text("SELECT version_num FROM alembic_version")) == "0002_users_roles"
            assert await connection.scalar(text("SELECT email FROM users")) == "\u2003\u00a0"
    finally:
        await database.dispose()


@pytest.mark.parametrize("value,code", [(None, "23502"), ("", "23514")])
async def test_email_key_requires_a_nonempty_value(persistent_database, value, code):
    user = UserEntity.create(first_name="Key", last_name="Test", email="key@example.test", username="key", hashed_password="test-hash")
    async with persistent_database.transaction() as session:
        await SQLUserRepository(session).create(user)
    with pytest.raises(IntegrityError) as error:
        async with persistent_database.transaction() as session:
            await session.execute(text("UPDATE users SET email_key=:key"), {"key": value})
    assert error.value.orig.sqlstate == code
