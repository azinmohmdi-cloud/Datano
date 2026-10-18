"""
True Clean Architecture Use Case for Authenticating a user.
Use case contains business logic and is independent of frameworks and external concerns.
"""

import asyncio

from app.domain.error.exceptions import (
    CredentialsValidationException,
    InactiveUserException,
    ValidationException,
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

    async def execute(self, username: str | None, password: str, *, email: str | None = None):
        """Execute the use case to authenticate a user."""
        if (email is None) == (username is None):
            raise ValidationException("Provide exactly one email or legacy username", field="email")
        user = (
            await self._user_repo.get_by_email(email)
            if email is not None else await self._user_repo.get_by_username(username)
        )
        message = "Incorrect email or password" if email is not None else "Incorrect username or password"
        if user is None:
            raise CredentialsValidationException(message)
        verified_hash = user.hashed_password
        verification = await asyncio.to_thread(
            self._password_service.verify_and_rehash, password, verified_hash
        )
        if not verification.valid:
            raise CredentialsValidationException(message)

        if not user.is_active:
            raise InactiveUserException()

        if verification.replacement_hash is not None:
            replaced = await self._user_repo.replace_password_hash(
                user.id, verified_hash, verification.replacement_hash
            )
            if replaced:
                user.hashed_password = verification.replacement_hash
            else:
                # A concurrent password change wins; never overwrite it or issue
                # tokens for the superseded secret. A competing same-secret
                # format upgrade can safely succeed after checking its result.
                user = await self._user_repo.get_by_id(user.id)
                if user is None or not await asyncio.to_thread(
                    self._password_service.verify, password, user.hashed_password
                ):
                    raise CredentialsValidationException(message)
                if not user.is_active:
                    raise InactiveUserException()

        return user
