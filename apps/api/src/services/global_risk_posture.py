"""
Global Risk Posture — real-data aggregation for Dashboard / Command Center.

Aggregates from Asset table (and optionally latest stress test) so that
Capital at Risk, Stress Loss (P95), and Risk Zone counts reflect actual
portfolio and stress test results instead of static city-based data.
Risk Velocity (MoM) from risk_posture_snapshots table.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timedelta
from typing import Any, Dict, Optional

from sqlalchemy import and_, case, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.sql import text

from src.models.asset import Asset

logger = logging.getLogger(__name__)

SNAPSHOT_TABLE = "risk_posture_snapshots"

# Risk score is (climate + physical + network) / 3, scale 0-100
# Same thresholds as analytics/portfolio-summary
CRITICAL_THRESHOLD = 80
HIGH_THRESHOLD = 60
MEDIUM_THRESHOLD = 40


def _avg_risk_expr():
    return (
        (func.coalesce(Asset.climate_risk_score, 0) +
         func.coalesce(Asset.physical_risk_score, 0) +
         func.coalesce(Asset.network_risk_score, 0)) / 3
    )


async def get_real_aggregates(
    db: AsyncSession,
    country_code: Optional[str] = None,
    city_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Aggregate portfolio metrics from Asset table (active only).
    When country_code or city_id is set, filter assets to that country or city.
    Returns dict with total_exposure, at_risk_exposure, ...
    Returns None if no active assets (caller keeps city-based summary).
    """
    try:
        from src.data.cities import get_city

        base_where = Asset.status == "active"
        if country_code:
            base_where = and_(base_where, Asset.country_code == (country_code or "").strip().upper())
        if city_id:
            city = get_city(city_id)
            if city:
                base_where = and_(base_where, Asset.city == city.name)
            # If city_id not in CITIES_DATABASE, still filter by country if we can infer (optional)

        avg_risk = _avg_risk_expr()
        result = await db.execute(
            select(
                func.count(Asset.id).label("total_assets"),
                func.sum(Asset.current_valuation).label("total_value"),
                func.avg(Asset.climate_risk_score).label("avg_climate"),
                func.avg(Asset.physical_risk_score).label("avg_physical"),
                func.avg(Asset.network_risk_score).label("avg_network"),
                func.sum(case((avg_risk >= CRITICAL_THRESHOLD, 1), else_=0)).label("critical_count"),
                func.sum(case((and_(avg_risk >= HIGH_THRESHOLD, avg_risk < CRITICAL_THRESHOLD), 1), else_=0)).label("high_count"),
                func.sum(case((and_(avg_risk >= MEDIUM_THRESHOLD, avg_risk < HIGH_THRESHOLD), 1), else_=0)).label("medium_count"),
                func.sum(case((avg_risk < MEDIUM_THRESHOLD, 1), else_=0)).label("low_count"),
                func.sum(
                    case(
                        (avg_risk >= HIGH_THRESHOLD, func.coalesce(Asset.current_valuation, 0)),
                        else_=0,
                    )
                ).label("at_risk_value"),
            ).where(base_where)
        )
        row = result.one()
        total_assets = int(row.total_assets or 0)
        if total_assets == 0:
            return None

        total_value = float(row.total_value or 0)
        at_risk_value = float(row.at_risk_value or 0)
        # Convert to millions (frontend expects €XM)
        total_exposure_m = round(total_value / 1e6, 1)
        at_risk_exposure_m = round(at_risk_value / 1e6, 1)

        avg_climate = float(row.avg_climate or 0)
        avg_physical = float(row.avg_physical or 0)
        avg_network = float(row.avg_network or 0)
        weighted_risk = (avg_climate + avg_physical + avg_network) / 300.0  # 0-1

        return {
            "total_exposure": total_exposure_m,
            "at_risk_exposure": at_risk_exposure_m,
            "critical_count": int(row.critical_count or 0),
            "high_count": int(row.high_count or 0),
            "medium_count": int(row.medium_count or 0),
            "low_count": int(row.low_count or 0),
            "total_assets": total_assets,
            "weighted_risk": round(weighted_risk, 3),
            "total_expected_loss": None,  # filled optionally from stress test
        }
    except Exception as e:
        logger.warning("get_real_aggregates failed: %s", e)
        return None


async def get_latest_stress_loss(db: AsyncSession) -> Optional[float]:
    """
    Get total expected loss (in millions) from the most recent stress test report
    (from report_data JSON or sum of risk zones). Used as Stress Loss P95 proxy.
    """
    try:
        from src.models.stress_test import StressTest, RiskZone

        # Latest stress test by created_at
        subq = (
            select(StressTest.id)
            .order_by(StressTest.created_at.desc())
            .limit(1)
        )
        result = await db.execute(subq)
        test_id = result.scalar_one_or_none()
        if not test_id:
            return None
        # Sum expected_loss from risk_zones (stored in millions in DB for stress tests)
        sum_result = await db.execute(
            select(func.sum(RiskZone.expected_loss)).where(RiskZone.stress_test_id == test_id)
        )
        total = sum_result.scalar_one_or_none()
        if total is not None and float(total) > 0:
            # DB stores expected_loss in full currency; return millions
            return round(float(total) / 1e6, 2)
        return None
    except Exception as e:
        logger.debug("get_latest_stress_loss failed: %s", e)
        return None


async def save_snapshot(
    db: AsyncSession,
    at_risk_exposure: float,
    weighted_risk: float,
    total_expected_loss: Optional[float] = None,
    total_exposure: Optional[float] = None,
) -> None:
    """Save or update today's risk posture snapshot (one row per day). Seeds yesterday if missing so MoM is available from day one."""
    try:
        today = date.today()
        yesterday = today - timedelta(days=1)
        # Ensure we have a "previous" snapshot so get_risk_velocity_mom can return something (MoM from day one)
        check = await db.execute(
            text(f"SELECT 1 FROM {SNAPSHOT_TABLE} WHERE snapshot_date = :d LIMIT 1"),
            {"d": yesterday.isoformat()},
        )
        if check.fetchone() is None:
            await db.execute(
                text(
                    f"""
                    INSERT INTO {SNAPSHOT_TABLE} (snapshot_date, at_risk_exposure, weighted_risk, total_expected_loss, total_exposure, created_at)
                    SELECT :d, :ar, :wr, :tel, :te, :now
                    WHERE NOT EXISTS (SELECT 1 FROM {SNAPSHOT_TABLE} WHERE snapshot_date = :d)
                    """
                ),
                {
                    "d": yesterday.isoformat(),
                    "ar": at_risk_exposure,
                    "wr": weighted_risk,
                    "tel": total_expected_loss,
                    "te": total_exposure,
                    "now": datetime.utcnow().isoformat(),
                },
            )
        # SQLite: INSERT OR IGNORE for yesterday; PostgreSQL uses ON CONFLICT. Use generic upsert for today.
        await db.execute(
            text(
                f"""
                INSERT INTO {SNAPSHOT_TABLE} (snapshot_date, at_risk_exposure, weighted_risk, total_expected_loss, total_exposure, created_at)
                VALUES (:d, :ar, :wr, :tel, :te, :now)
                ON CONFLICT(snapshot_date) DO UPDATE SET
                    at_risk_exposure = excluded.at_risk_exposure,
                    weighted_risk = excluded.weighted_risk,
                    total_expected_loss = excluded.total_expected_loss,
                    total_exposure = excluded.total_exposure
                """
            ),
            {
                "d": today.isoformat(),
                "ar": at_risk_exposure,
                "wr": weighted_risk,
                "tel": total_expected_loss,
                "te": total_exposure,
                "now": datetime.utcnow().isoformat(),
            },
        )
        await db.commit()
    except Exception as e:
        logger.debug("save_snapshot failed (table may not exist yet): %s", e)
        await db.rollback()


async def get_risk_velocity_mom(db: AsyncSession) -> Optional[Dict[str, Any]]:
    """
    Get the most recent snapshot before today (last available) for MoM.
    Returns dict with risk_velocity_previous_at_risk, risk_velocity_previous_date,
    and optionally trend/forecast data from the time-series forecaster.
    """
    try:
        today = date.today()
        result = await db.execute(
            text(
                f"""
                SELECT snapshot_date, at_risk_exposure, weighted_risk
                FROM {SNAPSHOT_TABLE}
                WHERE snapshot_date < :today
                ORDER BY snapshot_date DESC
                LIMIT 1
                """
            ),
            {"today": today.isoformat()},
        )
        row = result.fetchone()
        if not row:
            return None
        prev_at_risk = float(row[1])
        if prev_at_risk <= 0:
            return None
        base = {
            "risk_velocity_previous_at_risk": round(prev_at_risk, 1),
            "risk_velocity_previous_date": row[0].isoformat() if hasattr(row[0], "isoformat") else str(row[0]),
        }

        # Try to compute real MoM / WoW / trend from snapshot history
        try:
            history = await db.execute(
                text(
                    f"""
                    SELECT snapshot_date, at_risk_exposure
                    FROM {SNAPSHOT_TABLE}
                    ORDER BY snapshot_date ASC
                    LIMIT 365
                    """
                ),
            )
            rows = history.fetchall()
            if len(rows) >= 2:
                vals = [float(r[1]) if r[1] is not None else 0.0 for r in rows]
                prev_val = vals[-2] if abs(vals[-2]) >= 1e-10 else 1.0
                simple_mom = round((vals[-1] - vals[-2]) / prev_val * 100, 1)
                base["risk_velocity_mom_pct"] = simple_mom
                if len(rows) >= 31:
                    from src.services.time_series_forecast import forecaster
                    dates = [datetime.fromisoformat(str(r[0])) if isinstance(r[0], str) else datetime.combine(r[0], datetime.min.time()) for r in rows]
                    velocity = forecaster.compute_risk_velocity(dates, vals)
                    if velocity.get("mom_pct") is not None:
                        base["risk_velocity_mom_pct"] = velocity["mom_pct"]
                    base["risk_velocity_wow_pct"] = velocity.get("wow_pct")
                    base["risk_velocity_direction"] = velocity.get("direction", "unknown")
        except Exception as e2:
            logger.debug("Velocity trend computation failed: %s", e2)

        return base
    except Exception as e:
        logger.debug("get_risk_velocity_mom failed: %s", e)
        return None
