"""Persist users, roles and their assignments.

Revision ID: 0002_users_roles
Revises: 0001_database_baseline
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002_users_roles"
down_revision = "0001_database_baseline"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("first_name", sa.Text(), nullable=False),
        sa.Column("last_name", sa.Text(), nullable=False),
        sa.Column("email", sa.Text(), nullable=False),
        sa.Column("username", sa.String(50), nullable=False),
        sa.Column("hashed_password", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_users"),
        sa.UniqueConstraint("email", name="uq_users_email"),
        sa.UniqueConstraint("username", name="uq_users_username"),
        sa.CheckConstraint("length(username) BETWEEN 3 AND 50", name=op.f("ck_users_username_length")),
    )
    op.create_table(
        "roles",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("permission_ids", postgresql.ARRAY(sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_roles"),
        sa.UniqueConstraint("name", name="uq_roles_name"),
        sa.CheckConstraint("length(btrim(name)) > 0 AND length(name) <= 100", name=op.f("ck_roles_name_valid")),
    )
    op.create_table(
        "user_roles",
        sa.Column("user_id", sa.Text(), nullable=False),
        sa.Column("role_id", sa.Text(), nullable=False),
        sa.PrimaryKeyConstraint("user_id", "role_id", name="pk_user_roles"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_user_roles_user_id_users", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], name="fk_user_roles_role_id_roles", ondelete="CASCADE"),
    )
    op.create_index("ix_user_roles_role_id", "user_roles", ["role_id"])


def downgrade() -> None:
    # Destructive for identity data: back up before intentionally downgrading.
    op.drop_index("ix_user_roles_role_id", table_name="user_roles")
    op.drop_table("user_roles")
    op.drop_table("roles")
    op.drop_table("users")
