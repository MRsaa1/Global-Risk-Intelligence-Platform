"""
NWS (National Weather Service) Active Alerts Client.

Fetches active weather alerts from the NWS API.
API Documentation: https://www.weather.gov/documentation/services-web-api

Free, no API key required. Requires User-Agent header per NWS policy.

Note: This is separate from noaa_client.py which uses NOAA CDO (historical climate data).
This client fetches LIVE weather alerts from api.weather.gov.
"""
import httpx
import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

NWS_ALERTS_URL = "https://api.weather.gov/alerts/active"

# NWS requires a User-Agent header identifying the application
NWS_USER_AGENT = "GlobalRiskPlatform/1.0 (risk-platform; contact@saa-alliance.com)"


class NWSAlertsClient:
    """Client for NWS active weather alerts."""

    def __init__(self, timeout: float = 15.0):
        self.timeout = timeout
        self._cache: Dict[str, tuple] = {}  # (data, timestamp)
        self._cache_ttl = timedelta(seconds=120)  # 2 min cache

    async def get_active_alerts(
        self,
        severity: str = "Severe,Extreme",
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """
        Get currently active weather alerts from NWS.

        Args:
            severity: Comma-separated severity filter (Minor, Moderate, Severe, Extreme).
            limit: Maximum alerts to return.

        Returns:
            List of alert dicts with geometry and properties.
        """
        cache_key = f"nws_alerts:{severity}:{limit}"

        # Check cache
        if cache_key in self._cache:
            data, timestamp = self._cache[cache_key]
            if datetime.utcnow() - timestamp < self._cache_ttl:
                return data

        params: Dict[str, str] = {
            "status": "actual",
            "severity": severity,
        }

        headers = {
            "User-Agent": NWS_USER_AGENT,
            "Accept": "application/geo+json",
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(NWS_ALERTS_URL, params=params, headers=headers)
                response.raise_for_status()
                geojson = response.json()

            features = geojson.get("features", [])
            alerts = self._extract_alerts(features, limit)

            # Cache result
            self._cache[cache_key] = (alerts, datetime.utcnow())
            logger.info("NWS: Fetched %d active alerts (severity=%s)", len(alerts), severity)
            return alerts

        except httpx.TimeoutException:
            logger.warning("NWS alerts API timeout")
            return []
        except Exception as e:
            logger.error("NWS alerts API error: %s", e)
            return []

    @staticmethod
    def _extract_alerts(features: List[Dict], limit: int) -> List[Dict[str, Any]]:
        """Extract and normalize alert features."""
        alerts: List[Dict[str, Any]] = []

        for feature in features[:limit]:
            geometry = feature.get("geometry")
            props = feature.get("properties", {})

            # NWS sometimes returns null geometry — skip those
            if geometry is None:
                # Try to build a point from the geocode area if available
                continue

            severity_raw = (props.get("severity") or "Unknown").lower()
            # Map NWS severity to our unified levels
            if severity_raw == "extreme":
                severity = "extreme"
            elif severity_raw == "severe":
                severity = "severe"
            elif severity_raw == "moderate":
                severity = "moderate"
            else:
                severity = "minor"

            alerts.append({
                "geometry": geometry,
                "event": props.get("event", "Weather Alert"),
                "severity": severity,
                "headline": props.get("headline", ""),
                "description": (props.get("description") or "")[:300],
                "effective": props.get("effective", ""),
                "expires": props.get("expires", ""),
                "sender_name": props.get("senderName", ""),
            })

        return alerts

    def clear_cache(self):
        """Clear cached data."""
        self._cache.clear()


# Global instance
nws_alerts_client = NWSAlertsClient()
