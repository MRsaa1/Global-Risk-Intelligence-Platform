"""Add fat_tail_events catalog.

Revision ID: 20260225_0004
Revises: 20260225_0003
Create Date: 2026-02-25

"""
from alembic import op
import sqlalchemy as sa


revision = "20260225_0004"
down_revision = "20260225_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "fat_tail_events",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("event_type", sa.String(64), nullable=False, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("base_probability", sa.Float(), nullable=False, server_default="0.001"),
        sa.Column("indicator_source", sa.String(512), nullable=True),
        sa.Column("indicator_threshold", sa.Float(), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("fat_tail_events")
