"""
Model Validator

Comprehensive model validation framework.
"""

from typing import Dict, List, Any, Optional
from datetime import datetime
from enum import Enum
import structlog
import pandas as pd
import numpy as np
from dataclasses import dataclass

logger = structlog.get_logger(__name__)


class ValidationStatus(Enum):
    """Validation status."""
    PASSED = "passed"
    FAILED = "failed"
    WARNING = "warning"


@dataclass
class ValidationResult:
    """Model validation result."""
    test_name: str
    status: ValidationStatus
    score: float
    threshold: float
    message: str
    details: Dict[str, Any] = None

    def __post_init__(self):
        if self.details is None:
            self.details = {}


class ModelValidator:
    """
    Model Validator.
    
    Comprehensive model validation framework.
    """

    def __init__(self):
        """Initialize model validator."""
        self.validation_results: List[ValidationResult] = []

    def validate_accuracy(
        self,
        predictions: pd.Series,
        actuals: pd.Series,
        threshold: float = 0.05,
    ) -> ValidationResult:
        """
        Validate model accuracy.

        Args:
            predictions: Model predictions
            actuals: Actual values
            threshold: Maximum allowed error

        Returns:
            Validation result
        """
        logger.info("Validating model accuracy")

        mae = np.mean(np.abs(predictions - actuals))
        mape = np.mean(np.abs((actuals - predictions) / actuals)) * 100

        status = ValidationStatus.PASSED if mape <= threshold * 100 else ValidationStatus.FAILED

        result = ValidationResult(
            test_name="Accuracy",
            status=status,
            score=mape,
            threshold=threshold * 100,
            message=f"MAPE: {mape:.2f}%",
            details={
                "mae": float(mae),
                "mape": float(mape),
                "rmse": float(np.sqrt(np.mean((predictions - actuals) ** 2))),
            },
        )

        self.validation_results.append(result)
        return result

    def validate_calibration(
        self,
        predictions: pd.Series,
        actuals: pd.Series,
        confidence_level: float = 0.95,
    ) -> ValidationResult:
        """
        Validate model calibration.

        Args:
            predictions: Model predictions
            actuals: Actual values
            confidence_level: Confidence level

        Returns:
            Validation result
        """
        logger.info("Validating model calibration")

        # Calculate hit rate
        if len(predictions) > 0:
            # Simplified calibration test
            within_range = (
                (actuals >= predictions * (1 - (1 - confidence_level) / 2)) &
                (actuals <= predictions * (1 + (1 - confidence_level) / 2))
            )
            hit_rate = within_range.mean()
        else:
            hit_rate = 0

        expected_hit_rate = confidence_level
        deviation = abs(hit_rate - expected_hit_rate)

        status = (
            ValidationStatus.PASSED if deviation < 0.05
            else ValidationStatus.WARNING if deviation < 0.10
            else ValidationStatus.FAILED
        )

        result = ValidationResult(
            test_name="Calibration",
            status=status,
            score=hit_rate,
            threshold=expected_hit_rate,
            message=f"Hit rate: {hit_rate:.2%}, Expected: {expected_hit_rate:.2%}",
            details={
                "hit_rate": float(hit_rate),
                "expected_hit_rate": float(expected_hit_rate),
                "deviation": float(deviation),
            },
        )

        self.validation_results.append(result)
        return result

    def validate_stability(
        self,
        predictions_over_time: pd.DataFrame,
        threshold: float = 0.10,
    ) -> ValidationResult:
        """
        Validate model stability.

        Args:
            predictions_over_time: Predictions over time
            threshold: Maximum allowed coefficient of variation

        Returns:
            Validation result
        """
        logger.info("Validating model stability")

        # Calculate coefficient of variation
        std = predictions_over_time.std(axis=1).mean()
        mean = predictions_over_time.mean(axis=1).mean()
        cv = std / mean if mean > 0 else 0

        status = ValidationStatus.PASSED if cv <= threshold else ValidationStatus.FAILED

        result = ValidationResult(
            test_name="Stability",
            status=status,
            score=cv,
            threshold=threshold,
            message=f"Coefficient of variation: {cv:.4f}",
            details={
                "coefficient_of_variation": float(cv),
                "mean": float(mean),
                "std": float(std),
            },
        )

        self.validation_results.append(result)
        return result

    def validate_sensitivity(
        self,
        base_prediction: float,
        perturbed_predictions: Dict[str, float],
        threshold: float = 0.20,
    ) -> ValidationResult:
        """
        Validate model sensitivity.

        Args:
            base_prediction: Base prediction
            perturbed_predictions: Predictions with perturbed inputs
            threshold: Maximum allowed sensitivity

        Returns:
            Validation result
        """
        logger.info("Validating model sensitivity")

        max_change = 0
        for name, perturbed in perturbed_predictions.items():
            change = abs(perturbed - base_prediction) / base_prediction if base_prediction > 0 else 0
            max_change = max(max_change, change)

        status = ValidationStatus.PASSED if max_change <= threshold else ValidationStatus.FAILED

        result = ValidationResult(
            test_name="Sensitivity",
            status=status,
            score=max_change,
            threshold=threshold,
            message=f"Maximum sensitivity: {max_change:.2%}",
            details={
                "max_change": float(max_change),
                "perturbed_predictions": perturbed_predictions,
            },
        )

        self.validation_results.append(result)
        return result

    def run_full_validation(
        self,
        model: Any,
        test_data: Dict[str, pd.DataFrame],
    ) -> Dict[str, ValidationResult]:
        """
        Run full validation suite.

        Args:
            model: Model to validate
            test_data: Test datasets

        Returns:
            Dictionary of validation results
        """
        logger.info("Running full validation suite")

        results = {}

        # Accuracy validation
        if "predictions" in test_data and "actuals" in test_data:
            results["accuracy"] = self.validate_accuracy(
                test_data["predictions"],
                test_data["actuals"],
            )

        # Calibration validation
        if "predictions" in test_data and "actuals" in test_data:
            results["calibration"] = self.validate_calibration(
                test_data["predictions"],
                test_data["actuals"],
            )

        # Stability validation
        if "predictions_over_time" in test_data:
            results["stability"] = self.validate_stability(
                test_data["predictions_over_time"],
            )

        return results

    def get_validation_summary(self) -> Dict[str, Any]:
        """
        Get validation summary.

        Returns:
            Summary dictionary
        """
        total_tests = len(self.validation_results)
        passed = sum(1 for r in self.validation_results if r.status == ValidationStatus.PASSED)
        failed = sum(1 for r in self.validation_results if r.status == ValidationStatus.FAILED)
        warnings = sum(1 for r in self.validation_results if r.status == ValidationStatus.WARNING)

        return {
            "total_tests": total_tests,
            "passed": passed,
            "failed": failed,
            "warnings": warnings,
            "pass_rate": passed / total_tests if total_tests > 0 else 0,
            "results": [
                {
                    "test_name": r.test_name,
                    "status": r.status.value,
                    "score": r.score,
                    "message": r.message,
                }
                for r in self.validation_results
            ],
        }

