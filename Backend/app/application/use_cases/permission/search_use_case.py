"""
True Clean Architecture Use Case for searching permissions.
Use case contains business logic and is independent of frameworks and external concerns.
"""

from dataclasses import dataclass
from typing import List

from app.domain.entities import PermissionEntity
from app.interface.repository.permission_repository_interface import (
    IPermissionRepository,
)


@dataclass(frozen=True)
class SearchPermissionsRequest:
    """Input port for searching permissions by title."""
    title_query: str


@dataclass(frozen=True)
class SearchPermissionsResponse:
    """Output port for searching permissions by title."""
    permissions: List[PermissionEntity]


class SearchPermissionsUseCase:
    """Use case for searching permissions by title."""

    def __init__(self, permission_repository: IPermissionRepository):
        self._permission_repo = permission_repository

    async def execute(
        self, request: SearchPermissionsRequest
    ) -> SearchPermissionsResponse:
        """Execute the use case to search permissions by title."""
        permissions = await self._permission_repo.search_by_title(request.title_query)
        return SearchPermissionsResponse(permissions=permissions)
