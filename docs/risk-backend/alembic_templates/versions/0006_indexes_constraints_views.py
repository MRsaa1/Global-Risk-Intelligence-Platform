revision = "0006_indexes_constraints_views"
down_revision = "0005_create_quality_fx_cpi"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    # CHECK: confidence in [0, 1] on normalized_events
    op.create_check_constraint(
        "ck_normalized_events_confidence",
        "normalized_events",
        "confidence >= 0 AND confidence <= 1",
    )
    # CHECK: q_score in [0, 1] on data_quality_scores
    op.create_check_constraint(
        "ck_data_quality_scores_q_score",
        "data_quality_scores",
        "q_score >= 0 AND q_score <= 1",
    )

    # Composite indexes for report/backtesting queries
    op.create_index(
        "ix_normalized_events_event_type_start_date",
        "normalized_events",
        ["event_type", "start_date"],
    )
    op.create_index(
        "ix_event_entities_country_type_start",
        "event_entities",
        ["country_iso2", "canonical_event_type", "start_date"],
    )
    op.create_index(
        "ix_event_losses_event_uid_loss_type",
        "event_losses",
        ["event_uid", "loss_type"],
    )

    # Materialized view for backtesting/report API (PostgreSQL only)
    op.execute(sa.text("""
        CREATE MATERIALIZED VIEW mv_event_backtesting AS
        SELECT
            e.event_uid,
            e.canonical_event_type,
            e.canonical_title,
            e.start_date,
            e.end_date,
            e.country_iso2,
            e.region,
            e.city,
            e.best_source,
            e.source_count,
            SUM(CASE WHEN l.loss_type = 'economic' THEN l.amount_usd_real ELSE 0 END) AS total_economic_usd_real,
            SUM(CASE WHEN l.loss_type = 'insured' THEN l.amount_usd_real ELSE 0 END) AS total_insured_usd_real
        FROM event_entities e
        LEFT JOIN event_losses l ON l.event_uid = e.event_uid
        GROUP BY e.event_uid, e.canonical_event_type, e.canonical_title,
                 e.start_date, e.end_date, e.country_iso2, e.region, e.city,
                 e.best_source, e.source_count
    """))
    op.create_index(
        "ix_mv_event_backtesting_country_type",
        "mv_event_backtesting",
        ["country_iso2", "canonical_event_type"],
    )
    op.create_index("ix_mv_event_backtesting_start_date", "mv_event_backtesting", ["start_date"])


def downgrade() -> None:
    op.execute(sa.text("DROP MATERIALIZED VIEW IF EXISTS mv_event_backtesting"))
    op.drop_index("ix_event_losses_event_uid_loss_type", table_name="event_losses")
    op.drop_index("ix_event_entities_country_type_start", table_name="event_entities")
    op.drop_index("ix_normalized_events_event_type_start_date", table_name="normalized_events")
    op.drop_constraint("ck_data_quality_scores_q_score", "data_quality_scores", type_="check")
    op.drop_constraint("ck_normalized_events_confidence", "normalized_events", type_="check")
