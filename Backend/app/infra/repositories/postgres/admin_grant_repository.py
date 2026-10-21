import hmac

from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from app.application.use_cases.auth.admin_policy import admin_role_state
from app.domain.entities import RoleEntity
from app.domain.error.exceptions import ServiceUnavailableException
from app.domain.identity import canonical_email
from app.infra.database.models import AdminGrantRow
from app.interface.repository.admin_grant_repository_interface import IAdminGrantRepository


class SQLAdminGrantRepository(IAdminGrantRepository):
    def __init__(self, session: AsyncSession) -> None:
        self.session = session

    async def verified(self, user_id: str, email: str, role: RoleEntity) -> bool:
        if role.name != "Admin" or not role.is_active:
            return False
        try:
            grant = await self.session.scalar(select(AdminGrantRow).where(AdminGrantRow.user_id == user_id,
                AdminGrantRow.email_key == canonical_email(email), AdminGrantRow.role_id == role.id)
                .execution_options(populate_existing=True))
            return (grant is not None and grant.method in {"email", "provisioning"}
                and hmac.compare_digest(grant.role_state, admin_role_state(role)))
        except SQLAlchemyError:
            pass
        raise ServiceUnavailableException("Administrator authority is temporarily unavailable")
