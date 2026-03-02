revision = "0003_create_event_entities_and_links"
down_revision = "0002_create_raw_and_normalized"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID as PGUUID


def upgrade() -> None:
    op.create_table(
        "event_entities",
        sa.Column("event_uid", PGUUID(as_uuid=True), primary_key=True),
        sa.Column("canonical_event_type", sa.Text(), nullable=False),
        sa.Column("canonical_title", sa.Text(), nullable=True),
        sa.Column("start_date", sa.Date(), nullable=True),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("country_iso2", sa.String(2), nullable=True),
        sa.Column("region", sa.Text(), nullable=True),
        sa.Column("city", sa.Text(), nullable=True),
        sa.Column("lat", sa.Float(), nullable=True),
        sa.Column("lon", sa.Float(), nullable=True),
        sa.Column("best_source", sa.Text(), nullable=False),
        sa.Column("source_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_event_entities_canonical_event_type", "event_entities", ["canonical_event_type"])
    op.create_index("ix_event_entities_start_date", "event_entities", ["start_date"])
    op.create_index("ix_event_entities_country_iso2", "event_entities", ["country_iso2"])

    op.create_table(
        "event_entity_links",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("event_uid", PGUUID(as_uuid=True), sa.ForeignKey("event_entities.event_uid"), nullable=False),
        sa.Column("source_name", sa.Text(), nullable=False),
        sa.Column("source_record_id", sa.Text(), nullable=False),
    )
    op.create_unique_constraint(
        "uq_event_entity_links_uid_src_rec",
        "event_entity_links",
        ["event_uid", "source_name", "source_record_id"],
    )
    op.create_index("ix_event_entity_links_event_uid", "event_entity_links", ["event_uid"])
    op.create_index("ix_event_entity_links_source", "event_entity_links", ["source_name", "source_record_id"])


def downgrade() -> None:
    op.drop_table("event_entity_links")
    op.drop_table("event_entities")
