"""
Predictive Analytics API Endpoints.

Provides:
- Early Warning System
- Risk Forecasting
- Cascade Prediction
- Anomaly Detection
"""
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
import structlog

from src.services.predictive_ml import (
    predictive_ml_service,
    AlertLevel,
    RiskTrend,
)

logger = structlog.get_logger()
router = APIRouter()


# ==================== REQUEST MODELS ====================

class EarlyWarningRequest(BaseModel):
    """Request for early warning generation."""
    asset_id: str
    climate_risk: float = Field(50, ge=0, le=100)
    physical_risk: float = Field(50, ge=0, le=100)
    financial_risk: float = Field(50, ge=0, le=100)
    network_risk: float = Field(50, ge=0, le=100)
    operational_risk: float = Field(50, ge=0, le=100)
    forecast_hours: int = Field(72, ge=1, le=720)
    historical_data: Optional[List[Dict[str, float]]] = None


class RiskForecastRequest(BaseModel):
    """Request for risk forecasting."""
    asset_id: str
    current_score: float = Field(..., ge=0, le=100)
    historical_scores: List[float] = Field(default_factory=list)
    forecast_periods: List[int] = Field(default=[24, 48, 72, 168])


class CascadePredictionRequest(BaseModel):
    """Request for cascade prediction."""
    trigger_asset_id: str
    trigger_event_type: str = Field(..., description="e.g., flood, earthquake, financial_shock")
    trigger_severity: float = Field(0.5, ge=0, le=1)
    network_graph: Dict[str, List[str]] = Field(
        default_factory=dict,
        description="Dependency graph: {asset_id: [connected_asset_ids]}"
    )
    asset_values: Dict[str, float] = Field(
        default_factory=dict,
        description="Asset valuations: {asset_id: value}"
    )


class AnomalyDetectionRequest(BaseModel):
    """Request for anomaly detection."""
    asset_id: str
    current_values: Dict[str, float]
    historical_values: List[Dict[str, float]] = Field(default_factory=list)


class BatchEarlyWarningRequest(BaseModel):
    """Request for batch early warnings."""
    assets: List[Dict[str, Any]]
    forecast_hours: int = Field(72, ge=1, le=720)


# ==================== RESPONSE MODELS ====================

class EarlyWarningResponse(BaseModel):
    """Early warning response."""
    asset_id: str
    alert_level: str
    risk_score: float
    predicted_risk_score: float
    forecast_hours: int
    trend: str
    confidence: float
    contributing_factors: List[str]
    recommended_actions: List[str]
    created_at: str


class RiskForecastResponse(BaseModel):
    """Risk forecast response."""
    asset_id: str
    current_score: float
    forecasts: List[Dict[str, Any]]
    trend: str
    peak_risk_hours: int
    peak_risk_score: float


class CascadePredictionResponse(BaseModel):
    """Cascade prediction response."""
    trigger_asset_id: str
    trigger_event_type: str
    affected_assets: List[str]
    affected_count: int
    cascade_probability: float
    expected_total_loss: float
    propagation_time_hours: float
    critical_path: List[str]


class AnomalyDetectionResponse(BaseModel):
    """Anomaly detection response."""
    asset_id: str
    is_anomaly: bool
    anomaly_score: float
    anomaly_type: str
    deviation_sigma: float
    historical_comparison: str


class BatchEarlyWarningResponse(BaseModel):
    """Batch early warning response."""
    total_assets: int
    critical_count: int
    warning_count: int
    watch_count: int
    normal_count: int
    warnings: List[EarlyWarningResponse]


# ==================== ENDPOINTS ====================

@router.post("/early-warning", response_model=EarlyWarningResponse)
async def generate_early_warning(request: EarlyWarningRequest):
    """
    Generate early warning for an asset.
    
    Analyzes current risk metrics and predicts future risk levels.
    Returns alert level, trend, and recommended actions.
    """
    metrics = {
        'climate_risk': request.climate_risk,
        'physical_risk': request.physical_risk,
        'financial_risk': request.financial_risk,
        'network_risk': request.network_risk,
        'operational_risk': request.operational_risk,
    }
    
    warning = await predictive_ml_service.generate_early_warning(
        asset_id=request.asset_id,
        current_metrics=metrics,
        historical_data=request.historical_data,
        forecast_hours=request.forecast_hours,
    )
    
    logger.info(
        "Early warning generated",
        asset_id=request.asset_id,
        alert_level=warning.alert_level.value,
        risk_score=warning.risk_score,
    )
    
    return EarlyWarningResponse(
        asset_id=warning.asset_id,
        alert_level=warning.alert_level.value,
        risk_score=round(warning.risk_score, 1),
        predicted_risk_score=round(warning.predicted_risk_score, 1),
        forecast_hours=warning.forecast_hours,
        trend=warning.trend.value,
        confidence=round(warning.confidence, 2),
        contributing_factors=warning.contributing_factors,
        recommended_actions=warning.recommended_actions,
        created_at=warning.created_at.isoformat(),
    )


@router.post("/forecast", response_model=RiskForecastResponse)
async def forecast_risk(request: RiskForecastRequest):
    """
    Forecast future risk scores.
    
    Uses time-series analysis to predict risk levels at specified intervals.
    """
    forecast = await predictive_ml_service.forecast_risk(
        asset_id=request.asset_id,
        current_score=request.current_score,
        historical_scores=request.historical_scores,
        forecast_periods=request.forecast_periods,
    )
    
    return RiskForecastResponse(
        asset_id=forecast.asset_id,
        current_score=forecast.current_score,
        forecasts=forecast.forecasts,
        trend=forecast.trend.value,
        peak_risk_hours=forecast.peak_risk_hours,
        peak_risk_score=forecast.peak_risk_score,
    )


@router.post("/cascade", response_model=CascadePredictionResponse)
async def predict_cascade(request: CascadePredictionRequest):
    """
    Predict cascade effects from a trigger event.
    
    Models how a risk event propagates through the dependency network.
    """
    # Use default network if not provided
    network = request.network_graph
    values = request.asset_values
    
    if not network:
        # Generate sample network for demo
        network = {
            request.trigger_asset_id: [f"asset_{i}" for i in range(1, 6)],
            "asset_1": ["asset_6", "asset_7"],
            "asset_2": ["asset_8", "asset_9"],
            "asset_3": ["asset_10"],
        }
        values = {
            request.trigger_asset_id: 100_000_000,
            **{f"asset_{i}": 50_000_000 - i * 5_000_000 for i in range(1, 11)}
        }
    
    prediction = await predictive_ml_service.predict_cascade(
        trigger_asset_id=request.trigger_asset_id,
        trigger_event_type=request.trigger_event_type,
        trigger_severity=request.trigger_severity,
        network_graph=network,
        asset_values=values,
    )
    
    logger.info(
        "Cascade prediction completed",
        trigger=request.trigger_asset_id,
        affected_count=len(prediction.affected_assets),
        expected_loss=prediction.expected_total_loss,
    )
    
    return CascadePredictionResponse(
        trigger_asset_id=prediction.trigger_asset_id,
        trigger_event_type=prediction.trigger_event_type,
        affected_assets=prediction.affected_assets,
        affected_count=len(prediction.affected_assets),
        cascade_probability=round(prediction.cascade_probability, 3),
        expected_total_loss=round(prediction.expected_total_loss, 2),
        propagation_time_hours=prediction.propagation_time_hours,
        critical_path=prediction.critical_path,
    )


@router.post("/anomaly", response_model=AnomalyDetectionResponse)
async def detect_anomaly(request: AnomalyDetectionRequest):
    """
    Detect anomalies in asset metrics.
    
    Compares current values against historical patterns to identify outliers.
    """
    # Generate sample historical data if not provided
    historical = request.historical_values
    if not historical:
        import random
        historical = [
            {k: v * (0.8 + random.random() * 0.4) for k, v in request.current_values.items()}
            for _ in range(20)
        ]
    
    result = await predictive_ml_service.detect_anomalies(
        asset_id=request.asset_id,
        current_values=request.current_values,
        historical_values=historical,
    )
    
    return AnomalyDetectionResponse(
        asset_id=result.asset_id,
        is_anomaly=result.is_anomaly,
        anomaly_score=result.anomaly_score,
        anomaly_type=result.anomaly_type,
        deviation_sigma=result.deviation_sigma,
        historical_comparison=result.historical_comparison,
    )


@router.post("/batch-warnings", response_model=BatchEarlyWarningResponse)
async def batch_early_warnings(request: BatchEarlyWarningRequest):
    """
    Generate early warnings for multiple assets.
    
    Returns warnings sorted by risk level (highest first).
    """
    warnings = await predictive_ml_service.batch_early_warnings(
        assets=request.assets,
        forecast_hours=request.forecast_hours,
    )
    
    # Count by alert level
    critical = sum(1 for w in warnings if w.alert_level == AlertLevel.CRITICAL)
    warning_count = sum(1 for w in warnings if w.alert_level == AlertLevel.WARNING)
    watch = sum(1 for w in warnings if w.alert_level == AlertLevel.WATCH)
    normal = sum(1 for w in warnings if w.alert_level == AlertLevel.NORMAL)
    
    return BatchEarlyWarningResponse(
        total_assets=len(warnings),
        critical_count=critical,
        warning_count=warning_count,
        watch_count=watch,
        normal_count=normal,
        warnings=[
            EarlyWarningResponse(
                asset_id=w.asset_id,
                alert_level=w.alert_level.value,
                risk_score=round(w.risk_score, 1),
                predicted_risk_score=round(w.predicted_risk_score, 1),
                forecast_hours=w.forecast_hours,
                trend=w.trend.value,
                confidence=round(w.confidence, 2),
                contributing_factors=w.contributing_factors,
                recommended_actions=w.recommended_actions,
                created_at=w.created_at.isoformat(),
            )
            for w in warnings
        ],
    )


@router.get("/risk-levels")
async def get_risk_levels():
    """Get available risk levels and thresholds."""
    return {
        "alert_levels": [
            {"level": "normal", "threshold": "< 45", "color": "#22c55e"},
            {"level": "watch", "threshold": "45-60", "color": "#eab308"},
            {"level": "warning", "threshold": "60-75", "color": "#f97316"},
            {"level": "critical", "threshold": "> 75", "color": "#ef4444"},
        ],
        "trends": [
            {"trend": "increasing", "description": "Risk is rising"},
            {"trend": "stable", "description": "Risk is stable"},
            {"trend": "decreasing", "description": "Risk is falling"},
            {"trend": "volatile", "description": "Risk is fluctuating"},
        ],
        "risk_factors": [
            "climate_risk",
            "physical_risk",
            "financial_risk",
            "network_risk",
            "operational_risk",
        ],
    }
