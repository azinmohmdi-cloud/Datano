from fastapi import APIRouter

from app.interface.dto.responses import StandardResponse, success

# Create router with prefix and tags
default_router = APIRouter(tags=["default"])


@default_router.get("/ping", response_model=StandardResponse[str])
async def ping():
    """
    Root endpoint to provide basic information about the API.
    """

    return success(
        "pong",
    )
