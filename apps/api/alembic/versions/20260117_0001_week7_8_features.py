"""Week 7-8 features: User preferences, saved filters, dashboard widgets

Revision ID: 20260117_0001
Revises: 20260115_0001_001_initial_schema
Create Date: 2026-01-17 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '20260117_0001'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # User Preferences table
    op.create_table(
        'user_preferences',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('preference_type', sa.String(50), nullable=False, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('data', postgresql.JSON, nullable=False, default={}),
        sa.Column('entity_type', sa.String(50), nullable=True),
        sa.Column('is_default', sa.Boolean, nullable=False, default=False),
        sa.Column('is_pinned', sa.Boolean, nullable=False, default=False),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # Saved Filters table
    op.create_table(
        'saved_filters',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text, nullable=True),
        sa.Column('entity_type', sa.String(50), nullable=False, index=True),
        sa.Column('filters', postgresql.JSON, nullable=False, default={}),
        sa.Column('sort_by', sa.String(50), nullable=True),
        sa.Column('sort_order', sa.String(10), nullable=False, default='desc'),
        sa.Column('page_size', sa.Integer, nullable=False, default=20),
        sa.Column('is_default', sa.Boolean, nullable=False, default=False),
        sa.Column('is_shared', sa.Boolean, nullable=False, default=False),
        sa.Column('use_count', sa.Integer, nullable=False, default=0),
        sa.Column('last_used_at', sa.DateTime, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # Dashboard Widgets table
    op.create_table(
        'dashboard_widgets',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('user_id', sa.String(36), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('dashboard_id', sa.String(50), nullable=False, default='main'),
        sa.Column('widget_type', sa.String(50), nullable=False),
        sa.Column('position_x', sa.Integer, nullable=False, default=0),
        sa.Column('position_y', sa.Integer, nullable=False, default=0),
        sa.Column('width', sa.Integer, nullable=False, default=1),
        sa.Column('height', sa.Integer, nullable=False, default=1),
        sa.Column('config', postgresql.JSON, nullable=False, default={}),
        sa.Column('is_visible', sa.Boolean, nullable=False, default=True),
        sa.Column('is_collapsed', sa.Boolean, nullable=False, default=False),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now(), onupdate=sa.func.now()),
    )
    
    # Create index for dashboard lookup
    op.create_index(
        'ix_dashboard_widgets_user_dashboard',
        'dashboard_widgets',
        ['user_id', 'dashboard_id']
    )


def downgrade() -> None:
    op.drop_index('ix_dashboard_widgets_user_dashboard', table_name='dashboard_widgets')
    op.drop_table('dashboard_widgets')
    op.drop_table('saved_filters')
    op.drop_table('user_preferences')
