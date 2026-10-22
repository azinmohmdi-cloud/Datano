from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class WebsiteCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)
    url: str = Field(description="HTTP(S) homepage URL; no credentials, custom port, path, query or fragment")


class Website(BaseModel):
    """Explicit owner-facing output; no owner identity or proof digest."""
    id: str
    hostname: str
    scheme: Literal["http", "https"]
    url: str
    is_verified: bool
    challenge_status: Literal["not-issued", "pending", "expired", "verified"]
    reservation_expires_at: datetime
    challenge_expires_at: datetime | None
    verified_at: datetime | None
    created_at: datetime
    updated_at: datetime
