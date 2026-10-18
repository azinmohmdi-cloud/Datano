from unittest.mock import AsyncMock

import pytest

from app.application.use_cases.auth.current_identity_use_case import GetCurrentIdentityUseCase
from app.domain.entities import RoleEntity, UserEntity
from app.domain.error.exceptions import CredentialsValidationException
from app.interface.repository.role_repository_interface import IRoleRepository
from app.interface.repository.user_repository_interface import IUserRepository


async def test_missing_current_account_fails_as_credentials_error():
    users=AsyncMock(spec=IUserRepository)
    users.get_by_id.return_value=None
    with pytest.raises(CredentialsValidationException):
        await GetCurrentIdentityUseCase(users,AsyncMock(spec=IRoleRepository)).execute("deleted-account")


async def test_disappearing_role_cannot_supply_stale_admin_identity():
    role=RoleEntity.create("Admin")
    user=UserEntity.create(first_name="Role",last_name="Race",email="role-race@example.test",username="role-race",
        hashed_password="test-only-hash",roles=[role])
    user.activate()
    users,roles=AsyncMock(spec=IUserRepository),AsyncMock(spec=IRoleRepository)
    users.get_by_id.return_value=user
    roles.get_by_id.return_value=None
    identity=await GetCurrentIdentityUseCase(users,roles).execute(user.id)
    assert identity.effective_role is None and identity.user.roles == []
    # Mapping a detached identity must not mutate a legacy adapter's shared object.
    assert user.roles == [role]
