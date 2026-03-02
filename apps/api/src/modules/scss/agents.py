"""
SCSS_ADVISOR Agent - Supply chain monitoring and recommendations.

Monitors supply chain bottlenecks, critical suppliers without alternatives,
and high geopolitical risk. Emits alerts compatible with the main SENTINEL system.
"""
import logging
from datetime import datetime
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from src.layers.agents.sentinel import Alert, AlertSeverity, AlertType

from .service import SCSSService

logger = logging.getLogger(__name__)

# Thresholds for SCSS_ADVISOR alerts
BOTTLENECK_CRITICAL_SCORE = 80.0
BOTTLENECK_HIGH_SCORE = 60.0
GEOPOLITICAL_RISK_THRESHOLD = 70.0


class SCSSAdvisorAgent:
    """
    SCSS_ADVISOR - Monitors supply chain 24/7.

    Checks:
    - Critical/high bottlenecks (single points of failure, concentration, geopolitical)
    - Critical suppliers without alternatives (has_alternative=False)
    - High geopolitical risk on critical suppliers
    """

    module = "scss"
    monitoring_frequency = 120  # seconds

    async def run_cycle(self, db: AsyncSession) -> list[Alert]:
        """
        Run one monitoring cycle: analyze bottlenecks and critical suppliers,
        emit alerts for critical/high severity issues.

        Returns:
            List of Alert instances (same type as main SENTINEL).
        """
        alerts: list[Alert] = []
        service = SCSSService(db)

        try:
            result = await service.analyze_bottlenecks(
                supplier_ids=None,
                min_geopolitical_risk=GEOPOLITICAL_RISK_THRESHOLD,
            )
        except Exception as e:
            logger.warning("SCSS_ADVISOR analyze_bottlenecks failed: %s", e)
            return alerts

        bottlenecks = result.get("bottlenecks") or []
        for b in bottlenecks:
            severity_str = (b.get("severity") or "").lower()
            score = float(b.get("bottleneck_score") or 0)
            if severity_str == "critical" or score >= BOTTLENECK_CRITICAL_SCORE:
                severity = AlertSeverity.CRITICAL
            elif severity_str == "high" or score >= BOTTLENECK_HIGH_SCORE:
                severity = AlertSeverity.HIGH
            else:
                continue
            name = b.get("name") or b.get("scss_id") or b.get("supplier_id", "Unknown")
            risk_types = b.get("risk_types") or []
            recommendations = b.get("recommendations") or []
            alerts.append(
                Alert(
                    id=uuid4(),
                    alert_type=AlertType.CASCADE_RISK,  # supply chain cascade
                    severity=severity,
                    title=f"Supply bottleneck: {name}",
                    message=f"Supplier {name} ({b.get('scss_id', '')}) is a bottleneck. "
                    f"Risk types: {', '.join(risk_types) or 'concentration/geopolitical'}. "
                    f"Score: {score:.0f}. Downstream affected: {b.get('affected_downstream_count', 0)}. "
                    f"Review alternatives and diversify.",
                    asset_ids=[b.get("supplier_id")] if b.get("supplier_id") else [],
                    exposure=float(b.get("affected_downstream_count") or 0) * 10000,
                    recommended_actions=recommendations[:5] or [
                        "Find alternative suppliers",
                        "Diversify sourcing geography",
                        "Review contract and inventory buffers",
                    ],
                    created_at=datetime.utcnow(),
                    source="SCSS_ADVISOR",
                )
            )

        # Critical suppliers without alternatives
        try:
            suppliers = await service.list_suppliers(
                is_critical=True,
                limit=200,
                offset=0,
            )
            for s in suppliers:
                if getattr(s, "has_alternative", True):
                    continue
                severity = AlertSeverity.WARNING
                alerts.append(
                    Alert(
                        id=uuid4(),
                        alert_type=AlertType.INFRASTRUCTURE_ISSUE,
                        severity=severity,
                        title=f"Critical supplier has no alternative: {s.name}",
                        message=f"{s.scss_id} is marked critical but has no registered alternative. "
                        f"Use SCSS recommendations to find alternatives.",
                        asset_ids=[s.id],
                        exposure=0,
                        recommended_actions=[
                            "Run alternative supplier recommendations in SCSS module",
                            "Diversify sourcing",
                        ],
                        created_at=datetime.utcnow(),
                        source="SCSS_ADVISOR",
                    )
                )
        except Exception as e:
            logger.warning("SCSS_ADVISOR list_suppliers (no-alternative check) failed: %s", e)

        return alerts


# Singleton for use in alerts endpoint
scss_advisor = SCSSAdvisorAgent()
