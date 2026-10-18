import asyncio

import pytest

from app.domain.entities import UserEntity
from app.domain.error.exceptions import ConflictException
from app.infra.repositories.postgres.user_repository import SQLUserRepository
from tests.postgres import isolated_postgres_url, persistent_database


async def test_hash_compare_and_swap_uses_latest_value_across_transactions(persistent_database):
    user = UserEntity.create(first_name="Atomic", last_name="Hash", email="atomic-hash@example.test", username="atomic-hash", hashed_password="original")
    async with persistent_database.transaction() as session:
        await SQLUserRepository(session).create(user)
    entered = asyncio.Event()

    async def competing_upgrade():
        async with persistent_database.transaction() as session:
            entered.set()
            return await SQLUserRepository(session).replace_password_hash(user.id, "original", "stale-upgrade")

    task = None
    try:
        async with persistent_database.transaction() as session:
            assert await SQLUserRepository(session).replace_password_hash(user.id, "original", "password-change")
            task = asyncio.create_task(competing_upgrade())
            await entered.wait()
        assert await asyncio.wait_for(task, timeout=5) is False
    finally:
        if task is not None and not task.done():
            task.cancel()
            await asyncio.gather(task, return_exceptions=True)
    async with persistent_database.transaction() as session:
        saved = await SQLUserRepository(session).get_by_id(user.id)
        assert saved.hashed_password == "password-change" and saved.updated_at == user.updated_at
        assert not await SQLUserRepository(session).replace_password_hash("missing", "original", "replacement")


async def test_hash_upgrade_rolls_back_with_its_request_transaction(persistent_database):
    user = UserEntity.create(first_name="Atomic", last_name="Hash", email="rollback-hash@example.test", username="rollback-hash", hashed_password="original")
    async with persistent_database.transaction() as session:
        await SQLUserRepository(session).create(user)
    with pytest.raises(ConflictException):
        async with persistent_database.transaction() as session:
            assert await SQLUserRepository(session).replace_password_hash(user.id, "original", "upgrade")
            raise ConflictException("Intentional later request failure")
    async with persistent_database.transaction() as session:
        assert (await SQLUserRepository(session).get_by_id(user.id)).hashed_password == "original"
