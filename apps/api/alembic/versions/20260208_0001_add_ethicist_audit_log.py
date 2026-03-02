"""Add Ethicist immutable audit log and human review (ARIN / Ethicist section 9).

Tables: ethicist_audit_log (cryptographic_signature, immutable_log_reference),
       human_review_requests (human-in-the-loop escalation).
"""
from alembic import op
import sqlalchemy as sa

revision = "20260208_0001"
down_revision = "20260206_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "ethicist_audit_log",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("decision_id", sa.String(64), nullable=False),
        sa.Column("prev_hash", sa.String(64)),
        sa.Column("cryptographic_signature", sa.String(64), nullable=False),
        sa.Column("payload_hash", sa.String(64), nullable=False),
        sa.Column("payload", sa.Text),
        sa.Column("immutable_log_reference", sa.String(256)),
        sa.Column("source_module", sa.String(64)),
        sa.Column("created_at", sa.DateTime),
    )
    op.create_index("ix_ethicist_audit_log_decision_id", "ethicist_audit_log", ["decision_id"])

    op.create_table(
        "human_review_requests",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("decision_id", sa.String(64), nullable=False),
        sa.Column("source_module", sa.String(64)),
        sa.Column("object_type", sa.String(64)),
        sa.Column("object_id", sa.String(128)),
        sa.Column("escalation_reason", sa.String(128)),
        sa.Column("decision_snapshot", sa.Text),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime),
        sa.Column("resolved_at", sa.DateTime),
        sa.Column("resolved_by", sa.String(128)),
        sa.Column("resolution_note", sa.Text),
    )
    op.create_index("ix_human_review_requests_decision_id", "human_review_requests", ["decision_id"], unique=True)
    op.create_index("ix_human_review_requests_status", "human_review_requests", ["status"])


def downgrade() -> None:
    op.drop_index("ix_human_review_requests_status", table_name="human_review_requests")
    op.drop_index("ix_human_review_requests_decision_id", table_name="human_review_requests")
    op.drop_table("human_review_requests")
    op.drop_index("ix_ethicist_audit_log_decision_id", table_name="ethicist_audit_log")
    op.drop_table("ethicist_audit_log")
