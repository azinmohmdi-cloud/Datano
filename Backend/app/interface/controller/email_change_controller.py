from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response

from app.application.use_cases.auth.admin_policy import AdminEmailPolicy
from app.application.use_cases.auth.current_identity_use_case import GetCurrentIdentityUseCase
from app.application.use_cases.auth.email_change import EmailChangeService
from app.interface.csrf import issue_csrf
from app.interface.dependencies.admin_dependencies import get_admin_email_policy, get_admin_grant_repository
from app.interface.dependencies.email_change_dependencies import get_email_change_service
from app.interface.dependencies.role_dependencies import get_role_repository
from app.interface.dependencies.user_dependencies import get_user_repository
from app.interface.dto.email_change_dto import EmailChangeCode, EmailChangeRequest
from app.interface.dto.responses import StandardResponse, success
from app.interface.dto.session_dto import SessionLogin
from app.interface.email_change_route import EmailChangeRoute
from app.interface.mappers import UserMapper
from app.interface.repository.admin_grant_repository_interface import IAdminGrantRepository
from app.interface.repository.role_repository_interface import IRoleRepository
from app.interface.repository.user_repository_interface import IUserRepository
from app.interface.session_cookie import SessionCredential, read_session_cookie, write_session_cookie

email_change_router = APIRouter(prefix="/auth/email-change", tags=["email-change"], route_class=EmailChangeRoute)
RESPONSES = {401: {"description": "Invalid/expired opaque session or new-mailbox proof"},
    413: {"description": "Email change body too large"},
    429: {"description": "Email change quota exceeded", "headers": {"Retry-After": {"schema": {"type": "integer"}}}},
    503: {"description": "Email change infrastructure unavailable"}}


@email_change_router.post("/request", response_model=StandardResponse[None], responses=RESPONSES)
async def request_email_change(body: EmailChangeRequest, request: Request, response: Response,
        background: BackgroundTasks, credential: SessionCredential = Depends(read_session_cookie),
        flow: EmailChangeService = Depends(get_email_change_service)):
    """Self only; acknowledgement discloses neither availability nor delivery."""
    await flow.require_actor(credential.token)
    response.headers["Cache-Control"] = "no-store"
    background.add_task(flow.dispatch, credential.token, body.email.get_secret_value())
    return success("If eligible, a verification code will be sent to the new mailbox", payload=None)


@email_change_router.post("/verify", response_model=StandardResponse[SessionLogin],
    responses=RESPONSES | {409: {"description": "Email became unavailable before confirmation"}})
async def verify_email_change(body: EmailChangeCode, request: Request, response: Response,
        credential: SessionCredential = Depends(read_session_cookie), flow: EmailChangeService = Depends(get_email_change_service),
        users: IUserRepository = Depends(get_user_repository), roles: IRoleRepository = Depends(get_role_repository),
        grants: IAdminGrantRepository = Depends(get_admin_grant_repository), policy: AdminEmailPolicy = Depends(get_admin_email_policy)):
    # No get_current_identity dependency: it would hold the user row lock while
    # the independent proof transaction needs it. Read identity after commit.
    issued = await flow.verify(credential.token, body.email.get_secret_value(), body.code.get_secret_value())
    identity = await GetCurrentIdentityUseCase(users, roles, grants, policy).execute(issued.record.user_id)
    write_session_cookie(request, response, issued)
    csrf = issue_csrf(request, response, session_token=issued.token, rotate=True)
    return success("Email address updated", payload=SessionLogin(user=UserMapper.to_dto(identity.user),
        effective_role=identity.effective_role, csrf_token=csrf))
