from fastapi import FastAPI, Request, Response
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Receive, Scope, Send

from app.infra.services.csrf_service import CsrfService
from app.interface.dto.responses import failure
from app.interface.session_cookie import session_cookie_policy

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


def csrf_cookie_name(request: Request) -> str:
    return "__Host-datano_csrf" if session_cookie_policy(request).secure else "datano_csrf_dev"


def issue_csrf(request: Request, response: Response, *, session_token: str | None = None, rotate: bool = False) -> str:
    service = CsrfService.from_config(request.app.state.settings)
    name = csrf_cookie_name(request)
    nonce = request.cookies.get(name)
    if rotate or not service.valid_nonce(nonce):
        nonce = service.nonce()
        response.set_cookie(name, nonce, httponly=True, secure=session_cookie_policy(request).secure,
            samesite="lax", path="/")
    binding = request.cookies.get(session_cookie_policy(request).name) if session_token is None else session_token
    response.headers["Cache-Control"] = "no-store"
    response.headers["Vary"] = "Cookie, Origin"
    return service.token(nonce, binding)


class CsrfMiddleware:
    """Reject unsafe API calls before routing, quota consumption or body parsing."""
    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] == "http":
            path = scope["path"]
            root = scope.get("root_path", "")
            if root and (path == root or path.startswith(root + "/")):
                path = path[len(root):]
            if (path == "/api" or path.startswith("/api/")) and scope["method"] not in SAFE_METHODS:
                request = Request(scope)
                try:
                    service = CsrfService.from_config(request.app.state.settings)
                except ValueError:
                    response = JSONResponse(failure("Browser security configuration unavailable").model_dump(), status_code=503)
                else:
                    valid = service.valid_origin(request.headers.getlist("origin")) and service.valid_token(
                        request.cookies.get(csrf_cookie_name(request)), request.headers.getlist("x-csrf-token"),
                        request.cookies.get(session_cookie_policy(request).name))
                    response = None if valid else JSONResponse(failure("CSRF validation failed", payload={
                        "error_code":"CSRF_FAILED", "details":{}, "status_code":403}).model_dump(), status_code=403)
                if response is not None:
                    response.headers["Cache-Control"] = "no-store"
                    await response(scope, receive, send)
                    return
        await self.app(scope, receive, send)


def document_csrf(app: FastAPI) -> None:
    original = app.openapi
    def schema():
        result = original()
        for path, operations in result["paths"].items():
            if path.startswith("/api/"):
                for method, operation in operations.items():
                    if method.upper() in {"POST", "PUT", "PATCH", "DELETE"}:
                        parameters = operation.setdefault("parameters", [])
                        for name in ("Origin", "X-CSRF-Token"):
                            if not any(parameter.get("name") == name for parameter in parameters):
                                parameters.append({"name":name,"in":"header","required":True,"schema":{"type":"string"}})
                        operation["responses"]["403"] = {"description":"Origin or session-bound CSRF token rejected"}
        return result
    app.openapi = schema
