"""
Authentication-related dependencies and dependency injection logic.
"""

from typing import List, Optional

from fastapi import Cookie, Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.application.use_cases.auth import (
    AuthenticateUserUseCase,
    LoginUseCase,
    LogoutUseCase,
    RefreshAccessTokenUseCase,
)
from app.domain.entities import RoleEntity
from app.domain.error.exceptions import (
    CredentialsValidationException,
    ForbiddenException,
    InactiveUserException,
)
from app.infra.services import BcryptPasswordService, JoseTokenService
from app.infra.utils.auth.jwt import verify_token
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


security = HTTPBearer(auto_error=False)


def get_refresh_token_from_cookie(
    refresh_token: str = Cookie(None, alias="refresh_token"),
):
    """Extracts the refresh token from corresponding cookie"""
    if not refresh_token:
        raise CredentialsValidationException("No refresh token provided")
    return refresh_token


def get_password_service() -> BcryptPasswordService:
    """Dependency to provide BcryptPasswordService instance."""
    return BcryptPasswordService()


def get_token_service() -> JoseTokenService:
    """Dependency to provide JoseTokenService instance."""
    return JoseTokenService()


async def authorize(
    required_permissions: List[Permission] = [],
    access_token: HTTPAuthorizationCredentials = Depends(security),
    user_repository: IUserRepository = Depends(get_user_repository),
    role_repository: IRoleRepository = Depends(get_role_repository),
) -> Optional[User]:
    """
    Get the current user from the token in the request and check required permissions.

    Args:
        required_permissions: List of permissions required to access the resource
        credentials: HTTP authorization credentials from the request
        user_repository: User repository for database access
        role_repository: Role repository for database access

    Returns:
        UserEntity object if token is valid and user has required permissions, raises HTTPException otherwise
    """
    # Authentication --------------------
    if not access_token.credentials:
        raise CredentialsValidationException("No access token provided")

    token_data = verify_token(access_token.credentials)

    if token_data is None or token_data.username is None:
        raise CredentialsValidationException()

    # Get user entity from the database using the username from the token
    # We use the entity method to get the full user with hashed password for domain creation
    user_domain = await user_repository.get_by_username(token_data.username)
    if user_domain is None:
        raise CredentialsValidationException()

    if not user_domain.is_active:
        raise InactiveUserException()

    # Convert entity to DTO
    user_dto = UserMapper.to_dto(user_domain)
    # -------------------- Authentication

    # Authorization --------------------

    # If required permissions are specified, check if the user has them
    if required_permissions:
        # Get all roles assigned to the user
        user_role_ids = [role.id for role in user_dto.roles] if user_dto.roles else []

        # Fetch all user roles with their permission_ids
        user_roles: list[RoleEntity] = []
        for role_id in user_role_ids:
            role = await role_repository.get_by_id(role_id)
            if role:
                user_roles.append(role)

        # Collect all permissions from all user roles
        all_user_permission_ids = set()
        for role in user_roles:
            if role.permission_ids:
                all_user_permission_ids.update(role.permission_ids)

        # Skip permissions check for super users
        if Permission.Super_User.value not in all_user_permission_ids:
            # Check if user has all required permissions
            required_permission_ids = [perm.value for perm in required_permissions]
            for perm_id in required_permission_ids:
                if perm_id not in all_user_permission_ids:
                    raise ForbiddenException()
    # -------------------- Authorization

    return user_dto


def get_authorized_user(required_permissions: List[Permission] = []):
    """
    Factory function to create a permission checker with specific permissions.

    Args:
        required_permissions: List of permissions required for the endpoint

    Returns:
        A function that can be used with FastAPI's Depends
    """

    async def authorize_dependency(
        access_token: Optional[HTTPAuthorizationCredentials] = Depends(security),
        user_repository: IUserRepository = Depends(get_user_repository),
        role_repository: IRoleRepository = Depends(get_role_repository),
    ) -> Optional[User]:
        if access_token is None:
            raise CredentialsValidationException()

        return await authorize(
            access_token=access_token,
            required_permissions=required_permissions,
            user_repository=user_repository,
            role_repository=role_repository,
        )

    return authorize_dependency


async def get_authenticate_user_usecase(
    user_repository: IUserRepository = Depends(get_user_repository),
    password_service: BcryptPasswordService = Depends(get_password_service),
) -> AuthenticateUserUseCase:
    """Dependency to provide AuthenticateUserUseCase instance."""
    return AuthenticateUserUseCase(user_repository, password_service)


async def get_login_usecase(
    authenticate_usecase: AuthenticateUserUseCase = Depends(
        get_authenticate_user_usecase
    ),
    token_service: JoseTokenService = Depends(get_token_service),
    refresh_token_repository=Depends(get_refresh_token_repository),
) -> LoginUseCase:
    """Dependency to provide LoginUseCase instance."""
    return LoginUseCase(authenticate_usecase, token_service, refresh_token_repository)


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
    refresh_token_repository=Depends(get_refresh_token_repository),
) -> LogoutUseCase:
    """Dependency to provide LogoutUseCase instance."""
    return LogoutUseCase(refresh_token_repository)
