"""
Quantum-Inspired Risk Intelligence API endpoints.

- Path integral simulation (trajectory ensembles + interference detection)
- Tunneling detection (black swan barrier analysis)
- Entanglement map (cross-domain correlation propagation)
- Swarm orchestration (parallel particle-observer analysis)
- Uncertainty quantification (Heisenberg-inspired degradation)
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field
from typing import Any, Dict, List, Optional

router = APIRouter(prefix="/quantum", tags=["Quantum Risk Intelligence"])


# ---------- Request/Response models ----------

class PathIntegralRequest(BaseModel):
    risk_chains: Optional[List[Dict[str, Any]]] = None
    time_horizon: int = Field(120, ge=1, le=600)
    num_trajectories_per_chain: int = Field(200, ge=10, le=2000)
    parameter_perturbation_sigma: float = Field(0.15, ge=0.01, le=1.0)


class TunnelingScanRequest(BaseModel):
    portfolio_asset_ids: List[str] = Field(default_factory=list)
    max_compound_events: int = Field(3, ge=2, le=5)
    top_n: int = Field(10, ge=1, le=50)


class EntanglementPropagateRequest(BaseModel):
    changed_domain: str
    delta: float
    asset_scope: Optional[List[str]] = None


class EntanglementRegisterRequest(BaseModel):
    domain_a: str
    domain_b: str
    coefficient: float = Field(..., ge=-1.0, le=1.0)
    mechanism: str = ""
    lag_days: int = 0


class SwarmDeployRequest(BaseModel):
    num_particles: int = Field(50, ge=5, le=500)
    time_horizon: int = Field(120, ge=1, le=600)
    parameter_space: Optional[Dict[str, List[float]]] = None


class UncertaintyRequest(BaseModel):
    current_score: float
    projection_years: float = Field(30, ge=1, le=200)
    score_type: str = "climate"
    data_quality: float = Field(0.8, ge=0.0, le=1.0)


# ---------- Path Integral ----------

@router.post("/path-integral")
async def run_path_integral(req: PathIntegralRequest):
    """Run trajectory ensemble simulation with interference zone detection."""
    from src.services.path_integral import path_integral_simulator, RiskChainConfig

    chains = None
    if req.risk_chains:
        chains = [
            RiskChainConfig(
                chain_id=c.get("chain_id", f"chain_{i}"),
                name=c.get("name", f"Chain {i}"),
                domain=c.get("domain", "climate"),
                base_severity=c.get("base_severity", 0.4),
            )
            for i, c in enumerate(req.risk_chains)
        ]

    result = await path_integral_simulator.simulate_trajectory_ensemble(
        risk_chains=chains,
        time_horizon=req.time_horizon,
        num_trajectories_per_chain=req.num_trajectories_per_chain,
        parameter_perturbation_sigma=req.parameter_perturbation_sigma,
    )

    return {
        "simulation_id": result.simulation_id,
        "trajectories_count": result.trajectories_count,
        "risk_chains_used": result.risk_chains_used,
        "computation_time_ms": result.computation_time_ms,
        "interference_zones": [
            {
                "asset_id": z.asset_id,
                "time_step": z.time_step,
                "converging_chains": z.converging_chains,
                "amplification_ratio": z.amplification_ratio,
                "combined_loss": z.combined_loss,
                "resonance_type": z.resonance_type,
            }
            for z in result.interference_zones
        ],
    }


# ---------- Tunneling ----------

@router.post("/tunneling/scan")
async def scan_tunneling(req: TunnelingScanRequest):
    """Portfolio-wide tunneling vulnerability scan."""
    from src.services.tunneling_detector import tunneling_detector

    if req.portfolio_asset_ids:
        scenarios = await tunneling_detector.scan_portfolio(
            req.portfolio_asset_ids, top_n=req.top_n,
        )
    else:
        scenarios = await tunneling_detector.find_tunneling_paths(
            max_compound_events=req.max_compound_events,
        )

    return {
        "scenarios": [
            {
                "scenario_id": s.scenario_id,
                "trigger_combination": s.trigger_combination,
                "bypassed_states": s.bypassed_states,
                "probability": s.probability,
                "impact": s.impact,
                "barrier_energy": s.barrier_energy,
                "explanation": s.explanation,
            }
            for s in scenarios[:req.top_n]
        ],
        "total_found": len(scenarios),
    }


@router.get("/tunneling/{asset_id}")
async def get_asset_barrier(asset_id: str):
    """Compute barrier energy for a specific asset."""
    from src.services.tunneling_detector import tunneling_detector

    barrier = await tunneling_detector.compute_barrier_energy(asset_id)
    return {
        "asset_id": asset_id,
        "from_state": barrier.from_state,
        "to_state": barrier.to_state,
        "barrier_energy": barrier.barrier_energy,
        "tunneling_probability": barrier.tunneling_probability,
        "expected_intermediate_states": barrier.expected_intermediate_states,
    }


# ---------- Entanglement ----------

@router.post("/entanglement/propagate")
async def propagate_entanglement(req: EntanglementPropagateRequest):
    """Propagate risk change across entangled domains."""
    from src.services.entanglement_map import entanglement_map

    updates = await entanglement_map.propagate_change(
        req.changed_domain, req.delta, req.asset_scope,
    )
    return {
        "source_domain": req.changed_domain,
        "source_delta": req.delta,
        "propagated_updates": [
            {
                "target_domain": u.target_domain,
                "propagated_change": u.propagated_change,
            }
            for u in updates
        ],
    }


@router.post("/entanglement/register")
async def register_entanglement(req: EntanglementRegisterRequest):
    """Register a new cross-domain correlation."""
    from src.services.entanglement_map import entanglement_map

    ec = await entanglement_map.register_correlation(
        req.domain_a, req.domain_b, req.coefficient, req.mechanism, req.lag_days,
    )
    return {
        "status": "registered",
        "domain_a": ec.domain_a,
        "domain_b": ec.domain_b,
        "coefficient": ec.coefficient,
    }


@router.get("/entanglement/matrix")
async def get_entanglement_matrix(domains: Optional[str] = None):
    """Return the NxN entanglement correlation matrix."""
    from src.services.entanglement_map import entanglement_map

    domain_list = domains.split(",") if domains else None
    result = await entanglement_map.get_entanglement_matrix(domain_list)
    return result


# ---------- Swarm ----------

@router.post("/swarm/deploy")
async def deploy_swarm(req: SwarmDeployRequest):
    """Deploy particle swarm for comprehensive risk analysis."""
    from src.services.swarm_orchestrator import swarm_orchestrator

    param_space = None
    if req.parameter_space:
        param_space = {k: tuple(v) for k, v in req.parameter_space.items()}

    result = await swarm_orchestrator.deploy_swarm(
        num_particles=req.num_particles,
        time_horizon=req.time_horizon,
        parameter_space=param_space,
    )

    return {
        "swarm_id": result.swarm_id,
        "num_particles": result.num_particles,
        "computation_time_ms": result.computation_time_ms,
        "state_matrix_shape": list(result.state_matrix_shape),
        "explained_variance": result.explained_variance,
        "convergence_points": [
            {
                "asset_id": cp.asset_id,
                "time_step": cp.time_step,
                "convergence_ratio": cp.convergence_ratio,
                "mean_severity": cp.mean_severity,
                "num_converged": cp.num_particles_converged,
            }
            for cp in result.convergence_points
        ],
        "top_principal_components": result.top_principal_components[:5],
        "black_swans": result.black_swans,
    }


# ---------- Uncertainty ----------

@router.post("/uncertainty/degrade")
async def degrade_risk_score(req: UncertaintyRequest):
    """Apply Heisenberg-style uncertainty to a risk score projection."""
    from src.services.uncertainty import uncertainty_quantifier

    band = uncertainty_quantifier.degrade_risk_score(
        current_score=req.current_score,
        projection_years=req.projection_years,
        score_type=req.score_type,
        data_quality=req.data_quality,
    )
    return {
        "central_estimate": band.central_estimate,
        "lower_bound": round(band.lower_bound, 2),
        "upper_bound": round(band.upper_bound, 2),
        "confidence_level": band.confidence_level,
        "degradation_factor": round(band.degradation_factor, 4),
        "projection_years": req.projection_years,
        "score_type": req.score_type,
    }


@router.get("/uncertainty/coefficient")
async def get_uncertainty_coefficient(
    years: float = 30,
    data_quality: float = 0.8,
    complexity: float = 0.5,
):
    """Get information degradation coefficient for given horizon."""
    from src.services.uncertainty import uncertainty_quantifier

    coeff = uncertainty_quantifier.information_degradation_coefficient(
        time_horizon_years=years,
        data_quality=data_quality,
        system_complexity=complexity,
    )
    return {
        "time_horizon_years": years,
        "data_quality": data_quality,
        "system_complexity": complexity,
        "degradation_coefficient": round(coeff, 4),
    }
