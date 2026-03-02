"""Add market_data_snapshots table for VIX/indices history.

Revision ID: 20260301_0003
Revises: 20260301_0002
Create Date: 2026-03-01

"""
from alembic import op
import sqlalchemy as sa

revision = "20260301_0003"
down_revision = "20260301_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "market_data_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("captured_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("values", sa.JSON(), nullable=False),
    )
    op.create_index(
        "ix_market_data_snapshots_captured_at",
        "market_data_snapshots",
        ["captured_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_market_data_snapshots_captured_at", table_name="market_data_snapshots")
    op.drop_table("market_data_snapshots")
