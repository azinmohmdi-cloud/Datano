from datetime import UTC, datetime, timedelta
from dataclasses import replace
from unittest.mock import AsyncMock
import pytest

from app.application.use_cases.website.html import HTMLFetchError, HTMLFetchFailure, IWebsiteHTMLFetcher, WebsiteHTML
from app.application.use_cases.website.proof import IWebsiteProofRepository, IssueWebsiteChallengeUseCase, VerifyWebsiteChallengeUseCase, WebsiteProofSnapshot
from app.domain.error.exceptions import ServiceUnavailableException, ValidationException, WebsiteChallengeException
from app.infra.services.website_challenge_tokens import WebsiteChallengeTokens
from app.infra.services.website_meta_parser import WebsiteMetaParser


from app.domain.entities import WebsiteEntity


def test_issue_challenge_creates_a_digest_only_owner_bound_24_hour_pending_state():
    start = datetime(2026, 10, 22, tzinfo=UTC)
    website = WebsiteEntity.create("owner", "example.test", now=start)
    issued = website.issue_challenge(b"d" * 32, now=start + timedelta(seconds=1))
    assert issued.challenge_digest == b"d" * 32
    assert issued.challenge_status(issued.updated_at) == "pending"
    assert issued.challenge_expires_at == issued.challenge_issued_at + timedelta(hours=24)
    assert issued.reservation_expires_at == issued.challenge_expires_at
    assert issued.owner_id == website.owner_id and issued.id == website.id
    assert website.challenge_digest is None and issued.verified_at is None



START = datetime(2026, 10, 22, tzinfo=UTC)
TOKEN = "a" * 43

def document(markup: str, *, encoding="utf-8", content_type="text/html; charset=utf-8", url="https://example.test/"):
    return WebsiteHTML(url, content_type, markup.encode(encoding))

def meta(token=TOKEN):
    return f'<meta name="datano-verification" content="{token}">'

def pending():
    site = WebsiteEntity.create("owner", "example.test", now=START)
    return site.issue_challenge(WebsiteChallengeTokens().digest(site, TOKEN), now=START + timedelta(seconds=1))


@pytest.mark.parametrize("markup", [
    f"<html><head>{meta()}</head><body>متن</body></html>", f"<head>{meta()}</head>",
    f"<!doctype html><html><head><title>عنوان</title>{meta()}</head></html>",
    f'<head><META CONTENT="{TOKEN}" NAME="datano-verification" /></head>',
    f'<head><meta name=datano-verification content={TOKEN}></head>',
    f'<head><meta name="other" content="ignored">{meta()}</head>',
    f'<head>{meta().replace("content=\"a", "content=\"&#97;", 1)}</head>',
])
def test_only_an_actual_unambiguous_head_meta_is_extracted(markup):
    assert WebsiteMetaParser().extract(document(markup)) == TOKEN


@pytest.mark.parametrize("markup", [
    meta(), f"<body>{meta()}</body>", f"<head></head><body>{meta()}</body>",
    f"<head><!-- {meta()} --></head>", f"<head>&lt;meta name=datano-verification content={TOKEN}&gt;</head>",
    f"<head><script>const s='{meta()}';</script></head>", f"<head><style>{meta()}</style></head>",
    f"<head><template>{meta()}</template></head>", f"<head><noscript>{meta()}</noscript></head>",
    f"<head><textarea>{meta()}</textarea></head>", f"<head><title>{meta()}</title></head>",
    f"<head><iframe>{meta()}</iframe></head>", f"<head><plaintext>{meta()}</head>",
    f"<head>{meta()}{meta()}</head>", f"<head>{meta()}<head></head>",
    f"<head>{meta()}", f"<head>body text{meta()}</head>",
    f'<head><meta name="datano-verification" name="other" content="{TOKEN}"></head>',
    f'<head><meta name="datano-verification" content="{TOKEN}" content="bad"></head>',
    '<head><meta name="datano-verification"></head>', '<head><meta name="datano-verification" content=""></head>',
    f"<head>{meta('a'*42)}</head>", f"<head>{meta('a'*44)}</head>", f"<head>{meta('آ'*43)}</head>",
    f"<head/><head>{meta()}</head>", f"<head><script/>{meta()}</head>",
    f"<head><template><head>{meta()}</head></template></head>",
    f"<body><head>{meta()}</head></body>", f"<head><![CDATA[{meta()}]]></head>",
    f"<head><div>{meta()}</div></head>",
])
def test_text_inert_body_malformed_and_duplicate_proofs_are_not_metadata(markup):
    assert WebsiteMetaParser().extract(document(markup)) is None


@pytest.mark.parametrize("encoding", ["utf-8", "utf-16", "utf-32", "latin-1", "cp1252"])
def test_supported_document_encodings_preserve_the_actual_meta_value(encoding):
    assert WebsiteMetaParser().extract(document(f"<head>{meta()}</head>", encoding=encoding, content_type=f"text/html; charset={encoding}")) == TOKEN


@pytest.mark.parametrize("content_type", ["application/json", "text/html; charset=utf-7", "text/html; charset=unknown", "text/html; charset=utf-8; charset=latin1"])
def test_unsupported_or_ambiguous_encodings_and_non_html_are_rejected(content_type):
    assert WebsiteMetaParser().extract(document(f"<head>{meta()}</head>", content_type=content_type)) is None


def test_invalid_or_oversized_bytes_do_not_produce_a_proof():
    assert WebsiteMetaParser().extract(WebsiteHTML("https://example.test/", "text/html", b"\xff<head>")) is None
    assert WebsiteMetaParser().extract(WebsiteHTML("https://example.test/", "text/html", b"x" * (5242880 + 1))) is None


def test_crypto_is_random_scoped_and_never_accepts_an_invalid_token():
    crypto = WebsiteChallengeTokens(); site = pending()
    one, two = crypto.generate(), crypto.generate()
    assert one != two and len(one) == len(two) == 43
    digest = crypto.digest(site, one)
    assert isinstance(digest, bytes) and len(digest) == 32
    for other in [replace(site, id="other-site"), replace(site, owner_id="other-owner"), replace(site, hostname="www.example.test"), replace(site, scheme="http")]:
        assert crypto.digest(other, one) != digest
    for bad in ["", "x"*42, "x"*44, "آ"*43, "-"*42+"!", None]:
        assert crypto.digest(site, bad) is None


def test_rotation_expiry_and_terminal_domain_states_are_immutable_and_exact():
    site = pending(); rotated = site.issue_challenge(b"n"*32, now=START + timedelta(seconds=2))
    assert site.challenge_digest != rotated.challenge_digest and site.verified_at is None
    assert rotated.challenge_expires_at == START + timedelta(seconds=2, hours=24)
    assert site.verify_challenge(now=site.challenge_expires_at - timedelta(microseconds=1)).verified_at is not None
    for instant in [site.updated_at, site.challenge_expires_at, site.challenge_expires_at + timedelta(seconds=1)]:
        with pytest.raises(WebsiteChallengeException): site.verify_challenge(now=instant)
    for terminal in [replace(site, released_at=site.updated_at), site.verify_challenge(now=site.updated_at + timedelta(seconds=1))]:
        with pytest.raises(WebsiteChallengeException): terminal.issue_challenge(b"x"*32, now=START + timedelta(hours=2))
    for digest in [b"", b"x"*31, "x"*32]:
        with pytest.raises(ValidationException): site.issue_challenge(digest, now=site.updated_at + timedelta(seconds=1))


async def test_issue_orchestration_only_returns_token_after_persistence():
    site = WebsiteEntity.create("owner", "example.test", now=START)
    repository = AsyncMock(spec=IWebsiteProofRepository)
    repository.snapshot.return_value = WebsiteProofSnapshot(site, False)
    repository.issue.side_effect = lambda session, expected, digest: expected.issue_challenge(digest, now=START + timedelta(seconds=1))
    result = await IssueWebsiteChallengeUseCase(repository, WebsiteChallengeTokens()).execute(b"s"*32, site.id)
    assert result.website.challenge_digest == WebsiteChallengeTokens().digest(site, result.token)
    assert result.token not in repr(result)
    repository.issue.assert_awaited_once()


@pytest.mark.parametrize("mode", ["wrong", "expired", "unissued", "foreign_url", "fetch_failure", "verified"])
async def test_verification_does_not_publish_a_failed_or_unchecked_proof(mode):
    site = pending()
    if mode == "unissued": site = WebsiteEntity.create("owner", "example.test", now=START)
    if mode == "verified": site = site.verify_challenge(now=site.updated_at + timedelta(seconds=1))
    repository = AsyncMock(spec=IWebsiteProofRepository)
    repository.snapshot.return_value = WebsiteProofSnapshot(site, mode not in {"expired", "unissued"})
    fetcher = AsyncMock(spec=IWebsiteHTMLFetcher)
    fetcher.fetch.return_value = document(f"<head>{meta('b'*43 if mode == 'wrong' else TOKEN)}</head>", url="https://other.test/" if mode == "foreign_url" else "https://example.test/")
    if mode == "fetch_failure": fetcher.fetch.side_effect = HTMLFetchError(HTMLFetchFailure.UNSAFE_ADDRESS)
    usecase = VerifyWebsiteChallengeUseCase(repository, WebsiteChallengeTokens(), fetcher, WebsiteMetaParser())
    if mode == "verified": assert await usecase.execute(b"s"*32, site.id) == site
    else:
        with pytest.raises(ServiceUnavailableException if mode == "fetch_failure" else WebsiteChallengeException):
            await usecase.execute(b"s"*32, site.id)
    repository.confirm.assert_not_awaited()
    if mode in {"expired", "unissued", "verified"}: fetcher.fetch.assert_not_awaited()


async def test_verification_matches_digest_of_real_head_meta_then_delegates_atomic_confirmation():
    site = pending(); repository = AsyncMock(spec=IWebsiteProofRepository)
    repository.snapshot.return_value = WebsiteProofSnapshot(site, True)
    repository.confirm.return_value = site.verify_challenge(now=site.updated_at + timedelta(seconds=1))
    fetcher = AsyncMock(spec=IWebsiteHTMLFetcher); fetcher.fetch.return_value = document(f"<html><head>{meta()}</head></html>")
    result = await VerifyWebsiteChallengeUseCase(repository, WebsiteChallengeTokens(), fetcher, WebsiteMetaParser()).execute(b"s"*32, site.id)
    assert result.verified_at is not None
    repository.confirm.assert_awaited_once_with(b"s"*32, site)


@pytest.mark.parametrize("prefix", ["<textarea>body</textarea>", "<iframe>body</iframe>", "<noscript><div></div></noscript>", "</br>", "&nbsp;"])
def test_markup_that_implicitly_closes_browser_head_cannot_authorize_a_later_meta(prefix):
    assert WebsiteMetaParser().extract(document(f"<head>{prefix}{meta()}</head>")) is None
