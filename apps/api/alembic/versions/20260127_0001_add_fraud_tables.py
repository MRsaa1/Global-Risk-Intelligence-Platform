"""Add fraud detection tables.

Revision ID: 20260127_0001
Revises: 20260126_0001
Create Date: 2026-01-27
"""
from alembic import op
import sqlalchemy as sa

revision = '20260127_0001'
down_revision = '20260126_0001'
branch_labels = None
depends_on = None


def upgrade() -> None:
    """Create damage_claims and damage_claim_evidence tables."""
    
    # Damage Claims
    op.create_table(
        'damage_claims',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('claim_number', sa.String(50), unique=True, nullable=False, index=True),
        sa.Column('asset_id', sa.String(36), sa.ForeignKey('assets.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('claim_type', sa.String(50), default='insurance'),
        sa.Column('status', sa.String(50), default='submitted'),
        sa.Column('title', sa.String(255), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('claimed_damage_type', sa.String(50), default='other'),
        sa.Column('damage_date', sa.DateTime(), nullable=True),
        sa.Column('damage_location', sa.String(255), nullable=True),
        sa.Column('damage_extent', sa.Text(), nullable=True),
        sa.Column('claimed_loss_amount', sa.Float(), default=0),
        sa.Column('assessed_loss_amount', sa.Float(), nullable=True),
        sa.Column('approved_amount', sa.Float(), nullable=True),
        sa.Column('deductible', sa.Float(), nullable=True),
        sa.Column('fraud_risk_level', sa.String(20), nullable=True),
        sa.Column('fraud_score', sa.Float(), nullable=True),
        sa.Column('fraud_indicators', sa.Text(), nullable=True),
        sa.Column('is_duplicate_suspected', sa.Boolean(), default=False),
        sa.Column('duplicate_claim_ids', sa.Text(), nullable=True),
        sa.Column('has_before_data', sa.Boolean(), default=False),
        sa.Column('has_after_data', sa.Boolean(), default=False),
        sa.Column('comparison_status', sa.String(50), nullable=True),
        sa.Column('comparison_result', sa.Text(), nullable=True),
        sa.Column('geometry_match_score', sa.Float(), nullable=True),
        sa.Column('reported_at', sa.DateTime(), nullable=False),
        sa.Column('reviewed_at', sa.DateTime(), nullable=True),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('claimant_id', sa.String(36), nullable=True),
        sa.Column('claimant_name', sa.String(255), nullable=True),
        sa.Column('adjuster_id', sa.String(36), nullable=True),
        sa.Column('adjuster_name', sa.String(255), nullable=True),
        sa.Column('policy_number', sa.String(100), nullable=True),
        sa.Column('policy_type', sa.String(50), nullable=True),
        sa.Column('coverage_limit', sa.Float(), nullable=True),
        sa.Column('internal_notes', sa.Text(), nullable=True),
        sa.Column('extra_data', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('updated_at', sa.DateTime(), nullable=True),
        sa.Column('created_by', sa.String(36), nullable=True),
    )
    
    # Damage Claim Evidence
    op.create_table(
        'damage_claim_evidence',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('claim_id', sa.String(36), sa.ForeignKey('damage_claims.id', ondelete='CASCADE'), nullable=False, index=True),
        sa.Column('evidence_type', sa.String(50), default='photo'),
        sa.Column('title', sa.String(255), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('file_path', sa.String(500), nullable=False),
        sa.Column('file_name', sa.String(255), nullable=True),
        sa.Column('file_size_bytes', sa.Integer(), nullable=True),
        sa.Column('mime_type', sa.String(100), nullable=True),
        sa.Column('captured_at', sa.DateTime(), nullable=True),
        sa.Column('captured_by', sa.String(255), nullable=True),
        sa.Column('capture_device', sa.String(255), nullable=True),
        sa.Column('capture_location', sa.String(255), nullable=True),
        sa.Column('latitude', sa.Float(), nullable=True),
        sa.Column('longitude', sa.Float(), nullable=True),
        sa.Column('is_before', sa.Boolean(), default=False),
        sa.Column('is_after', sa.Boolean(), default=False),
        sa.Column('is_verified', sa.Boolean(), default=False),
        sa.Column('verification_notes', sa.Text(), nullable=True),
        sa.Column('file_hash', sa.String(64), nullable=True),
        sa.Column('geometry_hash', sa.String(64), nullable=True),
        sa.Column('analysis_results', sa.Text(), nullable=True),
        sa.Column('extra_data', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('uploaded_by', sa.String(36), nullable=True),
    )


def downgrade() -> None:
    """Drop fraud tables."""
    op.drop_table('damage_claim_evidence')
    op.drop_table('damage_claims')
