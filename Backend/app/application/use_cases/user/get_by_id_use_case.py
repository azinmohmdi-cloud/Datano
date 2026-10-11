"""
True Clean Architecture Use Case for getting a user by ID.
Use case contains business logic and is independent of frameworks and external concerns.
"""

from dataclasses import dataclass

from app.domain.entities import UserEntity
from app.domain.error.exceptions import ResourceNotFoundException
from app.interface.repository.user_repository_interface import IUserRepository


@dataclass(frozen=True)
class GetUserByIdRequest:
    """Input port for getting a user by ID."""

    user_id: str


@dataclass(frozen=True)
class GetUserByIdResponse:
    """Output port for getting a user by ID."""

    user: UserEntity


class GetUserByIdUseCase:
    """Use case for retrieving a user by ID."""

    def __init__(self, user_repository: IUserRepository):
        self._user_repo = user_repository

    async def execute(self, request: GetUserByIdRequest) -> GetUserByIdResponse:
        """Execute the use case to get a user by ID."""
        user = await self._user_repo.get_by_id(request.user_id)
        if not user:
            raise ResourceNotFoundException(
                resource_type="User", identifier=request.user_id
            )
        return GetUserByIdResponse(user=user)
