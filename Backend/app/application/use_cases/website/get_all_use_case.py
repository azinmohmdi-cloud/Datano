from dataclasses import dataclass

from fastapi_pagination import Params

from app.domain.entities import WebsiteEntity
from app.interface.repository.website_repository_interface import IWebsiteRepository


@dataclass(frozen=True)
class GetOwnWebsitesRequest:
    page: int = 1
    size: int = 50


@dataclass(frozen=True)
class GetOwnWebsitesResponse:
    websites: list[WebsiteEntity]
    total: int
    page: int
    size: int


class GetOwnWebsitesUseCase:
    def __init__(self, websites: IWebsiteRepository) -> None:
        self._websites = websites

    async def execute(self, owner_id: str, request: GetOwnWebsitesRequest) -> GetOwnWebsitesResponse:
        result = await self._websites.get_by_owner(owner_id, Params(page=request.page, size=request.size))
        return GetOwnWebsitesResponse(websites=result.items, total=result.total, page=result.page, size=result.size)
