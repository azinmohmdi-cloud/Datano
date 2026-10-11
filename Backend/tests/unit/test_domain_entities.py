import pytest
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from app.domain.entities import PermissionEntity, PolicyEntity, RefreshTokenEntity, RoleEntity, UserEntity
from app.domain.error.exceptions import ValidationException
from app.infra.utils import hash_password


HASHED_PASSWORD = hash_password("password123")

class TestUserEntity:
    def test_create_valid_user(self):
        user = UserEntity.create(
            first_name="John",
            last_name="Doe",
            email="john@example.com",
            username="johndoe",
            hashed_password=HASHED_PASSWORD,
        )
        assert user.first_name == "John"
        assert user.last_name == "Doe"
        assert user.email == "john@example.com"
        assert user.username == "johndoe"
        assert user.is_active is False
        assert user.id is not None
        assert user.created_at is not None

    def test_create_invalid_email(self):
        with pytest.raises(ValidationException):
            UserEntity.create(
                first_name="John",
                last_name="Doe",
                email="invalid",
                username="johndoe",
                hashed_password=HASHED_PASSWORD,
            )

    def test_create_short_username(self):
        with pytest.raises(ValidationException):
            UserEntity.create(
                first_name="John",
                last_name="Doe",
                email="john@example.com",
                username="jo",
                hashed_password=HASHED_PASSWORD,
            )

    def test_activate(self):
        user = UserEntity.create(
            first_name="John", last_name="Doe",
            email="john@example.com", username="johndoe",
            hashed_password=HASHED_PASSWORD,
        )
        assert user.is_active is False
        user.activate()
        assert user.is_active is True

    def test_deactivate(self):
        user = UserEntity.create(
            first_name="John", last_name="Doe",
            email="john@example.com", username="johndoe",
            hashed_password=HASHED_PASSWORD,
        )
        user.activate()
        user.deactivate()
        assert user.is_active is False

    def test_change_password(self):
        user = UserEntity.create(
            first_name="John", last_name="Doe",
            email="john@example.com", username="johndoe",
            hashed_password=HASHED_PASSWORD,
        )
        old_hash = user.hashed_password
        new_hashed = hash_password("newpassword123")
        user.change_password(new_hashed)
        assert user.hashed_password != old_hash
        assert user.hashed_password == new_hashed

    def test_update_info(self):
        user = UserEntity.create(
            first_name="John", last_name="Doe",
            email="john@example.com", username="johndoe",
            hashed_password=HASHED_PASSWORD,
        )
        user.update_info(first_name="Jane", email="jane@example.com")
        assert user.first_name == "Jane"
        assert user.email == "jane@example.com"
        assert user.last_name == "Doe"

    def test_update_info_custom_id(self):
        custom_id = str(uuid4())
        user = UserEntity.create(
            first_name="John", last_name="Doe",
            email="john@example.com", username="johndoe",
            hashed_password=HASHED_PASSWORD, user_id=custom_id,
        )
        assert user.id == custom_id

    def test_update_info_with_roles(self):
        role = RoleEntity.create(name="Admin")
        user = UserEntity.create(
            first_name="John", last_name="Doe",
            email="john@example.com", username="johndoe",
            hashed_password=HASHED_PASSWORD, roles=[role],
        )
        assert user.roles == [role]

    def test_validate_password_short(self):
        with pytest.raises(ValidationException):
            UserEntity._validate_password("short")


class TestRoleEntity:
    def test_create_valid_role(self):
        role = RoleEntity.create(name="Admin")
        assert role.name == "Admin"
        assert role.is_active is True
        assert role.permission_ids == []

    def test_create_with_permissions(self):
        role = RoleEntity.create(name="Editor", permission_ids=["perm1", "perm2"])
        assert role.permission_ids == ["perm1", "perm2"]

    def test_create_empty_name(self):
        with pytest.raises(ValidationException):
            RoleEntity.create(name="")

    def test_activate_deactivate(self):
        role = RoleEntity.create(name="Viewer")
        role.deactivate()
        assert role.is_active is False
        role.activate()
        assert role.is_active is True

    def test_update_info(self):
        role = RoleEntity.create(name="Editor")
        role.update_info(name="Admin", permission_ids=["p1"])
        assert role.name == "Admin"
        assert role.permission_ids == ["p1"]


class TestRefreshTokenEntity:
    def test_create_token(self):
        user_id = str(uuid4())
        expires_at = datetime.now(UTC) + timedelta(days=7)
        token = RefreshTokenEntity.create(user_id=user_id, expires_at=expires_at)
        assert token.user_id == user_id
        assert token.expires_at == expires_at
        assert token.revoked is False
        assert token.blacklisted is False
        assert token.token is not None
        assert len(token.token) > 0

    def test_is_valid(self):
        token = RefreshTokenEntity.create(
            user_id=str(uuid4()),
            expires_at=datetime.now(UTC) + timedelta(days=1),
        )
        assert token.is_valid() is True

    def test_is_expired(self):
        token = RefreshTokenEntity.create(
            user_id=str(uuid4()),
            expires_at=datetime.now(UTC) - timedelta(days=1),
        )
        assert token.is_valid() is False

    def test_revoke(self):
        token = RefreshTokenEntity.create(
            user_id=str(uuid4()),
            expires_at=datetime.now(UTC) + timedelta(days=1),
        )
        token.revoke()
        assert token.revoked is True
        assert token.is_valid() is False

    def test_blacklist(self):
        token = RefreshTokenEntity.create(
            user_id=str(uuid4()),
            expires_at=datetime.now(UTC) + timedelta(days=1),
        )
        assert token.is_valid() is True

    def test_is_expired(self):
        token = RefreshTokenEntity.create(
            user_id=str(uuid4()),
            expires_at=datetime.now(UTC) - timedelta(days=1),
        )
        assert token.is_valid() is False

    def test_revoke(self):
        token = RefreshTokenEntity.create(
            user_id=str(uuid4()),
            expires_at=datetime.now(UTC) + timedelta(days=1),
        )
        token.revoke()
        assert token.revoked is True
        assert token.is_valid() is False

    def test_blacklist(self):
        token = RefreshTokenEntity.create(
            user_id=str(uuid4()),
            expires_at=datetime.now(UTC) + timedelta(days=1),
        )
        token.blacklist()
        assert token.blacklisted is True
        assert token.is_valid() is False


class TestPermissionEntity:
    def test_create(self):
        perm = PermissionEntity.create(
            title="users:read",
            description="Ability to read users",
        )
        assert perm.title == "users:read"
        assert perm.description == "Ability to read users"

    def test_create_with_id(self):
        custom_id = str(uuid4())
        perm = PermissionEntity.create(
            title="users:write",
            description="Write users",
            permission_id=custom_id,
        )
        assert perm.id == custom_id


class TestPolicyEntity:
    def test_create(self):
        policy = PolicyEntity.create(
            title="data_policy",
            description="Data handling policy",
        )
        assert policy.title == "data_policy"
        assert policy.description == "Data handling policy"

    def test_create_with_id(self):
        custom_id = str(uuid4())
        policy = PolicyEntity.create(
            title="audit_policy",
            description="Audit policy",
            policy_id=custom_id,
        )
        assert policy.id == custom_id
