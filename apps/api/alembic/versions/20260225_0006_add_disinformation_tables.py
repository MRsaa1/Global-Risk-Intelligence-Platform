"""Add disinformation tables: sources, posts, campaigns.

Revision ID: 20260225_0006
Revises: 20260225_0005
Create Date: 2026-02-25

"""
from alembic import op
import sqlalchemy as sa


revision = "20260225_0006"
down_revision = "20260225_0005"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "disinformation_sources",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("source_type", sa.String(50), nullable=False),
        sa.Column("url_pattern", sa.String(512), nullable=True),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "disinformation_campaigns",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("post_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("risk_score_avg", sa.Float(), nullable=True),
        sa.Column("risk_panic_elevated", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=True),
    )
    op.create_table(
        "disinformation_posts",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("source_id", sa.String(36), sa.ForeignKey("disinformation_sources.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("external_id", sa.String(255), nullable=True, index=True),
        sa.Column("url", sa.String(1024), nullable=True),
        sa.Column("title", sa.String(512), nullable=True),
        sa.Column("content", sa.Text(), nullable=True),
        sa.Column("language", sa.String(10), nullable=True, server_default="en"),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("label_bot", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("label_coordinated", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("label_fake", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("sentiment_score", sa.Float(), nullable=True),
        sa.Column("topics", sa.Text(), nullable=True),
        sa.Column("risk_score", sa.Float(), nullable=True),
        sa.Column("campaign_id", sa.String(36), nullable=True, index=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("analyzed_at", sa.DateTime(timezone=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("disinformation_posts")
    op.drop_table("disinformation_campaigns")
    op.drop_table("disinformation_sources")
