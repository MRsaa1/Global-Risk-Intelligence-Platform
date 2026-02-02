"""Add annotation tables for 3D collaboration.

Revision ID: 20260128_0001
Revises: 20260127_0001
Create Date: 2026-01-28
"""
from alembic import op
import sqlalchemy as sa

revision = '20260128_0001'
down_revision = '20260127_0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create scene_annotations and annotation_comments tables."""
    
    # Scene Annotations
    op.create_table(
        'scene_annotations',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('asset_id', sa.String(36), sa.ForeignKey('assets.id', ondelete='CASCADE'), nullable=True, index=True),
        sa.Column('project_id', sa.String(36), sa.ForeignKey('projects.id', ondelete='CASCADE'), nullable=True, index=True),
        sa.Column('annotation_type', sa.String(50), default='marker'),
        sa.Column('status', sa.String(50), default='open'),
        sa.Column('priority', sa.String(20), default='medium'),
        sa.Column('position_x', sa.Float(), default=0),
        sa.Column('position_y', sa.Float(), default=0),
        sa.Column('position_z', sa.Float(), default=0),
        sa.Column('camera_position_x', sa.Float(), nullable=True),
        sa.Column('camera_position_y', sa.Float(), nullable=True),
        sa.Column('camera_position_z', sa.Float(), nullable=True),
        sa.Column('camera_target_x', sa.Float(), nullable=True),
        sa.Column('camera_target_y', sa.Float(), nullable=True),
        sa.Column('camera_target_z', sa.Float(), nullable=True),
        sa.Column('end_position_x', sa.Float(), nullable=True),
        sa.Column('end_position_y', sa.Float(), nullable=True),
        sa.Column('end_position_z', sa.Float(), nullable=True),
        sa.Column('measurement_value', sa.Float(), nullable=True),
        sa.Column('measurement_unit', sa.String(20), nullable=True),
        sa.Column('title', sa.String(255), nullable=True),
        sa.Column('text', sa.Text(), nullable=True),
        sa.Column('color', sa.String(20), nullable=True),
        sa.Column('icon', sa.String(50), nullable=True),
        sa.Column('scale', sa.Float(), default=1.0),
        sa.Column('visible', sa.Boolean(), default=True),
        sa.Column('attachment_paths', sa.Text(), nullable=True),
        sa.Column('screenshot_path', sa.String(500), nullable=True),
        sa.Column('element_id', sa.String(100), nullable=True),
        sa.Column('element_type', sa.String(100), nullable=True),
        sa.Column('tags', sa.Text(), nullable=True),
        sa.Column('category', sa.String(100), nullable=True),
        sa.Column('author_id', sa.String(36), nullable=False),
        sa.Column('author_name', sa.String(255), nullable=True),
        sa.Column('assignee_id', sa.String(36), nullable=True),
        sa.Column('assignee_name', sa.String(255), nullable=True),
        sa.Column('due_date', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('extra_data', sa.Text(), nullable=True),
    )
    
    # Annotation Comments
    op.create_table(
        'annotation_comments',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('annotation_id', sa.String(36), sa.ForeignKey('scene_annotations.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('text', sa.Text(), nullable=False),
        sa.Column('author_id', sa.String(36), nullable=False),
        sa.Column('author_name', sa.String(255), nullable=True),
        sa.Column('parent_comment_id', sa.String(36), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
    )


def downgrade() -> None:
    """Drop annotation tables."""
    op.drop_table('annotation_comments')
    op.drop_table('scene_annotations')
