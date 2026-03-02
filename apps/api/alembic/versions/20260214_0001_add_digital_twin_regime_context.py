"""Add regime_context to digital_twins for regime-aware twin parameters (JSON)."""
from alembic import op
import sqlalchemy as sa

revision = "20260214_0001"
down_revision = "20260209_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "digital_twins",
        sa.Column("regime_context", sa.Text(), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("digital_twins", "regime_context")
