"""Versioned AES-256-GCM envelope; no key is stored in the database."""
import base64
import binascii
import os
import re
from typing import TYPE_CHECKING

from cryptography.exceptions import InvalidTag
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.application.use_cases.integration.credentials import ICredentialCipher, MAX_REFRESH_TOKEN_BYTES, OAuthCredential
from app.domain.error.exceptions import ServiceUnavailableException, ValidationException

if TYPE_CHECKING:
    from app.infra.core.config import Config

KEY_ERROR = "INTEGRATION_CREDENTIAL_KEY must be a canonical base64url-encoded 32-byte private key"


class AESCredentialCipher(ICredentialCipher):
    def __init__(self, key: bytes) -> None:
        if not isinstance(key, bytes) or len(key) != 32:
            raise ValueError(KEY_ERROR)
        self._aes = AESGCM(key)

    @classmethod
    def from_config(cls, settings: "Config") -> "AESCredentialCipher":
        secret = settings.integration_credential_key
        if secret is None:
            raise ValueError(KEY_ERROR)
        value = secret.get_secret_value()
        key = None
        try:
            if re.fullmatch(r"[A-Za-z0-9_-]{43}=", value):
                decoded = base64.b64decode(value, altchars=b"-_", validate=True)
                if len(decoded) == 32 and base64.urlsafe_b64encode(decoded).decode("ascii") == value:
                    key = decoded
        except (ValueError, binascii.Error):
            pass
        if key is None:
            raise ValueError(KEY_ERROR)
        return cls(key)

    @staticmethod
    def _context(context: bytes) -> None:
        if not isinstance(context, bytes) or not 0 < len(context) <= 8192:
            raise ValidationException("Invalid integration credential context")

    def encrypt(self, credential: OAuthCredential, context: bytes) -> bytes:
        self._context(context)
        nonce = os.urandom(12)
        return b"\x01" + nonce + self._aes.encrypt(nonce, credential.refresh_token.encode("utf-8"), context)

    def decrypt(self, ciphertext: bytes, context: bytes) -> OAuthCredential:
        self._context(context)
        try:
            if (not isinstance(ciphertext, bytes) or not 30 <= len(ciphertext) <= MAX_REFRESH_TOKEN_BYTES + 29
                    or ciphertext[0] != 1):
                raise ValueError()
            raw = self._aes.decrypt(ciphertext[1:13], ciphertext[13:], context)
            return OAuthCredential(raw.decode("utf-8"))
        except (InvalidTag, ValueError, UnicodeDecodeError, ValidationException):
            pass
        raise ServiceUnavailableException("Integration credential is unavailable") from None
