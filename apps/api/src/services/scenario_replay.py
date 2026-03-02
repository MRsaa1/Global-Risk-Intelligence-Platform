"""
Scenario Replay Service.

Enables temporal replay of risk scenarios:
1. Reconstruct Decision Object inputs and re-run simulation
2. Time-travel: see the risk state at any past date
3. Cascade animation data for stakeholder communication
"""
from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

logger = logging.getLogger(__name__)


@dataclass
class DecisionSnapshot:
    """Snapshot of a decision for replay."""
    id: str = field(default_factory=lambda: str(uuid4()))
    decision_id: str = ""
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    source_module: str = ""
    object_type: str = ""
    object_id: str = ""
    input_snapshot: Dict[str, Any] = field(default_factory=dict)
    verdict_snapshot: Dict[str, Any] = field(default_factory=dict)
    risk_score: float = 0.0
    agent_scores: Dict[str, float] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "decision_id": self.decision_id,
            "timestamp": self.timestamp.isoformat(),
            "source_module": self.source_module,
            "object_type": self.object_type,
            "object_id": self.object_id,
            "input_snapshot": self.input_snapshot,
            "verdict_snapshot": self.verdict_snapshot,
            "risk_score": self.risk_score,
            "agent_scores": self.agent_scores,
        }


@dataclass
class CascadeFrame:
    """Single frame in a cascade animation."""
    frame_idx: int
    timestamp_offset_s: float
    nodes_active: List[str]
    edges_active: List[Tuple[str, str]]
    risk_level: float
    description: str = ""

    def to_dict(self) -> Dict[str, Any]:
        return {
            "frame_idx": self.frame_idx,
            "timestamp_offset_s": self.timestamp_offset_s,
            "nodes_active": self.nodes_active,
            "edges_active": [{"source": s, "target": t} for s, t in self.edges_active],
            "risk_level": self.risk_level,
            "description": self.description,
        }


class ScenarioReplayService:
    """Scenario replay and time-travel service."""

    def __init__(self):
        self._snapshots: List[DecisionSnapshot] = []
        self._cascade_sequences: Dict[str, List[CascadeFrame]] = {}

    def record_decision(
        self,
        decision_id: str,
        source_module: str,
        object_type: str,
        object_id: str,
        input_snapshot: Dict[str, Any],
        verdict_snapshot: Dict[str, Any],
        risk_score: float,
        agent_scores: Dict[str, float],
    ) -> DecisionSnapshot:
        """Record a decision for future replay."""
        snap = DecisionSnapshot(
            decision_id=decision_id,
            source_module=source_module,
            object_type=object_type,
            object_id=object_id,
            input_snapshot=input_snapshot,
            verdict_snapshot=verdict_snapshot,
            risk_score=risk_score,
            agent_scores=agent_scores,
        )
        self._snapshots.append(snap)
        return snap

    def replay_decision(self, decision_id: str) -> Dict[str, Any]:
        """Replay a decision by reconstructing its context."""
        snap = next((s for s in self._snapshots if s.decision_id == decision_id), None)
        if not snap:
            return {"error": f"Decision {decision_id} not found in replay history"}

        return {
            "decision": snap.to_dict(),
            "replay_status": "reconstructed",
            "can_re_run": True,
            "original_risk_score": snap.risk_score,
            "agent_scores": snap.agent_scores,
            "input_snapshot": snap.input_snapshot,
            "verdict_snapshot": snap.verdict_snapshot,
        }

    def time_travel(self, target_time: datetime, tolerance_hours: int = 1) -> Dict[str, Any]:
        """Get risk state at a specific point in time."""
        window_start = target_time - timedelta(hours=tolerance_hours)
        window_end = target_time + timedelta(hours=tolerance_hours)

        in_window = [s for s in self._snapshots if window_start <= s.timestamp <= window_end]
        closest = min(in_window, key=lambda s: abs((s.timestamp - target_time).total_seconds())) if in_window else None

        # Build state at that time
        active_by_module: Dict[str, List[Dict]] = defaultdict(list)
        for s in in_window:
            active_by_module[s.source_module].append({
                "decision_id": s.decision_id,
                "risk_score": s.risk_score,
                "object_type": s.object_type,
            })

        return {
            "target_time": target_time.isoformat(),
            "snapshots_found": len(in_window),
            "closest_snapshot": closest.to_dict() if closest else None,
            "active_by_module": dict(active_by_module),
            "aggregate_risk": sum(s.risk_score for s in in_window) / max(1, len(in_window)),
        }

    def generate_cascade_animation(
        self,
        decision_id: str,
        total_frames: int = 30,
        duration_s: float = 10.0,
    ) -> List[Dict[str, Any]]:
        """Generate cascade animation frames for stakeholder communication."""
        # Check for pre-built sequence
        if decision_id in self._cascade_sequences:
            return [f.to_dict() for f in self._cascade_sequences[decision_id]]

        # Build from decision snapshot
        snap = next((s for s in self._snapshots if s.decision_id == decision_id), None)
        if not snap:
            # Generate a demo cascade sequence
            return self._generate_demo_cascade(total_frames, duration_s)

        return self._generate_demo_cascade(total_frames, duration_s)

    _NODE_LABELS: Dict[str, str] = {
        "power_grid": "Power grid",
        "water_treatment": "Water treatment",
        "hospital": "Hospital",
        "transport": "Transport",
        "telecom": "Telecom",
        "data_center": "Data center",
        "government": "Government",
        "residential": "Residential",
    }
    _NODE_CONSEQUENCES: Dict[str, str] = {
        "power_grid": "Power supply disrupted; critical infrastructure offline.",
        "water_treatment": "Water supply at risk; no clean water for hospitals and population.",
        "hospital": "Healthcare capacity reduced; emergency response degraded.",
        "transport": "Mobility and supply chains disrupted.",
        "telecom": "Communications and data links down.",
        "data_center": "IT and government systems unavailable.",
        "government": "Coordination and public services impaired.",
        "residential": "Population at risk; safety and basic services affected.",
    }

    def _generate_demo_cascade(self, frames: int, duration: float) -> List[Dict[str, Any]]:
        """Generate demo cascade animation showing infrastructure propagation."""
        frames = int(frames)
        duration = float(duration)
        nodes = ["power_grid", "water_treatment", "hospital", "transport", "telecom", "data_center", "government", "residential"]
        edges = [
            ("power_grid", "water_treatment"),
            ("power_grid", "hospital"),
            ("power_grid", "telecom"),
            ("water_treatment", "hospital"),
            ("telecom", "data_center"),
            ("transport", "hospital"),
            ("data_center", "government"),
            ("government", "residential"),
        ]

        result = []
        for i in range(frames):
            t = i / max(1, frames - 1)
            active_count = max(1, int(t * len(nodes)))
            active_nodes = nodes[:active_count]
            prev_count = max(0, int((i - 1) / max(1, frames - 1) * len(nodes))) if i > 0 else 0
            prev_nodes = nodes[:prev_count]
            new_nodes = [n for n in active_nodes if n not in prev_nodes]
            active_edges = [(s, t_) for s, t_ in edges if s in active_nodes and t_ in active_nodes]
            risk = min(1.0, t * 1.2)

            cause_parts = []
            effect_parts = []
            if i == 0 and active_nodes:
                cause_parts.append("Initial failure")
                effect_parts.append(self._NODE_LABELS.get(active_nodes[0], active_nodes[0]))
            elif new_nodes:
                for (s, tgt) in edges:
                    if s in prev_nodes and tgt in new_nodes:
                        cause_parts.append(self._NODE_LABELS.get(s, s))
                        effect_parts.append(self._NODE_LABELS.get(tgt, tgt))
                if not cause_parts:
                    cause_parts.append(", ".join(self._NODE_LABELS.get(n, n) for n in prev_nodes[-2:]))
                    effect_parts.append(", ".join(self._NODE_LABELS.get(n, n) for n in new_nodes))

            consequences = "; ".join(
                self._NODE_CONSEQUENCES.get(n, f"{n} offline.") for n in new_nodes
            ) if new_nodes else (self._NODE_CONSEQUENCES.get(active_nodes[0], "") if active_nodes else "")

            frame_dict = CascadeFrame(
                frame_idx=i,
                timestamp_offset_s=round(t * duration, 2),
                nodes_active=active_nodes,
                edges_active=active_edges,
                risk_level=round(risk, 3),
                description=f"Stage {i+1}/{frames}: {active_count}/{len(nodes)} nodes affected",
            ).to_dict()
            frame_dict["cause"] = " → ".join(dict.fromkeys(cause_parts)) if cause_parts else "—"
            frame_dict["effect"] = ", ".join(dict.fromkeys(effect_parts)) if effect_parts else "—"
            frame_dict["consequences"] = consequences or "—"
            result.append(frame_dict)

        return result

    def generate_cascade_czml(
        self,
        decision_id: str,
        total_frames: int = 30,
        duration_s: float = 10.0,
        center_lon: float = -74.006,
        center_lat: float = 40.7128,
    ) -> List[Dict[str, Any]]:
        """
        Generate CZML document for cascade animation so Cesium can play it on the globe.
        Returns a list of CZML packets (document + one entity per cascade node with sampled position).
        """
        import math
        frames_data = self.generate_cascade_animation(decision_id, total_frames, duration_s)
        if not frames_data:
            return []
        nodes = ["power_grid", "water_treatment", "hospital", "transport", "telecom", "data_center", "government", "residential"]
        radius_deg = 0.015
        epoch = "2020-01-01T00:00:00Z"
        start_interval = "2020-01-01T00:00:00Z"
        end_interval = f"2020-01-01T00:00:{max(1, int(duration_s)):02d}Z"
        czml = [
            {
                "id": "document",
                "version": "1.0",
                "clock": {
                    "interval": f"{start_interval}/{end_interval}",
                    "currentTime": start_interval,
                    "multiplier": max(0.1, duration_s / 10.0),
                },
            },
        ]
        for node_idx, node_id in enumerate(nodes):
            angle = 2 * math.pi * node_idx / max(1, len(nodes))
            lon = center_lon + radius_deg * math.cos(angle)
            lat = center_lat + radius_deg * math.sin(angle)
            cartographic_degrees = []
            for frame in frames_data:
                t = frame.get("timestamp_offset_s", 0)
                active = node_id in frame.get("nodes_active", [])
                height = 150.0 if active else 0.0
                cartographic_degrees.extend([t, lon, lat, height])
            display_name = node_id.replace("_", " ").title()
            czml.append({
                "id": f"cascade_{node_id}",
                "name": display_name,
                "availability": f"{start_interval}/{end_interval}",
                "position": {
                    "epoch": epoch,
                    "cartographicDegrees": cartographic_degrees,
                },
                "point": {
                    "pixelSize": 14,
                    "color": {"rgba": [255, 140, 0, 255] if any(f.get("nodes_active", []) and node_id in f.get("nodes_active", []) for f in frames_data) else [100, 100, 100, 200]},
                    "outlineColor": {"rgba": [255, 255, 255, 255]},
                    "outlineWidth": 2,
                },
                "label": {
                    "text": display_name,
                    "font": "14px sans-serif",
                    "fillColor": {"rgba": [255, 255, 255, 255]},
                    "outlineColor": {"rgba": [0, 0, 0, 255]},
                    "outlineWidth": 2,
                    "verticalOrigin": "BOTTOM",
                    "pixelOffset": {"cartesian2": [0, -16]},
                    "show": True,
                },
            })
        return czml

    def generate_catalog_scenario_czml(
        self,
        scenario_id: str,
        center_lat: float = 40.7128,
        center_lon: float = -74.006,
        radius_km: float = 80.0,
        duration_months: float = 12.0,
    ) -> List[Dict[str, Any]]:
        """
        Generate CZML for a catalog scenario (no DB stress test). One synthetic zone at given center;
        impact propagates over time (T0 -> T+12m) so the 4D timeline shows visible change.
        """
        import math

        start_dt = datetime.now(timezone.utc)
        end_dt = start_dt + timedelta(days=365 * duration_months)
        epoch = start_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        interval = f"{start_dt.strftime('%Y-%m-%dT%H:%M:%SZ')}/{end_dt.strftime('%Y-%m-%dT%H:%M:%SZ')}"

        num_points = 16
        positions: List[float] = []
        for i in range(num_points):
            angle = 2 * math.pi * i / num_points
            lat_rad = math.radians(center_lat)
            dlat = (radius_km / 111.0) * math.cos(angle)
            dlon = (radius_km / (111.0 * math.cos(lat_rad))) * math.sin(angle)
            positions.extend([center_lon + dlon, center_lat + dlat, 0.0])

        color_samples: List[Any] = []
        height_samples: List[Any] = []
        # Low extrusion (max 25m) so zone looks like a flat disk, not a line into space
        for _label, t_frac, loss_share in self.STRESS_TEST_IMPACT_TIMELINE:
            t_dt = start_dt + timedelta(days=365 * t_frac)
            t_str = t_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
            alpha = int(230 * loss_share) if loss_share > 0 else 0
            color_samples.extend([t_str, 249, 115, 22, max(1, alpha)])
            height_samples.extend([t_str, min(25.0, max(2, 20 * loss_share))])

        czml: List[Dict[str, Any]] = [
            {
                "id": "document",
                "version": "1.0",
                "clock": {
                    "interval": interval,
                    "currentTime": epoch,
                    "multiplier": 3600,
                },
            },
            {
                "id": f"catalog_zone_{scenario_id}",
                "name": f"Scenario: {scenario_id}",
                "availability": interval,
                "polygon": {
                    "positions": {"cartographicDegrees": positions},
                    "height": 18,
                    "extrudedHeight": height_samples,
                    "material": {"solidColor": {"color": {"rgba": color_samples}}},
                    "outline": True,
                    "outlineColor": {"rgba": [255, 255, 255, 200]},
                    "outlineWidth": 2,
                },
                "label": {"show": False},
            },
        ]
        return czml

    # Impact timeline keyframes (loss_share) from stress_report_metrics — used for 4D CZML
    STRESS_TEST_IMPACT_TIMELINE = [
        ("T+0h", 0.0, 0.17),
        ("T+24h", 1 / 24.0, 0.33),
        ("T+72h", 72 / (24.0 * 365), 0.45),
        ("T+1w", 7 / 365.0, 0.67),
        ("T+1m", 1 / 12.0, 0.85),
        ("T+6m", 6 / 12.0, 0.95),
        ("T+12m", 1.0, 1.0),
    ]

    def generate_stress_test_czml(
        self,
        stress_test: Any,
        zones: List[Any],
        duration_months: float = 12.0,
    ) -> List[Dict[str, Any]]:
        """
        Generate CZML document for stress test zones with time-varying propagation (T0 -> T+12m).
        Each zone is an extruded polygon with time-varying color and height based on impact_timeline.
        """
        import json
        import math

        if not zones:
            start_dt = getattr(stress_test, "created_at", None) or datetime.now(timezone.utc)
            if start_dt.tzinfo is None:
                start_dt = start_dt.replace(tzinfo=timezone.utc)
            end_dt = start_dt + timedelta(days=365)
            return [
                {
                    "id": "document",
                    "version": "1.0",
                    "clock": {
                        "interval": f"{start_dt.strftime('%Y-%m-%dT%H:%M:%SZ')}/{end_dt.strftime('%Y-%m-%dT%H:%M:%SZ')}",
                        "currentTime": start_dt.strftime("%Y-%m-%dT%H:%M:%SZ"),
                        "multiplier": 3600,
                    },
                },
            ]

        start_dt = getattr(stress_test, "created_at", None) or datetime.now(timezone.utc)
        if start_dt.tzinfo is None:
            start_dt = start_dt.replace(tzinfo=timezone.utc)
        end_dt = start_dt + timedelta(days=365 * duration_months)
        epoch = start_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        interval = f"{start_dt.strftime('%Y-%m-%dT%H:%M:%SZ')}/{end_dt.strftime('%Y-%m-%dT%H:%M:%SZ')}"

        def zone_level_to_rgba(level: str) -> List[int]:
            level_lower = (level or "medium").lower()
            if level_lower == "critical":
                return [239, 68, 68, 180]
            if level_lower == "high":
                return [249, 115, 22, 180]
            if level_lower == "medium":
                return [234, 179, 8, 180]
            return [34, 197, 94, 150]

        # Minimum radius (km) for CZML so zones are visible on globe instead of shrinking to a point
        MIN_DISPLAY_RADIUS_KM = 1.2

        def polygon_to_cartographic_degrees(polygon_json: Optional[str], clat: float, clon: float, radius_km: Optional[float]) -> List[float]:
            if polygon_json:
                try:
                    data = json.loads(polygon_json)
                    coords = data if isinstance(data, list) else (data.get("coordinates", [[]]) or [[]])[0]
                    if isinstance(coords, list) and len(coords) >= 3:
                        out = []
                        for pt in coords:
                            if isinstance(pt, (list, tuple)) and len(pt) >= 2:
                                out.extend([pt[0], pt[1], 0.0])
                        if out:
                            return out
                except (json.JSONDecodeError, TypeError, KeyError):
                    pass
            if clat is not None and clon is not None:
                r_km = (radius_km and radius_km > 0) and float(radius_km) or 5.0
                r_km = max(r_km, MIN_DISPLAY_RADIUS_KM)
                num_points = 16
                out = []
                for i in range(num_points):
                    angle = 2 * math.pi * i / num_points
                    lat_rad = math.radians(clat)
                    lon_rad = math.radians(clon)
                    dlat = (r_km / 111.0) * math.cos(angle)
                    dlon = (r_km / (111.0 * math.cos(lat_rad))) * math.sin(angle)
                    out.extend([clon + dlon, clat + dlat, 0.0])
                return out
            return [clon or 0.0, clat or 0.0, 0.0]

        czml: List[Dict[str, Any]] = [
            {
                "id": "document",
                "version": "1.0",
                "clock": {
                    "interval": interval,
                    "currentTime": epoch,
                    "multiplier": 3600,
                    "range": "CLAMPED",
                },
            },
        ]

        for idx, zone in enumerate(zones):
            zid = getattr(zone, "id", f"zone_{idx}")
            name = getattr(zone, "name", None) or f"Zone {idx + 1}"
            zone_level = getattr(zone, "zone_level", "medium") or "medium"
            expected_loss = float(getattr(zone, "expected_loss", 0) or 0)
            clat = getattr(zone, "center_latitude", None)
            clon = getattr(zone, "center_longitude", None)
            radius_km = getattr(zone, "radius_km", None)
            poly_json = getattr(zone, "polygon", None)

            positions = polygon_to_cartographic_degrees(poly_json, clat or 0.0, clon or 0.0, radius_km)
            if len(positions) < 9:
                continue

            base_rgba = zone_level_to_rgba(zone_level)
            color_samples: List[Any] = []
            height_samples: List[Any] = []
            # Keep extrusion low (max 25m) so zones look like flat disks, not a "line into space"
            max_extrude_m = 25.0
            for _label, t_frac, loss_share in self.STRESS_TEST_IMPACT_TIMELINE:
                t_dt = start_dt + timedelta(days=365 * t_frac)
                t_str = t_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
                alpha = int(base_rgba[3] * loss_share) if loss_share > 0 else 0
                color_samples.extend([t_str, base_rgba[0], base_rgba[1], base_rgba[2], max(1, alpha)])
                extrude_m = min(max_extrude_m, max(2, 20 * loss_share))
                height_samples.extend([t_str, extrude_m])

            # Height 95m above ellipsoid so zone is visible above terrain (same as static zone entities)
            entity: Dict[str, Any] = {
                "id": f"stress_zone_{zid}",
                "name": name,
                "availability": interval,
                "polygon": {
                    "positions": {"cartographicDegrees": positions},
                    "height": 95,
                    "extrudedHeight": height_samples,
                    "material": {"solidColor": {"color": {"rgba": color_samples}}},
                    "outline": True,
                    "outlineColor": {"rgba": [255, 255, 255, 200]},
                    "outlineWidth": 2,
                },
                "label": {"show": False},
            }
            czml.append(entity)

        return czml

    def get_decision_history(
        self,
        source_module: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Get decision history for replay listing."""
        snaps = self._snapshots
        if source_module:
            snaps = [s for s in snaps if s.source_module == source_module]
        return [s.to_dict() for s in snaps[-limit:]]

    def get_stats(self) -> Dict[str, Any]:
        """Get replay service statistics."""
        by_module = defaultdict(int)
        for s in self._snapshots:
            by_module[s.source_module] += 1
        return {
            "total_snapshots": len(self._snapshots),
            "by_module": dict(by_module),
            "cascade_sequences": len(self._cascade_sequences),
        }


    async def time_travel_from_db(
        self,
        target_date: str,
        db_session: Any,
    ) -> Dict[str, Any]:
        """
        Time-travel using real data from risk_posture_snapshots and stress tests.

        Args:
            target_date: ISO date string (YYYY-MM-DD)
            db_session: AsyncSession for DB queries
        """
        from sqlalchemy import text as sql_text

        result: Dict[str, Any] = {
            "target_date": target_date,
            "snapshot": None,
            "stress_tests_active": [],
            "risk_score_at_date": None,
            "comparison_to_today": None,
        }

        try:
            # Get snapshot for that date
            row = await db_session.execute(
                sql_text(
                    "SELECT snapshot_date, at_risk_exposure, weighted_risk, total_expected_loss, total_exposure "
                    "FROM risk_posture_snapshots "
                    "WHERE snapshot_date <= :d ORDER BY snapshot_date DESC LIMIT 1"
                ),
                {"d": target_date},
            )
            snap = row.fetchone()
            if snap:
                result["snapshot"] = {
                    "date": str(snap[0]),
                    "at_risk_exposure": float(snap[1]) if snap[1] else 0,
                    "weighted_risk": float(snap[2]) if snap[2] else 0,
                    "total_expected_loss": float(snap[3]) if snap[3] else None,
                    "total_exposure": float(snap[4]) if snap[4] else None,
                }
                result["risk_score_at_date"] = float(snap[2]) if snap[2] else None

            # Get stress tests created around that date
            try:
                tests = await db_session.execute(
                    sql_text(
                        "SELECT id, name, status, created_at FROM stress_tests "
                        "WHERE DATE(created_at) <= :d ORDER BY created_at DESC LIMIT 5"
                    ),
                    {"d": target_date},
                )
                for t in tests.fetchall():
                    result["stress_tests_active"].append({
                        "id": str(t[0]),
                        "name": str(t[1]),
                        "status": str(t[2]),
                        "created_at": str(t[3]),
                    })
            except Exception:
                pass

            # Compare with today's snapshot
            today_row = await db_session.execute(
                sql_text(
                    "SELECT at_risk_exposure, weighted_risk FROM risk_posture_snapshots "
                    "ORDER BY snapshot_date DESC LIMIT 1"
                ),
            )
            today = today_row.fetchone()
            if today and snap:
                past_risk = float(snap[1]) if snap[1] else 0
                current_risk = float(today[0]) if today[0] else 0
                if past_risk > 0:
                    result["comparison_to_today"] = {
                        "at_risk_change_pct": round((current_risk - past_risk) / past_risk * 100, 1),
                        "current_at_risk": current_risk,
                        "past_at_risk": past_risk,
                        "direction": "increased" if current_risk > past_risk else "decreased" if current_risk < past_risk else "unchanged",
                    }

        except Exception as e:
            logger.warning("time_travel_from_db failed: %s", e)
            result["error"] = str(e)

        # Also include in-memory snapshots near that date
        in_memory = self.time_travel(
            datetime.fromisoformat(target_date),
            tolerance_hours=24,
        )
        result["in_memory_decisions"] = in_memory.get("snapshots_found", 0)
        result["aggregate_risk"] = in_memory.get("aggregate_risk", 0)

        return result


# Global instance
replay_service = ScenarioReplayService()
