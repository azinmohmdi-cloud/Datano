"""
True Clean Architecture Use Case for getting all users.
Use case contains business logic and is independent of frameworks and external concerns.
"""

from dataclasses import dataclass
from typing import List

from app.domain.entities import UserEntity
from app.interface.repository.user_repository_interface import IUserRepository
from fastapi_pagination import Params


@dataclass(frozen=True)
class GetAllUsersRequest:
    """Input port for getting all users."""

    page: int = 1
    size: int = 20


@dataclass(frozen=True)
class GetAllUsersResponse:
    """Output port for getting all users."""

    users: List[UserEntity]
    total: int
    page: int
    size: int


class GetAllUsersUseCase:
    """Use case for retrieving all users."""

    def __init__(self, user_repository: IUserRepository):
        self._user_repo = user_repository

    async def execute(self, request: GetAllUsersRequest) -> GetAllUsersResponse:
        """Execute the use case to get all users."""
        page = await self._user_repo.get_all(
            Params(page=request.page, size=request.size)
        )
        return GetAllUsersResponse(
            users=page.items,
            total=page.total,
            page=request.page,
            size=request.size,
        )
