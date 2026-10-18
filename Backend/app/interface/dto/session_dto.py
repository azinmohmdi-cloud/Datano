from app.application.use_cases.auth.current_identity_use_case import EffectiveRole
# Role resolves the inherited forward annotation in User.roles.
from app.interface.dto import Role, User
from pydantic import BaseModel, Field


class CurrentUser(User):
    effective_role: EffectiveRole | None


class SessionLogin(BaseModel):
    """Opaque authentication; no access or refresh token in the response."""
    user: User
    effective_role: EffectiveRole | None
    csrf_token: str = Field(repr=False)


class CsrfToken(BaseModel):
    csrf_token: str = Field(repr=False)
