"""ASGI Service - orchestration for Capability Emergence, Goal Drift, Crypto Audit, Compliance."""
import logging
from datetime import datetime, timedelta
from typing import Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.asgi.capability_emergence import CapabilityEmergenceDetector
from src.modules.asgi.compliance import ComplianceService
from src.modules.asgi.crypto_audit import CryptoAuditTrail
from src.modules.asgi.goal_drift import GoalDriftAnalyzer
from src.modules.asgi.models import AISystem, AuditAnchor, CapabilityEvent, GoalDriftSnapshot

logger = logging.getLogger(__name__)


class ASGIService:
    """Orchestrates ASGI Phase 3 components."""

    def __init__(self, db: AsyncSession):
        self.db = db
        self.capability = CapabilityEmergenceDetector(db)
        self.goal_drift = GoalDriftAnalyzer(db)
        self.crypto_audit = CryptoAuditTrail(db)
        self.compliance = ComplianceService(db)

    # --- AI Systems ---
    async def list_systems(self) -> list[dict]:
        """List registered AI systems."""
        result = await self.db.execute(select(AISystem).order_by(AISystem.id))
        rows = result.scalars().all()
        return [
            {
                "id": r.id,
                "name": r.name,
                "version": r.version,
                "system_type": r.system_type,
                "capability_level": r.capability_level,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]

    async def get_system(self, system_id: int) -> Optional[dict]:
        """Get AI system by ID."""
        result = await self.db.execute(select(AISystem).where(AISystem.id == system_id))
        sys = result.scalar_one_or_none()
        if not sys:
            return None
        return {
            "id": sys.id,
            "name": sys.name,
            "version": sys.version,
            "system_type": sys.system_type,
            "capability_level": sys.capability_level,
            "created_at": sys.created_at.isoformat() if sys.created_at else None,
        }

    async def update_system(
        self,
        system_id: int,
        name: Optional[str] = None,
        version: Optional[str] = None,
        system_type: Optional[str] = None,
        capability_level: Optional[str] = None,
    ) -> Optional[dict]:
        """Update AI system."""
        result = await self.db.execute(select(AISystem).where(AISystem.id == system_id))
        sys = result.scalar_one_or_none()
        if not sys:
            return None
        if name is not None:
            sys.name = name
        if version is not None:
            sys.version = version
        if system_type is not None:
            sys.system_type = system_type
        if capability_level is not None:
            sys.capability_level = capability_level
        sys.updated_at = datetime.utcnow()
        await self.db.commit()
        await self.db.refresh(sys)
        return {"id": sys.id, "name": sys.name, "version": sys.version, "system_type": sys.system_type, "capability_level": sys.capability_level}

    async def delete_system(self, system_id: int) -> bool:
        """Delete AI system. Returns False if not found."""
        result = await self.db.execute(select(AISystem).where(AISystem.id == system_id))
        sys = result.scalar_one_or_none()
        if not sys:
            return False
        await self.db.delete(sys)
        await self.db.commit()
        return True

    async def register_system(
        self,
        name: str,
        version: Optional[str] = None,
        system_type: Optional[str] = None,
        capability_level: Optional[str] = None,
    ) -> dict:
        """Register a new AI system."""
        sys = AISystem(
            name=name,
            version=version,
            system_type=system_type or "llm",
            capability_level=capability_level or "narrow",
            created_at=datetime.utcnow(),
        )
        self.db.add(sys)
        await self.db.commit()
        await self.db.refresh(sys)
        return {
            "id": sys.id,
            "name": sys.name,
            "version": sys.version,
            "system_type": sys.system_type,
            "capability_level": sys.capability_level,
        }

    # --- Capability Emergence ---
    async def get_emergence_alerts(self) -> list[dict]:
        """Get current capability emergence alerts across all systems.

        Returns alerts from detector plus unacknowledged CapabilityEvents with ids for acknowledge.
        """
        result = await self.db.execute(select(AISystem))
        systems = result.scalars().all()
        all_alerts = []
        for s in systems:
            det = await self.capability.detect(str(s.id), window_hours=24)
            for a in det.get("alerts", []):
                all_alerts.append({
                    "system_id": s.id,
                    "system_name": s.name,
                    "metric": a["metric"],
                    "value": a["value"],
                    "threshold": a["threshold"],
                    "severity": a["severity"],
                })
        # Also include unacknowledged CapabilityEvents (with alert_id for acknowledge)
        cutoff = datetime.utcnow() - timedelta(hours=24)
        ev_result = await self.db.execute(
            select(CapabilityEvent, AISystem)
            .join(AISystem, CapabilityEvent.ai_system_id == AISystem.id)
            .where(
                CapabilityEvent.created_at >= cutoff,
                CapabilityEvent.response_at.is_(None),
            )
        )
        for ev, ai_sys in ev_result.all():
            all_alerts.append({
                "alert_id": ev.id,
                "system_id": ev.ai_system_id,
                "system_name": ai_sys.name,
                "event_type": ev.event_type,
                "severity": ev.severity,
                "created_at": ev.created_at.isoformat() if ev.created_at else None,
            })
        return all_alerts

    async def acknowledge_alert(self, alert_id: int, responded_by: str) -> dict:
        """Acknowledge a capability event (mark response)."""
        result = await self.db.execute(select(CapabilityEvent).where(CapabilityEvent.id == alert_id))
        ev = result.scalar_one_or_none()
        if not ev:
            return {"error": "Alert not found"}
        ev.response_action = "ACKNOWLEDGED"
        ev.responded_by = responded_by
        ev.response_at = datetime.utcnow()
        await self.db.commit()
        return {"status": "acknowledged", "alert_id": alert_id}

    async def create_capability_event(
        self,
        ai_system_id: int,
        event_type: str,
        metrics: dict,
        severity: Optional[int] = None,
    ) -> dict:
        """Record a capability emergence event."""
        import json
        ev = CapabilityEvent(
            ai_system_id=ai_system_id,
            event_type=event_type,
            metrics=json.dumps(metrics),
            severity=severity,
            created_at=datetime.utcnow(),
        )
        self.db.add(ev)
        await self.db.commit()
        await self.db.refresh(ev)
        return {"id": ev.id, "ai_system_id": ev.ai_system_id, "event_type": ev.event_type, "severity": ev.severity}

    # --- Goal Drift ---
    async def get_drift_compare(self, system_ids: list[int]) -> list[dict]:
        """Compare drift across multiple systems."""
        out = []
        for sid in system_ids:
            dr = await self.goal_drift.analyze_drift(str(sid), days=30)
            out.append(dr)
        return out

    async def create_drift_snapshot(
        self,
        ai_system_id: int,
        plan_embedding: Optional[list] = None,
        constraint_set: Optional[dict] = None,
        drift_from_baseline: Optional[float] = None,
    ) -> dict:
        """Record a goal drift snapshot."""
        import json
        from datetime import date
        snap = GoalDriftSnapshot(
            ai_system_id=ai_system_id,
            snapshot_date=date.today(),
            plan_embedding=json.dumps(plan_embedding or []) if plan_embedding is not None else None,
            constraint_set=json.dumps(constraint_set or {}) if constraint_set is not None else None,
            drift_from_baseline=drift_from_baseline,
            created_at=datetime.utcnow(),
        )
        self.db.add(snap)
        await self.db.commit()
        await self.db.refresh(snap)
        return {"id": snap.id, "ai_system_id": snap.ai_system_id, "drift_from_baseline": snap.drift_from_baseline}

    # --- Crypto Audit ---
    async def list_anchors(self) -> list[dict]:
        """List Merkle anchors."""
        result = await self.db.execute(select(AuditAnchor).order_by(AuditAnchor.id.desc()).limit(50))
        rows = result.scalars().all()
        return [
            {
                "id": r.id,
                "event_count": r.event_count,
                "anchor_type": r.anchor_type,
                "anchor_reference": r.anchor_reference,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r in rows
        ]
