"""
True Clean Architecture Use Case for deleting a user.
Use case contains business logic and is independent of frameworks and external concerns.
"""

from dataclasses import dataclass

from app.domain.entities import UserEntity
from app.domain.error.exceptions import ResourceNotFoundException
from app.interface.repository.user_repository_interface import IUserRepository


@dataclass(frozen=True)
class DeleteUserRequest:
    """Input port for deleting a user."""

    user_id: str


@dataclass(frozen=True)
class DeleteUserResponse:
    """Output port for deleting a user."""

    user: UserEntity


class DeleteUserUseCase:
    """Use case for deleting a user."""

    def __init__(self, user_repository: IUserRepository):
        self._user_repo = user_repository

    async def execute(self, request: DeleteUserRequest) -> DeleteUserResponse:
        """Execute the use case to delete a user."""
        user = await self._user_repo.get_by_id(request.user_id)
        if not user:
            raise ResourceNotFoundException(
                resource_type="User", identifier=request.user_id
            )

        deleted_user = await self._user_repo.delete(request.user_id)
        if not deleted_user:
            raise ResourceNotFoundException(
                resource_type="User", identifier=request.user_id
            )

        return DeleteUserResponse(user=deleted_user)
