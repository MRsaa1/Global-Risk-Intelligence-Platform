"""
Universal Stress Test Schema
============================

Pydantic models for Universal Stress Testing Methodology.
Implements Part 4.1 (Input Schema) and Part 6.1 (Output Schema).

Reference: Universal Stress Testing Methodology v1.0
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple, Union

from pydantic import BaseModel, Field, validator


# =============================================================================
# ENUMS
# =============================================================================

class SectorType(str, Enum):
    """Sector types for stress testing."""
    INSURANCE = "insurance"
    REAL_ESTATE = "real_estate"
    FINANCIAL = "financial"
    ENTERPRISE = "enterprise"
    DEFENSE = "defense"


class CriticalityLevel(str, Enum):
    """Criticality levels."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class TimelineType(str, Enum):
    """Response timeline types."""
    IMMEDIATE = "immediate"
    HOURS_24 = "24h"
    HOURS_72 = "72h"
    WEEK_1 = "1week"
    CUSTOM = "custom"


class ScenarioType(str, Enum):
    """Stress scenario types."""
    CLIMATE = "climate"
    GEOPOLITICAL = "geopolitical"
    FINANCIAL = "financial"
    PANDEMIC = "pandemic"
    CYBER = "cyber"
    SUPPLY_CHAIN = "supply_chain"
    REGULATORY = "regulatory"
    ENERGY = "energy"


class AlertLevel(str, Enum):
    """Alert severity levels."""
    GREEN = "GREEN"
    YELLOW = "YELLOW"
    AMBER = "AMBER"
    RED = "RED"
    BLACK = "BLACK"


# =============================================================================
# INPUT SCHEMAS
# =============================================================================

class Location(BaseModel):
    """Geographic location."""
    lat: float = Field(..., ge=-90, le=90, description="Latitude")
    lon: float = Field(..., ge=-180, le=180, description="Longitude")
    region: Optional[str] = Field(None, description="Region name")


class ExposureEntity(BaseModel):
    """Single entity/asset exposure."""
    id: str = Field(..., description="Unique entity identifier")
    type: str = Field("asset", description="Entity type (building, portfolio, business_unit, asset)")
    name: str = Field(..., description="Entity name")
    location: Optional[Location] = Field(None, description="Geographic location")
    value: float = Field(..., gt=0, description="Monetary value")
    currency: str = Field("EUR", description="Currency code")
    vulnerability_curve: str = Field("standard", description="Vulnerability curve type")
    criticality: CriticalityLevel = Field(CriticalityLevel.MEDIUM, description="Criticality level")
    dependencies: List[str] = Field(default_factory=list, description="IDs of dependent entities")
    metadata: Dict[str, Any] = Field(default_factory=dict, description="Additional metadata")


class SectorExposureData(BaseModel):
    """Sector-specific exposure data."""
    entities: List[ExposureEntity] = Field(default_factory=list, description="List of exposed entities")
    total_exposure: float = Field(0, description="Total exposure value")
    
    @validator("total_exposure", always=True)
    def calculate_total(cls, v, values):
        if v == 0 and "entities" in values:
            return sum(e.value for e in values["entities"])
        return v


class NetworkEdge(BaseModel):
    """Edge in network topology."""
    from_id: str = Field(..., alias="from", description="Source node ID")
    to_id: str = Field(..., alias="to", description="Target node ID")
    weight: float = Field(1.0, ge=0, le=1, description="Edge weight/strength")
    edge_type: str = Field("financial", description="Edge type (financial, physical, operational)")
    
    class Config:
        populate_by_name = True


class NetworkTopology(BaseModel):
    """Network topology for cascade modeling."""
    nodes: List[str] = Field(default_factory=list, description="List of node IDs")
    edges: List[NetworkEdge] = Field(default_factory=list, description="List of edges")
    adjacency_matrix: Optional[str] = Field(None, description="Base64-encoded adjacency matrix")


class HistoricalEvent(BaseModel):
    """Historical event for context."""
    name: str = Field(..., description="Event name")
    date: str = Field(..., description="Event date (YYYY-MM-DD)")
    actual_loss: float = Field(..., description="Actual loss amount")
    severity: float = Field(..., ge=0, le=1, description="Severity level")
    lessons: List[str] = Field(default_factory=list, description="Lessons learned")


class HistoricalContext(BaseModel):
    """Historical context for calibration."""
    similar_events: List[HistoricalEvent] = Field(default_factory=list, description="Similar historical events")


class RegulatoryRequirements(BaseModel):
    """Regulatory compliance requirements."""
    frameworks: List[str] = Field(default_factory=lambda: ["EBA", "TCFD"], description="Applicable frameworks")
    capital_requirements: bool = Field(True, description="Capital calculation required")
    disclosure_required: bool = Field(True, description="Disclosure required")


class CalculationConfig(BaseModel):
    """Calculation configuration."""
    monte_carlo_simulations: int = Field(10000, ge=1000, le=100000, description="Number of MC simulations")
    confidence_levels: List[float] = Field(default_factory=lambda: [0.90, 0.95, 0.99], description="Confidence levels")
    time_horizons: List[str] = Field(default_factory=lambda: ["1d", "1w", "1m", "1y"], description="Time horizons")
    cascade_iterations: int = Field(10, ge=1, le=50, description="Max cascade iterations")
    correlation_matrix: Optional[str] = Field(None, description="Base64-encoded correlation matrix or reference")


class DurationDefinition(BaseModel):
    """Duration definition for scenario."""
    acute_phase: str = Field("days", description="Acute phase duration (hours, days, weeks)")
    recovery_phase: str = Field("months", description="Recovery phase duration (months, years)")


class ScenarioDefinition(BaseModel):
    """Stress scenario definition."""
    type: ScenarioType = Field(..., description="Scenario type")
    subtype: Optional[str] = Field(None, description="Specific event type")
    severity: float = Field(..., ge=0, le=1, description="Severity level")
    probability: float = Field(0.01, ge=0, le=1, description="Annual probability")
    geographic_scope: List[str] = Field(default_factory=list, description="Affected regions")
    duration: Optional[DurationDefinition] = Field(None, description="Duration definition")
    description: str = Field("", description="Natural language scenario description")


class StressTestMetadata(BaseModel):
    """Stress test metadata."""
    test_id: Optional[str] = Field(None, description="Unique test identifier")
    created_at: datetime = Field(default_factory=datetime.utcnow, description="Creation timestamp")
    sector: SectorType = Field(..., description="Primary sector")
    criticality: CriticalityLevel = Field(CriticalityLevel.MEDIUM, description="Criticality level")
    timeline: TimelineType = Field(TimelineType.HOURS_72, description="Response timeline")
    target_risk_reduction: float = Field(0.25, ge=0, le=1, description="Target risk reduction")


class UniversalStressTestInput(BaseModel):
    """
    Universal Stress Test Input Schema.
    
    Implements Part 4.1 of Universal Stress Testing Methodology.
    """
    metadata: StressTestMetadata = Field(..., description="Test metadata")
    scenario_definition: ScenarioDefinition = Field(..., description="Scenario definition")
    exposure_data: SectorExposureData = Field(..., description="Exposure data")
    network_topology: Optional[NetworkTopology] = Field(None, description="Network topology")
    historical_context: Optional[HistoricalContext] = Field(None, description="Historical context")
    regulatory_requirements: Optional[RegulatoryRequirements] = Field(None, description="Regulatory requirements")
    calculation_config: Optional[CalculationConfig] = Field(None, description="Calculation config")
    
    class Config:
        json_schema_extra = {
            "example": {
                "metadata": {
                    "sector": "financial",
                    "criticality": "high",
                    "timeline": "24h",
                    "target_risk_reduction": 0.25
                },
                "scenario_definition": {
                    "type": "climate",
                    "subtype": "flood",
                    "severity": 0.85,
                    "probability": 0.01,
                    "geographic_scope": ["Frankfurt", "Rhine Valley"],
                    "description": "100-year flood event affecting Rhine Valley financial district"
                },
                "exposure_data": {
                    "entities": [
                        {"id": "hq_1", "name": "HQ Building", "value": 500000000, "criticality": "critical"}
                    ],
                    "total_exposure": 500000000
                }
            }
        }


# =============================================================================
# OUTPUT SCHEMAS
# =============================================================================

class ExecutiveSummary(BaseModel):
    """Executive summary of stress test results."""
    headline: str = Field(..., description="One-line headline")
    severity_rating: float = Field(..., ge=0, le=1, description="Overall severity rating")
    confidence_level: float = Field(..., ge=0, le=1, description="Model confidence")
    immediate_actions_required: bool = Field(False, description="Immediate action flag")
    regulatory_disclosure_required: bool = Field(False, description="Disclosure required")


class LossDistribution(BaseModel):
    """Loss distribution statistics."""
    mean: float = Field(..., description="Mean loss")
    median: float = Field(..., description="Median loss")
    std_dev: float = Field(..., description="Standard deviation")
    var_95: float = Field(..., description="VaR at 95%")
    var_99: float = Field(..., description="VaR at 99%")
    cvar_99: float = Field(..., description="CVaR/ES at 99%")
    max_plausible: float = Field(..., description="Maximum plausible loss")
    confidence_interval_90: Tuple[float, float] = Field(..., description="90% CI")
    percentiles: Dict[str, float] = Field(default_factory=dict, description="Loss percentiles")


class LossAccumulationPoint(BaseModel):
    """Point on loss accumulation curve."""
    time: str = Field(..., description="Time label (e.g., T+24h)")
    cumulative_loss: float = Field(..., description="Cumulative loss at this point")


class RecoveryPhase(BaseModel):
    """Recovery phase definition."""
    name: str = Field(..., description="Phase name")
    start: str = Field(..., description="Start time")
    end: str = Field(..., description="End time")
    description: Optional[str] = Field(None, description="Phase description")


class TimelineAnalysis(BaseModel):
    """Timeline analysis results."""
    rto_critical_operations: str = Field(..., description="RTO for critical operations")
    rto_full_recovery: str = Field(..., description="RTO for full recovery")
    loss_accumulation_curve: List[LossAccumulationPoint] = Field(default_factory=list, description="Loss curve")
    phases: List[RecoveryPhase] = Field(default_factory=list, description="Recovery phases")


class CrossSectorTransmission(BaseModel):
    """Cross-sector loss transmission."""
    to_insurance: float = Field(0, description="Transmission to insurance sector")
    to_banking: float = Field(0, description="Transmission to banking sector")
    to_real_estate: float = Field(0, description="Transmission to real estate sector")
    to_supply_chain: float = Field(0, description="Transmission to supply chain")


class CascadeAnalysis(BaseModel):
    """Cascade/contagion analysis results."""
    amplification_factor: float = Field(..., description="Loss amplification factor")
    direct_loss: float = Field(..., description="Direct loss amount")
    indirect_loss: float = Field(..., description="Indirect/cascade loss")
    total_economic_impact: float = Field(..., description="Total economic impact")
    critical_path: List[str] = Field(default_factory=list, description="Critical cascade path")
    single_points_of_failure: List[str] = Field(default_factory=list, description="SPOFs identified")
    cross_sector_transmission: Optional[CrossSectorTransmission] = Field(None, description="Cross-sector effects")


class KeyTrigger(BaseModel):
    """Key trigger/indicator."""
    indicator: str = Field(..., description="Indicator name")
    current: float = Field(..., description="Current value")
    threshold: float = Field(..., description="Threshold value")


class PredictiveIndicators(BaseModel):
    """Predictive indicators and early warning."""
    current_alert_level: AlertLevel = Field(..., description="Current alert level")
    probability_next_24h: float = Field(..., ge=0, le=1, description="24h probability")
    probability_next_72h: float = Field(..., ge=0, le=1, description="72h probability")
    key_triggers: List[KeyTrigger] = Field(default_factory=list, description="Key triggers")
    early_warning_signal: str = Field("NORMAL", description="Early warning signal")


class UncertaintyDecomposition(BaseModel):
    """Uncertainty decomposition by source."""
    hazard: float = Field(..., description="Hazard uncertainty (%)")
    exposure: float = Field(..., description="Exposure uncertainty (%)")
    vulnerability: float = Field(..., description="Vulnerability uncertainty (%)")
    combined: float = Field(..., description="Combined uncertainty (%)")


class ModelMetadata(BaseModel):
    """Model and calculation metadata."""
    monte_carlo_simulations: int = Field(..., description="Number of MC simulations")
    model_version: str = Field("2.0.0", description="Model version")
    data_quality_score: float = Field(..., ge=0, le=1, description="Data quality score")
    uncertainty_decomposition: Optional[UncertaintyDecomposition] = Field(None, description="Uncertainty breakdown")
    limitations: List[str] = Field(default_factory=list, description="Model limitations")
    backtesting_accuracy: Optional[float] = Field(None, ge=0, le=1, description="Backtesting accuracy")
    methodology: str = Field("Universal Stress Testing v1.0", description="Methodology reference")


class ActionItem(BaseModel):
    """Single action item in action plan."""
    id: int = Field(..., description="Action ID")
    description: str = Field(..., description="Action description")
    owner: str = Field(..., description="Responsible party")
    resources_required: List[str] = Field(default_factory=list, description="Required resources")
    success_metric: str = Field("", description="Success metric")
    risk_reduction: float = Field(0, ge=0, le=1, description="Expected risk reduction")


class ActionPhase(BaseModel):
    """Action plan phase."""
    timeline: str = Field(..., description="Phase timeline")
    actions: List[ActionItem] = Field(default_factory=list, description="Actions in phase")


class ActionPlanOutput(BaseModel):
    """Complete action plan output."""
    phase_1: ActionPhase = Field(..., description="Emergency phase")
    phase_2: Optional[ActionPhase] = Field(None, description="Stabilization phase")
    phase_3: Optional[ActionPhase] = Field(None, description="Recovery phase")


class RegulatoryFrameworkCompliance(BaseModel):
    """Single regulatory framework compliance."""
    aligned: bool = Field(..., description="Alignment status")
    capital_impact_cet1_bps: Optional[int] = Field(None, description="CET1 impact in bps")
    disclosure_ready: bool = Field(True, description="Disclosure readiness")


class RegulatoryMapping(BaseModel):
    """Regulatory mapping results."""
    eba_climate: Optional[RegulatoryFrameworkCompliance] = Field(None, description="EBA climate compliance")
    tcfd: Optional[RegulatoryFrameworkCompliance] = Field(None, description="TCFD compliance")
    ngfs: Optional[RegulatoryFrameworkCompliance] = Field(None, description="NGFS compliance")
    ccar: Optional[RegulatoryFrameworkCompliance] = Field(None, description="CCAR compliance")


class UniversalStressTestOutput(BaseModel):
    """
    Universal Stress Test Output Schema.
    
    Implements Part 6.1 of Universal Stress Testing Methodology.
    """
    executive_summary: ExecutiveSummary = Field(..., description="Executive summary")
    loss_distribution: LossDistribution = Field(..., description="Loss distribution")
    timeline_analysis: TimelineAnalysis = Field(..., description="Timeline analysis")
    cascade_analysis: CascadeAnalysis = Field(..., description="Cascade analysis")
    predictive_indicators: PredictiveIndicators = Field(..., description="Predictive indicators")
    model_metadata: ModelMetadata = Field(..., description="Model metadata")
    action_plan: Optional[ActionPlanOutput] = Field(None, description="Action plan")
    regulatory_mapping: Optional[RegulatoryMapping] = Field(None, description="Regulatory mapping")
    
    # Additional fields for Report V2 compatibility
    sector_metrics: Optional[Dict[str, Any]] = Field(None, description="Sector-specific metrics")
    financial_contagion: Optional[Dict[str, Any]] = Field(None, description="Financial contagion details")
    stakeholder_impacts: Optional[Dict[str, Any]] = Field(None, description="Stakeholder impacts")
    
    class Config:
        json_schema_extra = {
            "example": {
                "executive_summary": {
                    "headline": "Critical flood risk with €2.7B expected loss",
                    "severity_rating": 0.85,
                    "confidence_level": 0.75,
                    "immediate_actions_required": True,
                    "regulatory_disclosure_required": True
                },
                "loss_distribution": {
                    "mean": 2700000000,
                    "median": 2100000000,
                    "std_dev": 1400000000,
                    "var_95": 4200000000,
                    "var_99": 5800000000,
                    "cvar_99": 6900000000,
                    "max_plausible": 8200000000,
                    "confidence_interval_90": [1800000000, 4500000000],
                    "percentiles": {"p5": 900000000, "p95": 4200000000}
                }
            }
        }
