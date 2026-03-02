"""Add SRS (Sovereign Risk Shield) module tables.

Revision ID: 20260218_0001
Revises: 20260214_0002
Create Date: 2026-02-18

Tables: srs_sovereign_funds, srs_resource_deposits, srs_indicators
"""
from alembic import op
import sqlalchemy as sa


revision = "20260218_0001"
down_revision = "20260214_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "srs_sovereign_funds",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("srs_id", sa.String(100), unique=True, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("country_code", sa.String(2), nullable=False, index=True),
        sa.Column("description", sa.Text()),
        sa.Column("total_assets_usd", sa.Float()),
        sa.Column("currency", sa.String(3), server_default="USD"),
        sa.Column("status", sa.String(20), server_default="active"),
        sa.Column("established_year", sa.Integer()),
        sa.Column("mandate", sa.Text()),
        sa.Column("extra_data", sa.Text()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), onupdate=sa.func.now()),
    )

    op.create_table(
        "srs_resource_deposits",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("srs_id", sa.String(100), unique=True, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("resource_type", sa.String(50), nullable=False),
        sa.Column("country_code", sa.String(2), nullable=False, index=True),
        sa.Column("sovereign_fund_id", sa.String(36), sa.ForeignKey("srs_sovereign_funds.id", ondelete="SET NULL"), index=True),
        sa.Column("estimated_value_usd", sa.Float()),
        sa.Column("latitude", sa.Float()),
        sa.Column("longitude", sa.Float()),
        sa.Column("description", sa.Text()),
        sa.Column("extraction_horizon_years", sa.Integer()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), onupdate=sa.func.now()),
    )

    op.create_table(
        "srs_indicators",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("country_code", sa.String(2), nullable=False, index=True),
        sa.Column("indicator_type", sa.String(50), nullable=False),
        sa.Column("value", sa.Float(), nullable=False),
        sa.Column("unit", sa.String(20)),
        sa.Column("source", sa.String(255)),
        sa.Column("measured_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("srs_indicators")
    op.drop_table("srs_resource_deposits")
    op.drop_table("srs_sovereign_funds")
