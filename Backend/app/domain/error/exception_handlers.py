"""
Exception handlers for the application.
This module provides handlers for both domain-specific and generic exceptions.
"""

import logging

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse

from app.interface.dto.responses import failure

from .exceptions import DomainException


def register_domain_exception_handlers(app):
    """
    Register domain exception handlers with the FastAPI application.
    This function should be called after registering other exception handlers.
    """

    @app.exception_handler(DomainException)
    async def handle_domain_exception(request: Request, exc: DomainException):
        """
        Generic handler for domain exceptions.
        Converts domain exceptions into standardized API responses.
        """
        # Log the exception details for debugging
        logging.error(
            f"Domain exception occurred: {type(exc).__name__}: {exc.message}",
            extra={
                "error_code": exc.error_code,
                "details": exc.details,
                "path": request.url.path,
                "method": request.method,
            },
        )

        # Create a standardized response using the StandardResponse format
        response_data = failure(
            exc.message,
            payload={
                "error_code": exc.error_code,
                "details": exc.details,
                "status_code": exc.status_code,
            },
        )

        # Return as JSONResponse with the appropriate status code
        return JSONResponse(
            status_code=exc.status_code, content=response_data.model_dump()
        )


def register_exception_handler(app: FastAPI):
    """
    Register the global exception handler for unhandled exceptions.
    """

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        """
        Global exception handler to catch all unhandled exceptions
        and return them in a standardized format.

        Note: Domain exceptions should be handled by their specific handlers.
        This handler is for truly unhandled exceptions.
        """
        # Only log non-domain exceptions to avoid duplicate logging
        if not hasattr(exc, "status_code"):
            logging.error(
                f"Unhandled exception occurred: {type(exc).__name__}: {str(exc)}"
            )
        else:
            # This is likely a domain exception that should have been caught by its handler
            logging.warning(
                f"Domain exception reached global handler: {type(exc).__name__}: {str(exc)}"
            )

        # Prevent exposing sensitive internal error details to the user
        error_message = "An internal server error occurred"

        # Create a standardized response using the StandardResponse format
        response_data = failure(
            error_message,
            payload={
                "code": status.HTTP_500_INTERNAL_SERVER_ERROR,
            },
        )

        # Return as JSONResponse to ensure proper formatting
        return JSONResponse(status_code=500, content=response_data.model_dump())


def register_all_exception_handlers(app):
    """
    Register all exception handlers (both domain and generic).
    This is a convenience function to register all handlers at once.
    """
    # Register the global exception handler first
    register_exception_handler(app)
    # Then register domain exception handlers
    register_domain_exception_handlers(app)
