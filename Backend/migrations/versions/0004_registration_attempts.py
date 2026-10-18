"""Shared, expiring counters for public registration attempts.

Revision ID: 0004_registration_attempts
Revises: 0003_email_identity
"""
from alembic import op
import sqlalchemy as sa

revision = "0004_registration_attempts"
down_revision = "0003_email_identity"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "registration_attempts",
        sa.Column("peer_key", sa.String(64), nullable=False),
        sa.Column("window_start", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.PrimaryKeyConstraint("peer_key", "window_start", name="pk_registration_attempts"),
        sa.CheckConstraint("attempts > 0", name=op.f("ck_registration_attempts_attempts_positive")),
        sa.CheckConstraint("length(peer_key) = 64", name=op.f("ck_registration_attempts_peer_key_length")),
        sa.CheckConstraint("expires_at > window_start", name=op.f("ck_registration_attempts_window_valid")),
    )
    op.create_index("ix_registration_attempts_expires_at", "registration_attempts", ["expires_at"])


def downgrade() -> None:
    # Only short-lived abuse counters are removed; identity records are untouched.
    op.drop_index("ix_registration_attempts_expires_at", table_name="registration_attempts")
    op.drop_table("registration_attempts")
