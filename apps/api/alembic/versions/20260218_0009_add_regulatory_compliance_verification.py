"""Add regulatory_documents, regulatory_document_chunks, compliance_verifications (real compliance verification).

Revision ID: 20260218_0009
Revises: 20260218_0008
Create Date: 2026-02-18

"""
from alembic import op
import sqlalchemy as sa


revision = "20260218_0009"
down_revision = "20260218_0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "regulatory_documents",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("framework_id", sa.String(64), nullable=False, index=True),
        sa.Column("jurisdiction", sa.String(32), nullable=False, index=True),
        sa.Column("title", sa.String(512), nullable=False),
        sa.Column("source_url", sa.String(1024), nullable=True),
        sa.Column("document_type", sa.String(32), nullable=False, server_default="summary"),
        sa.Column("file_path", sa.String(1024), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_table(
        "regulatory_document_chunks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("document_id", sa.String(36), sa.ForeignKey("regulatory_documents.id", ondelete="CASCADE"), nullable=False, index=True),
        sa.Column("article_id", sa.String(128), nullable=True, index=True),
        sa.Column("chunk_index", sa.Integer(), server_default="0"),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("embedding_vector", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=True),
    )
    op.create_index(
        "ix_regulatory_document_chunks_doc_article",
        "regulatory_document_chunks",
        ["document_id", "article_id"],
        unique=False,
    )
    op.create_table(
        "compliance_verifications",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("entity_id", sa.String(128), nullable=True, index=True),
        sa.Column("entity_type", sa.String(64), nullable=True, index=True),
        sa.Column("stress_test_id", sa.String(36), sa.ForeignKey("stress_tests.id", ondelete="SET NULL"), nullable=True, index=True),
        sa.Column("framework_id", sa.String(64), nullable=False, index=True),
        sa.Column("jurisdiction", sa.String(32), nullable=False, index=True),
        sa.Column("status", sa.String(32), nullable=False, index=True),
        sa.Column("checked_at", sa.DateTime(), server_default=sa.func.now(), index=True),
        sa.Column("checked_by_agent_id", sa.String(64), nullable=False, server_default="compliance_agent"),
        sa.Column("evidence_snapshot", sa.Text(), nullable=True),
        sa.Column("requirements_checked", sa.Text(), nullable=True),
        sa.Column("audit_log_id", sa.Integer(), nullable=True),
        sa.Column("reviewed_at", sa.DateTime(), nullable=True),
        sa.Column("reviewer_agent_id", sa.String(64), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("compliance_verifications")
    op.drop_index("ix_regulatory_document_chunks_doc_article", table_name="regulatory_document_chunks")
    op.drop_table("regulatory_document_chunks")
    op.drop_table("regulatory_documents")
