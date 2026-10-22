"""Bounded homepage receipt port; issuing and verifying proof belongs to BE-020."""
from dataclasses import dataclass, field
from enum import StrEnum

from app.domain.website import WebsiteAddress


@dataclass(frozen=True)
class WebsiteHTML:
    url: str = field(repr=False)
    content_type: str
    body: bytes = field(repr=False)


class HTMLFetchFailure(StrEnum):
    INVALID_TARGET = "invalid_target"
    UNSAFE_ADDRESS = "unsafe_address"
    DNS = "dns"
    REDIRECT = "redirect"
    TIMEOUT = "timeout"
    TOO_LARGE = "too_large"
    CONTENT = "content"
    HTTP_STATUS = "http_status"
    NETWORK = "network"
    PROTOCOL = "protocol"


class HTMLFetchError(Exception):
    """Only a safe reason, never the URL, DNS answer, response or provider error."""
    def __init__(self, reason: HTMLFetchFailure) -> None:
        super().__init__(f"Website HTML fetch failed: {reason.value}")
        self.reason = reason


class IWebsiteHTMLFetcher:
    async def fetch(self, address: WebsiteAddress) -> WebsiteHTML:
        raise NotImplementedError
