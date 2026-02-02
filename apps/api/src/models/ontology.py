"""
Foundry-Style Ontology Models
=============================

Causal Knowledge Graph for institutional-grade risk management.

6 Layers:
1. Financial Layer: Portfolio → Fund → Asset → Cashflow
2. Physical Layer: Asset → Location → Hazard → ClimateVariable
3. Network Layer: Asset → NetworkNode → Dependency → FailureMode
4. Risk Layer: Hazard → Risk → Loss (with confidence, probability, impact)
5. Decision Layer: Risk → MitigationAction → Owner → LossReduction
6. Governance Layer: Model → Override (reason, timestamp, approver)

Every output is traceable to source. Override tracking with audit log.
"""

import enum
from datetime import datetime
from typing import Optional
from uuid import UUID, uuid4

from sqlalchemy import Column, DateTime, Enum, Float, ForeignKey, Integer, String, Text, Boolean, JSON
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.orm import relationship

from src.core.database import Base


# ============================================
# ENUMS
# ============================================

class HazardType(str, enum.Enum):
    """Physical hazard types."""
    FLOOD = "flood"
    HEAT = "heat"
    WIND = "wind"
    DROUGHT = "drought"
    EARTHQUAKE = "earthquake"
    FIRE = "fire"
    SEA_LEVEL_RISE = "sea_level_rise"
    STORM_SURGE = "storm_surge"


class RiskCategory(str, enum.Enum):
    """Risk categories."""
    PHYSICAL = "physical"
    TRANSITION = "transition"
    LIABILITY = "liability"
    NETWORK = "network"
    OPERATIONAL = "operational"


class ConfidenceLevel(str, enum.Enum):
    """Confidence levels for risk estimates."""
    HIGH = "high"  # >90%
    MEDIUM = "medium"  # 70-90%
    LOW = "low"  # <70%


class MitigationActionType(str, enum.Enum):
    """Types of mitigation actions."""
    RELOCATE = "relocate"
    HARDEN = "harden"
    INSURE = "insure"
    HEDGE = "hedge"
    DIVEST = "divest"
    BACKUP = "backup"
    CAPEX = "capex"
    MONITOR = "monitor"


class OverrideStatus(str, enum.Enum):
    """Status of model overrides."""
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


# ============================================
# LAYER 2: PHYSICAL LAYER
# ============================================

class Location(Base):
    """Geographic location with hazard exposure."""
    __tablename__ = "ontology_locations"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    latitude = Column(Float, nullable=False)
    longitude = Column(Float, nullable=False)
    region = Column(String(100))
    country = Column(String(100))
    elevation = Column(Float)  # meters
    
    # Hazard exposure scores (0-1)
    flood_exposure = Column(Float, default=0.0)
    heat_exposure = Column(Float, default=0.0)
    wind_exposure = Column(Float, default=0.0)
    drought_exposure = Column(Float, default=0.0)
    earthquake_exposure = Column(Float, default=0.0)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Hazard(Base):
    """Physical hazard event."""
    __tablename__ = "ontology_hazards"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    hazard_type = Column(Enum(HazardType), nullable=False)
    location_id = Column(PGUUID(as_uuid=True), ForeignKey("ontology_locations.id"))
    
    # Hazard parameters
    intensity = Column(Float)  # 0-1 scale
    return_period = Column(Integer)  # years (e.g., 1-in-100)
    duration_hours = Column(Float)
    probability = Column(Float)  # Annual probability
    
    # Climate scenario
    scenario = Column(String(50))  # e.g., "NGFS_Hothouse_2050"
    time_horizon = Column(String(20))  # e.g., "2030", "2050"
    
    # Confidence
    confidence = Column(Enum(ConfidenceLevel), default=ConfidenceLevel.MEDIUM)
    data_source = Column(String(255))
    
    created_at = Column(DateTime, default=datetime.utcnow)


class ClimateVariable(Base):
    """Climate variable driving hazards."""
    __tablename__ = "ontology_climate_variables"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    variable_name = Column(String(100), nullable=False)  # e.g., "temperature", "precipitation"
    scenario = Column(String(50), nullable=False)
    time_horizon = Column(String(20), nullable=False)
    
    # Values
    baseline_value = Column(Float)
    projected_value = Column(Float)
    delta = Column(Float)
    unit = Column(String(20))  # e.g., "°C", "mm"
    
    created_at = Column(DateTime, default=datetime.utcnow)


# ============================================
# LAYER 3: NETWORK LAYER
# ============================================

class NetworkNode(Base):
    """Network node (supplier, grid, infrastructure)."""
    __tablename__ = "ontology_network_nodes"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    name = Column(String(255), nullable=False)
    node_type = Column(String(50))  # "grid", "supplier", "port", "datacenter"
    
    # Location
    location_id = Column(PGUUID(as_uuid=True), ForeignKey("ontology_locations.id"))
    
    # Resilience
    redundancy_score = Column(Float, default=0.5)  # 0-1
    criticality_score = Column(Float, default=0.5)  # 0-1
    
    # Metadata
    sector = Column(String(100))
    owner = Column(String(255))
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Dependency(Base):
    """Dependency relationship between assets and network nodes."""
    __tablename__ = "ontology_dependencies"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    
    # Source (asset or node)
    source_type = Column(String(20))  # "asset" or "node"
    source_id = Column(PGUUID(as_uuid=True), nullable=False)
    
    # Target (node)
    target_id = Column(PGUUID(as_uuid=True), ForeignKey("ontology_network_nodes.id"), nullable=False)
    
    # Dependency characteristics
    dependency_type = Column(String(50))  # "power", "supply", "data", "logistics"
    substitutability = Column(Float, default=0.5)  # 0=critical, 1=easily substituted
    impact_weight = Column(Float, default=1.0)  # Impact multiplier
    
    created_at = Column(DateTime, default=datetime.utcnow)


class FailureMode(Base):
    """Failure mode for network nodes."""
    __tablename__ = "ontology_failure_modes"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    node_id = Column(PGUUID(as_uuid=True), ForeignKey("ontology_network_nodes.id"), nullable=False)
    
    # Failure characteristics
    failure_type = Column(String(100))  # e.g., "power_outage", "supply_disruption"
    trigger_hazard = Column(Enum(HazardType))
    probability = Column(Float)
    recovery_time_hours = Column(Float)
    
    # Impact
    cascade_potential = Column(Float, default=0.5)  # 0-1
    
    created_at = Column(DateTime, default=datetime.utcnow)


# ============================================
# LAYER 4: RISK LAYER
# ============================================

class Risk(Base):
    """Risk object linking hazard to financial impact."""
    __tablename__ = "ontology_risks"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    
    # Risk identification
    risk_id = Column(String(100), unique=True)  # e.g., "FLOOD-KYIV-2030"
    category = Column(Enum(RiskCategory), nullable=False)
    
    # Source hazard
    hazard_id = Column(PGUUID(as_uuid=True), ForeignKey("ontology_hazards.id"))
    
    # Affected asset
    asset_id = Column(PGUUID(as_uuid=True))  # Foreign key to assets table
    
    # Risk metrics
    probability = Column(Float, nullable=False)  # 0-1
    impact = Column(Float, nullable=False)  # €
    confidence = Column(Enum(ConfidenceLevel), default=ConfidenceLevel.MEDIUM)
    time_horizon = Column(String(20))
    
    # Computed risk score
    risk_score = Column(Float)  # probability × impact
    
    # Model reference
    model_version = Column(String(50))
    calculated_at = Column(DateTime, default=datetime.utcnow)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Loss(Base):
    """Expected loss from risk realization."""
    __tablename__ = "ontology_losses"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    risk_id = Column(PGUUID(as_uuid=True), ForeignKey("ontology_risks.id"), nullable=False)
    
    # Loss estimates
    expected_loss = Column(Float, nullable=False)  # €
    loss_p50 = Column(Float)  # Median
    loss_p95 = Column(Float)  # 95th percentile
    loss_p99 = Column(Float)  # 99th percentile
    
    # Breakdown
    direct_damage = Column(Float)
    business_interruption = Column(Float)
    third_party_liability = Column(Float)
    insurance_recovery = Column(Float)
    
    # Currency and confidence
    currency = Column(String(3), default="EUR")
    confidence = Column(Enum(ConfidenceLevel), default=ConfidenceLevel.MEDIUM)
    
    created_at = Column(DateTime, default=datetime.utcnow)


# ============================================
# LAYER 5: DECISION LAYER
# ============================================

class MitigationAction(Base):
    """Mitigation action to reduce risk."""
    __tablename__ = "ontology_mitigation_actions"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    risk_id = Column(PGUUID(as_uuid=True), ForeignKey("ontology_risks.id"), nullable=False)
    
    # Action details
    action_type = Column(Enum(MitigationActionType), nullable=False)
    description = Column(Text)
    
    # Cost-benefit
    cost = Column(Float, nullable=False)  # €
    loss_reduction = Column(Float)  # € of loss avoided
    roi = Column(Float)  # loss_reduction / cost
    
    # Implementation
    lead_time_days = Column(Integer)
    effectiveness = Column(Float)  # 0-1
    
    # Ownership
    owner_function = Column(String(100))  # e.g., "Infrastructure Risk", "Ops"
    owner_name = Column(String(255))
    sla_hours = Column(Integer)  # Decision SLA
    
    # Status
    status = Column(String(50), default="proposed")  # proposed, approved, implemented
    approved_at = Column(DateTime)
    approved_by = Column(String(255))
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class DecisionTrigger(Base):
    """Machine-readable decision trigger."""
    __tablename__ = "ontology_decision_triggers"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    
    # Trigger condition (JSON for flexibility)
    trigger_condition = Column(JSON, nullable=False)
    # e.g., {"flood_depth": ">0.5m", "duration": ">6h", "and": true}
    
    # Action to take
    action_id = Column(PGUUID(as_uuid=True), ForeignKey("ontology_mitigation_actions.id"))
    action_description = Column(Text)
    
    # Confidence and reference
    confidence = Column(Float)
    regulatory_reference = Column(JSON)  # ["ISO22301", "DORA"]
    
    # Active status
    is_active = Column(Boolean, default=True)
    
    created_at = Column(DateTime, default=datetime.utcnow)


# ============================================
# LAYER 6: GOVERNANCE LAYER
# ============================================

class RiskModel(Base):
    """Risk model metadata for governance."""
    __tablename__ = "ontology_risk_models"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    
    # Model identification
    model_name = Column(String(255), nullable=False)
    version = Column(String(50), nullable=False)
    methodology = Column(Text)
    
    # Ownership
    model_owner = Column(String(255))
    validation_owner = Column(String(255))
    
    # Validation status
    validation_status = Column(String(50), default="pending")  # pending, validated, expired
    last_validation = Column(DateTime)
    next_validation = Column(DateTime)
    
    # Backtest results
    backtest_date = Column(DateTime)
    backtest_result = Column(String(50))  # passed, failed, conditional
    backtest_details = Column(JSON)
    
    # Assumptions
    assumptions = Column(JSON)
    limitations = Column(JSON)
    
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ModelOverride(Base):
    """Override log for model outputs (mandatory for compliance)."""
    __tablename__ = "ontology_model_overrides"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    
    # Model and entity reference
    model_id = Column(PGUUID(as_uuid=True), ForeignKey("ontology_risk_models.id"))
    entity_type = Column(String(50))  # "risk", "loss", "action"
    entity_id = Column(PGUUID(as_uuid=True))
    
    # Override details
    field_name = Column(String(100))
    original_value = Column(Text)
    override_value = Column(Text)
    reason = Column(Text, nullable=False)
    
    # Approval
    status = Column(Enum(OverrideStatus), default=OverrideStatus.PENDING)
    requested_by = Column(String(255), nullable=False)
    approved_by = Column(String(255))
    approved_at = Column(DateTime)
    
    # Audit
    created_at = Column(DateTime, default=datetime.utcnow)
    expires_at = Column(DateTime)  # Optional expiration


class AuditTrail(Base):
    """Immutable audit trail for compliance."""
    __tablename__ = "ontology_audit_trail"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    
    # Event details
    event_type = Column(String(100), nullable=False)  # "risk_calculated", "action_approved", "override_applied"
    entity_type = Column(String(50))
    entity_id = Column(PGUUID(as_uuid=True))
    
    # Actor
    actor_type = Column(String(50))  # "user", "system", "model"
    actor_id = Column(String(255))
    
    # Change details
    action = Column(String(100))
    old_state = Column(JSON)
    new_state = Column(JSON)
    
    # Metadata
    ip_address = Column(String(50))
    user_agent = Column(String(255))
    
    # Timestamp (immutable)
    timestamp = Column(DateTime, default=datetime.utcnow, nullable=False)


# ============================================
# CAUSAL CHAIN LINK (Graph Edges)
# ============================================

class CausalLink(Base):
    """
    Causal relationship between ontology entities.
    
    Example chain:
    ClimateVariable → Hazard → Risk → Loss → MitigationAction
    """
    __tablename__ = "ontology_causal_links"

    id = Column(PGUUID(as_uuid=True), primary_key=True, default=uuid4)
    
    # Source
    source_type = Column(String(50), nullable=False)  # "climate_variable", "hazard", "risk", etc.
    source_id = Column(PGUUID(as_uuid=True), nullable=False)
    
    # Target
    target_type = Column(String(50), nullable=False)
    target_id = Column(PGUUID(as_uuid=True), nullable=False)
    
    # Relationship
    relationship = Column(String(100), nullable=False)  # "CAUSES", "RESULTS_IN", "MITIGATED_BY"
    weight = Column(Float, default=1.0)  # Impact weight
    confidence = Column(Float, default=0.8)  # Confidence in the causal link
    
    # Metadata
    created_at = Column(DateTime, default=datetime.utcnow)
    created_by = Column(String(255))
