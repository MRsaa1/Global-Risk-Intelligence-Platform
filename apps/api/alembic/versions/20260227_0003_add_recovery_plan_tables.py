"""Add recovery_plans, recovery_indicators, recovery_measures (BCP linked to stress).

Revision ID: 20260227_0003
Revises: 20260301_0001
Create Date: 2026-02-27

RecoveryPlan: BCP linked to stress_test_id.
RecoveryIndicator: KPIs/milestones for recovery tracking.
RecoveryMeasure: Actions (preventive/detective/corrective).
Idempotent: skips create_table if table already exists.
"""
from alembic import op
import sqlalchemy as sa

revision = "20260227_0003"
down_revision = "20260301_0001"
branch_labels = None
depends_on = None


def _has_table(name: str) -> bool:
    conn = op.get_bind()
    return name in sa.inspect(conn).get_table_names()


def upgrade() -> None:
    if not _has_table("recovery_plans"):
        op.create_table(
            "recovery_plans",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("stress_test_id", sa.String(36), sa.ForeignKey("stress_tests.id", ondelete="SET NULL"), nullable=True),
            sa.Column("rto_hours", sa.Float(), nullable=True),
            sa.Column("rpo_hours", sa.Float(), nullable=True),
            sa.Column("status", sa.String(32), nullable=False, server_default="draft"),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
            sa.Column("created_by", sa.String(36), nullable=True),
        )
        op.create_index("ix_recovery_plans_stress_test_id", "recovery_plans", ["stress_test_id"])
        op.create_index("ix_recovery_plans_status", "recovery_plans", ["status"])

    if not _has_table("recovery_indicators"):
        op.create_table(
            "recovery_indicators",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("recovery_plan_id", sa.String(36), sa.ForeignKey("recovery_plans.id", ondelete="CASCADE"), nullable=False),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("indicator_type", sa.String(32), nullable=False, server_default="kpi"),
            sa.Column("target_value", sa.Float(), nullable=True),
            sa.Column("current_value", sa.Float(), nullable=True),
            sa.Column("unit", sa.String(64), nullable=True),
            sa.Column("frequency", sa.String(32), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_recovery_indicators_recovery_plan_id", "recovery_indicators", ["recovery_plan_id"])

    if not _has_table("recovery_measures"):
        op.create_table(
            "recovery_measures",
            sa.Column("id", sa.String(36), primary_key=True),
            sa.Column("recovery_plan_id", sa.String(36), sa.ForeignKey("recovery_plans.id", ondelete="CASCADE"), nullable=False),
            sa.Column("name", sa.String(255), nullable=False),
            sa.Column("description", sa.Text(), nullable=True),
            sa.Column("category", sa.String(32), nullable=False, server_default="corrective"),
            sa.Column("priority", sa.String(20), nullable=False, server_default="medium"),
            sa.Column("status", sa.String(32), nullable=False, server_default="pending"),
            sa.Column("due_date", sa.DateTime(), nullable=True),
            sa.Column("responsible_role", sa.String(255), nullable=True),
            sa.Column("created_at", sa.DateTime(), nullable=True),
            sa.Column("updated_at", sa.DateTime(), nullable=True),
        )
        op.create_index("ix_recovery_measures_recovery_plan_id", "recovery_measures", ["recovery_plan_id"])
        op.create_index("ix_recovery_measures_status", "recovery_measures", ["status"])


def downgrade() -> None:
    if _has_table("recovery_measures"):
        op.drop_index("ix_recovery_measures_status", table_name="recovery_measures")
        op.drop_index("ix_recovery_measures_recovery_plan_id", table_name="recovery_measures")
        op.drop_table("recovery_measures")
    if _has_table("recovery_indicators"):
        op.drop_index("ix_recovery_indicators_recovery_plan_id", table_name="recovery_indicators")
        op.drop_table("recovery_indicators")
    if _has_table("recovery_plans"):
        op.drop_index("ix_recovery_plans_status", table_name="recovery_plans")
        op.drop_index("ix_recovery_plans_stress_test_id", table_name="recovery_plans")
        op.drop_table("recovery_plans")
