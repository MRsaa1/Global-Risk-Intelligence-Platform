"""
Real-Time Risk Dashboard

Live risk metrics, limit monitoring, and alerting.
"""

from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta
from enum import Enum
import structlog
import pandas as pd
import numpy as np
import asyncio
from collections import deque

logger = structlog.get_logger(__name__)


class RiskMetricType(Enum):
    """Types of risk metrics."""
    VAR = "var"
    CVAR = "cvar"
    STRESS_VAR = "stress_var"
    CAPITAL_RATIO = "capital_ratio"
    LCR = "lcr"
    NSFR = "nsfr"
    LEVERAGE_RATIO = "leverage_ratio"


class LimitStatus(Enum):
    """Limit status."""
    OK = "ok"
    WARNING = "warning"
    BREACH = "breach"


class RiskDashboard:
    """
    Real-Time Risk Dashboard.
    
    Provides live risk metrics, limit monitoring, and alerting.
    """

    def __init__(self, update_interval: int = 5):
        """
        Initialize risk dashboard.

        Args:
            update_interval: Update interval in seconds
        """
        self.update_interval = update_interval
        self.metrics_history: Dict[str, deque] = {}
        self.limits: Dict[str, Dict[str, float]] = {}
        self.portfolios: Dict[str, Dict[str, Any]] = {}
        self.alerts: List[Dict[str, Any]] = []
        self._running = False

    def set_limits(
        self,
        metric_type: RiskMetricType,
        warning_threshold: float,
        breach_threshold: float,
    ) -> None:
        """
        Set risk limits.

        Args:
            metric_type: Type of risk metric
            warning_threshold: Warning threshold
            breach_threshold: Breach threshold
        """
        self.limits[metric_type.value] = {
            "warning": warning_threshold,
            "breach": breach_threshold,
        }
        logger.info("Risk limits set", metric=metric_type.value)

    def register_portfolio(
        self,
        portfolio_id: str,
        portfolio_data: Dict[str, Any],
    ) -> None:
        """
        Register portfolio for monitoring.

        Args:
            portfolio_id: Portfolio identifier
            portfolio_data: Portfolio data
        """
        self.portfolios[portfolio_id] = portfolio_data
        logger.info("Portfolio registered", portfolio_id=portfolio_id)

    async def calculate_live_metrics(
        self,
        portfolio_id: str,
    ) -> Dict[str, float]:
        """
        Calculate live risk metrics.

        Args:
            portfolio_id: Portfolio identifier

        Returns:
            Dictionary of risk metrics
        """
        portfolio = self.portfolios.get(portfolio_id)
        if not portfolio:
            return {}

        # Calculate VaR (simplified)
        positions = portfolio.get("positions", [])
        var = self._calculate_var(positions)

        # Calculate CVaR
        cvar = self._calculate_cvar(positions)

        # Calculate Stress VaR
        stress_var = self._calculate_stress_var(positions)

        # Calculate capital ratio
        capital = portfolio.get("capital", 0)
        rwa = portfolio.get("rwa", 1)
        capital_ratio = capital / rwa if rwa > 0 else 0

        # Calculate LCR
        hqla = portfolio.get("hqla", 0)
        net_outflows = portfolio.get("net_cash_outflows_30d", 1)
        lcr = hqla / net_outflows if net_outflows > 0 else 0

        metrics = {
            "var": var,
            "cvar": cvar,
            "stress_var": stress_var,
            "capital_ratio": capital_ratio,
            "lcr": lcr,
            "timestamp": datetime.now().isoformat(),
        }

        # Store in history
        for metric_name, value in metrics.items():
            if metric_name != "timestamp":
                if metric_name not in self.metrics_history:
                    self.metrics_history[metric_name] = deque(maxlen=1000)
                self.metrics_history[metric_name].append({
                    "value": value,
                    "timestamp": datetime.now(),
                })

        return metrics

    def _calculate_var(self, positions: List[Dict[str, Any]]) -> float:
        """Calculate Value at Risk."""
        # Simplified VaR calculation
        total_exposure = sum(p.get("market_value", 0) for p in positions)
        volatility = 0.15  # Simplified
        var = total_exposure * volatility * 1.96  # 95% VaR
        return var

    def _calculate_cvar(self, positions: List[Dict[str, Any]]) -> float:
        """Calculate Conditional VaR."""
        var = self._calculate_var(positions)
        cvar = var * 1.3  # Simplified
        return cvar

    def _calculate_stress_var(self, positions: List[Dict[str, Any]]) -> float:
        """Calculate Stress VaR."""
        var = self._calculate_var(positions)
        stress_var = var * 2.0  # Simplified stress multiplier
        return stress_var

    def check_limits(
        self,
        metrics: Dict[str, float],
        portfolio_id: str,
    ) -> Dict[str, LimitStatus]:
        """
        Check risk limits.

        Args:
            metrics: Risk metrics
            portfolio_id: Portfolio identifier

        Returns:
            Dictionary of limit statuses
        """
        limit_statuses = {}

        for metric_name, value in metrics.items():
            if metric_name == "timestamp":
                continue

            if metric_name in self.limits:
                limits = self.limits[metric_name]
                warning_threshold = limits["warning"]
                breach_threshold = limits["breach"]

                if value >= breach_threshold:
                    status = LimitStatus.BREACH
                    self._create_alert(
                        portfolio_id=portfolio_id,
                        metric=metric_name,
                        value=value,
                        threshold=breach_threshold,
                        severity="critical",
                    )
                elif value >= warning_threshold:
                    status = LimitStatus.WARNING
                    self._create_alert(
                        portfolio_id=portfolio_id,
                        metric=metric_name,
                        value=value,
                        threshold=warning_threshold,
                        severity="warning",
                    )
                else:
                    status = LimitStatus.OK

                limit_statuses[metric_name] = status

        return limit_statuses

    def _create_alert(
        self,
        portfolio_id: str,
        metric: str,
        value: float,
        threshold: float,
        severity: str,
    ) -> None:
        """Create alert."""
        alert = {
            "alert_id": f"alert_{datetime.now().timestamp()}",
            "portfolio_id": portfolio_id,
            "metric": metric,
            "value": value,
            "threshold": threshold,
            "severity": severity,
            "timestamp": datetime.now().isoformat(),
            "acknowledged": False,
        }
        self.alerts.append(alert)
        logger.warning(
            "Risk limit alert",
            portfolio_id=portfolio_id,
            metric=metric,
            value=value,
            threshold=threshold,
            severity=severity,
        )

    def get_metrics_history(
        self,
        metric_name: str,
        hours: int = 24,
    ) -> pd.DataFrame:
        """
        Get metrics history.

        Args:
            metric_name: Metric name
            hours: Number of hours to retrieve

        Returns:
            DataFrame with historical metrics
        """
        if metric_name not in self.metrics_history:
            return pd.DataFrame()

        cutoff_time = datetime.now() - timedelta(hours=hours)
        history = [
            item
            for item in self.metrics_history[metric_name]
            if item["timestamp"] >= cutoff_time
        ]

        if not history:
            return pd.DataFrame()

        df = pd.DataFrame(history)
        return df

    def get_risk_heatmap(
        self,
    ) -> Dict[str, Dict[str, float]]:
        """
        Generate risk heatmap by portfolio.

        Returns:
            Dictionary of risk metrics by portfolio
        """
        heatmap = {}

        for portfolio_id in self.portfolios.keys():
            metrics = asyncio.run(self.calculate_live_metrics(portfolio_id))
            heatmap[portfolio_id] = metrics

        return heatmap

    async def start_monitoring(self) -> None:
        """Start continuous monitoring."""
        self._running = True
        logger.info("Risk monitoring started")

        while self._running:
            for portfolio_id in self.portfolios.keys():
                metrics = await self.calculate_live_metrics(portfolio_id)
                limit_statuses = self.check_limits(metrics, portfolio_id)

            await asyncio.sleep(self.update_interval)

    def stop_monitoring(self) -> None:
        """Stop monitoring."""
        self._running = False
        logger.info("Risk monitoring stopped")

