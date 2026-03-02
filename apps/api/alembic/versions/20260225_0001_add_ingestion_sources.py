"""Add ingestion_sources catalog for SSOT.

Revision ID: 20260225_0001
Revises: 20260218_0010
Create Date: 2026-02-25

"""
from alembic import op
import sqlalchemy as sa


revision = "20260225_0001"
down_revision = "20260218_0010"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ingestion_sources",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, index=True),
        sa.Column("source_type", sa.String(64), nullable=False, index=True),
        sa.Column("endpoint_url", sa.String(2048), nullable=True),
        sa.Column("refresh_interval_minutes", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("config", sa.Text(), nullable=True),
        sa.Column("enabled", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("ingestion_sources")
