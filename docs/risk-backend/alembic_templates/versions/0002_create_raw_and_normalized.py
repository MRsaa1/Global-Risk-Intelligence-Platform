revision = "0002_create_raw_and_normalized"
down_revision = "0001_create_source_registry_and_runs"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql


def upgrade() -> None:
    op.create_table(
        "raw_source_records",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("source_name", sa.Text(), nullable=False),
        sa.Column("source_record_id", sa.Text(), nullable=False),
        sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("checksum", sa.Text(), nullable=False),
        sa.UniqueConstraint("source_name", "source_record_id", "checksum", name="uq_raw_src_rec_chk"),
    )
    op.create_index("ix_raw_source_records_source_name", "raw_source_records", ["source_name"])

    op.create_table(
        "normalized_events",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("source_name", sa.Text(), nullable=False),
        sa.Column("source_record_id", sa.Text(), nullable=False),
        sa.Column("event_type", sa.Text(), nullable=False),
        sa.Column("event_subtype", sa.Text(), nullable=True),
        sa.Column("title", sa.Text(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("country_iso2", sa.String(length=2), nullable=True),
        sa.Column("region", sa.Text(), nullable=True),
        sa.Column("city", sa.Text(), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lon", sa.Float(), nullable=True),
        sa.Column("geo_precision", sa.Text(), nullable=True),
        sa.Column("fatalities", sa.Numeric(), nullable=True),
        sa.Column("affected", sa.Numeric(), nullable=True),
        sa.Column("confidence", sa.Numeric(), nullable=False, server_default="0.7"),
        sa.Column("inserted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.UniqueConstraint("source_name", "source_record_id", name="uq_norm_src_rec"),
    )
    op.create_index("ix_normalized_events_source_name", "normalized_events", ["source_name"])
    op.create_index("ix_normalized_events_event_type", "normalized_events", ["event_type"])
    op.create_index("ix_normalized_events_country_iso2", "normalized_events", ["country_iso2"])


def downgrade() -> None:
    op.drop_table("normalized_events")
    op.drop_table("raw_source_records")
