"""Capability Emergence Detector - real-time detection of capability jumps in AI systems."""
import json
import logging
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.asgi.models import AISystem, CapabilityEvent

logger = logging.getLogger(__name__)


class CapabilityEmergenceDetector:
    """
    Real-time detection of capability jumps in AI systems.

    Metrics monitored:
    - Benchmark score trajectories
    - Unexpected task success rates
    - Reasoning chain complexity
    - Tool invocation patterns
    """

    THRESHOLDS = {
        "benchmark_jump": 0.15,   # 15% sudden improvement
        "task_expansion": 0.10,   # 10% new task types
        "reasoning_depth": 2.0,   # 2x chain length
        "novel_tool_combo": 3,    # 3+ never-seen combinations
    }

    def __init__(self, db: AsyncSession):
        self.db = db

    async def _collect_metrics(self, system_id: str, window_hours: int) -> dict[str, Any]:
        """Collect metrics for system from capability_events in the time window."""
        cutoff = datetime.utcnow() - timedelta(hours=window_hours)
        result = await self.db.execute(
            select(CapabilityEvent)
            .where(
                CapabilityEvent.ai_system_id == int(system_id),
                CapabilityEvent.created_at >= cutoff,
            )
            .order_by(CapabilityEvent.created_at.desc())
        )
        events = list(result.scalars().all())
        metrics: dict[str, Any] = {
            "benchmark_jump": 0.0,
            "task_expansion": 0.0,
            "reasoning_depth": 0.0,
            "novel_tool_combo": 0,
        }
        for ev in events:
            try:
                m = json.loads(ev.metrics or "{}")
                metrics["benchmark_jump"] = max(metrics["benchmark_jump"], m.get("benchmark_jump", 0))
                metrics["task_expansion"] = max(metrics["task_expansion"], m.get("task_expansion", 0))
                metrics["reasoning_depth"] = max(metrics["reasoning_depth"], m.get("reasoning_depth", 0))
                metrics["novel_tool_combo"] = max(metrics["novel_tool_combo"], m.get("novel_tool_combo", 0))
            except (json.JSONDecodeError, TypeError):
                pass
        return metrics

    def _calculate_severity(self, metric: str, value: float) -> int:
        """Return severity 1-5 based on metric and value."""
        th = self.THRESHOLDS.get(metric, 0)
        if value >= th * 2:
            return 5
        if value >= th * 1.5:
            return 4
        if value >= th:
            return 3
        if value >= th * 0.5:
            return 2
        return 1

    async def detect(self, system_id: str, window_hours: int = 24) -> dict:
        """
        Detect capability emergence for a system.

        Returns:
            {
                "system_id": str,
                "alerts": [{"metric", "value", "threshold", "severity"}],
                "recommendation": "PAUSE" | "MONITOR",
            }
        """
        metrics = await self._collect_metrics(system_id, window_hours)
        alerts = []
        for metric, threshold in self.THRESHOLDS.items():
            val = metrics.get(metric, 0)
            if isinstance(threshold, int):
                exceeded = val >= threshold
            else:
                exceeded = val > threshold
            if exceeded:
                severity = self._calculate_severity(metric, float(val) if isinstance(val, (int, float)) else 0)
                alerts.append({
                    "metric": metric,
                    "value": val,
                    "threshold": threshold,
                    "severity": severity,
                })
        recommendation = "PAUSE" if len(alerts) >= 2 else "MONITOR"
        return {
            "system_id": system_id,
            "alerts": alerts,
            "metrics": metrics,
            "recommendation": recommendation,
        }
