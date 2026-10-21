import json
from dataclasses import replace

from fastapi import APIRouter, Depends, Request, Response

from app.application.use_cases import (
    GetAllPermissionsRequest,
    LoginUseCase,
    LogoutUseCase,
)
from app.application.use_cases.auth import (
    LoginRequest,
    LogoutRequest,
)
from app.application.use_cases.permission import GetAllPermissionsUseCase
from app.domain.error.exceptions import ForbiddenException, LegacyAuthenticationRetiredException
from app.infra.core.config import config
from app.infra.utils.auth.permission import Permission
from app.interface.dependencies.auth_dependencies import (
    get_authorized_user,
    get_login_usecase,
    get_current_identity,
    get_logout_usecase,
)
from app.interface.dependencies.permission_dependencies import (
    get_get_all_permissions_usecase,
)
from app.interface.dto import Permission as PermissionDTO
from app.interface.dto import User, UserLogin
from app.interface.dto.responses import StandardResponse, failure, success
from app.interface.mappers import PermissionMapper
from app.interface.mappers import UserMapper
from app.interface.dto.session_dto import CurrentUser, SessionLogin, CsrfToken
from app.application.use_cases.auth.current_identity_use_case import CurrentIdentity
from app.application.use_cases.user.update_own_profile import UpdateOwnProfileRequest, UpdateOwnProfileUseCase
from app.interface.dependencies.user_dependencies import get_update_own_profile_usecase
from app.interface.dto.profile_dto import OwnProfileUpdate
from app.interface.session_cookie import (
    SessionCredential, clear_session_cookie, read_session_cookie, session_cookie_policy, write_session_cookie,
)
from app.interface.login_route import LoginRoute
from app.interface.csrf import clear_csrf_cookie, issue_csrf
from app.infra.services.csrf_service import CsrfService

# Create router with prefix and tags
auth_router = APIRouter(prefix="/auth", tags=["auth"], route_class=LoginRoute)


@auth_router.post("/login", response_model=StandardResponse[SessionLogin], responses={
    401: {"description":"Invalid credentials, inactive account or legacy password recovery required"},
    413: {"description":"Credential body exceeds the configured byte limit"},
    429: {"description":"Login attempt quota exceeded", "headers": {
        "Retry-After": {"schema":{"type":"integer"}, "description":"Seconds until retry"}}},
    503: {"description":"Login attempt storage unavailable"},
})
async def login(
    request: Request,
    response: Response,
    user_login: UserLogin,
    usecase: LoginUseCase = Depends(get_login_usecase),
):
    """Authenticate, rotate the opaque session and return current server identity.

    Only the opaque cookie authenticates product requests.
    """
    result = await usecase.execute(
        LoginRequest(username=user_login.username, email=user_login.email,
            password=user_login.password.get_secret_value(), remember_me=user_login.remember_me,
            previous_session_token=request.cookies.get(session_cookie_policy(request).name))
    )

    write_session_cookie(request, response, result.session)
    response.headers["Cache-Control"] = "no-store"
    csrf_token = issue_csrf(request, response, session_token=result.session.token, rotate=True)
    if "refresh_token" in request.cookies:
        response.delete_cookie("refresh_token", path="/", secure=session_cookie_policy(request).secure,
            httponly=True, samesite="strict")
    return success(message="Login successful", payload=SessionLogin(
        user=UserMapper.to_dto(result.identity.user), effective_role=result.identity.effective_role,
        csrf_token=csrf_token,
    ))


@auth_router.get("/csrf", response_model=StandardResponse[CsrfToken])
async def csrf_token(request: Request, response: Response):
    service = CsrfService.from_config(request.app.state.settings)
    origins = request.headers.getlist("origin")
    if origins and not service.valid_origin(origins):
        raise ForbiddenException("CSRF Origin rejected")
    token = issue_csrf(request, response)
    return success("CSRF token issued", payload=CsrfToken(csrf_token=token))


@auth_router.post("/refresh", deprecated=True, responses={410:{"description":"Legacy token authentication retired; sign in again"}})
async def refresh_tokens():
    raise LegacyAuthenticationRetiredException()


@auth_router.post("/logout", response_model=StandardResponse[None], openapi_extra={"security": [{}]}, responses={
    200: {"description": "Current opaque session revoked; browser credentials cleared. Safe to repeat."},
    503: {"description": "Logout storage unavailable; logout did not succeed"},
    500: {"description": "Logout transaction failed; browser credentials are not cleared"},
})
async def logout(
    request: Request,
    response: Response,
    credential: SessionCredential = Depends(read_session_cookie),
    usecase: LogoutUseCase = Depends(get_logout_usecase),
):
    """Revoke only the current cookie's session, then clear its browser cookies.

    Origin and CSRF validation remain mandatory even for absent/stale cookies.
    No Bearer, body-selected account or active-role permission is used.
    """
    await usecase.execute(LogoutRequest(session_token=credential.token))
    clear_session_cookie(request, response)
    clear_csrf_cookie(request, response)
    if "refresh_token" in request.cookies:
        response.delete_cookie("refresh_token", secure=session_cookie_policy(request).secure,
            httponly=True, samesite="strict", path="/")
    response.headers["Cache-Control"] = "no-store"
    return success(message="Logged out successfully", payload=None)


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


@auth_router.get("/me", response_model=StandardResponse[CurrentUser], responses={
    401: {"description":"Missing, invalid, expired or revoked credentials, or inactive account"},
})
async def get_me(
    response: Response,
    identity: CurrentIdentity = Depends(get_current_identity),
):
    response.headers["Cache-Control"] = "no-store"
    user = CurrentUser(**UserMapper.to_dto(identity.user).model_dump(), effective_role=identity.effective_role)
    return success(message="User retrieved successfully", payload=user)


@auth_router.patch("/me", response_model=StandardResponse[CurrentUser], responses={
    401: {"description": "Missing, invalid, expired or revoked session, or inactive account"},
    422: {"description": "Invalid names, empty patch or forbidden account-control fields"},
})
async def update_own_profile(
    body: OwnProfileUpdate,
    response: Response,
    identity: CurrentIdentity = Depends(get_current_identity),
    usecase: UpdateOwnProfileUseCase = Depends(get_update_own_profile_usecase),
):
    """Update only the cookie owner's supplied names; no user ID is accepted."""
    updated = await usecase.execute(identity.user.id,
        UpdateOwnProfileRequest(first_name=body.first_name, last_name=body.last_name))
    # Keep the permission-filtered identity from the shared request transaction;
    # the narrow write changes only supplied names and the profile timestamp.
    public_user = replace(identity.user, first_name=updated.first_name,
        last_name=updated.last_name, updated_at=updated.updated_at)
    response.headers["Cache-Control"] = "no-store"
    return success("Profile updated successfully", payload=CurrentUser(
        **UserMapper.to_dto(public_user).model_dump(), effective_role=identity.effective_role))
