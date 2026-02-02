"""
What-If Simulator & Cascade Analysis API Endpoints.

Provides:
- Scenario creation and simulation
- Sensitivity analysis
- Scenario comparison
- Cascade modeling
- Network vulnerability analysis
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
import structlog

from src.services.whatif_simulator import (
    whatif_simulator,
    ScenarioType,
    ParameterType,
)
from src.services.cascade_gnn import (
    cascade_gnn_service,
    NodeType,
    EdgeType,
    GraphNode,
    GraphEdge,
)

logger = structlog.get_logger()
router = APIRouter()


# ==================== REQUEST/RESPONSE MODELS ====================

class ParameterUpdate(BaseModel):
    """Parameter value update."""
    name: str
    value: float


class ScenarioCreate(BaseModel):
    """Create a new scenario."""
    name: str
    scenario_type: str = "custom"
    parameters: Dict[str, float]
    description: str = ""


class RunScenarioRequest(BaseModel):
    """Run a scenario simulation."""
    scenario_id: str
    base_exposure: float = Field(100_000_000, description="Base portfolio exposure")
    num_simulations: int = Field(10000, ge=1000, le=100000)


class SensitivityRequest(BaseModel):
    """Sensitivity analysis request."""
    parameter_name: str
    num_points: int = Field(11, ge=5, le=21)
    base_exposure: float = 100_000_000


class CompareRequest(BaseModel):
    """Scenario comparison request."""
    scenario_ids: List[str]
    base_exposure: float = 100_000_000
    parameters: Optional[Dict[str, float]] = None  # Override: event_severity, event_probability, portfolio_exposure, mitigation_level, recovery_speed, asset_correlation


class OptimizeRequest(BaseModel):
    """Mitigation optimization request."""
    budget: float = Field(..., description="Available budget for mitigation")
    base_exposure: float = 100_000_000


class CascadeNodeRequest(BaseModel):
    """Add a node to cascade graph."""
    id: str
    node_type: str = "asset"
    name: str
    value: float
    risk_score: float = Field(50, ge=0, le=100)
    sector: str = "General"
    region: str = "Default"


class CascadeEdgeRequest(BaseModel):
    """Add an edge to cascade graph."""
    source_id: str
    target_id: str
    edge_type: str = "physical"
    weight: float = Field(0.5, ge=0, le=1)


class CascadeSimRequest(BaseModel):
    """Cascade simulation request."""
    trigger_node_id: str
    trigger_severity: float = Field(0.8, ge=0, le=1)
    max_steps: int = Field(10, ge=1, le=50)
    propagation_threshold: float = Field(0.1, ge=0, le=1)


class BuildFromContextRequest(BaseModel):
    """Build cascade graph from city and scenario context."""
    city_id: str
    scenario_id: str


class ScenarioResponse(BaseModel):
    """Scenario response."""
    id: str
    name: str
    scenario_type: str
    parameters: Dict[str, float]
    description: str


class ScenarioResultResponse(BaseModel):
    """Scenario simulation result."""
    scenario_id: str
    scenario_name: str
    expected_loss: float
    var_95: float
    var_99: float
    cvar: float
    probability_of_loss: float
    recovery_time_months: float
    risk_score: float
    key_metrics: Dict[str, Any]


class SensitivityResponse(BaseModel):
    """Sensitivity analysis result."""
    parameter_name: str
    base_value: float
    values_tested: List[float]
    output_metric: str
    output_values: List[float]
    elasticity: float
    is_critical: bool


class ComparisonResponse(BaseModel):
    """Scenario comparison result."""
    best_scenario: str
    worst_scenario: str
    baseline_scenario: str
    loss_range: List[float]
    key_differences: List[Dict[str, Any]]
    recommendations: List[str]
    scenarios: List[ScenarioResultResponse]


class CascadeResultResponse(BaseModel):
    """Cascade simulation result."""
    trigger_node: str
    trigger_severity: float
    simulation_steps: int
    affected_nodes: List[str]
    affected_count: int
    total_loss: float
    peak_affected_time: int
    critical_nodes: List[str]
    containment_points: List[str]
    node_impacts: Dict[str, float]


class VulnerabilityResponse(BaseModel):
    """Network vulnerability analysis."""
    most_critical_nodes: List[Dict[str, Any]]
    single_points_of_failure: List[str]
    network_resilience_score: float
    recommendations: List[str]


# ==================== WHAT-IF SIMULATOR ENDPOINTS ====================

@router.get("/parameters")
async def get_parameters():
    """Get all adjustable parameters."""
    return {
        "parameters": [
            {
                "name": p.name,
                "type": p.param_type.value,
                "base_value": p.base_value,
                "current_value": p.current_value,
                "min_value": p.min_value,
                "max_value": p.max_value,
                "unit": p.unit,
                "description": p.description,
            }
            for p in whatif_simulator.parameters.values()
        ]
    }


@router.post("/parameters")
async def update_parameter(update: ParameterUpdate):
    """Update a parameter value."""
    success = whatif_simulator.set_parameter(update.name, update.value)
    
    if not success:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid parameter '{update.name}' or value out of range"
        )
    
    return {"status": "updated", "parameter": update.name, "value": update.value}


@router.post("/scenarios", response_model=ScenarioResponse)
async def create_scenario(request: ScenarioCreate):
    """Create a new what-if scenario."""
    try:
        scenario_type = ScenarioType(request.scenario_type)
    except ValueError:
        scenario_type = ScenarioType.CUSTOM
    
    scenario = whatif_simulator.create_scenario(
        name=request.name,
        scenario_type=scenario_type,
        parameters=request.parameters,
        description=request.description,
    )
    
    return ScenarioResponse(
        id=scenario.id,
        name=scenario.name,
        scenario_type=scenario.scenario_type.value,
        parameters=scenario.parameters,
        description=scenario.description,
    )


@router.get("/scenarios")
async def list_scenarios():
    """List all scenarios."""
    return {
        "scenarios": [
            {
                "id": s.id,
                "name": s.name,
                "scenario_type": s.scenario_type.value,
                "parameters": s.parameters,
                "description": s.description,
            }
            for s in whatif_simulator.scenarios.values()
        ]
    }


@router.post("/scenarios/predefined")
async def create_predefined_scenarios():
    """Create standard predefined scenarios (Baseline, Optimistic, Pessimistic, Stress)."""
    whatif_simulator.create_predefined_scenarios()
    
    return {
        "status": "created",
        "scenarios": list(whatif_simulator.scenarios.keys()),
    }


@router.post("/run", response_model=ScenarioResultResponse)
async def run_scenario(request: RunScenarioRequest):
    """Run a scenario simulation."""
    try:
        result = await whatif_simulator.run_scenario(
            scenario_id=request.scenario_id,
            base_exposure=request.base_exposure,
            num_simulations=request.num_simulations,
        )
        
        logger.info(
            "Scenario simulation completed",
            scenario=request.scenario_id,
            expected_loss=result.expected_loss,
        )
        
        return ScenarioResultResponse(
            scenario_id=result.scenario_id,
            scenario_name=result.scenario_name,
            expected_loss=result.expected_loss,
            var_95=result.var_95,
            var_99=result.var_99,
            cvar=result.cvar,
            probability_of_loss=result.probability_of_loss,
            recovery_time_months=result.recovery_time_months,
            risk_score=result.risk_score,
            key_metrics=result.key_metrics,
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/sensitivity", response_model=SensitivityResponse)
async def run_sensitivity_analysis(request: SensitivityRequest):
    """Run sensitivity analysis on a parameter."""
    try:
        result = await whatif_simulator.run_sensitivity_analysis(
            parameter_name=request.parameter_name,
            num_points=request.num_points,
            base_exposure=request.base_exposure,
        )
        
        return SensitivityResponse(
            parameter_name=result.parameter_name,
            base_value=result.base_value,
            values_tested=result.values_tested,
            output_metric=result.output_metric,
            output_values=result.output_values,
            elasticity=result.elasticity,
            is_critical=result.is_critical,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/compare", response_model=ComparisonResponse)
async def compare_scenarios(request: CompareRequest):
    """Compare multiple scenarios."""
    if len(request.scenario_ids) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 scenarios to compare")
    
    result = await whatif_simulator.compare_scenarios(
        scenario_ids=request.scenario_ids,
        base_exposure=request.base_exposure,
        parameters=request.parameters,
    )
    
    return ComparisonResponse(
        best_scenario=result.best_scenario,
        worst_scenario=result.worst_scenario,
        baseline_scenario=result.baseline_scenario,
        loss_range=list(result.loss_range),
        key_differences=result.key_differences,
        recommendations=result.recommendations,
        scenarios=[
            ScenarioResultResponse(
                scenario_id=s.scenario_id,
                scenario_name=s.scenario_name,
                expected_loss=s.expected_loss,
                var_95=s.var_95,
                var_99=s.var_99,
                cvar=s.cvar,
                probability_of_loss=s.probability_of_loss,
                recovery_time_months=s.recovery_time_months,
                risk_score=s.risk_score,
                key_metrics=s.key_metrics,
            )
            for s in result.scenarios
        ],
    )


@router.post("/optimize")
async def optimize_mitigation(request: OptimizeRequest):
    """Optimize mitigation strategy within budget."""
    result = await whatif_simulator.optimize_mitigation(
        budget=request.budget,
        base_exposure=request.base_exposure,
    )
    
    return {
        "optimal_parameters": result.optimal_parameters,
        "expected_improvement_pct": result.expected_improvement,
        "cost_of_mitigation": result.cost_of_mitigation,
        "roi_pct": result.roi,
        "implementation_priority": result.implementation_priority,
        "constraints_binding": result.constraints_binding,
    }


# ==================== CASCADE ANALYSIS ENDPOINTS ====================

@router.get("")
async def whatif_root():
    """What-If service info; confirms /whatif is mounted."""
    return {"service": "whatif", "cascade_simulate": "POST /api/v1/whatif/cascade/simulate"}


@router.post("/cascade/nodes")
async def add_cascade_node(request: CascadeNodeRequest):
    """Add a node to the cascade graph."""
    try:
        node_type = NodeType(request.node_type)
    except ValueError:
        node_type = NodeType.ASSET
    
    node = GraphNode(
        id=request.id,
        node_type=node_type,
        name=request.name,
        value=request.value,
        risk_score=request.risk_score,
        sector=request.sector,
        region=request.region,
    )
    
    cascade_gnn_service.add_node(node)
    
    return {"status": "added", "node_id": request.id}


@router.post("/cascade/edges")
async def add_cascade_edge(request: CascadeEdgeRequest):
    """Add an edge to the cascade graph."""
    try:
        edge_type = EdgeType(request.edge_type)
    except ValueError:
        edge_type = EdgeType.PHYSICAL
    
    edge = GraphEdge(
        source_id=request.source_id,
        target_id=request.target_id,
        edge_type=edge_type,
        weight=request.weight,
    )
    
    cascade_gnn_service.add_edge(edge)
    
    return {"status": "added", "edge": f"{request.source_id} -> {request.target_id}"}


@router.post("/cascade/build")
async def build_cascade_graph():
    """Build the cascade graph from added nodes and edges."""
    cascade_gnn_service.build_graph()
    
    return {
        "status": "built",
        "nodes": len(cascade_gnn_service.nodes),
        "edges": len(cascade_gnn_service.edges),
    }


@router.post("/cascade/build-from-context")
async def build_cascade_from_context(request: BuildFromContextRequest):
    """Build cascade graph from city and scenario context (geodata + scenario-type template)."""
    cascade_gnn_service.build_graph_for_city_scenario(
        city_id=request.city_id,
        scenario_id=request.scenario_id,
    )
    return {
        "status": "built",
        "nodes": [
            {
                "id": n.id,
                "name": n.name,
                "type": n.node_type.value,
                "value": n.value,
                "risk_score": n.risk_score,
                "sector": n.sector,
                "region": n.region,
            }
            for n in cascade_gnn_service.nodes.values()
        ],
        "edges": [
            {
                "source": e.source_id,
                "target": e.target_id,
                "type": e.edge_type.value,
                "weight": e.weight,
            }
            for e in cascade_gnn_service.edges
        ],
    }


@router.post("/cascade/sample")
async def create_sample_graph(num_nodes: int = Query(20, ge=5, le=100)):
    """Create a sample cascade graph for testing."""
    cascade_gnn_service.create_sample_graph(num_nodes)
    
    return {
        "status": "created",
        "nodes": len(cascade_gnn_service.nodes),
        "edges": len(cascade_gnn_service.edges),
    }


@router.post("/cascade/simulate", response_model=CascadeResultResponse)
async def simulate_cascade(request: CascadeSimRequest):
    """Simulate cascade propagation from trigger node."""
    if not cascade_gnn_service.nodes:
        raise HTTPException(
            status_code=400,
            detail="No nodes in graph. Add nodes or create sample graph first."
        )
    
    try:
        result = await cascade_gnn_service.simulate_cascade(
            trigger_node_id=request.trigger_node_id,
            trigger_severity=request.trigger_severity,
            max_steps=request.max_steps,
            propagation_threshold=request.propagation_threshold,
        )
        
        logger.info(
            "Cascade simulation completed",
            trigger=request.trigger_node_id,
            affected=len(result.affected_nodes),
            total_loss=result.total_loss,
        )
        
        return CascadeResultResponse(
            trigger_node=result.trigger_node,
            trigger_severity=result.trigger_severity,
            simulation_steps=result.simulation_steps,
            affected_nodes=result.affected_nodes,
            affected_count=len(result.affected_nodes),
            total_loss=result.total_loss,
            peak_affected_time=result.peak_affected_time,
            critical_nodes=result.critical_nodes,
            containment_points=result.containment_points,
            node_impacts=result.node_impacts,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e


@router.get("/cascade/vulnerability", response_model=VulnerabilityResponse)
async def analyze_vulnerability():
    """Analyze network vulnerability."""
    result = await cascade_gnn_service.analyze_vulnerability()
    
    return VulnerabilityResponse(
        most_critical_nodes=[
            {"node_id": n, "criticality": c}
            for n, c in result.most_critical_nodes
        ],
        single_points_of_failure=result.single_points_of_failure,
        network_resilience_score=result.network_resilience_score,
        recommendations=result.recommendations,
    )


@router.get("/cascade/graph")
async def get_cascade_graph():
    """Get current cascade graph structure."""
    return {
        "nodes": [
            {
                "id": n.id,
                "name": n.name,
                "type": n.node_type.value,
                "value": n.value,
                "risk_score": n.risk_score,
                "sector": n.sector,
                "region": n.region,
            }
            for n in cascade_gnn_service.nodes.values()
        ],
        "edges": [
            {
                "source": e.source_id,
                "target": e.target_id,
                "type": e.edge_type.value,
                "weight": e.weight,
            }
            for e in cascade_gnn_service.edges
        ],
    }


def _edge_type_to_link_type(et: str) -> str:
    """Map cascade EdgeType to EventRiskGraph link type."""
    m = {"physical": "operational", "financial": "financial", "operational": "operational", "supply": "supply", "utility": "operational"}
    return m.get((et or "").lower(), "operational")


@router.get("/cascade/event-graph")
async def get_event_graph_from_stress(
    scenario_id: str = Query(..., description="Scenario ID (e.g. seismic_shock, credit_crunch)"),
    city_id: str = Query("default", description="City ID for geodata; use 'default' when unknown"),
):
    """
    Build cascade graph from stress test context (city + scenario) and return it
    in EventRiskGraph format. Used when stressTestId/scenarioId are passed into
    EventRiskGraph; on 4xx/5xx the frontend falls back to static templates.
    """
    try:
        cascade_gnn_service.build_graph_for_city_scenario(
            city_id=city_id or "default",
            scenario_id=scenario_id,
        )
    except Exception as e:
        logger.warning("build_graph_for_city_scenario failed", error=str(e))
        raise HTTPException(status_code=400, detail=str(e))
    nodes = []
    for n in cascade_gnn_service.nodes.values():
        nodes.append({
            "id": n.id,
            "name": n.name,
            "type": n.node_type.value,
            "value": max(1, n.value / 1e6),
            "risk": n.risk_score / 100.0,
        })
    links = []
    for e in cascade_gnn_service.edges:
        links.append({
            "source": e.source_id,
            "target": e.target_id,
            "strength": e.weight,
            "type": _edge_type_to_link_type(e.edge_type.value),
        })
    return {"nodes": nodes, "links": links}
