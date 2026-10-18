from fastapi import APIRouter, Depends

from app.application.use_cases.auth.register_use_case import RegisterUserRequest, RegisterUserUseCase
from app.interface.dependencies.registration_dependencies import get_register_user_usecase
from app.interface.dto import User
from app.interface.dto.registration_dto import UserRegistration
from app.interface.dto.responses import StandardResponse, success
from app.interface.mappers import UserMapper
from app.interface.registration_route import RegistrationRoute

registration_router = APIRouter(prefix="/auth", tags=["auth"], route_class=RegistrationRoute)


@registration_router.post(
    "/register", status_code=201, response_model=StandardResponse[User],
    responses={
        409: {"description": "Canonical email already registered"},
        413: {"description": "Registration body exceeds the configured byte limit"},
        429: {
            "description": "Registration attempt limit exceeded",
            "headers": {"Retry-After": {
                "schema": {"type": "integer"},
                "description": "Seconds until this peer's registration window resets",
            }},
        },
        503: {"description": "Registration infrastructure or default role unavailable"},
    },
)
async def register_user(
    registration: UserRegistration,
    usecase: RegisterUserUseCase = Depends(get_register_user_usecase),
) -> StandardResponse[User]:
    """Create an active ordinary User; no token or session is issued."""
    result = await usecase.execute(
        RegisterUserRequest(
            first_name=registration.first_name, last_name=registration.last_name,
            email=registration.email, password=registration.password.get_secret_value(),
        )
    )
    return success("Registration successful", payload=UserMapper.to_dto(result.user))
