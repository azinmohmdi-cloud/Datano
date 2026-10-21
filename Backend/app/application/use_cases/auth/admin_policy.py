"""Private administrator eligibility; never infer authority from an address alone."""
from dataclasses import dataclass, field
import hashlib
import json

from app.application.use_cases.auth.email_codes import EmailCodeContext, EmailCodePurpose
from app.domain.entities import RoleEntity
from app.domain.identity import canonical_email


@dataclass(frozen=True)
class AdminEmailPolicy:
    emails: frozenset[str] = field(default_factory=frozenset, repr=False)

    @classmethod
    def parse(cls, raw: str | None) -> "AdminEmailPolicy":
        if not raw:
            return cls()
        failed = False
        normalized = []
        try:
            values = json.loads(raw)
            if not isinstance(values, list) or any(not isinstance(value, str) for value in values):
                raise ValueError()
            normalized = [EmailCodeContext(EmailCodePurpose.ADMIN_EMAIL, "configuration", value).recipient for value in values]
        except (ValueError, TypeError, UnicodeError):
            failed = True
        if failed:
            raise ValueError("ADMIN_EMAIL_ALLOWLIST must be a JSON array of valid email addresses")
        return cls(frozenset(normalized))

    def allows(self, email: str) -> bool:
        return canonical_email(email) in self.emails


def admin_role_state(role: RoleEntity) -> bytes:
    # Role edits, including deactivation followed by reactivation, require fresh
    # proof/provisioning instead of reviving a previously issued authority.
    return hashlib.sha256(json.dumps(["datano-admin-role-v1", role.id, role.name,
        role.is_active, sorted(role.permission_ids or []), role.updated_at.isoformat()],
        separators=(",", ":")).encode()).digest()
