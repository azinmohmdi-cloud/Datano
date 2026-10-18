"""Signed double-submit CSRF tokens, bound to the browser's opaque session."""
from __future__ import annotations

import base64
import hashlib
import hmac
import re
import secrets
from dataclasses import dataclass, field
from ipaddress import ip_address
from urllib.parse import urlsplit
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from app.infra.core.config import Config

TOKEN = re.compile(r"[A-Za-z0-9_-]{43}")


def canonical_origin(value: str, *, allow_local_http: bool = False) -> str:
    try:
        if not value or any(character.isspace() for character in value) or "?" in value or "#" in value:
            raise ValueError
        parsed = urlsplit(value)
        host = parsed.hostname
        if (parsed.scheme not in {"https", "http"} or not host or parsed.username is not None
                or parsed.password is not None or parsed.path or parsed.netloc.endswith(":")):
            raise ValueError
        try:
            address = ip_address(host)
            host = f"[{address.compressed}]" if address.version == 6 else address.compressed
        except ValueError:
            if re.fullmatch(r"[a-z0-9]+(?:[a-z0-9.-]*[a-z0-9])?", host) is None:
                raise ValueError
        if parsed.scheme == "http" and not (allow_local_http and parsed.hostname in {"localhost", "127.0.0.1", "::1"}):
            raise ValueError
        port = parsed.port
        if port == 0:
            raise ValueError
        suffix = f":{port}" if port is not None and port != (443 if parsed.scheme == "https" else 80) else ""
        return f"{parsed.scheme}://{host}{suffix}"
    except (ValueError, TypeError):
        raise ValueError("PUBLIC_ORIGIN must be an explicit HTTPS origin or opted-in local HTTP origin") from None


@dataclass(frozen=True)
class CsrfService:
    origin: str
    key: bytes = field(repr=False)

    @classmethod
    def from_config(cls, settings: Config) -> CsrfService:
        if settings.public_origin is None:
            raise ValueError("PUBLIC_ORIGIN is required")
        origin = canonical_origin(settings.public_origin, allow_local_http=settings.session_allow_insecure_local_http)
        key = settings.csrf_secret_key.get_secret_value().encode("utf-8") if settings.csrf_secret_key is not None else b""
        if len(key) < 32:
            raise ValueError("CSRF_SECRET_KEY must contain at least 32 bytes")
        return cls(origin, key)

    @staticmethod
    def valid_nonce(value: str | None) -> bool:
        return isinstance(value, str) and len(value) == 43 and TOKEN.fullmatch(value) is not None

    @staticmethod
    def nonce() -> str:
        return secrets.token_urlsafe(32)

    def token(self, nonce: str, session_token: str | None) -> str:
        # Fixed-size session binding avoids ambiguous concatenation. The nonce
        # is fixed length; no raw session identifier is exposed in this token.
        binding = hashlib.sha256(session_token.encode("utf-8")).digest() if session_token else bytes(32)
        message = b"datano-csrf-v1\0" + binding + nonce.encode("ascii")
        return base64.urlsafe_b64encode(hmac.digest(self.key, message, "sha256")).rstrip(b"=").decode("ascii")

    def valid_origin(self, values: list[str]) -> bool:
        if len(values) != 1:
            return False
        try:
            return canonical_origin(values[0], allow_local_http=self.origin.startswith("http://")) == self.origin
        except ValueError:
            return False

    def valid_token(self, nonce: str | None, values: list[str], session_token: str | None) -> bool:
        return (self.valid_nonce(nonce) and len(values) == 1 and self.valid_nonce(values[0])
            and hmac.compare_digest(values[0], self.token(nonce, session_token)))
