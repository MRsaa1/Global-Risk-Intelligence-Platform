"""Extend provenance model with verification types.

Revision ID: 20260125_0002
Revises: 20260125_0001
Create Date: 2026-01-25
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '20260125_0002'
down_revision = '20260125_0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add new fields to provenance tables."""
    # Add fields to data_provenance
    with op.batch_alter_table('data_provenance', schema=None) as batch_op:
        batch_op.add_column(sa.Column('verification_type', sa.String(50), nullable=True))
        batch_op.add_column(sa.Column('linked_claim_id', sa.String(36), nullable=True))
        batch_op.add_column(sa.Column('geometry_hash', sa.String(64), nullable=True))
    
    # Add fields to verification_records
    with op.batch_alter_table('verification_records', schema=None) as batch_op:
        batch_op.add_column(sa.Column('comparison_result', sa.String(50), nullable=True))
        batch_op.add_column(sa.Column('geometry_diff_summary', sa.Text(), nullable=True))


def downgrade() -> None:
    """Remove new fields from provenance tables."""
    with op.batch_alter_table('verification_records', schema=None) as batch_op:
        batch_op.drop_column('geometry_diff_summary')
        batch_op.drop_column('comparison_result')
    
    with op.batch_alter_table('data_provenance', schema=None) as batch_op:
        batch_op.drop_column('geometry_hash')
        batch_op.drop_column('linked_claim_id')
        batch_op.drop_column('verification_type')
