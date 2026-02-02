"""Platform Event Models for Event-Driven Architecture.

Events represent all actions in the platform with:
- Causality chain (caused_by, triggers)
- Dual state (intent vs confirmed)
- Versioning for backward compatibility
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import uuid4

from pydantic import BaseModel, Field


class PlatformEvent(BaseModel):
    """Platform event with causality chain and dual state."""
    
    event_id: str = Field(default_factory=lambda: str(uuid4()))
    event_type: str  # e.g., "stress_test.started", "zone.selected"
    version: str = "1.0"
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    
    # Causality chain
    caused_by: Optional[str] = None  # parent event_id
    triggers: List[str] = Field(default_factory=list)  # child event types
    
    # Actor
    actor_id: Optional[str] = None
    actor_type: str = "user"  # user, system, agent
    
    # Payload
    entity_type: str  # stress_test, zone, portfolio, digital_twin
    entity_id: str
    action: str  # started, selected, updated, opened, closed
    data: Dict[str, Any] = Field(default_factory=dict)
    
    # State
    intent: bool = True  # True = intent (optimistic), False = confirmed (backend verified)
    
    class Config:
        json_encoders = {
            datetime: lambda v: v.isoformat()
        }


class EventTypes:
    """Event type constants."""
    
    # Stress Tests
    STRESS_TEST_STARTED = "stress_test.started"
    STRESS_TEST_COMPLETED = "stress_test.completed"
    STRESS_TEST_FAILED = "stress_test.failed"
    STRESS_TEST_PROGRESS = "stress_test.progress"
    STRESS_TEST_DELETED = "STRESS_TEST_DELETED"
    
    # Zones
    ZONE_SELECTED = "zone.selected"
    ZONE_DESELECTED = "zone.deselected"
    ZONE_RISK_UPDATED = "zone.risk_updated"
    RISK_ZONE_CREATED = "RISK_ZONE_CREATED"
    
    # Portfolio
    PORTFOLIO_UPDATED = "portfolio.updated"
    EXPOSURE_CHANGED = "exposure.changed"
    ASSET_RISK_UPDATED = "asset.risk_updated"
    
    # Digital Twin
    TWIN_OPENED = "twin.opened"
    TWIN_CLOSED = "twin.closed"
    TWIN_STATE_CHANGED = "twin.state_changed"
    
    # Historical Events
    HISTORICAL_EVENT_SELECTED = "historical.selected"
    HISTORICAL_SCENARIO_APPLIED = "historical.applied"
    
    # System
    SYSTEM_HEALTH_CHANGED = "system.health_changed"
    ALERT_GENERATED = "alert.generated"

    # Event-driven stress test (Phase 3)
    GEOPOLITICAL_ALERT = "geopolitical.alert"
    STRESS_TEST_TRIGGER = "stress_test.trigger"
    STRESS_TEST_UPDATE = "stress_test.update"
    
    @classmethod
    def get_channel_for_event(cls, event_type: str) -> str:
        """Get WebSocket channel for event type."""
        # Explicit mappings for uppercase event types
        if event_type == cls.STRESS_TEST_DELETED:
            return "stress_tests"
        if event_type == cls.RISK_ZONE_CREATED:
            return "command_center"
        if event_type in (cls.GEOPOLITICAL_ALERT, cls.STRESS_TEST_TRIGGER, cls.STRESS_TEST_UPDATE):
            return "stress_tests"
        # Pattern-based mappings
        if event_type.startswith("stress_test") or event_type.startswith("geopolitical"):
            return "stress_tests"
        elif event_type.startswith("zone"):
            return "command_center"
        elif event_type.startswith("portfolio") or event_type.startswith("exposure") or event_type.startswith("asset"):
            return "dashboard"
        elif event_type.startswith("twin"):
            return "command_center"
        elif event_type.startswith("historical"):
            return "command_center"
        elif event_type.startswith("alert"):
            return "alerts"
        else:
            return "dashboard"
