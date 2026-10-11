from typing import Generic, Optional, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class StandardResponse(BaseModel, Generic[T]):
    """
    Standard response model for the API.
    All responses should follow this structure.
    Generic on payload type T.
    """

    success: bool
    message: str
    payload: Optional[T] = None


def success(message: str, payload: Optional[T] = None) -> StandardResponse[T]:
    """
    Helper function to create a successful response.

    Args:
        message: The success message to include in the response
        payload: Optional data to include in the response payload

    Returns:
        StandardResponse with success=True
    """
    return StandardResponse(success=True, message=message, payload=payload)


def failure(message: str, payload: Optional[T] = None) -> StandardResponse[T]:
    """
    Helper function to create a failure response.

    Args:
        message: The error message to include in the response
        payload: Optional data to include in the response payload

    Returns:
        StandardResponse with success=False
    """
    return StandardResponse(success=False, message=message, payload=payload)
