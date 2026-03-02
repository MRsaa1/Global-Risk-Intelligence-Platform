"""
ASGI_SENTINEL Agent - Meta-monitoring of AI systems.

Monitors capability emergence, goal drift, and emits alerts when thresholds exceeded.
Phase 3: Capability Emergence, Goal Drift.
"""
import logging
from datetime import datetime
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from src.layers.agents.sentinel import Alert, AlertSeverity, AlertType

from .service import ASGIService

logger = logging.getLogger(__name__)


class ASGISentinelAgent:
    """
    ASGI_SENTINEL - Meta-monitoring agent for AI systems.

    Monitors:
    - Capability emergence (benchmark jumps, novel tool combos)
    - Goal drift (behavioral pattern changes)
    """

    module = "asgi"
    monitoring_frequency = 300  # seconds

    async def run_cycle(self, db: AsyncSession) -> list[Alert]:
        """
        Run one monitoring cycle: check all AI systems for capability emergence
        and goal drift; emit alerts when thresholds exceeded.

        Returns:
            List of Alert instances.
        """
        alerts: list[Alert] = []
        svc = ASGIService(db)

        try:
            systems = await svc.list_systems()
        except Exception as e:
            logger.warning("ASGI_SENTINEL list_systems failed: %s", e)
            return alerts

        for sys in systems:
            sys_id = sys["id"]
            sys_name = sys.get("name", f"AI System {sys_id}")

            # Capability emergence
            try:
                det = await svc.capability.detect(str(sys_id), window_hours=24)
                if det.get("recommendation") == "PAUSE" and det.get("alerts"):
                    alerts.append(
                        Alert(
                            id=uuid4(),
                            alert_type=AlertType.INFRASTRUCTURE_ISSUE,
                            severity=AlertSeverity.HIGH,
                            title=f"Capability emergence: {sys_name}",
                            message=f"Multiple capability emergence alerts. Recommendation: PAUSE. "
                            f"Metrics: {', '.join(a.get('metric', '') for a in det.get('alerts', []))}.",
                            asset_ids=[str(sys_id)],
                            exposure=0,
                            recommended_actions=[
                                "Review capability emergence report",
                                "Consider pausing system for review",
                                "Run goal drift analysis",
                            ],
                            created_at=datetime.utcnow(),
                            source="ASGI_SENTINEL",
                        )
                    )
            except Exception as e:
                logger.warning("ASGI_SENTINEL capability detect failed for %s: %s", sys_id, e)

            # Goal drift
            try:
                drift = await svc.goal_drift.analyze_drift(str(sys_id), days=30)
                if drift.get("trend") == "CONCERNING" and (drift.get("drift_score") or 0) >= 0.3:
                    alerts.append(
                        Alert(
                            id=uuid4(),
                            alert_type=AlertType.INFRASTRUCTURE_ISSUE,
                            severity=AlertSeverity.WARNING,
                            title=f"Goal drift: {sys_name}",
                            message=f"Goal drift trend CONCERNING. Score: {drift.get('drift_score', 0):.2f}. "
                            f"Action: {drift.get('recommended_action', 'MONITOR')}.",
                            asset_ids=[str(sys_id)],
                            exposure=0,
                            recommended_actions=[
                                "Review goal drift report",
                                "Compare with baseline behavior",
                                "Consider increased monitoring",
                            ],
                            created_at=datetime.utcnow(),
                            source="ASGI_SENTINEL",
                        )
                    )
            except Exception as e:
                logger.warning("ASGI_SENTINEL goal drift failed for %s: %s", sys_id, e)

        return alerts


asgi_sentinel = ASGISentinelAgent()
