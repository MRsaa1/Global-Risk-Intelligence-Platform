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

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from pydantic import BaseModel
import structlog

logger = structlog.get_logger()
router = APIRouter()


# ==================== CONNECTION MANAGER ====================

class ConnectionManager:
    """
    Manages WebSocket connections with channel-based subscriptions.
    
    Channels:
    - dashboard: General dashboard updates
    - assets: Asset changes (CRUD)
    - alerts: Real-time alerts
    - stress_tests: Stress test progress
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
            
            # Subscribe to requested channels
            default_channels = ["dashboard"]
            for channel in (channels or default_channels):
                await self._subscribe(websocket, channel)
            
            # Subscribe to user-specific channel
            if user_id:
                await self._subscribe(websocket, f"user:{user_id}")
        
        logger.info(
            "WebSocket connected",
            connection_id=self._connection_info[websocket]["id"],
            channels=list(self._connection_channels.get(websocket, [])),
        )
    
    async def _subscribe(self, websocket: WebSocket, channel: str):
        """Subscribe connection to a channel."""
        if channel not in self._channels:
            self._channels[channel] = set()
        self._channels[channel].add(websocket)
        self._connection_channels[websocket].add(channel)
    
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
        """Subscribe to additional channel."""
        async with self._lock:
            await self._subscribe(websocket, channel)
        
        await websocket.send_json({
            "type": "subscribed",
            "channel": channel,
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

@router.websocket("/connect")
async def websocket_endpoint(
    websocket: WebSocket,
    channels: str = Query(default="dashboard", description="Comma-separated channels"),
    user_id: str = Query(default=None, description="User ID for personal notifications"),
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
    - user_id: Optional user ID for personal notifications
    
    **Incoming Messages:**
    - {"action": "subscribe", "channel": "..."} - Subscribe to channel
    - {"action": "unsubscribe", "channel": "..."} - Unsubscribe from channel
    - {"action": "ping"} - Ping/pong for keepalive
    
    **Outgoing Messages:**
    - {"type": "message", "channel": "...", "data": {...}} - Channel message
    - {"type": "subscribed", "channel": "..."} - Subscription confirmed
    - {"type": "pong"} - Pong response
    """
    channel_list = [c.strip() for c in channels.split(",") if c.strip()]
    
    await manager.connect(websocket, channels=channel_list, user_id=user_id)
    
    # Send welcome message
    await websocket.send_json({
        "type": "connected",
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
):
    """
    Broadcast a message to a channel (admin only).
    
    Used for testing and admin notifications.
    """
    await manager.broadcast_to_channel(channel, message or {"test": True})
    return {"status": "sent", "channel": channel}
