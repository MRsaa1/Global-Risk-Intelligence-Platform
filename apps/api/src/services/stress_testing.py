"""
Stress Testing Engine - CPU-Optimized
======================================

Production-level stress testing with:
- Monte Carlo simulations (NumPy vectorized)
- Correlation shocks
- Climate scenarios
- Contagion modeling

Designed for 18-core CPU server (no GPU required)
"""
import numpy as np
from typing import Optional
from pydantic import BaseModel
from enum import Enum
import structlog

logger = structlog.get_logger()


class ScenarioType(str, Enum):
    CLIMATE_PHYSICAL = "climate_physical"
    CLIMATE_TRANSITION = "climate_transition"
    CREDIT_SHOCK = "credit_shock"
    LIQUIDITY_CRISIS = "liquidity_crisis"
    CORRELATION_SPIKE = "correlation_spike"
    PANDEMIC = "pandemic"
    GEOPOLITICAL = "geopolitical"


class StressScenario(BaseModel):
    """Stress scenario configuration"""
    scenario_type: ScenarioType
    severity: float  # 0-1
    time_horizon_years: int = 5
    num_simulations: int = 10000
    confidence_level: float = 0.99


class StressResult(BaseModel):
    """Stress test results"""
    scenario_type: str
    var_99: float  # Value at Risk 99%
    expected_shortfall: float  # CVaR
    max_loss: float
    recovery_time_years: float
    affected_assets: int
    cascade_depth: int
    simulation_count: int


# ==============================================
# VECTORIZED MONTE CARLO (NumPy)
# ==============================================

def monte_carlo_portfolio_loss(
    asset_values: np.ndarray,
    default_probs: np.ndarray,
    recovery_rates: np.ndarray,
    correlation_matrix: np.ndarray,
    num_simulations: int,
    shock_multiplier: float = 1.0
) -> np.ndarray:
    """
    Monte Carlo simulation for portfolio losses.
    
    Uses Gaussian copula for correlated defaults.
    Vectorized with NumPy for performance.
    
    Args:
        asset_values: Portfolio asset values (n_assets,)
        default_probs: Probability of default per asset (n_assets,)
        recovery_rates: Recovery rate per asset (n_assets,)
        correlation_matrix: Asset correlation matrix (n_assets, n_assets)
        num_simulations: Number of Monte Carlo paths
        shock_multiplier: Stress multiplier for PDs
        
    Returns:
        Array of portfolio losses for each simulation
    """
    n_assets = len(asset_values)
    
    # Cholesky decomposition for correlated samples
    try:
        chol = np.linalg.cholesky(correlation_matrix)
    except np.linalg.LinAlgError:
        # Fallback to identity if matrix is not positive definite
        chol = np.eye(n_assets)
    
    # Apply stress multiplier to default probabilities
    stressed_pds = np.minimum(default_probs * shock_multiplier, 0.99)
    
    # Generate all random samples at once (vectorized)
    z = np.random.randn(num_simulations, n_assets)
    correlated_z = z @ chol.T
    
    # Convert PDs to thresholds (using inverse normal CDF)
    from scipy import stats
    thresholds = stats.norm.ppf(stressed_pds)
    
    # Simulate defaults: correlated_z < threshold means default
    defaults = correlated_z < thresholds
    
    # Calculate losses: LGD = 1 - recovery_rate
    lgd = 1.0 - recovery_rates
    loss_if_default = asset_values * lgd
    
    # Total loss per simulation
    losses = (defaults * loss_if_default).sum(axis=1)
    
    return losses


def calculate_var_cvar(losses: np.ndarray, confidence: float) -> tuple:
    """
    Calculate VaR and CVaR (Expected Shortfall).
    
    Args:
        losses: Array of simulated losses
        confidence: Confidence level (e.g., 0.99)
        
    Returns:
        (VaR, CVaR, max_loss)
    """
    sorted_losses = np.sort(losses)
    n = len(losses)
    
    # VaR index
    var_index = int(n * confidence)
    var = sorted_losses[min(var_index, n - 1)]
    
    # CVaR = average of losses beyond VaR
    tail_losses = sorted_losses[var_index:]
    cvar = np.mean(tail_losses) if len(tail_losses) > 0 else var
    
    max_loss = sorted_losses[-1]
    
    return var, cvar, max_loss


def simulate_cascade(
    adjacency_matrix: np.ndarray,
    initial_defaults: np.ndarray,
    asset_values: np.ndarray,
    threshold: float = 0.3
) -> tuple:
    """
    Simulate cascade/contagion through asset network.
    
    Args:
        adjacency_matrix: Network connections (n x n)
        initial_defaults: Boolean array of initially defaulted assets
        asset_values: Asset values
        threshold: Contagion threshold
        
    Returns:
        (final_defaults, cascade_depth, total_loss)
    """
    n = len(asset_values)
    defaults = initial_defaults.copy()
    cascade_depth = 0
    
    for _ in range(100):  # Max iterations
        # Calculate pressure from defaulted neighbors
        defaulted_values = asset_values * defaults
        pressure = adjacency_matrix.T @ defaulted_values
        
        # Normalize by own value
        safe_values = np.maximum(asset_values, 1e-10)
        normalized_pressure = pressure / safe_values
        
        # New defaults where pressure exceeds threshold
        new_defaults = (~defaults) & (normalized_pressure > threshold)
        
        if not np.any(new_defaults):
            break
            
        defaults = defaults | new_defaults
        cascade_depth += 1
    
    total_loss = np.sum(asset_values * defaults)
    
    return defaults, cascade_depth, total_loss


# ==============================================
# STRESS TESTING SERVICE
# ==============================================

class StressTestingService:
    """
    Production stress testing service.
    
    Designed for high-performance CPU execution.
    """
    
    def __init__(self):
        self.logger = structlog.get_logger()
    
    async def run_stress_test(
        self,
        asset_values: list[float],
        default_probs: list[float],
        recovery_rates: list[float],
        correlation_matrix: Optional[list[list[float]]] = None,
        scenario: StressScenario = None
    ) -> StressResult:
        """
        Run comprehensive stress test.
        """
        if scenario is None:
            scenario = StressScenario(
                scenario_type=ScenarioType.CREDIT_SHOCK,
                severity=0.5
            )
        
        n_assets = len(asset_values)
        
        # Convert to numpy
        values = np.array(asset_values, dtype=np.float64)
        pds = np.array(default_probs, dtype=np.float64)
        rrs = np.array(recovery_rates, dtype=np.float64)
        
        # Build correlation matrix if not provided
        if correlation_matrix is None:
            # Default: moderate positive correlation
            corr = np.eye(n_assets) * 0.6 + np.ones((n_assets, n_assets)) * 0.4
            np.fill_diagonal(corr, 1.0)
        else:
            corr = np.array(correlation_matrix, dtype=np.float64)
        
        # Ensure positive semi-definite
        eigvals = np.linalg.eigvalsh(corr)
        if np.min(eigvals) < 0:
            corr += np.eye(n_assets) * (-np.min(eigvals) + 0.01)
        
        # Calculate shock multiplier based on scenario
        shock_multiplier = self._get_shock_multiplier(scenario)
        
        self.logger.info(
            "Running stress test",
            scenario=scenario.scenario_type,
            severity=scenario.severity,
            n_assets=n_assets,
            n_simulations=scenario.num_simulations
        )
        
        # Run Monte Carlo
        losses = monte_carlo_portfolio_loss(
            values, pds, rrs, corr,
            scenario.num_simulations,
            shock_multiplier
        )
        
        # Calculate risk metrics
        var_99, cvar, max_loss = calculate_var_cvar(
            losses, 
            scenario.confidence_level
        )
        
        # Run cascade simulation for severe scenarios
        cascade_depth = 0
        if scenario.severity > 0.7:
            adjacency = self._build_adjacency_from_correlation(corr)
            initial_defaults = pds > 0.5  # High PD assets
            _, cascade_depth, _ = simulate_cascade(
                adjacency, initial_defaults, values
            )
        
        # Estimate recovery time
        recovery_years = self._estimate_recovery_time(
            scenario.severity,
            cvar / np.sum(values) if np.sum(values) > 0 else 0
        )
        
        return StressResult(
            scenario_type=scenario.scenario_type.value,
            var_99=float(var_99),
            expected_shortfall=float(cvar),
            max_loss=float(max_loss),
            recovery_time_years=recovery_years,
            affected_assets=int(np.sum(losses > 0)),
            cascade_depth=int(cascade_depth),
            simulation_count=scenario.num_simulations
        )
    
    async def run_portfolio_stress_test(
        self,
        total_exposure: float,
        num_assets: int,
        average_pd: float,
        average_lgd: float,
        scenario_type: str = "credit_shock",
        severity: float = 0.5,
        num_simulations: int = 10000
    ) -> StressResult:
        """
        Simplified portfolio-level stress test.
        """
        # Generate mock portfolio
        np.random.seed(42)
        asset_values = np.random.exponential(total_exposure / num_assets, num_assets)
        asset_values = asset_values / asset_values.sum() * total_exposure
        
        default_probs = np.random.beta(2, 50, num_assets) * average_pd * 3
        default_probs = np.clip(default_probs, 0.001, 0.5)
        
        recovery_rates = np.random.beta(5, 5, num_assets) * (1 - average_lgd) * 2
        recovery_rates = np.clip(recovery_rates, 0.1, 0.9)
        
        scenario = StressScenario(
            scenario_type=ScenarioType(scenario_type),
            severity=severity,
            num_simulations=num_simulations
        )
        
        return await self.run_stress_test(
            asset_values.tolist(),
            default_probs.tolist(),
            recovery_rates.tolist(),
            scenario=scenario
        )
    
    def _get_shock_multiplier(self, scenario: StressScenario) -> float:
        """Get PD multiplier based on scenario type and severity."""
        base_multipliers = {
            ScenarioType.CLIMATE_PHYSICAL: 2.5,
            ScenarioType.CLIMATE_TRANSITION: 1.8,
            ScenarioType.CREDIT_SHOCK: 3.0,
            ScenarioType.LIQUIDITY_CRISIS: 2.2,
            ScenarioType.CORRELATION_SPIKE: 2.0,
            ScenarioType.PANDEMIC: 2.8,
            ScenarioType.GEOPOLITICAL: 1.5,
        }
        base = base_multipliers.get(scenario.scenario_type, 2.0)
        return 1.0 + (base - 1.0) * scenario.severity
    
    def _build_adjacency_from_correlation(
        self, 
        correlation: np.ndarray,
        threshold: float = 0.5
    ) -> np.ndarray:
        """Build adjacency matrix from correlation."""
        adj = (correlation > threshold).astype(np.float64)
        np.fill_diagonal(adj, 0)
        return adj
    
    def _estimate_recovery_time(
        self, 
        severity: float, 
        loss_ratio: float
    ) -> float:
        """Estimate recovery time in years."""
        base_recovery = 1.0 + severity * 4.0  # 1-5 years base
        loss_factor = 1.0 + loss_ratio * 3.0  # Additional for heavy losses
        return round(base_recovery * loss_factor, 1)


# Singleton
stress_testing_service = StressTestingService()
