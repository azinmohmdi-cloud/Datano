"""Establish migration history without introducing product tables.

Revision ID: 0001_database_baseline
Revises: None
"""

revision: str = "0001_database_baseline"
down_revision: str | None = None
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    # User/role persistence belongs to BE-004; analytics schemas come later.
    pass


def downgrade() -> None:
    # This baseline creates no domain objects to remove.
    pass
