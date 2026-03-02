"""
WebSocket Streaming API
========================

Real-time data streaming for:
- Risk updates
- Stress test progress
- Market data
- Alert notifications

Designed for GPU-client rendering.
"""
import asyncio
import json
from typing import Optional, Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel
from enum import Enum
import structlog
from datetime import datetime

logger = structlog.get_logger()
router = APIRouter()


class StreamType(str, Enum):
    RISK_UPDATE = "risk_update"
    STRESS_PROGRESS = "stress_progress"
    ALERT = "alert"
    MARKET_DATA = "market_data"
    ASSET_UPDATE = "asset_update"


class StreamMessage(BaseModel):
    type: StreamType
    timestamp: str
    data: dict


# ==============================================
# CONNECTION MANAGER
# ==============================================

class ConnectionManager:
    """Manage WebSocket connections. Optional JWT token for user identity (ACL-ready)."""
    
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.subscriptions: dict[WebSocket, set[str]] = {}
        self.connection_user_id: dict[WebSocket, Optional[str]] = {}
    
    async def connect(self, websocket: WebSocket, user_id: Optional[str] = None):
        await websocket.accept()
        self.active_connections.add(websocket)
        self.subscriptions[websocket] = set()
        self.connection_user_id[websocket] = user_id
        logger.info("WebSocket connected", total_connections=len(self.active_connections), user_id=user_id is not None)
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        self.subscriptions.pop(websocket, None)
        self.connection_user_id.pop(websocket, None)
        logger.info("WebSocket disconnected", total_connections=len(self.active_connections))
    
    def subscribe(self, websocket: WebSocket, stream_type: str):
        if websocket in self.subscriptions:
            self.subscriptions[websocket].add(stream_type)
    
    def unsubscribe(self, websocket: WebSocket, stream_type: str):
        if websocket in self.subscriptions:
            self.subscriptions[websocket].discard(stream_type)
    
    async def broadcast(self, message: StreamMessage):
        """Broadcast to all subscribers of this message type."""
        disconnected = []
        
        for websocket in self.active_connections:
            # Check if subscribed to this type
            subs = self.subscriptions.get(websocket, set())
            if message.type.value in subs or "all" in subs:
                try:
                    await websocket.send_json(message.model_dump())
                except Exception:
                    disconnected.append(websocket)
        
        # Clean up disconnected
        for ws in disconnected:
            self.disconnect(ws)
    
    async def send_to(self, websocket: WebSocket, message: StreamMessage):
        """Send to specific connection."""
        try:
            await websocket.send_json(message.model_dump())
        except Exception:
            self.disconnect(websocket)


manager = ConnectionManager()


# ==============================================
# WEBSOCKET ENDPOINTS
# ==============================================

@router.websocket("/ws/stream")
async def websocket_endpoint(
    websocket: WebSocket,
    token: Optional[str] = Query(default=None, description="JWT token for authenticated connections"),
):
    """
    Main WebSocket endpoint for real-time streaming.
    Optional token: if provided, user_id is resolved and attached to the connection (ACL-ready).
    Protocol:
    - Client sends: {"action": "subscribe", "streams": ["risk_update", "alert"]}
    - Server sends: {"type": "risk_update", "timestamp": "...", "data": {...}}
    """
    from src.core.security import resolve_user_id_from_token
    user_id = resolve_user_id_from_token(token)
    await manager.connect(websocket, user_id=user_id)
    
    try:
        # Start background tasks
        risk_task = asyncio.create_task(send_risk_updates(websocket))
        
        while True:
            # Receive client messages
            data = await websocket.receive_json()
            
            action = data.get("action")
            
            if action == "subscribe":
                streams = data.get("streams", [])
                for stream in streams:
                    manager.subscribe(websocket, stream)
                await websocket.send_json({
                    "type": "subscribed",
                    "streams": streams
                })
            
            elif action == "unsubscribe":
                streams = data.get("streams", [])
                for stream in streams:
                    manager.unsubscribe(websocket, stream)
            
            elif action == "ping":
                await websocket.send_json({"type": "pong"})
    
    except WebSocketDisconnect:
        manager.disconnect(websocket)
        risk_task.cancel()
    except Exception as e:
        logger.error("WebSocket error", error=str(e))
        manager.disconnect(websocket)


async def send_risk_updates(websocket: WebSocket):
    """
    Send risk updates only when a city is marked dirty (e.g. after parameter change).
    Does NOT continuously recalculate random cities — that caused risk to "drift" on the
    globe (critical→high) without real-world changes. Data is not analyzed live; use
    cached/periodic recalculation from geodata instead.
    """
    from src.data.cities import get_all_cities, get_city
    from src.services.city_risk_calculator import get_city_risk_calculator
    from src.services.risk_stream_bus import pop_dirty_city
    from src.core.database import AsyncSessionLocal
    from src.models.asset import Asset
    from sqlalchemy import select, func

    cities = get_all_cities()
    city_ids = [c.id for c in cities]
    if not city_ids:
        city_ids = ["tokyo", "newyork", "london"]

    from src.core.config import get_settings
    settings = get_settings()
    use_v2 = getattr(settings, "risk_model_version", 2) == 2
    use_external_data = True

    calc = get_city_risk_calculator()
    last: dict[str, float] = {}

    def _zone_level(r: float) -> str:
        if r > 0.8:
            return "critical"
        if r > 0.6:
            return "high"
        if r > 0.4:
            return "medium"
        return "low"

    while True:
        try:
            # Only push updates for cities explicitly marked dirty (e.g. parameter update).
            # No random recalculation — avoids drift (critical→high) when data is not live.
            city_id = await pop_dirty_city()
            if not city_id:
                await asyncio.sleep(30)
                continue

            score = await calc.calculate_risk(
                city_id,
                force_recalculate=True,
                use_external_data=use_external_data,
                use_risk_model_v2=use_v2,
            )
            if not score:
                await asyncio.sleep(2)
                continue

            base = float(score.risk_score)

            city = get_city(city_id)
            candidates: set[str] = {city_id}
            if city:
                candidates.add(city.name)
                if city.name.lower().endswith(" city"):
                    candidates.add(city.name[:-5])
            candidates = {c for c in candidates if c}
            candidates |= {c.replace(" ", "") for c in candidates if " " in c}
            candidates_lower = [c.lower() for c in candidates]

            asset_risk: float | None = None
            try:
                async with AsyncSessionLocal() as session:
                    q = (
                        select(Asset.physical_risk_score, Asset.climate_risk_score, Asset.network_risk_score)
                        .where(Asset.city.is_not(None))
                        .where(func.lower(Asset.city).in_(candidates_lower))
                    )
                    res = await session.execute(q)
                    rows = res.all()

                vals: list[float] = []
                for (phys, clim, net) in rows:
                    parts: list[float] = []
                    for v in (phys, clim, net):
                        if v is None:
                            continue
                        try:
                            parts.append(float(v) / 100.0)
                        except Exception:
                            continue
                    if parts:
                        vals.append(max(0.0, min(1.0, max(parts))))
                if vals:
                    asset_risk = sum(vals) / len(vals)
            except Exception:
                asset_risk = None

            if asset_risk is not None:
                new = max(0.0, min(1.0, base * 0.7 + asset_risk * 0.3))
            else:
                new = max(0.0, min(1.0, base))

            prev = float(last.get(city_id, new))
            last[city_id] = new

            new_zone_raw = (score.zone or "").strip().upper()
            new_zone = new_zone_raw.lower() if new_zone_raw in ("LOW", "MEDIUM", "HIGH", "CRITICAL") else _zone_level(new)
            prev_zone = _zone_level(prev)
            if abs(new - prev) < 0.002 and prev_zone == new_zone:
                await asyncio.sleep(2)
                continue

            await websocket.send_json(
                {
                    "type": "risk_update",
                    "hotspot_id": city_id,
                    "risk_score": new,
                    "previous_score": prev,
                    "zone_level": new_zone,
                    "previous_zone_level": prev_zone,
                    "timestamp": datetime.utcnow().isoformat(),
                }
            )

            await asyncio.sleep(2)
        
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("Risk update error", error=str(e))
            break


def generate_sample_risk_data() -> dict:
    """
    Legacy sample snapshot generator (unused by the UI stream).

    Kept for backward compatibility / future aggregated snapshots.
    """
    return {}


# ==============================================
# STRESS TEST STREAMING
# ==============================================

async def stream_stress_test_progress(
    websocket: WebSocket,
    total_simulations: int,
    scenario_name: str
):
    """
    Stream stress test progress to client.
    
    Called during stress test execution.
    """
    for progress in range(0, 101, 10):
        message = StreamMessage(
            type=StreamType.STRESS_PROGRESS,
            timestamp=datetime.utcnow().isoformat(),
            data={
                "scenario": scenario_name,
                "progress": progress,
                "simulations_complete": int(total_simulations * progress / 100),
                "total_simulations": total_simulations
            }
        )
        await manager.send_to(websocket, message)
        await asyncio.sleep(0.5)


# ==============================================
# ALERT BROADCASTING
# ==============================================

async def broadcast_alert(
    alert_type: str,
    severity: str,
    message: str,
    asset_id: str = None
):
    """
    Broadcast alert to all connected clients.
    
    Args:
        alert_type: Type of alert (risk_threshold, cascade, climate, etc.)
        severity: low, medium, high, critical
        message: Alert message
        asset_id: Optional related asset
    """
    alert = StreamMessage(
        type=StreamType.ALERT,
        timestamp=datetime.utcnow().isoformat(),
        data={
            "alert_type": alert_type,
            "severity": severity,
            "message": message,
            "asset_id": asset_id
        }
    )
    await manager.broadcast(alert)
