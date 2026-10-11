"""
True Clean Architecture Use Case for deleting a role.
Use case contains business logic and is independent of frameworks and external concerns.
"""

from dataclasses import dataclass

from app.domain.entities import RoleEntity
from app.domain.error.exceptions import ResourceNotFoundException
from app.interface.repository.role_repository_interface import IRoleRepository


@dataclass(frozen=True)
class DeleteRoleRequest:
    """Input port for deleting a role."""
    role_id: str


@dataclass(frozen=True)
class DeleteRoleResponse:
    """Output port for deleting a role."""
    role: RoleEntity


class DeleteRoleUseCase:
    """Use case for deleting a role."""

    def __init__(self, role_repository: IRoleRepository):
        self._role_repo = role_repository

    async def execute(self, request: DeleteRoleRequest) -> DeleteRoleResponse:
        """Execute the use case to delete a role."""
        role = await self._role_repo.get_by_id(request.role_id)
        if not role:
            raise ResourceNotFoundException(
                resource_type="Role", identifier=request.role_id
            )

        deleted_role = await self._role_repo.delete(role.id)
        if not deleted_role:
            raise ResourceNotFoundException(
                resource_type="Role", identifier=request.role_id
            )

        return DeleteRoleResponse(role=deleted_role)
