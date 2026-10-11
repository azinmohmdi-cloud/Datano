"""
True Clean Architecture Use Case for updating a role.
Use case contains business logic and is independent of frameworks and external concerns.
"""

from dataclasses import dataclass
from typing import List, Optional

from app.domain.entities import RoleEntity
from app.domain.error.exceptions import ConflictException, ResourceNotFoundException
from app.interface.repository.permission_repository_interface import (
    IPermissionRepository,
)
from app.interface.repository.role_repository_interface import IRoleRepository


@dataclass(frozen=True)
class UpdateRoleRequest:
    """Input port for updating a role."""
    role_id: str
    name: Optional[str] = None
    is_active: Optional[bool] = None
    permission_ids: Optional[List[str]] = None


@dataclass(frozen=True)
class UpdateRoleResponse:
    """Output port for updating a role."""
    role: RoleEntity


class UpdateRoleUseCase:
    """Use case for updating a role."""

    def __init__(
        self,
        role_repository: IRoleRepository,
        permission_repository: IPermissionRepository,
    ):
        self._role_repo = role_repository
        self._permission_repo = permission_repository

    async def execute(self, request: UpdateRoleRequest) -> UpdateRoleResponse:
        """Execute the use case to update a role."""
        role = await self._role_repo.get_by_id(request.role_id)
        if not role:
            raise ResourceNotFoundException(
                resource_type="Role", identifier=request.role_id
            )

        # Check role name uniqueness if changing
        if request.name is not None and request.name != role.name:
            existing = await self._role_repo.get_by_name(request.name)
            if existing:
                raise ConflictException(
                    f"Role with name '{request.name}' already exists"
                )

        # Validate permission IDs if provided
        if request.permission_ids is not None:
            if request.permission_ids:
                await self._validate_permission_ids(request.permission_ids)
            else:
                request.permission_ids = []

        # Update role using domain method
        role.update_info(
            name=request.name,
            is_active=request.is_active,
            permission_ids=request.permission_ids,
        )

        updated_role = await self._role_repo.update(role)
        if not updated_role:
            raise ResourceNotFoundException(
                resource_type="Role", identifier=request.role_id
            )

        return UpdateRoleResponse(role=updated_role)

    async def _validate_permission_ids(self, permission_ids: List[str]) -> None:
        """Validate that all permission IDs exist."""
        seen = set()
        unique_ids = []
        for perm_id in permission_ids:
            if perm_id not in seen:
                seen.add(perm_id)
                unique_ids.append(perm_id)

        all_permissions = await self._permission_repo.get_all()
        available_ids = {perm.id for perm in all_permissions}

        invalid_ids = [pid for pid in unique_ids if pid not in available_ids]
        if invalid_ids:
            raise ResourceNotFoundException(
                resource_type="Permission", identifier=f"{invalid_ids}"
            )
