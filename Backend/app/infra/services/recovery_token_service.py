import hashlib
import re
import secrets

from app.application.use_cases.auth.password_recovery import IRecoveryTokens


class RecoveryTokens(IRecoveryTokens):
    def generate(self) -> str:
        return "recovery." + secrets.token_urlsafe(32)

    def digest(self, token: str | None) -> bytes | None:
        if not isinstance(token, str) or re.fullmatch(r"recovery\.[A-Za-z0-9_-]{43}", token) is None:
            return None
        return hashlib.sha256(b"datano-password-recovery-v1\0" + token.encode("ascii")).digest()
