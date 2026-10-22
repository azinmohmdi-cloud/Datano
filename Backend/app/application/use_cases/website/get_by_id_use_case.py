from dataclasses import dataclass

from app.domain.entities import WebsiteEntity
from app.domain.error.exceptions import ResourceNotFoundException
from app.interface.repository.website_repository_interface import IWebsiteRepository


@dataclass(frozen=True)
class GetOwnWebsiteRequest:
    website_id: str


@dataclass(frozen=True)
class GetOwnWebsiteResponse:
    website: WebsiteEntity


class GetOwnWebsiteUseCase:
    def __init__(self, websites: IWebsiteRepository) -> None:
        self._websites = websites

    async def execute(self, owner_id: str, request: GetOwnWebsiteRequest) -> GetOwnWebsiteResponse:
        website = await self._websites.get_by_id(request.website_id, owner_id)
        if website is None:
            # A foreign, released and unknown ID have the same public failure.
            raise ResourceNotFoundException("Website", "requested record")
        return GetOwnWebsiteResponse(website)
