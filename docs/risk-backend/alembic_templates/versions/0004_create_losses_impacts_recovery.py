revision = "0004_create_losses_impacts_recovery"
down_revision = "0003_create_event_entities_and_links"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PGUUID


def upgrade() -> None:
    op.create_table(
        "event_losses",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("event_uid", PGUUID(as_uuid=True), sa.ForeignKey("event_entities.event_uid"), nullable=False),
        sa.Column("loss_type", sa.Text(), nullable=False),
        sa.Column("amount_original", sa.Numeric(), nullable=True),
        sa.Column("currency_original", sa.String(3), nullable=True),
        sa.Column("amount_usd_nominal", sa.Numeric(), nullable=True),
        sa.Column("amount_usd_real", sa.Numeric(), nullable=True),
        sa.Column("base_year", sa.Integer(), nullable=False),
        sa.Column("source_name", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Numeric(), nullable=False, server_default="0.7"),
    )
    op.create_index("ix_event_losses_event_uid", "event_losses", ["event_uid"])
    op.create_index("ix_event_losses_loss_type", "event_losses", ["loss_type"])

    op.create_table(
        "event_impacts",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("event_uid", PGUUID(as_uuid=True), sa.ForeignKey("event_entities.event_uid"), nullable=False),
        sa.Column("casualties", sa.Numeric(), nullable=True),
        sa.Column("displaced", sa.Numeric(), nullable=True),
        sa.Column("infra_damage_score", sa.Numeric(), nullable=True),
        sa.Column("sector", sa.Text(), nullable=True),
        sa.Column("source_name", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Numeric(), nullable=False, server_default="0.7"),
    )
    op.create_index("ix_event_impacts_event_uid", "event_impacts", ["event_uid"])

    op.create_table(
        "event_recovery",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("event_uid", PGUUID(as_uuid=True), sa.ForeignKey("event_entities.event_uid"), nullable=False),
        sa.Column("duration_days", sa.Numeric(), nullable=True),
        sa.Column("recovery_time_months", sa.Numeric(), nullable=True),
        sa.Column("rto_days", sa.Numeric(), nullable=True),
        sa.Column("rpo_hours", sa.Numeric(), nullable=True),
        sa.Column("source_name", sa.Text(), nullable=False),
        sa.Column("confidence", sa.Numeric(), nullable=False, server_default="0.7"),
    )
    op.create_index("ix_event_recovery_event_uid", "event_recovery", ["event_uid"])


def downgrade() -> None:
    op.drop_table("event_recovery")
    op.drop_table("event_impacts")
    op.drop_table("event_losses")
