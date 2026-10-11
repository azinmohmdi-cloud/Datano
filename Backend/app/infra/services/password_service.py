"""
Password service implementation - Infrastructure layer.
Implements IPasswordService from the application layer.
"""

from app.application.use_cases.auth.interfaces import IPasswordService
from app.infra.utils.password import hash_password, verify_password


class BcryptPasswordService(IPasswordService):
    """Bcrypt implementation of password service."""

    def verify(self, plain_password: str, hashed_password: str) -> bool:
        """Verify a password against its hash."""
        return verify_password(plain_password, hashed_password)

    def hash(self, password: str) -> str:
        """Hash a plain text password."""
        return hash_password(password)
