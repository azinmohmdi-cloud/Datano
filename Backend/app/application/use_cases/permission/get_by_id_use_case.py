"""
True Clean Architecture Use Case for getting a permission by ID.
Use case contains business logic and is independent of frameworks and external concerns.
"""

from dataclasses import dataclass

from app.domain.entities import PermissionEntity
from app.domain.error.exceptions import ResourceNotFoundException
from app.interface.repository.permission_repository_interface import (
    IPermissionRepository,
)


@dataclass(frozen=True)
class GetPermissionByIdRequest:
    """Input port for getting a permission by ID."""
    permission_id: str


@dataclass(frozen=True)
class GetPermissionByIdResponse:
    """Output port for getting a permission by ID."""
    permission: PermissionEntity


class GetPermissionByIdUseCase:
    """Use case for retrieving a permission by ID."""

    def __init__(self, permission_repository: IPermissionRepository):
        self._permission_repo = permission_repository

    async def execute(
        self, request: GetPermissionByIdRequest
    ) -> GetPermissionByIdResponse:
        """Execute the use case to get a permission by ID."""
        permission = await self._permission_repo.get_by_id(request.permission_id)
        if permission is None:
            raise ResourceNotFoundException(
                resource_type="Permission", identifier=request.permission_id
            )
        return GetPermissionByIdResponse(permission=permission)
