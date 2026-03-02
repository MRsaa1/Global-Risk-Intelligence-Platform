"""Add SCSS Phase 5 (sync) and Phase 6 (compliance, audit) tables.

Revision ID: 20260130_0003
Revises: 20260130_0002
Create Date: 2026-01-30

Tables: scss_sync_config, scss_sync_runs, scss_import_audit, scss_audit_log, scss_sanctions_matches
"""
from alembic import op
import sqlalchemy as sa


revision = "20260130_0003"
down_revision = "20260130_0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Phase 5: Sync configuration
    op.create_table(
        "scss_sync_config",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("adapter_type", sa.String(50), nullable=False, comment="sap, oracle, edi, manual"),
        sa.Column("cron_expression", sa.String(100), comment="e.g. 0 */15 * * * for every 15 min"),
        sa.Column("webhook_url", sa.String(500)),
        sa.Column("config_json", sa.Text, comment="Adapter-specific settings"),
        sa.Column("is_enabled", sa.Boolean(), default=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), onupdate=sa.func.now()),
    )

    # Phase 5: Sync run history
    op.create_table(
        "scss_sync_runs",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("config_id", sa.String(36), sa.ForeignKey("scss_sync_config.id", ondelete="SET NULL")),
        sa.Column("started_at", sa.DateTime(), nullable=False),
        sa.Column("finished_at", sa.DateTime()),
        sa.Column("status", sa.String(20), nullable=False, comment="running, success, partial, failed"),
        sa.Column("records_created", sa.Integer(), default=0),
        sa.Column("records_updated", sa.Integer(), default=0),
        sa.Column("records_failed", sa.Integer(), default=0),
        sa.Column("message", sa.Text),
        sa.Column("details_json", sa.Text),
    )
    op.create_index("ix_scss_sync_runs_started_at", "scss_sync_runs", ["started_at"])
    op.create_index("ix_scss_sync_runs_config_id", "scss_sync_runs", ["config_id"])

    # Phase 5: Import audit (per-entity log for each sync run)
    op.create_table(
        "scss_import_audit",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("sync_run_id", sa.String(36), sa.ForeignKey("scss_sync_runs.id", ondelete="CASCADE")),
        sa.Column("entity_type", sa.String(50), nullable=False, comment="supplier, route"),
        sa.Column("entity_id", sa.String(36)),
        sa.Column("action", sa.String(20), nullable=False, comment="created, updated, failed"),
        sa.Column("details_json", sa.Text),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_scss_import_audit_sync_run_id", "scss_import_audit", ["sync_run_id"])
    op.create_index("ix_scss_import_audit_entity", "scss_import_audit", ["entity_type", "entity_id"])

    # Phase 6: Audit trail (who changed what: supplier, scenario, export)
    op.create_table(
        "scss_audit_log",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("entity_type", sa.String(50), nullable=False, comment="supplier, route, risk, scenario, export"),
        sa.Column("entity_id", sa.String(36)),
        sa.Column("action", sa.String(50), nullable=False, comment="create, update, delete, simulate, export"),
        sa.Column("changed_by", sa.String(255)),
        sa.Column("changed_at", sa.DateTime(), nullable=False),
        sa.Column("details_json", sa.Text),
    )
    op.create_index("ix_scss_audit_log_entity", "scss_audit_log", ["entity_type", "entity_id"])
    op.create_index("ix_scss_audit_log_changed_at", "scss_audit_log", ["changed_at"])

    # Phase 6: Sanctions screening matches
    op.create_table(
        "scss_sanctions_matches",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("supplier_id", sa.String(36), sa.ForeignKey("scss_suppliers.id", ondelete="CASCADE"), nullable=False),
        sa.Column("list_name", sa.String(100), nullable=False, comment="OFAC SDN, EU Consolidated"),
        sa.Column("list_source", sa.String(50), nullable=False, comment="OFAC, EU"),
        sa.Column("matched_name", sa.String(255)),
        sa.Column("match_score", sa.Float(), comment="0-1 similarity"),
        sa.Column("status", sa.String(20), default="pending", comment="pending, reviewed, cleared"),
        sa.Column("reviewed_by", sa.String(255)),
        sa.Column("reviewed_at", sa.DateTime()),
        sa.Column("notes", sa.Text),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
    )
    op.create_index("ix_scss_sanctions_matches_supplier_id", "scss_sanctions_matches", ["supplier_id"])
    op.create_index("ix_scss_sanctions_matches_status", "scss_sanctions_matches", ["status"])


def downgrade() -> None:
    op.drop_table("scss_sanctions_matches")
    op.drop_table("scss_audit_log")
    op.drop_table("scss_import_audit")
    op.drop_table("scss_sync_runs")
    op.drop_table("scss_sync_config")
