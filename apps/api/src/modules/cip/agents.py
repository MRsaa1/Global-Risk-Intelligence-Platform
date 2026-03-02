"""
CIP_SENTINEL Agent - 24/7 Critical Infrastructure monitoring.

Specialized SENTINEL for the CIP module: monitors infrastructure status,
degraded/offline assets, and high cascade-risk nodes. Emits alerts compatible
with the main SENTINEL/alerting system.
"""
import logging
from datetime import datetime
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from src.layers.agents.sentinel import Alert, AlertSeverity, AlertType

from .service import CIPService

logger = logging.getLogger(__name__)

# Thresholds for CIP_SENTINEL alerts
CASCADE_RISK_THRESHOLD = 70.0
VULNERABILITY_THRESHOLD = 70.0
DEGRADED_STATUSES = ("degraded", "offline", "maintenance")


class CIPSentinelAgent:
    """
    CIP_SENTINEL - Monitors critical infrastructure 24/7.

    Checks:
    - Operational status (degraded, offline, maintenance)
    - High cascade risk score
    - High vulnerability score
    """

    module = "cip"
    monitoring_frequency = 60  # seconds (informational)

    async def run_cycle(self, db: AsyncSession) -> list[Alert]:
        """
        Run one monitoring cycle: query CIP infrastructure and emit alerts
        for degraded status or high risk scores.

        Returns:
            List of Alert instances (same type as main SENTINEL).
        """
        alerts: list[Alert] = []
        service = CIPService(db)

        try:
            # List all infrastructure (we filter in memory for flexibility)
            infra_list = await service.list_infrastructure(limit=500, offset=0)
        except Exception as e:
            logger.warning("CIP_SENTINEL list_infrastructure failed: %s", e)
            return alerts

        for infra in infra_list:
            # Degraded / offline / maintenance
            if (infra.operational_status or "").lower() in DEGRADED_STATUSES:
                severity = (
                    AlertSeverity.CRITICAL
                    if (infra.operational_status or "").lower() == "offline"
                    else AlertSeverity.HIGH
                    if (infra.operational_status or "").lower() == "degraded"
                    else AlertSeverity.WARNING
                )
                alerts.append(
                    Alert(
                        id=uuid4(),
                        alert_type=AlertType.INFRASTRUCTURE_ISSUE,
                        severity=severity,
                        title=f"Infrastructure: {infra.name} ({infra.cip_id})",
                        message=f"{infra.infrastructure_type or 'Infrastructure'} status: {infra.operational_status}. "
                        f"Criticality: {infra.criticality_level}. "
                        f"Review dependencies and cascade impact.",
                        asset_ids=[infra.id],
                        exposure=float(infra.population_served or 0) * 1000,  # rough exposure proxy
                        recommended_actions=[
                            "Contact infrastructure operator",
                            "Check downstream dependencies",
                            "Activate backup systems if available",
                        ],
                        created_at=datetime.utcnow(),
                        source="CIP_SENTINEL",
                    )
                )
                continue  # one alert per infra for status

            # High cascade risk (>= 70 → alert with recommendation to check dependencies)
            cascade_score = infra.cascade_risk_score or 0
            if cascade_score >= CASCADE_RISK_THRESHOLD:
                alerts.append(
                    Alert(
                        id=uuid4(),
                        alert_type=AlertType.CASCADE_RISK,
                        severity=AlertSeverity.WARNING,
                        title=f"High cascade risk: {infra.name}",
                        message=f"{infra.cip_id} has cascade risk score {cascade_score:.0f}. "
                        f"Failure could impact downstream systems. Review dependencies.",
                        asset_ids=[infra.id],
                        exposure=float(infra.population_served or 0) * 1000,
                        recommended_actions=[
                            "Run cascade risk analysis",
                            "Identify mitigation for downstream dependents",
                            "Review redundancy and recovery plans",
                        ],
                        created_at=datetime.utcnow(),
                        source="CIP_SENTINEL",
                    )
                )

            # High vulnerability (>= 70 → alert for reinforcement and monitoring)
            vuln_score = infra.vulnerability_score or 0
            if vuln_score >= VULNERABILITY_THRESHOLD:
                alerts.append(
                    Alert(
                        id=uuid4(),
                        alert_type=AlertType.INFRASTRUCTURE_ISSUE,
                        severity=AlertSeverity.WARNING,
                        title=f"High vulnerability: {infra.name}",
                        message=f"{infra.cip_id} vulnerability score {vuln_score:.0f}. "
                        f"Consider hardening and monitoring.",
                        asset_ids=[infra.id],
                        exposure=0,
                        recommended_actions=[
                            "Review vulnerability assessment",
                            "Update mitigation and monitoring",
                        ],
                        created_at=datetime.utcnow(),
                        source="CIP_SENTINEL",
                    )
                )

        return alerts

    def get_alert_priority(self, alert: Alert) -> str:
        """Higher priority for critical infrastructure alerts."""
        if alert.alert_type == AlertType.INFRASTRUCTURE_ISSUE and alert.severity == AlertSeverity.CRITICAL:
            return "critical"
        if alert.alert_type == AlertType.CASCADE_RISK:
            return "high"
        return "normal"


# Singleton for use by alerts/oversee
cip_sentinel = CIPSentinelAgent()
