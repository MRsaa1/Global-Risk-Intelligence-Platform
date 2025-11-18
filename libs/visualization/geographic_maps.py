"""
Geographic Risk Maps

Geographic visualization of risk exposure.
"""

from typing import Dict, List, Any, Optional
import structlog
import pandas as pd

logger = structlog.get_logger(__name__)


class GeographicRiskMap:
    """
    Geographic Risk Map.
    
    Visualizes risk exposure by geographic region.
    """

    def __init__(self):
        """Initialize geographic risk map."""
        self.exposures: Dict[str, Dict[str, float]] = {}

    def add_exposure(
        self,
        country_code: str,
        country_name: str,
        exposure: float,
        risk_metrics: Dict[str, float],
    ) -> None:
        """
        Add country exposure.

        Args:
            country_code: ISO country code
            country_name: Country name
            exposure: Total exposure
            risk_metrics: Risk metrics (VaR, etc.)
        """
        self.exposures[country_code] = {
            "country_code": country_code,
            "country_name": country_name,
            "exposure": exposure,
            "risk_metrics": risk_metrics,
        }
        logger.debug("Exposure added", country_code=country_code, exposure=exposure)

    def calculate_regional_aggregates(
        self,
        region_mapping: Dict[str, str],
    ) -> Dict[str, Dict[str, float]]:
        """
        Calculate regional aggregates.

        Args:
            region_mapping: Mapping of country codes to regions

        Returns:
            Regional aggregates
        """
        regional_data = {}

        for country_code, exposure_data in self.exposures.items():
            region = region_mapping.get(country_code, "Other")
            
            if region not in regional_data:
                regional_data[region] = {
                    "exposure": 0,
                    "risk_metrics": {},
                    "countries": [],
                }

            regional_data[region]["exposure"] += exposure_data["exposure"]
            regional_data[region]["countries"].append(country_code)

            # Aggregate risk metrics
            for metric, value in exposure_data["risk_metrics"].items():
                if metric not in regional_data[region]["risk_metrics"]:
                    regional_data[region]["risk_metrics"][metric] = 0
                regional_data[region]["risk_metrics"][metric] += value

        return regional_data

    def export_for_plotly(self) -> List[Dict[str, Any]]:
        """
        Export for Plotly choropleth map.

        Returns:
            Plotly-compatible data
        """
        data = []
        for country_code, exposure_data in self.exposures.items():
            data.append({
                "country_code": country_code,
                "country_name": exposure_data["country_name"],
                "exposure": exposure_data["exposure"],
                "var": exposure_data["risk_metrics"].get("var", 0),
                "color": self._calculate_color(exposure_data["exposure"]),
            })

        return data

    def _calculate_color(self, exposure: float) -> str:
        """Calculate color based on exposure level."""
        # Simplified color calculation
        if exposure > 1000000:
            return "red"
        elif exposure > 500000:
            return "orange"
        elif exposure > 100000:
            return "yellow"
        else:
            return "green"

    def get_top_exposures(self, n: int = 10) -> List[Dict[str, Any]]:
        """
        Get top N exposures.

        Args:
            n: Number of top exposures

        Returns:
            List of top exposures
        """
        sorted_exposures = sorted(
            self.exposures.items(),
            key=lambda x: x[1]["exposure"],
            reverse=True,
        )

        return [
            {
                "country_code": code,
                "country_name": data["country_name"],
                "exposure": data["exposure"],
                "risk_metrics": data["risk_metrics"],
            }
            for code, data in sorted_exposures[:n]
        ]

