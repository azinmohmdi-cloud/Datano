import hashlib
import json
import re
import secrets

from app.application.use_cases.website.proof import IWebsiteChallengeTokens
from app.domain.entities import WebsiteEntity


class WebsiteChallengeTokens(IWebsiteChallengeTokens):
    def generate(self) -> str:
        return secrets.token_urlsafe(32)

    def digest(self, website: WebsiteEntity, token: str) -> bytes | None:
        if not isinstance(token, str) or re.fullmatch(r"[A-Za-z0-9_-]{43}", token) is None:
            return None
        # A random 256-bit token needs no password KDF or new server secret.
        # Framing and domain separation prevent cross-account/site/workflow replay.
        framed = json.dumps(["datano-website-proof-v1", website.owner_id, website.id,
            website.hostname, website.scheme, token], separators=(",", ":")).encode("ascii")
        return hashlib.sha256(framed).digest()
