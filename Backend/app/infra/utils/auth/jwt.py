"""
JWT utilities for authentication.
"""

from datetime import UTC, datetime, timedelta
from typing import Optional

from jose import JWTError, jwt

from app.infra.core.config import config
from app.interface.dto import TokenPayload

# Export constants for backward compatibility
ALGORITHM = config.algorithm
SECRET_KEY = config.secret_key
ACCESS_TOKEN_EXPIRE_MINUTES = config.access_token_expire_minutes


def generate_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """
    Create an access token with the provided data.

    Args:
        data: Data to encode in the token
        expires_delta: Optional expiration time delta

    Returns:
        Encoded JWT token string
    """
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.now(UTC) + expires_delta
    else:
        expire = datetime.now(UTC) + timedelta(
            minutes=config.access_token_expire_minutes
        )

    to_encode.update({"exp": expire, "iat": datetime.now(UTC)})

    encoded_jwt = jwt.encode(to_encode, config.secret_key, algorithm=config.algorithm)
    return encoded_jwt


def verify_token(token: str) -> Optional[TokenPayload]:
    """
    Verify and decode a JWT token.

    Args:
        token: JWT token string to verify

    Returns:
        TokenPayload if valid, None if invalid
    """
    try:
        payload = jwt.decode(token, config.secret_key, algorithms=[config.algorithm])

        # Validate that required fields exist
        sub = payload.get("sub")
        username = payload.get("username")

        if sub is None or username is None:
            return None

        token_data = TokenPayload(
            sub=sub,
            username=username,
            exp=payload.get("exp", 0),
            iat=payload.get("iat", 0),
        )

        return token_data
    except JWTError:
        return None
