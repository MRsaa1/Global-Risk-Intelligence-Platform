"""Merge heads: 20260227_0004 (Track B) and 20260301_0003 (market_data_snapshots).

Revision ID: 20260301_0004
Revises: 20260227_0004, 20260301_0003
Create Date: 2026-03-01

"""
from alembic import op
import sqlalchemy as sa

revision = "20260301_0004"
down_revision = ("20260227_0004", "20260301_0003")
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
