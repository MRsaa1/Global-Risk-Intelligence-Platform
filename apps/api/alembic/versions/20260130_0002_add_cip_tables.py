"""Add CIP (Critical Infrastructure Protection) module tables.

Revision ID: 20260130_0002
Revises: 20260130_0001
Create Date: 2026-01-30

Tables: cip_infrastructure, cip_dependencies
"""
from alembic import op
import sqlalchemy as sa


revision = "20260130_0002"
down_revision = "20260130_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # cip_infrastructure must exist before cip_dependencies (FK)
    op.create_table(
        "cip_infrastructure",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("cip_id", sa.String(100), unique=True, index=True, nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text),
        sa.Column("asset_id", sa.String(36), sa.ForeignKey("assets.id", ondelete="SET NULL"), nullable=True),
        sa.Column("infrastructure_type", sa.String(50), default="other"),
        sa.Column("criticality_level", sa.String(20), default="tier_3"),
        sa.Column("operational_status", sa.String(20), default="operational"),
        sa.Column("latitude", sa.Float),
        sa.Column("longitude", sa.Float),
        sa.Column("country_code", sa.String(2), default="DE"),
        sa.Column("region", sa.String(100)),
        sa.Column("city", sa.String(100)),
        sa.Column("capacity_value", sa.Float),
        sa.Column("capacity_unit", sa.String(50)),
        sa.Column("current_load_percent", sa.Float),
        sa.Column("population_served", sa.Integer),
        sa.Column("service_area_km2", sa.Float),
        sa.Column("upstream_dependencies", sa.Text),
        sa.Column("downstream_dependents", sa.Text),
        sa.Column("vulnerability_score", sa.Float),
        sa.Column("exposure_score", sa.Float),
        sa.Column("resilience_score", sa.Float),
        sa.Column("cascade_risk_score", sa.Float),
        sa.Column("estimated_recovery_hours", sa.Float),
        sa.Column("backup_systems", sa.Text),
        sa.Column("owner_organization", sa.String(255)),
        sa.Column("operator_organization", sa.String(255)),
        sa.Column("regulatory_authority", sa.String(255)),
        sa.Column("extra_data", sa.Text),
        sa.Column("tags", sa.Text),
        sa.Column("created_at", sa.DateTime),
        sa.Column("updated_at", sa.DateTime),
        sa.Column("created_by", sa.String(36)),
    )

    op.create_table(
        "cip_dependencies",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("source_id", sa.String(36), sa.ForeignKey("cip_infrastructure.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("target_id", sa.String(36), sa.ForeignKey("cip_infrastructure.id", ondelete="CASCADE"), index=True, nullable=False),
        sa.Column("dependency_type", sa.String(50), default="operational"),
        sa.Column("strength", sa.Float, default=1.0),
        sa.Column("propagation_delay_minutes", sa.Integer),
        sa.Column("description", sa.Text),
        sa.Column("created_at", sa.DateTime),
    )


def downgrade() -> None:
    op.drop_table("cip_dependencies")
    op.drop_table("cip_infrastructure")
