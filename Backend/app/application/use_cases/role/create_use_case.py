"""
True Clean Architecture Use Case for creating a role.
Use case contains business logic and is independent of frameworks and external concerns.
"""

from dataclasses import dataclass, field
from typing import List

from app.domain.entities import RoleEntity
from app.domain.error.exceptions import ConflictException, ResourceNotFoundException
from app.interface.repository.permission_repository_interface import (
    IPermissionRepository,
)
from app.interface.repository.role_repository_interface import IRoleRepository


@dataclass(frozen=True)
class CreateRoleRequest:
    """Input port for creating a role."""
    name: str
    permission_ids: List[str] = field(default_factory=list)


@dataclass(frozen=True)
class CreateRoleResponse:
    """Output port for creating a role."""
    role: RoleEntity


class CreateRoleUseCase:
    """Use case for creating a new role."""

    def __init__(
        self,
        role_repository: IRoleRepository,
        permission_repository: IPermissionRepository,
    ):
        self._role_repo = role_repository
        self._permission_repo = permission_repository

    async def execute(self, request: CreateRoleRequest) -> CreateRoleResponse:
        """Execute the use case to create a new role."""
        # Check for existing role by name
        existing = await self._role_repo.get_by_name(request.name)
        if existing:
            raise ConflictException(f"Role with name '{request.name}' already exists")

        # Validate permission IDs if provided
        if request.permission_ids:
            await self._validate_permission_ids(request.permission_ids)

        # Create role entity using domain factory method
        role = RoleEntity.create(
            name=request.name,
            permission_ids=request.permission_ids,
        )

        created_role = await self._role_repo.create(role)
        return CreateRoleResponse(role=created_role)

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
