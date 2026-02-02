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

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, HTTPException, Query
from pydantic import BaseModel, Field
import structlog

from src.layers.agents.sentinel import sentinel_agent, Alert, AlertSeverity, AlertType
from src.core.config import settings
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
    
    async def connect(self, websocket: WebSocket, filters: dict = None):
        """Accept a new connection. Auto-start SENTINEL monitoring on first client."""
        await websocket.accept()
        was_empty = len(self.active_connections) == 0
        self.active_connections.add(websocket)
        self.connection_info[websocket] = {
            "connected_at": datetime.utcnow(),
            "filters": filters or {},
        }
        if was_empty:
            try:
                await start_monitoring()
                logger.info("SENTINEL monitoring auto-started (first alerts WebSocket client)")
            except Exception as e:
                logger.warning("Auto-start monitoring failed: %s", e)
        logger.info(
            "Alert WebSocket connected",
            total=len(self.active_connections)
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
        """Broadcast alert to all connected clients."""
        if not self.active_connections:
            return
        
        alert_data = _alert_to_response(alert)
        message = {
            "type": "alert",
            "timestamp": datetime.utcnow().isoformat(),
            "data": alert_data.model_dump()
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
            
            # Broadcast new alerts
            for alert in alerts:
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
    )


# ==================== REST ENDPOINTS ====================

@router.get("/", response_model=List[AlertResponse])
async def get_alerts(
    severity: Optional[str] = Query(None, description="Filter by severity"),
    unresolved_only: bool = Query(True, description="Only show unresolved alerts"),
    limit: int = Query(50, ge=1, le=200),
):
    """
    Get all alerts.
    
    Returns alerts sorted by severity (critical first) and time.
    """
    severity_filter = None
    if severity:
        try:
            severity_filter = AlertSeverity(severity)
        except ValueError:
            pass
    
    alerts = sentinel_agent.get_active_alerts(severity=severity_filter)
    
    if unresolved_only:
        alerts = [a for a in alerts if not a.resolved]
    
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
async def acknowledge_alert(request: AcknowledgeRequest):
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
async def resolve_alert(request: ResolveRequest):
    """Resolve an alert."""
    try:
        alert_id = UUID(request.alert_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid alert ID")
    
    success = sentinel_agent.resolve_alert(alert_id)
    
    if not success:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    logger.info(
        "Alert resolved",
        alert_id=request.alert_id,
        notes=request.resolution_notes
    )
    
    return {"status": "resolved", "alert_id": request.alert_id}


@router.post("/create", response_model=AlertResponse)
async def create_manual_alert(request: CreateAlertRequest):
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
async def start_monitoring_endpoint():
    """Start SENTINEL monitoring."""
    await start_monitoring()
    return {"status": "started", "message": "SENTINEL monitoring is now active"}


@router.post("/monitoring/stop")
async def stop_monitoring_endpoint():
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


# ==================== WEBSOCKET ENDPOINT ====================

@router.websocket("/ws")
async def alerts_websocket(
    websocket: WebSocket,
    min_severity: Optional[str] = Query(None),
):
    """
    WebSocket endpoint for real-time alerts.
    
    Query params:
    - min_severity: Minimum alert severity to receive (info, warning, high, critical)
    
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
    
    await alert_manager.connect(websocket, filters)
    
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
