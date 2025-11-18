"""
Monte Carlo Simulation Engine for Stress Testing

Advanced Monte Carlo simulation with copula models and correlation management.
"""

from typing import Dict, List, Any, Optional, Tuple
from enum import Enum
import structlog
import numpy as np
import pandas as pd
from scipy.stats import multivariate_normal, t
from scipy.stats.distributions import rv_continuous

logger = structlog.get_logger(__name__)


class CopulaType(Enum):
    """Copula types for dependency modeling."""
    GAUSSIAN = "gaussian"
    T_COPULA = "t_copula"
    CLAYTON = "clayton"
    GUMBEL = "gumbel"


class MonteCarloEngine:
    """
    Monte Carlo Simulation Engine for stress testing.
    
    Supports various copula models and correlation structures.
    """

    def __init__(
        self,
        n_simulations: int = 10000,
        copula_type: CopulaType = CopulaType.GAUSSIAN,
        random_seed: Optional[int] = None,
    ):
        """
        Initialize Monte Carlo engine.

        Args:
            n_simulations: Number of simulations
            copula_type: Type of copula model
            random_seed: Random seed for reproducibility
        """
        self.n_simulations = n_simulations
        self.copula_type = copula_type
        self.random_seed = random_seed
        
        if random_seed is not None:
            np.random.seed(random_seed)

        self.correlation_matrix: Optional[np.ndarray] = None
        self.marginal_distributions: Dict[str, rv_continuous] = {}

    def set_correlation_matrix(
        self,
        variables: List[str],
        correlation_matrix: np.ndarray,
    ) -> None:
        """
        Set correlation matrix for variables.

        Args:
            variables: List of variable names
            correlation_matrix: Correlation matrix (must be positive definite)
        """
        if correlation_matrix.shape[0] != len(variables):
            raise ValueError("Correlation matrix size must match variables")

        # Validate positive definiteness
        if not np.all(np.linalg.eigvals(correlation_matrix) > 0):
            raise ValueError("Correlation matrix must be positive definite")

        self.correlation_matrix = correlation_matrix
        self.variables = variables
        logger.info("Correlation matrix set", n_variables=len(variables))

    def set_marginal_distribution(
        self,
        variable: str,
        distribution: rv_continuous,
    ) -> None:
        """
        Set marginal distribution for a variable.

        Args:
            variable: Variable name
            distribution: scipy.stats distribution
        """
        self.marginal_distributions[variable] = distribution
        logger.info("Marginal distribution set", variable=variable)

    def generate_scenarios(
        self,
        shock_definitions: Dict[str, Dict[str, float]],
    ) -> pd.DataFrame:
        """
        Generate Monte Carlo scenarios.

        Args:
            shock_definitions: Definitions of shocks (mean, std, etc.)

        Returns:
            DataFrame with generated scenarios
        """
        logger.info(
            "Generating Monte Carlo scenarios",
            n_simulations=self.n_simulations,
            copula_type=self.copula_type.value,
        )

        # Generate correlated uniform random variables
        uniform_vars = self._generate_correlated_uniforms()

        # Transform to marginal distributions
        scenarios = {}
        for i, variable in enumerate(self.variables):
            if variable in self.marginal_distributions:
                dist = self.marginal_distributions[variable]
                scenarios[variable] = dist.ppf(uniform_vars[:, i])
            else:
                # Default: normal distribution
                shock_def = shock_definitions.get(variable, {"mean": 0, "std": 1})
                scenarios[variable] = (
                    np.random.normal(shock_def["mean"], shock_def["std"], self.n_simulations)
                )

        return pd.DataFrame(scenarios)

    def _generate_correlated_uniforms(self) -> np.ndarray:
        """Generate correlated uniform random variables using copula."""
        if self.correlation_matrix is None:
            raise ValueError("Correlation matrix must be set")

        if self.copula_type == CopulaType.GAUSSIAN:
            return self._gaussian_copula()
        elif self.copula_type == CopulaType.T_COPULA:
            return self._t_copula()
        else:
            # Default to Gaussian
            return self._gaussian_copula()

    def _gaussian_copula(self) -> np.ndarray:
        """Generate samples from Gaussian copula."""
        n_vars = len(self.variables)
        mean = np.zeros(n_vars)
        
        # Generate multivariate normal
        samples = np.random.multivariate_normal(
            mean,
            self.correlation_matrix,
            size=self.n_simulations,
        )
        
        # Transform to uniform via CDF
        uniform_samples = multivariate_normal.cdf(
            samples,
            mean=mean,
            cov=self.correlation_matrix,
        )
        
        return uniform_samples

    def _t_copula(self, degrees_of_freedom: int = 5) -> np.ndarray:
        """Generate samples from t-copula."""
        n_vars = len(self.variables)
        mean = np.zeros(n_vars)
        
        # Generate multivariate t
        # Simplified implementation
        samples = np.random.multivariate_normal(
            mean,
            self.correlation_matrix,
            size=self.n_simulations,
        )
        
        # Apply t-distribution transformation
        chi2_samples = np.random.chisquare(degrees_of_freedom, self.n_simulations)
        t_samples = samples / np.sqrt(chi2_samples / degrees_of_freedom)[:, np.newaxis]
        
        # Transform to uniform
        uniform_samples = t.cdf(t_samples, degrees_of_freedom)
        
        return uniform_samples

    def calculate_var(
        self,
        portfolio_values: np.ndarray,
        confidence_level: float = 0.95,
    ) -> float:
        """
        Calculate Value at Risk (VaR).

        Args:
            portfolio_values: Portfolio values for each scenario
            confidence_level: Confidence level (e.g., 0.95 for 95% VaR)

        Returns:
            VaR value
        """
        var = np.percentile(portfolio_values, (1 - confidence_level) * 100)
        return var

    def calculate_cvar(
        self,
        portfolio_values: np.ndarray,
        confidence_level: float = 0.95,
    ) -> float:
        """
        Calculate Conditional VaR (CVaR / Expected Shortfall).

        Args:
            portfolio_values: Portfolio values for each scenario
            confidence_level: Confidence level

        Returns:
            CVaR value
        """
        var = self.calculate_var(portfolio_values, confidence_level)
        cvar = portfolio_values[portfolio_values <= var].mean()
        return cvar

    def analyze_convergence(
        self,
        portfolio_values: np.ndarray,
        batch_sizes: List[int] = None,
    ) -> pd.DataFrame:
        """
        Analyze convergence of Monte Carlo simulation.

        Args:
            portfolio_values: Portfolio values for each scenario
            batch_sizes: List of batch sizes to test

        Returns:
            DataFrame with convergence analysis
        """
        if batch_sizes is None:
            batch_sizes = [100, 500, 1000, 5000, 10000]

        convergence_data = []
        final_mean = portfolio_values.mean()
        final_std = portfolio_values.std()

        for batch_size in batch_sizes:
            if batch_size > len(portfolio_values):
                continue

            batch_values = portfolio_values[:batch_size]
            mean = batch_values.mean()
            std = batch_values.std()

            convergence_data.append({
                "batch_size": batch_size,
                "mean": mean,
                "std": std,
                "mean_error": abs(mean - final_mean),
                "std_error": abs(std - final_std),
            })

        return pd.DataFrame(convergence_data)

    def stress_var(
        self,
        portfolio_values: np.ndarray,
        stress_scenarios: pd.DataFrame,
        confidence_level: float = 0.99,
    ) -> Dict[str, float]:
        """
        Calculate Stress VaR.

        Args:
            portfolio_values: Portfolio values
            stress_scenarios: Stress scenario definitions
            confidence_level: Confidence level

        Returns:
            Dictionary with Stress VaR metrics
        """
        # Filter to stress scenarios
        stress_values = portfolio_values[
            portfolio_values <= np.percentile(portfolio_values, (1 - confidence_level) * 100)
        ]

        return {
            "stress_var": stress_values.min(),
            "stress_cvar": stress_values.mean(),
            "stress_count": len(stress_values),
            "stress_percentage": len(stress_values) / len(portfolio_values),
        }

