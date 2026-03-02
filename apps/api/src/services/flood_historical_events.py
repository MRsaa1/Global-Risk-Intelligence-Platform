"""
Historical flood events catalog for model validation (10+ cities).

Each event has actual loss (USD) and approximate return period for comparison
with flood model output. Used by flood-model/validate-batch and
flood-model/retrospective (model vs fact per city).
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import List


def _haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Approximate distance in km between two WGS84 points."""
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    c = 2 * math.asin(math.sqrt(min(1.0, a)))
    return R * c


def events_near_city(lat: float, lon: float, radius_km: float = 120.0) -> List[HistoricalFloodEvent]:
    """Return historical flood events within radius_km of the given city center."""
    return [e for e in HISTORICAL_FLOOD_EVENTS if _haversine_km(lat, lon, e.lat, e.lon) <= radius_km]


@dataclass
class HistoricalFloodEvent:
    event_id: str
    city_name: str
    city_id: str
    lat: float
    lon: float
    population: int
    actual_loss_usd: float
    return_period_approx_years: int
    actual_depth_m: float
    date: str


HISTORICAL_FLOOD_EVENTS: List[HistoricalFloodEvent] = [
    HistoricalFloodEvent("harvey_2017", "Houston", "houston_tx", 29.7604, -95.3698, 2_300_000, 125_000_000_000, 500, 1.8, "2017-08"),
    HistoricalFloodEvent("cedar_rapids_2008", "Cedar Rapids", "cedar_rapids_ia", 41.9779, -91.6656, 137_000, 6_000_000_000, 100, 1.5, "2008-06"),
    HistoricalFloodEvent("nashville_2010", "Nashville", "nashville_tn", 36.1627, -86.7816, 670_000, 2_000_000_000, 100, 1.2, "2010-05"),
    HistoricalFloodEvent("baton_rouge_2016", "Baton Rouge", "baton_rouge_la", 30.4515, -91.1871, 225_000, 10_000_000_000, 100, 1.4, "2016-08"),
    HistoricalFloodEvent("colorado_2013", "Boulder/Denver", "boulder_co", 40.0150, -105.2705, 320_000, 2_000_000_000, 50, 0.9, "2013-09"),
    HistoricalFloodEvent("ellicott_city_2016", "Ellicott City", "ellicott_city_md", 39.2673, -76.7983, 65_000, 22_000_000, 50, 0.8, "2016-07"),
    HistoricalFloodEvent("harrisburg_2011", "Harrisburg", "harrisburg_pa", 40.2732, -76.8867, 50_000, 150_000_000, 50, 0.7, "2011-09"),
    HistoricalFloodEvent("davenport_2019", "Davenport", "davenport_ia", 41.5236, -90.5776, 102_000, 175_000_000, 50, 1.0, "2019-04"),
    HistoricalFloodEvent("des_moines_1993", "Des Moines", "des_moines_ia", 41.5868, -93.6250, 214_000, 500_000_000, 100, 1.1, "1993-07"),
    HistoricalFloodEvent("minot_2011", "Minot", "minot_nd", 48.2325, -101.2963, 48_000, 700_000_000, 100, 1.3, "2011-06"),
    HistoricalFloodEvent("san_antonio_1998", "San Antonio", "san_antonio_tx", 29.4241, -98.4936, 1_450_000, 500_000_000, 50, 0.9, "1998-10"),
    HistoricalFloodEvent("austin_2015", "Austin", "austin_tx", 30.2672, -97.7431, 950_000, 30_000_000, 25, 0.6, "2015-10"),
]
