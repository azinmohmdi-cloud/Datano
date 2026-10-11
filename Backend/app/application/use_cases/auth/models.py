"""
Data models for Auth use cases.
"""

from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class LoginRequest:
    """Input port for user login."""
    username: str
    password: str


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
    access_token: TokenResponse
    refresh_token: TokenResponse


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
    refresh_token: str


@dataclass(frozen=True)
class LogoutResponse:
    """Output port for logout."""
    success: bool
