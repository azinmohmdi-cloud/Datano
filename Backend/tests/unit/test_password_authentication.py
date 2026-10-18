import bcrypt
import pytest
from argon2 import PasswordHasher

from app.application.use_cases.auth.authenticate_use_case import AuthenticateUserUseCase
from app.domain.entities import UserEntity
from app.domain.error.exceptions import CredentialsValidationException, InactiveUserException
from app.infra.repositories.in_memory.user_repository import InMemoryUserRepository
from app.infra.services.password_service import BcryptPasswordService


def legacy_user(password="Secret123"):
    return UserEntity.create(first_name="Legacy", last_name="User", email="Legacy@Example.TEST", username="legacy",
        hashed_password=bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=4)).decode())


async def test_successful_legacy_authentication_persists_a_new_hash():
    repo, service = InMemoryUserRepository(), BcryptPasswordService()
    user = legacy_user()
    user.activate()
    await repo.create(user)
    original = user.hashed_password
    timestamp = user.updated_at
    result = await AuthenticateUserUseCase(repo, service).execute("legacy", "Secret123")
    assert result.hashed_password.startswith("$argon2id$")
    assert result.hashed_password != original and result.updated_at == timestamp
    assert (await repo.get_by_id(user.id)).hashed_password == result.hashed_password


@pytest.mark.parametrize("active, password", [(True, "wrong"), (False, "Secret123")])
async def test_failed_or_inactive_login_never_rewrites_hash(active, password):
    repo, service = InMemoryUserRepository(), BcryptPasswordService()
    user = legacy_user()
    if active: user.activate()
    await repo.create(user)
    original = user.hashed_password
    expected = CredentialsValidationException if active else InactiveUserException
    with pytest.raises(expected):
        await AuthenticateUserUseCase(repo, service).execute("legacy", password)
    assert (await repo.get_by_id(user.id)).hashed_password == original


async def test_email_authentication_uses_the_canonical_lookup():
    repo, service = InMemoryUserRepository(), BcryptPasswordService()
    user = legacy_user()
    user.activate()
    await repo.create(user)
    result = await AuthenticateUserUseCase(repo, service).execute(None, "Secret123", email=" legacy@EXAMPLE.test ")
    assert result.id == user.id and result.hashed_password.startswith("$argon2id$")


@pytest.mark.parametrize("changed_password", ["Secret123", "Changed password 123!"])
async def test_hash_upgrade_cannot_overwrite_a_concurrent_password_change(changed_password):
    replacement = PasswordHasher(memory_cost=19456, time_cost=2, parallelism=1).hash(changed_password)

    class RacingRepository(InMemoryUserRepository):
        async def replace_password_hash(self, user_id, expected, new_hash):
            self._users[user_id].hashed_password = replacement
            return False

    repo, service = RacingRepository(), BcryptPasswordService()
    user = legacy_user()
    user.activate()
    await repo.create(user)
    use_case = AuthenticateUserUseCase(repo, service)
    if changed_password == "Secret123":
        assert (await use_case.execute("legacy", "Secret123")).id == user.id
    else:
        with pytest.raises(CredentialsValidationException):
            await use_case.execute("legacy", "Secret123")
    assert (await repo.get_by_id(user.id)).hashed_password == replacement


@pytest.mark.parametrize("state", ["deleted", "inactive"])
async def test_hash_upgrade_race_rechecks_account_availability(state):
    class RacingRepository(InMemoryUserRepository):
        async def replace_password_hash(self, user_id, expected, new_hash):
            if state == "deleted":
                self._users.pop(user_id)
            else:
                self._users[user_id].hashed_password = new_hash
                self._users[user_id].deactivate()
            return False

    repo = RacingRepository()
    user = legacy_user()
    user.activate()
    await repo.create(user)
    expected = CredentialsValidationException if state == "deleted" else InactiveUserException
    with pytest.raises(expected):
        await AuthenticateUserUseCase(repo, BcryptPasswordService()).execute("legacy", "Secret123")
