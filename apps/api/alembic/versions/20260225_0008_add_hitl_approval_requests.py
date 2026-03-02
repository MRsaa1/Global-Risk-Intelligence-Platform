"""Add hitl_approval_requests table for optional HITL persistence.

Revision ID: 20260225_0008
Revises: 20260225_0007
Create Date: 2026-02-25

"""
from alembic import op
import sqlalchemy as sa

revision = "20260225_0008"
down_revision = "20260225_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "hitl_approval_requests",
        sa.Column("gate_id", sa.String(32), primary_key=True),
        sa.Column("workflow_run_id", sa.String(64), nullable=False, index=True),
        sa.Column("step_name", sa.String(128), nullable=False),
        sa.Column("agent", sa.String(64), nullable=False),
        sa.Column("severity", sa.String(32), nullable=False),
        sa.Column("payload", sa.Text(), nullable=True),
        sa.Column("status", sa.String(32), nullable=False, server_default="pending", index=True),
        sa.Column("decision_by", sa.String(128), nullable=True),
        sa.Column("decision_reason", sa.Text(), nullable=True),
        sa.Column("modifications", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now(), nullable=True),
        sa.Column("decided_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("hitl_approval_requests")
