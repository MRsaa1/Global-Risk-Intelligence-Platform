"""
Reverse Stress Testing Engine

Identifies scenarios that lead to specified loss levels.
"""

from typing import Dict, List, Any, Optional, Tuple
import structlog
import numpy as np
import pandas as pd
from scipy.optimize import differential_evolution

logger = structlog.get_logger(__name__)


class ReverseStressEngine:
    """
    Reverse Stress Testing Engine.
    
    Finds scenarios that result in target loss levels.
    """

    def __init__(self, target_loss: float = 0.20):
        """
        Initialize reverse stress engine.

        Args:
            target_loss: Target loss level (e.g., 0.20 for 20% loss)
        """
        self.target_loss = target_loss
        self.variable_bounds: Dict[str, Tuple[float, float]] = {}

    def set_variable_bounds(
        self,
        variables: Dict[str, Tuple[float, float]],
    ) -> None:
        """
        Set bounds for variables to search.

        Args:
            variables: Dictionary of variable names and (min, max) bounds
        """
        self.variable_bounds = variables
        logger.info("Variable bounds set", n_variables=len(variables))

    def find_critical_scenarios(
        self,
        portfolio: Dict[str, Any],
        loss_function,
        n_scenarios: int = 10,
    ) -> List[Dict[str, Any]]:
        """
        Find critical scenarios that lead to target loss.

        Args:
            portfolio: Portfolio definition
            loss_function: Function that calculates loss given scenario
            n_scenarios: Number of scenarios to find

        Returns:
            List of critical scenarios
        """
        logger.info(
            "Finding critical scenarios",
            target_loss=self.target_loss,
            n_scenarios=n_scenarios,
        )

        if not self.variable_bounds:
            raise ValueError("Variable bounds must be set")

        variables = list(self.variable_bounds.keys())
        bounds = [self.variable_bounds[v] for v in variables]

        critical_scenarios = []

        for i in range(n_scenarios):
            # Use differential evolution to find scenario
            result = differential_evolution(
                lambda x: abs(loss_function(dict(zip(variables, x))) - self.target_loss),
                bounds,
                seed=i,
                maxiter=1000,
            )

            scenario = dict(zip(variables, result.x))
            actual_loss = loss_function(scenario)

            critical_scenarios.append({
                "scenario_id": f"critical_{i+1}",
                "scenario": scenario,
                "target_loss": self.target_loss,
                "actual_loss": actual_loss,
                "loss_error": abs(actual_loss - self.target_loss),
                "converged": result.success,
            })

        # Sort by loss error
        critical_scenarios.sort(key=lambda x: x["loss_error"])

        return critical_scenarios

    def identify_tail_risks(
        self,
        portfolio: Dict[str, Any],
        loss_function,
        confidence_level: float = 0.99,
    ) -> Dict[str, Any]:
        """
        Identify tail risks.

        Args:
            portfolio: Portfolio definition
            loss_function: Function that calculates loss
            confidence_level: Confidence level for tail

        Returns:
            Tail risk analysis
        """
        logger.info("Identifying tail risks", confidence_level=confidence_level)

        # Generate random scenarios
        n_samples = 10000
        scenarios = []
        losses = []

        for _ in range(n_samples):
            scenario = {}
            for var, (min_val, max_val) in self.variable_bounds.items():
                scenario[var] = np.random.uniform(min_val, max_val)
            
            loss = loss_function(scenario)
            scenarios.append(scenario)
            losses.append(loss)

        losses = np.array(losses)
        tail_threshold = np.percentile(losses, confidence_level * 100)

        # Find scenarios in tail
        tail_scenarios = [
            scenarios[i]
            for i in range(len(scenarios))
            if losses[i] >= tail_threshold
        ]

        return {
            "tail_threshold": tail_threshold,
            "tail_percentage": (losses >= tail_threshold).mean(),
            "max_loss": losses.max(),
            "tail_scenarios": tail_scenarios[:10],  # Top 10
        }

