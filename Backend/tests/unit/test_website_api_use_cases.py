from unittest.mock import AsyncMock

import pytest
from fastapi_pagination import Page, Params

from app.application.use_cases.website import (
    CreateWebsiteRequest, CreateWebsiteUseCase, GetOwnWebsiteRequest, GetOwnWebsiteUseCase,
    GetOwnWebsitesRequest, GetOwnWebsitesUseCase,
)
from app.domain.entities import WebsiteEntity
from app.domain.error.exceptions import ResourceNotFoundException, ValidationException
from app.domain.website import parse_website_url
from app.interface.repository.website_repository_interface import IWebsiteRepository


@pytest.mark.parametrize("source,expected", [
    ("https://EXAMPLE.COM./", ("example.com", "https")),
    ("HTTP://Example.COM", ("example.com", "http")),
    (" https://example.com/ ", ("example.com", "https")),
    ("https://example.com:443/", ("example.com", "https")),
    ("http://example.com:80", ("example.com", "http")),
    ("https://example.com:00443/", ("example.com", "https")),
    ("https://www.example.com/", ("www.example.com", "https")),
    ("https://shop.example.com/", ("shop.example.com", "https")),
    ("https://مثال.ایران/", ("xn--mgbh0fb.xn--mgba3a4f16a", "https")),
    ("https://BÜCHER.de./", ("xn--bcher-kva.de", "https")),
    ("https://faß.de/", ("xn--fa-hia.de", "https")),
    ("https://ｅｘａｍｐｌｅ。ＣＯＭ．/", ("example.com", "https")),
])
def test_homepage_url_parsing_preserves_approved_identity(source, expected):
    address = parse_website_url(source)
    assert (address.hostname, address.scheme) == expected
    assert address.url == expected[1] + "://" + expected[0] + "/"


INVALID_URLS = [
    "", "example.com", "//example.com", "ftp://example.com", "file:///etc/passwd", "javascript:alert(1)",
    "https://user:private@example.com/", "https://user@example.com/", "https://@example.com/",
    "https://example.com:80/", "http://example.com:443/", "https://example.com:8000/",
    "https://example.com:/", "https://example.com:+443/", "https://example.com:４４３/",
    "https://example.com:0/", "https://example.com:443:443/", "https://example.com:port/",
    "https://example.com/a", "https://example.com/a/..", "https://example.com/.", "https://example.com//",
    "https://example.com?", "https://example.com/?", "https://example.com?private=secret",
    "https://example.com#", "https://example.com/#private", "https://example.com\\@evil.example/",
    "https://example.com\t.evil.example/", "https://example.com\x00/", "https://example.com\x7f/",
    "https://example.com\n/", "https://ex ample.com/", "https://127.0.0.1/", "https://127.1/",
    "http://2130706433/", "http://0x7f000001/", "http://0177.0.0.1/", "http://[::1]/",
    "http://[::ffff:127.0.0.1]/", "http://169.254.169.254/", "http://10.0.0.1/",
    "https://localhost/", "https://app.localhost/", "https://app.local/", "https://internal/",
    "https://example..com/", "https://-bad.example/", "https://bad_host.example/",
    "https://%65xample.com/", "https://example.com../", "https://" + "a" * 64 + ".example/",
    "https://" + ".".join(["a" * 63] * 4) + "/", None, 123,
]


@pytest.mark.parametrize("source", INVALID_URLS)
def test_prohibited_url_syntax_is_rejected_without_echoing_input(source):
    with pytest.raises(ValidationException) as error:
        parse_website_url(source)
    assert str(error.value) == "Invalid website URL" and error.value.details == {"field": "url"}


async def test_creation_uses_trusted_owner_and_canonical_candidate_and_returns_existing_record():
    repo = AsyncMock(spec=IWebsiteRepository)
    existing = WebsiteEntity.create("session-owner", "example.com", scheme="http")
    repo.claim.return_value = existing
    result = await CreateWebsiteUseCase(repo).execute("session-owner", CreateWebsiteRequest("https://EXAMPLE.COM:443/"))
    assert result.website == existing
    candidate = repo.claim.await_args.args[0]
    assert candidate.owner_id == "session-owner" and candidate.hostname == "example.com" and candidate.scheme == "https"
    assert candidate.verified_at is candidate.challenge_digest is None


async def test_invalid_url_never_attempts_a_claim():
    repo = AsyncMock(spec=IWebsiteRepository)
    with pytest.raises(ValidationException):
        await CreateWebsiteUseCase(repo).execute("owner", CreateWebsiteRequest("https://example.com/a/.."))
    repo.claim.assert_not_awaited()


async def test_read_by_id_propagates_only_the_authenticated_owner():
    repo = AsyncMock(spec=IWebsiteRepository)
    site = WebsiteEntity.create("owner", "example.com")
    repo.get_by_id.return_value = site
    result = await GetOwnWebsiteUseCase(repo).execute("owner", GetOwnWebsiteRequest(site.id))
    assert result.website == site
    repo.get_by_id.assert_awaited_once_with(site.id, "owner")
    repo.get_by_id.return_value = None
    with pytest.raises(ResourceNotFoundException) as error:
        await GetOwnWebsiteUseCase(repo).execute("other-owner", GetOwnWebsiteRequest(site.id))
    assert site.id not in str(error.value) and "other-owner" not in str(error.value)


async def test_pagination_keeps_owner_page_size_and_total():
    repo = AsyncMock(spec=IWebsiteRepository)
    site = WebsiteEntity.create("owner", "example.com")
    repo.get_by_owner.return_value = Page(items=[site], page=2, size=2, total=3, pages=2)
    result = await GetOwnWebsitesUseCase(repo).execute("owner", GetOwnWebsitesRequest(page=2, size=2))
    assert result.websites == [site] and result.page == 2 and result.size == 2 and result.total == 3
    repo.get_by_owner.assert_awaited_once_with("owner", Params(page=2, size=2))
