"""Add CIP cascade simulations table.

Stores cascade simulation runs: initial failures, time horizon, timeline, affected assets.
"""
from alembic import op
import sqlalchemy as sa

revision = "20260205_0002"
down_revision = "20260205_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "cip_cascade_simulations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255)),
        sa.Column("initial_failure_ids", sa.Text, comment="JSON array of infrastructure IDs"),
        sa.Column("time_horizon_hours", sa.Integer, default=72),
        sa.Column("timeline", sa.Text, comment="JSON array of {step, hour, affected_ids, impact_score}"),
        sa.Column("affected_assets", sa.Text, comment="JSON array of affected infrastructure IDs with depth"),
        sa.Column("impact_score", sa.Float),
        sa.Column("recovery_time_hours", sa.Float),
        sa.Column("total_affected", sa.Integer),
        sa.Column("population_affected", sa.Integer),
        sa.Column("created_at", sa.DateTime),
        sa.Column("created_by", sa.String(36)),
    )


def downgrade() -> None:
    op.drop_table("cip_cascade_simulations")
