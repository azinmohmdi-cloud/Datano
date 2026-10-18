from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field, SecretStr, StrictBool


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
    """Login with password and exactly one email or deprecated legacy username."""

    email: str | None = None
    username: str | None = Field(default=None, json_schema_extra={"deprecated": True})
    password: SecretStr
    remember_me: StrictBool = False

    model_config = {"extra": "forbid"}


class TokenPayload(BaseModel):
    """Token payload model."""

    sub: str
    exp: int
    iat: int
    username: str
