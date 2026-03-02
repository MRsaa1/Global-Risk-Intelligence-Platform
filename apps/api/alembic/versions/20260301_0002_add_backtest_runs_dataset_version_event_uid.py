"""Add dataset_version and event_uid to backtest_runs for reproducible backtesting.

Revision ID: 20260301_0002
Revises: 20260301_0001
Create Date: 2026-03-01

Technical Spec: docs/EXTERNAL_DATABASES_TECHNICAL_SPEC_V1.md (BacktestRun dataset_version, event_uid)
"""
from alembic import op
import sqlalchemy as sa

revision = "20260301_0002"
down_revision = "20260301_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "backtest_runs",
        sa.Column("dataset_version", sa.String(64), nullable=True),
    )
    op.add_column(
        "backtest_runs",
        sa.Column("event_uid", sa.String(128), nullable=True),
    )
    op.create_index("ix_backtest_runs_dataset_version", "backtest_runs", ["dataset_version"])
    op.create_index("ix_backtest_runs_event_uid", "backtest_runs", ["event_uid"])


def downgrade() -> None:
    op.drop_index("ix_backtest_runs_event_uid", table_name="backtest_runs")
    op.drop_index("ix_backtest_runs_dataset_version", table_name="backtest_runs")
    op.drop_column("backtest_runs", "event_uid")
    op.drop_column("backtest_runs", "dataset_version")
