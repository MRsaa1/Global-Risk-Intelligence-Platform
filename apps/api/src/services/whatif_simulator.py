"""
What-If Simulator - Scenario Analysis and Sensitivity Testing.

Provides:
- Parameter sensitivity analysis
- Multi-scenario comparison
- Impact assessment for hypothetical changes
- Monte Carlo uncertainty quantification
- Decision support optimization
"""
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from enum import Enum
import numpy as np
from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)


class ParameterType(str, Enum):
    """Types of adjustable parameters."""
    SEVERITY = "severity"
    PROBABILITY = "probability"
    EXPOSURE = "exposure"
    RECOVERY_TIME = "recovery_time"
    MITIGATION = "mitigation"
    CORRELATION = "correlation"


class ScenarioType(str, Enum):
    """Predefined scenario types."""
    BASELINE = "baseline"
    OPTIMISTIC = "optimistic"
    PESSIMISTIC = "pessimistic"
    STRESS = "stress"
    CUSTOM = "custom"


@dataclass
class Parameter:
    """Adjustable parameter for what-if analysis."""
    name: str
    param_type: ParameterType
    base_value: float
    min_value: float
    max_value: float
    current_value: float
    unit: str = ""
    description: str = ""


@dataclass
class Scenario:
    """What-if scenario definition."""
    id: str
    name: str
    scenario_type: ScenarioType
    parameters: Dict[str, float]
    description: str = ""
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class ScenarioResult:
    """Result of scenario simulation."""
    scenario_id: str
    scenario_name: str
    expected_loss: float
    var_95: float
    var_99: float
    cvar: float  # Expected shortfall
    probability_of_loss: float
    recovery_time_months: float
    risk_score: float
    key_metrics: Dict[str, float]
    timestamp: datetime = field(default_factory=datetime.utcnow)


@dataclass
class SensitivityResult:
    """Result of sensitivity analysis."""
    parameter_name: str
    base_value: float
    values_tested: List[float]
    output_metric: str
    output_values: List[float]
    elasticity: float  # % change in output / % change in input
    impact_ranking: int
    is_critical: bool  # High sensitivity


@dataclass
class ComparisonResult:
    """Comparison of multiple scenarios."""
    scenarios: List[ScenarioResult]
    best_scenario: str
    worst_scenario: str
    baseline_scenario: str
    loss_range: Tuple[float, float]
    key_differences: List[Dict[str, Any]]
    recommendations: List[str]


@dataclass
class OptimizationResult:
    """Result of decision optimization."""
    optimal_parameters: Dict[str, float]
    expected_improvement: float
    cost_of_mitigation: float
    roi: float
    implementation_priority: List[str]
    constraints_binding: List[str]


class WhatIfSimulator:
    """
    What-If Simulator for scenario analysis.
    
    Features:
    - Define and modify scenarios
    - Run sensitivity analysis
    - Compare multiple scenarios
    - Monte Carlo simulation
    - Decision optimization
    """
    
    def __init__(self):
        self.parameters: Dict[str, Parameter] = {}
        self.scenarios: Dict[str, Scenario] = {}
        self.results_cache: Dict[str, ScenarioResult] = {}
        self._initialize_default_parameters()
    
    def _initialize_default_parameters(self):
        """Initialize default adjustable parameters."""
        defaults = [
            Parameter(
                name="event_severity",
                param_type=ParameterType.SEVERITY,
                base_value=0.5,
                min_value=0.0,
                max_value=1.0,
                current_value=0.5,
                unit="ratio",
                description="Severity of the risk event (0=none, 1=catastrophic)",
            ),
            Parameter(
                name="event_probability",
                param_type=ParameterType.PROBABILITY,
                base_value=0.1,
                min_value=0.0,
                max_value=1.0,
                current_value=0.1,
                unit="probability",
                description="Annual probability of event occurrence",
            ),
            Parameter(
                name="portfolio_exposure",
                param_type=ParameterType.EXPOSURE,
                base_value=1.0,
                min_value=0.0,
                max_value=2.0,
                current_value=1.0,
                unit="multiplier",
                description="Relative exposure level (1=current)",
            ),
            Parameter(
                name="recovery_speed",
                param_type=ParameterType.RECOVERY_TIME,
                base_value=1.0,
                min_value=0.5,
                max_value=3.0,
                current_value=1.0,
                unit="multiplier",
                description="Recovery time multiplier (1=baseline)",
            ),
            Parameter(
                name="mitigation_level",
                param_type=ParameterType.MITIGATION,
                base_value=0.0,
                min_value=0.0,
                max_value=1.0,
                current_value=0.0,
                unit="ratio",
                description="Level of mitigation measures applied (0=none, 1=full)",
            ),
            Parameter(
                name="asset_correlation",
                param_type=ParameterType.CORRELATION,
                base_value=0.3,
                min_value=0.0,
                max_value=0.9,
                current_value=0.3,
                unit="correlation",
                description="Correlation between asset risks",
            ),
        ]
        
        for param in defaults:
            self.parameters[param.name] = param
    
    def set_parameter(self, name: str, value: float) -> bool:
        """Set a parameter value."""
        if name not in self.parameters:
            return False
        
        param = self.parameters[name]
        if param.min_value <= value <= param.max_value:
            param.current_value = value
            return True
        return False
    
    def create_scenario(
        self,
        name: str,
        scenario_type: ScenarioType,
        parameters: Dict[str, float],
        description: str = "",
    ) -> Scenario:
        """Create a new scenario."""
        scenario_id = f"scenario_{len(self.scenarios) + 1}"
        
        scenario = Scenario(
            id=scenario_id,
            name=name,
            scenario_type=scenario_type,
            parameters=parameters,
            description=description,
        )
        
        self.scenarios[scenario_id] = scenario
        return scenario
    
    def create_predefined_scenarios(self, base_exposure: float = 100_000_000):
        """Create standard predefined scenarios."""
        # Baseline
        self.create_scenario(
            name="Baseline",
            scenario_type=ScenarioType.BASELINE,
            parameters={
                "event_severity": 0.5,
                "event_probability": 0.1,
                "portfolio_exposure": 1.0,
                "recovery_speed": 1.0,
                "mitigation_level": 0.0,
                "asset_correlation": 0.3,
            },
            description="Current state without changes",
        )
        
        # Optimistic
        self.create_scenario(
            name="Optimistic",
            scenario_type=ScenarioType.OPTIMISTIC,
            parameters={
                "event_severity": 0.3,
                "event_probability": 0.05,
                "portfolio_exposure": 0.8,
                "recovery_speed": 0.7,
                "mitigation_level": 0.5,
                "asset_correlation": 0.2,
            },
            description="Best case with mitigation in place",
        )
        
        # Pessimistic
        self.create_scenario(
            name="Pessimistic",
            scenario_type=ScenarioType.PESSIMISTIC,
            parameters={
                "event_severity": 0.7,
                "event_probability": 0.2,
                "portfolio_exposure": 1.2,
                "recovery_speed": 1.5,
                "mitigation_level": 0.0,
                "asset_correlation": 0.5,
            },
            description="Adverse conditions without mitigation",
        )
        
        # Stress
        self.create_scenario(
            name="Stress Test",
            scenario_type=ScenarioType.STRESS,
            parameters={
                "event_severity": 0.9,
                "event_probability": 0.3,
                "portfolio_exposure": 1.5,
                "recovery_speed": 2.0,
                "mitigation_level": 0.0,
                "asset_correlation": 0.7,
            },
            description="Extreme stress scenario (regulatory compliance)",
        )
    
    async def run_scenario(
        self,
        scenario_id: str,
        base_exposure: float = 100_000_000,
        num_simulations: int = 10000,
    ) -> ScenarioResult:
        """
        Run a scenario simulation.
        
        Args:
            scenario_id: ID of scenario to run
            base_exposure: Base portfolio exposure value
            num_simulations: Number of Monte Carlo simulations
            
        Returns:
            ScenarioResult with risk metrics
        """
        if scenario_id not in self.scenarios:
            raise ValueError(f"Scenario {scenario_id} not found")
        
        scenario = self.scenarios[scenario_id]
        params = scenario.parameters
        
        # Extract parameters
        severity = params.get("event_severity", 0.5)
        probability = params.get("event_probability", 0.1)
        exposure_mult = params.get("portfolio_exposure", 1.0)
        recovery_mult = params.get("recovery_speed", 1.0)
        mitigation = params.get("mitigation_level", 0.0)
        correlation = params.get("asset_correlation", 0.3)
        
        # Calculate effective exposure
        effective_exposure = base_exposure * exposure_mult
        
        # Mitigation reduces severity
        effective_severity = severity * (1 - mitigation * 0.6)
        
        # Monte Carlo simulation
        np.random.seed(42)  # Reproducible
        
        # Generate correlated losses using Gaussian copula
        n_assets = 10
        losses = np.zeros(num_simulations)
        
        for sim in range(num_simulations):
            # Determine if event occurs
            if np.random.random() < probability:
                # Generate correlated uniform variables
                z = np.random.multivariate_normal(
                    mean=np.zeros(n_assets),
                    cov=np.eye(n_assets) * (1 - correlation) + correlation,
                )
                u = np.clip((z + 3) / 6, 0, 1)  # Convert to uniform
                
                # Calculate loss for each asset
                asset_exposure = effective_exposure / n_assets
                for i in range(n_assets):
                    if u[i] < effective_severity:
                        loss_ratio = u[i] * effective_severity
                        losses[sim] += asset_exposure * loss_ratio
        
        # Calculate metrics
        expected_loss = np.mean(losses)
        var_95 = np.percentile(losses, 95)
        var_99 = np.percentile(losses, 99)
        
        # CVaR (Expected Shortfall)
        tail_losses = losses[losses >= var_95]
        cvar = np.mean(tail_losses) if len(tail_losses) > 0 else var_95
        
        # Probability of any loss
        prob_loss = np.mean(losses > 0)
        
        # Recovery time (base 6 months, scaled by recovery_mult)
        recovery_time = 6 * recovery_mult
        
        # Risk score (0-100)
        risk_score = min(100, (
            (expected_loss / effective_exposure * 100) * 0.3 +
            (var_99 / effective_exposure * 100) * 0.3 +
            probability * 100 * 0.2 +
            severity * 100 * 0.2
        ))
        
        result = ScenarioResult(
            scenario_id=scenario_id,
            scenario_name=scenario.name,
            expected_loss=round(expected_loss, 2),
            var_95=round(var_95, 2),
            var_99=round(var_99, 2),
            cvar=round(cvar, 2),
            probability_of_loss=round(prob_loss, 4),
            recovery_time_months=round(recovery_time, 1),
            risk_score=round(risk_score, 1),
            key_metrics={
                "effective_exposure": effective_exposure,
                "effective_severity": effective_severity,
                "mitigation_effect": mitigation * 0.6 * 100,
                "simulations": num_simulations,
            },
        )
        
        self.results_cache[scenario_id] = result
        return result
    
    async def run_sensitivity_analysis(
        self,
        parameter_name: str,
        num_points: int = 11,
        base_exposure: float = 100_000_000,
    ) -> SensitivityResult:
        """
        Run sensitivity analysis on a parameter.
        
        Args:
            parameter_name: Parameter to analyze
            num_points: Number of test points
            base_exposure: Base portfolio exposure
            
        Returns:
            SensitivityResult with sensitivity metrics
        """
        if parameter_name not in self.parameters:
            raise ValueError(f"Parameter {parameter_name} not found")
        
        param = self.parameters[parameter_name]
        
        # Generate test values
        test_values = np.linspace(param.min_value, param.max_value, num_points).tolist()
        output_values = []
        
        # Create temp scenario for each test
        for value in test_values:
            temp_scenario = self.create_scenario(
                name=f"Sensitivity_{parameter_name}_{value:.2f}",
                scenario_type=ScenarioType.CUSTOM,
                parameters={
                    **{p.name: p.current_value for p in self.parameters.values()},
                    parameter_name: value,
                },
            )
            
            result = await self.run_scenario(
                temp_scenario.id,
                base_exposure=base_exposure,
                num_simulations=5000,  # Fewer for speed
            )
            
            output_values.append(result.expected_loss)
            
            # Clean up temp scenario
            del self.scenarios[temp_scenario.id]
        
        # Calculate elasticity (at base value)
        base_idx = len(test_values) // 2
        if base_idx > 0 and base_idx < len(test_values) - 1:
            delta_input = (test_values[base_idx + 1] - test_values[base_idx - 1]) / param.base_value
            delta_output = (output_values[base_idx + 1] - output_values[base_idx - 1])
            base_output = output_values[base_idx] or 1
            elasticity = (delta_output / base_output) / (delta_input or 1)
        else:
            elasticity = 0
        
        # Determine if critical (high elasticity)
        is_critical = abs(elasticity) > 1.5
        
        return SensitivityResult(
            parameter_name=parameter_name,
            base_value=param.base_value,
            values_tested=test_values,
            output_metric="expected_loss",
            output_values=output_values,
            elasticity=round(elasticity, 3),
            impact_ranking=0,  # Set later in batch analysis
            is_critical=is_critical,
        )
    
    async def compare_scenarios(
        self,
        scenario_ids: List[str],
        base_exposure: float = 100_000_000,
    ) -> ComparisonResult:
        """
        Compare multiple scenarios.
        
        Args:
            scenario_ids: List of scenario IDs to compare
            base_exposure: Base portfolio exposure
            
        Returns:
            ComparisonResult with comparison metrics
        """
        results = []
        
        for scenario_id in scenario_ids:
            if scenario_id in self.results_cache:
                results.append(self.results_cache[scenario_id])
            else:
                result = await self.run_scenario(scenario_id, base_exposure)
                results.append(result)
        
        # Find best/worst
        sorted_by_loss = sorted(results, key=lambda r: r.expected_loss)
        best = sorted_by_loss[0].scenario_name
        worst = sorted_by_loss[-1].scenario_name
        
        # Find baseline
        baseline = next(
            (r.scenario_name for r in results if "baseline" in r.scenario_name.lower()),
            results[0].scenario_name,
        )
        
        # Loss range
        loss_range = (sorted_by_loss[0].expected_loss, sorted_by_loss[-1].expected_loss)
        
        # Key differences
        differences = []
        if len(results) >= 2:
            for i, r1 in enumerate(results):
                for r2 in results[i+1:]:
                    diff = {
                        "scenario_1": r1.scenario_name,
                        "scenario_2": r2.scenario_name,
                        "loss_difference": r2.expected_loss - r1.expected_loss,
                        "risk_score_diff": r2.risk_score - r1.risk_score,
                    }
                    differences.append(diff)
        
        # Recommendations
        recommendations = []
        if loss_range[1] - loss_range[0] > loss_range[0] * 0.5:
            recommendations.append("Significant variance between scenarios - consider mitigation")
        
        worst_result = sorted_by_loss[-1]
        if worst_result.risk_score > 70:
            recommendations.append(f"Stress scenario '{worst_result.scenario_name}' shows high risk - review contingency plans")
        
        best_result = sorted_by_loss[0]
        if best_result.expected_loss < worst_result.expected_loss * 0.5:
            recommendations.append(f"Mitigation in '{best_result.scenario_name}' reduces loss by >50%")
        
        return ComparisonResult(
            scenarios=results,
            best_scenario=best,
            worst_scenario=worst,
            baseline_scenario=baseline,
            loss_range=loss_range,
            key_differences=differences,
            recommendations=recommendations,
        )
    
    async def optimize_mitigation(
        self,
        budget: float,
        base_exposure: float = 100_000_000,
    ) -> OptimizationResult:
        """
        Optimize mitigation strategy within budget.
        
        Args:
            budget: Available budget for mitigation
            base_exposure: Base portfolio exposure
            
        Returns:
            OptimizationResult with optimal parameters
        """
        # Simple gradient-based optimization
        # In production, use scipy.optimize or similar
        
        best_params = {}
        best_loss = float('inf')
        
        # Test different mitigation levels
        for mitigation in np.linspace(0, 1, 11):
            # Estimate cost of mitigation
            mitigation_cost = budget * mitigation
            
            if mitigation_cost <= budget:
                # Create scenario
                scenario = self.create_scenario(
                    name=f"Opt_{mitigation:.1f}",
                    scenario_type=ScenarioType.CUSTOM,
                    parameters={
                        "event_severity": 0.5,
                        "event_probability": 0.1,
                        "portfolio_exposure": 1.0,
                        "recovery_speed": 1.0,
                        "mitigation_level": mitigation,
                        "asset_correlation": 0.3,
                    },
                )
                
                result = await self.run_scenario(scenario.id, base_exposure, 5000)
                
                # Objective: minimize loss + cost
                total_cost = result.expected_loss + mitigation_cost
                
                if total_cost < best_loss:
                    best_loss = total_cost
                    best_params = {"mitigation_level": mitigation}
                    best_result = result
                
                del self.scenarios[scenario.id]
        
        # Calculate improvement
        baseline_loss = base_exposure * 0.05  # Rough baseline estimate
        improvement = (baseline_loss - best_result.expected_loss) / baseline_loss * 100
        
        # Calculate ROI
        mitigation_cost = budget * best_params.get("mitigation_level", 0)
        loss_reduction = baseline_loss - best_result.expected_loss
        roi = (loss_reduction / mitigation_cost * 100) if mitigation_cost > 0 else 0
        
        return OptimizationResult(
            optimal_parameters=best_params,
            expected_improvement=round(improvement, 1),
            cost_of_mitigation=round(mitigation_cost, 2),
            roi=round(roi, 1),
            implementation_priority=[
                "Deploy flood barriers" if best_params.get("mitigation_level", 0) > 0.5 else "Increase monitoring",
                "Review insurance coverage",
                "Update business continuity plans",
            ],
            constraints_binding=["budget"] if best_params.get("mitigation_level", 0) >= 0.9 else [],
        )


# Global service instance
whatif_simulator = WhatIfSimulator()
