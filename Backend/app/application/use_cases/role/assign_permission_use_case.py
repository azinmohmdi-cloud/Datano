"""
True Clean Architecture Use Case for assigning a permission to a role.
Use case contains business logic and is independent of frameworks and external concerns.
"""

from dataclasses import dataclass

from app.domain.entities import RoleEntity
from app.domain.error.exceptions import ResourceNotFoundException
from app.interface.repository.permission_repository_interface import (
    IPermissionRepository,
)
from app.interface.repository.role_repository_interface import IRoleRepository


@dataclass(frozen=True)
class AssignPermissionRequest:
    """Input port for assigning a permission to a role."""
    role_id: str
    permission_id: str


@dataclass(frozen=True)
class AssignPermissionResponse:
    """Output port for assigning a permission to a role."""
    role: RoleEntity


class AssignPermissionToRoleUseCase:
    """Use case for assigning a permission to a role."""

    def __init__(
        self,
        role_repository: IRoleRepository,
        permission_repository: IPermissionRepository,
    ):
        self._role_repo = role_repository
        self._permission_repo = permission_repository

    async def execute(self, request: AssignPermissionRequest) -> AssignPermissionResponse:
        """Execute the use case to assign a permission to a role."""
        # Verify permission exists
        await self._validate_permission_ids([request.permission_id])

        # Get role
        role = await self._role_repo.get_by_id(request.role_id)
        if not role:
            raise ResourceNotFoundException(
                resource_type="Role", identifier=request.role_id
            )

        # Add permission if not already assigned
        role.permission_ids = role.permission_ids or []
        if request.permission_id not in role.permission_ids:
            role.permission_ids.append(request.permission_id)

        updated_role = await self._role_repo.update(role)
        if not updated_role:
            raise ResourceNotFoundException(
                resource_type="Role", identifier=request.role_id
            )

        return AssignPermissionResponse(role=updated_role)

    async def _validate_permission_ids(self, permission_ids: list) -> None:
        """Validate that all permission IDs exist."""
        all_permissions = await self._permission_repo.get_all()
        available_ids = {perm.id for perm in all_permissions}

        invalid_ids = [pid for pid in permission_ids if pid not in available_ids]
        if invalid_ids:
            raise ResourceNotFoundException(
                resource_type="Permission", identifier=f"{invalid_ids}"
            )
