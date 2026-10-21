from fastapi import Request, Response

from app.interface.session_cookie import session_cookie_policy


def recovery_cookie_name(request: Request) -> str:
    return "__Host-datano_recovery" if session_cookie_policy(request).secure else "datano_recovery_dev"


def write_recovery_cookie(request: Request, response: Response, token: str, seconds: int) -> None:
    response.set_cookie(recovery_cookie_name(request), token, httponly=True,
        secure=session_cookie_policy(request).secure, samesite="lax", path="/", max_age=seconds)


def clear_recovery_cookie(request: Request, response: Response) -> None:
    response.delete_cookie(recovery_cookie_name(request), httponly=True,
        secure=session_cookie_policy(request).secure, samesite="lax", path="/")
