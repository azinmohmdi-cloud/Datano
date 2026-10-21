import hmac
import json
import re
import secrets

from app.application.use_cases.auth.email_codes import EmailCodeContext, IEmailCodeCrypto


class EmailCodeCrypto(IEmailCodeCrypto):
    def __init__(self, key: bytes) -> None:
        if not isinstance(key, bytes) or len(key) < 32:
            raise ValueError("Email code HMAC key requires at least 32 private bytes")
        self._key = key

    def generate(self) -> str:
        return f"{secrets.randbelow(100_000_000):08d}"

    def scope(self, context: EmailCodeContext) -> bytes:
        # JSON framing prevents concatenation ambiguity. Purpose and canonical
        # recipient/subject prevent cross-account and cross-workflow replay.
        message = json.dumps(["datano-email-code-scope-v1", context.purpose.value,
            context.subject, context.recipient], ensure_ascii=False, separators=(",", ":")).encode()
        return hmac.digest(self._key, message, "sha256")

    def digest(self, context: EmailCodeContext, code: str) -> bytes:
        # Malformed attempts still reach the durable attempt counter. An invalid
        # format cannot be equivalent to any valid eight ASCII digit digest.
        valid = isinstance(code, str) and re.fullmatch(r"[0-9]{8}", code) is not None
        value = b"code:" + code.encode("ascii") if valid else b"invalid-format"
        return hmac.digest(self._key, b"datano-email-code-v1:" + self.scope(context) + value, "sha256")
