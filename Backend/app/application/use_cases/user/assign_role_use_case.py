"""
True Clean Architecture Use Case for assigning a role to a user.
Use case contains business logic and is independent of frameworks and external concerns.
"""

from dataclasses import dataclass

from app.domain.entities import UserEntity
from app.domain.error.exceptions import ResourceNotFoundException
from app.interface.repository.role_repository_interface import IRoleRepository
from app.interface.repository.user_repository_interface import IUserRepository


@dataclass(frozen=True)
class AssignRoleRequest:
    """Input port for assigning a role to a user."""

    user_id: str
    role_id: str


@dataclass(frozen=True)
class AssignRoleResponse:
    """Output port for assigning a role to a user."""

    user: UserEntity


class AssignRoleToUserUseCase:
    """Use case for assigning a role to a user."""

    def __init__(
        self,
        user_repository: IUserRepository,
        role_repository: IRoleRepository,
    ):
        self._user_repo = user_repository
        self._role_repo = role_repository

    async def execute(self, request: AssignRoleRequest) -> AssignRoleResponse:
        """Execute the use case to assign a role to a user."""
        # Verify user exists
        user = await self._user_repo.get_by_id(request.user_id)
        if not user:
            raise ResourceNotFoundException(
                resource_type="User", identifier=request.user_id
            )

        # Verify role exists
        role = await self._role_repo.get_by_id(request.role_id)
        if not role:
            raise ResourceNotFoundException(
                resource_type="Role", identifier=request.role_id
            )

        updated_user = await self._user_repo.assign_role(
            request.user_id, request.role_id
        )
        return AssignRoleResponse(user=updated_user)
