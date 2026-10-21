from unittest.mock import AsyncMock

import pytest

from app.application.use_cases.user.assign_role_use_case import AssignRoleRequest, AssignRoleToUserUseCase
from app.domain.entities import RoleEntity, UserEntity
from app.domain.error.exceptions import ForbiddenException
from app.interface.repository.role_repository_interface import IRoleRepository
from app.interface.repository.user_repository_interface import IUserRepository


async def test_generic_role_assignment_cannot_replace_admin_proof_or_private_provisioning():
    users, roles = AsyncMock(spec=IUserRepository), AsyncMock(spec=IRoleRepository)
    user = UserEntity.create(first_name="Unproved",last_name="User",email="unproved@example.test",
        username="unproved",hashed_password="test-only-hash")
    users.get_by_id.return_value = user
    role = RoleEntity.create("Admin")
    roles.get_by_id.return_value = role
    with pytest.raises(ForbiddenException):
        await AssignRoleToUserUseCase(users,roles).execute(AssignRoleRequest(user.id,role.id))
    users.assign_role.assert_not_awaited()
