"""
TimescaleDB Time-Series Service.

Stores and queries risk snapshots over time for temporal replay and trend analysis.
Uses hypertables for efficient time-range queries when ENABLE_TIMESCALE=true.

When TimescaleDB is not available, falls back to in-memory time-series storage.
"""

from __future__ import annotations

import logging
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import text

logger = logging.getLogger(__name__)


def _get_engine():
    """Lazy import to avoid circular dependency; returns TimescaleDB engine when enabled."""
    try:
        from src.core.config import settings
        from src.core.database import timescale_engine
        if getattr(settings, "enable_timescale", False) and timescale_engine is not None:
            return timescale_engine
    except Exception:
        pass
    return None


@dataclass
class RiskSnapshot:
    """A single risk snapshot at a point in time."""
    timestamp: datetime
    h3_cell: str
    risk_score: float
    risk_level: str
    p_agi: float = 0.0
    p_bio: float = 0.0
    p_nuclear: float = 0.0
    p_climate: float = 0.0
    p_financial: float = 0.0
    p_total: float = 0.0
    source_module: str = ""
    event_id: Optional[str] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "h3_cell": self.h3_cell,
            "risk_score": self.risk_score,
            "risk_level": self.risk_level,
            "risk_vector": {
                "p_agi": self.p_agi,
                "p_bio": self.p_bio,
                "p_nuclear": self.p_nuclear,
                "p_climate": self.p_climate,
                "p_financial": self.p_financial,
                "p_total": self.p_total,
            },
            "source_module": self.source_module,
            "event_id": self.event_id,
        }


@dataclass
class TimelinePoint:
    """Aggregated point on a risk timeline."""
    timestamp: datetime
    avg_risk: float
    max_risk: float
    min_risk: float
    snapshot_count: int
    dominant_domain: str = "climate"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "timestamp": self.timestamp.isoformat(),
            "avg_risk": round(self.avg_risk, 4),
            "max_risk": round(self.max_risk, 4),
            "min_risk": round(self.min_risk, 4),
            "snapshot_count": self.snapshot_count,
            "dominant_domain": self.dominant_domain,
        }


class TimescaleService:
    """
    Time-series risk storage and query service.

    Falls back to in-memory storage when TimescaleDB is not available.
    """

    def __init__(self):
        self._snapshots: Dict[str, List[RiskSnapshot]] = defaultdict(list)
        self._max_in_memory = 100_000  # Cap in-memory storage

    def record_snapshot(
        self,
        h3_cell: str,
        risk_score: float,
        risk_level: str = "medium",
        p_agi: float = 0.0,
        p_bio: float = 0.0,
        p_nuclear: float = 0.0,
        p_climate: float = 0.0,
        p_financial: float = 0.0,
        source_module: str = "",
        event_id: Optional[str] = None,
        timestamp: Optional[datetime] = None,
    ) -> RiskSnapshot:
        """Record a risk snapshot."""
        ts = timestamp or datetime.now(timezone.utc)
        p_total = 1.0 - (1 - p_agi) * (1 - p_bio) * (1 - p_nuclear) * (1 - p_climate) * (1 - p_financial)
        snap = RiskSnapshot(
            timestamp=ts,
            h3_cell=h3_cell,
            risk_score=risk_score,
            risk_level=risk_level,
            p_agi=p_agi,
            p_bio=p_bio,
            p_nuclear=p_nuclear,
            p_climate=p_climate,
            p_financial=p_financial,
            p_total=round(p_total, 6),
            source_module=source_module,
            event_id=event_id,
        )
        cell_snaps = self._snapshots[h3_cell]
        cell_snaps.append(snap)
        # Trim oldest if over limit
        if len(cell_snaps) > 10_000:
            self._snapshots[h3_cell] = cell_snaps[-5_000:]
        return snap

    def get_timeline(
        self,
        h3_cell: str,
        from_time: Optional[datetime] = None,
        to_time: Optional[datetime] = None,
        bucket_hours: int = 24,
    ) -> List[TimelinePoint]:
        """Get aggregated timeline for a cell."""
        snaps = self._snapshots.get(h3_cell, [])
        if from_time:
            snaps = [s for s in snaps if s.timestamp >= from_time]
        if to_time:
            snaps = [s for s in snaps if s.timestamp <= to_time]
        if not snaps:
            return []

        # Bucket by time
        buckets: Dict[datetime, List[RiskSnapshot]] = defaultdict(list)
        for s in snaps:
            bucket_ts = s.timestamp.replace(
                hour=(s.timestamp.hour // max(1, bucket_hours)) * bucket_hours,
                minute=0, second=0, microsecond=0,
            )
            buckets[bucket_ts].append(s)

        result = []
        for ts in sorted(buckets.keys()):
            bs = buckets[ts]
            scores = [s.risk_score for s in bs]
            # Find dominant domain
            domain_sums = {"agi": 0, "bio": 0, "nuclear": 0, "climate": 0, "financial": 0}
            for s in bs:
                domain_sums["agi"] += s.p_agi
                domain_sums["bio"] += s.p_bio
                domain_sums["nuclear"] += s.p_nuclear
                domain_sums["climate"] += s.p_climate
                domain_sums["financial"] += s.p_financial
            dominant = max(domain_sums, key=domain_sums.get)
            result.append(TimelinePoint(
                timestamp=ts,
                avg_risk=sum(scores) / len(scores),
                max_risk=max(scores),
                min_risk=min(scores),
                snapshot_count=len(bs),
                dominant_domain=dominant,
            ))
        return result

    def get_snapshots(
        self,
        h3_cell: str,
        from_time: Optional[datetime] = None,
        to_time: Optional[datetime] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        """Get raw snapshots for a cell."""
        snaps = self._snapshots.get(h3_cell, [])
        if from_time:
            snaps = [s for s in snaps if s.timestamp >= from_time]
        if to_time:
            snaps = [s for s in snaps if s.timestamp <= to_time]
        return [s.to_dict() for s in snaps[-limit:]]

    def get_risk_at_time(
        self,
        timestamp: datetime,
        tolerance_hours: int = 1,
    ) -> List[Dict[str, Any]]:
        """Get all cell risk states at a specific time (for replay)."""
        result = []
        window_start = timestamp - timedelta(hours=tolerance_hours)
        window_end = timestamp + timedelta(hours=tolerance_hours)
        for h3_cell, snaps in self._snapshots.items():
            # Find closest snapshot to target time
            in_window = [s for s in snaps if window_start <= s.timestamp <= window_end]
            if in_window:
                closest = min(in_window, key=lambda s: abs((s.timestamp - timestamp).total_seconds()))
                result.append(closest.to_dict())
        return result

    def get_stats(self) -> Dict[str, Any]:
        """Return summary statistics."""
        total = sum(len(v) for v in self._snapshots.values())
        return {
            "total_snapshots": total,
            "cells_tracked": len(self._snapshots),
            "backend": "in-memory",
        }

    # ---------- Async API: use TimescaleDB when enable_timescale=True ----------

    async def record_snapshot_async(
        self,
        h3_cell: str,
        risk_score: float,
        risk_level: str = "medium",
        p_agi: float = 0.0,
        p_bio: float = 0.0,
        p_nuclear: float = 0.0,
        p_climate: float = 0.0,
        p_financial: float = 0.0,
        source_module: str = "",
        event_id: Optional[str] = None,
        timestamp: Optional[datetime] = None,
    ) -> RiskSnapshot:
        """Record a risk snapshot (writes to TimescaleDB when enabled, else in-memory)."""
        snap = self.record_snapshot(
            h3_cell=h3_cell, risk_score=risk_score, risk_level=risk_level,
            p_agi=p_agi, p_bio=p_bio, p_nuclear=p_nuclear,
            p_climate=p_climate, p_financial=p_financial,
            source_module=source_module, event_id=event_id, timestamp=timestamp,
        )
        engine = _get_engine()
        if engine is not None:
            try:
                async with engine.begin() as conn:
                    await conn.execute(
                        text("""
                            INSERT INTO risk_snapshots
                            (time, h3_cell, risk_score, risk_level, p_agi, p_bio, p_nuclear, p_climate, p_financial, p_total, source_module, event_id)
                            VALUES (:time, :h3_cell, :risk_score, :risk_level, :p_agi, :p_bio, :p_nuclear, :p_climate, :p_financial, :p_total, :source_module, :event_id)
                        """),
                        {
                            "time": snap.timestamp,
                            "h3_cell": snap.h3_cell,
                            "risk_score": snap.risk_score,
                            "risk_level": snap.risk_level,
                            "p_agi": snap.p_agi,
                            "p_bio": snap.p_bio,
                            "p_nuclear": snap.p_nuclear,
                            "p_climate": snap.p_climate,
                            "p_financial": snap.p_financial,
                            "p_total": snap.p_total,
                            "source_module": snap.source_module,
                            "event_id": snap.event_id,
                        },
                    )
            except Exception as e:
                logger.warning("TimescaleDB insert failed, snapshot kept in-memory: %s", e)
        return snap

    async def get_timeline_async(
        self,
        h3_cell: str,
        from_time: Optional[datetime] = None,
        to_time: Optional[datetime] = None,
        bucket_hours: int = 24,
    ) -> List[TimelinePoint]:
        """Get aggregated timeline for a cell (from TimescaleDB when enabled)."""
        engine = _get_engine()
        if engine is not None:
            try:
                async with engine.connect() as conn:
                    # time_bucket(interval, time) is TimescaleDB; interval e.g. '24 hours'
                    interval_str = f"{bucket_hours} hours"
                    q = text("""
                        SELECT
                            time_bucket((:interval_str)::interval, time) AS bucket,
                            AVG(risk_score)::float AS avg_risk,
                            MAX(risk_score)::float AS max_risk,
                            MIN(risk_score)::float AS min_risk,
                            COUNT(*)::int AS snapshot_count
                        FROM risk_snapshots
                        WHERE h3_cell = :h3_cell
                          AND (:ft IS NULL OR time >= :ft)
                          AND (:tt IS NULL OR time <= :tt)
                        GROUP BY 1
                        ORDER BY 1
                    """)
                    result = await conn.execute(
                        q,
                        {
                            "h3_cell": h3_cell,
                            "interval_str": interval_str,
                            "ft": from_time,
                            "tt": to_time,
                        },
                    )
                    rows = result.mappings().all()
                out = []
                for r in rows:
                    out.append(TimelinePoint(
                        timestamp=r["bucket"],
                        avg_risk=float(r["avg_risk"] or 0),
                        max_risk=float(r["max_risk"] or 0),
                        min_risk=float(r["min_risk"] or 0),
                        snapshot_count=int(r["snapshot_count"] or 0),
                        dominant_domain="climate",
                    ))
                return out
            except Exception as e:
                logger.warning("TimescaleDB timeline query failed, falling back to in-memory: %s", e)
        return self.get_timeline(h3_cell, from_time, to_time, bucket_hours)

    async def get_risk_at_time_async(
        self,
        timestamp: datetime,
        tolerance_hours: int = 1,
    ) -> List[Dict[str, Any]]:
        """Get all cell risk states at a specific time (from TimescaleDB when enabled)."""
        engine = _get_engine()
        if engine is not None:
            try:
                window_start = timestamp - timedelta(hours=tolerance_hours)
                window_end = timestamp + timedelta(hours=tolerance_hours)
                async with engine.connect() as conn:
                    # One row per h3_cell: closest snapshot to timestamp within window (distinct on h3_cell)
                    result = await conn.execute(
                        text("""
                            SELECT DISTINCT ON (h3_cell)
                                time, h3_cell, risk_score, risk_level,
                                p_agi, p_bio, p_nuclear, p_climate, p_financial, p_total,
                                source_module, event_id
                            FROM risk_snapshots
                            WHERE time >= :ws AND time <= :we
                            ORDER BY h3_cell, ABS(EXTRACT(EPOCH FROM (time - :ts)))
                        """),
                        {"ws": window_start, "we": window_end, "ts": timestamp},
                    )
                    rows = result.mappings().all()
                return [
                    {
                        "timestamp": r["time"].isoformat(),
                        "h3_cell": r["h3_cell"],
                        "risk_score": r["risk_score"],
                        "risk_level": r["risk_level"],
                        "risk_vector": {
                            "p_agi": r["p_agi"],
                            "p_bio": r["p_bio"],
                            "p_nuclear": r["p_nuclear"],
                            "p_climate": r["p_climate"],
                            "p_financial": r["p_financial"],
                            "p_total": r["p_total"],
                        },
                        "source_module": r["source_module"],
                        "event_id": r["event_id"],
                    }
                    for r in rows
                ]
            except Exception as e:
                logger.warning("TimescaleDB risk-at-time query failed, falling back to in-memory: %s", e)
        return self.get_risk_at_time(timestamp, tolerance_hours)

    async def get_stats_async(self) -> Dict[str, Any]:
        """Return summary statistics (from TimescaleDB when enabled)."""
        engine = _get_engine()
        if engine is not None:
            try:
                async with engine.connect() as conn:
                    r = await conn.execute(text("SELECT COUNT(*) AS n FROM risk_snapshots"))
                    row = r.scalar()
                    r2 = await conn.execute(text("SELECT COUNT(DISTINCT h3_cell) AS c FROM risk_snapshots"))
                    cells = r2.scalar()
                return {
                    "total_snapshots": row or 0,
                    "cells_tracked": cells or 0,
                    "backend": "timescaledb",
                }
            except Exception as e:
                logger.warning("TimescaleDB stats failed: %s", e)
        return self.get_stats()


# Global instance
timescale_service = TimescaleService()
