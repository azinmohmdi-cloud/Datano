"""Public registration reuses identity creation and assigns only the server role."""
from dataclasses import dataclass, field

from app.application.use_cases.user.create_use_case import CreateUserRequest, CreateUserUseCase
from app.domain.entities import UserEntity
from app.domain.error.exceptions import ConflictException, ServiceUnavailableException, ValidationException
from app.interface.repository.role_repository_interface import IRoleRepository
from app.interface.repository.user_repository_interface import IUserRepository


@dataclass(frozen=True)
class RegisterUserRequest:
    first_name: str
    last_name: str
    email: str
    password: str = field(repr=False)


@dataclass(frozen=True)
class RegisterUserResponse:
    user: UserEntity


class RegisterUserUseCase:
    """Create, activate and assign User in the caller's shared transaction."""

    def __init__(self, create_user: CreateUserUseCase, users: IUserRepository, roles: IRoleRepository) -> None:
        self._create_user = create_user
        self._users = users
        self._roles = roles

    async def execute(self, request: RegisterUserRequest) -> RegisterUserResponse:
        for name in ("first_name", "last_name"):
            if not getattr(request, name).strip():
                raise ValidationException("Name must contain non-whitespace characters", field=name)
        role = await self._roles.get_by_name("User")
        if role is None or not role.is_active:
            raise ServiceUnavailableException("Registration is temporarily unavailable")
        try:
            result = await self._create_user.execute(
                CreateUserRequest(
                    first_name=request.first_name, last_name=request.last_name,
                    email=request.email, password=request.password,
                )
            )
        except ConflictException:
            # A public conflict need not echo an address, username or SQL detail.
            raise ConflictException("An account with this identity already exists") from None
        user = result.user
        user.activate()
        if await self._users.update(user) is None:
            raise ServiceUnavailableException("Registration is temporarily unavailable")
        user = await self._users.assign_role(user.id, role.id)
        return RegisterUserResponse(user)
