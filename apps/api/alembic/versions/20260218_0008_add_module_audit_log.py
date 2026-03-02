"""Add module_audit_log table for strategic module audit trail.

Revision ID: 20260218_0008
Revises: 20260218_0007
Create Date: 2026-02-18

"""
from alembic import op
import sqlalchemy as sa


revision = "20260218_0008"
down_revision = "20260218_0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "module_audit_log",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("module_id", sa.String(32), nullable=False, index=True),
        sa.Column("action", sa.String(64), nullable=False, index=True),
        sa.Column("entity_type", sa.String(64), nullable=True, index=True),
        sa.Column("entity_id", sa.String(128), nullable=True, index=True),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("changed_at", sa.DateTime(), nullable=False, index=True),
        sa.Column("changed_by", sa.String(128), nullable=True),
    )
    op.create_index(
        "ix_module_audit_log_module_changed_at",
        "module_audit_log",
        ["module_id", "changed_at"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_module_audit_log_module_changed_at", table_name="module_audit_log")
    op.drop_table("module_audit_log")
