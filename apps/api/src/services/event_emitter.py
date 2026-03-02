"""
Event Emitter Service for Platform Events.

Handles:
- Event creation with causality chain
- Broadcasting to WebSocket channels
- Redis pub/sub when enable_redis (multi-worker)
- Event logging for audit trail
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

import structlog

from src.core.config import settings
from src.models.events import PlatformEvent, EventTypes
from src.api.v1.endpoints.websocket import manager as ws_manager

logger = structlog.get_logger()


class EventEmitter:
    """
    Emits platform events to WebSocket channels.
    
    Supports:
    - Dual state model (intent vs confirmed)
    - Causality chain tracking
    - Channel-based broadcasting
    """
    
    def __init__(self):
        self._event_log: List[PlatformEvent] = []
        self._max_log_size = 1000
    
    async def emit(
        self,
        event_type: str,
        entity_type: str,
        entity_id: str,
        action: str,
        data: Dict[str, Any] = None,
        intent: bool = True,
        caused_by: Optional[str] = None,
        actor_id: Optional[str] = None,
        actor_type: str = "user",
    ) -> PlatformEvent:
        """
        Emit a platform event.
        
        Args:
            event_type: Event type from EventTypes
            entity_type: Type of entity (stress_test, zone, portfolio, etc.)
            entity_id: ID of the entity
            action: Action performed (started, selected, updated, etc.)
            data: Additional event data
            intent: True = optimistic/intent, False = confirmed
            caused_by: Parent event_id for causality chain
            actor_id: ID of the actor (user, agent, system)
            actor_type: Type of actor (user, system, agent)
        
        Returns:
            The created PlatformEvent
        """
        event = PlatformEvent(
            event_id=str(uuid4()),
            event_type=event_type,
            version="1.0",
            timestamp=datetime.utcnow(),
            caused_by=caused_by,
            triggers=[],
            actor_id=actor_id,
            actor_type=actor_type,
            entity_type=entity_type,
            entity_id=entity_id,
            action=action,
            data=data or {},
            intent=intent,
        )
        
        # Log event
        self._log_event(event)
        
        # Broadcast to appropriate channels
        await self._broadcast(event)
        
        logger.info(
            "Event emitted",
            event_id=event.event_id,
            event_type=event_type,
            entity_type=entity_type,
            entity_id=entity_id,
            intent=intent,
        )
        
        return event
    
    def _log_event(self, event: PlatformEvent):
        """Add event to log, maintaining max size."""
        self._event_log.append(event)
        if len(self._event_log) > self._max_log_size:
            self._event_log = self._event_log[-self._max_log_size:]
    
    async def _broadcast(self, event: PlatformEvent):
        """Broadcast event to WebSocket channels. When Redis is enabled, also publish to Redis for other workers."""
        channel = EventTypes.get_channel_for_event(event.event_type)
        payload = event.dict()
        await ws_manager.broadcast_to_channel(channel, payload)
        if getattr(settings, "enable_redis", False) and (getattr(settings, "redis_url", "") or "").strip():
            try:
                from src.services.redis_bus import publish_event
                await publish_event(channel, payload)
            except Exception as e:
                logger.warning("Redis publish_event failed", error=str(e))
    
    async def emit_stress_test_started(
        self,
        test_id: str,
        name: str,
        test_type: str,
        severity: float = 0.5,
        probability: float = 0.5,
        actor_id: Optional[str] = None,
    ) -> PlatformEvent:
        """Emit stress test started event."""
        return await self.emit(
            event_type=EventTypes.STRESS_TEST_STARTED,
            entity_type="stress_test",
            entity_id=test_id,
            action="started",
            data={
                "name": name,
                "type": test_type,
                "severity": severity,
                "probability": probability,
            },
            intent=True,
            actor_id=actor_id,
        )
    
    async def emit_stress_test_progress(
        self,
        test_id: str,
        progress: int,
        status: str = "running",
        message: Optional[str] = None,
    ) -> PlatformEvent:
        """Emit stress test progress event."""
        return await self.emit(
            event_type=EventTypes.STRESS_TEST_PROGRESS,
            entity_type="stress_test",
            entity_id=test_id,
            action="progress",
            data={
                "progress": progress,
                "status": status,
                "message": message,
            },
            intent=False,  # Progress is always confirmed
        )
    
    async def emit_stress_test_completed(
        self,
        test_id: str,
        name: str,
        result: Dict[str, Any],
        caused_by: Optional[str] = None,
    ) -> PlatformEvent:
        """Emit stress test completed event."""
        return await self.emit(
            event_type=EventTypes.STRESS_TEST_COMPLETED,
            entity_type="stress_test",
            entity_id=test_id,
            action="completed",
            data={
                "name": name,
                "result": result,
            },
            intent=False,  # Completion is confirmed
            caused_by=caused_by,
        )
    
    async def emit_stress_test_failed(
        self,
        test_id: str,
        name: str,
        error: str,
        caused_by: Optional[str] = None,
    ) -> PlatformEvent:
        """Emit stress test failed event."""
        return await self.emit(
            event_type=EventTypes.STRESS_TEST_FAILED,
            entity_type="stress_test",
            entity_id=test_id,
            action="failed",
            data={
                "name": name,
                "error": error,
            },
            intent=False,  # Failure is confirmed
            caused_by=caused_by,
        )

    async def emit_geopolitical_alert(
        self,
        region: str,
        affected_entity_ids: Optional[List[str]] = None,
        message: Optional[str] = None,
        estimated_impact: Optional[Dict[str, Any]] = None,
    ) -> PlatformEvent:
        """Emit geopolitical alert; broadcast STRESS_TEST_UPDATE so dashboards can prompt recalculation."""
        affected = affected_entity_ids or []
        ev = await self.emit(
            event_type=EventTypes.GEOPOLITICAL_ALERT,
            entity_type="region",
            entity_id=region,
            action="alert",
            data={
                "region": region,
                "affected_entity_ids": affected,
                "affected_count": len(affected),
                "message": message or "Geopolitical event may affect stress test assumptions.",
                "estimated_impact": estimated_impact or {},
            },
            intent=False,
            actor_type="system",
        )
        await ws_manager.broadcast_to_channel(
            "stress_tests",
            {
                "event_type": EventTypes.STRESS_TEST_UPDATE,
                "entity_type": "stress_test",
                "entity_id": region,
                "action": "update",
                "data": {
                    "trigger": "geopolitical_alert",
                    "affected_count": len(affected),
                    "message": message or "Consider re-running stress tests for affected entities.",
                    "estimated_impact": estimated_impact,
                },
            },
        )
        return ev

    async def emit_stress_test_trigger(
        self,
        trigger_entity_id: str,
        affected_entity_ids: Optional[List[str]] = None,
        reason: str = "trigger",
    ) -> PlatformEvent:
        """Emit stress test trigger; broadcast STRESS_TEST_UPDATE for real-time dashboard."""
        affected = affected_entity_ids or []
        ev = await self.emit(
            event_type=EventTypes.STRESS_TEST_TRIGGER,
            entity_type="stress_test",
            entity_id=trigger_entity_id,
            action="trigger",
            data={
                "affected_entity_ids": affected,
                "affected_count": len(affected),
                "reason": reason,
            },
            intent=False,
            actor_type="system",
        )
        await ws_manager.broadcast_to_channel(
            "stress_tests",
            {
                "event_type": EventTypes.STRESS_TEST_UPDATE,
                "entity_type": "stress_test",
                "entity_id": trigger_entity_id,
                "action": "update",
                "data": {
                    "trigger": "stress_test_trigger",
                    "affected_count": len(affected),
                    "message": "Stress test assumptions may have changed; consider recalculation.",
                },
            },
        )
        return ev
    
    async def emit_zone_selected(
        self,
        zone_id: str,
        zone_name: str,
        risk_score: float,
        exposure: float,
        center_latitude: float = 0.0,
        center_longitude: float = 0.0,
        radius_km: float = 0.0,
        zone_level: str = "medium",
        actor_id: Optional[str] = None,
    ) -> PlatformEvent:
        """Emit zone selected event."""
        return await self.emit(
            event_type=EventTypes.ZONE_SELECTED,
            entity_type="zone",
            entity_id=zone_id,
            action="selected",
            data={
                "name": zone_name,
                "risk_score": risk_score,
                "exposure": exposure,
                "zone": {
                    "id": zone_id,
                    "name": zone_name,
                    "risk_score": risk_score,
                    "total_exposure": exposure,
                    "zone_level": zone_level,
                    "center_latitude": center_latitude,
                    "center_longitude": center_longitude,
                    "radius_km": radius_km,
                },
            },
            intent=True,
            actor_id=actor_id,
        )
    
    async def emit_portfolio_updated(
        self,
        portfolio_data: Dict[str, Any],
        caused_by: Optional[str] = None,
    ) -> PlatformEvent:
        """Emit portfolio updated event."""
        return await self.emit(
            event_type=EventTypes.PORTFOLIO_UPDATED,
            entity_type="portfolio",
            entity_id="main",
            action="updated",
            data={"portfolio": portfolio_data},
            intent=False,  # Portfolio updates are always confirmed
            caused_by=caused_by,
        )
    
    async def emit_asset_risk_updated(
        self,
        asset_id: str,
        asset_name: str,
        climate_risk: Optional[float] = None,
        physical_risk: Optional[float] = None,
        network_risk: Optional[float] = None,
        caused_by: Optional[str] = None,
    ) -> PlatformEvent:
        """Emit asset risk updated event."""
        return await self.emit(
            event_type=EventTypes.ASSET_RISK_UPDATED,
            entity_type="asset",
            entity_id=asset_id,
            action="risk_updated",
            data={
                "name": asset_name,
                "climate_risk": climate_risk,
                "physical_risk": physical_risk,
                "network_risk": network_risk,
            },
            intent=False,
            caused_by=caused_by,
        )
    
    async def emit_risk_zone_created(
        self,
        zone_id: str,
        zone_name: str,
        zone_level: str,
        risk_score: float,
        stress_test_id: str,
        caused_by: Optional[str] = None,
    ) -> PlatformEvent:
        """Emit risk zone created event."""
        return await self.emit(
            event_type=EventTypes.RISK_ZONE_CREATED,
            entity_type="zone",
            entity_id=zone_id,
            action="created",
            data={
                "name": zone_name,
                "zone_level": zone_level,
                "risk_score": risk_score,
                "stress_test_id": stress_test_id,
            },
            intent=False,
            caused_by=caused_by,
        )
    
    async def emit_digital_twin_opened(
        self,
        city_id: str,
        city_name: str,
        actor_id: Optional[str] = None,
    ) -> PlatformEvent:
        """Emit digital twin opened event."""
        return await self.emit(
            event_type=EventTypes.TWIN_OPENED,
            entity_type="digital_twin",
            entity_id=city_id,
            action="opened",
            data={"name": city_name},
            intent=True,
            actor_id=actor_id,
        )
    
    async def emit_digital_twin_closed(
        self,
        city_id: str,
        city_name: str,
        actor_id: Optional[str] = None,
    ) -> PlatformEvent:
        """Emit digital twin closed event."""
        return await self.emit(
            event_type=EventTypes.TWIN_CLOSED,
            entity_type="digital_twin",
            entity_id=city_id,
            action="closed",
            data={"name": city_name},
            intent=False,
            actor_id=actor_id,
        )
    
    async def emit_alert_generated(
        self,
        alert_id: str,
        title: str,
        message: str = "",
        severity: str = "info",
        **extra: Any,
    ) -> PlatformEvent:
        """Emit alert generated event (for Recent Activity and dashboard)."""
        return await self.emit(
            event_type=EventTypes.ALERT_GENERATED,
            entity_type="alert",
            entity_id=alert_id,
            action="created",
            data={"name": title, "message": message, "severity": severity, **extra},
            intent=False,
        )

    async def emit_data_refresh_completed(
        self,
        source_id: str,
        summary: Dict[str, Any],
        affected_city_ids: Optional[List[str]] = None,
    ) -> PlatformEvent:
        """Emit data refresh completed (real-time ingestion pipeline)."""
        return await self.emit(
            event_type=EventTypes.DATA_REFRESH_COMPLETED,
            entity_type="data_source",
            entity_id=source_id,
            action="refresh_completed",
            data={
                "source_id": source_id,
                "summary": summary,
                "affected_city_ids": affected_city_ids or [],
            },
            intent=False,
            actor_type="system",
        )

    async def emit_threat_detected(
        self,
        threat_id: str,
        source: str,
        data: Dict[str, Any],
    ) -> PlatformEvent:
        """Emit threat detected (OSINT / social / cyber)."""
        return await self.emit(
            event_type=EventTypes.THREAT_DETECTED,
            entity_type="threat",
            entity_id=threat_id,
            action="detected",
            data={"source": source, **data},
            intent=False,
            actor_type="system",
        )

    async def emit_market_update(
        self,
        data: Dict[str, Any],
    ) -> PlatformEvent:
        """Emit market data update (VIX, indices, spreads)."""
        return await self.emit(
            event_type=EventTypes.MARKET_UPDATE,
            entity_type="market",
            entity_id="ticker",
            action="updated",
            data=data,
            intent=False,
            actor_type="system",
        )
    
    def get_recent_events(self, limit: int = 50) -> List[PlatformEvent]:
        """Get recent events from log."""
        return self._event_log[-limit:][::-1]  # Most recent first
    
    def get_events_by_type(self, event_type: str, limit: int = 50) -> List[PlatformEvent]:
        """Get events of a specific type."""
        events = [e for e in self._event_log if e.event_type == event_type]
        return events[-limit:][::-1]


# Global event emitter instance
event_emitter = EventEmitter()
