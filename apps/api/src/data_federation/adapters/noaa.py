"""NOAA adapter: storm events and climate data via NOAAClient."""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from .base import AdapterResult, BaseAdapter, Region, TimeRange


class NOAAAdapter(BaseAdapter):
    """Adapter for NOAA Climate Data Online / Storm Events."""

    def __init__(self) -> None:
        self._client: Optional[Any] = None

    def _get_client(self) -> Any:
        if self._client is None:
            from src.services.external.noaa_client import noaa_client
            self._client = noaa_client
        return self._client

    def name(self) -> str:
        return "noaa"

    def description(self) -> str:
        return "NOAA storm events and climate data (requires state for storm events)."

    def params_schema(self) -> Dict[str, Any]:
        return {
            "state": {"type": "str", "description": "US state code (e.g. TX, FL) for storm events"},
            "days": {"type": "int", "default": 365, "description": "Days to look back"},
        }

    async def fetch(
        self,
        region: Region,
        time_range: Optional[TimeRange] = None,
        **params: Any,
    ) -> AdapterResult:
        client = self._get_client()
        state = params.get("state") or "TX"
        if not isinstance(state, str):
            state = "TX"
        days = params.get("days", 365)
        if not isinstance(days, int):
            days = 365

        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)

        events = await client.get_storm_events(
            state=state,
            start_date=start_date,
            end_date=end_date,
        )

        out: List[Dict[str, Any]] = []
        for e in events:
            ev = {
                "event_id": getattr(e, "event_id", None),
                "event_type": getattr(e, "event_type", ""),
                "begin_date": getattr(e, "begin_date", None),
                "end_date": getattr(e, "end_date", None),
                "state": getattr(e, "state", ""),
                "magnitude": getattr(e, "magnitude", None),
                "magnitude_type": getattr(e, "magnitude_type", None),
                "injuries": getattr(e, "injuries", 0),
                "deaths": getattr(e, "deaths", 0),
                "damage_property": getattr(e, "damage_property", 0.0),
                "damage_crops": getattr(e, "damage_crops", 0.0),
                "description": getattr(e, "description", None),
            }
            if hasattr(ev["begin_date"], "isoformat") and ev["begin_date"]:
                ev["begin_date"] = ev["begin_date"].isoformat()
            if hasattr(ev["end_date"], "isoformat") and ev["end_date"]:
                ev["end_date"] = ev["end_date"].isoformat()
            out.append(ev)

        return AdapterResult(
            data={"storm_events": out, "count": len(out)},
            meta={
                "state": state,
                "start_date": start_date.isoformat(),
                "end_date": end_date.isoformat(),
                "days": days,
            },
            source="NOAA Storm Events",
        )
