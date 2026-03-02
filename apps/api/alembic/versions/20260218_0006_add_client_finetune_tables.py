"""Add client fine-tuning tables (Phase C3).

Revision ID: 20260218_0006
Revises: 20260218_0005
Create Date: 2026-02-18

Tables: client_finetune_datasets, client_finetune_runs
"""
from alembic import op
import sqlalchemy as sa


revision = "20260218_0006"
down_revision = "20260218_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "client_finetune_datasets",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, index=True),
        sa.Column("path", sa.String(512), nullable=False),
        sa.Column("size", sa.Integer(), nullable=True),
        sa.Column("status", sa.String(20), server_default="ready", index=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_table(
        "client_finetune_runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("dataset_id", sa.String(36), sa.ForeignKey("client_finetune_datasets.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("status", sa.String(20), server_default="pending", index=True),
        sa.Column("model_path_or_id", sa.String(512), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("client_finetune_runs")
    op.drop_table("client_finetune_datasets")
