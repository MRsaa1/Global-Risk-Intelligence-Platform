"""Add FST module table (fst_runs).

Revision ID: 20260218_0003
Revises: 20260218_0002
Create Date: 2026-02-18
"""
from alembic import op
import sqlalchemy as sa


revision = "20260218_0003"
down_revision = "20260218_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fst_runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("fst_id", sa.String(100), unique=True, index=True),
        sa.Column("scenario_type", sa.String(100), nullable=False, index=True),
        sa.Column("scenario_name", sa.String(255)),
        sa.Column("status", sa.String(20), server_default="completed"),
        sa.Column("regulatory_format", sa.String(50)),
        sa.Column("summary_json", sa.Text()),
        sa.Column("run_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("fst_runs")
