"""Add resolved_alert_keys table so Resolve survives reload and multi-worker.

Revision ID: 20260227_0001
Revises: 20260225_0009
Create Date: 2026-02-27

"""
from alembic import op
import sqlalchemy as sa

revision = "20260227_0001"
down_revision = "20260225_0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "resolved_alert_keys",
        sa.Column("dedup_key", sa.String(512), primary_key=True),
        sa.Column("resolved_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("resolved_alert_keys")
