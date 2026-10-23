from dataclasses import dataclass, field
from abc import ABC, abstractmethod

from app.domain.error.exceptions import ValidationException

MAX_REFRESH_TOKEN_BYTES = 16384


@dataclass(frozen=True)
class OAuthCredential:
    """Only the durable refresh token is persisted; access tokens stay transient."""
    refresh_token: str = field(repr=False)

    def __post_init__(self) -> None:
        try:
            valid = (isinstance(self.refresh_token, str) and bool(self.refresh_token.strip())
                     and len(self.refresh_token.encode("utf-8")) <= MAX_REFRESH_TOKEN_BYTES)
        except UnicodeEncodeError:
            valid = False
        if not valid:
            raise ValidationException("Invalid integration credential")


class ICredentialCipher(ABC):
    @abstractmethod
    def encrypt(self, credential: OAuthCredential, context: bytes) -> bytes:
        """Authenticate immutable integration identity and credential revision."""

    @abstractmethod
    def decrypt(self, ciphertext: bytes, context: bytes) -> OAuthCredential:
        """Fail closed without disclosing ciphertext, key or provider values."""
