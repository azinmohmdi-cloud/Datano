"""Argon2id for new hashes; exact bcrypt verification only for migration."""
import re

import bcrypt
from argon2 import PasswordHasher, Type, extract_parameters
from argon2.exceptions import InvalidHashError, VerificationError

from app.application.use_cases.auth.interfaces import IPasswordService, PasswordVerification
from app.domain.entities import UserEntity
from app.domain.error.exceptions import PasswordResetRequiredException

_BCRYPT_HASH = re.compile(r"^\$2[aby]\$(0[4-9]|[12][0-9]|3[01])\$[./A-Za-z0-9]{53}$")
_DEFAULT_HASHER = PasswordHasher(
    type=Type.ID, memory_cost=19456, time_cost=2, parallelism=1,
    salt_len=16, hash_len=32,
)


class Argon2PasswordService(IPasswordService):
    def __init__(self, hasher: PasswordHasher | None = None) -> None:
        self._hasher = hasher if hasher is not None else _DEFAULT_HASHER
        if (self._hasher.type != Type.ID or self._hasher.memory_cost < 19456
                or self._hasher.time_cost < 2 or self._hasher.parallelism < 1
                or self._hasher.salt_len < 16 or self._hasher.hash_len < 32):
            raise ValueError("New password hashes must meet the Argon2id security floor")

    def hash(self, password: str) -> str:
        UserEntity._validate_password(password)
        return self._hasher.hash(password)

    def verify(self, plain_password: str, hashed_password: str) -> bool:
        if not isinstance(plain_password, str) or not isinstance(hashed_password, str):
            return False
        try:
            encoded = plain_password.encode("utf-8")
        except UnicodeEncodeError:
            return False
        if hashed_password.startswith("$argon2id$"):
            try:
                return self._hasher.verify(hashed_password, plain_password)
            except (InvalidHashError, VerificationError):
                return False
        if _BCRYPT_HASH.fullmatch(hashed_password):
            # Never slice, decode-ignore, normalize or prehash legacy input.
            if len(encoded) > 72:
                raise PasswordResetRequiredException()
            try:
                return bcrypt.checkpw(encoded, hashed_password.encode("ascii"))
            except ValueError:
                return False
        return False

    def verify_and_rehash(self, plain_password: str, hashed_password: str) -> PasswordVerification:
        if not self.verify(plain_password, hashed_password):
            return PasswordVerification(False)
        if _BCRYPT_HASH.fullmatch(hashed_password):
            # A verified existing secret is not subject to new-password length rules.
            return PasswordVerification(True, self._hasher.hash(plain_password))
        params = extract_parameters(hashed_password)
        target = self._hasher
        needs_upgrade = (
            params.version != 19 or params.memory_cost < target.memory_cost
            or params.time_cost < target.time_cost or params.parallelism < target.parallelism
            or params.salt_len < target.salt_len or params.hash_len < target.hash_len
        )
        if not needs_upgrade:
            return PasswordVerification(True)
        upgraded = PasswordHasher(
            type=Type.ID,
            memory_cost=max(params.memory_cost, target.memory_cost),
            time_cost=max(params.time_cost, target.time_cost),
            parallelism=max(params.parallelism, target.parallelism),
            salt_len=max(params.salt_len, target.salt_len),
            hash_len=max(params.hash_len, target.hash_len),
        )
        return PasswordVerification(True, upgraded.hash(plain_password))


class BcryptPasswordService(Argon2PasswordService):
    """Deprecated import compatibility; hashing always produces Argon2id."""
