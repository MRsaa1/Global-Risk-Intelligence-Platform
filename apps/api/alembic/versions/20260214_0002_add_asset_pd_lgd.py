"""Add probability_of_default and loss_given_default to assets for regime-aware twin base."""
from alembic import op
import sqlalchemy as sa

revision = "20260214_0002"
down_revision = "20260214_0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "assets",
        sa.Column(
            "probability_of_default",
            sa.Float(),
            nullable=True,
            comment="Base PD 0..1 for stress/regime overlay (e.g. from credit model)",
        ),
    )
    op.add_column(
        "assets",
        sa.Column(
            "loss_given_default",
            sa.Float(),
            nullable=True,
            comment="Base LGD 0..1 for stress/regime overlay",
        ),
    )


def downgrade() -> None:
    op.drop_column("assets", "loss_given_default")
    op.drop_column("assets", "probability_of_default")
