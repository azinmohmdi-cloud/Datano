"""
True Clean Architecture Use Case for updating a user.
Use case contains business logic and is independent of frameworks and external concerns.
"""

from dataclasses import dataclass
from typing import Optional

from app.domain.entities import UserEntity
from app.domain.error.exceptions import ConflictException, ResourceNotFoundException
from app.interface.repository.user_repository_interface import IUserRepository


@dataclass(frozen=True)
class UpdateUserRequest:
    """Input port for updating a user."""

    user_id: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    email: Optional[str] = None
    username: Optional[str] = None
    is_active: Optional[bool] = None


@dataclass(frozen=True)
class UpdateUserResponse:
    """Output port for updating a user."""

    user: UserEntity


class UpdateUserUseCase:
    """Use case for updating a user."""

    def __init__(self, user_repository: IUserRepository):
        self._user_repo = user_repository

    async def execute(self, request: UpdateUserRequest) -> UpdateUserResponse:
        """Execute the use case to update a user."""
        user = await self._user_repo.get_by_id(request.user_id)
        if not user:
            raise ResourceNotFoundException(
                resource_type="User", identifier=request.user_id
            )

        # Check email uniqueness if changing
        if request.email and request.email != user.email:
            existing = await self._user_repo.get_by_email(request.email)
            if existing and existing.id != request.user_id:
                raise ConflictException(
                    f"User with email '{request.email}' already exists"
                )

        # Check username uniqueness if changing
        if request.username and request.username != user.username:
            existing = await self._user_repo.get_by_username(request.username)
            if existing and existing.id != request.user_id:
                raise ConflictException(
                    f"User with username '{request.username}' already exists"
                )

        # Update user using domain method
        user.update_info(
            first_name=request.first_name,
            last_name=request.last_name,
            email=request.email,
            username=request.username,
            is_active=request.is_active,
        )

        updated_user = await self._user_repo.update(user)
        if not updated_user:
            raise ResourceNotFoundException(
                resource_type="User", identifier=request.user_id
            )

        return UpdateUserResponse(user=updated_user)
