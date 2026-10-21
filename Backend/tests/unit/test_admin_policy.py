import json
from unittest.mock import AsyncMock

import pytest
from pydantic import ValidationError

from app.application.use_cases.auth.admin_policy import AdminEmailPolicy, admin_role_state
from app.application.use_cases.auth.current_identity_use_case import GetCurrentIdentityUseCase
from app.domain.entities import RoleEntity, UserEntity
from app.infra.core.config import Config
from app.interface.repository.admin_grant_repository_interface import IAdminGrantRepository
from app.interface.repository.role_repository_interface import IRoleRepository
from app.interface.repository.user_repository_interface import IUserRepository


def test_private_allowlist_is_canonical_empty_by_default_and_not_a_gmail_alias_rule():
    assert not AdminEmailPolicy().allows("admin@example.test")
    policy = AdminEmailPolicy.parse(json.dumps([" ADMIN@example.test ", "admin@example.test", "a.b+admin@gmail.com"]))
    assert policy.allows(" AdMin@EXAMPLE.TEST ")
    assert policy.allows("A.B+ADMIN@gmail.com")
    assert not policy.allows("ab@gmail.com")
    assert "admin@example.test" not in repr(policy)


@pytest.mark.parametrize("raw", ['"private@example.test"', '{"email":"private@example.test"}', '[null]', '[1]', '["bad"]', '["private@example.test\\nBcc: private@example.test"]', 'not-json'])
def test_allowlist_configuration_fails_safely_on_invalid_values(raw):
    with pytest.raises(ValidationError) as error:
        Config(_env_file=None, ADMIN_EMAIL_ALLOWLIST=raw)
    assert "private@example.test" not in str(error.value)


def test_allowlist_is_excluded_from_configuration_serialization_and_repr():
    settings = Config(_env_file=None, ADMIN_EMAIL_ALLOWLIST='["private@example.test"]')
    assert settings.admin_email_allowlist.get_secret_value() == '["private@example.test"]'
    assert "private@example.test" not in repr(settings)
    assert "admin_email_allowlist" not in settings.model_dump()
    assert "private@example.test" not in settings.model_dump_json()


@pytest.mark.parametrize("eligible,proved,active,expected", [(True,False,True,"User"), (False,True,True,"User"), (True,True,False,"User"), (True,True,True,"Admin")])
async def test_effective_admin_requires_private_eligibility_proof_and_active_role(eligible, proved, active, expected):
    admin, ordinary = RoleEntity.create("Admin", permission_ids=["super:user"]), RoleEntity.create("User")
    if not active: admin.deactivate()
    user = UserEntity.create(first_name="Proof", last_name="Owner", email="admin@example.test",
        username="proof-owner", hashed_password="test-hash", roles=[ordinary,admin])
    user.activate()
    users, roles, grants = AsyncMock(spec=IUserRepository), AsyncMock(spec=IRoleRepository), AsyncMock(spec=IAdminGrantRepository)
    users.get_by_id.return_value = user
    roles.get_by_id.side_effect = lambda role_id: {admin.id:admin,ordinary.id:ordinary}.get(role_id)
    grants.verified.return_value = proved
    policy = AdminEmailPolicy.parse('[" ADMIN@example.test "]') if eligible else AdminEmailPolicy()
    result = await GetCurrentIdentityUseCase(users,roles,grants,policy).execute(user.id)
    assert result.effective_role == expected
    assert any(role.name == "Admin" for role in result.user.roles) is (expected == "Admin")
    assert user.roles == [ordinary,admin]
    if not eligible or not active: grants.verified.assert_not_awaited()


def test_any_role_change_invalidates_its_authority_fingerprint():
    role = RoleEntity.create("Admin", permission_ids=["super:user"])
    initial = admin_role_state(role)
    role.deactivate(); role.activate()
    assert admin_role_state(role) != initial
