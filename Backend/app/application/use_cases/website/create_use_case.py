from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime

from app.domain.entities import WebsiteEntity
from app.domain.website import parse_website_url
from app.interface.repository.website_repository_interface import IWebsiteRepository


@dataclass(frozen=True)
class CreateWebsiteRequest:
    url: str = field(repr=False)


@dataclass(frozen=True)
class CreateWebsiteResponse:
    website: WebsiteEntity


class CreateWebsiteUseCase:
    def __init__(self, websites: IWebsiteRepository, *, clock: Callable[[], datetime] | None = None) -> None:
        self._websites = websites
        self._clock = clock if clock is not None else lambda: datetime.now(UTC)

    async def execute(self, owner_id: str, request: CreateWebsiteRequest) -> CreateWebsiteResponse:
        # owner_id is supplied by the authenticated server identity, never a DTO.
        address = parse_website_url(request.url)
        candidate = WebsiteEntity.create(owner_id, address.hostname, scheme=address.scheme, now=self._clock())
        return CreateWebsiteResponse(await self._websites.claim(candidate))
