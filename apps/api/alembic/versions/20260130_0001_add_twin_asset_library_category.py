"""Add category column to twin_asset_library.

Revision ID: 20260130_0001
Revises: 20260128_0002
Create Date: 2026-01-30

Category: residential | commercial | industrial | public
"""

from alembic import op
import sqlalchemy as sa

revision = "20260130_0001"
down_revision = "20260128_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "twin_asset_library",
        sa.Column("category", sa.String(50), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("twin_asset_library", "category")
