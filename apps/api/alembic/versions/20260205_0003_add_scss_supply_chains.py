"""Add SCSS supply chains table (FR-SCSS-002).

Named supply chains: root_supplier_id maps to chain/map and analyze-bottlenecks.
"""
from alembic import op
import sqlalchemy as sa

revision = "20260205_0003"
down_revision = "20260205_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "scss_supply_chains",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("root_supplier_id", sa.String(36), sa.ForeignKey("scss_suppliers.id", ondelete="SET NULL")),
        sa.Column("description", sa.Text),
        sa.Column("created_at", sa.DateTime),
        sa.Column("created_by", sa.String(36)),
    )


def downgrade() -> None:
    op.drop_table("scss_supply_chains")
