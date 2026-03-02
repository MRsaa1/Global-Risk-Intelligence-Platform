"""
Unified ingestion event contract for the risk grading pipeline.

Jobs (or adapters) can return a list of IngestionEvent; the pipeline merges
affected_city_ids and triggers recalc. Enables consistent format across
threat_intelligence, natural_hazards, weather, economic, etc.
"""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional


@dataclass
class IngestionEvent:
    """Single event from an ingestion source for risk recalculation."""
    source_id: str
    risk_type: str  # e.g. geopolitical, climate, seismic, economic, other
    affected_city_ids: List[str] = field(default_factory=list)
    severity_signal: float = 0.0  # 0-1 optional signal
    timestamp: Optional[datetime] = None
    payload: Optional[Dict[str, Any]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source_id": self.source_id,
            "risk_type": self.risk_type,
            "affected_city_ids": self.affected_city_ids,
            "severity_signal": self.severity_signal,
            "timestamp": (self.timestamp or datetime.utcnow()).isoformat(),
            "payload": self.payload,
        }


def merge_affected_city_ids_from_events(
    events: List[Any],
    max_cities: int = 300,
) -> List[str]:
    """Deduplicate and cap city IDs from events (IngestionEvent or dict with affected_city_ids)."""
    seen: set = set()
    out: List[str] = []
    for ev in events:
        ids = getattr(ev, "affected_city_ids", None) or (ev.get("affected_city_ids") if isinstance(ev, dict) else [])
        for cid in ids:
            if cid not in seen and len(out) < max_cities:
                seen.add(cid)
                out.append(cid)
    return out
