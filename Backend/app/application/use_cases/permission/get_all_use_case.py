"""
True Clean Architecture Use Case for getting all permissions.
Use case contains business logic and is independent of frameworks and external concerns.
"""

from dataclasses import dataclass
from typing import List

from app.domain.entities import PermissionEntity
from app.interface.repository.permission_repository_interface import (
    IPermissionRepository,
)


@dataclass(frozen=True)
class GetAllPermissionsRequest:
    """Input port for getting all permissions."""
    pass


@dataclass(frozen=True)
class GetAllPermissionsResponse:
    """Output port for getting all permissions."""
    permissions: List[PermissionEntity]


class GetAllPermissionsUseCase:
    """Use case for retrieving all permissions."""

    def __init__(self, permission_repository: IPermissionRepository):
        self._permission_repo = permission_repository

    async def execute(self, request: GetAllPermissionsRequest) -> GetAllPermissionsResponse:
        """Execute the use case to get all permissions."""
        permissions = await self._permission_repo.get_all()
        return GetAllPermissionsResponse(permissions=permissions)
