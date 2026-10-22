"""Persistence models, separate from HTTP DTOs and domain entities."""
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, LargeBinary, String, Table, Text, text
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import Mapped, mapped_column

from app.infra.database.base import Base


class UserRow(Base):
    __tablename__ = "users"
    __table_args__ = (
        CheckConstraint("length(username) BETWEEN 3 AND 50", name="username_length"),
        CheckConstraint("length(email_key) > 0", name="email_key_nonempty"),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    first_name: Mapped[str] = mapped_column(Text)
    last_name: Mapped[str] = mapped_column(Text)
    email: Mapped[str] = mapped_column(Text, unique=True)
    email_key: Mapped[str] = mapped_column(Text, unique=True)
    username: Mapped[str] = mapped_column(String(50), unique=True)
    hashed_password: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean)


class RoleRow(Base):
    __tablename__ = "roles"
    __table_args__ = (CheckConstraint("length(btrim(name)) > 0 AND length(name) <= 100", name="name_valid"),)

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    name: Mapped[str] = mapped_column(String(100), unique=True)
    permission_ids: Mapped[list[str]] = mapped_column(ARRAY(Text))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    is_active: Mapped[bool] = mapped_column(Boolean)


class WebsiteRow(Base):
    __tablename__ = "websites"
    __table_args__ = (
        CheckConstraint("length(btrim(id)) > 0 AND length(btrim(owner_id)) > 0", name="identifiers_valid"),
        CheckConstraint(
            r"length(hostname) <= 253 AND hostname ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$' "
            r"AND hostname !~ '\.(localhost|local|[0-9]+|0x[0-9a-f]+)$'", name="hostname_canonical"),
        CheckConstraint("scheme IN ('http', 'https')", name="scheme_valid"),
        CheckConstraint("created_at <= updated_at AND (released_at IS NULL OR (created_at <= released_at AND released_at <= updated_at))", name="timestamps_valid"),
        CheckConstraint(
            "(challenge_digest IS NULL AND challenge_issued_at IS NULL AND challenge_expires_at IS NULL "
            "AND verified_at IS NULL AND reservation_expires_at = created_at + interval '24 hours') OR "
            "(challenge_digest IS NOT NULL AND octet_length(challenge_digest) = 32 "
            "AND challenge_issued_at IS NOT NULL AND challenge_expires_at IS NOT NULL "
            "AND created_at <= challenge_issued_at AND challenge_issued_at <= updated_at "
            "AND challenge_expires_at = challenge_issued_at + interval '24 hours' "
            "AND reservation_expires_at = challenge_expires_at "
            "AND (verified_at IS NULL OR (challenge_issued_at <= verified_at "
            "AND verified_at < challenge_expires_at AND verified_at <= updated_at)))", name="challenge_valid"),
        Index("uq_websites_current_hostname", "hostname", unique=True, postgresql_where=text("released_at IS NULL")),
        Index("ix_websites_owner_created", "owner_id", "created_at", "id", postgresql_where=text("released_at IS NULL")),
    )

    id: Mapped[str] = mapped_column(Text, primary_key=True)
    owner_id: Mapped[str] = mapped_column(Text, ForeignKey("users.id", ondelete="RESTRICT"))
    hostname: Mapped[str] = mapped_column(Text)
    scheme: Mapped[str] = mapped_column(String(5))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    reservation_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    challenge_digest: Mapped[bytes | None] = mapped_column(LargeBinary)
    challenge_issued_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    challenge_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    released_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AdminGrantRow(Base):
    __tablename__ = "admin_grants"
    __table_args__ = (
        CheckConstraint("length(email_key) > 0 AND email_key = lower(btrim(email_key))", name="email_key_valid"),
        CheckConstraint("octet_length(role_state) = 32", name="role_state_valid"),
        CheckConstraint("method IN ('email', 'provisioning')", name="method_valid"),
    )
    user_id: Mapped[str] = mapped_column(Text, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True)
    email_key: Mapped[str] = mapped_column(Text)
    role_id: Mapped[str] = mapped_column(Text, ForeignKey("roles.id", ondelete="CASCADE"))
    role_state: Mapped[bytes] = mapped_column(LargeBinary)
    verified_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    method: Mapped[str] = mapped_column(String(16))


class RegistrationAttemptRow(Base):
    __tablename__ = "registration_attempts"
    __table_args__ = (
        CheckConstraint("attempts > 0", name="attempts_positive"),
        CheckConstraint("length(peer_key) = 64", name="peer_key_length"),
        CheckConstraint("expires_at > window_start", name="window_valid"),
        Index("ix_registration_attempts_expires_at", "expires_at"),
    )

    peer_key: Mapped[str] = mapped_column(String(64), primary_key=True)
    window_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), primary_key=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer)


class SessionRow(Base):
    __tablename__ = "auth_sessions"
    __table_args__ = (
        CheckConstraint("octet_length(digest) = 32", name="digest_length"),
        CheckConstraint("idle_timeout_seconds > 0", name="idle_positive"),
        CheckConstraint("created_at <= last_seen_at AND last_seen_at < idle_expires_at AND idle_expires_at <= absolute_expires_at", name="lifetime_valid"),
        CheckConstraint("revoked_at IS NULL OR revoked_at >= last_seen_at", name="revocation_valid"),
        Index("ix_auth_sessions_user_id", "user_id"),
    )

    digest: Mapped[bytes] = mapped_column(LargeBinary, primary_key=True)
    user_id: Mapped[str] = mapped_column(Text, ForeignKey("users.id", ondelete="CASCADE"))
    remember_me: Mapped[bool] = mapped_column(Boolean)
    idle_timeout_seconds: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    idle_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    absolute_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class RecoveryGrantRow(Base):
    __tablename__ = "password_recovery_grants"
    __table_args__ = (
        CheckConstraint("octet_length(digest) = 32 AND octet_length(account_state) = 32", name="digests_valid"),
        CheckConstraint("created_at < expires_at AND expires_at <= created_at + interval '10 minutes'", name="lifetime_valid"),
    )
    digest: Mapped[bytes] = mapped_column(LargeBinary, primary_key=True)
    user_id: Mapped[str] = mapped_column(Text, ForeignKey("users.id", ondelete="CASCADE"), unique=True)
    account_state: Mapped[bytes] = mapped_column(LargeBinary)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))


class EmailCodeRow(Base):
    __tablename__ = "email_code_challenges"
    __table_args__ = (
        CheckConstraint("octet_length(scope) = 32 AND octet_length(digest) = 32", name="digests_valid"),
        CheckConstraint("generation ~ '^[0-9a-f]{32}$'", name="generation_valid"),
        CheckConstraint("expires_at = issued_at + interval '10 minutes'", name="lifetime_valid"),
        CheckConstraint("attempts BETWEEN 0 AND 5", name="attempts_valid"),
        CheckConstraint("consumed_at IS NULL OR (delivered AND attempts > 0 AND issued_at <= consumed_at AND consumed_at < expires_at)", name="consumption_valid"),
    )

    scope: Mapped[bytes] = mapped_column(LargeBinary, primary_key=True)
    digest: Mapped[bytes] = mapped_column(LargeBinary)
    generation: Mapped[str] = mapped_column(String(32))
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    attempts: Mapped[int] = mapped_column(Integer)
    delivered: Mapped[bool] = mapped_column(Boolean)
    consumed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


user_roles = Table(
    "user_roles", Base.metadata,
    Column("user_id", Text, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", Text, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Index("ix_user_roles_role_id", "role_id"),
)
