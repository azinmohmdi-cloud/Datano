"""Identity persistence models, separate from HTTP DTOs and domain entities."""
from datetime import datetime

from sqlalchemy import Boolean, CheckConstraint, Column, DateTime, ForeignKey, Index, String, Table, Text
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


user_roles = Table(
    "user_roles", Base.metadata,
    Column("user_id", Text, ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", Text, ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True),
    Index("ix_user_roles_role_id", "role_id"),
)
