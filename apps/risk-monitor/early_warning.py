"""
Early Warning Indicators System

Bloomberg-level early warning system for stress detection.
"""

from typing import Dict, List, Any, Optional, Callable
from datetime import datetime, timedelta
from enum import Enum
import structlog
import pandas as pd
import numpy as np
from dataclasses import dataclass

logger = structlog.get_logger(__name__)


class IndicatorType(Enum):
    """Types of early warning indicators."""
    MARKET = "market"
    CREDIT = "credit"
    LIQUIDITY = "liquidity"
    MACRO = "macro"
    SYSTEMIC = "systemic"


@dataclass
class Indicator:
    """Early warning indicator."""
    name: str
    indicator_type: IndicatorType
    current_value: float
    threshold: float
    weight: float = 1.0
    trend: str = "neutral"  # "increasing", "decreasing", "neutral"
    severity: str = "low"  # "low", "medium", "high", "critical"


class EarlyWarningSystem:
    """
    Early Warning Indicators System.
    
    Monitors market, credit, liquidity, and macro indicators
    to predict potential stress events.
    """

    def __init__(self):
        """Initialize early warning system."""
        self.indicators: Dict[str, Indicator] = {}
        self.historical_data: Dict[str, pd.Series] = {}
        self.ml_models: Dict[str, Any] = {}
        self.alerts: List[Dict[str, Any]] = []
        self._data_sources: Dict[str, Callable] = {}

    def register_indicator(
        self,
        name: str,
        indicator_type: IndicatorType,
        threshold: float,
        weight: float = 1.0,
        data_source: Optional[Callable] = None,
    ) -> None:
        """
        Register early warning indicator.

        Args:
            name: Indicator name
            indicator_type: Type of indicator
            threshold: Alert threshold
            weight: Weight for composite score
            data_source: Function to fetch current value
        """
        indicator = Indicator(
            name=name,
            indicator_type=indicator_type,
            current_value=0.0,
            threshold=threshold,
            weight=weight,
        )
        self.indicators[name] = indicator
        
        if data_source:
            self._data_sources[name] = data_source

        logger.info("Indicator registered", name=name, type=indicator_type.value)

    def update_indicator(
        self,
        name: str,
        value: float,
        timestamp: Optional[datetime] = None,
    ) -> None:
        """
        Update indicator value.

        Args:
            name: Indicator name
            value: Current value
            timestamp: Timestamp (default: now)
        """
        if name not in self.indicators:
            logger.warning("Indicator not found", name=name)
            return

        indicator = self.indicators[name]
        indicator.current_value = value

        # Update trend
        if name in self.historical_data:
            historical = self.historical_data[name]
            if len(historical) > 0:
                recent_avg = historical[-10:].mean() if len(historical) >= 10 else historical.mean()
                if value > recent_avg * 1.1:
                    indicator.trend = "increasing"
                elif value < recent_avg * 0.9:
                    indicator.trend = "decreasing"
                else:
                    indicator.trend = "neutral"

        # Store historical data
        if name not in self.historical_data:
            self.historical_data[name] = pd.Series(dtype=float)
        
        ts = timestamp or datetime.now()
        self.historical_data[name][ts] = value

        # Check threshold
        if value >= indicator.threshold:
            self._create_indicator_alert(name, value, indicator.threshold)

        logger.debug("Indicator updated", name=name, value=value)

    def _create_indicator_alert(
        self,
        name: str,
        value: float,
        threshold: float,
    ) -> None:
        """Create alert for indicator threshold breach."""
        indicator = self.indicators[name]
        
        # Calculate severity
        excess = value - threshold
        threshold_pct = (excess / threshold) * 100 if threshold > 0 else 0

        if threshold_pct > 50:
            severity = "critical"
        elif threshold_pct > 25:
            severity = "high"
        elif threshold_pct > 10:
            severity = "medium"
        else:
            severity = "low"

        alert = {
            "alert_id": f"ewi_{datetime.now().timestamp()}",
            "indicator_name": name,
            "indicator_type": indicator.indicator_type.value,
            "current_value": value,
            "threshold": threshold,
            "excess": excess,
            "severity": severity,
            "timestamp": datetime.now().isoformat(),
        }
        self.alerts.append(alert)
        indicator.severity = severity

        logger.warning(
            "Early warning indicator alert",
            indicator=name,
            value=value,
            threshold=threshold,
            severity=severity,
        )

    def calculate_composite_score(self) -> float:
        """
        Calculate composite early warning score.

        Returns:
            Composite score (0-100, higher = more risk)
        """
        if not self.indicators:
            return 0.0

        weighted_sum = 0.0
        total_weight = 0.0

        for name, indicator in self.indicators.items():
            # Normalize value to 0-100 scale
            normalized_value = min(100, (indicator.current_value / indicator.threshold) * 100)
            
            # Apply trend adjustment
            if indicator.trend == "increasing":
                normalized_value *= 1.1
            elif indicator.trend == "decreasing":
                normalized_value *= 0.9

            weighted_sum += normalized_value * indicator.weight
            total_weight += indicator.weight

        composite_score = weighted_sum / total_weight if total_weight > 0 else 0.0
        return min(100, composite_score)

    def get_market_indicators(self) -> Dict[str, float]:
        """Get market indicators."""
        market_indicators = {}
        for name, indicator in self.indicators.items():
            if indicator.indicator_type == IndicatorType.MARKET:
                market_indicators[name] = indicator.current_value
        return market_indicators

    def get_credit_indicators(self) -> Dict[str, float]:
        """Get credit indicators."""
        credit_indicators = {}
        for name, indicator in self.indicators.items():
            if indicator.indicator_type == IndicatorType.CREDIT:
                credit_indicators[name] = indicator.current_value
        return credit_indicators

    def predict_stress_probability(
        self,
        horizon_days: int = 30,
    ) -> float:
        """
        Predict probability of stress event.

        Args:
            horizon_days: Prediction horizon in days

        Returns:
            Probability of stress (0-1)
        """
        composite_score = self.calculate_composite_score()
        
        # Convert score to probability (simplified)
        # Higher score = higher probability
        probability = composite_score / 100.0
        
        # Apply horizon adjustment
        probability = probability * (1 - np.exp(-horizon_days / 30.0))

        return min(1.0, probability)

    def get_indicator_trends(self) -> Dict[str, str]:
        """Get trends for all indicators."""
        trends = {}
        for name, indicator in self.indicators.items():
            trends[name] = indicator.trend
        return trends

    def register_ml_model(
        self,
        model_name: str,
        model: Any,
    ) -> None:
        """
        Register machine learning model for prediction.

        Args:
            model_name: Model name
            model: Trained ML model
        """
        self.ml_models[model_name] = model
        logger.info("ML model registered", model_name=model_name)

    def predict_with_ml(
        self,
        model_name: str,
        features: Dict[str, float],
    ) -> Dict[str, Any]:
        """
        Predict using ML model.

        Args:
            model_name: Model name
            features: Feature values

        Returns:
            Prediction results
        """
        if model_name not in self.ml_models:
            raise ValueError(f"Model {model_name} not found")

        model = self.ml_models[model_name]
        
        # Convert features to array (simplified)
        feature_array = np.array([features.get(k, 0.0) for k in sorted(features.keys())])
        
        # Predict (simplified - would use actual model.predict)
        prediction = model.predict([feature_array])[0] if hasattr(model, 'predict') else 0.5

        return {
            "prediction": prediction,
            "confidence": 0.85,  # Simplified
            "timestamp": datetime.now().isoformat(),
        }


# Pre-configured indicators
def setup_default_indicators() -> EarlyWarningSystem:
    """Setup default early warning indicators."""
    ews = EarlyWarningSystem()

    # Market indicators
    ews.register_indicator(
        name="VIX",
        indicator_type=IndicatorType.MARKET,
        threshold=30.0,
        weight=1.5,
    )
    ews.register_indicator(
        name="CDS_Spread",
        indicator_type=IndicatorType.CREDIT,
        threshold=200.0,  # bps
        weight=1.2,
    )
    ews.register_indicator(
        name="Yield_Curve_Inversion",
        indicator_type=IndicatorType.MARKET,
        threshold=-0.5,  # 10Y - 2Y spread
        weight=1.3,
    )
    ews.register_indicator(
        name="Bid_Ask_Spread",
        indicator_type=IndicatorType.LIQUIDITY,
        threshold=0.05,  # 5%
        weight=1.0,
    )
    ews.register_indicator(
        name="GDP_Growth",
        indicator_type=IndicatorType.MACRO,
        threshold=-0.02,  # -2%
        weight=1.1,
    )
    ews.register_indicator(
        name="Unemployment_Rate",
        indicator_type=IndicatorType.MACRO,
        threshold=0.08,  # 8%
        weight=1.0,
    )

    return ews

