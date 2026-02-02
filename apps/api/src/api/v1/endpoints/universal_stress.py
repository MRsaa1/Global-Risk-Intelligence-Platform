"""
Universal Stress Test API Endpoints
===================================

Implements the Universal Stress Testing Methodology API.

Endpoints:
- POST /stress-tests/universal - Execute full methodology
- GET /stress-tests/sectors/{sector}/parameters - Get sector parameter schemas
- POST /stress-tests/validate-schema - Validate input schema

Reference: Universal Stress Testing Methodology v1.0
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Path, BackgroundTasks
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/stress-tests", tags=["Universal Stress Testing"])


# =============================================================================
# REQUEST/RESPONSE MODELS
# =============================================================================

class ExposureEntity(BaseModel):
    """Single exposure entity."""
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    value: float = Field(..., gt=0)
    criticality: str = Field("medium", pattern="^(critical|high|medium|low)$")
    dependencies: List[str] = Field(default_factory=list)


class UniversalStressRequest(BaseModel):
    """Request for universal stress test execution."""
    # Metadata
    sector: str = Field(..., description="Sector type", pattern="^(insurance|real_estate|financial|enterprise|defense)$")
    criticality: str = Field("high", pattern="^(critical|high|medium|low)$")
    timeline: str = Field("72h", description="Response timeline")
    
    # Scenario
    scenario_type: str = Field(..., description="Scenario type (flood, seismic, financial, cyber, etc.)")
    scenario_description: str = Field("", description="Natural language scenario description")
    severity: float = Field(..., ge=0, le=1, description="Severity level")
    probability: float = Field(0.01, ge=0, le=1, description="Annual probability")
    geographic_scope: List[str] = Field(default_factory=list, description="Affected regions")
    
    # Exposure
    entities: List[ExposureEntity] = Field(default_factory=list, description="Exposed entities")
    total_exposure: Optional[float] = Field(None, description="Total exposure if entities not provided")
    
    # Configuration
    monte_carlo_simulations: int = Field(10000, ge=1000, le=100000)
    include_cascade: bool = Field(True, description="Include cascade/contagion analysis")
    include_recovery: bool = Field(True, description="Include recovery timeline")
    use_nim: bool = Field(False, description="Use NVIDIA NIM for narrative generation")
    
    class Config:
        json_schema_extra = {
            "example": {
                "sector": "financial",
                "criticality": "high",
                "scenario_type": "flood",
                "scenario_description": "100-year flood affecting Rhine Valley financial district",
                "severity": 0.85,
                "probability": 0.01,
                "geographic_scope": ["Frankfurt", "Mainz"],
                "entities": [
                    {"name": "HQ Building", "value": 500000000, "criticality": "critical"}
                ],
                "monte_carlo_simulations": 10000
            }
        }


class LossDistributionResponse(BaseModel):
    """Loss distribution statistics."""
    mean_loss: float
    median_loss: float
    std_dev: float
    var_95: float
    var_99: float
    cvar_99: float
    confidence_interval_90: List[float]
    percentiles: Dict[str, float]
    monte_carlo_runs: int
    methodology: str = "Gaussian copula Monte Carlo"


class TimelineResponse(BaseModel):
    """Timeline analysis response."""
    rto_critical_hours: float
    rto_full_hours: float
    rpo_hours: float
    timeline_days: float
    phases: List[Dict[str, Any]]
    critical_path: List[str]


class CascadeResponse(BaseModel):
    """Cascade analysis response."""
    amplification_factor: float
    direct_loss: float
    cascade_loss: float
    total_economic_impact: float
    critical_nodes: List[Dict[str, Any]]
    cascade_path: str
    cross_sector_transmission: Dict[str, float]


class UniversalStressResponse(BaseModel):
    """Response from universal stress test."""
    test_id: str
    timestamp: datetime
    sector: str
    scenario_type: str
    severity: float
    
    # Results
    executive_summary: Dict[str, Any]
    loss_distribution: LossDistributionResponse
    timeline_analysis: Optional[TimelineResponse] = None
    cascade_analysis: Optional[CascadeResponse] = None
    
    # Additional metrics
    financial_contagion: Optional[Dict[str, Any]] = None
    predictive_indicators: Optional[Dict[str, Any]] = None
    sector_metrics: Optional[Dict[str, Any]] = None
    
    # Report V2 (full)
    report_v2: Optional[Dict[str, Any]] = None
    
    # Metadata
    model_metadata: Dict[str, Any]


class SectorParametersResponse(BaseModel):
    """Sector parameter schema response."""
    sector: str
    description: str
    required_inputs: List[Dict[str, Any]]
    optional_inputs: List[Dict[str, Any]]
    formulas: Dict[str, str]
    example: Dict[str, Any]


class ValidationResponse(BaseModel):
    """Schema validation response."""
    valid: bool
    errors: List[str] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    normalized_input: Optional[Dict[str, Any]] = None


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.post("/universal", response_model=UniversalStressResponse)
async def execute_universal_stress_test(
    request: UniversalStressRequest,
    background_tasks: BackgroundTasks
) -> UniversalStressResponse:
    """
    Execute a universal stress test using the full methodology.
    
    This endpoint implements the complete Universal Stress Testing Methodology:
    - Master Loss Equation: L = Σ [EAD × LGD × PD × (1 + CF)] × DF
    - Monte Carlo simulation with Gaussian copula
    - Cross-sector contagion via transmission matrix
    - Dynamic recovery timeline calculation
    - Sector-specific metrics
    
    Returns comprehensive stress test results including loss distribution,
    timeline analysis, cascade effects, and Report V2 metrics.
    """
    test_id = str(uuid.uuid4())
    
    try:
        # Import engines
        from src.services.universal_stress_engine import (
            execute_universal_stress_test as run_stress_test,
            create_exposures_from_assets,
            SectorType
        )
        from src.services.contagion_matrix import (
            calculate_financial_contagion,
            get_infrastructure_cascade_path
        )
        from src.services.recovery_calculator import (
            calculate_recovery_timeline,
            AffectedAsset,
            Priority
        )
        from src.services.sector_calculators import (
            calculate_sector_metrics,
            get_sector_default_inputs
        )
        from src.services.stress_report_metrics import compute_report_v2
        
        # Convert sector string to enum
        sector_enum = SectorType(request.sector)
        
        # Build exposures
        if request.entities:
            from src.services.universal_stress_engine import ExposureEntity as EngineExposure
            exposures = []
            for entity in request.entities:
                exp = EngineExposure(
                    id=entity.id,
                    name=entity.name,
                    sector=sector_enum,
                    ead=entity.value,
                    pd=0.03,  # Base PD
                    lgd=0.45,  # Base LGD
                    dependencies=entity.dependencies
                )
                exposures.append(exp)
        else:
            # Create from total exposure
            total = request.total_exposure or 1_000_000_000
            asset_values = [total / 10] * 10  # Split into 10 assets
            exposures = create_exposures_from_assets(
                asset_values=asset_values,
                sector=sector_enum,
                scenario_type=request.scenario_type,
                severity=request.severity
            )
        
        # Run stress test
        stress_result = run_stress_test(
            exposures=exposures,
            scenario_id=test_id,
            scenario_type=request.scenario_type,
            severity=request.severity,
            n_simulations=request.monte_carlo_simulations,
            include_cascade=request.include_cascade
        )
        
        # Build loss distribution response
        mc = stress_result.monte_carlo
        loss_distribution = LossDistributionResponse(
            mean_loss=mc.mean_loss,
            median_loss=mc.median_loss,
            std_dev=mc.std_loss,
            var_95=mc.var_95,
            var_99=mc.var_99,
            cvar_99=mc.cvar_99,
            confidence_interval_90=list(mc.confidence_interval_90),
            percentiles=mc.percentiles,
            monte_carlo_runs=mc.simulation_count,
            methodology="Gaussian copula Monte Carlo"
        )
        
        # Timeline analysis
        timeline_analysis = None
        if request.include_recovery:
            affected_assets = [
                AffectedAsset(
                    id=exp.id,
                    name=exp.name,
                    priority=Priority.HIGH if exp.ead > mc.mean_loss / len(exposures) else Priority.MEDIUM,
                    value=exp.ead,
                    dependencies=list(exp.dependencies)
                )
                for exp in exposures
            ]
            
            recovery = calculate_recovery_timeline(
                sector=request.sector,
                severity=request.severity,
                affected_assets=affected_assets
            )
            
            timeline_analysis = TimelineResponse(
                rto_critical_hours=recovery.rto_critical_hours,
                rto_full_hours=recovery.rto_full_hours,
                rpo_hours=recovery.rpo_hours,
                timeline_days=recovery.timeline_days,
                phases=[
                    {
                        "name": p.name,
                        "start_hours": p.start_hours,
                        "end_hours": p.end_hours,
                        "description": p.description
                    }
                    for p in recovery.phases
                ],
                critical_path=recovery.critical_path
            )
        
        # Cascade analysis
        cascade_analysis = None
        financial_contagion = None
        if request.include_cascade:
            contagion = calculate_financial_contagion(
                primary_loss=mc.mean_loss,
                sector=request.sector,
                stress_multiplier=1 + request.severity
            )
            
            cascade_path_data = get_infrastructure_cascade_path(
                request.scenario_type,
                request.severity
            )
            
            cascade_analysis = CascadeResponse(
                amplification_factor=contagion.amplification_factor,
                direct_loss=stress_result.direct_loss,
                cascade_loss=stress_result.cascade_loss,
                total_economic_impact=contagion.total_system_loss,
                critical_nodes=cascade_path_data["critical_nodes"],
                cascade_path=cascade_path_data["cascade_path"],
                cross_sector_transmission={
                    "insurance": contagion.insurance_impact,
                    "real_estate": contagion.real_estate_impact,
                    "financial": contagion.financial_impact,
                    "enterprise": contagion.enterprise_impact,
                    "defense": contagion.defense_impact
                }
            )
            
            financial_contagion = {
                "first_order": contagion.first_order_effects,
                "second_order": contagion.second_order_effects,
                "amplification": contagion.amplification_factor
            }
        
        # Sector metrics
        sector_inputs = get_sector_default_inputs(request.sector, sum(e.ead for e in exposures))
        sector_metrics = calculate_sector_metrics(request.sector, sector_inputs)
        
        # Report V2
        report_v2 = compute_report_v2(
            total_loss=mc.mean_loss / 1_000_000,  # Convert to millions
            zones_count=len(exposures),
            city_name=request.geographic_scope[0] if request.geographic_scope else "Unknown",
            event_type=request.scenario_type,
            severity=request.severity,
            total_buildings_affected=len(exposures),
            total_population_affected=len(exposures) * 1000,
            sector=request.sector
        )
        
        # Build executive summary (include entity/location when provided)
        entity_location = None
        if request.scenario_description:
            entity_location = request.scenario_description.strip()
        elif request.geographic_scope:
            entity_location = ", ".join(request.geographic_scope[:3])
        headline = f"{request.scenario_type.replace('_', ' ').capitalize()} stress test"
        if entity_location:
            headline += f" for {entity_location}"
        headline += f": €{mc.mean_loss/1e6:.1f}M expected loss"
        key_insights = [
            f"VaR 99%: €{mc.var_99/1e6:.1f}M",
            f"Amplification factor: {stress_result.amplification_factor:.2f}x",
            f"Affected entities: {len(exposures)}"
        ]
        if request.scenario_description:
            key_insights.insert(0, f"Context: {request.scenario_description}")
        if request.geographic_scope and not request.scenario_description:
            key_insights.insert(0, f"Location: {', '.join(request.geographic_scope[:3])}")
        executive_summary = {
            "headline": headline,
            "severity_rating": request.severity,
            "confidence_level": 0.75,
            "immediate_actions_required": request.severity > 0.7,
            "regulatory_disclosure_required": request.severity > 0.5,
            "key_insights": key_insights,
            "bullets": key_insights,
        }
        
        # Predictive indicators
        predictive_indicators = report_v2.get("predictive_indicators")
        
        return UniversalStressResponse(
            test_id=test_id,
            timestamp=datetime.utcnow(),
            sector=request.sector,
            scenario_type=request.scenario_type,
            severity=request.severity,
            executive_summary=executive_summary,
            loss_distribution=loss_distribution,
            timeline_analysis=timeline_analysis,
            cascade_analysis=cascade_analysis,
            financial_contagion=financial_contagion,
            predictive_indicators=predictive_indicators,
            sector_metrics=sector_metrics,
            report_v2=report_v2,
            model_metadata={
                "model_version": "2.0.0",
                "methodology": "Universal Stress Testing v1.0",
                "monte_carlo_simulations": request.monte_carlo_simulations,
                "engines_used": {
                    "monte_carlo": True,
                    "contagion_matrix": request.include_cascade,
                    "recovery_calculator": request.include_recovery,
                    "sector_calculators": True
                }
            }
        )
        
    except ImportError as e:
        logger.error(f"Failed to import stress test engines: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Stress test engines not available: {str(e)}"
        )
    except Exception as e:
        logger.error(f"Stress test execution failed: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Stress test execution failed: {str(e)}"
        )


@router.get("/sectors/{sector}/parameters", response_model=SectorParametersResponse)
async def get_sector_parameters(
    sector: str = Path(..., pattern="^(insurance|real_estate|financial|enterprise|defense)$")
) -> SectorParametersResponse:
    """
    Get parameter schema for a specific sector.
    
    Returns the required and optional inputs, formulas, and an example
    for the specified sector.
    """
    # Sector parameter definitions
    SECTOR_SCHEMAS = {
        "insurance": {
            "description": "Insurance companies: policy portfolios, reinsurance, claims",
            "required_inputs": [
                {"name": "available_capital", "type": "float", "description": "Available own funds"},
                {"name": "scr", "type": "float", "description": "Solvency Capital Requirement"},
                {"name": "reserves", "type": "float", "description": "Technical reserves"},
                {"name": "reinsurance_coverage", "type": "float", "description": "Reinsurance recoverables"},
                {"name": "expected_claims", "type": "float", "description": "Expected claims under stress"},
                {"name": "policy_limits", "type": "list[float]", "description": "Policy limits by LoB"}
            ],
            "optional_inputs": [
                {"name": "correlation_factor", "type": "float", "default": 0.3},
                {"name": "loss_ratio_base", "type": "float", "default": 0.65},
                {"name": "stress_multiplier", "type": "float", "default": 1.5}
            ],
            "formulas": {
                "solvency_ratio": "(Available_Capital - Stressed_Losses) / SCR",
                "claims_coverage": "(Reserves + Reinsurance) / Expected_Claims",
                "aggregate_exposure": "Σ(Policy_Limits) × Correlation_Factor",
                "var": "μ + σ × Z(confidence) × √(holding_period)"
            },
            "example": {
                "available_capital": 5000000000,
                "scr": 3000000000,
                "reserves": 8000000000,
                "reinsurance_coverage": 4000000000,
                "expected_claims": 2000000000,
                "policy_limits": [1000000000, 2000000000, 1500000000]
            }
        },
        "real_estate": {
            "description": "Real estate developers: property portfolios, construction, financing",
            "required_inputs": [
                {"name": "cash", "type": "float", "description": "Cash on hand"},
                {"name": "credit_facilities", "type": "float", "description": "Available credit lines"},
                {"name": "burn_rate", "type": "float", "description": "Monthly burn rate"},
                {"name": "current_occupancy", "type": "float", "description": "Current occupancy rate"},
                {"name": "noi_stressed", "type": "float", "description": "NOI under stress"},
                {"name": "debt_service", "type": "float", "description": "Annual debt service"},
                {"name": "debt", "type": "float", "description": "Total debt"},
                {"name": "property_value", "type": "float", "description": "Property value"}
            ],
            "optional_inputs": [
                {"name": "demand_shock", "type": "float", "default": 0.15},
                {"name": "market_decline", "type": "float", "default": 0.18}
            ],
            "formulas": {
                "cash_runway": "(Cash + Facilities) / Burn_Rate",
                "occupancy_stress": "Current_Occupancy × (1 - Demand_Shock)",
                "dscr": "NOI_Stressed / Debt_Service",
                "ltv_stress": "Debt / (Property_Value × (1 - Market_Decline))"
            },
            "example": {
                "cash": 50000000,
                "credit_facilities": 100000000,
                "burn_rate": 5000000,
                "current_occupancy": 0.92,
                "noi_stressed": 30000000,
                "debt_service": 25000000,
                "debt": 400000000,
                "property_value": 600000000
            }
        },
        "financial": {
            "description": "Financial institutions: loan books, trading, liquidity",
            "required_inputs": [
                {"name": "defaults", "type": "float", "description": "Expected defaults under stress"},
                {"name": "lgd", "type": "float", "description": "Loss Given Default"},
                {"name": "total_loans", "type": "float", "description": "Total loan book"},
                {"name": "hqla", "type": "float", "description": "High Quality Liquid Assets"},
                {"name": "net_outflows_30d", "type": "float", "description": "Net outflows over 30 days"},
                {"name": "losses", "type": "float", "description": "Expected losses"},
                {"name": "rwa", "type": "float", "description": "Risk Weighted Assets"},
                {"name": "cet1", "type": "float", "description": "CET1 capital"}
            ],
            "optional_inputs": [
                {"name": "positions", "type": "list[float]", "default": []},
                {"name": "volatilities", "type": "list[float]", "default": []},
                {"name": "confidence", "type": "float", "default": 0.99}
            ],
            "formulas": {
                "npl_ratio": "(Defaults × LGD) / Total_Loans",
                "lcr": "HQLA / Net_Outflows_30d",
                "cet1_impact": "-Losses / RWA",
                "var_trading": "Σ(Position × Volatility × Z × √t)"
            },
            "example": {
                "defaults": 500000000,
                "lgd": 0.45,
                "total_loans": 50000000000,
                "hqla": 8000000000,
                "net_outflows_30d": 5000000000,
                "losses": 1000000000,
                "rwa": 40000000000,
                "cet1": 5000000000
            }
        },
        "enterprise": {
            "description": "Enterprises: revenue, supply chain, operations",
            "required_inputs": [
                {"name": "cash", "type": "float", "description": "Cash on hand"},
                {"name": "revenue", "type": "float", "description": "Annual revenue"},
                {"name": "fixed_costs", "type": "float", "description": "Annual fixed costs"},
                {"name": "inventory_days", "type": "float", "description": "Days of inventory"},
                {"name": "critical_lead_time", "type": "float", "description": "Critical supplier lead time"},
                {"name": "available_workforce", "type": "float", "description": "Available workforce (0-1)"},
                {"name": "required_workforce", "type": "float", "description": "Required workforce (0-1)"}
            ],
            "optional_inputs": [
                {"name": "revenue_decline", "type": "float", "default": 0.25},
                {"name": "process_recovery_times", "type": "list[float]", "default": [7, 14, 21]}
            ],
            "formulas": {
                "cash_runway": "Cash / ((Revenue × (1-Decline)) - Fixed_Costs)",
                "supply_buffer": "Inventory_Days / Critical_Lead_Time",
                "operations_rate": "Available_Workforce / Required_Workforce",
                "recovery_time": "Σ(Process_Recovery) + Dependencies"
            },
            "example": {
                "cash": 100000000,
                "revenue": 500000000,
                "fixed_costs": 200000000,
                "inventory_days": 45,
                "critical_lead_time": 30,
                "available_workforce": 0.85,
                "required_workforce": 1.0
            }
        },
        "defense": {
            "description": "Defense & Security: programs, capabilities, readiness",
            "required_inputs": [
                {"name": "strategic_reserves", "type": "float", "description": "Strategic reserves (days)"},
                {"name": "consumption_rate", "type": "float", "description": "Consumption rate (units/day)"},
                {"name": "operational_units", "type": "int", "description": "Operational units"},
                {"name": "required_units", "type": "int", "description": "Required units"},
                {"name": "redundant_paths", "type": "int", "description": "Redundant paths"},
                {"name": "total_paths", "type": "int", "description": "Total paths"},
                {"name": "required_capability", "type": "float", "description": "Required capability"},
                {"name": "available_capability", "type": "float", "description": "Available capability"}
            ],
            "optional_inputs": [
                {"name": "surge_timeline_days", "type": "int", "default": 30}
            ],
            "formulas": {
                "inventory_coverage": "Strategic_Reserves / Consumption_Rate",
                "readiness_index": "Operational_Units / Required_Units",
                "spof_score": "1 - (Redundant_Paths / Total_Paths)",
                "capability_gap": "Required_Capability - Available_After_Stress"
            },
            "example": {
                "strategic_reserves": 180,
                "consumption_rate": 2,
                "operational_units": 85,
                "required_units": 100,
                "redundant_paths": 2,
                "total_paths": 5,
                "required_capability": 100,
                "available_capability": 75
            }
        }
    }
    
    if sector not in SECTOR_SCHEMAS:
        raise HTTPException(status_code=404, detail=f"Unknown sector: {sector}")
    
    schema = SECTOR_SCHEMAS[sector]
    
    return SectorParametersResponse(
        sector=sector,
        description=schema["description"],
        required_inputs=schema["required_inputs"],
        optional_inputs=schema["optional_inputs"],
        formulas=schema["formulas"],
        example=schema["example"]
    )


@router.post("/validate-schema", response_model=ValidationResponse)
async def validate_stress_test_schema(
    request: Dict[str, Any]
) -> ValidationResponse:
    """
    Validate a stress test input against the universal schema.
    
    Returns validation status, errors, warnings, and normalized input.
    """
    errors = []
    warnings = []
    
    # Required fields
    required_fields = ["sector", "scenario_type", "severity"]
    for field in required_fields:
        if field not in request:
            errors.append(f"Missing required field: {field}")
    
    # Validate sector
    valid_sectors = ["insurance", "real_estate", "financial", "enterprise", "defense"]
    if request.get("sector") and request["sector"] not in valid_sectors:
        errors.append(f"Invalid sector: {request['sector']}. Must be one of: {valid_sectors}")
    
    # Validate severity
    severity = request.get("severity")
    if severity is not None:
        if not isinstance(severity, (int, float)):
            errors.append("severity must be a number")
        elif severity < 0 or severity > 1:
            errors.append("severity must be between 0 and 1")
    
    # Validate probability
    probability = request.get("probability", 0.01)
    if probability < 0 or probability > 1:
        warnings.append("probability should be between 0 and 1")
    
    # Validate entities
    entities = request.get("entities", [])
    if entities:
        for i, entity in enumerate(entities):
            if not isinstance(entity, dict):
                errors.append(f"Entity {i} must be an object")
            elif "value" not in entity:
                errors.append(f"Entity {i} missing required field: value")
            elif entity.get("value", 0) <= 0:
                errors.append(f"Entity {i} value must be positive")
    
    # Check exposure
    if not entities and not request.get("total_exposure"):
        warnings.append("No entities or total_exposure provided; default exposure will be used")
    
    # Normalize input
    normalized = None
    if not errors:
        normalized = {
            "sector": request.get("sector", "enterprise"),
            "scenario_type": request.get("scenario_type", "generic"),
            "severity": request.get("severity", 0.5),
            "probability": request.get("probability", 0.01),
            "criticality": request.get("criticality", "high"),
            "timeline": request.get("timeline", "72h"),
            "entities": entities,
            "total_exposure": request.get("total_exposure"),
            "monte_carlo_simulations": request.get("monte_carlo_simulations", 10000),
            "include_cascade": request.get("include_cascade", True),
            "include_recovery": request.get("include_recovery", True)
        }
    
    return ValidationResponse(
        valid=len(errors) == 0,
        errors=errors,
        warnings=warnings,
        normalized_input=normalized
    )
