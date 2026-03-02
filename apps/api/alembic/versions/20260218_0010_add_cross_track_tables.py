"""Add field_observations and calibration_results for Cross-Track Synergy.

Revision ID: 20260218_0010
Revises: 20260218_0009
Create Date: 2026-02-18

"""
from alembic import op
import sqlalchemy as sa


revision = "20260218_0010"
down_revision = "20260218_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "field_observations",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=True),
        sa.Column("city", sa.String(255), nullable=False, index=True),
        sa.Column("h3_cell", sa.String(32), nullable=True, index=True),
        sa.Column("observation_type", sa.String(64), nullable=False, index=True),
        sa.Column("predicted_severity", sa.Float(), nullable=False),
        sa.Column("observed_severity", sa.Float(), nullable=False),
        sa.Column("predicted_loss_m", sa.Float(), nullable=True),
        sa.Column("observed_loss_m", sa.Float(), nullable=True),
        sa.Column("adaptation_measure_id", sa.String(64), nullable=True),
        sa.Column("adaptation_effectiveness_observed", sa.Float(), nullable=True),
        sa.Column("population_affected", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("stress_test_id", sa.String(64), nullable=True, index=True),
    )
    op.create_table(
        "calibration_results",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("timestamp", sa.DateTime(timezone=True), nullable=True),
        sa.Column("model_name", sa.String(64), nullable=False, index=True),
        sa.Column("observations_used", sa.Integer(), nullable=False),
        sa.Column("mean_absolute_error", sa.Float(), nullable=False),
        sa.Column("bias", sa.Float(), nullable=False),
        sa.Column("r_squared", sa.Float(), nullable=False),
        sa.Column("recalibration_factor", sa.Float(), nullable=False),
        sa.Column("recommendation", sa.Text(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("calibration_results")
    op.drop_table("field_observations")
