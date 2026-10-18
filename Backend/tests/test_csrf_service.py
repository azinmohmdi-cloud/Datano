import pytest

from app.infra.core.config import Config
from app.infra.services.csrf_service import CsrfService, canonical_origin


@pytest.mark.parametrize("value", ["https://datano.test?", "https://datano.test#", "https://datano.test:"])
def test_origin_rejects_non_origin_url_syntax(value):
    with pytest.raises(ValueError, match="PUBLIC_ORIGIN"):
        canonical_origin(value)


@pytest.mark.parametrize("value", [None, "", "short"])
def test_csrf_key_has_no_implicit_fallback(value):
    with pytest.raises(ValueError, match="CSRF_SECRET_KEY"):
        CsrfService.from_config(Config(_env_file=None, PUBLIC_ORIGIN="https://datano.test", CSRF_SECRET_KEY=value))


def test_csrf_requires_origin_and_does_not_reveal_key():
    with pytest.raises(ValueError, match="PUBLIC_ORIGIN is required"):
        CsrfService.from_config(Config(_env_file=None, PUBLIC_ORIGIN=None))
    service = CsrfService("https://datano.test", b"private-key-material-never-log-0001")
    assert "private-key-material" not in repr(service)
    nonce = service.nonce()
    token = service.token(nonce, "session-one")
    assert service.valid_token(nonce, [token], "session-one")
    assert not service.valid_token(nonce, [token], "session-two")
    assert not service.valid_token(nonce, [token, token], "session-one")
    assert not service.valid_token("malformed", [token], "session-one")
    assert not CsrfService(service.origin, b"rotated-key-material-never-log-001").valid_token(nonce, [token], "session-one")


@pytest.mark.parametrize("value,expected", [
    ("https://DATANO.test:443", "https://datano.test"),
    ("https://datano.test:8443", "https://datano.test:8443"),
    ("http://localhost:3000", "http://localhost:3000"),
    ("http://127.0.0.1:8000", "http://127.0.0.1:8000"),
    ("http://[::1]:8000", "http://[::1]:8000"),
])
def test_origin_normalization_and_explicit_local_http(value, expected):
    assert canonical_origin(value, allow_local_http=True) == expected


@pytest.mark.parametrize("value", [
    "null", "https://user@datano.test", "https://datano.test/", "https://datano.test/path",
    "https://datano.test?query", "https://datano.test#fragment", " https://datano.test",
    "https://datano.test:0", "https://datano.test:invalid", "https://bad_host", "http://evil.test",
])
def test_invalid_origins_fail_closed(value):
    with pytest.raises(ValueError):
        canonical_origin(value, allow_local_http=True)


def test_http_requires_explicit_opt_in():
    with pytest.raises(ValueError):
        canonical_origin("http://localhost:3000")
