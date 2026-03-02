"""Add agent_message_log table for optional MessageBus persistence.

Revision ID: 20260225_0009
Revises: 20260225_0008
Create Date: 2026-02-25

"""
from alembic import op
import sqlalchemy as sa

revision = "20260225_0009"
down_revision = "20260225_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agent_message_log",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("message_id", sa.String(32), nullable=False, index=True),
        sa.Column("correlation_id", sa.String(64), nullable=False, index=True),
        sa.Column("sender", sa.String(64), nullable=False),
        sa.Column("recipient", sa.String(64), nullable=False),
        sa.Column("message_type", sa.String(64), nullable=False),
        sa.Column("payload_summary", sa.Text(), nullable=True),
        sa.Column("timestamp", sa.DateTime(), server_default=sa.func.now(), index=True),
        sa.Column("replied", sa.Boolean(), server_default=sa.false(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("agent_message_log")
