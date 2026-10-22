from dataclasses import FrozenInstanceError, replace
from datetime import UTC, datetime, timedelta

import pytest

from app.domain.entities import WebsiteEntity
from app.domain.error.exceptions import ValidationException
from app.domain.website import canonical_hostname

NOW = datetime(2026, 10, 22, 8, tzinfo=UTC)


@pytest.mark.parametrize("source,expected", [
    ("EXAMPLE.COM.", "example.com"), ("www.Example.com", "www.example.com"),
    ("shop.example.com", "shop.example.com"), ("BÜCHER.de", "xn--bcher-kva.de"),
    ("xn--bcher-kva.de", "xn--bcher-kva.de"), ("مثال.ایران", "xn--mgbh0fb.xn--mgba3a4f16a"),
    ("faß.de", "xn--fa-hia.de"), ("fass.de", "fass.de"),
    ("ｅｘａｍｐｌｅ。ＣＯＭ．", "example.com"),
    ("a" * 63 + ".example", "a" * 63 + ".example"),
    (".".join(["a" * 63] * 3 + ["b" * 61]), ".".join(["a" * 63] * 3 + ["b" * 61])),
])
def test_canonical_hostname_preserves_real_hostname_identity(source, expected):
    assert canonical_hostname(source) == expected
    assert canonical_hostname(expected) == expected
    site = WebsiteEntity.create("owner", source, now=NOW)
    assert site.hostname == expected


@pytest.mark.parametrize("value", [
    "", " example.com", "example.com ", "example.com\n", "ex ample.com", "example.com\x00",
    "https://example.com", "user@example.com", "example.com:443", "example.com/",
    "example.com?x", "example.com#x", "example%2ecom", "example\\.com",
    "127.0.0.1", "127.1", "2130706433", "0x7f000001", "[::1]", "::1",
    "localhost", "app.localhost", "app.local", "internal", ".example.com", "example..com",
    "example.com..", "-a.example", "a-.example", "a_b.example", "xn--.example",
    "a" * 64 + ".example", ".".join(["a" * 63] * 4), "a.123", "a.0x7f",
    "\ud800.example", None, 123,
])
def test_unsafe_or_non_hostname_values_are_rejected(value):
    with pytest.raises(ValidationException) as error:
        canonical_hostname(value)
    assert error.value.details == {"field": "hostname"}


def test_new_website_has_only_an_unproved_24_hour_reservation():
    site = WebsiteEntity.create("owner", "example.com", now=NOW)
    assert site.owner_id == "owner" and site.scheme == "https"
    assert site.id != WebsiteEntity.create("owner", "example.com", now=NOW).id
    assert site.created_at == site.updated_at == NOW
    assert site.reservation_expires_at == NOW + timedelta(hours=24)
    assert site.challenge_digest is site.challenge_issued_at is site.challenge_expires_at is None
    assert site.verified_at is site.released_at is None
    assert site.challenge_status(NOW) == "not-issued"
    assert site.challenge_status(site.reservation_expires_at) == "expired"
    with pytest.raises(FrozenInstanceError):
        site.owner_id = "other"


def test_http_is_explicit_and_www_subdomains_and_parent_are_distinct():
    sites = [WebsiteEntity.create("owner", hostname, scheme="http", now=NOW)
             for hostname in ("example.com", "www.example.com", "shop.example.com")]
    assert len({site.hostname for site in sites}) == 3
    assert all(site.scheme == "http" for site in sites)


def challenge():
    site = WebsiteEntity.create("owner", "example.com", now=NOW)
    issued = NOW + timedelta(minutes=1)
    return replace(site, challenge_digest=b"d" * 32, challenge_issued_at=issued,
                   challenge_expires_at=issued + timedelta(hours=24),
                   reservation_expires_at=issued + timedelta(hours=24), updated_at=issued)


def test_persisted_challenge_states_and_exact_expiry_boundary():
    site = challenge()
    assert "challenge_digest" not in repr(site)
    assert site.challenge_status(site.challenge_issued_at) == "pending"
    assert site.challenge_status(site.challenge_expires_at - timedelta(microseconds=1)) == "pending"
    assert site.challenge_status(site.challenge_expires_at) == "expired"
    verified = replace(site, verified_at=site.updated_at)
    assert verified.challenge_status(NOW + timedelta(days=365)) == "verified"
    released = replace(site, released_at=site.updated_at)
    assert released.challenge_status(NOW + timedelta(days=365)) == "released"


@pytest.mark.parametrize("fields", [
    {"owner_id": ""}, {"owner_id": " "}, {"id": ""}, {"id": " "},
    {"hostname": "EXAMPLE.COM"}, {"scheme": "ftp"}, {"scheme": "HTTPS"},
    {"created_at": NOW.replace(tzinfo=None)}, {"updated_at": NOW - timedelta(seconds=1)},
    {"reservation_expires_at": NOW + timedelta(hours=25)},
    {"challenge_issued_at": NOW}, {"challenge_expires_at": NOW}, {"verified_at": NOW},
    {"released_at": NOW - timedelta(seconds=1)}, {"released_at": NOW + timedelta(seconds=1)},
])
def test_invalid_initial_state_cannot_be_constructed(fields):
    with pytest.raises(ValidationException):
        replace(WebsiteEntity.create("owner", "example.com", now=NOW), **fields)


@pytest.mark.parametrize("fields", [
    {"challenge_digest": b"short"}, {"challenge_digest": "d" * 32},
    {"challenge_digest": None}, {"challenge_issued_at": None}, {"challenge_expires_at": None},
    {"challenge_issued_at": NOW - timedelta(seconds=1)},
    {"updated_at": NOW}, {"reservation_expires_at": NOW + timedelta(hours=24)},
    {"challenge_expires_at": NOW + timedelta(hours=24)},
    {"verified_at": NOW}, {"verified_at": NOW + timedelta(minutes=2)},
    {"verified_at": NOW + timedelta(days=2)},
])
def test_inconsistent_challenge_state_is_rejected(fields):
    with pytest.raises(ValidationException):
        replace(challenge(), **fields)


def test_naive_clocks_are_rejected_and_aware_clocks_normalized():
    with pytest.raises(ValidationException):
        WebsiteEntity.create("owner", "example.com", now=NOW.replace(tzinfo=None))
    site = WebsiteEntity.create("owner", "example.com", now=NOW)
    with pytest.raises(ValidationException):
        site.challenge_status(NOW.replace(tzinfo=None))
