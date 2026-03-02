"""Add fraud_detection_rules table.

Revision ID: 20260225_0007
Revises: 20260225_0006
Create Date: 2026-02-25

"""
from alembic import op
import sqlalchemy as sa


revision = "20260225_0007"
down_revision = "20260225_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fraud_detection_rules",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("rule_type", sa.String(50), nullable=False),
        sa.Column("field_name", sa.String(100), nullable=True),
        sa.Column("threshold_value", sa.Float(), nullable=True),
        sa.Column("window_hours", sa.Integer(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("fraud_detection_rules")
