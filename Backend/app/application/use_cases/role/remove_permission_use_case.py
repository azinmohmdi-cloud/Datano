"""
True Clean Architecture Use Case for removing a permission from a role.
Use case contains business logic and is independent of frameworks and external concerns.
"""

from dataclasses import dataclass

from app.domain.entities import RoleEntity
from app.domain.error.exceptions import ResourceNotFoundException
from app.interface.repository.role_repository_interface import IRoleRepository


@dataclass(frozen=True)
class RemovePermissionRequest:
    """Input port for removing a permission from a role."""
    role_id: str
    permission_id: str


@dataclass(frozen=True)
class RemovePermissionResponse:
    """Output port for removing a permission from a role."""
    role: RoleEntity


class RemovePermissionFromRoleUseCase:
    """Use case for removing a permission from a role."""

    def __init__(self, role_repository: IRoleRepository):
        self._role_repo = role_repository

    async def execute(
        self, request: RemovePermissionRequest
    ) -> RemovePermissionResponse:
        """Execute the use case to remove a permission from a role."""
        role = await self._role_repo.get_by_id(request.role_id)
        if not role:
            raise ResourceNotFoundException(
                resource_type="Role", identifier=request.role_id
            )

        # Remove permission
        role.permission_ids = [
            pid for pid in (role.permission_ids or []) if pid != request.permission_id
        ]

        updated_role = await self._role_repo.update(role)
        if not updated_role:
            raise ResourceNotFoundException(
                resource_type="Role", identifier=request.role_id
            )

        return RemovePermissionResponse(role=updated_role)
