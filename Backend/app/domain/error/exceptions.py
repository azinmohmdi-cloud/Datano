"""
Domain exception definitions and handling framework.
This module provides a standardized way to define and handle domain-specific exceptions.
"""

from typing import Any, Dict, Optional, Union

from fastapi import status


class DomainException(Exception):
    """
    Base class for all domain-specific exceptions in the application.
    All domain exceptions should inherit from this class.
    """

    def __init__(
        self,
        message: str,
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        status_code: int = status.HTTP_400_BAD_REQUEST,
    ):
        """
        Initialize a domain exception.

        Args:
            message: Human-readable description of the error
            error_code: Optional machine-readable error code
            details: Optional additional details about the error
            status_code: HTTP status code to return
        """
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.details = details or {}
        self.status_code = status_code


class ValidationException(DomainException):
    """
    Exception raised when validation fails.
    """

    def __init__(self, message: str, field: Optional[str] = None, **kwargs):
        details = kwargs.get("details", {})
        if field:
            details["field"] = field
        # Add any additional keyword arguments to details
        for key, value in kwargs.items():
            if key != "details":  # Prevent overriding the details parameter
                details[key] = value
        super().__init__(
            message=message,
            error_code="VALIDATION_ERROR",
            details=details,
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        )


class ResourceNotFoundException(DomainException):
    """
    Exception raised when a requested resource is not found.
    """

    def __init__(self, resource_type: str, identifier: Union[str, int], **kwargs):
        message = f"{resource_type} with identifier '{identifier}' was not found"
        super().__init__(
            message=message,
            error_code="RESOURCE_NOT_FOUND",
            details={
                "resource_type": resource_type,
                "identifier": identifier,
                **kwargs,
            },
            status_code=status.HTTP_404_NOT_FOUND,
        )


class UnauthorizedException(DomainException):
    """
    Exception raised when a user is not authenticated.
    """

    def __init__(self, message: str = "Not authenticated", **kwargs):
        super().__init__(
            message=message,
            error_code="UNAUTHORIZED",
            details=kwargs,
            status_code=status.HTTP_401_UNAUTHORIZED,
        )


class ForbiddenException(DomainException):
    """
    Exception raised when a user is authenticated but lacks permission.
    """

    def __init__(self, message: str = "Access forbidden", **kwargs):
        super().__init__(
            message=message,
            error_code="FORBIDDEN",
            details=kwargs,
            status_code=status.HTTP_403_FORBIDDEN,
        )


class ConflictException(DomainException):
    """
    Exception raised when there's a conflict in the domain.
    """

    def __init__(self, message: str, **kwargs):
        super().__init__(
            message=message,
            error_code="CONFLICT",
            details=kwargs,
            status_code=status.HTTP_409_CONFLICT,
        )


class BusinessException(DomainException):
    """
    Exception raised for business logic violations.
    """

    def __init__(self, message: str, **kwargs):
        super().__init__(
            message=message,
            error_code="BUSINESS_ERROR",
            details=kwargs,
            status_code=status.HTTP_400_BAD_REQUEST,
        )


class CredentialsValidationException(DomainException):
    """
    Exception raised when credentials cannot be validated.
    """

    def __init__(self, message: str = "Could not validate credentials", **kwargs):
        super().__init__(
            message=message,
            error_code="CREDENTIALS_VALIDATION_ERROR",
            details=kwargs,
            status_code=status.HTTP_401_UNAUTHORIZED,
        )


class InactiveUserException(DomainException):
    """
    Exception raised when an inactive user tries to access protected resources.
    """

    def __init__(self, message: str = "Inactive user", **kwargs):
        super().__init__(
            message=message,
            error_code="INACTIVE_USER",
            details=kwargs,
            status_code=status.HTTP_401_UNAUTHORIZED,
        )
