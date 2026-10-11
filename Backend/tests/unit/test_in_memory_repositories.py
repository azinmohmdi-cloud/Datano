import pytest
from datetime import UTC, datetime, timedelta
from uuid import uuid4
from fastapi_pagination import Params

from app.domain.entities import RefreshTokenEntity, RoleEntity, UserEntity
from app.domain.error.exceptions import ConflictException, ResourceNotFoundException
from app.infra.repositories.in_memory.refresh_token_repository import (
    InMemoryRefreshTokenRepository,
)
from app.infra.repositories.in_memory.role_repository import InMemoryRoleRepository
from app.infra.repositories.in_memory.user_repository import InMemoryUserRepository
from app.infra.utils import hash_password


HASHED_PASSWORD = hash_password("password123")


@pytest.fixture
def user_repo():
    return InMemoryUserRepository()


@pytest.fixture
def role_repo():
    return InMemoryRoleRepository()


@pytest.fixture
def refresh_token_repo():
    return InMemoryRefreshTokenRepository()


@pytest.fixture
def sample_user():
    return UserEntity.create(
        first_name="John",
        last_name="Doe",
        email="john@example.com",
        username="johndoe",
        hashed_password=HASHED_PASSWORD,
    )


@pytest.fixture
def sample_role():
    return RoleEntity.create(name="Editor")


class TestUserRepository:
    @pytest.mark.asyncio
    async def test_create_and_get_by_id(self, user_repo, sample_user):
        created = await user_repo.create(sample_user)
        assert created.id == sample_user.id
        fetched = await user_repo.get_by_id(sample_user.id)
        assert fetched is not None
        assert fetched.email == "john@example.com"

    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, user_repo):
        assert await user_repo.get_by_id("nonexistent") is None

    @pytest.mark.asyncio
    async def test_get_by_email(self, user_repo, sample_user):
        await user_repo.create(sample_user)
        fetched = await user_repo.get_by_email("john@example.com")
        assert fetched is not None
        assert fetched.username == "johndoe"

    @pytest.mark.asyncio
    async def test_get_by_email_not_found(self, user_repo):
        assert await user_repo.get_by_email("nobody@example.com") is None

    @pytest.mark.asyncio
    async def test_get_by_username(self, user_repo, sample_user):
        await user_repo.create(sample_user)
        fetched = await user_repo.get_by_username("johndoe")
        assert fetched is not None
        assert fetched.email == "john@example.com"

    @pytest.mark.asyncio
    async def test_get_by_username_not_found(self, user_repo):
        assert await user_repo.get_by_username("unknown") is None

    @pytest.mark.asyncio
    async def test_update(self, user_repo, sample_user):
        await user_repo.create(sample_user)
        sample_user.first_name = "Jane"
        updated = await user_repo.update(sample_user)
        assert updated is not None
        assert updated.first_name == "Jane"

    @pytest.mark.asyncio
    async def test_update_not_found(self, user_repo, sample_user):
        assert await user_repo.update(sample_user) is None

    @pytest.mark.asyncio
    async def test_delete(self, user_repo, sample_user):
        await user_repo.create(sample_user)
        deleted = await user_repo.delete(sample_user.id)
        assert deleted is not None
        assert deleted.id == sample_user.id
        assert await user_repo.get_by_id(sample_user.id) is None

    @pytest.mark.asyncio
    async def test_delete_not_found(self, user_repo):
        assert await user_repo.delete("nonexistent") is None

    @pytest.mark.asyncio
    async def test_get_all_pagination(self, user_repo):
        for i in range(5):
            user = UserEntity.create(
                first_name=f"User{i}",
                last_name="Test",
                email=f"user{i}@example.com",
                username=f"user{i}",
                hashed_password=HASHED_PASSWORD,
            )
            await user_repo.create(user)
        page = await user_repo.get_all(Params(page=1, size=2))
        assert len(page.items) == 2
        assert page.total == 5
        assert page.page == 1

    @pytest.mark.asyncio
    async def test_assign_role(self, user_repo, role_repo, sample_user, sample_role):
        await user_repo.create(sample_user)
        await role_repo.create(sample_role)
        result = await user_repo.assign_role(sample_user.id, sample_role.id)
        assert result is not None
        assert len(result.roles) == 1
        assert result.roles[0].id == sample_role.id

    @pytest.mark.asyncio
    async def test_assign_role_duplicate(
        self, user_repo, role_repo, sample_user, sample_role
    ):
        await user_repo.create(sample_user)
        await role_repo.create(sample_role)
        await user_repo.assign_role(sample_user.id, sample_role.id)
        with pytest.raises(ConflictException):
            await user_repo.assign_role(sample_user.id, sample_role.id)

    @pytest.mark.asyncio
    async def test_assign_role_user_not_found(self, user_repo, sample_role):
        with pytest.raises(ResourceNotFoundException):
            await user_repo.assign_role("nonexistent", sample_role.id)

    @pytest.mark.asyncio
    async def test_remove_role(self, user_repo, role_repo, sample_user, sample_role):
        await user_repo.create(sample_user)
        await role_repo.create(sample_role)
        await user_repo.assign_role(sample_user.id, sample_role.id)
        result = await user_repo.remove_role(sample_user.id, sample_role.id)
        assert result is not None
        assert len(result.roles) == 0

    @pytest.mark.asyncio
    async def test_remove_role_user_not_found(self, user_repo, sample_role):
        with pytest.raises(ResourceNotFoundException):
            await user_repo.remove_role("nonexistent", sample_role.id)


class TestRoleRepository:
    @pytest.mark.asyncio
    async def test_create_and_get_by_id(self, role_repo, sample_role):
        created = await role_repo.create(sample_role)
        assert created.id == sample_role.id
        fetched = await role_repo.get_by_id(sample_role.id)
        assert fetched is not None
        assert fetched.name == "Editor"

    @pytest.mark.asyncio
    async def test_get_by_id_not_found(self, role_repo):
        assert await role_repo.get_by_id("nonexistent") is None

    @pytest.mark.asyncio
    async def test_update(self, role_repo, sample_role):
        await role_repo.create(sample_role)
        sample_role.name = "Admin"
        updated = await role_repo.update(sample_role)
        assert updated is not None
        assert updated.name == "Admin"

    @pytest.mark.asyncio
    async def test_update_not_found(self, role_repo, sample_role):
        assert await role_repo.update(sample_role) is None

    @pytest.mark.asyncio
    async def test_delete(self, role_repo, sample_role):
        await role_repo.create(sample_role)
        deleted = await role_repo.delete(sample_role.id)
        assert deleted is not None
        assert deleted.id == sample_role.id
        assert await role_repo.get_by_id(sample_role.id) is None

    @pytest.mark.asyncio
    async def test_delete_not_found(self, role_repo):
        assert await role_repo.delete("nonexistent") is None

    @pytest.mark.asyncio
    async def test_get_all_pagination(self, role_repo):
        for i in range(5):
            role = RoleEntity.create(name=f"Role{i}")
            await role_repo.create(role)
        page = await role_repo.get_all(Params(page=1, size=3))
        assert len(page.items) == 3
        assert page.total == 5


class TestRefreshTokenRepository:
    @pytest.mark.asyncio
    async def test_create_and_get_by_token(self, refresh_token_repo):
        token = RefreshTokenEntity.create(
            user_id=str(uuid4()),
            expires_at=datetime.now(UTC) + timedelta(days=1),
        )
        created = await refresh_token_repo.create_refresh_token(token)
        assert created.id == token.id
        fetched = await refresh_token_repo.get_refresh_token_by_token(token.token)
        assert fetched is not None
        assert fetched.user_id == token.user_id

    @pytest.mark.asyncio
    async def test_get_by_token_not_found(self, refresh_token_repo):
        assert await refresh_token_repo.get_refresh_token_by_token("invalid") is None

    @pytest.mark.asyncio
    async def test_revoke_token(self, refresh_token_repo):
        token = RefreshTokenEntity.create(
            user_id=str(uuid4()),
            expires_at=datetime.now(UTC) + timedelta(days=1),
        )
        await refresh_token_repo.create_refresh_token(token)
        assert await refresh_token_repo.revoke_refresh_token(token.id) is True
        fetched = await refresh_token_repo.get_refresh_token_by_token(token.token)
        assert fetched is not None
        assert fetched.revoked is True

    @pytest.mark.asyncio
    async def test_revoke_not_found(self, refresh_token_repo):
        assert await refresh_token_repo.revoke_refresh_token("nonexistent") is False
