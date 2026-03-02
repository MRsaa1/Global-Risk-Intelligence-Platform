revision = "0005_create_quality_fx_cpi"
down_revision = "0004_create_losses_impacts_recovery"
branch_labels = None
depends_on = None

from alembic import op
import sqlalchemy as sa


def upgrade() -> None:
    op.create_table(
        "data_quality_scores",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("entity_type", sa.Text(), nullable=False),
        sa.Column("entity_id", sa.Text(), nullable=False),
        sa.Column("q_score", sa.Numeric(3, 2), nullable=False),
        sa.Column("completeness", sa.Numeric(3, 2), nullable=True),
        sa.Column("source_trust", sa.Numeric(3, 2), nullable=True),
        sa.Column("freshness", sa.Numeric(3, 2), nullable=True),
        sa.Column("consistency", sa.Numeric(3, 2), nullable=True),
        sa.Column("computed_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.text("now()")),
    )
    op.create_index("ix_data_quality_scores_entity", "data_quality_scores", ["entity_type", "entity_id"])

    op.create_table(
        "fx_rates",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("currency_from", sa.String(3), nullable=False),
        sa.Column("currency_to", sa.String(3), nullable=False, server_default="USD"),
        sa.Column("rate", sa.Numeric(18, 6), nullable=False),
        sa.Column("as_of_date", sa.Date(), nullable=False),
        sa.Column("source", sa.Text(), nullable=True),
    )
    op.create_unique_constraint("uq_fx_rates_ccy_date", "fx_rates", ["currency_from", "currency_to", "as_of_date"])

    op.create_table(
        "cpi_index",
        sa.Column("id", sa.BigInteger(), primary_key=True, autoincrement=True),
        sa.Column("country_iso2", sa.String(2), nullable=False),
        sa.Column("year", sa.Integer(), nullable=False),
        sa.Column("index_value", sa.Numeric(12, 4), nullable=False),
        sa.Column("base_year", sa.Integer(), nullable=True),
    )
    op.create_unique_constraint("uq_cpi_index_country_year", "cpi_index", ["country_iso2", "year"])


def downgrade() -> None:
    op.drop_table("cpi_index")
    op.drop_table("fx_rates")
    op.drop_table("data_quality_scores")
