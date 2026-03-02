"""
Real-time Alerts API
=====================

WebSocket and REST endpoints for alert management.
Integrates with SENTINEL agent for 24/7 monitoring.
"""
import asyncio
from datetime import datetime, timedelta
from typing import Optional, List
from uuid import UUID, uuid4
from enum import Enum

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from src.core.security import get_current_user
from src.layers.agents.sentinel import sentinel_agent, Alert, AlertSeverity, AlertType
from src.core.config import settings
from src.core.database import AsyncSessionLocal, get_db
from src.models.user import User
from src.services.event_emitter import event_emitter

logger = structlog.get_logger()
router = APIRouter()


# ==================== MODELS ====================

class AlertResponse(BaseModel):
    """Alert response model."""
    id: str
    alert_type: str
    severity: str
    title: str
    message: str
    asset_ids: List[str]
    exposure: float
    recommended_actions: List[str]
    created_at: str
    acknowledged: bool
    resolved: bool
    source: Optional[str] = None  # e.g. SENTINEL, CIP_SENTINEL, SCSS_ADVISOR, SRO_SENTINEL
    explanation: Optional[dict] = None  # what, confidence, why_now, sources


class AlertSummary(BaseModel):
    """Summary of active alerts."""
    total: int
    critical: int
    high: int
    warning: int
    info: int
    total_exposure: float
    newest_alert: Optional[AlertResponse] = None


class AcknowledgeRequest(BaseModel):
    """Request to acknowledge an alert."""
    alert_id: str


class ResolveRequest(BaseModel):
    """Request to resolve an alert."""
    alert_id: str
    resolution_notes: Optional[str] = None


class CreateAlertRequest(BaseModel):
    """Request to create a manual alert."""
    alert_type: str = Field(default="manual")
    severity: str = Field(default="warning")
    title: str
    message: str
    asset_ids: List[str] = Field(default_factory=list)
    exposure: float = Field(default=0)
    recommended_actions: List[str] = Field(default_factory=list)


# ==================== CONNECTION MANAGER ====================

class AlertConnectionManager:
    """Manage WebSocket connections for alerts."""
    
    def __init__(self):
        self.active_connections: set[WebSocket] = set()
        self.connection_info: dict[WebSocket, dict] = {}
    
    async def connect(self, websocket: WebSocket, filters: dict = None, user_id: Optional[str] = None):
        """Accept a new connection. user_id from JWT token when provided (ACL-ready). Auto-start SENTINEL on first client."""
        await websocket.accept()
        was_empty = len(self.active_connections) == 0
        self.active_connections.add(websocket)
        self.connection_info[websocket] = {
            "connected_at": datetime.utcnow(),
            "filters": filters or {},
            "user_id": user_id,
        }
        if was_empty:
            try:
                await start_monitoring()
                logger.info("SENTINEL monitoring auto-started (first alerts WebSocket client)")
            except Exception as e:
                logger.warning("Auto-start monitoring failed: %s", e)
        logger.info(
            "Alert WebSocket connected",
            total=len(self.active_connections),
            user_id=user_id is not None,
        )
    
    def disconnect(self, websocket: WebSocket):
        """Remove a connection."""
        self.active_connections.discard(websocket)
        self.connection_info.pop(websocket, None)
        logger.info(
            "Alert WebSocket disconnected",
            total=len(self.active_connections)
        )
    
    async def broadcast_alert(self, alert: Alert):
        """Broadcast alert to all connected clients. On CRITICAL, optionally run one Overseer cycle and include remediation in payload."""
        if not self.active_connections:
            return

        proactive_actions: List[str] = []
        if getattr(AlertSeverity, "CRITICAL", None) and alert.severity == AlertSeverity.CRITICAL:
            proactive_actions = await _maybe_run_proactive_remediation()

        alert_data = _alert_to_response(alert)
        message = {
            "type": "alert",
            "timestamp": datetime.utcnow().isoformat(),
            "data": alert_data.model_dump(),
        }
        if proactive_actions:
            message["proactive_remediation"] = {
                "ran": True,
                "actions": proactive_actions,
            }

        disconnected = []
        for websocket in self.active_connections:
            try:
                # Check filters
                filters = self.connection_info.get(websocket, {}).get("filters", {})
                if filters:
                    min_severity = filters.get("min_severity")
                    if min_severity:
                        severity_order = ["info", "warning", "high", "critical"]
                        if severity_order.index(alert.severity.value) < severity_order.index(min_severity):
                            continue
                
                await websocket.send_json(message)
            except Exception:
                disconnected.append(websocket)
        
        for ws in disconnected:
            self.disconnect(ws)
    
    async def send_heartbeat(self):
        """Send heartbeat to all connections."""
        message = {
            "type": "heartbeat",
            "timestamp": datetime.utcnow().isoformat()
        }
        
        disconnected = []
        for websocket in self.active_connections:
            try:
                await websocket.send_json(message)
            except Exception:
                disconnected.append(websocket)
        
        for ws in disconnected:
            self.disconnect(ws)


alert_manager = AlertConnectionManager()

# Proactive remediation on critical alert: run at most once per cooldown
PROACTIVE_REMEDIATION_COOLDOWN_SEC = 180  # 2–3 minutes
_last_proactive_remediation_run: Optional[datetime] = None


async def _maybe_run_proactive_remediation() -> List[str]:
    """If cooldown elapsed, run one Overseer cycle and return auto_resolution_actions."""
    global _last_proactive_remediation_run
    now = datetime.utcnow()
    if _last_proactive_remediation_run is not None:
        if (now - _last_proactive_remediation_run).total_seconds() < PROACTIVE_REMEDIATION_COOLDOWN_SEC:
            return []
    try:
        from src.services.oversee import get_oversee_service
        svc = get_oversee_service()
        await svc.run_cycle(use_llm=False, include_events=False)
        _last_proactive_remediation_run = now
        status = svc.get_status()
        return status.get("auto_resolution_actions") or []
    except Exception as e:
        logger.warning("Proactive remediation on critical alert failed", error=str(e))
        return []


# ==================== BACKGROUND MONITORING ====================

_monitoring_task: Optional[asyncio.Task] = None
_is_monitoring = False


async def start_monitoring():
    """Start the background monitoring loop."""
    global _is_monitoring, _monitoring_task
    
    if _is_monitoring:
        return
    
    _is_monitoring = True
    _monitoring_task = asyncio.create_task(_monitoring_loop())
    logger.info("SENTINEL monitoring started")


async def stop_monitoring():
    """Stop the background monitoring loop."""
    global _is_monitoring, _monitoring_task
    
    _is_monitoring = False
    if _monitoring_task:
        _monitoring_task.cancel()
        try:
            await _monitoring_task
        except asyncio.CancelledError:
            pass
    logger.info("SENTINEL monitoring stopped")


async def _monitoring_loop():
    """Main monitoring loop."""
    check_interval = settings.sentinel_check_interval_seconds
    
    while _is_monitoring:
        try:
            # Build context from external sources
            context = await _build_monitoring_context()
            
            # Run SENTINEL monitoring
            alerts = await sentinel_agent.monitor(context)
            
            # Run CIP_SENTINEL (critical infrastructure module)
            try:
                async with AsyncSessionLocal() as db:
                    cip_alerts = await _run_cip_sentinel(db)
                    alerts.extend(cip_alerts)
            except Exception as e:
                logger.warning("CIP_SENTINEL cycle failed: %s", e)

            # Run SCSS_ADVISOR (supply chain sovereignty module)
            try:
                async with AsyncSessionLocal() as db:
                    scss_alerts = await _run_scss_advisor(db)
                    alerts.extend(scss_alerts)
            except Exception as e:
                logger.warning("SCSS_ADVISOR cycle failed: %s", e)

            # Run SRO_SENTINEL (systemic risk observatory module)
            try:
                async with AsyncSessionLocal() as db:
                    sro_alerts = await _run_sro_sentinel(db)
                    alerts.extend(sro_alerts)
            except Exception as e:
                logger.warning("SRO_SENTINEL cycle failed: %s", e)

            # Run ASGI_SENTINEL (AI Safety & Governance module)
            try:
                async with AsyncSessionLocal() as db:
                    asgi_alerts = await _run_asgi_sentinel(db)
                    alerts.extend(asgi_alerts)
                    # Configurable Early Warning triggers (alert_triggers table)
                    trigger_alerts = await _evaluate_custom_triggers(db, context)
                    alerts.extend(trigger_alerts)
            except Exception as e:
                logger.warning("ASGI_SENTINEL cycle failed: %s", e)
            
            # Register all alerts (dedup by source+type+title: update existing or add new)
            to_register = []
            for alert in alerts:
                dk = alert.dedup_key()
                existing = sentinel_agent.get_alert_by_dedup_key(dk)
                if existing and not existing.resolved:
                    if alert.explanation and isinstance(alert.explanation, dict) and "confidence" in alert.explanation:
                        if existing.explanation is None:
                            existing.explanation = {}
                        else:
                            existing.explanation = dict(existing.explanation)
                        existing.explanation["confidence"] = max(
                            (existing.explanation.get("confidence") or 0),
                            (alert.explanation.get("confidence") or 0),
                        )
                    continue
                to_register.append(alert)
                sentinel_agent.active_alerts[alert.id] = alert

            # Broadcast only newly registered alerts
            for alert in to_register:
                await alert_manager.broadcast_alert(alert)
                # Emit to main WebSocket for Recent Activity on Dashboard
                await event_emitter.emit_alert_generated(
                    str(alert.id), alert.title, alert.message, alert.severity.value
                )
                logger.info(
                    "Alert generated",
                    alert_type=alert.alert_type.value,
                    severity=alert.severity.value,
                    title=alert.title
                )
            
            # Send heartbeat every cycle
            await alert_manager.send_heartbeat()
            
            # Wait before next cycle (configurable interval)
            check_interval = settings.sentinel_check_interval_seconds
            await asyncio.sleep(check_interval)
            
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("Monitoring error", error=str(e))
            # Wait longer on error (2x normal interval)
            await asyncio.sleep(settings.sentinel_check_interval_seconds * 2)


async def _run_cip_sentinel(db) -> list:
    """Run CIP_SENTINEL cycle; returns list of Alert."""
    from src.modules.cip.agents import cip_sentinel
    return await cip_sentinel.run_cycle(db)


async def _run_scss_advisor(db) -> list:
    """Run SCSS_ADVISOR cycle; returns list of Alert."""
    from src.modules.scss.agents import scss_advisor
    return await scss_advisor.run_cycle(db)


async def _run_sro_sentinel(db) -> list:
    """Run SRO_SENTINEL cycle; returns list of Alert."""
    from src.modules.sro.agents import sro_sentinel
    return await sro_sentinel.run_cycle(db)


async def _run_asgi_sentinel(db) -> list:
    """Run ASGI_SENTINEL cycle; returns list of Alert."""
    from src.modules.asgi.agents import asgi_sentinel
    return await asgi_sentinel.run_cycle(db)


async def _evaluate_custom_triggers(db, context: dict) -> list:
    """Evaluate enabled alert_triggers against context['metrics']; return list of Alert."""
    from sqlalchemy import select
    from src.models.alert_trigger import AlertTrigger
    from src.layers.agents.sentinel import AlertSeverity, AlertType

    result = await db.execute(
        select(AlertTrigger).where(AlertTrigger.enabled.is_(True))
    )
    triggers = result.scalars().all()
    metrics = context.get("metrics") or {}
    alerts = []
    for t in triggers:
        value = metrics.get(t.metric_key)
        if value is None:
            continue
        try:
            val = float(value)
        except (TypeError, ValueError):
            continue
        thresh = float(t.threshold_value)
        op = (t.operator or "gt").strip().lower()
        fired = False
        if op == "gt":
            fired = val > thresh
        elif op == "gte":
            fired = val >= thresh
        elif op == "lt":
            fired = val < thresh
        elif op == "lte":
            fired = val <= thresh
        elif op == "eq":
            fired = abs(val - thresh) < 1e-9
        if not fired:
            continue
        try:
            sev = AlertSeverity(t.severity) if t.severity in ("info", "warning", "high", "critical") else AlertSeverity.WARNING
        except ValueError:
            sev = AlertSeverity.WARNING
        alert_type_str = t.alert_type or "custom_trigger"
        try:
            at = AlertType(alert_type_str)
        except ValueError:
            at = AlertType.CLIMATE_THRESHOLD
        alert = Alert(
            id=uuid4(),
            alert_type=at,
            severity=sev,
            title=t.name,
            message=f"Trigger '{t.name}': {t.metric_key} = {val} {op} {thresh}",
            asset_ids=[],
            exposure=0,
            recommended_actions=[],
            created_at=datetime.utcnow(),
            source="EARLY_WARNING_TRIGGER",
        )
        alerts.append(alert)
    return alerts


async def _build_monitoring_context() -> dict:
    """
    Build context for SENTINEL monitoring from real data.

    - DB: active assets (climate_risk_score, physical_risk_score, network_risk_score, valuation)
    - Geodata: risk hotspots (min_risk=0.6) for regional alerts
    - Fallback: minimal simulated context if DB/geodata fail
    """
    import random
    from sqlalchemy import select
    from src.core.database import AsyncSessionLocal
    from src.models.asset import Asset

    context = {
        "weather_forecast": {},
        "sensors": {},
        "infrastructure": {},
        "assets": [],
        "geodata_hotspots": [],
    }

    # 1. Real assets from DB (SENTINEL _check_climate_thresholds uses these)
    try:
        async with AsyncSessionLocal() as db:
            result = await db.execute(
                select(Asset)
                .where(Asset.status == "active")
                .limit(500)
            )
            assets = result.scalars().all()
            context["assets"] = [
                {
                    "id": str(a.id),
                    "climate_risk_score": a.climate_risk_score or 0,
                    "physical_risk_score": a.physical_risk_score or 0,
                    "network_risk_score": a.network_risk_score or 0,
                    "valuation": float(a.current_valuation or 0),
                }
                for a in assets
            ]
    except Exception as e:
        logger.warning("SENTINEL context: DB assets failed, using fallback", error=str(e))
        context["assets"] = []

    # 2. Real geodata hotspots (high-risk regions for SENTINEL _check_geodata_hotspots)
    try:
        from src.services.geo_data import geo_data_service
        await geo_data_service._ensure_risk_scores(force_recalculate=False)
        geojson = geo_data_service.get_risk_hotspots_geojson(min_risk=0.5, max_risk=1.0)
        features = geojson.get("features") or []
        context["geodata_hotspots"] = [
            {
                "id": f.get("id", ""),
                "name": (f.get("properties") or {}).get("name", ""),
                "risk_score": (f.get("properties") or {}).get("risk_score", 0),
                "exposure": (f.get("properties") or {}).get("exposure", 0),
            }
            for f in features
            if (f.get("properties") or {}).get("risk_score", 0) >= 0.5
        ]
    except Exception as e:
        logger.warning("SENTINEL context: geodata hotspots failed", error=str(e))
        context["geodata_hotspots"] = []

    # 3. Optional: rare simulated weather/infra (so alerts are not only climate/hotspots)
    if random.random() < 0.02:
        threat_type = random.choice(["hurricane", "flood_warning"])
        if threat_type == "hurricane":
            context["weather_forecast"]["hurricane"] = {
                "name": random.choice(["Alex", "Bella", "Carlos"]),
                "category": random.randint(1, 4),
                "region": random.choice(["Gulf Coast", "East Coast", "Caribbean"]),
                "hours": random.randint(48, 96),
                "exposure": random.uniform(50, 300),
                "affected_assets": [],
            }
        else:
            context["weather_forecast"]["flood_warning"] = {
                "region": random.choice(["Lower Manhattan", "Miami Beach", "New Orleans"]),
                "level": random.uniform(1.5, 3.0),
                "exposure": random.uniform(10, 80) * 1_000_000,
                "affected_assets": [],
            }
    if random.random() < 0.01:
        context["infrastructure"]["power_grid_1"] = {
            "type": "Power Grid",
            "status": random.choice(["degraded", "critical"]),
            "affected_count": random.randint(5, 50),
            "affected_assets": [],
            "exposure": random.uniform(5, 30) * 1_000_000,
        }

    # 4. Metrics dict for configurable Early Warning triggers (alert_triggers)
    assets = context.get("assets") or []
    hotspots = context.get("geodata_hotspots") or []
    max_climate = max((a.get("climate_risk_score") or 0) for a in assets) if assets else 0
    max_physical = max((a.get("physical_risk_score") or 0) for a in assets) if assets else 0
    total_exposure = sum((a.get("valuation") or 0) for a in assets)
    critical_count = sum(1 for h in hotspots if (h.get("risk_score") or 0) >= 0.8)
    high_count = sum(1 for h in hotspots if 0.6 <= (h.get("risk_score") or 0) < 0.8)
    context["metrics"] = {
        "max_climate_risk_score": max_climate,
        "max_physical_risk_score": max_physical,
        "total_exposure": total_exposure,
        "critical_hotspots_count": critical_count,
        "high_hotspots_count": high_count,
        "assets_count": len(assets),
        "hotspots_count": len(hotspots),
    }

    return context


# ==================== HELPER FUNCTIONS ====================

def _alert_to_response(alert: Alert) -> AlertResponse:
    """Convert Alert dataclass to response model."""
    return AlertResponse(
        id=str(alert.id),
        alert_type=alert.alert_type.value,
        severity=alert.severity.value,
        title=alert.title,
        message=alert.message,
        asset_ids=alert.asset_ids,
        exposure=alert.exposure,
        recommended_actions=alert.recommended_actions,
        created_at=alert.created_at.isoformat(),
        acknowledged=alert.acknowledged,
        resolved=alert.resolved,
        source=getattr(alert, "source", None),
        explanation=getattr(alert, "explanation", None),
    )


# ==================== REST ENDPOINTS ====================

@router.get("/", response_model=List[AlertResponse])
async def get_alerts(
    severity: Optional[str] = Query(None, description="Filter by severity"),
    unresolved_only: bool = Query(True, description="Only show unresolved alerts"),
    limit: int = Query(50, ge=1, le=200),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all alerts.

    Returns alerts sorted by severity (critical first) and time.
    Resolved state is persisted in DB (resolved_alert_keys) so it survives reload and multi-worker.
    """
    from sqlalchemy import select
    from src.models.resolved_alert_key import ResolvedAlertKey

    severity_filter = None
    if severity:
        try:
            severity_filter = AlertSeverity(severity)
        except ValueError:
            pass

    alerts = sentinel_agent.get_active_alerts(severity=severity_filter)

    if unresolved_only:
        alerts = [a for a in alerts if not a.resolved]

    # Exclude alerts whose dedup_key was resolved and persisted (survives reload / other workers)
    try:
        result = await db.execute(select(ResolvedAlertKey.dedup_key))
        resolved_keys = {row[0] for row in result.fetchall()}
        alerts = [a for a in alerts if a.dedup_key() not in resolved_keys]
    except Exception as e:
        logger.warning("Failed to load resolved_alert_keys, showing all", error=str(e))

    return [_alert_to_response(a) for a in alerts[:limit]]


@router.get("/summary", response_model=AlertSummary)
async def get_alert_summary():
    """
    Get summary of active alerts.
    """
    alerts = sentinel_agent.get_active_alerts()
    active_alerts = [a for a in alerts if not a.resolved]
    
    summary = AlertSummary(
        total=len(active_alerts),
        critical=len([a for a in active_alerts if a.severity == AlertSeverity.CRITICAL]),
        high=len([a for a in active_alerts if a.severity == AlertSeverity.HIGH]),
        warning=len([a for a in active_alerts if a.severity == AlertSeverity.WARNING]),
        info=len([a for a in active_alerts if a.severity == AlertSeverity.INFO]),
        total_exposure=sum(a.exposure for a in active_alerts),
    )
    
    if active_alerts:
        summary.newest_alert = _alert_to_response(active_alerts[0])
    
    return summary


@router.post("/acknowledge")
async def acknowledge_alert(
    request: AcknowledgeRequest,
    current_user: User = Depends(get_current_user),
):
    """Acknowledge an alert."""
    try:
        alert_id = UUID(request.alert_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid alert ID")
    
    success = sentinel_agent.acknowledge_alert(alert_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {"status": "acknowledged", "alert_id": request.alert_id}


@router.post("/resolve")
async def resolve_alert(
    request: ResolveRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Resolve an alert. Persists dedup_key in DB so the same logical alert stays resolved after reload."""
    from src.models.resolved_alert_key import ResolvedAlertKey

    try:
        alert_id = UUID(request.alert_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid alert ID")

    success = sentinel_agent.resolve_alert(alert_id)

    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")

    # Persist by dedup_key so the same alert (source:type:title) stays resolved after reload / other workers
    try:
        alert = sentinel_agent.active_alerts.get(alert_id)
        if alert:
            rec = ResolvedAlertKey(dedup_key=alert.dedup_key())
            db.add(rec)
    except Exception as e:
        logger.warning("Failed to persist resolved_alert_key", error=str(e))

    logger.info(
        "Alert resolved",
        alert_id=request.alert_id,
        notes=request.resolution_notes
    )

    return {"status": "resolved", "alert_id": request.alert_id}


@router.post("/create", response_model=AlertResponse)
async def create_manual_alert(
    request: CreateAlertRequest,
    current_user: User = Depends(get_current_user),
):
    """
    Create a manual alert.
    
    Used for ad-hoc alerts not generated by SENTINEL.
    """
    try:
        severity = AlertSeverity(request.severity)
    except ValueError:
        severity = AlertSeverity.WARNING
    
    try:
        alert_type = AlertType(request.alert_type)
    except ValueError:
        alert_type = AlertType.MAINTENANCE_DUE
    
    alert = Alert(
        id=uuid4(),
        alert_type=alert_type,
        severity=severity,
        title=request.title,
        message=request.message,
        asset_ids=request.asset_ids,
        exposure=request.exposure,
        recommended_actions=request.recommended_actions,
        created_at=datetime.utcnow(),
    )
    
    sentinel_agent.active_alerts[alert.id] = alert
    
    # Broadcast to connected clients
    await alert_manager.broadcast_alert(alert)
    # Emit to main WebSocket for Recent Activity on Dashboard
    await event_emitter.emit_alert_generated(
        str(alert.id), alert.title, alert.message, alert.severity.value
    )
    
    return _alert_to_response(alert)


@router.post("/monitoring/start")
async def start_monitoring_endpoint(
    current_user: User = Depends(get_current_user),
):
    """Start SENTINEL monitoring."""
    await start_monitoring()
    return {"status": "started", "message": "SENTINEL monitoring is now active"}


@router.post("/monitoring/stop")
async def stop_monitoring_endpoint(
    current_user: User = Depends(get_current_user),
):
    """Stop SENTINEL monitoring."""
    await stop_monitoring()
    return {"status": "stopped", "message": "SENTINEL monitoring has been stopped"}


@router.get("/monitoring/status")
async def get_monitoring_status():
    """Get SENTINEL monitoring status."""
    return {
        "is_running": _is_monitoring,
        "connected_clients": len(alert_manager.active_connections),
        "active_alerts": len([a for a in sentinel_agent.active_alerts.values() if not a.resolved]),
        "rules_count": len(sentinel_agent.rules),
    }


# ==================== CONFIGURABLE TRIGGERS (Early Warning) ====================

class TriggerCreate(BaseModel):
    name: str
    metric_key: str
    operator: str = Field(description="gt, lt, gte, lte, eq")
    threshold_value: float
    window_minutes: Optional[int] = None
    alert_type: str = "custom_trigger"
    severity: str = "warning"
    enabled: bool = True


class TriggerUpdate(BaseModel):
    name: Optional[str] = None
    metric_key: Optional[str] = None
    operator: Optional[str] = None
    threshold_value: Optional[float] = None
    window_minutes: Optional[int] = None
    alert_type: Optional[str] = None
    severity: Optional[str] = None
    enabled: Optional[bool] = None


@router.get("/triggers", response_model=List[dict])
async def list_triggers(
    enabled_only: bool = False,
    db: AsyncSession = Depends(get_db),
):
    """List Early Warning triggers (configurable metric thresholds)."""
    from sqlalchemy import select
    from src.models.alert_trigger import AlertTrigger
    q = select(AlertTrigger).order_by(AlertTrigger.name)
    if enabled_only:
        q = q.where(AlertTrigger.enabled.is_(True))
    result = await db.execute(q)
    rows = result.scalars().all()
    return [
        {
            "id": r.id,
            "name": r.name,
            "metric_key": r.metric_key,
            "operator": r.operator,
            "threshold_value": r.threshold_value,
            "window_minutes": r.window_minutes,
            "alert_type": r.alert_type,
            "severity": r.severity,
            "enabled": r.enabled,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in rows
    ]


@router.post("/triggers", response_model=dict)
async def create_trigger(
    body: TriggerCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create an Early Warning trigger."""
    from uuid import uuid4
    from src.models.alert_trigger import AlertTrigger
    rec = AlertTrigger(
        id=str(uuid4()),
        name=body.name,
        metric_key=body.metric_key,
        operator=body.operator,
        threshold_value=body.threshold_value,
        window_minutes=body.window_minutes,
        alert_type=body.alert_type,
        severity=body.severity,
        enabled=body.enabled,
    )
    db.add(rec)
    await db.commit()
    await db.refresh(rec)
    return {
        "id": rec.id,
        "name": rec.name,
        "metric_key": rec.metric_key,
        "operator": rec.operator,
        "threshold_value": rec.threshold_value,
        "window_minutes": rec.window_minutes,
        "alert_type": rec.alert_type,
        "severity": rec.severity,
        "enabled": rec.enabled,
        "created_at": rec.created_at.isoformat() if rec.created_at else None,
        "updated_at": rec.updated_at.isoformat() if rec.updated_at else None,
    }


@router.patch("/triggers/{trigger_id}", response_model=dict)
async def update_trigger(
    trigger_id: str,
    body: TriggerUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update an Early Warning trigger."""
    from sqlalchemy import select
    from src.models.alert_trigger import AlertTrigger
    result = await db.execute(select(AlertTrigger).where(AlertTrigger.id == trigger_id))
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(status_code=404, detail="Trigger not found")
    if body.name is not None:
        rec.name = body.name
    if body.metric_key is not None:
        rec.metric_key = body.metric_key
    if body.operator is not None:
        rec.operator = body.operator
    if body.threshold_value is not None:
        rec.threshold_value = body.threshold_value
    if body.window_minutes is not None:
        rec.window_minutes = body.window_minutes
    if body.alert_type is not None:
        rec.alert_type = body.alert_type
    if body.severity is not None:
        rec.severity = body.severity
    if body.enabled is not None:
        rec.enabled = body.enabled
    await db.commit()
    await db.refresh(rec)
    return {
        "id": rec.id,
        "name": rec.name,
        "metric_key": rec.metric_key,
        "operator": rec.operator,
        "threshold_value": rec.threshold_value,
        "window_minutes": rec.window_minutes,
        "alert_type": rec.alert_type,
        "severity": rec.severity,
        "enabled": rec.enabled,
        "created_at": rec.created_at.isoformat() if rec.created_at else None,
        "updated_at": rec.updated_at.isoformat() if rec.updated_at else None,
    }


# ==================== WEBSOCKET ENDPOINT ====================

@router.websocket("/ws")
async def alerts_websocket(
    websocket: WebSocket,
    min_severity: Optional[str] = Query(None),
    token: Optional[str] = Query(default=None, description="JWT token for authenticated connections"),
):
    """
    WebSocket endpoint for real-time alerts.
    Optional token: if provided, user_id is resolved and attached to the connection (ACL-ready).

    Query params:
    - min_severity: Minimum alert severity to receive (info, warning, high, critical)
    - token: Optional JWT for authenticated connection

    Messages sent:
    - {"type": "alert", "data": {...}} - New alert
    - {"type": "heartbeat", "timestamp": "..."} - Periodic heartbeat

    Messages received:
    - {"action": "acknowledge", "alert_id": "..."} - Acknowledge alert
    - {"action": "resolve", "alert_id": "..."} - Resolve alert
    - {"action": "ping"} - Responds with pong
    """
    filters = {}
    if min_severity:
        filters["min_severity"] = min_severity
    
    from src.core.security import resolve_user_id_from_token
    user_id = resolve_user_id_from_token(token)
    await alert_manager.connect(websocket, filters, user_id=user_id)
    
    # Start monitoring if not already running
    if not _is_monitoring:
        await start_monitoring()
    
    try:
        # Send current active alerts on connect
        for alert in sentinel_agent.get_active_alerts():
            if not alert.resolved:
                await websocket.send_json({
                    "type": "initial_alert",
                    "data": _alert_to_response(alert).model_dump()
                })
        
        while True:
            data = await websocket.receive_json()
            action = data.get("action")
            
            if action == "ping":
                await websocket.send_json({"type": "pong"})
            
            elif action == "acknowledge":
                alert_id = data.get("alert_id")
                if alert_id:
                    try:
                        success = sentinel_agent.acknowledge_alert(UUID(alert_id))
                        await websocket.send_json({
                            "type": "ack_response",
                            "success": success,
                            "alert_id": alert_id
                        })
                    except ValueError:
                        await websocket.send_json({
                            "type": "error",
                            "message": "Invalid alert ID"
                        })
            
            elif action == "resolve":
                alert_id = data.get("alert_id")
                if alert_id:
                    try:
                        success = sentinel_agent.resolve_alert(UUID(alert_id))
                        await websocket.send_json({
                            "type": "resolve_response",
                            "success": success,
                            "alert_id": alert_id
                        })
                    except ValueError:
                        await websocket.send_json({
                            "type": "error",
                            "message": "Invalid alert ID"
                        })
    
    except WebSocketDisconnect:
        alert_manager.disconnect(websocket)
    except Exception as e:
        logger.error("Alert WebSocket error", error=str(e))
        alert_manager.disconnect(websocket)


# ==================== STARTUP/SHUTDOWN ====================

async def on_startup():
    """Called on application startup."""
    # Optionally auto-start monitoring
    # await start_monitoring()
    pass


async def on_shutdown():
    """Called on application shutdown."""
    await stop_monitoring()
