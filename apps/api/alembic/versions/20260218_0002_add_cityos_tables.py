"""Add CityOS module tables.

Revision ID: 20260218_0002
Revises: 20260218_0001
Create Date: 2026-02-18

Tables: cityos_city_twins, cityos_migration_routes
"""
from alembic import op
import sqlalchemy as sa


revision = "20260218_0002"
down_revision = "20260218_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cityos_city_twins",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("cityos_id", sa.String(100), unique=True, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("country_code", sa.String(2), nullable=False, index=True),
        sa.Column("region", sa.String(100)),
        sa.Column("latitude", sa.Float()),
        sa.Column("longitude", sa.Float()),
        sa.Column("population", sa.Integer()),
        sa.Column("description", sa.Text()),
        sa.Column("capacity_notes", sa.Text()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), onupdate=sa.func.now()),
    )

    op.create_table(
        "cityos_migration_routes",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("cityos_id", sa.String(100), unique=True, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("origin_city_id", sa.String(36), sa.ForeignKey("cityos_city_twins.id", ondelete="SET NULL"), index=True),
        sa.Column("destination_city_id", sa.String(36), sa.ForeignKey("cityos_city_twins.id", ondelete="SET NULL"), index=True),
        sa.Column("estimated_flow_per_year", sa.Integer()),
        sa.Column("driver_type", sa.String(50)),
        sa.Column("description", sa.Text()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), onupdate=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("cityos_migration_routes")
    op.drop_table("cityos_city_twins")
