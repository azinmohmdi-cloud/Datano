"""Owner-bound websites, expiring reservations and digest-only challenge state."""
from alembic import op
import sqlalchemy as sa

revision = "0009_websites"
down_revision = "0008_admin_grants"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("websites",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("owner_id", sa.Text(), nullable=False),
        sa.Column("hostname", sa.Text(), nullable=False),
        sa.Column("scheme", sa.String(5), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("reservation_expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("challenge_digest", sa.LargeBinary(), nullable=True),
        sa.Column("challenge_issued_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("challenge_expires_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("released_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_websites"),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], name="fk_websites_owner_id_users", ondelete="RESTRICT"),
        sa.CheckConstraint("length(btrim(id)) > 0 AND length(btrim(owner_id)) > 0", name=op.f("ck_websites_identifiers_valid")),
        sa.CheckConstraint(
            r"length(hostname) <= 253 AND hostname ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$' "
            r"AND hostname !~ '\.(localhost|local|[0-9]+|0x[0-9a-f]+)$'", name=op.f("ck_websites_hostname_canonical")),
        sa.CheckConstraint("scheme IN ('http', 'https')", name=op.f("ck_websites_scheme_valid")),
        sa.CheckConstraint("created_at <= updated_at AND (released_at IS NULL OR (created_at <= released_at AND released_at <= updated_at))", name=op.f("ck_websites_timestamps_valid")),
        sa.CheckConstraint(
            "(challenge_digest IS NULL AND challenge_issued_at IS NULL AND challenge_expires_at IS NULL "
            "AND verified_at IS NULL AND reservation_expires_at = created_at + interval '24 hours') OR "
            "(challenge_digest IS NOT NULL AND octet_length(challenge_digest) = 32 "
            "AND challenge_issued_at IS NOT NULL AND challenge_expires_at IS NOT NULL "
            "AND created_at <= challenge_issued_at AND challenge_issued_at <= updated_at "
            "AND challenge_expires_at = challenge_issued_at + interval '24 hours' "
            "AND reservation_expires_at = challenge_expires_at "
            "AND (verified_at IS NULL OR (challenge_issued_at <= verified_at "
            "AND verified_at < challenge_expires_at AND verified_at <= updated_at)))", name=op.f("ck_websites_challenge_valid")),
    )
    op.create_index("uq_websites_current_hostname", "websites", ["hostname"], unique=True, postgresql_where=sa.text("released_at IS NULL"))
    op.create_index("ix_websites_owner_created", "websites", ["owner_id", "created_at", "id"], postgresql_where=sa.text("released_at IS NULL"))


def downgrade() -> None:
    # Destructive for website records only; account and authority data remain.
    op.drop_table("websites")
