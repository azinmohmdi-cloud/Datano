from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.interface.csrf import CsrfMiddleware
from app.infra.services.csrf_service import canonical_origin


def add_middlewares(app: FastAPI):
    settings = app.state.settings
    origins = ([canonical_origin(settings.public_origin, allow_local_http=settings.session_allow_insecure_local_http)]
        if settings.public_origin is not None else [])
    app.add_middleware(CsrfMiddleware)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_credentials=True,
        allow_methods=["GET", "HEAD", "OPTIONS", "POST", "PUT", "PATCH", "DELETE"],
        allow_headers=["Content-Type", "X-CSRF-Token"],
        expose_headers=["Retry-After"],
        max_age=600,
    )
