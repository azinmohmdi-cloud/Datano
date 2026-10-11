from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class Token(BaseModel):
    """Token response model."""

    title: str
    token: str
    type: str
    expires_at: datetime


class TokenData(BaseModel):
    """Token data model."""

    sub: Optional[str] = None
    username: Optional[str] = None


class UserLogin(BaseModel):
    """User login request model."""

    username: str
    password: str


class TokenPayload(BaseModel):
    """Token payload model."""

    sub: str
    exp: int
    iat: int
    username: str
