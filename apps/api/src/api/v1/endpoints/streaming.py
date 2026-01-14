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
from typing import Set
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from pydantic import BaseModel
from enum import Enum
import structlog
import numpy as np
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
    """Manage WebSocket connections."""
    
    def __init__(self):
        self.active_connections: Set[WebSocket] = set()
        self.subscriptions: dict[WebSocket, set[str]] = {}
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.add(websocket)
        self.subscriptions[websocket] = set()
        logger.info("WebSocket connected", total_connections=len(self.active_connections))
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.discard(websocket)
        self.subscriptions.pop(websocket, None)
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
async def websocket_endpoint(websocket: WebSocket):
    """
    Main WebSocket endpoint for real-time streaming.
    
    Protocol:
    - Client sends: {"action": "subscribe", "streams": ["risk_update", "alert"]}
    - Server sends: {"type": "risk_update", "timestamp": "...", "data": {...}}
    """
    await manager.connect(websocket)
    
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
    Send periodic risk updates.
    
    In production, this would pull from Redis/database.
    """
    while True:
        try:
            # Simulate risk data (replace with real data source)
            risk_data = generate_sample_risk_data()
            
            message = StreamMessage(
                type=StreamType.RISK_UPDATE,
                timestamp=datetime.utcnow().isoformat(),
                data=risk_data
            )
            
            await manager.send_to(websocket, message)
            await asyncio.sleep(5)  # Update every 5 seconds
        
        except asyncio.CancelledError:
            break
        except Exception as e:
            logger.error("Risk update error", error=str(e))
            break


def generate_sample_risk_data() -> dict:
    """Generate sample risk data for streaming."""
    # In production, pull from Redis or compute service
    
    hotspots = [
        {"id": "tokyo", "lat": 35.68, "lng": 139.65, "risk": 0.85 + np.random.uniform(-0.1, 0.1)},
        {"id": "shanghai", "lat": 31.23, "lng": 121.47, "risk": 0.82 + np.random.uniform(-0.1, 0.1)},
        {"id": "newyork", "lat": 40.71, "lng": -74.01, "risk": 0.70 + np.random.uniform(-0.1, 0.1)},
        {"id": "london", "lat": 51.51, "lng": -0.13, "risk": 0.55 + np.random.uniform(-0.1, 0.1)},
        {"id": "dubai", "lat": 25.20, "lng": 55.27, "risk": 0.45 + np.random.uniform(-0.1, 0.1)},
    ]
    
    # Clamp risk values
    for h in hotspots:
        h["risk"] = max(0.0, min(1.0, h["risk"]))
    
    return {
        "total_exposure": 482.3 + np.random.uniform(-5, 5),
        "at_risk": 67.5 + np.random.uniform(-2, 2),
        "critical": 14.8 + np.random.uniform(-1, 1),
        "hotspots": hotspots,
        "network_stress": 0.67 + np.random.uniform(-0.05, 0.05),
        "active_scenarios": 3
    }


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
