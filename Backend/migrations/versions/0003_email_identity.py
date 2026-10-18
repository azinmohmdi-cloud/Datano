"""Backfill a canonical email identity without modifying account data.

Revision ID: 0003_email_identity
Revises: 0002_users_roles
"""
from alembic import context, op
import sqlalchemy as sa
from sqlalchemy.exc import IntegrityError

revision = "0003_email_identity"
down_revision = "0002_users_roles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    if context.is_offline_mode():
        raise RuntimeError("Email identity backfill requires an online PostgreSQL migration")
    connection = op.get_bind()
    # No account may change between the backfill and installing the constraint.
    # PostgreSQL transactional DDL rolls everything back on any collision.
    connection.execute(sa.text("LOCK TABLE users IN ACCESS EXCLUSIVE MODE"))
    op.add_column("users", sa.Column("email_key", sa.Text(), nullable=True))
    op.create_unique_constraint("uq_users_email_key", "users", ["email_key"])
    users = sa.table("users", sa.column("id", sa.Text()), sa.column("email", sa.Text()), sa.column("email_key", sa.Text()))
    # Freeze this Python Unicode rule in the revision; PostgreSQL lower/btrim
    # depend on database locale and do not implement Python strip/lower exactly.
    with connection.execute(sa.select(users.c.id, users.c.email).execution_options(yield_per=1000)) as rows:
        for identifier, email in rows:
            key = email.strip().lower()
            if not key:
                raise RuntimeError("Email identity backfill found an empty canonical email; repair accounts before retrying")
            try:
                connection.execute(users.update().where(users.c.id == identifier).values(email_key=key))
            except IntegrityError as error:
                if getattr(error.orig, "sqlstate", None) == "23505":
                    raise RuntimeError(
                        "Email identity backfill found a canonical email collision; resolve account ownership before retrying"
                    ) from None
                raise
    op.alter_column("users", "email_key", nullable=False)
    op.create_check_constraint(op.f("ck_users_email_key_nonempty"), "users", "length(email_key) > 0")


def downgrade() -> None:
    op.drop_constraint(op.f("ck_users_email_key_nonempty"), "users", type_="check")
    op.drop_constraint("uq_users_email_key", "users", type_="unique")
    op.drop_column("users", "email_key")
