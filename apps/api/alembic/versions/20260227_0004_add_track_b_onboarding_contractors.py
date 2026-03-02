"""Track B: municipal_onboarding_requests, municipal_contractors.

Revision ID: 20260227_0004
Revises: 20260227_0003
Create Date: 2026-02-27

- municipal_onboarding_requests: onboarding flow for municipalities (Track B 5K–50K).
- municipal_contractors: contractors linked to municipality/tenant for Track B.
"""
from alembic import op
import sqlalchemy as sa

revision = "20260227_0004"
down_revision = "20260227_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "municipal_onboarding_requests",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("municipality_name", sa.String(200), nullable=False, index=True),
        sa.Column("population", sa.Integer(), nullable=True),
        sa.Column("country_code", sa.String(2), nullable=True),
        sa.Column("contact_email", sa.String(255), nullable=True),
        sa.Column("contact_name", sa.String(200), nullable=True),
        sa.Column("status", sa.String(30), server_default="pending", index=True),
        sa.Column("requested_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )
    op.create_table(
        "municipal_contractors",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("tenant_id", sa.String(100), nullable=False, index=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("contractor_type", sa.String(50), nullable=True),
        sa.Column("contact_info", sa.Text(), nullable=True),
        sa.Column("status", sa.String(20), server_default="active", index=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    op.drop_table("municipal_contractors")
    op.drop_table("municipal_onboarding_requests")
