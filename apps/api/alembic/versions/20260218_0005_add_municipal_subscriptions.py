"""Add municipal_subscriptions table (Phase D: SaaS).

Revision ID: 20260218_0005
Revises: 20260218_0004
Create Date: 2026-02-18
"""
from alembic import op
import sqlalchemy as sa


revision = "20260218_0005"
down_revision = "20260218_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "municipal_subscriptions",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(100), nullable=False, unique=True, index=True),
        sa.Column("tier", sa.String(50), server_default="standard", index=True),
        sa.Column("amount_yearly", sa.Float(), nullable=False),
        sa.Column("currency", sa.String(3), server_default="USD"),
        sa.Column("period_start", sa.DateTime(), nullable=False),
        sa.Column("period_end", sa.DateTime(), nullable=False),
        sa.Column("status", sa.String(20), server_default="active", index=True),
        sa.Column("stripe_subscription_id", sa.String(100), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("municipal_subscriptions")
