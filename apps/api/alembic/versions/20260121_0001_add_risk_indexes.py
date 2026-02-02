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
from sqlalchemy.exc import OperationalError


# revision identifiers, used by Alembic.
revision: str = '20260121_0001'
down_revision: Union[str, None] = '20260117_0001'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _create_index_if_not_exists(index_name: str, table_name: str, columns: list, **kw) -> None:
    """Create index; ignore 'already exists' or 'no such column' (schema may differ on existing DBs)."""
    try:
        op.create_index(index_name, table_name, columns, unique=False, **kw)
    except OperationalError as e:
        err = str(e).lower()
        if "already exists" in err:
            pass  # index was already created by table DDL
        elif "no such column" in err:
            pass  # table on server may lack this column (e.g. older stress_tests)
        else:
            raise


def upgrade() -> None:
    """Add performance indexes."""
    
    # ==================== ASSETS INDEXES ====================
    
    # Composite index on risk scores for analytics queries
    _create_index_if_not_exists(
        'ix_assets_risk_scores',
        'assets',
        ['climate_risk_score', 'physical_risk_score', 'network_risk_score'],
        postgresql_using='btree',
    )
    
    # Index on city for location filtering (may already exist from initial schema)
    _create_index_if_not_exists('ix_assets_city', 'assets', ['city'])
    
    # Index on country code for regional queries (may already exist from initial schema)
    _create_index_if_not_exists('ix_assets_country_code', 'assets', ['country_code'])
    
    # Index on status for filtering active assets
    _create_index_if_not_exists('ix_assets_status', 'assets', ['status'])
    
    # Index on valuation for financial queries
    _create_index_if_not_exists('ix_assets_valuation', 'assets', ['current_valuation'])
    
    # Index on asset type for type-based filtering
    _create_index_if_not_exists('ix_assets_type', 'assets', ['asset_type'])
    
    # Composite index for common query pattern: status + city
    _create_index_if_not_exists('ix_assets_status_city', 'assets', ['status', 'city'])
    
    # Composite index for risk-based queries on active assets
    _create_index_if_not_exists('ix_assets_status_climate_risk', 'assets', ['status', 'climate_risk_score'])
    
    # ==================== STRESS TESTS INDEXES ====================
    
    _create_index_if_not_exists('ix_stress_tests_status', 'stress_tests', ['status'])
    _create_index_if_not_exists('ix_stress_tests_type', 'stress_tests', ['test_type'])
    _create_index_if_not_exists('ix_stress_tests_completed_at', 'stress_tests', ['completed_at'])
    
    # ==================== RISK ZONES INDEXES ====================
    
    _create_index_if_not_exists('ix_risk_zones_stress_test_id', 'risk_zones', ['stress_test_id'])
    _create_index_if_not_exists('ix_risk_zones_zone_level', 'risk_zones', ['zone_level'])


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
