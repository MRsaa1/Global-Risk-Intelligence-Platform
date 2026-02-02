"""Add SCSS and SRO module tables.

Revision ID: 20260124_0002
Revises: 20260124_0001
Create Date: 2026-01-24

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260124_0002'
down_revision = '20260124_0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ==========================================
    # SCSS (Supply Chain Sovereignty System) Tables
    # ==========================================
    
    # Suppliers table
    op.create_table(
        'scss_suppliers',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('scss_id', sa.String(100), unique=True, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        
        # Classification
        sa.Column('supplier_type', sa.String(50), default='other'),
        sa.Column('tier', sa.String(20), default='tier_1'),
        
        # Location
        sa.Column('country_code', sa.String(2), default='DE'),
        sa.Column('region', sa.String(100)),
        sa.Column('city', sa.String(100)),
        sa.Column('latitude', sa.Float),
        sa.Column('longitude', sa.Float),
        
        # Business Info
        sa.Column('industry_sector', sa.String(100)),
        sa.Column('annual_revenue', sa.Float),
        sa.Column('employee_count', sa.Integer),
        sa.Column('founded_year', sa.Integer),
        
        # Scores
        sa.Column('sovereignty_score', sa.Float),
        sa.Column('geopolitical_risk', sa.Float),
        sa.Column('concentration_risk', sa.Float),
        sa.Column('financial_stability', sa.Float),
        
        # Supply Metrics
        sa.Column('lead_time_days', sa.Integer),
        sa.Column('on_time_delivery_pct', sa.Float),
        sa.Column('quality_score', sa.Float),
        
        # Status
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('is_critical', sa.Boolean, default=False),
        sa.Column('has_alternative', sa.Boolean, default=False),
        
        # Extra
        sa.Column('extra_data', sa.Text),
        sa.Column('tags', sa.Text),
        
        # Audit
        sa.Column('created_at', sa.DateTime),
        sa.Column('updated_at', sa.DateTime),
        sa.Column('created_by', sa.String(36)),
    )
    
    # Supply Routes table
    op.create_table(
        'scss_routes',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('source_id', sa.String(36), sa.ForeignKey('scss_suppliers.id', ondelete='CASCADE'), index=True),
        sa.Column('target_id', sa.String(36), index=True),
        sa.Column('target_type', sa.String(50), default='supplier'),
        
        # Route characteristics
        sa.Column('transport_mode', sa.String(50)),
        sa.Column('distance_km', sa.Float),
        sa.Column('transit_time_days', sa.Integer),
        
        # Risk
        sa.Column('route_risk_score', sa.Float),
        sa.Column('chokepoint_exposure', sa.Float),
        
        # Volume
        sa.Column('annual_volume', sa.Float),
        sa.Column('annual_value', sa.Float),
        
        # Status
        sa.Column('is_primary', sa.Boolean, default=True),
        sa.Column('has_backup', sa.Boolean, default=False),
        
        sa.Column('description', sa.Text),
        sa.Column('created_at', sa.DateTime),
    )
    
    # Supply Chain Risks table
    op.create_table(
        'scss_risks',
        sa.Column('id', sa.String(36), primary_key=True),
        
        # Classification
        sa.Column('risk_type', sa.String(50)),
        sa.Column('risk_level', sa.String(20), default='medium'),
        
        # Description
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        
        # Affected entities
        sa.Column('affected_supplier_ids', sa.Text),
        sa.Column('affected_routes', sa.Text),
        sa.Column('affected_region', sa.String(100)),
        
        # Impact
        sa.Column('probability', sa.Float),
        sa.Column('impact_score', sa.Float),
        sa.Column('estimated_loss', sa.Float),
        
        # Mitigation
        sa.Column('mitigation_status', sa.String(50), default='identified'),
        sa.Column('mitigation_plan', sa.Text),
        
        # Timeline
        sa.Column('identified_at', sa.DateTime),
        sa.Column('resolved_at', sa.DateTime),
        
        sa.Column('created_by', sa.String(36)),
    )
    
    # ==========================================
    # SRO (Systemic Risk Observatory) Tables
    # ==========================================
    
    # Financial Institutions table
    op.create_table(
        'sro_institutions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('sro_id', sa.String(100), unique=True, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        
        # Classification
        sa.Column('institution_type', sa.String(50), default='other'),
        sa.Column('systemic_importance', sa.String(20), default='low'),
        
        # Location
        sa.Column('country_code', sa.String(2), default='DE'),
        sa.Column('headquarters_city', sa.String(100)),
        
        # Financial Metrics
        sa.Column('total_assets', sa.Float),
        sa.Column('total_liabilities', sa.Float),
        sa.Column('tier1_capital', sa.Float),
        sa.Column('market_cap', sa.Float),
        
        # Risk Scores
        sa.Column('systemic_risk_score', sa.Float),
        sa.Column('contagion_risk', sa.Float),
        sa.Column('interconnectedness_score', sa.Float),
        sa.Column('leverage_ratio', sa.Float),
        sa.Column('liquidity_ratio', sa.Float),
        
        # Regulatory
        sa.Column('regulator', sa.String(100)),
        sa.Column('lei_code', sa.String(20)),
        
        # Status
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('under_stress', sa.Boolean, default=False),
        
        sa.Column('extra_data', sa.Text),
        
        # Audit
        sa.Column('created_at', sa.DateTime),
        sa.Column('updated_at', sa.DateTime),
        sa.Column('created_by', sa.String(36)),
    )
    
    # Risk Correlations table
    op.create_table(
        'sro_correlations',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('institution_a_id', sa.String(36), sa.ForeignKey('sro_institutions.id', ondelete='CASCADE'), index=True),
        sa.Column('institution_b_id', sa.String(36), sa.ForeignKey('sro_institutions.id', ondelete='CASCADE'), index=True),
        
        # Metrics
        sa.Column('correlation_coefficient', sa.Float, default=0.0),
        sa.Column('exposure_amount', sa.Float),
        sa.Column('contagion_probability', sa.Float),
        
        # Relationship
        sa.Column('relationship_type', sa.String(50), default='counterparty'),
        
        # Time
        sa.Column('calculation_date', sa.DateTime),
        sa.Column('lookback_days', sa.Integer, default=252),
        
        sa.Column('description', sa.Text),
        sa.Column('created_at', sa.DateTime),
    )
    
    # Systemic Risk Indicators table
    op.create_table(
        'sro_indicators',
        sa.Column('id', sa.String(36), primary_key=True),
        
        # Classification
        sa.Column('indicator_type', sa.String(50), index=True),
        sa.Column('indicator_name', sa.String(255), nullable=False),
        
        # Scope
        sa.Column('scope', sa.String(50), default='market'),
        sa.Column('institution_id', sa.String(36), sa.ForeignKey('sro_institutions.id', ondelete='CASCADE')),
        
        # Value
        sa.Column('value', sa.Float),
        sa.Column('previous_value', sa.Float),
        sa.Column('change_pct', sa.Float),
        
        # Thresholds
        sa.Column('warning_threshold', sa.Float),
        sa.Column('critical_threshold', sa.Float),
        sa.Column('is_breached', sa.Boolean, default=False),
        
        # Time
        sa.Column('observation_date', sa.DateTime, index=True),
        
        sa.Column('data_source', sa.String(100)),
        sa.Column('created_at', sa.DateTime),
    )
    
    # Create indexes
    op.create_index('ix_scss_suppliers_type_country', 'scss_suppliers', ['supplier_type', 'country_code'])
    op.create_index('ix_sro_institutions_type_importance', 'sro_institutions', ['institution_type', 'systemic_importance'])
    op.create_index('ix_sro_indicators_type_date', 'sro_indicators', ['indicator_type', 'observation_date'])


def downgrade() -> None:
    op.drop_index('ix_sro_indicators_type_date', table_name='sro_indicators')
    op.drop_index('ix_sro_institutions_type_importance', table_name='sro_institutions')
    op.drop_index('ix_scss_suppliers_type_country', table_name='scss_suppliers')
    
    op.drop_table('sro_indicators')
    op.drop_table('sro_correlations')
    op.drop_table('sro_institutions')
    op.drop_table('scss_risks')
    op.drop_table('scss_routes')
    op.drop_table('scss_suppliers')
