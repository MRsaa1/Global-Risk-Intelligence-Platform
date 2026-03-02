"""
NASA FIRMS (Fire Information for Resource Management System) Client.

Fetches active fire data from the FIRMS CSV API.
API Documentation: https://firms.modaps.eosdis.nasa.gov/api/area/

Free API — register for a MAP_KEY at https://firms.modaps.eosdis.nasa.gov/api/area/
Works without key at low volume; key recommended for production.
"""
import csv
import io
import httpx
import logging
import os
from datetime import datetime, timedelta
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

# FIRMS CSV API base URL
FIRMS_API_BASE = "https://firms.modaps.eosdis.nasa.gov/api/area/csv"


class NASAFIRMSClient:
    """Client for NASA FIRMS active fire data."""

    def __init__(self, map_key: Optional[str] = None, timeout: float = 15.0):
        self.map_key = map_key or os.getenv("FIRMS_MAP_KEY", "")
        self.timeout = timeout
        self._cache: Dict[str, tuple] = {}  # (data, timestamp)
        self._cache_ttl = timedelta(seconds=120)  # 2 min cache

    async def get_active_fires(
        self,
        days: int = 1,
        min_confidence: int = 80,
        limit: int = 500,
    ) -> List[Dict]:
        """
        Get global active fires from the last N days.

        Args:
            days: Number of days to look back (1-10).
            min_confidence: Minimum confidence level (0-100). 80+ = high confidence.
            limit: Maximum number of fire points to return.

        Returns:
            List of fire dicts: {lat, lng, brightness, confidence, acq_date, acq_time}.
        """
        cache_key = f"fires:{days}:{min_confidence}"

        # Check cache
        if cache_key in self._cache:
            data, timestamp = self._cache[cache_key]
            if datetime.utcnow() - timestamp < self._cache_ttl:
                return data

        if not self.map_key:
            logger.info("FIRMS MAP_KEY not set — returning empty fire list")
            return []

        # VIIRS_SNPP_NRT = Near Real-Time data from Suomi NPP satellite
        url = f"{FIRMS_API_BASE}/{self.map_key}/VIIRS_SNPP_NRT/world/{days}"

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(url)
                response.raise_for_status()
                text = response.text

            fires = self._parse_csv(text, min_confidence, limit)

            # Cache result
            self._cache[cache_key] = (fires, datetime.utcnow())
            logger.info("FIRMS: Fetched %d active fires (confidence >= %d)", len(fires), min_confidence)
            return fires

        except httpx.TimeoutException:
            logger.warning("FIRMS API timeout")
            return []
        except Exception as e:
            logger.error("FIRMS API error: %s", e)
            return []

    @staticmethod
    def _parse_csv(text: str, min_confidence: int, limit: int) -> List[Dict]:
        """Parse FIRMS CSV response to list of fire dicts."""
        fires: List[Dict] = []
        reader = csv.DictReader(io.StringIO(text))

        for row in reader:
            try:
                conf = int(row.get("confidence", "0") or "0")
            except (ValueError, TypeError):
                # FIRMS VIIRS uses "n", "l", "h" for nominal/low/high
                conf_str = str(row.get("confidence", "")).lower()
                conf = 90 if conf_str == "h" else 50 if conf_str == "n" else 20
            if conf < min_confidence:
                continue

            try:
                lat = float(row.get("latitude", 0))
                lng = float(row.get("longitude", 0))
                brightness = float(row.get("bright_ti4", 0) or row.get("brightness", 0))
            except (ValueError, TypeError):
                continue

            fires.append({
                "lat": lat,
                "lng": lng,
                "brightness": brightness,
                "confidence": conf,
                "acq_date": row.get("acq_date", ""),
                "acq_time": row.get("acq_time", ""),
            })

            if len(fires) >= limit:
                break

        return fires

    def clear_cache(self):
        """Clear cached data."""
        self._cache.clear()


def get_nasa_firms_client() -> NASAFIRMSClient:
    """Get FIRMS client instance with MAP_KEY from settings."""
    try:
        from src.core.config import get_settings
        settings = get_settings()
        map_key = getattr(settings, "firms_map_key", "") or os.getenv("FIRMS_MAP_KEY", "")
    except Exception:
        map_key = os.getenv("FIRMS_MAP_KEY", "")
    return NASAFIRMSClient(map_key=map_key)


nasa_firms_client = get_nasa_firms_client()
