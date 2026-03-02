"""Add LPR tables: lpr_entities, lpr_appearances, lpr_metrics.

Revision ID: 20260225_0005
Revises: 20260225_0004
Create Date: 2026-02-25

"""
from alembic import op
import sqlalchemy as sa


revision = "20260225_0005"
down_revision = "20260225_0004"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "lpr_entities",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("external_id", sa.String(255), nullable=True, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("entity_type", sa.String(50), nullable=False, server_default="person"),
        sa.Column("role", sa.String(255), nullable=True),
        sa.Column("region", sa.String(100), nullable=True),
        sa.Column("doctrine_ref", sa.Text(), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("extra_data", sa.Text(), nullable=True),
    )
    op.create_table(
        "lpr_appearances",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("entity_id", sa.String(36), sa.ForeignKey("lpr_entities.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("source_type", sa.String(50), nullable=False, server_default="video"),
        sa.Column("source_url", sa.String(1024), nullable=True),
        sa.Column("title", sa.String(512), nullable=True),
        sa.Column("occurred_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("transcript", sa.Text(), nullable=True),
        sa.Column("storage_key", sa.String(512), nullable=True),
        sa.Column("language", sa.String(10), nullable=True, server_default="en"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("extra_data", sa.Text(), nullable=True),
    )
    op.create_table(
        "lpr_metrics",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("appearance_id", sa.String(36), sa.ForeignKey("lpr_appearances.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("pace_wpm", sa.Float(), nullable=True),
        sa.Column("pause_ratio", sa.Float(), nullable=True),
        sa.Column("stress_score", sa.Float(), nullable=True),
        sa.Column("emotion_scores", sa.Text(), nullable=True),
        sa.Column("topics", sa.Text(), nullable=True),
        sa.Column("contradiction_flag", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("course_change_flag", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("doctrine_notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("extra_data", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("lpr_metrics")
    op.drop_table("lpr_appearances")
    op.drop_table("lpr_entities")
