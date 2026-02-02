"""Initial schema with PostGIS support

Revision ID: 001
Revises: 
Create Date: 2026-01-15

Creates all tables for Physical-Financial Risk Platform:
- users
- assets
- digital_twins, twin_timelines, twin_states
- data_provenance, verification_records
- stress_tests, risk_zones, zone_assets
- stress_test_reports, action_plans
- historical_events

Enables PostGIS extension for geographic queries.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geometry

# revision identifiers
revision: str = '001'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    is_pg = conn.dialect.name == 'postgresql'
    # For SQLite without SpatiaLite, geometry columns use Text (WKT/null)
    geom_type = Geometry('POINT', srid=4326) if is_pg else sa.Text()
    geom_poly_type = Geometry('POLYGON', srid=4326) if is_pg else sa.Text()

    # Enable PostGIS extension (PostgreSQL only; SQLite has no extensions)
    if is_pg:
        op.execute('CREATE EXTENSION IF NOT EXISTS postgis')
        op.execute('CREATE EXTENSION IF NOT EXISTS postgis_topology')

    # ============================================
    # USERS TABLE
    # ============================================
    op.create_table(
        'users',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('email', sa.String(255), unique=True, nullable=False, index=True),
        sa.Column('hashed_password', sa.String(255), nullable=False),
        sa.Column('full_name', sa.String(255)),
        sa.Column('organization', sa.String(255)),
        sa.Column('role', sa.String(50), default='user'),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('is_superuser', sa.Boolean(), default=False),
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('last_login', sa.DateTime()),
    )
    
    # ============================================
    # ASSETS TABLE
    # ============================================
    op.create_table(
        'assets',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('pars_id', sa.String(100), unique=True, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('asset_type', sa.String(50), nullable=False, index=True),
        sa.Column('status', sa.String(50), default='active'),
        
        # Location
        sa.Column('address_street', sa.String(500)),
        sa.Column('city', sa.String(100), index=True),
        sa.Column('postal_code', sa.String(20)),
        sa.Column('country_code', sa.String(3), index=True),
        sa.Column('latitude', sa.Float()),
        sa.Column('longitude', sa.Float()),
        
        # PostGIS geometry for spatial queries (SQLite: Text for WKT/null)
        sa.Column('location', geom_type),
        
        # Physical attributes
        sa.Column('year_built', sa.Integer()),
        sa.Column('gross_floor_area_m2', sa.Float()),
        sa.Column('floors_above_ground', sa.Integer()),
        sa.Column('floors_below_ground', sa.Integer()),
        sa.Column('primary_use', sa.String(50)),
        
        # Valuation
        sa.Column('current_valuation', sa.Float()),
        sa.Column('valuation_currency', sa.String(3), default='EUR'),
        sa.Column('valuation_date', sa.Date()),
        
        # Risk scores (0-100)
        sa.Column('climate_risk_score', sa.Float()),
        sa.Column('physical_risk_score', sa.Float()),
        sa.Column('network_risk_score', sa.Float()),
        
        # BIM/3D
        sa.Column('bim_file_path', sa.String(500)),
        sa.Column('ifc_guid', sa.String(36)),
        
        # Owner
        sa.Column('owner_id', sa.String(36), sa.ForeignKey('users.id', ondelete='SET NULL')),
        
        # Audit
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # Spatial index for assets (PostgreSQL GIST only)
    if is_pg:
        op.execute('CREATE INDEX IF NOT EXISTS idx_assets_location ON assets USING GIST (location)')

    # ============================================
    # HISTORICAL EVENTS TABLE
    # ============================================
    op.create_table(
        'historical_events',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text()),
        sa.Column('event_type', sa.String(50), index=True),
        
        # Temporal
        sa.Column('start_date', sa.Date()),
        sa.Column('end_date', sa.Date()),
        sa.Column('duration_days', sa.Integer()),
        
        # Geographic
        sa.Column('region_name', sa.String(255)),
        sa.Column('country_codes', sa.String(100)),
        sa.Column('center_latitude', sa.Float()),
        sa.Column('center_longitude', sa.Float()),
        sa.Column('affected_area_km2', sa.Float()),
        sa.Column('geographic_polygon', sa.Text()),
        
        # PostGIS geometry (SQLite: Text for WKT/null)
        sa.Column('boundary', geom_poly_type),
        sa.Column('center_point', geom_type),
        
        # Impact metrics
        sa.Column('severity_actual', sa.Float()),
        sa.Column('financial_loss_eur', sa.Float()),
        sa.Column('insurance_claims_eur', sa.Float()),
        sa.Column('affected_population', sa.Integer()),
        sa.Column('casualties', sa.Integer()),
        sa.Column('displaced_people', sa.Integer()),
        
        # Asset impact
        sa.Column('affected_assets_count', sa.Integer()),
        sa.Column('destroyed_assets_count', sa.Integer()),
        sa.Column('damaged_assets_count', sa.Integer()),
        
        # Recovery
        sa.Column('recovery_time_months', sa.Integer()),
        sa.Column('reconstruction_cost_eur', sa.Float()),
        
        # Risk multipliers
        sa.Column('pd_multiplier_observed', sa.Float()),
        sa.Column('lgd_multiplier_observed', sa.Float()),
        sa.Column('valuation_impact_pct_observed', sa.Float()),
        
        # Cascade effects (JSON)
        sa.Column('cascade_effects', sa.Text()),
        sa.Column('affected_sectors', sa.Text()),
        
        # Impact by organization type (JSON)
        sa.Column('impact_developers', sa.Text()),
        sa.Column('impact_insurers', sa.Text()),
        sa.Column('impact_military', sa.Text()),
        sa.Column('impact_banks', sa.Text()),
        sa.Column('impact_enterprises', sa.Text()),
        
        # Sources
        sa.Column('sources', sa.Text()),
        sa.Column('source_urls', sa.Text()),
        sa.Column('lessons_learned', sa.Text()),
        sa.Column('recommendations', sa.Text()),
        sa.Column('tags', sa.Text()),
        
        # Verification
        sa.Column('is_verified', sa.Boolean(), default=False),
        sa.Column('verified_by', sa.String(100)),
        sa.Column('verified_at', sa.DateTime()),
        
        # Audit
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('created_by', sa.String(36)),
    )
    
    # Spatial index for historical events (PostgreSQL GIST only)
    if is_pg:
        op.execute('CREATE INDEX IF NOT EXISTS idx_historical_events_boundary ON historical_events USING GIST (boundary)')

    # ============================================
    # STRESS TESTS TABLE
    # ============================================
    op.create_table(
        'stress_tests',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text()),
        
        # Classification
        sa.Column('test_type', sa.String(50), default='climate', index=True),
        sa.Column('status', sa.String(50), default='draft'),
        
        # Geographic scope
        sa.Column('center_latitude', sa.Float()),
        sa.Column('center_longitude', sa.Float()),
        sa.Column('radius_km', sa.Float(), default=100.0),
        sa.Column('geographic_polygon', sa.Text()),
        
        # PostGIS geometry (SQLite: Text for WKT/null)
        sa.Column('boundary', geom_poly_type),
        sa.Column('center_point', geom_type),
        
        # Region
        sa.Column('region_name', sa.String(255)),
        sa.Column('country_codes', sa.String(100)),
        
        # Severity parameters
        sa.Column('severity', sa.Float(), default=0.5),
        sa.Column('probability', sa.Float(), default=0.1),
        sa.Column('time_horizon_months', sa.Integer(), default=12),
        
        # Impact multipliers
        sa.Column('pd_multiplier', sa.Float(), default=1.0),
        sa.Column('lgd_multiplier', sa.Float(), default=1.0),
        sa.Column('valuation_impact_pct', sa.Float(), default=0.0),
        
        # Recovery
        sa.Column('recovery_time_months', sa.Integer()),
        sa.Column('parameters', sa.Text()),
        
        # Results
        sa.Column('affected_assets_count', sa.Integer()),
        sa.Column('total_exposure', sa.Float()),
        sa.Column('expected_loss', sa.Float()),
        
        # Link to historical event
        sa.Column('historical_event_id', sa.String(36), 
                  sa.ForeignKey('historical_events.id', ondelete='SET NULL')),
        
        # Audit
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
        sa.Column('completed_at', sa.DateTime()),
        sa.Column('created_by', sa.String(36)),
    )

    # Spatial index for stress tests (PostgreSQL GIST only)
    if is_pg:
        op.execute('CREATE INDEX IF NOT EXISTS idx_stress_tests_boundary ON stress_tests USING GIST (boundary)')

    # ============================================
    # RISK ZONES TABLE (with PostGIS)
    # ============================================
    op.create_table(
        'risk_zones',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('stress_test_id', sa.String(36), 
                  sa.ForeignKey('stress_tests.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        
        # Zone classification
        sa.Column('zone_level', sa.String(20), default='medium'),
        sa.Column('name', sa.String(255)),
        sa.Column('description', sa.Text()),
        
        # Geographic (basic - for fallback)
        sa.Column('center_latitude', sa.Float()),
        sa.Column('center_longitude', sa.Float()),
        sa.Column('radius_km', sa.Float()),
        sa.Column('polygon', sa.Text()),  # GeoJSON fallback
        
        # PostGIS geometry (SQLite: Text for WKT/null)
        sa.Column('geometry', geom_poly_type),
        sa.Column('center_point', geom_type),
        
        # Metrics
        sa.Column('risk_score', sa.Float(), default=0.5),
        sa.Column('affected_assets_count', sa.Integer(), default=0),
        sa.Column('total_exposure', sa.Float()),
        sa.Column('expected_loss', sa.Float()),
    )
    
    # Spatial index for risk zones (PostgreSQL GIST only)
    if is_pg:
        op.execute('CREATE INDEX IF NOT EXISTS idx_risk_zones_geometry ON risk_zones USING GIST (geometry)')
        op.execute('CREATE INDEX IF NOT EXISTS idx_risk_zones_center ON risk_zones USING GIST (center_point)')

    # ============================================
    # ZONE ASSETS TABLE
    # ============================================
    op.create_table(
        'zone_assets',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('zone_id', sa.String(36),
                  sa.ForeignKey('risk_zones.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        sa.Column('asset_id', sa.String(36),
                  sa.ForeignKey('assets.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        
        # Impact assessment
        sa.Column('impact_severity', sa.Float(), default=0.5),
        sa.Column('expected_loss', sa.Float()),
        sa.Column('recovery_time_months', sa.Integer()),
        sa.Column('impact_details', sa.Text()),
    )
    
    # ============================================
    # STRESS TEST REPORTS TABLE
    # ============================================
    op.create_table(
        'stress_test_reports',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('stress_test_id', sa.String(36),
                  sa.ForeignKey('stress_tests.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        
        # Report content
        sa.Column('report_data', sa.Text()),
        sa.Column('summary', sa.Text()),
        
        # Generated files
        sa.Column('pdf_path', sa.String(500)),
        sa.Column('html_path', sa.String(500)),
        
        # Metadata
        sa.Column('generated_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('generated_by', sa.String(36)),
    )
    
    # ============================================
    # ACTION PLANS TABLE
    # ============================================
    op.create_table(
        'action_plans',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('report_id', sa.String(36),
                  sa.ForeignKey('stress_test_reports.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        
        # Target
        sa.Column('organization_type', sa.String(50), default='enterprise'),
        sa.Column('organization_name', sa.String(255)),
        
        # Plan
        sa.Column('actions', sa.Text()),
        sa.Column('priority', sa.String(20), default='medium'),
        sa.Column('timeline', sa.String(50)),
        
        # ROI
        sa.Column('estimated_cost', sa.Float()),
        sa.Column('risk_reduction', sa.Float()),
        sa.Column('roi_percentage', sa.Float()),
    )
    
    # ============================================
    # DIGITAL TWINS TABLE
    # ============================================
    op.create_table(
        'digital_twins',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('asset_id', sa.String(36),
                  sa.ForeignKey('assets.id', ondelete='CASCADE'),
                  unique=True, nullable=False),

        # State
        sa.Column('state', sa.String(20), default='initializing'),
        sa.Column('last_sync_at', sa.DateTime()),
        sa.Column('sync_source', sa.String(100)),

        # Geometry (stored in MinIO, reference here)
        sa.Column('geometry_type', sa.String(50)),
        sa.Column('geometry_path', sa.String(500)),
        sa.Column('geometry_hash', sa.String(64)),
        sa.Column('geometry_metadata', sa.Text()),

        # Current Physical State
        sa.Column('structural_integrity', sa.Float()),
        sa.Column('condition_score', sa.Float()),
        sa.Column('remaining_useful_life_years', sa.Float()),

        # Sensor Data
        sa.Column('sensor_data', sa.Text()),
        sa.Column('sensor_updated_at', sa.DateTime()),

        # Climate Exposures
        sa.Column('climate_exposures', sa.Text()),
        sa.Column('climate_exposures_updated_at', sa.DateTime()),

        # Infrastructure Dependencies
        sa.Column('infrastructure_dependencies', sa.Text()),

        # Financial Metrics
        sa.Column('financial_metrics', sa.Text()),
        sa.Column('financial_updated_at', sa.DateTime()),

        # Simulated Futures
        sa.Column('future_scenarios', sa.Text()),
        sa.Column('scenarios_updated_at', sa.DateTime()),

        # Audit
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(), default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # ============================================
    # TWIN TIMELINE TABLE (events for digital twins)
    # ============================================
    op.create_table(
        'twin_timeline',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('digital_twin_id', sa.String(36),
                  sa.ForeignKey('digital_twins.id', ondelete='CASCADE'),
                  nullable=False, index=True),

        # Event
        sa.Column('event_type', sa.String(50)),
        sa.Column('event_date', sa.DateTime()),
        sa.Column('event_title', sa.String(255)),
        sa.Column('event_description', sa.Text()),

        # Data
        sa.Column('data', sa.Text()),
        sa.Column('attachments', sa.Text()),

        # Provenance
        sa.Column('source', sa.String(100)),
        sa.Column('verification_hash', sa.String(64)),

        # Audit
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
        sa.Column('created_by', sa.String(36)),
    )

    # ============================================
    # DATA PROVENANCE TABLE
    # ============================================
    op.create_table(
        'data_provenance',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('asset_id', sa.String(36),
                  sa.ForeignKey('assets.id', ondelete='CASCADE')),
        
        sa.Column('data_type', sa.String(50), nullable=False),
        sa.Column('data_point', sa.String(255), nullable=False),
        sa.Column('data_value', sa.Text()),
        
        # Source
        sa.Column('source_type', sa.String(50), nullable=False),
        sa.Column('source_id', sa.String(255)),
        sa.Column('source_name', sa.String(255)),
        sa.Column('source_metadata', sa.Text()),
        
        # Timing
        sa.Column('measurement_timestamp', sa.DateTime()),
        
        # Verification
        sa.Column('data_hash', sa.String(64)),
        sa.Column('signature', sa.Text()),
        sa.Column('signature_algorithm', sa.String(50)),
        sa.Column('status', sa.String(20), default='pending'),
        sa.Column('verified_at', sa.DateTime()),
        sa.Column('verified_by', sa.String(255)),
        
        # Audit
        sa.Column('created_at', sa.DateTime(), default=sa.func.now()),
    )
    
    # ============================================
    # VERIFICATION RECORDS TABLE
    # ============================================
    op.create_table(
        'verification_records',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('provenance_id', sa.String(36),
                  sa.ForeignKey('data_provenance.id', ondelete='CASCADE'),
                  nullable=False, index=True),
        
        sa.Column('verification_type', sa.String(50)),
        sa.Column('verifier_id', sa.String(255)),
        sa.Column('verifier_name', sa.String(255)),
        
        sa.Column('result', sa.String(20)),
        sa.Column('confidence_score', sa.Float()),
        sa.Column('notes', sa.Text()),
        sa.Column('evidence', sa.Text()),
        
        sa.Column('verified_at', sa.DateTime(), default=sa.func.now()),
    )
    
    print("✅ Initial schema created with PostGIS support")


def downgrade() -> None:
    conn = op.get_bind()
    is_pg = conn.dialect.name == 'postgresql'

    # Drop tables in reverse order (respecting foreign keys)
    op.drop_table('verification_records')
    op.drop_table('data_provenance')
    op.drop_table('twin_timeline')
    op.drop_table('digital_twins')
    op.drop_table('action_plans')
    op.drop_table('stress_test_reports')
    op.drop_table('zone_assets')
    op.drop_table('risk_zones')
    op.drop_table('stress_tests')
    op.drop_table('historical_events')
    op.drop_table('assets')
    op.drop_table('users')

    # Drop PostGIS extensions (PostgreSQL only)
    if is_pg:
        op.execute('DROP EXTENSION IF EXISTS postgis_topology')
        op.execute('DROP EXTENSION IF EXISTS postgis')
