import json
from datetime import timedelta
from typing import Optional

from fastapi import APIRouter, Depends, Request, Response

from app.application.use_cases import (
    GetAllPermissionsRequest,
    LoginUseCase,
    LogoutUseCase,
    RefreshAccessTokenUseCase,
)
from app.application.use_cases.auth import (
    LoginRequest,
    LogoutRequest,
    RefreshTokenRequest,
    TokenResponse,
)
from app.application.use_cases.permission import GetAllPermissionsUseCase
from app.domain.error.exceptions import CredentialsValidationException
from app.infra.core.config import config
from app.infra.utils.auth.permission import Permission
from app.interface.dependencies.auth_dependencies import (
    get_authorized_user,
    get_login_usecase,
    get_logout_usecase,
    get_refresh_access_token_usecase,
    get_refresh_token_from_cookie,
)
from app.interface.dependencies.permission_dependencies import (
    get_get_all_permissions_usecase,
)
from app.interface.dto import Permission as PermissionDTO
from app.interface.dto import User, UserLogin
from app.interface.dto.responses import StandardResponse, failure, success
from app.interface.mappers import PermissionMapper

# Create router with prefix and tags
auth_router = APIRouter(prefix="/auth", tags=["auth"])


@auth_router.post("/login", response_model=StandardResponse[TokenResponse])
async def login(
    response: Response,
    user_login: UserLogin,
    usecase: LoginUseCase = Depends(get_login_usecase),
):
    """Authenticate user and return JWT token."""
    result = await usecase.execute(
        LoginRequest(username=user_login.username, password=user_login.password)
    )

    response.set_cookie(
        key=result.refresh_token.title,
        value=result.refresh_token.token,
        httponly=True,
        secure=False,  # Set to True in production with HTTPS
        samesite="strict",
        max_age=int(timedelta(days=config.refresh_token_expire_days).total_seconds()),
        path="/",
    )

    return success(message="Login successful", payload=result.access_token)


@auth_router.post("/refresh", response_model=StandardResponse[TokenResponse])
async def refresh_tokens(
    usecase: RefreshAccessTokenUseCase = Depends(get_refresh_access_token_usecase),
    refresh_token: str = Depends(get_refresh_token_from_cookie),
):
    """Refresh the access token using the refresh token from HTTP-only cookie."""
    result = await usecase.execute(RefreshTokenRequest(refresh_token=refresh_token))

    return success(message="Token refreshed successfully", payload=result.access_token)


@auth_router.post("/logout", response_model=StandardResponse[None])
async def logout(
    request: Request,
    response: Response,
    usecase: LogoutUseCase = Depends(get_logout_usecase),
):
    """Logout the user by blacklisting the refresh token."""
    # Get the refresh token from the cookie
    refresh_token: Optional[str] = request.cookies.get("refresh_token")

    if refresh_token:
        # Blacklist the refresh token in the database
        await usecase.execute(LogoutRequest(refresh_token=refresh_token))

        # Clear the refresh token cookie
        response.delete_cookie(key="refresh_token", path="/")

        return success(message="Logged out successfully", payload=None)

    else:
        raise CredentialsValidationException("No refresh token provided")


@auth_router.get("/permissions", response_model=StandardResponse[list[PermissionDTO]])
async def get_permissions(
    usecase: GetAllPermissionsUseCase = Depends(get_get_all_permissions_usecase),
    _=Depends(get_authorized_user([Permission.Permissions_Read])),
):
    """Return all permissions with their associated policy objects from the JSON files."""
    try:
        # Get permissions from the use case
        result = await usecase.execute(GetAllPermissionsRequest())
        permissions = [
            PermissionMapper.to_dto(permission).model_dump()
            for permission in result.permissions
        ]

        # Load policies from JSON file (still needed for full policy objects)
        with open(config.policies_path, "r") as f:
            policies = json.load(f)

        # Create a map of policy ID to policy object for efficient lookups
        policies_map = {policy["id"]: policy for policy in policies}

        # Replace policy IDs in each permission with full policy objects
        for permission in permissions:
            policy_objects = []
            for policy_id in permission.get("policies", []):
                if policy_id in policies_map:
                    policy_objects.append(policies_map[policy_id])
            permission["policies"] = policy_objects

        return success(
            message="Permissions retrieved successfully", payload=permissions
        )
    except FileNotFoundError:
        return failure(message="Permissions or policies file not found", payload=[])
    except json.JSONDecodeError:
        return failure(
            message="Invalid JSON in permissions or policies file", payload=[]
        )


@auth_router.get("/me", response_model=StandardResponse[User])
async def get_me(
    user=Depends(get_authorized_user()),
):
    return success(message="User retrieved successfully", payload=user)
