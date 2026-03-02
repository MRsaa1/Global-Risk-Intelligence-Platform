"""Add SRO Phase 1.3 tables: markets, exposures, scenarios, simulation runs, audit log.

Revision ID: 20260205_0001
Revises: 20260130_0003
Create Date: 2026-02-05

Tables: sro_markets, sro_institution_exposures, sro_scenarios, sro_simulation_runs, sro_audit_log
Extends sro_institutions with gsib_score, tier1_capital_ratio, liquidity_coverage_ratio
"""
from alembic import op
import sqlalchemy as sa


revision = "20260205_0001"
down_revision = "20260130_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add columns to sro_institutions for full ontology
    op.add_column(
        "sro_institutions",
        sa.Column("gsib_score", sa.Float(), nullable=True, comment="G-SIB systemically important bank score"),
    )
    op.add_column(
        "sro_institutions",
        sa.Column("tier1_capital_ratio", sa.Float(), nullable=True, comment="Tier 1 capital ratio (pct)"),
    )
    op.add_column(
        "sro_institutions",
        sa.Column("liquidity_coverage_ratio", sa.Float(), nullable=True, comment="LCR (Liquidity Coverage Ratio)"),
    )

    # sro_markets
    op.create_table(
        "sro_markets",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("market_id", sa.String(100), unique=True, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("asset_class", sa.String(50), nullable=False),
        sa.Column("market_structure", sa.String(50), default="centralized_exchange"),
        sa.Column("daily_volume_usd", sa.Float()),
        sa.Column("bid_ask_spread", sa.Float()),
        sa.Column("market_depth", sa.Float()),
        sa.Column("concentration_hhi", sa.Float()),
        sa.Column("circuit_breaker_thresholds", sa.Text()),
        sa.Column("central_counterparty", sa.String(100)),
        sa.Column("country_code", sa.String(2)),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), onupdate=sa.func.now()),
    )

    # sro_institution_exposures (links institutions to CIP, SCSS, or market)
    op.create_table(
        "sro_institution_exposures",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("institution_id", sa.String(36), sa.ForeignKey("sro_institutions.id", ondelete="CASCADE"), index=True),
        sa.Column("target_type", sa.String(50), nullable=False),
        sa.Column("target_id", sa.String(100), nullable=False, index=True),
        sa.Column("exposure_amount_usd", sa.Float()),
        sa.Column("sector_concentration", sa.Float()),
        sa.Column("description", sa.Text()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_sro_exposures_institution_target", "sro_institution_exposures", ["institution_id", "target_type", "target_id"])

    # sro_scenarios
    op.create_table(
        "sro_scenarios",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("scenario_id", sa.String(100), unique=True, index=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("definition_yaml", sa.Text()),
        sa.Column("initial_shocks", sa.Text()),
        sa.Column("transmission_channels", sa.Text()),
        sa.Column("interventions", sa.Text()),
        sa.Column("is_active", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), onupdate=sa.func.now()),
    )

    # sro_simulation_runs
    op.create_table(
        "sro_simulation_runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("run_id", sa.String(100), unique=True, index=True),
        sa.Column("scenario_id", sa.String(36), sa.ForeignKey("sro_scenarios.id", ondelete="SET NULL"), index=True),
        sa.Column("results_json", sa.Text()),
        sa.Column("monte_carlo_runs", sa.Integer()),
        sa.Column("percentiles", sa.Text()),
        sa.Column("critical_path", sa.Text()),
        sa.Column("status", sa.String(50), default="completed"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("created_by", sa.String(36)),
    )

    # sro_audit_log (immutable)
    op.create_table(
        "sro_audit_log",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("log_hash", sa.String(64), nullable=False, index=True),
        sa.Column("action_type", sa.String(50), nullable=False),
        sa.Column("scenario_id", sa.String(36)),
        sa.Column("scenario_snapshot", sa.Text()),
        sa.Column("results_snapshot", sa.Text()),
        sa.Column("decisions_snapshot", sa.Text()),
        sa.Column("user_id", sa.String(36)),
        sa.Column("user_role", sa.String(50)),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("sro_audit_log")
    op.drop_table("sro_simulation_runs")
    op.drop_table("sro_scenarios")
    op.drop_index("ix_sro_exposures_institution_target", table_name="sro_institution_exposures")
    op.drop_table("sro_institution_exposures")
    op.drop_table("sro_markets")

    op.drop_column("sro_institutions", "liquidity_coverage_ratio")
    op.drop_column("sro_institutions", "tier1_capital_ratio")
    op.drop_column("sro_institutions", "gsib_score")
