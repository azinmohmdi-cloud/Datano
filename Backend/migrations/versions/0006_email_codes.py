"""Digest-only, single-use email challenges.

Revision ID: 0006_email_codes
Revises: 0005_opaque_sessions
"""
from alembic import op
import sqlalchemy as sa

revision = "0006_email_codes"
down_revision = "0005_opaque_sessions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "email_code_challenges",
        sa.Column("scope", sa.LargeBinary(), nullable=False),
        sa.Column("digest", sa.LargeBinary(), nullable=False),
        sa.Column("generation", sa.String(32), nullable=False),
        sa.Column("issued_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
        sa.Column("delivered", sa.Boolean(), nullable=False),
        sa.Column("consumed_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("scope", name="pk_email_code_challenges"),
        sa.CheckConstraint("octet_length(scope) = 32 AND octet_length(digest) = 32", name=op.f("ck_email_code_challenges_digests_valid")),
        sa.CheckConstraint("generation ~ '^[0-9a-f]{32}$'", name=op.f("ck_email_code_challenges_generation_valid")),
        sa.CheckConstraint("expires_at = issued_at + interval '10 minutes'", name=op.f("ck_email_code_challenges_lifetime_valid")),
        sa.CheckConstraint("attempts BETWEEN 0 AND 5", name=op.f("ck_email_code_challenges_attempts_valid")),
        sa.CheckConstraint("consumed_at IS NULL OR (delivered AND attempts > 0 AND issued_at <= consumed_at AND consumed_at < expires_at)", name=op.f("ck_email_code_challenges_consumption_valid")),
    )


def downgrade() -> None:
    # Invalidates email proofs only; users, roles, sessions remain untouched.
    op.drop_table("email_code_challenges")
