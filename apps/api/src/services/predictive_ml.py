"""
Predictive ML Service - Early Warning & Risk Forecasting.

Provides:
- Early Warning System (predict risks before events)
- Risk Score Forecasting (time-series prediction)
- Cascade Probability Estimation
- Anomaly Detection in sensor/financial data
- Feature Engineering for risk factors

Uses scikit-learn for CPU-based ML (no GPU required).
Can integrate with NVIDIA for GPU acceleration when available.
"""
import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Optional, Dict, Any, Tuple
from enum import Enum
import numpy as np
from scipy import stats

logger = logging.getLogger(__name__)

# Optional ML imports
try:
    from sklearn.ensemble import (
        RandomForestClassifier,
        RandomForestRegressor,
        GradientBoostingClassifier,
        IsolationForest,
    )
    from sklearn.preprocessing import StandardScaler
    from sklearn.model_selection import cross_val_score
    HAS_SKLEARN = True
except ImportError:
    HAS_SKLEARN = False
    logger.warning("scikit-learn not available, using simplified models")


class RiskTrend(str, Enum):
    """Risk trend direction."""
    INCREASING = "increasing"
    STABLE = "stable"
    DECREASING = "decreasing"
    VOLATILE = "volatile"


class AlertLevel(str, Enum):
    """Early warning alert levels."""
    NORMAL = "normal"
    WATCH = "watch"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class EarlyWarning:
    """Early warning prediction result."""
    asset_id: str
    alert_level: AlertLevel
    risk_score: float  # 0-100
    predicted_risk_score: float  # Predicted score in forecast_hours
    forecast_hours: int
    trend: RiskTrend
    confidence: float  # 0-1
    contributing_factors: List[str]
    recommended_actions: List[str]
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class RiskForecast:
    """Time-series risk forecast."""
    asset_id: str
    current_score: float
    forecasts: List[Dict[str, Any]]  # [{hours: 24, score: 75, confidence: 0.8}, ...]
    trend: RiskTrend
    peak_risk_hours: int  # When risk peaks
    peak_risk_score: float


@dataclass
class CascadePrediction:
    """Cascade event prediction."""
    trigger_asset_id: str
    trigger_event_type: str
    affected_assets: List[str]
    cascade_probability: float
    expected_total_loss: float
    propagation_time_hours: float
    critical_path: List[str]


@dataclass
class AnomalyResult:
    """Anomaly detection result."""
    asset_id: str
    is_anomaly: bool
    anomaly_score: float  # Higher = more anomalous
    anomaly_type: str  # structural, financial, operational
    deviation_sigma: float
    historical_comparison: str


class PredictiveMLService:
    """
    Machine Learning service for predictive risk analytics.
    
    Features:
    - Early Warning System with multi-factor analysis
    - Time-series risk forecasting
    - Cascade probability estimation
    - Anomaly detection
    """
    
    def __init__(self):
        self.models = {}
        self.scalers = {}
        self._initialize_models()
    
    def _initialize_models(self):
        """Initialize ML models."""
        if HAS_SKLEARN:
            # Risk classification model
            self.models['risk_classifier'] = RandomForestClassifier(
                n_estimators=100,
                max_depth=10,
                random_state=42,
                n_jobs=-1,
            )
            
            # Risk score regressor
            self.models['risk_regressor'] = RandomForestRegressor(
                n_estimators=100,
                max_depth=10,
                random_state=42,
                n_jobs=-1,
            )
            
            # Cascade predictor
            self.models['cascade_classifier'] = GradientBoostingClassifier(
                n_estimators=100,
                max_depth=5,
                random_state=42,
            )
            
            # Anomaly detector
            self.models['anomaly_detector'] = IsolationForest(
                n_estimators=100,
                contamination=0.1,
                random_state=42,
            )
            
            # Feature scaler
            self.scalers['standard'] = StandardScaler()
            
            logger.info("ML models initialized with scikit-learn")
        else:
            logger.info("Using simplified rule-based models")
    
    # =========================================================================
    # EARLY WARNING SYSTEM
    # =========================================================================
    
    async def generate_early_warning(
        self,
        asset_id: str,
        current_metrics: Dict[str, float],
        historical_data: Optional[List[Dict]] = None,
        forecast_hours: int = 72,
    ) -> EarlyWarning:
        """
        Generate early warning for an asset.
        
        Args:
            asset_id: Asset identifier
            current_metrics: Current risk metrics
                - climate_risk: 0-100
                - physical_risk: 0-100
                - financial_risk: 0-100
                - network_risk: 0-100
                - operational_risk: 0-100
            historical_data: Past metrics for trend analysis
            forecast_hours: Hours to forecast ahead
            
        Returns:
            EarlyWarning with alert level and predictions
        """
        # Extract current scores
        climate = current_metrics.get('climate_risk', 50)
        physical = current_metrics.get('physical_risk', 50)
        financial = current_metrics.get('financial_risk', 50)
        network = current_metrics.get('network_risk', 50)
        operational = current_metrics.get('operational_risk', 50)
        
        # Calculate composite risk score
        weights = {
            'climate': 0.25,
            'physical': 0.20,
            'financial': 0.25,
            'network': 0.15,
            'operational': 0.15,
        }
        
        current_score = (
            climate * weights['climate'] +
            physical * weights['physical'] +
            financial * weights['financial'] +
            network * weights['network'] +
            operational * weights['operational']
        )
        
        # Analyze trend from historical data
        trend = RiskTrend.STABLE
        predicted_score = current_score
        confidence = 0.7
        
        if historical_data and len(historical_data) >= 3:
            historical_scores = [
                sum(h.get(k, 50) * v for k, v in weights.items())
                for h in historical_data[-10:]  # Last 10 data points
            ]
            
            # Calculate trend
            if len(historical_scores) >= 3:
                slope, _, r_value, _, _ = stats.linregress(
                    range(len(historical_scores)), historical_scores
                )
                
                if slope > 2:
                    trend = RiskTrend.INCREASING
                    predicted_score = min(100, current_score + slope * (forecast_hours / 24))
                elif slope < -2:
                    trend = RiskTrend.DECREASING
                    predicted_score = max(0, current_score + slope * (forecast_hours / 24))
                else:
                    trend = RiskTrend.STABLE
                    predicted_score = current_score
                
                # Confidence based on R-squared
                confidence = min(0.95, abs(r_value) * 0.8 + 0.3)
                
                # Check for volatility
                std_dev = np.std(historical_scores)
                if std_dev > 15:
                    trend = RiskTrend.VOLATILE
                    confidence *= 0.7
        else:
            # Without historical data, use heuristic forecasting
            if climate > 70 or physical > 70:
                trend = RiskTrend.INCREASING
                predicted_score = min(100, current_score * 1.15)
            confidence = 0.5
        
        # Determine alert level
        if predicted_score >= 80 or current_score >= 75:
            alert_level = AlertLevel.CRITICAL
        elif predicted_score >= 65 or current_score >= 60:
            alert_level = AlertLevel.WARNING
        elif predicted_score >= 50 or current_score >= 45:
            alert_level = AlertLevel.WATCH
        else:
            alert_level = AlertLevel.NORMAL
        
        # Identify contributing factors
        contributing_factors = []
        factor_scores = [
            ('Climate Risk', climate),
            ('Physical Risk', physical),
            ('Financial Risk', financial),
            ('Network Risk', network),
            ('Operational Risk', operational),
        ]
        
        # Sort by score descending
        factor_scores.sort(key=lambda x: x[1], reverse=True)
        
        for name, score in factor_scores[:3]:
            if score >= 60:
                contributing_factors.append(f"{name}: {score:.0f}/100 (elevated)")
            elif score >= 40:
                contributing_factors.append(f"{name}: {score:.0f}/100 (moderate)")
        
        # Generate recommendations
        recommended_actions = self._generate_recommendations(
            alert_level, factor_scores, trend
        )
        
        return EarlyWarning(
            asset_id=asset_id,
            alert_level=alert_level,
            risk_score=current_score,
            predicted_risk_score=predicted_score,
            forecast_hours=forecast_hours,
            trend=trend,
            confidence=confidence,
            contributing_factors=contributing_factors,
            recommended_actions=recommended_actions,
        )
    
    def _generate_recommendations(
        self,
        alert_level: AlertLevel,
        factor_scores: List[Tuple[str, float]],
        trend: RiskTrend,
    ) -> List[str]:
        """Generate actionable recommendations based on risk factors."""
        recommendations = []
        
        # Base recommendations by alert level
        if alert_level == AlertLevel.CRITICAL:
            recommendations.append("Activate emergency response protocols immediately")
            recommendations.append("Convene crisis management team within 2 hours")
        elif alert_level == AlertLevel.WARNING:
            recommendations.append("Escalate to risk management for review")
            recommendations.append("Prepare contingency plans for activation")
        elif alert_level == AlertLevel.WATCH:
            recommendations.append("Increase monitoring frequency")
            recommendations.append("Review current mitigation measures")
        
        # Factor-specific recommendations
        for name, score in factor_scores[:2]:
            if score >= 70:
                if 'Climate' in name:
                    recommendations.append("Review climate adaptation measures and insurance coverage")
                elif 'Physical' in name:
                    recommendations.append("Schedule structural inspection within 48 hours")
                elif 'Financial' in name:
                    recommendations.append("Review credit exposure and hedging positions")
                elif 'Network' in name:
                    recommendations.append("Map critical dependencies and backup options")
                elif 'Operational' in name:
                    recommendations.append("Verify business continuity plans are current")
        
        # Trend-specific recommendations
        if trend == RiskTrend.INCREASING:
            recommendations.append("Accelerate risk mitigation timeline")
        elif trend == RiskTrend.VOLATILE:
            recommendations.append("Implement real-time monitoring alerts")
        
        return recommendations[:5]  # Max 5 recommendations
    
    # =========================================================================
    # RISK FORECASTING
    # =========================================================================
    
    async def forecast_risk(
        self,
        asset_id: str,
        current_score: float,
        historical_scores: List[float],
        forecast_periods: List[int] = [24, 48, 72, 168],  # Hours
    ) -> RiskForecast:
        """
        Forecast future risk scores.
        
        Args:
            asset_id: Asset identifier
            current_score: Current risk score (0-100)
            historical_scores: Past risk scores (oldest first)
            forecast_periods: Hours ahead to forecast
            
        Returns:
            RiskForecast with predictions for each period
        """
        forecasts = []
        
        # Combine historical with current
        all_scores = historical_scores + [current_score]
        
        if len(all_scores) >= 5:
            # Use exponential smoothing
            alpha = 0.3  # Smoothing factor
            
            # Calculate smoothed values
            smoothed = [all_scores[0]]
            for score in all_scores[1:]:
                smoothed.append(alpha * score + (1 - alpha) * smoothed[-1])
            
            # Calculate trend
            recent_trend = (smoothed[-1] - smoothed[-3]) / 2 if len(smoothed) >= 3 else 0
            
            # Forecast with damped trend
            damping = 0.9
            for hours in forecast_periods:
                periods_ahead = hours / 24  # Convert to days
                damped_trend = recent_trend * (1 - damping ** periods_ahead) / (1 - damping)
                forecast_score = smoothed[-1] + damped_trend
                forecast_score = max(0, min(100, forecast_score))
                
                # Confidence decreases with time
                confidence = max(0.3, 0.9 - (hours / 168) * 0.4)
                
                forecasts.append({
                    'hours': hours,
                    'score': round(forecast_score, 1),
                    'confidence': round(confidence, 2),
                    'lower_bound': round(max(0, forecast_score - 10 * (1 - confidence)), 1),
                    'upper_bound': round(min(100, forecast_score + 10 * (1 - confidence)), 1),
                })
        else:
            # Simple forecasting with limited data
            for hours in forecast_periods:
                forecasts.append({
                    'hours': hours,
                    'score': round(current_score, 1),
                    'confidence': 0.5,
                    'lower_bound': round(max(0, current_score - 15), 1),
                    'upper_bound': round(min(100, current_score + 15), 1),
                })
        
        # Determine trend
        if len(all_scores) >= 3:
            recent_change = all_scores[-1] - all_scores[-3]
            if recent_change > 5:
                trend = RiskTrend.INCREASING
            elif recent_change < -5:
                trend = RiskTrend.DECREASING
            elif np.std(all_scores[-5:]) > 10:
                trend = RiskTrend.VOLATILE
            else:
                trend = RiskTrend.STABLE
        else:
            trend = RiskTrend.STABLE
        
        # Find peak risk
        peak_idx = max(range(len(forecasts)), key=lambda i: forecasts[i]['score'])
        
        return RiskForecast(
            asset_id=asset_id,
            current_score=current_score,
            forecasts=forecasts,
            trend=trend,
            peak_risk_hours=forecasts[peak_idx]['hours'],
            peak_risk_score=forecasts[peak_idx]['score'],
        )
    
    # =========================================================================
    # CASCADE PREDICTION
    # =========================================================================
    
    async def predict_cascade(
        self,
        trigger_asset_id: str,
        trigger_event_type: str,
        trigger_severity: float,
        network_graph: Dict[str, List[str]],  # asset_id -> connected_asset_ids
        asset_values: Dict[str, float],  # asset_id -> value
    ) -> CascadePrediction:
        """
        Predict cascade effects from a trigger event.
        
        Args:
            trigger_asset_id: Asset where event originates
            trigger_event_type: Type of triggering event
            trigger_severity: Severity of trigger (0-1)
            network_graph: Dependency network
            asset_values: Asset valuations
            
        Returns:
            CascadePrediction with affected assets and probabilities
        """
        # BFS to find affected assets
        affected = []
        visited = {trigger_asset_id}
        queue = [(trigger_asset_id, 1.0, 0)]  # (asset, probability, depth)
        critical_path = [trigger_asset_id]
        max_depth = 5
        
        # Propagation probability decay per hop
        decay_rate = 0.6
        
        while queue:
            current, prob, depth = queue.pop(0)
            
            if depth >= max_depth:
                continue
            
            neighbors = network_graph.get(current, [])
            
            for neighbor in neighbors:
                if neighbor not in visited:
                    visited.add(neighbor)
                    
                    # Calculate propagation probability
                    new_prob = prob * decay_rate * trigger_severity
                    
                    if new_prob >= 0.1:  # Threshold for consideration
                        affected.append(neighbor)
                        queue.append((neighbor, new_prob, depth + 1))
                        
                        # Track critical path (highest value chain)
                        if asset_values.get(neighbor, 0) > asset_values.get(critical_path[-1], 0):
                            critical_path.append(neighbor)
        
        # Calculate expected total loss
        total_loss = 0
        for asset_id in affected:
            asset_value = asset_values.get(asset_id, 0)
            # Loss based on position in cascade (earlier = more loss)
            loss_ratio = trigger_severity * decay_rate ** affected.index(asset_id)
            total_loss += asset_value * loss_ratio
        
        # Add trigger asset loss
        total_loss += asset_values.get(trigger_asset_id, 0) * trigger_severity
        
        # Overall cascade probability
        cascade_probability = trigger_severity * (1 - (1 - decay_rate) ** len(affected))
        
        # Propagation time estimate (hours)
        propagation_time = len(affected) * 4  # 4 hours per hop average
        
        return CascadePrediction(
            trigger_asset_id=trigger_asset_id,
            trigger_event_type=trigger_event_type,
            affected_assets=affected,
            cascade_probability=min(1.0, cascade_probability),
            expected_total_loss=total_loss,
            propagation_time_hours=propagation_time,
            critical_path=critical_path[:5],
        )
    
    # =========================================================================
    # ANOMALY DETECTION
    # =========================================================================
    
    async def detect_anomalies(
        self,
        asset_id: str,
        current_values: Dict[str, float],
        historical_values: List[Dict[str, float]],
    ) -> AnomalyResult:
        """
        Detect anomalies in asset metrics.
        
        Args:
            asset_id: Asset identifier
            current_values: Current metric values
            historical_values: Historical metric values
            
        Returns:
            AnomalyResult with detection results
        """
        if not historical_values or len(historical_values) < 10:
            return AnomalyResult(
                asset_id=asset_id,
                is_anomaly=False,
                anomaly_score=0.0,
                anomaly_type="insufficient_data",
                deviation_sigma=0.0,
                historical_comparison="Insufficient historical data for comparison",
            )
        
        # Calculate historical statistics for each metric
        anomaly_scores = []
        max_deviation = 0.0
        anomaly_type = "normal"
        
        for key, current_val in current_values.items():
            historical_vals = [h.get(key, 0) for h in historical_values if key in h]
            
            if len(historical_vals) >= 5:
                mean = np.mean(historical_vals)
                std = np.std(historical_vals) or 1  # Avoid division by zero
                
                # Z-score
                z_score = abs(current_val - mean) / std
                anomaly_scores.append(z_score)
                
                if z_score > max_deviation:
                    max_deviation = z_score
                    if z_score > 3:
                        anomaly_type = f"{key}_extreme"
                    elif z_score > 2:
                        anomaly_type = f"{key}_elevated"
        
        # Overall anomaly score (0-1)
        if anomaly_scores:
            avg_z = np.mean(anomaly_scores)
            anomaly_score = min(1.0, avg_z / 4)  # Normalize to 0-1
        else:
            anomaly_score = 0.0
        
        # Determine if anomaly
        is_anomaly = max_deviation > 2.5 or anomaly_score > 0.6
        
        # Generate comparison text
        if is_anomaly:
            comparison = f"Current values deviate {max_deviation:.1f} standard deviations from historical mean"
        else:
            comparison = "Values within normal historical range"
        
        return AnomalyResult(
            asset_id=asset_id,
            is_anomaly=is_anomaly,
            anomaly_score=round(anomaly_score, 3),
            anomaly_type=anomaly_type,
            deviation_sigma=round(max_deviation, 2),
            historical_comparison=comparison,
        )
    
    # =========================================================================
    # BATCH PROCESSING
    # =========================================================================
    
    async def batch_early_warnings(
        self,
        assets: List[Dict[str, Any]],
        forecast_hours: int = 72,
    ) -> List[EarlyWarning]:
        """
        Generate early warnings for multiple assets.
        
        Args:
            assets: List of asset dicts with id and metrics
            forecast_hours: Forecast horizon
            
        Returns:
            List of EarlyWarning sorted by risk level
        """
        warnings = []
        
        for asset in assets:
            asset_id = asset.get('id', 'unknown')
            metrics = {
                'climate_risk': asset.get('climate_risk_score', 50),
                'physical_risk': asset.get('physical_risk_score', 50),
                'financial_risk': asset.get('financial_risk_score', 50),
                'network_risk': asset.get('network_risk_score', 50),
                'operational_risk': asset.get('operational_risk_score', 50),
            }
            
            warning = await self.generate_early_warning(
                asset_id=asset_id,
                current_metrics=metrics,
                forecast_hours=forecast_hours,
            )
            warnings.append(warning)
        
        # Sort by risk score descending
        warnings.sort(key=lambda w: w.predicted_risk_score, reverse=True)
        
        return warnings


# Global service instance
predictive_ml_service = PredictiveMLService()
