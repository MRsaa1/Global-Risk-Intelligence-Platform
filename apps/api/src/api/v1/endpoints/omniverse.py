"""
Omniverse / E2CC launch endpoint.

GET /launch?region=...&scenario=...&lat=...&lon=...&narrative=...
Returns { "launch_url": "..." } for "Open in Omniverse" / Launch E2CC.
GET /status — E2CC configured (base URL) for UI.
"""
from __future__ import annotations

from typing import Optional
from urllib.parse import urlencode

from fastapi import APIRouter, Query

from src.core.config import settings

router = APIRouter()


@router.get("/launch")
async def omniverse_launch(
    region: Optional[str] = Query(None, description="Region or zone id"),
    scenario: Optional[str] = Query(None, description="Stress scenario id or name"),
    narrative: Optional[str] = Query(None, description="Narrative or context id"),
    lat: Optional[float] = Query(None, description="Latitude for E2CC camera center", ge=-90, le=90),
    lon: Optional[float] = Query(None, description="Longitude for E2CC camera center", ge=-180, le=180),
) -> dict:
    """
    Return launch URL for E2CC (Open in Omniverse).

    Builds E2CC_BASE_URL + query params. Frontend opens this URL in a new tab.
    Pass lat/lon so E2CC can center the view on the region.
    """
    base = (getattr(settings, "e2cc_base_url", None) or "").strip() or "http://localhost:8010"
    base = base.rstrip("/")
    qdict: dict[str, str] = {}
    if region:
        qdict["region"] = region
    if scenario:
        qdict["scenario"] = scenario
    if narrative:
        qdict["narrative"] = narrative
    if lat is not None:
        qdict["lat"] = str(lat)
    if lon is not None:
        qdict["lon"] = str(lon)
    qs = urlencode(qdict)
    launch_url = f"{base}?{qs}" if qs else base
    return {"launch_url": launch_url}


@router.get("/status")
async def omniverse_status() -> dict:
    """
    Return Omniverse/E2CC status for UI (is E2CC configured, base URL).
    e2cc_configured = True whenever base URL is set so the button opens the URL.
    When URL is localhost, user must run port-forward 8010 on their machine to reach server's E2CC.
    """
    base = (getattr(settings, "e2cc_base_url", None) or "").strip() or "http://localhost:8010"
    is_local = "localhost" in base or "127.0.0.1" in base
    return {
        "e2cc_configured": True,  # Always allow opening; if localhost, user needs port-forward 8010
        "e2cc_base_url": base,
        "e2cc_use_port_forward": is_local,  # Hint: open port-forward 8010 on your machine
    }
