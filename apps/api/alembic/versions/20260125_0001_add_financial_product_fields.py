"""Add financial product fields to assets.

Revision ID: 20260125_0001
Revises: 20260124_0002
Create Date: 2026-01-25

Phase 0.1: Financial Product Type on Asset
"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = '20260125_0001'
down_revision = '20260124_0002'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Add financial product fields to assets table."""
    # Financial product type
    op.add_column('assets', sa.Column(
        'financial_product',
        sa.String(50),
        nullable=True,
        comment='Type of financial product: mortgage, property_insurance, project_finance, etc.'
    ))
    
    # Insurance product type
    op.add_column('assets', sa.Column(
        'insurance_product_type',
        sa.String(50),
        nullable=True,
        comment='Type of insurance: property, liability, business_interruption, etc.'
    ))
    
    # Credit facility reference
    op.add_column('assets', sa.Column(
        'credit_facility_id',
        sa.String(100),
        nullable=True,
        comment='External credit facility reference ID'
    ))
    
    # AI-suggested credit limit
    op.add_column('assets', sa.Column(
        'suggested_credit_limit',
        sa.Float(),
        nullable=True,
        comment='AI-suggested credit limit based on risk analysis'
    ))
    
    # AI-suggested annual premium
    op.add_column('assets', sa.Column(
        'suggested_premium_annual',
        sa.Float(),
        nullable=True,
        comment='AI-suggested annual insurance premium'
    ))
    
    # Create index for financial product filtering
    op.create_index(
        'ix_assets_financial_product',
        'assets',
        ['financial_product'],
        unique=False
    )


def downgrade() -> None:
    """Remove financial product fields from assets table."""
    op.drop_index('ix_assets_financial_product', table_name='assets')
    op.drop_column('assets', 'suggested_premium_annual')
    op.drop_column('assets', 'suggested_credit_limit')
    op.drop_column('assets', 'credit_facility_id')
    op.drop_column('assets', 'insurance_product_type')
    op.drop_column('assets', 'financial_product')
