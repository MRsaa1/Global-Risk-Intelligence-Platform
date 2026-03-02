"""Add event_entities.source_record_id if missing, or create all external risk tables if missing.

Revision ID: 20260301_0001
Revises: 20260227_0002
Create Date: 2026-03-01

Fixes:
- NoSuchTableError: event_entities — when 20260227_0002 was stamped but never run; creates all tables.
- no such column: event_entities.source_record_id — adds column and index when table exists without it.
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.exc import NoSuchTableError

revision = "20260301_0001"
down_revision = "20260227_0002"
branch_labels = None
depends_on = None


def _create_all_external_risk_tables() -> None:
    """Create tables from 20260227_0002 when they were never created (stamp-only)."""
    conn = op.get_bind()
    insp = sa.inspect(conn)

    def has_table(name: str) -> bool:
        try:
            return name in insp.get_table_names()
        except Exception:
            return False

    # 1) Raw source records
    if not has_table("raw_source_records"):
        op.create_table(
            "raw_source_records",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("source_name", sa.String(64), nullable=False),
            sa.Column("source_record_id", sa.String(512), nullable=False),
            sa.Column("fetched_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("payload", sa.JSON(), nullable=False),
            sa.Column("checksum", sa.String(64), nullable=False),
            sa.UniqueConstraint(
                "source_name", "source_record_id", "checksum",
                name="uq_raw_source_records_source_record_checksum",
            ),
        )
        op.create_index("ix_raw_source_records_source_name", "raw_source_records", ["source_name"])

    # 2) Normalized events
    if not has_table("normalized_events"):
        op.create_table(
            "normalized_events",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("source_name", sa.String(64), nullable=False),
            sa.Column("source_record_id", sa.String(512), nullable=False),
            sa.Column("event_type", sa.String(64), nullable=False),
            sa.Column("event_subtype", sa.String(64), nullable=True),
            sa.Column("title", sa.String(1024), nullable=True),
            sa.Column("start_date", sa.Date(), nullable=True),
            sa.Column("end_date", sa.Date(), nullable=True),
            sa.Column("country_iso2", sa.String(2), nullable=True),
            sa.Column("region", sa.String(255), nullable=True),
            sa.Column("city", sa.String(255), nullable=True),
            sa.Column("lat", sa.Float(), nullable=True),
            sa.Column("lon", sa.Float(), nullable=True),
            sa.Column("geo_precision", sa.String(32), nullable=True),
            sa.Column("fatalities", sa.Numeric(18, 2), nullable=True),
            sa.Column("affected", sa.Numeric(18, 2), nullable=True),
            sa.Column("confidence", sa.Numeric(3, 2), nullable=False, server_default="0.7"),
            sa.Column("inserted_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.UniqueConstraint("source_name", "source_record_id", name="uq_normalized_events_source_record"),
        )
        op.create_index("ix_normalized_events_source_name", "normalized_events", ["source_name"])
        op.create_index("ix_normalized_events_event_type", "normalized_events", ["event_type"])
        op.create_index("ix_normalized_events_start_date", "normalized_events", ["start_date"])
        op.create_index("ix_normalized_events_country_iso2", "normalized_events", ["country_iso2"])

    # 3) Event entities (with source_record_id)
    if not has_table("event_entities"):
        op.create_table(
            "event_entities",
            sa.Column("event_uid", sa.String(36), primary_key=True),
            sa.Column("canonical_event_type", sa.String(64), nullable=False),
            sa.Column("canonical_title", sa.String(1024), nullable=True),
            sa.Column("start_date", sa.Date(), nullable=True),
            sa.Column("end_date", sa.Date(), nullable=True),
            sa.Column("country_iso2", sa.String(2), nullable=True),
            sa.Column("region", sa.String(255), nullable=True),
            sa.Column("city", sa.String(255), nullable=True),
            sa.Column("lat", sa.Float(), nullable=True),
            sa.Column("lon", sa.Float(), nullable=True),
            sa.Column("best_source", sa.String(64), nullable=False),
            sa.Column("source_count", sa.Integer(), nullable=False, server_default="1"),
            sa.Column("source_record_id", sa.String(512), nullable=True),
            sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_event_entities_source_record", "event_entities", ["best_source", "source_record_id"])
        op.create_index("ix_event_entities_canonical_event_type", "event_entities", ["canonical_event_type"])
        op.create_index("ix_event_entities_start_date", "event_entities", ["start_date"])
        op.create_index("ix_event_entities_country_iso2", "event_entities", ["country_iso2"])

    # 4) Event losses
    if not has_table("event_losses"):
        op.create_table(
            "event_losses",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("event_uid", sa.String(36), sa.ForeignKey("event_entities.event_uid"), nullable=False),
            sa.Column("loss_type", sa.String(32), nullable=False),
            sa.Column("amount_original", sa.Numeric(24, 2), nullable=True),
            sa.Column("currency_original", sa.String(3), nullable=True),
            sa.Column("amount_usd_nominal", sa.Numeric(24, 2), nullable=True),
            sa.Column("amount_usd_real", sa.Numeric(24, 2), nullable=True),
            sa.Column("base_year", sa.Integer(), nullable=False),
            sa.Column("source_name", sa.String(64), nullable=False),
            sa.Column("confidence", sa.Numeric(3, 2), nullable=False, server_default="0.7"),
        )
        op.create_index("ix_event_losses_event_uid", "event_losses", ["event_uid"])
        op.create_index("ix_event_losses_loss_type", "event_losses", ["loss_type"])

    # 5) Event impacts
    if not has_table("event_impacts"):
        op.create_table(
            "event_impacts",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("event_uid", sa.String(36), sa.ForeignKey("event_entities.event_uid"), nullable=False),
            sa.Column("casualties", sa.Numeric(18, 2), nullable=True),
            sa.Column("displaced", sa.Numeric(18, 2), nullable=True),
            sa.Column("infra_damage_score", sa.Numeric(5, 2), nullable=True),
            sa.Column("sector", sa.String(64), nullable=True),
            sa.Column("source_name", sa.String(64), nullable=False),
            sa.Column("confidence", sa.Numeric(3, 2), nullable=False, server_default="0.7"),
        )
        op.create_index("ix_event_impacts_event_uid", "event_impacts", ["event_uid"])

    # 6) Event recovery
    if not has_table("event_recovery"):
        op.create_table(
            "event_recovery",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("event_uid", sa.String(36), sa.ForeignKey("event_entities.event_uid"), nullable=False),
            sa.Column("duration_days", sa.Numeric(10, 2), nullable=True),
            sa.Column("recovery_time_months", sa.Numeric(10, 2), nullable=True),
            sa.Column("rto_days", sa.Numeric(10, 2), nullable=True),
            sa.Column("rpo_hours", sa.Numeric(10, 2), nullable=True),
            sa.Column("source_name", sa.String(64), nullable=False),
            sa.Column("confidence", sa.Numeric(3, 2), nullable=False, server_default="0.7"),
        )
        op.create_index("ix_event_recovery_event_uid", "event_recovery", ["event_uid"])

    # 7) Source registry
    if not has_table("source_registry"):
        op.create_table(
            "source_registry",
            sa.Column("source_name", sa.String(64), primary_key=True),
            sa.Column("domain", sa.String(64), nullable=False),
            sa.Column("license_type", sa.String(32), nullable=True),
            sa.Column("refresh_frequency", sa.String(32), nullable=False),
            sa.Column("priority_rank", sa.Integer(), nullable=False),
            sa.Column("active", sa.Boolean(), nullable=False, server_default="1"),
            sa.Column("tos_url", sa.String(2048), nullable=True),
            sa.Column("storage_restrictions", sa.Text(), nullable=True),
            sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_source_registry_domain", "source_registry", ["domain"])
        op.create_index("ix_source_registry_active", "source_registry", ["active"])

    # 8) FX and CPI
    if not has_table("fx_rates"):
        op.create_table(
            "fx_rates",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("currency_from", sa.String(3), nullable=False),
            sa.Column("currency_to", sa.String(3), nullable=False, server_default="USD"),
            sa.Column("rate", sa.Numeric(18, 6), nullable=False),
            sa.Column("as_of_date", sa.Date(), nullable=False),
            sa.Column("source", sa.String(64), nullable=True),
            sa.UniqueConstraint("currency_from", "currency_to", "as_of_date", name="uq_fx_rates_ccy_date"),
        )

    if not has_table("cpi_index"):
        op.create_table(
            "cpi_index",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("country_iso2", sa.String(2), nullable=False),
            sa.Column("year", sa.Integer(), nullable=False),
            sa.Column("index_value", sa.Numeric(12, 4), nullable=False),
            sa.Column("base_year", sa.Integer(), nullable=True),
            sa.UniqueConstraint("country_iso2", "year", name="uq_cpi_index_country_year"),
        )

    # 9) Processing runs
    if not has_table("processing_runs"):
        op.create_table(
            "processing_runs",
            sa.Column("run_id", sa.String(36), primary_key=True),
            sa.Column("source_name", sa.String(64), nullable=False),
            sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
            sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
            sa.Column("status", sa.String(32), nullable=False),
            sa.Column("dataset_version", sa.String(64), nullable=False),
            sa.Column("row_count", sa.Integer(), nullable=True, server_default="0"),
            sa.Column("error_count", sa.Integer(), nullable=True, server_default="0"),
            sa.Column("config_snapshot", sa.JSON(), nullable=True),
        )
        op.create_index("ix_processing_runs_source_name", "processing_runs", ["source_name"])
        op.create_index("ix_processing_runs_dataset_version", "processing_runs", ["dataset_version"])

    # 10) Data quality scores
    if not has_table("data_quality_scores"):
        op.create_table(
            "data_quality_scores",
            sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
            sa.Column("entity_type", sa.String(64), nullable=False),
            sa.Column("entity_id", sa.String(128), nullable=False),
            sa.Column("q_score", sa.Numeric(3, 2), nullable=False),
            sa.Column("completeness", sa.Numeric(3, 2), nullable=True),
            sa.Column("source_trust", sa.Numeric(3, 2), nullable=True),
            sa.Column("freshness", sa.Numeric(3, 2), nullable=True),
            sa.Column("consistency", sa.Numeric(3, 2), nullable=True),
            sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        )
        op.create_index("ix_data_quality_scores_entity", "data_quality_scores", ["entity_type", "entity_id"])


def upgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    try:
        cols = [c["name"] for c in insp.get_columns("event_entities")]
    except NoSuchTableError:
        # Tables were never created (20260227_0002 was stamped but not run) — create all
        _create_all_external_risk_tables()
        return
    if "source_record_id" not in cols:
        op.add_column(
            "event_entities",
            sa.Column("source_record_id", sa.String(512), nullable=True),
        )
        op.create_index(
            "ix_event_entities_source_record",
            "event_entities",
            ["best_source", "source_record_id"],
        )


def downgrade() -> None:
    conn = op.get_bind()
    insp = sa.inspect(conn)
    try:
        cols = [c["name"] for c in insp.get_columns("event_entities")]
    except NoSuchTableError:
        return
    if "source_record_id" in cols:
        op.drop_index("ix_event_entities_source_record", table_name="event_entities")
        op.drop_column("event_entities", "source_record_id")
