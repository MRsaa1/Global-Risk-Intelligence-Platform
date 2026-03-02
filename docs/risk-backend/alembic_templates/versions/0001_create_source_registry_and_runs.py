revision = "0001_create_source_registry_and_runs"
down_revision = "20260227_0001"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.create_table(
        "source_registry",
        sa.Column("source_name", sa.Text(), primary_key=True),
        sa.Column("domain", sa.Text(), nullable=False),
        sa.Column("license_type", sa.Text(), nullable=True),
        sa.Column("refresh_frequency", sa.Text(), nullable=False),
        sa.Column("priority_rank", sa.Integer(), nullable=False),
        sa.Column("active", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("tos_url", sa.Text(), nullable=True),
        sa.Column("storage_restrictions", sa.Text(), nullable=True),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_source_registry_domain", "source_registry", ["domain"])
    op.create_index("ix_source_registry_active", "source_registry", ["active"])

    op.create_table(
        "processing_runs",
        sa.Column("run_id", sa.String(36), primary_key=True),
        sa.Column("source_name", sa.Text(), nullable=False),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("status", sa.Text(), nullable=False),
        sa.Column("dataset_version", sa.Text(), nullable=False),
        sa.Column("row_count", sa.Integer(), server_default="0"),
        sa.Column("error_count", sa.Integer(), server_default="0"),
        sa.Column("config_snapshot", sa.JSON(), nullable=True),
    )
    op.create_index("ix_processing_runs_source_name", "processing_runs", ["source_name"])
    op.create_index("ix_processing_runs_dataset_version", "processing_runs", ["dataset_version"])


def downgrade() -> None:
    op.drop_table("processing_runs")
    op.drop_table("source_registry")
