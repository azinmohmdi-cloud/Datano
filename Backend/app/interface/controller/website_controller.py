from datetime import UTC, datetime

from fastapi import APIRouter, Depends, Response
from fastapi_pagination import Page, Params

from app.application.use_cases.auth.current_identity_use_case import CurrentIdentity
from app.application.use_cases.website import (
    CreateWebsiteRequest, CreateWebsiteUseCase, GetOwnWebsitesRequest, GetOwnWebsitesUseCase,
    GetOwnWebsiteRequest, GetOwnWebsiteUseCase,
)
from app.interface.dependencies.auth_dependencies import get_current_identity
from app.interface.dependencies.website_dependencies import (
    get_create_website_usecase, get_get_own_websites_usecase, get_get_own_website_usecase,
)
from app.interface.dto.responses import StandardResponse, success
from app.interface.dto.website_dto import Website, WebsiteCreate
from app.interface.mappers.website_mapper import WebsiteMapper

website_router = APIRouter(prefix="/websites", tags=["websites"])
SESSION_ERROR = {401: {"description": "Missing, invalid, expired or revoked session, or inactive account"}}


@website_router.post("/", response_model=StandardResponse[Website], responses={
    **SESSION_ERROR,
    409: {"description": "Hostname unavailable; no other owner's identity is disclosed"},
    422: {"description": "Invalid homepage URL or forbidden fields"},
})
async def create_website(
    body: WebsiteCreate, response: Response,
    identity: CurrentIdentity = Depends(get_current_identity),
    usecase: CreateWebsiteUseCase = Depends(get_create_website_usecase),
) -> StandardResponse[Website]:
    """Reserve this session owner's hostname; repeat registration reuses its record.

    Registration does not issue a challenge, verify ownership or enable reports.
    HTTP 200 covers both a new reservation and the same owner's existing site.
    """
    result = await usecase.execute(identity.user.id, CreateWebsiteRequest(url=body.url))
    response.headers["Cache-Control"] = "no-store"
    response.headers["Vary"] = "Cookie"
    return success("Website registered successfully", payload=WebsiteMapper.to_dto(result.website))


@website_router.get("/", response_model=StandardResponse[Page[Website]], responses=SESSION_ERROR)
async def get_own_websites(
    response: Response, params: Params = Depends(),
    identity: CurrentIdentity = Depends(get_current_identity),
    usecase: GetOwnWebsitesUseCase = Depends(get_get_own_websites_usecase),
) -> StandardResponse[Page[Website]]:
    """Read only the active session owner's current sites, including unverified ones."""
    result = await usecase.execute(identity.user.id, GetOwnWebsitesRequest(page=params.page, size=params.size))
    now = datetime.now(UTC)
    response.headers["Cache-Control"] = "no-store"
    response.headers["Vary"] = "Cookie"
    return success("Websites retrieved successfully", payload=Page(
        items=[WebsiteMapper.to_dto(site, now=now) for site in result.websites],
        total=result.total, page=result.page, size=result.size,
        pages=max(1, (result.total + result.size - 1) // result.size),
    ))


@website_router.get("/{website_id}", response_model=StandardResponse[Website], responses={
    **SESSION_ERROR, 404: {"description": "Website not found for this owner; foreign and absent IDs are indistinguishable"},
})
async def get_own_website(
    website_id: str, response: Response,
    identity: CurrentIdentity = Depends(get_current_identity),
    usecase: GetOwnWebsiteUseCase = Depends(get_get_own_website_usecase),
) -> StandardResponse[Website]:
    result = await usecase.execute(identity.user.id, GetOwnWebsiteRequest(website_id=website_id))
    response.headers["Cache-Control"] = "no-store"
    response.headers["Vary"] = "Cookie"
    return success("Website retrieved successfully", payload=WebsiteMapper.to_dto(result.website))
