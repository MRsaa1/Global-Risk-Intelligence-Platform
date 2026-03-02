"""Add ASGI Phase 3 tables.

Capability Emergence, Goal Drift, Cryptographic Audit, Multi-Jurisdiction Compliance.
Tables: asgi_ai_systems, asgi_capability_events, asgi_goal_drift_snapshots,
       asgi_audit_anchors, asgi_compliance_frameworks
"""
from alembic import op
import sqlalchemy as sa


revision = "20260206_0001"
down_revision = "20260205_0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Base: AI System Registry (required for capability/drift references)
    op.create_table(
        "asgi_ai_systems",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("version", sa.String(50)),
        sa.Column("system_type", sa.String(50)),
        sa.Column("capability_level", sa.String(20)),
        sa.Column("created_at", sa.DateTime),
        sa.Column("updated_at", sa.DateTime),
    )

    # Capability emergence events
    op.create_table(
        "asgi_capability_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("ai_system_id", sa.Integer(), sa.ForeignKey("asgi_ai_systems.id", ondelete="CASCADE")),
        sa.Column("event_type", sa.String(50)),
        sa.Column("metrics", sa.Text),
        sa.Column("severity", sa.Integer()),
        sa.Column("response_action", sa.String(50)),
        sa.Column("response_at", sa.DateTime),
        sa.Column("responded_by", sa.String(200)),
        sa.Column("created_at", sa.DateTime),
    )
    op.create_index("ix_asgi_capability_events_ai_system_id", "asgi_capability_events", ["ai_system_id"])

    # Goal drift snapshots
    op.create_table(
        "asgi_goal_drift_snapshots",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("ai_system_id", sa.Integer(), sa.ForeignKey("asgi_ai_systems.id", ondelete="CASCADE")),
        sa.Column("snapshot_date", sa.Date()),
        sa.Column("plan_embedding", sa.Text),
        sa.Column("constraint_set", sa.Text),
        sa.Column("objective_hash", sa.LargeBinary()),
        sa.Column("drift_from_baseline", sa.Float()),
        sa.Column("created_at", sa.DateTime),
    )
    op.create_index("ix_asgi_goal_drift_snapshots_ai_system_id", "asgi_goal_drift_snapshots", ["ai_system_id"])

    # Cryptographic audit: event hash chain + anchors
    op.create_table(
        "asgi_audit_events",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("event_hash", sa.String(64), nullable=False),
        sa.Column("prev_hash", sa.String(64)),
        sa.Column("content", sa.Text),
        sa.Column("created_at", sa.DateTime),
    )
    op.create_table(
        "asgi_audit_anchors",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("merkle_root", sa.LargeBinary(), nullable=False),
        sa.Column("event_count", sa.Integer()),
        sa.Column("anchor_type", sa.String(20)),
        sa.Column("anchor_reference", sa.Text),
        sa.Column("created_at", sa.DateTime),
    )

    # Multi-jurisdiction compliance frameworks
    op.create_table(
        "asgi_compliance_frameworks",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("framework_code", sa.String(50), unique=True),
        sa.Column("name", sa.String(200)),
        sa.Column("jurisdiction", sa.String(100)),
        sa.Column("requirements", sa.Text),
        sa.Column("mapping_to_asgi", sa.Text),
        sa.Column("effective_date", sa.Date()),
        sa.Column("last_updated", sa.DateTime),
    )


def downgrade() -> None:
    op.drop_table("asgi_compliance_frameworks")
    op.drop_table("asgi_audit_anchors")
    op.drop_table("asgi_audit_events")
    op.drop_index("ix_asgi_goal_drift_snapshots_ai_system_id", table_name="asgi_goal_drift_snapshots")
    op.drop_table("asgi_goal_drift_snapshots")
    op.drop_index("ix_asgi_capability_events_ai_system_id", table_name="asgi_capability_events")
    op.drop_table("asgi_capability_events")
    op.drop_table("asgi_ai_systems")
