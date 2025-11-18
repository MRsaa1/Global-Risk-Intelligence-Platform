"""
Exposure at Default (EAD) models.
"""

from typing import Any, Dict, List, Optional
import structlog

logger = structlog.get_logger(__name__)


class EADModel:
    """Exposure at Default model."""

    def __init__(
        self,
        model_id: str,
        model_version: str = "1.0",
        parameters: Optional[Dict[str, Any]] = None,
    ):
        """
        Initialize EAD model.

        Args:
            model_id: Unique model identifier
            model_version: Model version
            parameters: Model parameters
        """
        self.model_id = model_id
        self.model_version = model_version
        self.parameters = parameters or {}

    def predict(
        self,
        exposure_data: Dict[str, Any],
        product_type: str = "loan",
    ) -> Dict[str, Any]:
        """
        Predict EAD for an exposure.

        Args:
            exposure_data: Exposure characteristics
            product_type: Product type (loan, commitment, derivative, etc.)

        Returns:
            Dictionary with EAD and related metrics
        """
        logger.info("Predicting EAD", model_id=self.model_id, product_type=product_type)

        # Get current exposure
        current_exposure = exposure_data.get("current_exposure", 0.0)

        # Calculate EAD based on product type
        if product_type == "loan":
            ead = self._calculate_loan_ead(exposure_data)
        elif product_type == "commitment":
            ead = self._calculate_commitment_ead(exposure_data)
        elif product_type == "derivative":
            ead = self._calculate_derivative_ead(exposure_data)
        else:
            ead = current_exposure

        return {
            "ead": ead,
            "current_exposure": current_exposure,
            "product_type": product_type,
            "model_id": self.model_id,
            "model_version": self.model_version,
            "ccf": ead / current_exposure if current_exposure > 0 else 0.0,  # Credit Conversion Factor
        }

    def _calculate_loan_ead(self, exposure_data: Dict[str, Any]) -> float:
        """Calculate EAD for loan products."""
        # For loans, EAD is typically the outstanding balance
        return exposure_data.get("outstanding_balance", exposure_data.get("current_exposure", 0.0))

    def _calculate_commitment_ead(self, exposure_data: Dict[str, Any]) -> float:
        """Calculate EAD for commitment products."""
        # EAD = drawn amount + (undrawn amount * CCF)
        drawn = exposure_data.get("drawn_amount", 0.0)
        undrawn = exposure_data.get("undrawn_amount", 0.0)
        ccf = exposure_data.get("ccf", self.parameters.get("default_ccf", 0.5))

        return drawn + (undrawn * ccf)

    def _calculate_derivative_ead(self, exposure_data: Dict[str, Any]) -> float:
        """Calculate EAD for derivative products."""
        # EAD = max(0, MTM) + AddOn
        mtm = exposure_data.get("mark_to_market", 0.0)
        addon = exposure_data.get("addon", 0.0)

        return max(0.0, mtm) + addon

    def predict_batch(
        self, exposures: List[Dict[str, Any]], product_types: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        """
        Predict EAD for multiple exposures.

        Args:
            exposures: List of exposure data dictionaries
            product_types: Optional list of product types

        Returns:
            List of EAD predictions
        """
        results = []
        for i, exposure in enumerate(exposures):
            product_type = (
                product_types[i] if product_types and i < len(product_types) else "loan"
            )
            result = self.predict(exposure, product_type)
            results.append(result)
        return results

