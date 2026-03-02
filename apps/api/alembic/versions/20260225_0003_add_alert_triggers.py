"""Add alert_triggers table for configurable Early Warning.

Revision ID: 20260225_0003
Revises: 20260225_0002
Create Date: 2026-02-25

"""
from alembic import op
import sqlalchemy as sa


revision = "20260225_0003"
down_revision = "20260225_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "alert_triggers",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, index=True),
        sa.Column("metric_key", sa.String(128), nullable=False, index=True),
        sa.Column("operator", sa.String(8), nullable=False),
        sa.Column("threshold_value", sa.Float(), nullable=False),
        sa.Column("window_minutes", sa.Integer(), nullable=True),
        sa.Column("alert_type", sa.String(64), nullable=False, server_default="custom_trigger"),
        sa.Column("severity", sa.String(20), nullable=False, server_default="warning"),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("alert_triggers")
