"""Add portfolio and REIT tables.

Revision ID: 20260126_0001
Revises: 20260125_0004
Create Date: 2026-01-26
"""
from alembic import op
import sqlalchemy as sa

revision = '20260126_0001'
down_revision = '20260125_0004'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create portfolios and portfolio_assets tables."""
    
    # Portfolios
    op.create_table(
        'portfolios',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('code', sa.String(50), unique=True, nullable=True),
        sa.Column('portfolio_type', sa.String(50), default='custom'),
        sa.Column('owner_id', sa.String(36), nullable=True),
        sa.Column('manager_name', sa.String(255), nullable=True),
        sa.Column('base_currency', sa.String(3), default='EUR'),
        sa.Column('inception_date', sa.Date(), nullable=True),
        sa.Column('nav', sa.Float(), nullable=True),
        sa.Column('nav_per_share', sa.Float(), nullable=True),
        sa.Column('ffo', sa.Float(), nullable=True),
        sa.Column('affo', sa.Float(), nullable=True),
        sa.Column('yield_pct', sa.Float(), nullable=True),
        sa.Column('dividend_per_share', sa.Float(), nullable=True),
        sa.Column('total_debt', sa.Float(), nullable=True),
        sa.Column('total_equity', sa.Float(), nullable=True),
        sa.Column('debt_to_equity', sa.Float(), nullable=True),
        sa.Column('loan_to_value', sa.Float(), nullable=True),
        sa.Column('interest_coverage', sa.Float(), nullable=True),
        sa.Column('occupancy', sa.Float(), nullable=True),
        sa.Column('noi_annual', sa.Float(), nullable=True),
        sa.Column('cap_rate', sa.Float(), nullable=True),
        sa.Column('var_95', sa.Float(), nullable=True),
        sa.Column('climate_risk_score', sa.Float(), nullable=True),
        sa.Column('concentration_risk', sa.Float(), nullable=True),
        sa.Column('asset_count', sa.Integer(), default=0),
        sa.Column('total_gfa_m2', sa.Float(), nullable=True),
        sa.Column('benchmark_index', sa.String(100), nullable=True),
        sa.Column('ytd_return', sa.Float(), nullable=True),
        sa.Column('extra_data', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', sa.String(36), nullable=True),
    )
    
    # Portfolio Assets
    op.create_table(
        'portfolio_assets',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('portfolio_id', sa.String(36), sa.ForeignKey('portfolios.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('asset_id', sa.String(36), sa.ForeignKey('assets.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('share_pct', sa.Float(), default=100.0),
        sa.Column('acquisition_date', sa.Date(), nullable=True),
        sa.Column('acquisition_price', sa.Float(), nullable=True),
        sa.Column('current_value', sa.Float(), nullable=True),
        sa.Column('valuation_date', sa.Date(), nullable=True),
        sa.Column('target_irr', sa.Float(), nullable=True),
        sa.Column('actual_irr', sa.Float(), nullable=True),
        sa.Column('unrealized_gain_loss', sa.Float(), nullable=True),
        sa.Column('annual_noi', sa.Float(), nullable=True),
        sa.Column('annual_rent', sa.Float(), nullable=True),
        sa.Column('occupancy', sa.Float(), nullable=True),
        sa.Column('weight_pct', sa.Float(), nullable=True),
        sa.Column('investment_strategy', sa.String(50), nullable=True),
        sa.Column('hold_period_years', sa.Integer(), nullable=True),
        sa.Column('exit_date_target', sa.Date(), nullable=True),
        sa.Column('notes', sa.Text(), nullable=True),
        sa.Column('extra_data', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    """Drop portfolio tables."""
    op.drop_table('portfolio_assets')
    op.drop_table('portfolios')
