"""
Benchmark Comparator

Compare models against benchmarks.
"""

from typing import Dict, List, Any, Optional
import structlog
import pandas as pd
import numpy as np

logger = structlog.get_logger(__name__)


class BenchmarkComparator:
    """
    Benchmark Comparator.
    
    Compares model performance against benchmarks.
    """

    def __init__(self):
        """Initialize benchmark comparator."""
        self.comparisons: List[Dict[str, Any]] = []

    def compare_against_benchmark(
        self,
        model_predictions: pd.Series,
        benchmark_predictions: pd.Series,
        actuals: pd.Series,
    ) -> Dict[str, Any]:
        """
        Compare model against benchmark.

        Args:
            model_predictions: Model predictions
            benchmark_predictions: Benchmark predictions
            actuals: Actual values

        Returns:
            Comparison results
        """
        logger.info("Comparing model against benchmark")

        # Calculate errors
        model_error = np.abs(model_predictions - actuals)
        benchmark_error = np.abs(benchmark_predictions - actuals)

        # Calculate metrics
        model_mae = model_error.mean()
        benchmark_mae = benchmark_error.mean()

        model_rmse = np.sqrt(np.mean((model_predictions - actuals) ** 2))
        benchmark_rmse = np.sqrt(np.mean((benchmark_predictions - actuals) ** 2))

        # Improvement
        mae_improvement = (benchmark_mae - model_mae) / benchmark_mae if benchmark_mae > 0 else 0
        rmse_improvement = (benchmark_rmse - model_rmse) / benchmark_rmse if benchmark_rmse > 0 else 0

        result = {
            "model_mae": float(model_mae),
            "benchmark_mae": float(benchmark_mae),
            "model_rmse": float(model_rmse),
            "benchmark_rmse": float(benchmark_rmse),
            "mae_improvement": float(mae_improvement),
            "rmse_improvement": float(rmse_improvement),
            "model_better": model_mae < benchmark_mae,
        }

        self.comparisons.append(result)
        return result

    def compare_multiple_models(
        self,
        models: Dict[str, pd.Series],
        actuals: pd.Series,
    ) -> pd.DataFrame:
        """
        Compare multiple models.

        Args:
            models: Dictionary of model name -> predictions
            actuals: Actual values

        Returns:
            Comparison DataFrame
        """
        logger.info("Comparing multiple models", n_models=len(models))

        comparisons = []
        for model_name, predictions in models.items():
            error = np.abs(predictions - actuals)
            comparisons.append({
                "model_name": model_name,
                "mae": float(error.mean()),
                "rmse": float(np.sqrt(np.mean((predictions - actuals) ** 2))),
                "mape": float(np.mean(np.abs((actuals - predictions) / actuals)) * 100),
            })

        df = pd.DataFrame(comparisons)
        df = df.sort_values("mae")
        return df

