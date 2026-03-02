"""
Universal Stress Testing Engine
===============================

Implements the Universal Stress Testing Methodology with:
- Master Loss Equation: L = Σ [EAD × LGD × PD × (1 + CF)] × DF
- Monte Carlo simulations (10,000+ scenarios)
- Sector-specific parameter extraction
- Correlation modeling via Gaussian copula

Reference: Universal Stress Testing Methodology v1.0 (2026-01-30)
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from scipy import stats

logger = logging.getLogger(__name__)


class SectorType(str, Enum):
    """Sector types for stress testing."""
    INSURANCE = "insurance"
    REAL_ESTATE = "real_estate"
    FINANCIAL = "financial"
    ENTERPRISE = "enterprise"
    DEFENSE = "defense"


@dataclass
class ExposureEntity:
    """Single entity/asset exposure for stress testing."""
    id: str
    name: str
    sector: SectorType
    ead: float  # Exposure at Default
    pd: float   # Probability of Default (0-1)
    lgd: float  # Loss Given Default (0-1)
    cf: float = 0.0  # Cascade Factor
    df: float = 1.0  # Duration Factor
    location: Optional[Dict[str, float]] = None  # lat, lon
    dependencies: List[str] = field(default_factory=list)
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class MonteCarloResult:
    """Results from Monte Carlo simulation."""
    mean_loss: float
    median_loss: float
    std_loss: float
    var_95: float
    var_99: float
    cvar_99: float  # Expected Shortfall
    max_loss: float
    min_loss: float
    loss_distribution: np.ndarray
    confidence_interval_90: Tuple[float, float]
    confidence_interval_95: Tuple[float, float]
    percentiles: Dict[str, float]
    simulation_count: int


@dataclass
class StressTestResult:
    """Complete stress test result."""
    scenario_id: str
    sector: SectorType
    monte_carlo: MonteCarloResult
    direct_loss: float
    cascade_loss: float
    total_loss: float
    amplification_factor: float
    affected_entities: int
    entity_losses: Dict[str, float]
    metadata: Dict[str, Any] = field(default_factory=dict)


# =============================================================================
# MASTER LOSS EQUATION
# =============================================================================

def compute_master_loss(
    exposures: List[ExposureEntity],
    stress_factor: float = 1.0
) -> Tuple[float, Dict[str, float]]:
    """
    Compute total loss using the Master Loss Equation.
    
    L = Σ [EAD × LGD × PD × (1 + CF)] × DF
    
    Args:
        exposures: List of exposure entities
        stress_factor: Multiplier for PD under stress (default 1.0)
    
    Returns:
        Tuple of (total_loss, per_entity_losses)
    """
    total_loss = 0.0
    entity_losses = {}
    
    for entity in exposures:
        # Apply stress factor to PD (capped at 0.99)
        stressed_pd = min(entity.pd * stress_factor, 0.99)
        
        # Master Loss Equation per entity
        # L_i = EAD × LGD × PD × (1 + CF) × DF
        entity_loss = (
            entity.ead * 
            entity.lgd * 
            stressed_pd * 
            (1 + entity.cf) * 
            entity.df
        )
        
        entity_losses[entity.id] = entity_loss
        total_loss += entity_loss
    
    return total_loss, entity_losses


# =============================================================================
# MONTE CARLO ENGINE (10,000+ simulations)
# =============================================================================

def run_universal_monte_carlo(
    exposures: List[ExposureEntity],
    correlation_matrix: Optional[np.ndarray] = None,
    stress_factor: float = 1.0,
    n_simulations: int = 100000,
    cascade_factors: Optional[np.ndarray] = None,
    distribution: str = "gaussian",
    degrees_of_freedom: int = 5,
) -> MonteCarloResult:
    """
    Universal Monte Carlo simulation for stress testing.
    
    Uses Gaussian copula for correlated defaults with Cholesky decomposition.
    
    Args:
        exposures: List of exposure entities
        correlation_matrix: Asset correlation matrix (n_assets x n_assets)
        stress_factor: Scenario severity multiplier for PD
        n_simulations: Number of Monte Carlo paths (default 100,000)
        cascade_factors: Optional per-entity cascade factors
    
    Returns:
        MonteCarloResult with full loss distribution and statistics
    """
    n_assets = len(exposures)
    
    if n_assets == 0:
        return MonteCarloResult(
            mean_loss=0.0,
            median_loss=0.0,
            std_loss=0.0,
            var_95=0.0,
            var_99=0.0,
            cvar_99=0.0,
            max_loss=0.0,
            min_loss=0.0,
            loss_distribution=np.array([0.0]),
            confidence_interval_90=(0.0, 0.0),
            confidence_interval_95=(0.0, 0.0),
            percentiles={"p5": 0.0, "p25": 0.0, "p50": 0.0, "p75": 0.0, "p95": 0.0},
            simulation_count=n_simulations
        )
    
    # Extract arrays from exposures
    ead_array = np.array([e.ead for e in exposures])
    pd_array = np.array([e.pd for e in exposures])
    lgd_array = np.array([e.lgd for e in exposures])
    cf_array = np.array([e.cf for e in exposures]) if cascade_factors is None else cascade_factors
    df_array = np.array([e.df for e in exposures])
    
    # Apply stress factor to PDs (capped at 0.99)
    stressed_pd = np.minimum(pd_array * stress_factor, 0.99)
    
    # Default correlation matrix if not provided
    if correlation_matrix is None:
        # Use moderate intra-sector correlation
        correlation_matrix = np.eye(n_assets) * 0.5 + np.ones((n_assets, n_assets)) * 0.5
        np.fill_diagonal(correlation_matrix, 1.0)
    
    # Ensure correlation matrix is positive definite
    try:
        chol = np.linalg.cholesky(correlation_matrix)
    except np.linalg.LinAlgError:
        logger.warning("Correlation matrix not positive definite, using identity")
        chol = np.eye(n_assets)
    
    # Generate correlated random samples (Gaussian copula or Student-t)
    if distribution == "student_t":
        z = np.random.standard_t(degrees_of_freedom, size=(n_simulations, n_assets))
    else:
        z = np.random.standard_normal((n_simulations, n_assets))
    correlated_z = z @ chol.T
    
    # Convert PDs to thresholds (inverse normal CDF)
    thresholds = stats.norm.ppf(stressed_pd)
    
    # Determine defaults: asset defaults if correlated_z < threshold
    defaults = correlated_z < thresholds  # Boolean matrix (n_sims x n_assets)
    
    # Sample LGD with some variance (Beta distribution)
    # Mean = lgd, variance controlled
    lgd_alpha = lgd_array * 10
    lgd_beta = (1 - lgd_array) * 10
    lgd_alpha = np.maximum(lgd_alpha, 0.1)
    lgd_beta = np.maximum(lgd_beta, 0.1)
    
    lgd_samples = np.random.beta(lgd_alpha, lgd_beta, size=(n_simulations, n_assets))
    
    # Calculate losses per simulation
    # L = EAD × LGD × Default × (1 + CF) × DF
    loss_if_default = ead_array * lgd_samples * (1 + cf_array) * df_array
    losses_per_sim = np.sum(defaults * loss_if_default, axis=1)
    
    # Calculate statistics
    mean_loss = float(np.mean(losses_per_sim))
    median_loss = float(np.median(losses_per_sim))
    std_loss = float(np.std(losses_per_sim))
    var_95 = float(np.percentile(losses_per_sim, 95))
    var_99 = float(np.percentile(losses_per_sim, 99))
    
    # CVaR (Expected Shortfall) - average of losses beyond VaR
    losses_beyond_var99 = losses_per_sim[losses_per_sim >= var_99]
    cvar_99 = float(np.mean(losses_beyond_var99)) if len(losses_beyond_var99) > 0 else var_99
    
    max_loss = float(np.max(losses_per_sim))
    min_loss = float(np.min(losses_per_sim))
    
    # Confidence intervals
    ci_90 = (float(np.percentile(losses_per_sim, 5)), float(np.percentile(losses_per_sim, 95)))
    ci_95 = (float(np.percentile(losses_per_sim, 2.5)), float(np.percentile(losses_per_sim, 97.5)))
    
    # Percentiles
    percentiles = {
        "p5": float(np.percentile(losses_per_sim, 5)),
        "p10": float(np.percentile(losses_per_sim, 10)),
        "p25": float(np.percentile(losses_per_sim, 25)),
        "p50": float(np.percentile(losses_per_sim, 50)),
        "p75": float(np.percentile(losses_per_sim, 75)),
        "p90": float(np.percentile(losses_per_sim, 90)),
        "p95": float(np.percentile(losses_per_sim, 95)),
        "p99": float(np.percentile(losses_per_sim, 99)),
    }
    
    return MonteCarloResult(
        mean_loss=mean_loss,
        median_loss=median_loss,
        std_loss=std_loss,
        var_95=var_95,
        var_99=var_99,
        cvar_99=cvar_99,
        max_loss=max_loss,
        min_loss=min_loss,
        loss_distribution=losses_per_sim,
        confidence_interval_90=ci_90,
        confidence_interval_95=ci_95,
        percentiles=percentiles,
        simulation_count=n_simulations
    )


# =============================================================================
# SECTOR PARAMETER EXTRACTION
# =============================================================================

def get_sector_parameters(
    sector: SectorType,
    scenario_type: str,
    severity: float
) -> Dict[str, Any]:
    """
    Get sector-specific default parameters for stress testing.
    
    Args:
        sector: Sector type
        scenario_type: Type of stress scenario (flood, seismic, financial, etc.)
        severity: Scenario severity (0-1)
    
    Returns:
        Dict with sector-specific parameters (base_pd, base_lgd, cf_range, df_base)
    """
    # Base parameters by sector (from methodology document)
    SECTOR_PARAMS = {
        SectorType.INSURANCE: {
            "base_pd": 0.02,
            "base_lgd": 0.45,
            "cf_range": (0.1, 0.3),  # Reinsurance cascade, investment correlation
            "df_base": 1.5,  # Claims development pattern (tail)
            "description": "Policy limits, reinsurance structure, claims history"
        },
        SectorType.REAL_ESTATE: {
            "base_pd": 0.03,
            "base_lgd": 0.35,
            "cf_range": (0.15, 0.35),  # Financing cascade, supply chain
            "df_base": 1.2,  # Project timeline extension
            "description": "Property values, construction pipeline, debt schedule"
        },
        SectorType.FINANCIAL: {
            "base_pd": 0.01,
            "base_lgd": 0.40,
            "cf_range": (0.25, 0.50),  # Interbank exposure, counterparty chains
            "df_base": 1.0,  # Liquidity horizon (LCR buckets)
            "description": "Loan book, trading positions, derivatives"
        },
        SectorType.ENTERPRISE: {
            "base_pd": 0.04,
            "base_lgd": 0.50,
            "cf_range": (0.10, 0.25),  # Customer/supplier network effects
            "df_base": 1.3,  # Business interruption duration
            "description": "Revenue exposure, asset base, inventory"
        },
        SectorType.DEFENSE: {
            "base_pd": 0.005,
            "base_lgd": 0.60,
            "cf_range": (0.20, 0.40),  # Alliance dependencies, infrastructure
            "df_base": 1.1,  # Surge capacity timeline
            "description": "Program values, capability gaps"
        }
    }
    
    params = SECTOR_PARAMS.get(sector, SECTOR_PARAMS[SectorType.ENTERPRISE])
    
    # Adjust for scenario type (support composite e.g. oil_20+taiwan_earthquake)
    scenario_multipliers = {
        "flood": {"pd_mult": 1.5, "lgd_mult": 1.3},
        "seismic": {"pd_mult": 1.8, "lgd_mult": 1.5},
        "financial": {"pd_mult": 2.0, "lgd_mult": 1.2},
        "volatility_spike": {"pd_mult": 2.2, "lgd_mult": 1.25},
        "liquidity_dry_up": {"pd_mult": 1.9, "lgd_mult": 1.4},
        "pandemic": {"pd_mult": 1.4, "lgd_mult": 1.1},
        "cyber": {"pd_mult": 1.3, "lgd_mult": 1.4},
        "supply_chain": {"pd_mult": 1.6, "lgd_mult": 1.3},
        "regulatory": {"pd_mult": 1.2, "lgd_mult": 1.0},
        "climate": {"pd_mult": 1.5, "lgd_mult": 1.4},
        "geopolitical": {"pd_mult": 1.7, "lgd_mult": 1.3},
        "energy": {"pd_mult": 1.4, "lgd_mult": 1.2},
        "oil_20": {"pd_mult": 1.5, "lgd_mult": 1.2},
        "taiwan_earthquake": {"pd_mult": 1.8, "lgd_mult": 1.4},
    }
    st_lower = scenario_type.lower()
    if "+" in st_lower:
        parts = [p.strip() for p in st_lower.split("+") if p.strip()]
        pd_mults = [scenario_multipliers.get(p, {"pd_mult": 1.0, "lgd_mult": 1.0})["pd_mult"] for p in parts]
        lgd_mults = [scenario_multipliers.get(p, {"pd_mult": 1.0, "lgd_mult": 1.0})["lgd_mult"] for p in parts]
        composite_factor = 0.9 ** max(0, len(parts) - 1)
        scenario_mult = {"pd_mult": min(2.5, max(pd_mults) * composite_factor), "lgd_mult": min(1.5, max(lgd_mults) * composite_factor)}
    else:
        scenario_mult = scenario_multipliers.get(st_lower, {"pd_mult": 1.0, "lgd_mult": 1.0})
    
    # Apply severity scaling (1x to 3x at 100% severity)
    severity_mult = 1 + (severity * 2)
    
    return {
        "base_pd": params["base_pd"] * scenario_mult["pd_mult"] * severity_mult,
        "base_lgd": min(params["base_lgd"] * scenario_mult["lgd_mult"], 0.95),
        "cf_min": params["cf_range"][0],
        "cf_max": params["cf_range"][1],
        "df_base": params["df_base"],
        "severity_mult": severity_mult,
        "scenario_type": scenario_type,
        "description": params["description"]
    }


# =============================================================================
# FULL STRESS TEST EXECUTION
# =============================================================================

def execute_universal_stress_test(
    exposures: List[ExposureEntity],
    scenario_id: str,
    scenario_type: str,
    severity: float,
    correlation_matrix: Optional[np.ndarray] = None,
    n_simulations: int = 100000,
    include_cascade: bool = True,
    market_regime: Optional[str] = None,
    market_indicators: Optional[Dict[str, Any]] = None,
    distribution: str = "gaussian",
    degrees_of_freedom: int = 5,
) -> StressTestResult:
    """
    Execute a complete universal stress test.
    
    Args:
        exposures: List of exposure entities
        scenario_id: Unique scenario identifier
        scenario_type: Type of stress scenario
        severity: Severity level (0-1)
        correlation_matrix: Optional asset correlation matrix
        n_simulations: Number of Monte Carlo simulations
        include_cascade: Whether to include cascade effects
    
    Returns:
        Complete StressTestResult with all metrics
    """
    if not exposures:
        return StressTestResult(
            scenario_id=scenario_id,
            sector=SectorType.ENTERPRISE,
            monte_carlo=MonteCarloResult(
                mean_loss=0.0, median_loss=0.0, std_loss=0.0,
                var_95=0.0, var_99=0.0, cvar_99=0.0,
                max_loss=0.0, min_loss=0.0,
                loss_distribution=np.array([0.0]),
                confidence_interval_90=(0.0, 0.0),
                confidence_interval_95=(0.0, 0.0),
                percentiles={},
                simulation_count=n_simulations
            ),
            direct_loss=0.0,
            cascade_loss=0.0,
            total_loss=0.0,
            amplification_factor=1.0,
            affected_entities=0,
            entity_losses={}
        )
    
    # Determine primary sector
    sector_counts = {}
    for e in exposures:
        sector_counts[e.sector] = sector_counts.get(e.sector, 0) + 1
    primary_sector = max(sector_counts, key=sector_counts.get)
    
    # Get sector parameters
    sector_params = get_sector_parameters(primary_sector, scenario_type, severity)
    stress_factor = sector_params["severity_mult"]
    
    # --- Regime Engine integration ---
    regime_used = None
    regime_params_dict = None
    try:
        from src.services.regime_engine import (
            resolve_regime,
            get_regime_params,
            apply_regime_to_stress_factor,
            apply_regime_to_correlation,
            apply_regime_to_pd_lgd,
        )
        regime = resolve_regime(market_regime, market_indicators)
        regime_used = regime.value
        rp = get_regime_params(regime)
        regime_params_dict = rp.to_dict()

        # Apply regime multipliers to stress factor
        stress_factor = apply_regime_to_stress_factor(stress_factor, regime)

        # Apply regime PD/LGD factors to each exposure entity
        pd_arr = np.array([e.pd for e in exposures])
        lgd_arr = np.array([e.lgd for e in exposures])
        stressed_pd, stressed_lgd = apply_regime_to_pd_lgd(pd_arr, lgd_arr, regime)
        for i, entity in enumerate(exposures):
            entity.pd = float(stressed_pd[i])
            entity.lgd = float(stressed_lgd[i])

        # Apply regime correlation shift
        if correlation_matrix is not None:
            correlation_matrix = apply_regime_to_correlation(correlation_matrix, regime)

        logger.info("Regime '%s' applied: stress_factor=%.3f, vol_mult=%.1f, pd_factor=%.1f",
                     regime_used, stress_factor, rp.volatility_multiplier, rp.pd_stress_factor)
    except ImportError:
        logger.warning("Regime engine not available, proceeding without regime adjustments")
    
    # Apply cascade factors if enabled
    if include_cascade:
        cf_min, cf_max = sector_params["cf_min"], sector_params["cf_max"]
        for entity in exposures:
            if entity.cf == 0:
                entity.cf = np.random.uniform(cf_min, cf_max)
    
    # Run Monte Carlo simulation
    mc_result = run_universal_monte_carlo(
        exposures=exposures,
        correlation_matrix=correlation_matrix,
        stress_factor=stress_factor,
        n_simulations=n_simulations,
        distribution=distribution,
        degrees_of_freedom=degrees_of_freedom,
    )
    
    # Calculate direct loss (deterministic using expected values)
    direct_loss, entity_losses = compute_master_loss(exposures, stress_factor)
    
    # Calculate cascade/indirect loss (difference from mean MC)
    cascade_loss = max(0, mc_result.mean_loss - direct_loss)
    
    # Total loss is from Monte Carlo mean
    total_loss = mc_result.mean_loss
    
    # Amplification factor
    amplification_factor = total_loss / direct_loss if direct_loss > 0 else 1.0
    
    return StressTestResult(
        scenario_id=scenario_id,
        sector=primary_sector,
        monte_carlo=mc_result,
        direct_loss=direct_loss,
        cascade_loss=cascade_loss,
        total_loss=total_loss,
        amplification_factor=amplification_factor,
        affected_entities=len(exposures),
        entity_losses=entity_losses,
        metadata={
            "scenario_type": scenario_type,
            "severity": severity,
            "stress_factor": stress_factor,
            "sector_params": sector_params,
            "regime_used": regime_used,
            "regime_parameters": regime_params_dict,
            "distribution": distribution,
            "degrees_of_freedom": degrees_of_freedom if distribution == "student_t" else None,
        }
    )


# =============================================================================
# HELPER: Create exposures from simplified input
# =============================================================================

def create_exposures_from_assets(
    asset_values: List[float],
    sector: SectorType,
    scenario_type: str,
    severity: float,
    asset_names: Optional[List[str]] = None
) -> List[ExposureEntity]:
    """
    Create ExposureEntity list from simple asset value array.
    
    Useful for quick stress tests where only values are known.
    
    Args:
        asset_values: List of asset values
        sector: Sector type for all assets
        scenario_type: Scenario type for parameter lookup
        severity: Severity for parameter lookup
        asset_names: Optional list of asset names
    
    Returns:
        List of ExposureEntity objects
    """
    params = get_sector_parameters(sector, scenario_type, severity)
    
    exposures = []
    for i, value in enumerate(asset_values):
        name = asset_names[i] if asset_names and i < len(asset_names) else f"Asset_{i+1}"
        
        # Add some variance to PD and LGD
        pd_var = np.random.uniform(0.8, 1.2)
        lgd_var = np.random.uniform(0.9, 1.1)
        
        exposures.append(ExposureEntity(
            id=f"asset_{i}",
            name=name,
            sector=sector,
            ead=value,
            pd=min(params["base_pd"] * pd_var, 0.99),
            lgd=min(params["base_lgd"] * lgd_var, 0.95),
            cf=np.random.uniform(params["cf_min"], params["cf_max"]),
            df=params["df_base"]
        ))
    
    return exposures


# =============================================================================
# QUICK API for stress_report_metrics.py integration
# =============================================================================

def compute_monte_carlo_metrics(
    total_exposure: float,
    n_assets: int,
    sector: str,
    scenario_type: str,
    severity: float,
    n_simulations: int = 100000
) -> Dict[str, Any]:
    """
    Quick Monte Carlo computation for report metrics.
    
    Simplified API for integration with stress_report_metrics.py.
    
    Args:
        total_exposure: Total exposure value in millions
        n_assets: Number of assets/entities
        sector: Sector name (string)
        scenario_type: Scenario type
        severity: Severity (0-1)
        n_simulations: Number of simulations
    
    Returns:
        Dict with probabilistic metrics for Report V2
    """
    try:
        sector_enum = SectorType(sector.lower())
    except ValueError:
        sector_enum = SectorType.ENTERPRISE
    
    # Create synthetic exposures distributed across total
    if n_assets <= 0:
        n_assets = 10
    
    # Distribute exposure with some concentration
    weights = np.random.dirichlet(np.ones(n_assets) * 2)
    asset_values = (total_exposure * weights).tolist()
    
    # Create exposure entities
    exposures = create_exposures_from_assets(
        asset_values=asset_values,
        sector=sector_enum,
        scenario_type=scenario_type,
        severity=severity
    )
    
    # Run Monte Carlo
    mc_result = run_universal_monte_carlo(
        exposures=exposures,
        stress_factor=1 + (severity * 2),
        n_simulations=n_simulations
    )
    
    return {
        "mean_loss": round(mc_result.mean_loss, 2),
        "median_loss": round(mc_result.median_loss, 2),
        "std_dev": round(mc_result.std_loss, 2),
        "var_95": round(mc_result.var_95, 2),
        "var_99": round(mc_result.var_99, 2),
        "cvar_99": round(mc_result.cvar_99, 2),
        "max_loss": round(mc_result.max_loss, 2),
        "min_loss": round(mc_result.min_loss, 2),
        "confidence_interval_90": [
            round(mc_result.confidence_interval_90[0], 2),
            round(mc_result.confidence_interval_90[1], 2)
        ],
        "confidence_interval_95": [
            round(mc_result.confidence_interval_95[0], 2),
            round(mc_result.confidence_interval_95[1], 2)
        ],
        "percentiles": {k: round(v, 2) for k, v in mc_result.percentiles.items()},
        "monte_carlo_runs": n_simulations,
        "methodology": "Gaussian copula with Cholesky decomposition"
    }
