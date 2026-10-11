"""
True Clean Architecture Use Case for creating a user.
Use case contains business logic and is independent of frameworks and external concerns.
"""

from dataclasses import dataclass

from app.application.use_cases.auth.interfaces import IPasswordService
from app.domain.entities import UserEntity
from app.domain.error.exceptions import ConflictException
from app.interface.repository.user_repository_interface import IUserRepository


@dataclass(frozen=True)
class CreateUserRequest:
    """Input port for creating a user."""

    first_name: str
    last_name: str
    email: str
    username: str
    password: str


@dataclass(frozen=True)
class CreateUserResponse:
    """Output port for creating a user."""

    user: UserEntity


class CreateUserUseCase:
    """Use case for creating a new user."""

    def __init__(
        self,
        user_repository: IUserRepository,
        password_service: IPasswordService,
    ):
        self._user_repo = user_repository
        self._password_service = password_service

    async def execute(self, request: CreateUserRequest) -> CreateUserResponse:
        """Execute the use case to create a new user."""
        # Check for existing user by email
        existing_email = await self._user_repo.get_by_email(request.email)
        if existing_email:
            raise ConflictException(f"User with email '{request.email}' already exists")

        # Check for existing user by username
        existing_username = await self._user_repo.get_by_username(request.username)
        if existing_username:
            raise ConflictException(
                f"User with username '{request.username}' already exists"
            )

        # Validate password strength
        UserEntity._validate_password(request.password)

        # Hash password and create user entity
        hashed_password = self._password_service.hash(request.password)
        user = UserEntity.create(
            first_name=request.first_name,
            last_name=request.last_name,
            email=request.email,
            username=request.username,
            hashed_password=hashed_password,
        )

        created_user = await self._user_repo.create(user)
        return CreateUserResponse(user=created_user)
