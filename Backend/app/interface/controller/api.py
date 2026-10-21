from fastapi import APIRouter

from .auth_controller import auth_router
from .registration_controller import registration_router
from .recovery_controller import recovery_router
from .default_controller import default_router
from .role_controller import role_router
from .user_controller import user_router

api_router = APIRouter(prefix="/api")

api_router.include_router(default_router)
api_router.include_router(auth_router)
api_router.include_router(registration_router)
api_router.include_router(recovery_router)
api_router.include_router(user_router)
api_router.include_router(role_router)
