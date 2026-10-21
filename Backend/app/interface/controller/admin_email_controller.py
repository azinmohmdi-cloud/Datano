from fastapi import APIRouter, BackgroundTasks, Depends, Request, Response

from app.application.use_cases.auth.admin_email import AdminEmailService
from app.application.use_cases.auth.admin_policy import AdminEmailPolicy
from app.application.use_cases.auth.current_identity_use_case import GetCurrentIdentityUseCase
from app.interface.admin_email_route import AdminEmailRoute
from app.interface.csrf import issue_csrf
from app.interface.dependencies.admin_dependencies import get_admin_email_policy, get_admin_email_service, get_admin_grant_repository
from app.interface.dependencies.role_dependencies import get_role_repository
from app.interface.dependencies.user_dependencies import get_user_repository
from app.interface.dto.admin_email_dto import AdminEmailCode, AdminEmailRequest
from app.interface.dto.responses import StandardResponse, success
from app.interface.dto.session_dto import SessionLogin
from app.interface.mappers import UserMapper
from app.interface.repository.admin_grant_repository_interface import IAdminGrantRepository
from app.interface.repository.role_repository_interface import IRoleRepository
from app.interface.repository.user_repository_interface import IUserRepository
from app.interface.session_cookie import SessionCredential, read_session_cookie, write_session_cookie

admin_email_router = APIRouter(prefix="/auth/admin-email",tags=["admin-email"],route_class=AdminEmailRoute)
RESPONSES = {401:{"description":"Invalid/expired opaque session or mailbox proof"},
    413:{"description":"Administrator proof body too large"},
    429:{"description":"Administrator proof quota exceeded","headers":{"Retry-After":{"schema":{"type":"integer"}}}},
    503:{"description":"Administrator proof infrastructure unavailable"}}


@admin_email_router.post("/request",response_model=StandardResponse[None],responses=RESPONSES)
async def request_admin_email(body: AdminEmailRequest, request: Request, response: Response,
        background: BackgroundTasks, credential: SessionCredential = Depends(read_session_cookie),
        flow: AdminEmailService = Depends(get_admin_email_service)):
    """Self only; a generic acknowledgement does not disclose the private allowlist or delivery."""
    await flow.require_actor(credential.token)
    response.headers["Cache-Control"] = "no-store"
    background.add_task(flow.dispatch,credential.token)
    return success("If eligible, a verification code will be sent to the account mailbox",payload=None)


@admin_email_router.post("/verify",response_model=StandardResponse[SessionLogin],responses=RESPONSES)
async def verify_admin_email(body: AdminEmailCode, request: Request, response: Response,
        credential: SessionCredential = Depends(read_session_cookie), flow: AdminEmailService = Depends(get_admin_email_service),
        users: IUserRepository = Depends(get_user_repository), roles: IRoleRepository = Depends(get_role_repository),
        grants: IAdminGrantRepository = Depends(get_admin_grant_repository), policy: AdminEmailPolicy = Depends(get_admin_email_policy)):
    """Commit proof and rotation before reading the resulting public identity.

    Do not inject get_current_identity here: it holds the old user's row lock in
    the request UoW while the proof flow uses short independent transactions.
    """
    issued = await flow.verify(credential.token,body.code.get_secret_value())
    identity = await GetCurrentIdentityUseCase(users,roles,grants,policy).execute(issued.record.user_id)
    write_session_cookie(request,response,issued)
    csrf = issue_csrf(request,response,session_token=issued.token,rotate=True)
    return success("Administrator email verified",payload=SessionLogin(user=UserMapper.to_dto(identity.user),
        effective_role=identity.effective_role,csrf_token=csrf))
