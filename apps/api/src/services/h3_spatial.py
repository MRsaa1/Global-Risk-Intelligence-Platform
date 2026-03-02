"""
H3 Hexagonal Grid Spatial Service.

Provides spatial indexing and risk aggregation using Uber's H3 hexagonal grid.
Resolution levels:
  - res 3: ~12,000 km² (global overview)
  - res 5: ~253 km² (country/region)
  - res 7: ~5.2 km² (city)
  - res 9: ~0.1 km² (asset/neighborhood)

Reference: docs/UNIFIED_PLATFORM_MASTER_PLAN - Section 1.2 Spatial Core
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# H3 library import (pure-python fallback when C extension unavailable)
# ---------------------------------------------------------------------------
try:
    import h3
    HAS_H3 = True
    logger.info("H3 library available for hexagonal spatial indexing")
except ImportError:
    HAS_H3 = False
    logger.warning("h3 library not installed; using built-in fallback spatial grid")


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class XRiskVector:
    """Extinction-level risk vector for a spatial cell."""
    p_agi: float = 0.0       # AI x-risk
    p_bio: float = 0.0       # Pandemic x-risk
    p_nuclear: float = 0.0   # Nuclear x-risk
    p_climate: float = 0.0   # Climate x-risk
    p_financial: float = 0.0 # Systemic financial x-risk
    p_total: float = 0.0     # Combined (correlated)

    def compute_total(self) -> float:
        """Compute correlated total using inclusion-exclusion approximation."""
        risks = [self.p_agi, self.p_bio, self.p_nuclear, self.p_climate, self.p_financial]
        # P(at least one) ≈ 1 - product(1 - p_i)
        complement = 1.0
        for p in risks:
            complement *= (1.0 - max(0.0, min(1.0, p)))
        self.p_total = round(1.0 - complement, 6)
        return self.p_total

    def to_dict(self) -> Dict[str, float]:
        return {
            "p_agi": self.p_agi,
            "p_bio": self.p_bio,
            "p_nuclear": self.p_nuclear,
            "p_climate": self.p_climate,
            "p_financial": self.p_financial,
            "p_total": self.p_total,
        }


@dataclass
class HexCell:
    """A single H3 hexagonal cell with risk data."""
    h3_index: str
    resolution: int
    center_lat: float
    center_lng: float
    risk_vector: XRiskVector = field(default_factory=XRiskVector)
    risk_score: float = 0.0        # 0-1 aggregate risk
    risk_level: str = "low"        # low/medium/high/critical
    population: int = 0
    asset_count: int = 0
    color: str = "#22c55e"         # hex color for visualization

    def to_dict(self) -> Dict[str, Any]:
        return {
            "h3_index": self.h3_index,
            "resolution": self.resolution,
            "center": [self.center_lat, self.center_lng],
            "boundary": self._get_boundary(),
            "risk_vector": self.risk_vector.to_dict(),
            "risk_score": self.risk_score,
            "risk_level": self.risk_level,
            "population": self.population,
            "asset_count": self.asset_count,
            "color": self.color,
        }

    def _get_boundary(self) -> List[List[float]]:
        """Return hex boundary as [[lat, lng], ...] for visualization."""
        if HAS_H3:
            try:
                boundary = h3.cell_to_boundary(self.h3_index)
                return [[lat, lng] for lat, lng in boundary]
            except Exception:
                pass
        return self._fallback_hexagon()

    def _fallback_hexagon(self) -> List[List[float]]:
        """Generate approximate hexagon vertices from center + resolution."""
        # Approximate radius in degrees based on resolution
        radii = {3: 1.0, 4: 0.5, 5: 0.2, 6: 0.08, 7: 0.03, 8: 0.012, 9: 0.005}
        r = radii.get(self.resolution, 0.03)
        coords = []
        for i in range(6):
            angle = math.radians(60 * i + 30)
            lat = self.center_lat + r * math.sin(angle)
            lng = self.center_lng + r * math.cos(angle) / max(0.01, math.cos(math.radians(self.center_lat)))
            coords.append([lat, lng])
        return coords


# ---------------------------------------------------------------------------
# Risk level + color helpers
# ---------------------------------------------------------------------------

def _risk_level(score: float) -> str:
    if score >= 0.8:
        return "critical"
    if score >= 0.6:
        return "high"
    if score >= 0.35:
        return "medium"
    return "low"


def _risk_color(score: float) -> str:
    if score >= 0.8:
        return "#dc2626"   # red
    if score >= 0.6:
        return "#ea580c"   # orange
    if score >= 0.35:
        return "#eab308"   # yellow
    return "#22c55e"       # green


# ---------------------------------------------------------------------------
# H3 Spatial Service
# ---------------------------------------------------------------------------

class H3SpatialService:
    """
    Hexagonal spatial indexing and risk aggregation.

    Usage:
        svc = H3SpatialService()
        svc.assign_risk(45.5, -73.6, XRiskVector(p_climate=0.05))
        grid = svc.get_hexgrid(resolution=5, bounds=(40, -80, 50, -70))
    """

    def __init__(self):
        self._cells: Dict[str, HexCell] = {}

    # ---- core operations ---------------------------------------------------

    def lat_lng_to_cell(self, lat: float, lng: float, resolution: int = 5) -> str:
        """Convert lat/lng to H3 cell index."""
        if HAS_H3:
            return h3.latlng_to_cell(lat, lng, resolution)
        # Fallback: coarse grid ID
        scale = 10 ** (resolution - 3)
        lat_bin = int(lat * scale)
        lng_bin = int(lng * scale)
        return f"fb_{resolution}_{lat_bin}_{lng_bin}"

    def assign_risk(
        self,
        lat: float,
        lng: float,
        risk_vector: XRiskVector,
        resolution: int = 5,
        population: int = 0,
        asset_count: int = 0,
    ) -> HexCell:
        """Assign a risk vector to the H3 cell containing (lat, lng)."""
        idx = self.lat_lng_to_cell(lat, lng, resolution)
        cell = self._cells.get(idx)
        if cell is None:
            center = self._cell_center(idx, lat, lng)
            cell = HexCell(
                h3_index=idx,
                resolution=resolution,
                center_lat=center[0],
                center_lng=center[1],
            )
            self._cells[idx] = cell

        # Merge risk vectors (take max per domain)
        cell.risk_vector.p_agi = max(cell.risk_vector.p_agi, risk_vector.p_agi)
        cell.risk_vector.p_bio = max(cell.risk_vector.p_bio, risk_vector.p_bio)
        cell.risk_vector.p_nuclear = max(cell.risk_vector.p_nuclear, risk_vector.p_nuclear)
        cell.risk_vector.p_climate = max(cell.risk_vector.p_climate, risk_vector.p_climate)
        cell.risk_vector.p_financial = max(cell.risk_vector.p_financial, risk_vector.p_financial)
        cell.risk_vector.compute_total()
        cell.risk_score = cell.risk_vector.p_total
        cell.risk_level = _risk_level(cell.risk_score)
        cell.color = _risk_color(cell.risk_score)
        cell.population += population
        cell.asset_count += asset_count
        return cell

    def get_hexgrid(
        self,
        resolution: int = 5,
        bounds: Optional[Tuple[float, float, float, float]] = None,
    ) -> List[Dict[str, Any]]:
        """
        Return hex grid cells as list of dicts.
        bounds = (min_lat, min_lng, max_lat, max_lng) or None for all.
        """
        cells = []
        for cell in self._cells.values():
            if cell.resolution != resolution:
                continue
            if bounds:
                min_lat, min_lng, max_lat, max_lng = bounds
                if not (min_lat <= cell.center_lat <= max_lat and min_lng <= cell.center_lng <= max_lng):
                    continue
            cells.append(cell.to_dict())
        return cells

    def aggregate_up(self, from_resolution: int, to_resolution: int) -> List[HexCell]:
        """Aggregate fine-resolution cells to coarser resolution."""
        if to_resolution >= from_resolution:
            return []
        parent_map: Dict[str, List[HexCell]] = {}
        for cell in self._cells.values():
            if cell.resolution != from_resolution:
                continue
            parent_idx = self.lat_lng_to_cell(cell.center_lat, cell.center_lng, to_resolution)
            parent_map.setdefault(parent_idx, []).append(cell)

        result = []
        for parent_idx, children in parent_map.items():
            # Aggregate: weighted average by population, max for risk vector
            total_pop = sum(c.population for c in children)
            total_assets = sum(c.asset_count for c in children)
            agg_vector = XRiskVector(
                p_agi=max(c.risk_vector.p_agi for c in children),
                p_bio=max(c.risk_vector.p_bio for c in children),
                p_nuclear=max(c.risk_vector.p_nuclear for c in children),
                p_climate=max(c.risk_vector.p_climate for c in children),
                p_financial=max(c.risk_vector.p_financial for c in children),
            )
            agg_vector.compute_total()
            center = self._cell_center(parent_idx, children[0].center_lat, children[0].center_lng)
            parent_cell = HexCell(
                h3_index=parent_idx,
                resolution=to_resolution,
                center_lat=center[0],
                center_lng=center[1],
                risk_vector=agg_vector,
                risk_score=agg_vector.p_total,
                risk_level=_risk_level(agg_vector.p_total),
                color=_risk_color(agg_vector.p_total),
                population=total_pop,
                asset_count=total_assets,
            )
            self._cells[parent_idx] = parent_cell
            result.append(parent_cell)
        return result

    def seed_from_cities(self, cities: List[Dict[str, Any]], resolution: int = 5) -> int:
        """Seed hex grid from cities database. Returns count of cells created."""
        count = 0
        for city in cities:
            lat = city.get("lat", 0)
            lng = city.get("lng", 0)
            known_risks = city.get("known_risks", {})
            pop = city.get("population", 100_000)
            assets = city.get("assets_count", 0)
            exposure = city.get("exposure", 0)

            # p_climate: flood, hurricane, typhoon, monsoon, cyclone, sea_level (so Zone Risk Vector differs by region)
            climate_raw = (
                known_risks.get("flood", 0) * 0.5
                + known_risks.get("hurricane", 0) * 0.35
                + known_risks.get("typhoon", 0) * 0.35
                + known_risks.get("monsoon", 0) * 0.4
                + known_risks.get("cyclone", 0) * 0.35
                + known_risks.get("sea_level", 0) * 0.4
                + known_risks.get("wildfire", 0) * 0.25
                + known_risks.get("drought", 0) * 0.2
            )
            vec = XRiskVector(
                p_climate=min(1.0, climate_raw),
                p_financial=min(1.0, exposure / 100) * 0.35,
                p_nuclear=known_risks.get("nuclear", 0),
                p_agi=known_risks.get("ai", 0),
                p_bio=known_risks.get("pandemic", 0),
            )
            vec.compute_total()
            self.assign_risk(lat, lng, vec, resolution, population=pop, asset_count=assets)
            count += 1
        return count

    def get_cell(self, h3_index: str) -> Optional[HexCell]:
        """Get a single cell by H3 index."""
        return self._cells.get(h3_index)

    def get_boundary_for_index(self, h3_index: str) -> Optional[List[List[float]]]:
        """Get hex boundary [[lat, lng], ...] for any H3 index (for risk-at-time viz)."""
        if HAS_H3 and not h3_index.startswith("fb_"):
            try:
                boundary = h3.cell_to_boundary(h3_index)
                return [[lat, lng] for lat, lng in boundary]
            except Exception:
                pass
        return None

    def get_stats(self) -> Dict[str, Any]:
        """Return summary statistics."""
        by_res: Dict[int, int] = {}
        for c in self._cells.values():
            by_res[c.resolution] = by_res.get(c.resolution, 0) + 1
        return {
            "total_cells": len(self._cells),
            "by_resolution": by_res,
            "has_h3": HAS_H3,
        }

    def _cell_center(self, idx: str, fallback_lat: float, fallback_lng: float) -> Tuple[float, float]:
        """Get cell center from H3 or fallback to provided coords."""
        if HAS_H3 and not idx.startswith("fb_"):
            try:
                lat, lng = h3.cell_to_latlng(idx)
                return (lat, lng)
            except Exception:
                pass
        return (fallback_lat, fallback_lng)


# Global service instance
h3_spatial_service = H3SpatialService()
