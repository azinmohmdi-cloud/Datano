"""Digest-only revocable opaque sessions.

Revision ID: 0005_opaque_sessions
Revises: 0004_registration_attempts
"""
from alembic import op
import sqlalchemy as sa

revision = "0005_opaque_sessions"
down_revision = "0004_registration_attempts"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "auth_sessions",
        sa.Column("digest", sa.LargeBinary(), nullable=False),
        sa.Column("user_id", sa.Text(), nullable=False),
        sa.Column("remember_me", sa.Boolean(), nullable=False),
        sa.Column("idle_timeout_seconds", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("last_seen_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("idle_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("absolute_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("digest", name="pk_auth_sessions"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE", name="fk_auth_sessions_user_id_users"),
        sa.CheckConstraint("octet_length(digest) = 32", name=op.f("ck_auth_sessions_digest_length")),
        sa.CheckConstraint("idle_timeout_seconds > 0", name=op.f("ck_auth_sessions_idle_positive")),
        sa.CheckConstraint("created_at <= last_seen_at AND last_seen_at < idle_expires_at AND idle_expires_at <= absolute_expires_at", name=op.f("ck_auth_sessions_lifetime_valid")),
        sa.CheckConstraint("revoked_at IS NULL OR revoked_at >= last_seen_at", name=op.f("ck_auth_sessions_revocation_valid")),
    )
    op.create_index("ix_auth_sessions_user_id", "auth_sessions", ["user_id"])


def downgrade() -> None:
    # Revokes the new opaque sessions by removing them; identity data is preserved.
    op.drop_index("ix_auth_sessions_user_id", table_name="auth_sessions")
    op.drop_table("auth_sessions")
