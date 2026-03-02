"""Multi-jurisdiction compliance service - EU AI Act, US EO 14110, UK AI Safety."""
import logging
from typing import Optional

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.asgi.models import AISystem, AuditAnchor, CapabilityEvent, ComplianceFramework, GoalDriftSnapshot

logger = logging.getLogger(__name__)


def _assess_eu_ai_act(
    capability_level: Optional[str],
    capability_events_count: int,
    goal_drift_count: int,
) -> str:
    """EU AI Act: risk tier and transparency; assessed if we track capability/drift."""
    if not capability_level:
        return "NOT_ASSESSED"
    if capability_level == "frontier":
        return "PARTIAL"  # High-risk tier, needs formal assessment
    if capability_level in ("narrow", "limited", "general") and (capability_events_count > 0 or goal_drift_count > 0):
        return "COMPLIANT"  # Limited/minimal with tracking
    return "NOT_ASSESSED"


def _assess_us_eo_14110(capability_events_count: int, has_audit_anchors: bool) -> str:
    """US EO 14110: safety reporting / compute disclosure proxy."""
    if capability_events_count > 0 or has_audit_anchors:
        return "COMPLIANT"
    return "NOT_ASSESSED"


def _assess_uk_ai_safety(capability_events_count: int) -> str:
    """UK AI Safety: evaluation / red-team proxy via capability events."""
    if capability_events_count > 0:
        return "COMPLIANT"
    return "NOT_ASSESSED"


class ComplianceService:
    """Compliance frameworks and system compliance status."""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_frameworks(self) -> list[dict]:
        """List all compliance frameworks."""
        result = await self.db.execute(select(ComplianceFramework).order_by(ComplianceFramework.framework_code))
        rows = result.scalars().all()
        return [
            {
                "id": r.id,
                "framework_code": r.framework_code,
                "name": r.name,
                "jurisdiction": r.jurisdiction,
                "effective_date": str(r.effective_date) if r.effective_date else None,
            }
            for r in rows
        ]

    async def get_system_compliance(self, system_id: str) -> dict:
        """Get compliance status for a system per framework from registry and audit data."""
        sid = int(system_id)
        sys_result = await self.db.execute(select(AISystem).where(AISystem.id == sid))
        ai_system = sys_result.scalar_one_or_none()
        if not ai_system:
            return {"system_id": system_id, "frameworks": {}}

        cap_count = await self.db.scalar(
            select(func.count()).select_from(CapabilityEvent).where(CapabilityEvent.ai_system_id == sid)
        ) or 0
        drift_count = await self.db.scalar(
            select(func.count()).select_from(GoalDriftSnapshot).where(GoalDriftSnapshot.ai_system_id == sid)
        ) or 0
        anchor_count = await self.db.scalar(select(func.count()).select_from(AuditAnchor)) or 0
        has_audit_anchors = anchor_count > 0

        result = await self.db.execute(select(ComplianceFramework).order_by(ComplianceFramework.framework_code))
        frameworks = result.scalars().all()
        statuses = {}
        for fw in frameworks:
            if fw.framework_code == "EU_AI_ACT":
                status = _assess_eu_ai_act(ai_system.capability_level, cap_count, drift_count)
            elif fw.framework_code == "US_EO_14110":
                status = _assess_us_eo_14110(cap_count, has_audit_anchors)
            elif fw.framework_code == "UK_AI_SAFETY":
                status = _assess_uk_ai_safety(cap_count)
            else:
                status = "NOT_ASSESSED"
            statuses[fw.framework_code] = {
                "status": status,
                "framework_name": fw.name,
                "jurisdiction": fw.jurisdiction,
            }
        return {
            "system_id": system_id,
            "frameworks": statuses,
        }

    async def generate_report(self, system_id: str) -> dict:
        """Generate compliance report for a system."""
        compliance = await self.get_system_compliance(system_id)
        sys_result = await self.db.execute(select(AISystem).where(AISystem.id == int(system_id)))
        ai_system = sys_result.scalar_one_or_none()
        frameworks = compliance["frameworks"]
        assessed = sum(1 for f in frameworks.values() if f["status"] != "NOT_ASSESSED")
        compliant = sum(1 for f in frameworks.values() if f["status"] == "COMPLIANT")
        not_assessed = len(frameworks) - assessed
        return {
            "system_id": system_id,
            "system_name": ai_system.name if ai_system else None,
            "generated_at": None,
            "compliance_status": frameworks,
            "summary": {
                "assessed": assessed,
                "compliant": compliant,
                "not_assessed": not_assessed,
            },
        }


COMPLIANCE_FRAMEWORKS_SEED = [
    {
        "framework_code": "EU_AI_ACT",
        "name": "EU Artificial Intelligence Act",
        "jurisdiction": "European Union",
        "requirements": {"risk_tier": "unacceptable/high/limited/minimal", "transparency": True},
        "mapping_to_asgi": {"registry": "asgi_ai_systems", "audit": "asgi_audit_events"},
    },
    {
        "framework_code": "US_EO_14110",
        "name": "US Executive Order 14110 on Safe AI",
        "jurisdiction": "United States",
        "requirements": {"safety_reporting": True, "compute_disclosure": True},
        "mapping_to_asgi": {"registry": "asgi_ai_systems"},
    },
    {
        "framework_code": "UK_AI_SAFETY",
        "name": "UK AI Safety Institute Framework",
        "jurisdiction": "United Kingdom",
        "requirements": {"evaluation": True, "red_team": True},
        "mapping_to_asgi": {"registry": "asgi_ai_systems", "capability": "asgi_capability_events"},
    },
]
