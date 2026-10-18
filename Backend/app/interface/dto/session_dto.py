from app.application.use_cases.auth.current_identity_use_case import EffectiveRole
# Role resolves the inherited forward annotation in User.roles.
from app.interface.dto import Role, Token, User
from pydantic import Field


class CurrentUser(User):
    effective_role: EffectiveRole | None


class SessionLogin(Token):
    """Additive transition response. Legacy bearer fields are removed in BE-009."""
    user: User
    effective_role: EffectiveRole | None
    token: str = Field(json_schema_extra={"deprecated": True})
