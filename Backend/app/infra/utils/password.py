"""Compatibility helpers using the central Argon2id/migration password service."""


def hash_password(password: str) -> str:
    from app.infra.services.password_service import Argon2PasswordService
    return Argon2PasswordService().hash(password)


def verify_password(plain_password: str, hashed_password: str) -> bool:
    from app.infra.services.password_service import Argon2PasswordService
    return Argon2PasswordService().verify(plain_password, hashed_password)
