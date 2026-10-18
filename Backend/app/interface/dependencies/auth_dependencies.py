"""
Authentication-related dependencies and dependency injection logic.
"""

from collections.abc import Sequence

from fastapi import Cookie, Depends

from app.application.use_cases.auth import (
    AuthenticateUserUseCase,
    LoginUseCase,
    LogoutUseCase,
    RefreshAccessTokenUseCase,
)
from app.domain.error.exceptions import (
    CredentialsValidationException,
    ForbiddenException,
)
from app.infra.services import Argon2PasswordService, JoseTokenService
from app.infra.utils.auth.permission import Permission
from app.interface.dependencies.refresh_token_dependencies import (
    get_refresh_token_repository,
)
from app.interface.dependencies.role_dependencies import get_role_repository
from app.interface.dto import User
from app.interface.mappers import UserMapper
from app.interface.repository.role_repository_interface import IRoleRepository
from app.interface.repository.user_repository_interface import IUserRepository

from .user_dependencies import get_user_repository
from app.application.use_cases.auth.current_identity_use_case import CurrentIdentity, GetCurrentIdentityUseCase
from app.application.use_cases.auth.session_service import SessionService
from app.interface.dependencies.session_dependencies import get_session_service
from app.interface.session_cookie import SessionCredential, read_session_cookie

def get_refresh_token_from_cookie(
    refresh_token: str = Cookie(None, alias="refresh_token"),
):
    """Extracts the refresh token from corresponding cookie"""
    if not refresh_token:
        raise CredentialsValidationException("No refresh token provided")
    return refresh_token


def get_password_service() -> Argon2PasswordService:
    """Dependency to provide Argon2PasswordService instance."""
    return Argon2PasswordService()


def get_token_service() -> JoseTokenService:
    """Dependency to provide JoseTokenService instance."""
    return JoseTokenService()


async def authorize(identity: CurrentIdentity, required_permissions: Sequence[Permission] = ()) -> User:
    permission_ids = {permission for role in identity.user.roles or [] if role.is_active
                      for permission in role.permission_ids or []}
    if (Permission.Super_User.value not in permission_ids
            and any(permission.value not in permission_ids for permission in required_permissions)):
        raise ForbiddenException()
    return UserMapper.to_dto(identity.user)


def get_authorized_user(required_permissions: Sequence[Permission] = ()):
    async def authorize_dependency(identity: CurrentIdentity = Depends(get_current_identity)) -> User:
        return await authorize(identity, required_permissions)
    return authorize_dependency


async def get_authenticate_user_usecase(
    user_repository: IUserRepository = Depends(get_user_repository),
    password_service: Argon2PasswordService = Depends(get_password_service),
) -> AuthenticateUserUseCase:
    """Dependency to provide AuthenticateUserUseCase instance."""
    return AuthenticateUserUseCase(user_repository, password_service)


async def get_login_usecase(
    authenticate_usecase: AuthenticateUserUseCase = Depends(
        get_authenticate_user_usecase
    ),
    sessions: SessionService = Depends(get_session_service),
    users: IUserRepository = Depends(get_user_repository),
    roles: IRoleRepository = Depends(get_role_repository),
) -> LoginUseCase:
    """Dependency to provide LoginUseCase instance."""
    return LoginUseCase(authenticate_usecase, sessions, GetCurrentIdentityUseCase(users, roles))


async def get_current_identity(
    credential: SessionCredential = Depends(read_session_cookie),
    users: IUserRepository = Depends(get_user_repository),
    roles: IRoleRepository = Depends(get_role_repository),
    sessions: SessionService = Depends(get_session_service),
) -> CurrentIdentity:
    if not credential.present:
        raise CredentialsValidationException()
    record = await sessions.resolve(credential.token)
    if record is None:
        raise CredentialsValidationException()
    return await GetCurrentIdentityUseCase(users, roles).execute(record.user_id)


async def get_refresh_access_token_usecase(
    refresh_token_repository=Depends(get_refresh_token_repository),
    user_repository: IUserRepository = Depends(get_user_repository),
    token_service: JoseTokenService = Depends(get_token_service),
) -> RefreshAccessTokenUseCase:
    """Dependency to provide RefreshAccessTokenUseCase instance."""
    return RefreshAccessTokenUseCase(
        refresh_token_repository, user_repository, token_service
    )


async def get_logout_usecase(
    sessions: SessionService = Depends(get_session_service),
) -> LogoutUseCase:
    """Dependency to provide LogoutUseCase instance."""
    return LogoutUseCase(sessions)
