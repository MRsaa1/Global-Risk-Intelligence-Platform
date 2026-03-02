"""Add risk_posture_snapshots for Risk Velocity (MoM).

One row per day: at_risk_exposure, weighted_risk, total_expected_loss
so we can compute month-over-month change.
"""
from alembic import op
import sqlalchemy as sa

revision = "20260209_0001"
down_revision = "20260208_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "risk_posture_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("snapshot_date", sa.Date(), nullable=False),
        sa.Column("at_risk_exposure", sa.Float(), nullable=False),
        sa.Column("weighted_risk", sa.Float(), nullable=False),
        sa.Column("total_expected_loss", sa.Float()),
        sa.Column("total_exposure", sa.Float()),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now()),
    )
    op.create_index(
        "ix_risk_posture_snapshots_snapshot_date",
        "risk_posture_snapshots",
        ["snapshot_date"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_risk_posture_snapshots_snapshot_date", table_name="risk_posture_snapshots")
    op.drop_table("risk_posture_snapshots")
