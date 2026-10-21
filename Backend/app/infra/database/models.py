"""Identity persistence models, separate from HTTP DTOs and domain entities."""
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Index, Integer, LargeBinary, String, Table, Text
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
