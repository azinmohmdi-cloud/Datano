import hashlib
import re
import secrets

from app.application.use_cases.auth.interfaces import ISessionTokens


class OpaqueSessionTokens(ISessionTokens):
    """Generate 256-bit identifiers and derive a digest without logging secrets."""

    def generate(self) -> str:
        return secrets.token_urlsafe(32)

    def digest(self, token: str) -> bytes | None:
        if not isinstance(token, str) or len(token) != 43 or re.fullmatch(r"[A-Za-z0-9_-]{43}", token) is None:
            return None
        return hashlib.sha256(token.encode("ascii")).digest()
