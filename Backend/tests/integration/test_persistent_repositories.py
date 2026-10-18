from dataclasses import replace
from datetime import UTC, datetime, timedelta

import pytest
from fastapi_pagination import Params
from sqlalchemy import text

from app.domain.entities import RoleEntity, UserEntity
from app.domain.error.exceptions import ConflictException, ResourceNotFoundException
from app.infra.database.connection import Database
from app.infra.repositories.postgres.role_repository import SQLRoleRepository
from app.infra.repositories.postgres.user_repository import SQLUserRepository
from app.interface.repository.role_repository_interface import IRoleRepository
from app.interface.repository.user_repository_interface import IUserRepository
from tests.postgres import isolated_postgres_url, persistent_database


def user(label="fixture", **fields):
    return UserEntity.create(first_name="نام", last_name="آزمون", email=f"{label}@example.test",
        username=label, hashed_password="already-hashed-test-value", **fields)


async def test_records_and_membership_survive_new_repository_instances(persistent_database):
    person, role = user(), RoleEntity.create("Editor", permission_ids=["permission-id"])
    async with persistent_database.transaction() as session:
        users, roles = SQLUserRepository(session), SQLRoleRepository(session)
        assert isinstance(users, IUserRepository) and isinstance(roles, IRoleRepository)
        await roles.create(role)
        await users.create(person)
        await users.assign_role(person.id, role.id)
    async with persistent_database.transaction() as session:
        fetched = await SQLUserRepository(session).get_by_id(person.id)
        assert fetched == replace(person, roles=[role])
        assert await SQLRoleRepository(session).get_by_name("Editor") == role
        assert await SQLUserRepository(session).get_by_email(person.email) == fetched
        assert await SQLUserRepository(session).get_by_username(person.username) == fetched


@pytest.mark.parametrize("target", ["user", "role"])
async def test_repository_crud_and_missing_ids(persistent_database, target):
    entity = user() if target == "user" else RoleEntity.create("Editor")
    repository = SQLUserRepository if target == "user" else SQLRoleRepository
    async with persistent_database.transaction() as session:
        repo = repository(session)
        assert await repo.get_by_id("not-a-uuid") is None
        assert await repo.update(entity) is None
        assert await repo.delete("not-a-uuid") is None
        assert await repo.create(entity) == entity
        if target == "user":
            entity.update_info(first_name="Changed", is_active=True)
            entity.change_password("changed-hash")
        else:
            entity.update_info(name="Changed", is_active=False, permission_ids=["updated"])
        assert await repo.update(entity) == entity
    async with persistent_database.transaction() as session:
        repo = repository(session)
        assert await repo.get_by_id(entity.id) == entity
        assert await repo.delete(entity.id) == entity
    async with persistent_database.transaction() as session:
        repo = repository(session)
        assert await repo.get_by_id(entity.id) is None
        assert await repo.delete(entity.id) is None


@pytest.mark.parametrize("target", ["user", "role"])
async def test_pagination_is_stable_and_empty_page_compatible(persistent_database, target):
    repository = SQLUserRepository if target == "user" else SQLRoleRepository
    entities = [user(f"person{i}") if target == "user" else RoleEntity.create(f"Role {i}") for i in range(5)]
    async with persistent_database.transaction() as session:
        repo = repository(session)
        empty = await repo.get_all(Params(size=2))
        assert empty.items == [] and empty.total == 0 and empty.pages == 1
        for index, entity in enumerate(entities):
            entity.created_at = datetime(2020, 1, 1, tzinfo=UTC) + timedelta(seconds=index)
            entity.updated_at = entity.created_at
            await repo.create(entity)
    async with persistent_database.transaction() as session:
        repo = repository(session)
        first = await repo.get_all(Params(page=1, size=2))
        second = await repo.get_all(Params(page=2, size=2))
        assert [e.id for e in first.items] == [e.id for e in entities[:2]]
        assert [e.id for e in second.items] == [e.id for e in entities[2:4]]
        assert first.total == second.total == 5 and first.pages == 3
        assert (await repo.get_all(Params(page=10, size=2))).items == []


@pytest.mark.parametrize("target,field", [("user","email"),("user","username"),("role","name")])
async def test_uniqueness_conflict_is_safe_and_rolls_back(persistent_database, target, field):
    repository = SQLUserRepository if target == "user" else SQLRoleRepository
    original = user() if target == "user" else RoleEntity.create("Editor")
    duplicate = user("second") if target == "user" else RoleEntity.create("Other")
    setattr(duplicate, field, getattr(original, field))
    async with persistent_database.transaction() as session:
        await repository(session).create(original)
    with pytest.raises(ConflictException) as error:
        async with persistent_database.transaction() as session:
            await repository(session).create(duplicate)
    assert "INSERT" not in str(error.value) and "hashed" not in str(error.value)
    async with persistent_database.transaction() as session:
        assert (await repository(session).get_all(Params())).total == 1
        fetched = await repository(session).get_by_id(original.id)
        assert fetched == original


async def test_assign_remove_and_membership_cleanup(persistent_database):
    person, role = user(), RoleEntity.create("Editor")
    async with persistent_database.transaction() as session:
        users, roles = SQLUserRepository(session), SQLRoleRepository(session)
        await roles.create(role)
        await users.create(person)
        result = await users.assign_role(person.id, role.id)
        assert result.roles == [role]
    with pytest.raises(ConflictException):
        async with persistent_database.transaction() as session:
            await SQLUserRepository(session).assign_role(person.id, role.id)
    async with persistent_database.transaction() as session:
        users = SQLUserRepository(session)
        assert (await users.remove_role(person.id, role.id)).roles == []
        assert (await users.remove_role(person.id, role.id)).roles == []
        await users.assign_role(person.id, role.id)
        await SQLRoleRepository(session).delete(role.id)
        assert (await users.get_by_id(person.id)).roles == []
        assert await session.scalar(text("SELECT count(*) FROM user_roles")) == 0


@pytest.mark.parametrize("missing", ["user", "role"])
async def test_assignment_requires_existing_records(persistent_database, missing):
    person, role = user(), RoleEntity.create("Editor")
    async with persistent_database.transaction() as session:
        if missing != "user": await SQLUserRepository(session).create(person)
        if missing != "role": await SQLRoleRepository(session).create(role)
    with pytest.raises(ResourceNotFoundException) as error:
        async with persistent_database.transaction() as session:
            await SQLUserRepository(session).assign_role(person.id, role.id)
    assert error.value.details["resource_type"] == missing.capitalize()


async def test_failed_multi_repository_operation_rolls_back_every_write(persistent_database):
    person, role = user(), RoleEntity.create("Editor")
    with pytest.raises(ValueError, match="abort"):
        async with persistent_database.transaction() as session:
            await SQLUserRepository(session).create(person)
            await SQLRoleRepository(session).create(role)
            await SQLUserRepository(session).assign_role(person.id, role.id)
            raise ValueError("abort")
    async with persistent_database.transaction() as session:
        assert await SQLUserRepository(session).get_by_id(person.id) is None
        assert await SQLRoleRepository(session).get_by_id(role.id) is None


async def test_user_deletion_cleans_only_assignments(persistent_database):
    person, role = user(), RoleEntity.create("Editor")
    async with persistent_database.transaction() as session:
        users, roles = SQLUserRepository(session), SQLRoleRepository(session)
        await users.create(person)
        await roles.create(role)
        await users.assign_role(person.id, role.id)
        deleted = await users.delete(person.id)
        assert deleted.id == person.id and deleted.roles == []
    async with persistent_database.transaction() as session:
        assert await session.scalar(text("SELECT count(*) FROM user_roles")) == 0
        assert await SQLRoleRepository(session).get_by_id(role.id) == role


@pytest.mark.parametrize("target", ["user", "role"])
async def test_concurrent_duplicate_creation_has_one_winner(persistent_database, target):
    import asyncio
    barrier = asyncio.Barrier(2)

    async def attempt(index):
        async with persistent_database.transaction() as session:
            if target == "user":
                repo = SQLUserRepository(session)
                assert await repo.get_by_email("race@example.test") is None
                entity = user(f"racer{index}")
                entity.email = "race@example.test"
            else:
                repo = SQLRoleRepository(session)
                assert await repo.get_by_name("Racing role") is None
                entity = RoleEntity.create("Racing role")
            await barrier.wait()
            return await repo.create(entity)

    outcomes = await asyncio.wait_for(asyncio.gather(attempt(0), attempt(1), return_exceptions=True), timeout=15)
    assert sum(isinstance(value, ConflictException) for value in outcomes) == 1
    assert sum(isinstance(value, (UserEntity, RoleEntity)) for value in outcomes) == 1
    async with persistent_database.transaction() as session:
        repo = SQLUserRepository(session) if target == "user" else SQLRoleRepository(session)
        assert (await repo.get_all(Params())).total == 1


@pytest.mark.parametrize("target", ["user", "role"])
async def test_update_conflict_does_not_modify_saved_record(persistent_database, target):
    repository = SQLUserRepository if target == "user" else SQLRoleRepository
    first = user("first") if target == "user" else RoleEntity.create("First")
    second = user("second") if target == "user" else RoleEntity.create("Second")
    async with persistent_database.transaction() as session:
        await repository(session).create(first)
        await repository(session).create(second)
    if target == "user":
        second.email = first.email
    else:
        second.name = first.name
    with pytest.raises(ConflictException):
        async with persistent_database.transaction() as session:
            await repository(session).update(second)
    async with persistent_database.transaction() as session:
        saved = await repository(session).get_by_id(second.id)
        if target == "user":
            assert saved.email == "second@example.test"
        else:
            assert saved.name == "Second"


@pytest.mark.parametrize("target", ["user", "role"])
async def test_constraint_failure_is_translated_without_sql_details(persistent_database, target):
    from app.domain.error.exceptions import ValidationException
    entity = user() if target == "user" else RoleEntity.create("Editor")
    if target == "user":
        entity.username = "ab"
    else:
        entity.name = " "
    with pytest.raises(ValidationException) as error:
        async with persistent_database.transaction() as session:
            repo = SQLUserRepository(session) if target == "user" else SQLRoleRepository(session)
            await repo.create(entity)
    assert "INSERT" not in str(error.value) and "test-value" not in str(error.value)


@pytest.mark.parametrize("existing_user", [False, True])
async def test_remove_unknown_assignment_matches_contract(persistent_database, existing_user):
    person = user()
    if existing_user:
        async with persistent_database.transaction() as session:
            await SQLUserRepository(session).create(person)
        async with persistent_database.transaction() as session:
            unchanged = await SQLUserRepository(session).remove_role(person.id, "unknown-role")
            assert unchanged == person
    else:
        with pytest.raises(ResourceNotFoundException) as error:
            async with persistent_database.transaction() as session:
                await SQLUserRepository(session).remove_role("unknown-user", "unknown-role")
        assert error.value.details["resource_type"] == "User"
