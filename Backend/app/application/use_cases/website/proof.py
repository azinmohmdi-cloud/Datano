"""Owner/session-bound challenge orchestration with no transaction across HTML I/O."""
from dataclasses import dataclass, field
import hmac
from urllib.parse import urlsplit

from app.application.use_cases.website.html import HTMLFetchError, IWebsiteHTMLFetcher, WebsiteHTML
from app.domain.entities import WebsiteEntity
from app.domain.error.exceptions import ServiceUnavailableException, WebsiteChallengeException, ValidationException
from app.domain.website import WebsiteAddress, parse_website_url


class IWebsiteChallengeTokens:
    def generate(self) -> str:
        raise NotImplementedError

    def digest(self, website: WebsiteEntity, token: str) -> bytes | None:
        raise NotImplementedError


class IWebsiteMetaParser:
    def extract(self, document: WebsiteHTML) -> str | None:
        raise NotImplementedError


@dataclass(frozen=True)
class WebsiteProofSnapshot:
    website: WebsiteEntity
    pending: bool


class IWebsiteProofRepository:
    async def snapshot(self, session_digest: bytes, website_id: str) -> WebsiteProofSnapshot:
        raise NotImplementedError

    async def issue(self, session_digest: bytes, expected: WebsiteEntity, digest: bytes) -> WebsiteEntity:
        raise NotImplementedError

    async def confirm(self, session_digest: bytes, expected: WebsiteEntity) -> WebsiteEntity:
        raise NotImplementedError


@dataclass(frozen=True)
class WebsiteChallengeResult:
    website: WebsiteEntity
    token: str = field(repr=False)


class IssueWebsiteChallengeUseCase:
    def __init__(self, repository: IWebsiteProofRepository, tokens: IWebsiteChallengeTokens) -> None:
        self._repository, self._tokens = repository, tokens

    async def execute(self, session_digest: bytes, website_id: str) -> WebsiteChallengeResult:
        snapshot = await self._repository.snapshot(session_digest, website_id)
        if snapshot.website.verified_at is not None:
            raise WebsiteChallengeException()
        token = self._tokens.generate()
        digest = self._tokens.digest(snapshot.website, token)
        if digest is None:
            raise ServiceUnavailableException("Website challenge is temporarily unavailable")
        saved = await self._repository.issue(session_digest, snapshot.website, digest)
        return WebsiteChallengeResult(saved, token)


class VerifyWebsiteChallengeUseCase:
    def __init__(self, repository: IWebsiteProofRepository, tokens: IWebsiteChallengeTokens,
                 fetcher: IWebsiteHTMLFetcher, parser: IWebsiteMetaParser) -> None:
        self._repository, self._tokens, self._fetcher, self._parser = repository, tokens, fetcher, parser

    async def execute(self, session_digest: bytes, website_id: str) -> WebsiteEntity:
        snapshot = await self._repository.snapshot(session_digest, website_id)
        website = snapshot.website
        if website.verified_at is not None:
            return website
        if not snapshot.pending:
            raise WebsiteChallengeException()
        unavailable = False
        try:
            document = await self._fetcher.fetch(WebsiteAddress(website.hostname, website.scheme))
        except HTMLFetchError:
            unavailable = True
        if unavailable:
            raise ServiceUnavailableException("Website ownership could not be checked; try again later")
        valid_url = False
        try:
            final = urlsplit(document.url)
            address = parse_website_url(f"{final.scheme}://{final.netloc}/")
            valid_url = address.hostname == website.hostname and (address.scheme == "https" or website.scheme == "http")
        except (ValueError, ValidationException):
            pass
        token = self._parser.extract(document) if valid_url else None
        digest = self._tokens.digest(website, token) if token is not None else None
        if digest is None or website.challenge_digest is None or not hmac.compare_digest(digest, website.challenge_digest):
            raise WebsiteChallengeException()
        # The repository rechecks session, owner, expiry and exact challenge state
        # under the same hostname lock used by reservation replacement.
        return await self._repository.confirm(session_digest, website)
