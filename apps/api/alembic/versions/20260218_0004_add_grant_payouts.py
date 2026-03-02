"""Add grant_payouts table (Phase D: payouts).

Revision ID: 20260218_0004
Revises: 20260218_0003
Create Date: 2026-02-18
"""
from alembic import op
import sqlalchemy as sa


revision = "20260218_0004"
down_revision = "20260218_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "grant_payouts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("application_id", sa.String(36), nullable=False, index=True),
        sa.Column("payout_date", sa.DateTime(), nullable=False),
        sa.Column("amount", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(3), server_default="USD"),
        sa.Column("status", sa.String(20), server_default="pending", index=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("grant_payouts")
