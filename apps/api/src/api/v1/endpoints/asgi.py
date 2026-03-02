"""ASGI (AI Safety & Governance Infrastructure) Phase 3 endpoints.

Capability Emergence, Goal Drift, Cryptographic Audit, Multi-Jurisdiction Compliance.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.database import get_db
from src.modules.asgi.service import ASGIService

router = APIRouter()


# ==================== REQUEST MODELS ====================


class AISystemCreate(BaseModel):
    """Request to register AI system."""
    name: str = Field(..., min_length=1, max_length=200)
    version: Optional[str] = None
    system_type: Optional[str] = Field(default="llm", description="llm, agent, multimodal")
    capability_level: Optional[str] = Field(default="narrow", description="narrow, general, frontier")


class EmergenceAcknowledge(BaseModel):
    """Request to acknowledge capability emergence alert."""
    alert_id: int = Field(..., description="Capability event ID")
    responded_by: str = Field(..., min_length=1)


class ComplianceReportRequest(BaseModel):
    """Request to generate compliance report."""
    system_id: int = Field(..., description="AI system ID")


class AISystemUpdate(BaseModel):
    """Request to update AI system."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    version: Optional[str] = None
    system_type: Optional[str] = None
    capability_level: Optional[str] = None


class CapabilityEventCreate(BaseModel):
    """Request to record capability emergence event."""
    ai_system_id: int = Field(..., description="AI system ID")
    event_type: str = Field(..., description="benchmark_jump, novel_capability, reasoning_expansion")
    metrics: dict = Field(default_factory=dict, description="Metric values (benchmark_jump, task_expansion, etc.)")
    severity: Optional[int] = Field(None, ge=1, le=5)


class DriftSnapshotCreate(BaseModel):
    """Request to record goal drift snapshot."""
    ai_system_id: int = Field(..., description="AI system ID")
    plan_embedding: Optional[list] = None
    constraint_set: Optional[dict] = None
    drift_from_baseline: Optional[float] = Field(None, ge=0, le=1)


class AuditLogEvent(BaseModel):
    """Request to log event to cryptographic audit trail."""
    event: dict = Field(..., description="Event payload (will be JSON-serialized)")


# ==================== SYSTEMS ====================


@router.get("/systems", summary="List AI systems")
async def list_systems(db: AsyncSession = Depends(get_db)) -> dict:
    """List registered AI systems."""
    svc = ASGIService(db)
    items = await svc.list_systems()
    return {"items": items, "total": len(items)}


@router.get("/systems/{system_id}", summary="Get AI system")
async def get_system(
    system_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get AI system by ID."""
    svc = ASGIService(db)
    sys = await svc.get_system(system_id)
    if not sys:
        raise HTTPException(status_code=404, detail="AI system not found")
    return sys


@router.post("/systems", summary="Register AI system")
async def register_system(
    body: AISystemCreate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Register a new AI system in the registry."""
    svc = ASGIService(db)
    return await svc.register_system(
        name=body.name,
        version=body.version,
        system_type=body.system_type,
        capability_level=body.capability_level,
    )


@router.put("/systems/{system_id}", summary="Update AI system")
async def update_system(
    system_id: int,
    body: AISystemUpdate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Update AI system."""
    svc = ASGIService(db)
    result = await svc.update_system(
        system_id=system_id,
        name=body.name,
        version=body.version,
        system_type=body.system_type,
        capability_level=body.capability_level,
    )
    if not result:
        raise HTTPException(status_code=404, detail="AI system not found")
    return result


@router.delete("/systems/{system_id}", summary="Delete AI system")
async def delete_system(
    system_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Delete AI system."""
    svc = ASGIService(db)
    ok = await svc.delete_system(system_id)
    if not ok:
        raise HTTPException(status_code=404, detail="AI system not found")
    return {"status": "deleted", "system_id": system_id}


# ==================== CAPABILITY EMERGENCE ====================


@router.get("/emergence/alerts", summary="Current capability emergence alerts")
async def get_emergence_alerts(db: AsyncSession = Depends(get_db)) -> dict:
    """Get current capability emergence alerts across all systems."""
    svc = ASGIService(db)
    alerts = await svc.get_emergence_alerts()
    return {"alerts": alerts, "count": len(alerts)}


@router.get("/emergence/{system_id}", summary="Emergence alerts for system")
async def get_emergence_system(
    system_id: int,
    window_hours: int = Query(24, ge=1, le=168),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get capability emergence detection for a specific system."""
    svc = ASGIService(db)
    result = await svc.capability.detect(str(system_id), window_hours=window_hours)
    return result


@router.post("/emergence/acknowledge", summary="Acknowledge emergence alert")
async def acknowledge_emergence(
    body: EmergenceAcknowledge,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Acknowledge a capability emergence alert."""
    svc = ASGIService(db)
    result = await svc.acknowledge_alert(body.alert_id, body.responded_by)
    if "error" in result:
        raise HTTPException(status_code=404, detail=result["error"])
    return result


@router.post("/emergence/events", summary="Record capability emergence event")
async def create_capability_event(
    body: CapabilityEventCreate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Record a capability emergence event for an AI system."""
    svc = ASGIService(db)
    sys = await svc.get_system(body.ai_system_id)
    if not sys:
        raise HTTPException(status_code=404, detail="AI system not found")
    return await svc.create_capability_event(
        ai_system_id=body.ai_system_id,
        event_type=body.event_type,
        metrics=body.metrics,
        severity=body.severity,
    )


# ==================== GOAL DRIFT ====================


@router.get("/drift/{system_id}", summary="Drift analysis for system")
async def get_drift(
    system_id: int,
    days: int = Query(30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get goal drift analysis for a system."""
    svc = ASGIService(db)
    return await svc.goal_drift.analyze_drift(str(system_id), days=days)


@router.get("/drift/compare", summary="Compare drift across systems")
async def get_drift_compare(
    system_ids: str = Query(..., description="Comma-separated system IDs, e.g. 1,2,3"),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Compare drift across multiple systems."""
    ids = [int(x.strip()) for x in system_ids.split(",") if x.strip()]
    if not ids:
        raise HTTPException(status_code=400, detail="At least one system_id required")
    svc = ASGIService(db)
    results = await svc.get_drift_compare(ids)
    return {"comparisons": results}


@router.post("/drift/snapshots", summary="Record goal drift snapshot")
async def create_drift_snapshot(
    body: DriftSnapshotCreate,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Record a goal drift snapshot for an AI system."""
    svc = ASGIService(db)
    sys = await svc.get_system(body.ai_system_id)
    if not sys:
        raise HTTPException(status_code=404, detail="AI system not found")
    return await svc.create_drift_snapshot(
        ai_system_id=body.ai_system_id,
        plan_embedding=body.plan_embedding,
        constraint_set=body.constraint_set,
        drift_from_baseline=body.drift_from_baseline,
    )


# ==================== COMPLIANCE ====================


@router.get("/compliance/frameworks", summary="List compliance frameworks")
async def get_compliance_frameworks(db: AsyncSession = Depends(get_db)) -> dict:
    """List multi-jurisdiction compliance frameworks."""
    svc = ASGIService(db)
    frameworks = await svc.compliance.get_frameworks()
    return {"frameworks": frameworks}


@router.get("/compliance/{system_id}", summary="Compliance status for system")
async def get_system_compliance(
    system_id: int,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Get compliance status for a system per framework."""
    svc = ASGIService(db)
    return await svc.compliance.get_system_compliance(str(system_id))


@router.post("/compliance/report", summary="Generate compliance report")
async def generate_compliance_report(
    body: ComplianceReportRequest,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Generate compliance report for a system."""
    svc = ASGIService(db)
    return await svc.compliance.generate_report(str(body.system_id))


# ==================== CRYPTO AUDIT ====================


@router.get("/audit/verify/{event_id}", summary="Verify event integrity")
async def verify_audit_event(
    event_id: str,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Verify event hasn't been tampered with."""
    svc = ASGIService(db)
    ok = await svc.crypto_audit.verify_integrity(event_id)
    return {"event_id": event_id, "verified": ok}


@router.get("/audit/anchors", summary="List Merkle anchors")
async def get_audit_anchors(db: AsyncSession = Depends(get_db)) -> dict:
    """List cryptographic audit anchors."""
    svc = ASGIService(db)
    anchors = await svc.list_anchors()
    return {"anchors": anchors}


@router.post("/audit/log", summary="Log event to audit trail")
async def log_audit_event(
    body: AuditLogEvent,
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Log an event to the cryptographic audit trail. Returns event hash."""
    svc = ASGIService(db)
    event_hash = await svc.crypto_audit.log_event(body.event)
    return {"event_hash": event_hash, "status": "logged"}
