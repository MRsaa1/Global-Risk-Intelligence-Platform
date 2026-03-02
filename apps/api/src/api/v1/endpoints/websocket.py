"""
WebSocket API for Real-time Updates.

Provides WebSocket connections for:
- Dashboard real-time updates
- Asset changes notifications  
- Stress test progress
- Alert broadcasts
"""
import asyncio
import json
from datetime import datetime
from typing import Dict, Set, Optional, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
import structlog

from src.core.database import get_db
from src.core.security import get_current_user
from src.models.user import User

logger = structlog.get_logger()
router = APIRouter()

# Public channels anyone can subscribe to (no auth required)
PUBLIC_CHANNELS = frozenset({
    "dashboard", "command_center", "assets", "alerts",
    "stress_tests", "viewer", "annotations",
    "threat_intelligence", "market_data",
    "natural_hazards", "weather", "biosecurity",
    "cyber_threats", "economic", "infrastructure",
})
# ACL: channels that require valid JWT; without auth these are not subscribed.
# Add channel names here when they must be restricted to authenticated users only.
AUTH_REQUIRED_CHANNELS = frozenset({"assets"})


# ==================== CONNECTION MANAGER ====================

class ConnectionManager:
    """
    Manages WebSocket connections with channel-based subscriptions.

    Channels:
    - dashboard: General dashboard updates
    - assets: Asset changes (CRUD)
    - alerts: Real-time alerts
    - stress_tests: Stress test progress
    - system_oversee: OVERSEER system monitoring snapshots (status, system_alerts, executive_summary)
    - user:{user_id}: User-specific notifications
    """
    
    def __init__(self):
        # channel -> set of connections
        self._channels: Dict[str, Set[WebSocket]] = {}
        # connection -> set of channels
        self._connection_channels: Dict[WebSocket, Set[str]] = {}
        # connection -> metadata
        self._connection_info: Dict[WebSocket, Dict] = {}
        self._lock = asyncio.Lock()
        # Last payload for late-joining clients
        self._last_market_data: Optional[dict] = None
        # source_id -> updated_at (from data.refresh_completed)
        self._last_refresh_by_source: Dict[str, str] = {}
        # Recent threat events for late-joining threat_intelligence subscribers
        self._last_threat_events: list[dict] = []
        self._last_threat_signatures: Set[str] = set()

    def _threat_signature(self, event: dict) -> str:
        """Stable key for deduplicating replayed threat events."""
        event_id = (event.get("event_id") or "").strip()
        if event_id:
            return f"id:{event_id}"
        data = event.get("data") or {}
        source = str(data.get("source") or "").strip().lower()
        text = str(data.get("text") or data.get("title") or "").strip().lower()
        url = str(data.get("url") or "").strip().lower()
        return f"sig:{source}|{url}|{text}"

    async def connect(
        self, 
        websocket: WebSocket, 
        channels: list[str] = None,
        user_id: str = None,
    ):
        """Accept connection and subscribe to channels."""
        await websocket.accept()
        
        async with self._lock:
            self._connection_channels[websocket] = set()
            self._connection_info[websocket] = {
                "connected_at": datetime.utcnow(),
                "user_id": user_id,
                "id": str(uuid4())[:8],
            }
            
            # Subscribe to requested channels (validated against whitelist)
            default_channels = ["dashboard"]
            channel_list = list(channels or default_channels)
            for ch in channel_list:
                await self._subscribe(websocket, ch, user_id=user_id)
            
            # Subscribe to user-specific channel
            if user_id:
                await self._subscribe(websocket, f"user:{user_id}", user_id=user_id)
        
        # Send last market_data snapshot to new subscriber so they see data immediately
        last_market = getattr(self, "_last_market_data", None)
        if last_market and "market_data" in channel_list:
            try:
                await websocket.send_json({
                    "type": "message",
                    "channel": "market_data",
                    "data": last_market,
                    "timestamp": datetime.utcnow().isoformat(),
                })
            except Exception:
                pass

        # Send last refresh timestamps for dashboard so Live Data Bar / panels show times
        last_refresh = getattr(self, "_last_refresh_by_source", None) or {}
        if last_refresh and "dashboard" in channel_list:
            now_iso = datetime.utcnow().isoformat()
            for src_id, updated_at in last_refresh.items():
                try:
                    await websocket.send_json({
                        "type": "message",
                        "channel": "dashboard",
                        "data": {
                            "event_type": "data.refresh_completed",
                            "entity_type": "data_source",
                            "entity_id": src_id,
                            "action": "refresh_completed",
                            "data": {
                                "source_id": src_id,
                                "summary": {"updated_at": updated_at},
                            },
                            "intent": False,
                            "actor_type": "system",
                            "timestamp": updated_at,
                        },
                        "timestamp": now_iso,
                    })
                except Exception:
                    break
        
        # Send recent threat signals so feed isn't empty after reconnects
        last_threat_events = getattr(self, "_last_threat_events", None) or []
        if last_threat_events and "threat_intelligence" in channel_list:
            now_iso = datetime.utcnow().isoformat()
            for event in last_threat_events:
                try:
                    await websocket.send_json({
                        "type": "message",
                        "channel": "threat_intelligence",
                        "data": event,
                        "timestamp": now_iso,
                    })
                except Exception:
                    break

        logger.info(
            "WebSocket connected",
            connection_id=self._connection_info[websocket]["id"],
            channels=list(self._connection_channels.get(websocket, [])),
        )
    
    async def _subscribe(self, websocket: WebSocket, channel: str, user_id: Optional[str] = None):
        """Subscribe connection to a channel. Validates whitelist and ACL (auth-required channels)."""
        # user:* channels require the connection to be authenticated as that user
        if channel.startswith("user:"):
            target_uid = channel.split(":", 1)[1]
            if not user_id or user_id != target_uid:
                return False  # silently reject
        elif channel not in PUBLIC_CHANNELS:
            return False  # unknown channel
        elif channel in AUTH_REQUIRED_CHANNELS and not user_id:
            return False  # ACL: sensitive channel requires auth
        if channel not in self._channels:
            self._channels[channel] = set()
        self._channels[channel].add(websocket)
        self._connection_channels[websocket].add(channel)
        return True
    
    async def _unsubscribe(self, websocket: WebSocket, channel: str):
        """Unsubscribe connection from a channel."""
        if channel in self._channels:
            self._channels[channel].discard(websocket)
            if not self._channels[channel]:
                del self._channels[channel]
        if websocket in self._connection_channels:
            self._connection_channels[websocket].discard(channel)
    
    async def disconnect(self, websocket: WebSocket):
        """Disconnect and cleanup."""
        async with self._lock:
            # Unsubscribe from all channels
            if websocket in self._connection_channels:
                for channel in list(self._connection_channels[websocket]):
                    await self._unsubscribe(websocket, channel)
                del self._connection_channels[websocket]
            
            # Remove connection info
            info = self._connection_info.pop(websocket, {})
        
        logger.info(
            "WebSocket disconnected",
            connection_id=info.get("id", "unknown"),
        )
    
    async def subscribe(self, websocket: WebSocket, channel: str):
        """Subscribe to additional channel (validated)."""
        user_id = self._connection_info.get(websocket, {}).get("user_id")
        async with self._lock:
            ok = await self._subscribe(websocket, channel, user_id=user_id)
        
        if ok:
            await websocket.send_json({
                "type": "subscribed",
                "channel": channel,
                "timestamp": datetime.utcnow().isoformat(),
            })
        else:
            await websocket.send_json({
                "type": "error",
                "message": f"Channel '{channel}' not allowed",
                "timestamp": datetime.utcnow().isoformat(),
            })
    
    async def unsubscribe(self, websocket: WebSocket, channel: str):
        """Unsubscribe from a channel."""
        async with self._lock:
            await self._unsubscribe(websocket, channel)
        
        await websocket.send_json({
            "type": "unsubscribed",
            "channel": channel,
            "timestamp": datetime.utcnow().isoformat(),
        })
    
    async def broadcast_to_channel(
        self, 
        channel: str, 
        message: dict,
        exclude: WebSocket = None,
    ):
        """Broadcast message to all connections in a channel."""
        if channel == "market_data" and isinstance(message, dict):
            self._last_market_data = dict(message)
        if channel == "dashboard" and isinstance(message, dict):
            if message.get("event_type") == "data.refresh_completed":
                data = message.get("data") or {}
                source_id = data.get("source_id")
                summary = data.get("summary") or {}
                updated_at = summary.get("updated_at")
                if source_id and updated_at:
                    self._last_refresh_by_source[source_id] = updated_at
        if channel == "threat_intelligence" and isinstance(message, dict):
            event_type = message.get("event_type")
            if event_type in {"threat.social_detected", "threat.detected"}:
                event_copy = dict(message)
                signature = self._threat_signature(event_copy)
                if signature not in self._last_threat_signatures:
                    self._last_threat_events.append(event_copy)
                    self._last_threat_signatures.add(signature)
                    # Keep small rolling window
                    if len(self._last_threat_events) > 30:
                        self._last_threat_events = self._last_threat_events[-30:]
                        self._last_threat_signatures = {self._threat_signature(evt) for evt in self._last_threat_events}
        if channel not in self._channels:
            return
        
        payload = {
            "type": "message",
            "channel": channel,
            "data": message,
            "timestamp": datetime.utcnow().isoformat(),
        }
        
        disconnected = []
        for connection in self._channels[channel]:
            if connection == exclude:
                continue
            try:
                await connection.send_json(payload)
            except Exception:
                disconnected.append(connection)
        
        # Cleanup disconnected
        for conn in disconnected:
            await self.disconnect(conn)
    
    async def send_to_user(self, user_id: str, message: dict):
        """Send message to specific user."""
        await self.broadcast_to_channel(f"user:{user_id}", message)
    
    async def broadcast_all(self, message: dict):
        """Broadcast to all connected clients."""
        await self.broadcast_to_channel("dashboard", message)
    
    def get_stats(self) -> dict:
        """Get connection statistics."""
        return {
            "total_connections": len(self._connection_channels),
            "channels": {
                channel: len(connections) 
                for channel, connections in self._channels.items()
            },
        }

    def get_connection_id(self, websocket: WebSocket) -> Optional[str]:
        """Get a short connection id for a websocket."""
        info = self._connection_info.get(websocket)
        return info.get("id") if info else None


# Global connection manager
manager = ConnectionManager()


# ==================== EVENT EMITTERS ====================

async def emit_asset_created(asset: dict):
    """Emit asset created event."""
    await manager.broadcast_to_channel("assets", {
        "event": "asset_created",
        "asset": asset,
    })
    await manager.broadcast_to_channel("dashboard", {
        "event": "data_changed",
        "entity": "assets",
        "action": "created",
    })


async def emit_asset_updated(asset_id: str, changes: dict):
    """Emit asset updated event."""
    await manager.broadcast_to_channel("assets", {
        "event": "asset_updated",
        "asset_id": asset_id,
        "changes": changes,
    })
    await manager.broadcast_to_channel("dashboard", {
        "event": "data_changed",
        "entity": "assets",
        "action": "updated",
    })


async def emit_asset_deleted(asset_id: str):
    """Emit asset deleted event."""
    await manager.broadcast_to_channel("assets", {
        "event": "asset_deleted",
        "asset_id": asset_id,
    })


async def emit_stress_test_progress(
    test_id: str, 
    progress: int, 
    status: str,
    message: str = None,
):
    """Emit stress test progress update."""
    await manager.broadcast_to_channel("stress_tests", {
        "event": "stress_test_progress",
        "test_id": test_id,
        "progress": progress,
        "status": status,
        "message": message,
    })


async def emit_stress_test_completed(test_id: str, result: dict):
    """Emit stress test completion."""
    await manager.broadcast_to_channel("stress_tests", {
        "event": "stress_test_completed",
        "test_id": test_id,
        "result": result,
    })
    await manager.broadcast_to_channel("dashboard", {
        "event": "data_changed",
        "entity": "stress_tests",
        "action": "completed",
    })


async def emit_alert(alert: dict):
    """Emit new alert to all clients."""
    await manager.broadcast_to_channel("alerts", {
        "event": "new_alert",
        "alert": alert,
    })
    await manager.broadcast_to_channel("dashboard", {
        "event": "alert",
        "severity": alert.get("severity", "info"),
    })


async def emit_notification(user_id: str, notification: dict):
    """Emit notification to specific user."""
    await manager.send_to_user(user_id, {
        "event": "notification",
        "notification": notification,
    })


# ==================== WEBSOCKET ENDPOINTS ====================

async def _resolve_ws_user_id(token: Optional[str]) -> Optional[str]:
    """Extract user_id from JWT token for WebSocket connections. Returns None if token is absent or invalid."""
    if not token:
        return None
    try:
        from jose import jwt as _jwt
        from src.core.config import settings as _s
        payload = _jwt.decode(token, _s.secret_key, algorithms=[_s.algorithm])
        return payload.get("sub")
    except Exception:
        return None


@router.websocket("/connect")
async def websocket_endpoint(
    websocket: WebSocket,
    channels: str = Query(default="dashboard", description="Comma-separated channels"),
    token: Optional[str] = Query(default=None, description="JWT token for authenticated connections"),
):
    """
    Main WebSocket endpoint for real-time updates.
    
    **Query Parameters:**
    - channels: Comma-separated list of channels to subscribe to
      - dashboard: General updates and metrics
      - command_center: Command Center events (zones, digital twins, historical events)
      - assets: Asset CRUD events
      - alerts: Real-time alerts
      - stress_tests: Stress test progress
      - viewer: Real-time viewer telemetry (position/focus)
      - annotations: Collaboration events for annotations
    - token: Optional JWT token to identify the user securely
    
    **Incoming Messages:**
    - {"action": "subscribe", "channel": "..."} - Subscribe to channel
    - {"action": "unsubscribe", "channel": "..."} - Unsubscribe from channel
    - {"action": "ping"} - Ping/pong for keepalive
    - {"action": "event", "event": "viewer.position"|"viewer.focus_asset"|"annotation.add", "payload": {...}} - Collaboration event
    
    **Outgoing Messages:**
    - {"type": "message", "channel": "...", "data": {...}} - Channel message
    - {"type": "subscribed", "channel": "..."} - Subscription confirmed
    - {"type": "pong"} - Pong response
    """
    channel_list = [c.strip() for c in channels.split(",") if c.strip()]
    user_id = await _resolve_ws_user_id(token)
    # ACL: drop auth-required channels if not authenticated (no 403 to avoid leaking channel list)
    if not user_id:
        channel_list = [ch for ch in channel_list if ch not in AUTH_REQUIRED_CHANNELS]
    
    await manager.connect(websocket, channels=channel_list, user_id=user_id)
    
    # Send welcome message
    await websocket.send_json({
        "type": "connected",
        "connection_id": manager.get_connection_id(websocket),
        "channels": channel_list,
        "timestamp": datetime.utcnow().isoformat(),
    })
    
    try:
        while True:
            data = await websocket.receive_json()
            action = data.get("action")
            
            if action == "ping":
                await websocket.send_json({"type": "pong"})
            
            elif action == "subscribe":
                channel = data.get("channel")
                if channel:
                    await manager.subscribe(websocket, channel)
            
            elif action == "unsubscribe":
                channel = data.get("channel")
                if channel:
                    await manager.unsubscribe(websocket, channel)
            
            elif action == "get_stats":
                stats = manager.get_stats()
                await websocket.send_json({
                    "type": "stats",
                    "data": stats,
                })

            # Collaboration / viewer events (Phase 6.3-6.4)
            else:
                # Support both:
                # - { action: "event", event: "...", payload: {...} }
                # - { event: "...", payload: {...} }  (legacy/simple)
                evt = data.get("event") or data.get("type")
                if action == "event" or evt in {"viewer.position", "viewer.focus_asset", "annotation.add"}:
                    event_name = evt
                    payload = data.get("payload") or data.get("data") or {}

                    if event_name == "viewer.position" or event_name == "viewer.focus_asset":
                        channel = "viewer"
                    elif event_name == "annotation.add":
                        channel = "annotations"
                    else:
                        channel = "command_center"

                    await manager.broadcast_to_channel(
                        channel,
                        {
                            "event": event_name,
                            "payload": payload,
                            "from_connection_id": manager.get_connection_id(websocket),
                        },
                        exclude=websocket,
                    )
                    await websocket.send_json({
                        "type": "ack",
                        "event": event_name,
                        "timestamp": datetime.utcnow().isoformat(),
                    })
    
    except WebSocketDisconnect:
        await manager.disconnect(websocket)
    except Exception as e:
        logger.error("WebSocket error", error=str(e))
        await manager.disconnect(websocket)


@router.get("/stats")
async def get_websocket_stats():
    """Get WebSocket connection statistics."""
    return manager.get_stats()


@router.post("/broadcast")
async def broadcast_message(
    channel: str = Query(..., description="Channel to broadcast to"),
    message: dict = None,
    current_user: User = Depends(get_current_user),
):
    """
    Broadcast a message to a channel (admin only — requires valid JWT + admin role).
    
    Used for testing and admin notifications.
    """
    from src.models.user import UserRole
    if current_user.role != UserRole.ADMIN.value:
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Admin role required for broadcast")
    await manager.broadcast_to_channel(channel, message or {"test": True})
    return {"status": "sent", "channel": channel}
