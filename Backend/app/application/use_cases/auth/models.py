"""
Data models for Auth use cases.
"""

from dataclasses import dataclass, field
from datetime import datetime
from app.application.use_cases.auth.current_identity_use_case import CurrentIdentity
from app.application.use_cases.auth.session_models import IssuedSession


@dataclass(frozen=True)
class LoginRequest:
    """Input port for user login."""
    password: str = field(repr=False)
    username: str | None = None
    email: str | None = None
    remember_me: bool = False
    previous_session_token: str | None = field(default=None, repr=False)


@dataclass(frozen=True)
class TokenResponse:
    """Output port for token information."""
    title: str
    token: str
    type: str
    expires_at: datetime


@dataclass(frozen=True)
class LoginResponse:
    """Output port for login."""
    identity: CurrentIdentity
    session: IssuedSession


@dataclass(frozen=True)
class RefreshTokenRequest:
    """Input port for refreshing access token."""
    refresh_token: str


@dataclass(frozen=True)
class RefreshTokenResponse:
    """Output port for refreshed access token."""
    access_token: TokenResponse


@dataclass(frozen=True)
class LogoutRequest:
    """Input port for logout."""
    session_token: str | None = field(default=None, repr=False)


@dataclass(frozen=True)
class LogoutResponse:
    """Output port for logout."""
    success: bool
