"""Add agent_audit_log table (Phase C4).

Revision ID: 20260218_0007
Revises: 20260218_0006
Create Date: 2026-02-18
"""
from alembic import op
import sqlalchemy as sa


revision = "20260218_0007"
down_revision = "20260218_0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agent_audit_log",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("source", sa.String(64), nullable=False, index=True),
        sa.Column("agent_id", sa.String(64), nullable=False, index=True),
        sa.Column("action_type", sa.String(128), nullable=False, index=True),
        sa.Column("input_summary", sa.Text(), nullable=True),
        sa.Column("result_summary", sa.Text(), nullable=True),
        sa.Column("input_payload_hash", sa.String(64), nullable=True),
        sa.Column("output_payload_hash", sa.String(64), nullable=True),
        sa.Column("timestamp", sa.DateTime(), server_default=sa.func.now(), index=True),
        sa.Column("meta", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("agent_audit_log")
