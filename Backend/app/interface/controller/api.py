from fastapi import APIRouter

from .auth_controller import auth_router
from .admin_email_controller import admin_email_router
from .email_change_controller import email_change_router
from .registration_controller import registration_router
from .recovery_controller import recovery_router
from .default_controller import default_router
from .role_controller import role_router
from .user_controller import user_router
from .website_controller import website_router
from .website_proof_controller import website_proof_router

api_router = APIRouter(prefix="/api")

api_router.include_router(default_router)
api_router.include_router(auth_router)
api_router.include_router(admin_email_router)
api_router.include_router(email_change_router)
api_router.include_router(registration_router)
api_router.include_router(recovery_router)
api_router.include_router(user_router)
api_router.include_router(role_router)
api_router.include_router(website_router)
api_router.include_router(website_proof_router)
