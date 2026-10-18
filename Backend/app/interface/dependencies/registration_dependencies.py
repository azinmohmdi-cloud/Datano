from fastapi import Depends, Request

from app.application.use_cases.auth.interfaces import IRegistrationLimiter
from app.application.use_cases.auth.register_use_case import RegisterUserUseCase
from app.application.use_cases.user.create_use_case import CreateUserUseCase
from app.domain.error.exceptions import ServiceUnavailableException
from app.infra.services.registration_limiter import PostgresRegistrationLimiter
from app.interface.dependencies.role_dependencies import get_role_repository
from app.interface.dependencies.user_dependencies import get_create_user_usecase, get_user_repository
from app.interface.repository.role_repository_interface import IRoleRepository
from app.interface.repository.user_repository_interface import IUserRepository


def get_registration_limiter(request: Request) -> IRegistrationLimiter:
    database = getattr(request.app.state, "database", None)
    if database is None:
        raise ServiceUnavailableException("Registration is temporarily unavailable")
    settings = request.app.state.settings
    return PostgresRegistrationLimiter(database, limit=settings.registration_ip_limit,
        window_seconds=settings.registration_window_seconds)


async def get_register_user_usecase(
    create_user: CreateUserUseCase = Depends(get_create_user_usecase),
    users: IUserRepository = Depends(get_user_repository),
    roles: IRoleRepository = Depends(get_role_repository),
) -> RegisterUserUseCase:
    return RegisterUserUseCase(create_user, users, roles)
