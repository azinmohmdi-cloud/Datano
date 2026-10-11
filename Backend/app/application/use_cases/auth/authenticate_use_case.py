"""
True Clean Architecture Use Case for Authenticating a user.
Use case contains business logic and is independent of frameworks and external concerns.
"""

from app.domain.error.exceptions import (
    CredentialsValidationException,
    InactiveUserException,
)
from app.application.use_cases.auth.interfaces import IPasswordService
from app.interface.repository.user_repository_interface import IUserRepository


class AuthenticateUserUseCase:
    """Use case for authenticating a user."""

    def __init__(
        self,
        user_repository: IUserRepository,
        password_service: "IPasswordService",
    ):
        self._user_repo = user_repository
        self._password_service = password_service

    async def execute(self, username: str, password: str):
        """Execute the use case to authenticate a user."""
        user = await self._user_repo.get_by_username(username)
        if not user or not self._password_service.verify(
            password, user.hashed_password
        ):
            raise CredentialsValidationException("Incorrect username or password")

        if not user.is_active:
            raise InactiveUserException()

        return user
