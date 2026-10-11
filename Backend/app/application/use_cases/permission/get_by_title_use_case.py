"""
True Clean Architecture Use Case for getting a permission by title.
Use case contains business logic and is independent of frameworks and external concerns.
"""

from dataclasses import dataclass

from app.domain.entities import PermissionEntity
from app.domain.error.exceptions import ResourceNotFoundException
from app.interface.repository.permission_repository_interface import (
    IPermissionRepository,
)


@dataclass(frozen=True)
class GetPermissionByTitleRequest:
    """Input port for getting a permission by title."""
    title: str


@dataclass(frozen=True)
class GetPermissionByTitleResponse:
    """Output port for getting a permission by title."""
    permission: PermissionEntity


class GetPermissionByTitleUseCase:
    """Use case for retrieving a permission by title."""

    def __init__(self, permission_repository: IPermissionRepository):
        self._permission_repo = permission_repository

    async def execute(
        self, request: GetPermissionByTitleRequest
    ) -> GetPermissionByTitleResponse:
        """Execute the use case to get a permission by title."""
        permission = await self._permission_repo.get_by_title(request.title)
        if permission is None:
            raise ResourceNotFoundException(
                resource_type="Permission", identifier=request.title
            )
        return GetPermissionByTitleResponse(permission=permission)
