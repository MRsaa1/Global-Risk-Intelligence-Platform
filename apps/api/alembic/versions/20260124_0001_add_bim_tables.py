"""Add BIM persistence tables.

Revision ID: 20260124_0001
Revises: 20260121_0001_add_risk_indexes
Create Date: 2026-01-24

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20260124_0001'
down_revision = '20260121_0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # BIM Models table
    op.create_table(
        'bim_models',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('asset_id', sa.String(36), sa.ForeignKey('assets.id', ondelete='CASCADE'), nullable=False, index=True),
        
        # File info
        sa.Column('file_name', sa.String(255), nullable=False),
        sa.Column('file_size', sa.Integer, nullable=False),
        sa.Column('file_hash', sa.String(64)),
        
        # IFC metadata
        sa.Column('ifc_schema', sa.String(20)),
        sa.Column('application', sa.String(255)),
        sa.Column('author', sa.String(255)),
        sa.Column('organization', sa.String(255)),
        sa.Column('ifc_creation_date', sa.DateTime),
        
        # Building info
        sa.Column('project_name', sa.String(255)),
        sa.Column('site_name', sa.String(255)),
        sa.Column('building_name', sa.String(255)),
        
        # Statistics
        sa.Column('element_count', sa.Integer, default=0),
        sa.Column('floor_count', sa.Integer, default=0),
        sa.Column('space_count', sa.Integer, default=0),
        sa.Column('wall_count', sa.Integer, default=0),
        sa.Column('door_count', sa.Integer, default=0),
        sa.Column('window_count', sa.Integer, default=0),
        
        # Geometry
        sa.Column('gross_floor_area', sa.Float),
        
        # Processing status
        sa.Column('processing_status', sa.String(20), default='pending'),
        sa.Column('processing_progress', sa.Integer, default=0),
        sa.Column('processing_message', sa.Text),
        sa.Column('processing_time_ms', sa.Integer),
        
        # Storage paths
        sa.Column('gltf_path', sa.String(500)),
        sa.Column('thumbnail_path', sa.String(500)),
        sa.Column('original_file_path', sa.String(500)),
        
        # Flags
        sa.Column('has_geometry', sa.Boolean, default=False),
        sa.Column('has_thumbnail', sa.Boolean, default=False),
        sa.Column('is_valid', sa.Boolean, default=True),
        
        # Errors/warnings
        sa.Column('errors', sa.Text),
        sa.Column('warnings', sa.Text),
        
        # Audit
        sa.Column('created_at', sa.DateTime),
        sa.Column('updated_at', sa.DateTime),
        sa.Column('created_by', sa.String(36)),
    )
    
    # BIM Sites table
    op.create_table(
        'bim_sites',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('bim_model_id', sa.String(36), sa.ForeignKey('bim_models.id', ondelete='CASCADE'), nullable=False, index=True),
        
        # IFC data
        sa.Column('ifc_id', sa.String(100)),
        sa.Column('ifc_global_id', sa.String(22)),
        
        # Site info
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        
        # Location
        sa.Column('address', sa.Text),
        sa.Column('latitude', sa.Float),
        sa.Column('longitude', sa.Float),
        sa.Column('elevation', sa.Float),
        
        # Area
        sa.Column('land_area', sa.Float),
        
        # Audit
        sa.Column('created_at', sa.DateTime),
    )
    
    # BIM Buildings table
    op.create_table(
        'bim_buildings',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('bim_model_id', sa.String(36), sa.ForeignKey('bim_models.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('site_id', sa.String(36), sa.ForeignKey('bim_sites.id', ondelete='SET NULL')),
        
        # IFC data
        sa.Column('ifc_id', sa.String(100)),
        sa.Column('ifc_global_id', sa.String(22)),
        
        # Building info
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        
        # Location
        sa.Column('elevation', sa.Float),
        
        # Statistics
        sa.Column('storey_count', sa.Integer, default=0),
        sa.Column('gross_floor_area', sa.Float),
        sa.Column('footprint_area', sa.Float),
        
        # Classification
        sa.Column('occupancy_type', sa.String(100)),
        sa.Column('construction_type', sa.String(100)),
        sa.Column('year_of_construction', sa.Integer),
        
        # Audit
        sa.Column('created_at', sa.DateTime),
    )
    
    # BIM Floors table
    op.create_table(
        'bim_floors',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('bim_model_id', sa.String(36), sa.ForeignKey('bim_models.id', ondelete='CASCADE'), nullable=False, index=True),
        
        # IFC data
        sa.Column('ifc_id', sa.String(100)),
        sa.Column('ifc_global_id', sa.String(22)),
        
        # Floor info
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('elevation', sa.Float),
        sa.Column('height', sa.Float),
        
        # Statistics
        sa.Column('element_count', sa.Integer, default=0),
        sa.Column('space_count', sa.Integer, default=0),
        sa.Column('gross_area', sa.Float),
        
        # Order
        sa.Column('sort_order', sa.Integer, default=0),
    )
    
    # BIM Elements table
    op.create_table(
        'bim_elements',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('bim_model_id', sa.String(36), sa.ForeignKey('bim_models.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('floor_id', sa.String(36), sa.ForeignKey('bim_floors.id', ondelete='SET NULL'), index=True),
        
        # IFC identity
        sa.Column('ifc_id', sa.String(100), index=True),
        sa.Column('ifc_global_id', sa.String(22)),
        sa.Column('ifc_type', sa.String(100), index=True),
        
        # Element info
        sa.Column('name', sa.String(255)),
        sa.Column('description', sa.Text),
        sa.Column('object_type', sa.String(255)),
        sa.Column('tag', sa.String(100)),
        
        # Classification
        sa.Column('classification_code', sa.String(50)),
        sa.Column('classification_name', sa.String(255)),
        
        # Properties (JSON)
        sa.Column('properties', sa.Text),
        sa.Column('quantities', sa.Text),
        sa.Column('materials', sa.Text),
        
        # Geometry bounds
        sa.Column('min_x', sa.Float),
        sa.Column('min_y', sa.Float),
        sa.Column('min_z', sa.Float),
        sa.Column('max_x', sa.Float),
        sa.Column('max_y', sa.Float),
        sa.Column('max_z', sa.Float),
        
        # Risk-relevant properties
        sa.Column('is_structural', sa.Boolean, default=False),
        sa.Column('is_external', sa.Boolean, default=False),
        sa.Column('fire_rating', sa.String(50)),
        sa.Column('load_bearing', sa.Boolean, default=False),
        
        # Audit
        sa.Column('created_at', sa.DateTime),
    )
    
    # Create indexes for common queries
    op.create_index('ix_bim_elements_type_model', 'bim_elements', ['ifc_type', 'bim_model_id'])
    op.create_index('ix_bim_floors_model_order', 'bim_floors', ['bim_model_id', 'sort_order'])


def downgrade() -> None:
    op.drop_index('ix_bim_floors_model_order', table_name='bim_floors')
    op.drop_index('ix_bim_elements_type_model', table_name='bim_elements')
    op.drop_table('bim_elements')
    op.drop_table('bim_floors')
    op.drop_table('bim_buildings')
    op.drop_table('bim_sites')
    op.drop_table('bim_models')
