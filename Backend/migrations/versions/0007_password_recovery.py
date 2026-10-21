"""Restricted, digest-only password recovery grants.

Revision ID: 0007_password_recovery
Revises: 0006_email_codes
"""
from alembic import op
import sqlalchemy as sa

revision = "0007_password_recovery"
down_revision = "0006_email_codes"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "password_recovery_grants",
        sa.Column("digest", sa.LargeBinary(), nullable=False),
        sa.Column("user_id", sa.Text(), nullable=False),
        sa.Column("account_state", sa.LargeBinary(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("digest", name="pk_password_recovery_grants"),
        sa.UniqueConstraint("user_id", name="uq_password_recovery_grants_user_id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_password_recovery_grants_user_id_users", ondelete="CASCADE"),
        sa.CheckConstraint("octet_length(digest) = 32 AND octet_length(account_state) = 32", name=op.f("ck_password_recovery_grants_digests_valid")),
        sa.CheckConstraint("created_at < expires_at AND expires_at <= created_at + interval '10 minutes'", name=op.f("ck_password_recovery_grants_lifetime_valid")),
    )


def downgrade() -> None:
    op.drop_table("password_recovery_grants")
