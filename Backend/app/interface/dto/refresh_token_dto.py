from datetime import datetime

from pydantic import BaseModel


class RefreshTokenCreate(BaseModel):
    """Request model for creating a refresh token."""

    user_id: str
    expires_at: datetime


class RefreshToken(BaseModel):
    """Response model for a refresh token."""

    id: str
    token: str
    user_id: str
    expires_at: datetime
    created_at: datetime
    revoked: bool
    blacklisted: bool
