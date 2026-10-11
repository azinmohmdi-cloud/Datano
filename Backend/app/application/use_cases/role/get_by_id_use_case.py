"""
True Clean Architecture Use Case for getting a role by ID.
Use case contains business logic and is independent of frameworks and external concerns.
"""

from dataclasses import dataclass

from app.domain.entities import RoleEntity
from app.domain.error.exceptions import ResourceNotFoundException
from app.interface.repository.role_repository_interface import IRoleRepository


@dataclass(frozen=True)
class GetRoleByIdRequest:
    """Input port for getting a role by ID."""
    role_id: str


@dataclass(frozen=True)
class GetRoleByIdResponse:
    """Output port for getting a role by ID."""
    role: RoleEntity


class GetRoleByIdUseCase:
    """Use case for retrieving a role by ID."""

    def __init__(self, role_repository: IRoleRepository):
        self._role_repo = role_repository

    async def execute(self, request: GetRoleByIdRequest) -> GetRoleByIdResponse:
        """Execute the use case to get a role by ID."""
        role = await self._role_repo.get_by_id(request.role_id)
        if not role:
            raise ResourceNotFoundException(
                resource_type="Role", identifier=request.role_id
            )
        return GetRoleByIdResponse(role=role)
