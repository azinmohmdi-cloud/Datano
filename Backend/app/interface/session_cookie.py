from dataclasses import dataclass, field

from fastapi import Depends, Request, Response
from fastapi.security import APIKeyCookie

from app.application.use_cases.auth.session_models import IssuedSession

SECURE_SESSION_COOKIE = "__Host-datano_session"
LOCAL_SESSION_COOKIE = "datano_session_dev"
cookie_security = APIKeyCookie(name=SECURE_SESSION_COOKIE, scheme_name="OpaqueSession", auto_error=False)


@dataclass(frozen=True)
class SessionCookiePolicy:
    name: str
    secure: bool


@dataclass(frozen=True)
class SessionCredential:
    present: bool
    token: str | None = field(repr=False)


def session_cookie_policy(request: Request) -> SessionCookiePolicy:
    local_http = (request.app.state.settings.session_allow_insecure_local_http
        and request.url.scheme == "http" and request.url.hostname in {"localhost", "127.0.0.1", "::1"})
    return SessionCookiePolicy(LOCAL_SESSION_COOKIE, False) if local_http else SessionCookiePolicy(SECURE_SESSION_COOKIE, True)


def read_session_cookie(request: Request, secure_value: str | None = Depends(cookie_security)) -> SessionCredential:
    policy = session_cookie_policy(request)
    value = secure_value if policy.secure else request.cookies.get(policy.name)
    return SessionCredential(policy.name in request.cookies, value)


def write_session_cookie(request: Request, response: Response, issued: IssuedSession) -> None:
    policy = session_cookie_policy(request)
    maximum = int((issued.record.absolute_expires_at - issued.record.created_at).total_seconds()) if issued.record.remember_me else None
    response.set_cookie(key=policy.name, value=issued.token, secure=policy.secure,
        httponly=True, samesite="lax", path="/", max_age=maximum)
