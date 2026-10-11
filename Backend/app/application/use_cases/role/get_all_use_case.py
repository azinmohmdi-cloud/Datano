"""
True Clean Architecture Use Case for getting all roles.
Use case contains business logic and is independent of frameworks and external concerns.
"""

from dataclasses import dataclass
from typing import List

from fastapi_pagination import Params

from app.domain.entities import RoleEntity
from app.interface.repository.role_repository_interface import IRoleRepository


@dataclass(frozen=True)
class GetAllRolesRequest:
    """Input port for getting all roles."""
    page: int = 1
    size: int = 20


@dataclass(frozen=True)
class GetAllRolesResponse:
    """Output port for getting all roles."""
    roles: List[RoleEntity]
    total: int
    page: int
    size: int


class GetAllRolesUseCase:
    """Use case for retrieving all roles."""

    def __init__(self, role_repository: IRoleRepository):
        self._role_repo = role_repository

    async def execute(self, request: GetAllRolesRequest) -> GetAllRolesResponse:
        """Execute the use case to get all roles."""
        page = await self._role_repo.get_all(
            Params(page=request.page, size=request.size)
        )
        return GetAllRolesResponse(
            roles=page.items,
            total=page.total,
            page=request.page,
            size=request.size,
        )
