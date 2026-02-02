"""Add spatial data tables for point cloud and satellite.

Revision ID: 20260125_0003
Revises: 20260125_0002
Create Date: 2026-01-25
"""
from alembic import op
import sqlalchemy as sa

revision = '20260125_0003'
down_revision = '20260125_0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create point_cloud_captures and satellite_images tables."""
    
    # Point Cloud Captures
    op.create_table(
        'point_cloud_captures',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('asset_id', sa.String(36), sa.ForeignKey('assets.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('source', sa.String(50), nullable=False, default='lidar'),
        sa.Column('source_provider', sa.String(100), nullable=True),
        sa.Column('source_mission_id', sa.String(100), nullable=True),
        sa.Column('file_path', sa.String(500), nullable=False),
        sa.Column('file_format', sa.String(20), nullable=True),
        sa.Column('file_size_bytes', sa.Integer(), nullable=True),
        sa.Column('captured_at', sa.DateTime(), nullable=True),
        sa.Column('uploaded_at', sa.DateTime(), nullable=True),
        sa.Column('crs', sa.String(50), nullable=True),
        sa.Column('bounds_wkt', sa.Text(), nullable=True),
        sa.Column('min_x', sa.Float(), nullable=True),
        sa.Column('min_y', sa.Float(), nullable=True),
        sa.Column('min_z', sa.Float(), nullable=True),
        sa.Column('max_x', sa.Float(), nullable=True),
        sa.Column('max_y', sa.Float(), nullable=True),
        sa.Column('max_z', sa.Float(), nullable=True),
        sa.Column('point_count', sa.Integer(), nullable=True),
        sa.Column('density_pts_per_m2', sa.Float(), nullable=True),
        sa.Column('quality_score', sa.Float(), nullable=True),
        sa.Column('noise_level', sa.Float(), nullable=True),
        sa.Column('processing_status', sa.String(20), default='pending'),
        sa.Column('processed_file_path', sa.String(500), nullable=True),
        sa.Column('geometry_hash', sa.String(64), nullable=True),
        sa.Column('is_before', sa.Boolean(), default=False),
        sa.Column('is_after', sa.Boolean(), default=False),
        sa.Column('extra_data', sa.Text(), nullable=True),
        sa.Column('created_by', sa.String(36), nullable=True),
    )
    
    # Satellite Images
    op.create_table(
        'satellite_images',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('asset_id', sa.String(36), sa.ForeignKey('assets.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('provider', sa.String(50), nullable=False, default='sentinel'),
        sa.Column('scene_id', sa.String(100), nullable=False, index=True),
        sa.Column('product_type', sa.String(50), nullable=True),
        sa.Column('captured_at', sa.DateTime(), nullable=False),
        sa.Column('uploaded_at', sa.DateTime(), nullable=True),
        sa.Column('resolution_m', sa.Float(), nullable=True),
        sa.Column('bands', sa.String(255), nullable=True),
        sa.Column('coverage_wkt', sa.Text(), nullable=True),
        sa.Column('center_lat', sa.Float(), nullable=True),
        sa.Column('center_lon', sa.Float(), nullable=True),
        sa.Column('cloud_cover_pct', sa.Float(), nullable=True),
        sa.Column('sun_elevation', sa.Float(), nullable=True),
        sa.Column('off_nadir_angle', sa.Float(), nullable=True),
        sa.Column('file_path', sa.String(500), nullable=True),
        sa.Column('thumbnail_path', sa.String(500), nullable=True),
        sa.Column('file_size_bytes', sa.Integer(), nullable=True),
        sa.Column('is_before', sa.Boolean(), default=False),
        sa.Column('is_after', sa.Boolean(), default=False),
        sa.Column('ndvi_mean', sa.Float(), nullable=True),
        sa.Column('ndwi_mean', sa.Float(), nullable=True),
        sa.Column('change_score', sa.Float(), nullable=True),
        sa.Column('processing_status', sa.String(20), default='pending'),
        sa.Column('analysis_results', sa.Text(), nullable=True),
        sa.Column('extra_data', sa.Text(), nullable=True),
        sa.Column('created_by', sa.String(36), nullable=True),
    )


def downgrade() -> None:
    """Drop spatial data tables."""
    op.drop_table('satellite_images')
    op.drop_table('point_cloud_captures')
