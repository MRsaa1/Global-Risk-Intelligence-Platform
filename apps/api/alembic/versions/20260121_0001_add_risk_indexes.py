"""Add performance indexes for risk scores and location fields

Revision ID: 20260121_0001
Revises: 20260117_0001_week7_8_features
Create Date: 2026-01-21

Indexes added:
- ix_assets_risk_scores: Composite index on climate, physical, network risk scores
- ix_assets_city: Index on city field for location-based queries
- ix_assets_country: Index on country_code field
- ix_assets_status: Index on status field for filtering active assets
- ix_assets_valuation: Index on current_valuation for financial queries
- ix_stress_tests_status: Index on stress test status
- ix_stress_tests_type: Index on stress test type
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260121_0001'
down_revision: Union[str, None] = '20260117_0001_week7_8_features'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add performance indexes."""
    
    # ==================== ASSETS INDEXES ====================
    
    # Composite index on risk scores for analytics queries
    # Used by: /analytics/risk-trends, /analytics/risk-distribution
    op.create_index(
        'ix_assets_risk_scores',
        'assets',
        ['climate_risk_score', 'physical_risk_score', 'network_risk_score'],
        unique=False,
        postgresql_using='btree',
    )
    
    # Index on city for location filtering
    # Used by: asset search, geographic filtering
    op.create_index(
        'ix_assets_city',
        'assets',
        ['city'],
        unique=False,
    )
    
    # Index on country code for regional queries
    # Used by: portfolio by region, regulatory reports
    op.create_index(
        'ix_assets_country_code',
        'assets',
        ['country_code'],
        unique=False,
    )
    
    # Index on status for filtering active assets
    # Used by: nearly all asset queries filter by status='active'
    op.create_index(
        'ix_assets_status',
        'assets',
        ['status'],
        unique=False,
    )
    
    # Index on valuation for financial queries
    # Used by: portfolio summary, top assets by value
    op.create_index(
        'ix_assets_valuation',
        'assets',
        ['current_valuation'],
        unique=False,
    )
    
    # Index on asset type for type-based filtering
    # Used by: asset filtering by type
    op.create_index(
        'ix_assets_type',
        'assets',
        ['asset_type'],
        unique=False,
    )
    
    # Composite index for common query pattern: status + city
    op.create_index(
        'ix_assets_status_city',
        'assets',
        ['status', 'city'],
        unique=False,
    )
    
    # Composite index for risk-based queries on active assets
    op.create_index(
        'ix_assets_status_climate_risk',
        'assets',
        ['status', 'climate_risk_score'],
        unique=False,
    )
    
    # ==================== STRESS TESTS INDEXES ====================
    
    # Index on stress test status for filtering
    # Used by: listing active/completed tests
    op.create_index(
        'ix_stress_tests_status',
        'stress_tests',
        ['status'],
        unique=False,
    )
    
    # Index on test type for type-based filtering
    op.create_index(
        'ix_stress_tests_type',
        'stress_tests',
        ['test_type'],
        unique=False,
    )
    
    # Index on completed_at for recent tests query
    op.create_index(
        'ix_stress_tests_completed_at',
        'stress_tests',
        ['completed_at'],
        unique=False,
    )
    
    # ==================== RISK ZONES INDEXES ====================
    
    # Index on stress_test_id for zone lookups by test
    op.create_index(
        'ix_risk_zones_stress_test_id',
        'risk_zones',
        ['stress_test_id'],
        unique=False,
    )
    
    # Index on zone level for filtering
    op.create_index(
        'ix_risk_zones_zone_level',
        'risk_zones',
        ['zone_level'],
        unique=False,
    )


def downgrade() -> None:
    """Remove performance indexes."""
    
    # Risk zones indexes
    op.drop_index('ix_risk_zones_zone_level', table_name='risk_zones')
    op.drop_index('ix_risk_zones_stress_test_id', table_name='risk_zones')
    
    # Stress tests indexes
    op.drop_index('ix_stress_tests_completed_at', table_name='stress_tests')
    op.drop_index('ix_stress_tests_type', table_name='stress_tests')
    op.drop_index('ix_stress_tests_status', table_name='stress_tests')
    
    # Assets indexes
    op.drop_index('ix_assets_status_climate_risk', table_name='assets')
    op.drop_index('ix_assets_status_city', table_name='assets')
    op.drop_index('ix_assets_type', table_name='assets')
    op.drop_index('ix_assets_valuation', table_name='assets')
    op.drop_index('ix_assets_status', table_name='assets')
    op.drop_index('ix_assets_country_code', table_name='assets')
    op.drop_index('ix_assets_city', table_name='assets')
    op.drop_index('ix_assets_risk_scores', table_name='assets')
