from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response
from fastapi.security import APIKeyCookie

from app.application.use_cases.auth.password_recovery import PasswordRecoveryService, ResetPasswordService
from app.interface.csrf import clear_csrf_cookie, issue_csrf
from app.interface.dependencies.recovery_dependencies import get_password_recovery_flow, get_reset_password_service
from app.interface.dto.recovery_dto import NewPassword, RecoveryCode, RecoveryEmail, RecoveryVerified
from app.interface.dto.responses import StandardResponse, success
from app.interface.recovery_cookie import clear_recovery_cookie, recovery_cookie_name, write_recovery_cookie
from app.interface.recovery_route import RecoveryRoute
from app.interface.session_cookie import clear_session_cookie, session_cookie_policy

recovery_router = APIRouter(prefix="/auth/password-recovery", tags=["password-recovery"], route_class=RecoveryRoute)
recovery_security = APIKeyCookie(name="__Host-datano_recovery", scheme_name="PasswordRecovery", auto_error=False)
RESPONSES = {413:{"description":"Recovery body exceeds the configured byte limit"},
    429:{"description":"Recovery peer quota exceeded", "headers":{"Retry-After":{"schema":{"type":"integer"}}}},
    503:{"description":"Recovery infrastructure unavailable"}}


@recovery_router.post("/request", response_model=StandardResponse[None], responses=RESPONSES, openapi_extra={"security":[{}]})
async def request_code(body: RecoveryEmail, response: Response, background: BackgroundTasks,
                       service: PasswordRecoveryService = Depends(get_password_recovery_flow)):
    """Same response for registered, unknown, inactive, throttled-account and mail-failure cases.

    This acknowledges the request, never claims delivery. Account lookup/send runs
    after the response body; this is an in-process task, not a durable queue.
    """
    response.headers["Cache-Control"] = "no-store"
    background.add_task(service.dispatch, body.email)
    return success("If this email is eligible, a recovery code will be sent", payload=None)


@recovery_router.post("/verify", response_model=StandardResponse[RecoveryVerified],
    responses={**RESPONSES, 401:{"description":"Invalid, expired, exhausted or consumed recovery proof"}}, openapi_extra={"security":[{}]})
async def verify_code(body: RecoveryCode, request: Request, response: Response,
                      service: PasswordRecoveryService = Depends(get_password_recovery_flow)):
    grant = await service.verify(body.email, body.code.get_secret_value())
    seconds = request.app.state.settings.recovery_grant_seconds
    write_recovery_cookie(request, response, grant.token, seconds)
    csrf = issue_csrf(request, response, rotate=True)
    return success("Recovery code verified", payload=RecoveryVerified(expires_in=seconds, csrf_token=csrf))


@recovery_router.post("/reset", response_model=StandardResponse[None],
    responses={**RESPONSES, 401:{"description":"Missing, invalid, expired or consumed recovery cookie"}})
async def reset_password(body: NewPassword, request: Request, response: Response,
                         secure_grant: str | None = Depends(recovery_security),
                         service: ResetPasswordService = Depends(get_reset_password_service)):
    token = secure_grant if session_cookie_policy(request).secure else request.cookies.get(recovery_cookie_name(request))
    await service.execute(token, body.password.get_secret_value(), body.password_confirmation.get_secret_value())
    clear_recovery_cookie(request, response)
    clear_session_cookie(request, response)
    clear_csrf_cookie(request, response)
    if "refresh_token" in request.cookies:
        response.delete_cookie("refresh_token", secure=session_cookie_policy(request).secure, httponly=True, samesite="strict", path="/")
    response.headers["Cache-Control"] = "no-store"
    return success("Password updated; sign in again", payload=None)
