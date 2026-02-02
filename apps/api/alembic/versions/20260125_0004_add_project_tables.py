"""Add project finance tables.

Revision ID: 20260125_0004
Revises: 20260125_0003
Create Date: 2026-01-25
"""
from alembic import op
import sqlalchemy as sa

revision = '20260125_0004'
down_revision = '20260125_0003'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create projects and project_phases tables."""
    
    # Projects
    op.create_table(
        'projects',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('code', sa.String(50), unique=True, nullable=True),
        sa.Column('project_type', sa.String(50), default='commercial'),
        sa.Column('status', sa.String(50), default='development'),
        sa.Column('currency', sa.String(3), default='EUR'),
        sa.Column('total_capex_planned', sa.Float(), nullable=True),
        sa.Column('total_capex_actual', sa.Float(), nullable=True),
        sa.Column('annual_opex_planned', sa.Float(), nullable=True),
        sa.Column('annual_opex_actual', sa.Float(), nullable=True),
        sa.Column('annual_revenue_projected', sa.Float(), nullable=True),
        sa.Column('irr', sa.Float(), nullable=True),
        sa.Column('npv', sa.Float(), nullable=True),
        sa.Column('payback_period_years', sa.Float(), nullable=True),
        sa.Column('primary_asset_id', sa.String(36), sa.ForeignKey('assets.id', ondelete='SET NULL'), nullable=True),
        sa.Column('linked_asset_ids', sa.Text(), nullable=True),
        sa.Column('country_code', sa.String(2), default='DE'),
        sa.Column('region', sa.String(100), nullable=True),
        sa.Column('city', sa.String(100), nullable=True),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('target_completion_date', sa.Date(), nullable=True),
        sa.Column('actual_completion_date', sa.Date(), nullable=True),
        sa.Column('operation_start_date', sa.Date(), nullable=True),
        sa.Column('overall_completion_pct', sa.Float(), nullable=True),
        sa.Column('risk_score', sa.Float(), nullable=True),
        sa.Column('risk_factors', sa.Text(), nullable=True),
        sa.Column('owner_id', sa.String(36), nullable=True),
        sa.Column('sponsor_name', sa.String(255), nullable=True),
        sa.Column('extra_data', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', sa.String(36), nullable=True),
    )
    
    # Project Phases
    op.create_table(
        'project_phases',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('phase_type', sa.String(50), default='construction'),
        sa.Column('sequence_number', sa.Integer(), default=1),
        sa.Column('start_date', sa.Date(), nullable=True),
        sa.Column('end_date', sa.Date(), nullable=True),
        sa.Column('actual_start_date', sa.Date(), nullable=True),
        sa.Column('actual_end_date', sa.Date(), nullable=True),
        sa.Column('completion_pct', sa.Float(), default=0),
        sa.Column('capex_planned', sa.Float(), nullable=True),
        sa.Column('capex_actual', sa.Float(), nullable=True),
        sa.Column('opex_annual_planned', sa.Float(), nullable=True),
        sa.Column('opex_annual_actual', sa.Float(), nullable=True),
        sa.Column('cost_variance_pct', sa.Float(), nullable=True),
        sa.Column('schedule_variance_days', sa.Integer(), nullable=True),
        sa.Column('milestones', sa.Text(), nullable=True),
        sa.Column('dependencies', sa.Text(), nullable=True),
        sa.Column('extra_data', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    """Drop project tables."""
    op.drop_table('project_phases')
    op.drop_table('projects')
