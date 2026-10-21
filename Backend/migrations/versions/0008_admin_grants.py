"""Server-owned administrator mailbox authority; no existing assignment is proof."""
from alembic import op
import sqlalchemy as sa

revision = "0008_admin_grants"
down_revision = "0007_password_recovery"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("admin_grants",
        sa.Column("user_id", sa.Text(), nullable=False),
        sa.Column("email_key", sa.Text(), nullable=False),
        sa.Column("role_id", sa.Text(), nullable=False),
        sa.Column("role_state", sa.LargeBinary(), nullable=False),
        sa.Column("verified_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("method", sa.String(16), nullable=False),
        sa.PrimaryKeyConstraint("user_id", name="pk_admin_grants"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], name="fk_admin_grants_user_id_users", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["role_id"], ["roles.id"], name="fk_admin_grants_role_id_roles", ondelete="CASCADE"),
        sa.CheckConstraint("length(email_key) > 0 AND email_key = lower(btrim(email_key))", name=op.f("ck_admin_grants_email_key_valid")),
        sa.CheckConstraint("octet_length(role_state) = 32", name=op.f("ck_admin_grants_role_state_valid")),
        sa.CheckConstraint("method IN ('email', 'provisioning')", name=op.f("ck_admin_grants_method_valid")),
    )


def downgrade() -> None:
    # Removing technical authority never removes users/roles/session history.
    op.drop_table("admin_grants")
