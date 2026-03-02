"""Add backtest_runs table.

Revision ID: 20260225_0002
Revises: 20260225_0001
Create Date: 2026-02-25

"""
from alembic import op
import sqlalchemy as sa


revision = "20260225_0002"
down_revision = "20260225_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "backtest_runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("strategy_id", sa.String(64), nullable=False, index=True),
        sa.Column("scenario_type", sa.String(64), nullable=False, index=True),
        sa.Column("region_or_city", sa.String(255), nullable=False, index=True),
        sa.Column("event_type", sa.String(64), nullable=False, index=True),
        sa.Column("run_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("events_json", sa.Text(), nullable=True),
        sa.Column("event_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("mae_eur_m", sa.Float(), nullable=True),
        sa.Column("mape_pct", sa.Float(), nullable=True),
        sa.Column("hit_rate_pct", sa.Float(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("backtest_runs")
