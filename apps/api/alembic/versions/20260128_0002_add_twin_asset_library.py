"""Add twin asset library catalog table.

Revision ID: 20260128_0002
Revises: 20260128_0001
Create Date: 2026-01-28
"""

from alembic import op
import sqlalchemy as sa

revision = "20260128_0002"
down_revision = "20260128_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create twin_asset_library table."""

    op.create_table(
        "twin_asset_library",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("domain", sa.String(50), nullable=False, server_default="factory"),
        sa.Column("kind", sa.String(80), nullable=False, server_default="building"),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("tags", sa.Text(), nullable=True),
        sa.Column("license", sa.String(200), nullable=True),
        sa.Column("source", sa.String(120), nullable=True),
        sa.Column("source_url", sa.String(500), nullable=True),
        sa.Column("usd_path", sa.String(700), nullable=True),
        sa.Column("glb_object", sa.String(700), nullable=True),
        sa.Column("thumbnail_object", sa.String(700), nullable=True),
        sa.Column("extra_metadata", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    """Drop twin_asset_library table."""

    op.drop_table("twin_asset_library")

