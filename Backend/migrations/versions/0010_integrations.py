"""Owner/site/source identities and encrypted credentials, without analytical data."""
from alembic import op
import sqlalchemy as sa

revision = "0010_integrations"
down_revision = "0009_websites"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_unique_constraint("uq_websites_id_owner", "websites", ["id", "owner_id"])
    op.create_table("integrations",
        sa.Column("id", sa.Text(), nullable=False),
        sa.Column("owner_id", sa.Text(), nullable=False),
        sa.Column("website_id", sa.Text(), nullable=False),
        sa.Column("source", sa.String(3), nullable=False),
        sa.Column("property_id", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("retired_at", sa.DateTime(timezone=True), nullable=True),
        sa.PrimaryKeyConstraint("id", name="pk_integrations"),
        sa.ForeignKeyConstraint(["website_id", "owner_id"], ["websites.id", "websites.owner_id"],
            name="fk_integrations_website_owner", ondelete="RESTRICT"),
        sa.CheckConstraint("octet_length(id) BETWEEN 1 AND 128 AND length(btrim(id)) > 0 "
            "AND id !~ '[[:cntrl:]]' AND octet_length(owner_id) BETWEEN 1 AND 128 "
            "AND length(btrim(owner_id)) > 0 AND owner_id !~ '[[:cntrl:]]' "
            "AND octet_length(website_id) BETWEEN 1 AND 128 AND length(btrim(website_id)) > 0 "
            "AND website_id !~ '[[:cntrl:]]'", name=op.f("ck_integrations_identifiers_valid")),
        sa.CheckConstraint("source IN ('ga4', 'gsc', 'ads')", name=op.f("ck_integrations_source_valid")),
        sa.CheckConstraint("octet_length(property_id) BETWEEN 1 AND 2048 AND length(btrim(property_id)) > 0 "
            "AND property_id !~ '[[:cntrl:]]'", name=op.f("ck_integrations_property_valid")),
        sa.CheckConstraint("created_at <= updated_at AND (retired_at IS NULL OR retired_at = updated_at)", name=op.f("ck_integrations_timestamps_valid")),
        sa.CheckConstraint("revision > 0", name=op.f("ck_integrations_revision_valid")),
    )
    op.create_index("uq_integrations_current_source", "integrations", ["website_id", "source"], unique=True,
        postgresql_where=sa.text("retired_at IS NULL"))
    op.create_table("integration_credentials",
        sa.Column("integration_id", sa.Text(), nullable=False),
        sa.Column("ciphertext", sa.LargeBinary(), nullable=False),
        sa.PrimaryKeyConstraint("integration_id", name="pk_integration_credentials"),
        sa.ForeignKeyConstraint(["integration_id"], ["integrations.id"],
            name="fk_integration_credentials_integration_id_integrations", ondelete="CASCADE"),
        sa.CheckConstraint("octet_length(ciphertext) BETWEEN 30 AND 16413 AND get_byte(ciphertext, 0) = 1",
            name=op.f("ck_integration_credentials_envelope_valid")),
    )


def downgrade() -> None:
    # Explicit destructive rollback of BE-021 records only; no previous domain data.
    op.drop_table("integration_credentials")
    op.drop_table("integrations")
    op.drop_constraint("uq_websites_id_owner", "websites", type_="unique")
