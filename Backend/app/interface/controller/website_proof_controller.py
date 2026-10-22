from fastapi import APIRouter, Depends, Response

from app.application.use_cases.website.proof import IssueWebsiteChallengeUseCase, VerifyWebsiteChallengeUseCase
from app.domain.error.exceptions import CredentialsValidationException
from app.infra.services.session_token_service import OpaqueSessionTokens
from app.interface.dependencies.website_dependencies import get_issue_website_challenge_usecase, get_verify_website_challenge_usecase
from app.interface.dto.responses import StandardResponse, success
from app.interface.dto.website_dto import Website, WebsiteChallenge, WebsiteProofInput
from app.interface.mappers.website_mapper import WebsiteMapper
from app.interface.session_cookie import SessionCredential, read_session_cookie
from app.interface.website_proof_route import WebsiteProofRoute

website_proof_router = APIRouter(prefix="/websites", tags=["websites"], route_class=WebsiteProofRoute)
ERRORS = {401: {"description": "Invalid session or inactive account"},
    404: {"description": "Website not found for the current owner"},
    409: {"description": "Challenge missing, invalid, expired, changed or already verified on issuance"},
    413: {"description": "Proof request body too large"},
    429: {"description": "Technical proof rate limit; Retry-After applies"},
    503: {"description": "Proof storage or safe HTML receipt unavailable"}}


def proof_credential(credential: SessionCredential = Depends(read_session_cookie)) -> bytes:
    digest = OpaqueSessionTokens().digest(credential.token) if credential.present else None
    if digest is None: raise CredentialsValidationException()
    return digest


def private(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"
    response.headers["Vary"] = "Cookie"


@website_proof_router.post("/{website_id}/challenge", response_model=StandardResponse[WebsiteChallenge], responses=ERRORS)
async def issue_website_challenge(website_id: str, body: WebsiteProofInput, response: Response,
    digest: bytes = Depends(proof_credential),
    usecase: IssueWebsiteChallengeUseCase = Depends(get_issue_website_challenge_usecase)) -> StandardResponse[WebsiteChallenge]:
    """Issue/rotate this owner's 24-hour proof. Only this response exposes its token."""
    result = await usecase.execute(digest, website_id)
    private(response)
    return success("Website challenge issued", payload=WebsiteChallenge(website=WebsiteMapper.to_dto(result.website),
        token=result.token, meta_tag=f'<meta name="datano-verification" content="{result.token}">'))


@website_proof_router.post("/{website_id}/verify", response_model=StandardResponse[Website], responses=ERRORS)
async def verify_website_challenge(website_id: str, body: WebsiteProofInput, response: Response,
    digest: bytes = Depends(proof_credential),
    usecase: VerifyWebsiteChallengeUseCase = Depends(get_verify_website_challenge_usecase)) -> StandardResponse[Website]:
    """Read safe homepage HTML and atomically verify only the still current challenge."""
    website = await usecase.execute(digest, website_id)
    private(response)
    return success("Website ownership verified", payload=WebsiteMapper.to_dto(website))
