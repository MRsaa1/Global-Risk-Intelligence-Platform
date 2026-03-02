"""
Time-Series Forecasting Service (P5b)
=======================================

Provides risk trend forecasting using statistical and ML methods.
No external dependencies beyond numpy/scipy (already in the project).

Methods:
1. Exponential Smoothing (Holt-Winters) for short-term trends
2. Linear trend decomposition for risk velocity
3. Seasonal decomposition for cyclical patterns
4. Change-point detection for regime shifts

Used by:
- Dashboard: Risk Velocity MoM calculation
- Predictive Analytics: 30/90/365-day forecasts
- Scenario Replay: compare actual vs predicted
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from scipy import stats as sp_stats

logger = logging.getLogger(__name__)


@dataclass
class ForecastPoint:
    """Single forecast point."""
    date: str
    value: float
    lower_bound: float  # confidence interval lower
    upper_bound: float  # confidence interval upper
    confidence: float = 0.95


@dataclass
class TrendAnalysis:
    """Trend analysis of a time series."""
    direction: str  # increasing, decreasing, stable, volatile
    slope: float  # units per day
    slope_pct: float  # % change per period
    r_squared: float  # goodness of fit
    momentum: float  # -1 to 1 (negative = decelerating)
    change_points: List[Dict[str, Any]]  # detected regime shifts

    def to_dict(self) -> Dict[str, Any]:
        return {
            "direction": self.direction,
            "slope": round(self.slope, 6),
            "slope_pct": round(self.slope_pct, 2),
            "r_squared": round(self.r_squared, 4),
            "momentum": round(self.momentum, 4),
            "change_points": self.change_points,
        }


@dataclass
class ForecastResult:
    """Complete forecast result."""
    variable_name: str
    historical_points: int
    forecast_horizon_days: int
    forecast: List[ForecastPoint]
    trend: TrendAnalysis
    risk_velocity_mom: Optional[float]  # month-over-month % change
    risk_velocity_wow: Optional[float]  # week-over-week % change
    method: str
    metadata: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "variable_name": self.variable_name,
            "historical_points": self.historical_points,
            "forecast_horizon_days": self.forecast_horizon_days,
            "forecast": [
                {"date": f.date, "value": round(f.value, 2),
                 "lower": round(f.lower_bound, 2), "upper": round(f.upper_bound, 2)}
                for f in self.forecast
            ],
            "trend": self.trend.to_dict(),
            "risk_velocity_mom": round(self.risk_velocity_mom, 2) if self.risk_velocity_mom is not None else None,
            "risk_velocity_wow": round(self.risk_velocity_wow, 2) if self.risk_velocity_wow is not None else None,
            "method": self.method,
        }


class TimeSeriesForecaster:
    """
    Forecasting engine for risk metrics.

    Works with arbitrary time-series data:
    - (dates, values) pairs from snapshots
    - Portfolio risk scores over time
    - Stress loss trending
    """

    def forecast(
        self,
        dates: List[datetime],
        values: List[float],
        horizon_days: int = 30,
        variable_name: str = "risk_score",
        confidence: float = 0.95,
    ) -> ForecastResult:
        """
        Generate forecast from historical time series.

        Args:
            dates: List of datetime objects (sorted ascending)
            values: Corresponding values
            horizon_days: Number of days to forecast
            variable_name: Name of the variable being forecast
            confidence: Confidence level for intervals
        """
        if len(dates) < 3:
            return self._empty_result(variable_name, horizon_days)

        # Convert to numpy arrays
        y = np.array(values, dtype=np.float64)
        n = len(y)

        # Compute trend
        trend = self._analyze_trend(dates, y)

        # Choose method based on data availability
        if n >= 14:
            forecast_values, lower, upper = self._holt_winters(y, horizon_days, confidence)
            method = "holt_winters_exponential_smoothing"
        elif n >= 5:
            forecast_values, lower, upper = self._linear_forecast(y, horizon_days, confidence)
            method = "linear_trend_extrapolation"
        else:
            forecast_values, lower, upper = self._naive_forecast(y, horizon_days, confidence)
            method = "naive_persistence"

        # Build forecast points
        last_date = dates[-1]
        forecast_points = []
        for i in range(horizon_days):
            fd = last_date + timedelta(days=i + 1)
            forecast_points.append(ForecastPoint(
                date=fd.strftime("%Y-%m-%d"),
                value=float(forecast_values[i]),
                lower_bound=float(lower[i]),
                upper_bound=float(upper[i]),
                confidence=confidence,
            ))

        # Risk velocity
        mom = self._compute_velocity(y, period=30)
        wow = self._compute_velocity(y, period=7)

        return ForecastResult(
            variable_name=variable_name,
            historical_points=n,
            forecast_horizon_days=horizon_days,
            forecast=forecast_points,
            trend=trend,
            risk_velocity_mom=mom,
            risk_velocity_wow=wow,
            method=method,
        )

    def compute_risk_velocity(
        self,
        dates: List[datetime],
        values: List[float],
    ) -> Dict[str, Any]:
        """
        Compute risk velocity metrics (MoM, WoW, trend direction).
        Quick method for Dashboard display.
        """
        if len(values) < 2:
            return {
                "mom_pct": None,
                "wow_pct": None,
                "direction": "unknown",
                "current": values[-1] if values else 0,
                "previous_month": None,
                "previous_week": None,
            }

        y = np.array(values, dtype=np.float64)
        mom = self._compute_velocity(y, 30)
        wow = self._compute_velocity(y, 7)

        if mom is not None:
            if mom > 5:
                direction = "increasing"
            elif mom < -5:
                direction = "decreasing"
            else:
                direction = "stable"
        else:
            direction = "unknown"

        return {
            "mom_pct": round(mom, 2) if mom is not None else None,
            "wow_pct": round(wow, 2) if wow is not None else None,
            "direction": direction,
            "current": float(y[-1]),
            "previous_month": float(y[-30]) if len(y) >= 30 else float(y[0]),
            "previous_week": float(y[-7]) if len(y) >= 7 else float(y[0]),
        }

    def _analyze_trend(self, dates: List[datetime], y: np.ndarray) -> TrendAnalysis:
        """Analyze the trend of a time series."""
        n = len(y)
        x = np.arange(n, dtype=np.float64)

        # Linear regression
        slope, intercept, r_value, p_value, std_err = sp_stats.linregress(x, y)
        r_squared = r_value ** 2

        # Slope as % of mean
        mean_val = np.mean(y)
        slope_pct = (slope / mean_val * 100) if mean_val != 0 else 0

        # Momentum: compare slope of first half vs second half
        if n >= 6:
            mid = n // 2
            slope1, *_ = sp_stats.linregress(x[:mid], y[:mid])
            slope2, *_ = sp_stats.linregress(x[mid:], y[mid:])
            if abs(slope1) > 1e-10:
                momentum = np.clip((slope2 - slope1) / abs(slope1), -1, 1)
            else:
                momentum = np.clip(slope2 * 10, -1, 1)
        else:
            momentum = 0.0

        # Direction
        if abs(slope_pct) < 2:
            direction = "stable"
        elif slope > 0:
            direction = "increasing"
        else:
            direction = "decreasing"

        # Volatility check
        cv = np.std(y) / mean_val if mean_val != 0 else 0
        if cv > 0.3:
            direction = "volatile"

        # Change-point detection (simple: significant jumps)
        change_points = self._detect_change_points(dates, y)

        return TrendAnalysis(
            direction=direction,
            slope=float(slope),
            slope_pct=float(slope_pct),
            r_squared=float(r_squared),
            momentum=float(momentum),
            change_points=change_points,
        )

    def _detect_change_points(self, dates: List[datetime], y: np.ndarray) -> List[Dict[str, Any]]:
        """Detect significant change points in the series."""
        if len(y) < 10:
            return []

        change_points = []
        window = max(3, len(y) // 10)

        for i in range(window, len(y) - window):
            before = y[i - window:i]
            after = y[i:i + window]

            mean_before = np.mean(before)
            mean_after = np.mean(after)
            std_pooled = np.sqrt((np.var(before) + np.var(after)) / 2) + 1e-10

            z_score = abs(mean_after - mean_before) / std_pooled

            if z_score > 2.0:  # Significant shift
                change_points.append({
                    "date": dates[i].strftime("%Y-%m-%d") if i < len(dates) else "",
                    "index": i,
                    "z_score": round(float(z_score), 2),
                    "mean_before": round(float(mean_before), 2),
                    "mean_after": round(float(mean_after), 2),
                    "direction": "increase" if mean_after > mean_before else "decrease",
                })

        # Deduplicate close change points
        if len(change_points) > 1:
            filtered = [change_points[0]]
            for cp in change_points[1:]:
                if cp["index"] - filtered[-1]["index"] > window:
                    filtered.append(cp)
            change_points = filtered

        return change_points[:5]

    def _holt_winters(
        self, y: np.ndarray, horizon: int, confidence: float
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """
        Double exponential smoothing (Holt's method) for trend forecasting.
        """
        n = len(y)
        alpha = 0.3  # level smoothing
        beta = 0.1   # trend smoothing

        # Initialize
        level = y[0]
        trend = np.mean(np.diff(y[:min(5, n)]))

        levels = np.zeros(n)
        trends = np.zeros(n)

        for i in range(n):
            prev_level = level
            level = alpha * y[i] + (1 - alpha) * (level + trend)
            trend = beta * (level - prev_level) + (1 - beta) * trend
            levels[i] = level
            trends[i] = trend

        # Forecast
        forecast = np.array([level + (i + 1) * trend for i in range(horizon)])

        # Residuals for confidence intervals
        fitted = np.array([levels[i] for i in range(n)])
        residuals = y - fitted
        rmse = np.sqrt(np.mean(residuals ** 2))

        z = sp_stats.norm.ppf((1 + confidence) / 2)
        expanding_std = rmse * np.sqrt(np.arange(1, horizon + 1))
        lower = forecast - z * expanding_std
        upper = forecast + z * expanding_std

        return forecast, lower, upper

    def _linear_forecast(
        self, y: np.ndarray, horizon: int, confidence: float
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Simple linear trend extrapolation."""
        n = len(y)
        x = np.arange(n)
        slope, intercept, r_value, p_value, std_err = sp_stats.linregress(x, y)

        x_future = np.arange(n, n + horizon)
        forecast = intercept + slope * x_future

        residuals = y - (intercept + slope * x)
        rmse = np.sqrt(np.mean(residuals ** 2))
        z = sp_stats.norm.ppf((1 + confidence) / 2)
        margin = z * rmse * np.sqrt(1 + 1 / n + (x_future - np.mean(x)) ** 2 / np.sum((x - np.mean(x)) ** 2))

        return forecast, forecast - margin, forecast + margin

    def _naive_forecast(
        self, y: np.ndarray, horizon: int, confidence: float
    ) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
        """Naive forecast: last value persisted."""
        last = y[-1]
        std = np.std(y) if len(y) > 1 else 0
        z = sp_stats.norm.ppf((1 + confidence) / 2)
        forecast = np.full(horizon, last)
        expanding = std * np.sqrt(np.arange(1, horizon + 1))
        return forecast, forecast - z * expanding, forecast + z * expanding

    @staticmethod
    def _compute_velocity(y: np.ndarray, period: int) -> Optional[float]:
        """Compute velocity as % change over the given period."""
        if len(y) < period + 1:
            return None
        current = float(y[-1])
        previous = float(y[-(period + 1)])
        if abs(previous) < 1e-10:
            return None
        return (current - previous) / abs(previous) * 100

    def _empty_result(self, name: str, horizon: int) -> ForecastResult:
        return ForecastResult(
            variable_name=name,
            historical_points=0,
            forecast_horizon_days=horizon,
            forecast=[],
            trend=TrendAnalysis("unknown", 0, 0, 0, 0, []),
            risk_velocity_mom=None,
            risk_velocity_wow=None,
            method="insufficient_data",
        )


# Singleton
forecaster = TimeSeriesForecaster()
