"""
Cross-Track Synergy Service.

Connects Track B (local adaptation observations) with Track A (global risk models).
Uses DB for persistence (field_observations, calibration_results).
"""
from __future__ import annotations

import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.field_observation import CalibrationResult as CalibrationResultModel
from src.models.field_observation import FieldObservation as FieldObservationModel

logger = logging.getLogger(__name__)


def _observation_to_dict(row: FieldObservationModel) -> Dict[str, Any]:
    return {
        "id": row.id,
        "timestamp": row.timestamp.isoformat() if row.timestamp else None,
        "city": row.city,
        "h3_cell": row.h3_cell or "",
        "observation_type": row.observation_type,
        "predicted_severity": row.predicted_severity,
        "observed_severity": row.observed_severity,
        "predicted_loss_m": row.predicted_loss_m,
        "observed_loss_m": row.observed_loss_m,
        "adaptation_measure_id": row.adaptation_measure_id,
        "adaptation_effectiveness_observed": row.adaptation_effectiveness_observed,
        "population_affected": row.population_affected,
        "notes": row.notes or "",
    }


def _calibration_to_dict(row: CalibrationResultModel) -> Dict[str, Any]:
    return {
        "model_name": row.model_name,
        "observations_used": row.observations_used,
        "mean_absolute_error": round(row.mean_absolute_error, 4),
        "bias": round(row.bias, 4),
        "r_squared": round(row.r_squared, 4),
        "recalibration_factor": round(row.recalibration_factor, 4),
        "recommendation": row.recommendation,
    }


async def record_observation(
    db: AsyncSession,
    city: str,
    observation_type: str,
    predicted_severity: float,
    observed_severity: float,
    predicted_loss_m: float = 0.0,
    observed_loss_m: float = 0.0,
    h3_cell: str = "",
    adaptation_measure_id: Optional[str] = None,
    adaptation_effectiveness: Optional[float] = None,
    population_affected: int = 0,
    notes: str = "",
    stress_test_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Record a field observation from Track B (persisted to DB)."""
    obs = FieldObservationModel(
        city=city,
        h3_cell=h3_cell,
        observation_type=observation_type,
        predicted_severity=predicted_severity,
        observed_severity=observed_severity,
        predicted_loss_m=predicted_loss_m,
        observed_loss_m=observed_loss_m,
        adaptation_measure_id=adaptation_measure_id,
        adaptation_effectiveness_observed=adaptation_effectiveness,
        population_affected=population_affected,
        notes=notes,
        stress_test_id=stress_test_id,
    )
    db.add(obs)
    await db.flush()
    await db.refresh(obs)
    return _observation_to_dict(obs)


async def get_observations(
    db: AsyncSession,
    city: Optional[str] = None,
    observation_type: Optional[str] = None,
    limit: int = 100,
) -> List[Dict[str, Any]]:
    """Get recorded observations from DB."""
    q = select(FieldObservationModel).order_by(FieldObservationModel.timestamp.desc()).limit(limit)
    if city:
        q = q.where(FieldObservationModel.city.ilike(city))
    if observation_type:
        q = q.where(FieldObservationModel.observation_type == observation_type)
    result = await db.execute(q)
    rows = result.scalars().all()
    return [_observation_to_dict(r) for r in rows]


def _trigger_from_observation(obs: FieldObservationModel) -> Optional[Dict[str, Any]]:
    err = abs(obs.predicted_severity - obs.observed_severity) / max(0.01, obs.predicted_severity)
    if err <= 0.3:
        return None
    return {
        "observation_id": obs.id,
        "city": obs.city,
        "error_pct": round(err * 100, 1),
        "timestamp": obs.timestamp.isoformat() if obs.timestamp else None,
        "message": f"Model error {err*100:.1f}% for {obs.observation_type} in {obs.city} — recalibration recommended",
    }


async def get_recalibration_triggers(db: AsyncSession) -> List[Dict[str, Any]]:
    """Get observations that triggered recalibration (>30% error)."""
    result = await db.execute(
        select(FieldObservationModel).order_by(FieldObservationModel.timestamp.desc())
    )
    rows = result.scalars().all()
    triggers = []
    for r in rows:
        t = _trigger_from_observation(r)
        if t:
            triggers.append(t)
    return triggers


async def run_calibration(db: AsyncSession, model_name: str = "stress_test") -> Dict[str, Any]:
    """Run observed vs predicted comparison and persist calibration result."""
    result = await db.execute(select(FieldObservationModel))
    observations = list(result.scalars().all())
    if not observations:
        cr = CalibrationResultModel(
            model_name=model_name,
            observations_used=0,
            mean_absolute_error=0.0,
            bias=0.0,
            r_squared=0.0,
            recalibration_factor=1.0,
            recommendation="Insufficient data for calibration",
        )
        db.add(cr)
        await db.flush()
        return _calibration_to_dict(cr)

    errors = [abs(o.predicted_severity - o.observed_severity) for o in observations]
    biases = [o.predicted_severity - o.observed_severity for o in observations]
    mae = sum(errors) / len(errors)
    mean_bias = sum(biases) / len(biases)
    mean_observed = sum(o.observed_severity for o in observations) / len(observations)
    ss_res = sum((o.observed_severity - o.predicted_severity) ** 2 for o in observations)
    ss_tot = sum((o.observed_severity - mean_observed) ** 2 for o in observations)
    r_squared = 1 - (ss_res / max(0.001, ss_tot))
    if mean_bias > 0.1:
        recal = 1.0 - mean_bias * 0.5
    elif mean_bias < -0.1:
        recal = 1.0 + abs(mean_bias) * 0.5
    else:
        recal = 1.0
    if mae > 0.3:
        rec = "URGENT: Model significantly underperforming — full recalibration needed"
    elif mae > 0.15:
        rec = "Model moderate drift detected — incremental recalibration recommended"
    else:
        rec = "Model performing within acceptable bounds — no recalibration needed"

    cr = CalibrationResultModel(
        model_name=model_name,
        observations_used=len(observations),
        mean_absolute_error=mae,
        bias=mean_bias,
        r_squared=r_squared,
        recalibration_factor=recal,
        recommendation=rec,
    )
    db.add(cr)
    await db.flush()
    return _calibration_to_dict(cr)


async def get_adaptation_analytics(db: AsyncSession) -> Dict[str, Any]:
    """Aggregate adaptation effectiveness from observations."""
    result = await db.execute(select(FieldObservationModel))
    rows = result.scalars().all()
    by_measure: Dict[str, List[float]] = defaultdict(list)
    for o in rows:
        if o.adaptation_measure_id and o.adaptation_effectiveness_observed is not None:
            by_measure[o.adaptation_measure_id].append(o.adaptation_effectiveness_observed)
    measure_stats = {}
    for measure_id, values in by_measure.items():
        measure_stats[measure_id] = {
            "observations": len(values),
            "avg_effectiveness": round(sum(values) / len(values), 3),
            "min_effectiveness": round(min(values), 3),
            "max_effectiveness": round(max(values), 3),
        }
    return {
        "total_observations": len(rows),
        "measures_tracked": len(by_measure),
        "measure_statistics": measure_stats,
    }


async def get_dashboard(db: AsyncSession) -> Dict[str, Any]:
    """Get cross-track synergy dashboard from DB."""
    obs_result = await db.execute(select(FieldObservationModel))
    observations = list(obs_result.scalars().all())
    cal_result = await db.execute(
        select(CalibrationResultModel).order_by(CalibrationResultModel.timestamp.desc()).limit(1)
    )
    latest_cal = cal_result.scalar_one_or_none()
    count_cal_result = await db.execute(select(CalibrationResultModel))
    calibrations_count = len(count_cal_result.scalars().all())

    by_type: Dict[str, int] = defaultdict(int)
    by_city: Dict[str, int] = defaultdict(int)
    for o in observations:
        by_type[o.observation_type] += 1
        by_city[o.city] += 1

    triggers = []
    for o in observations:
        t = _trigger_from_observation(o)
        if t:
            triggers.append(t)

    return {
        "total_observations": len(observations),
        "by_type": dict(by_type),
        "by_city": dict(by_city),
        "calibrations_run": calibrations_count,
        "recalibration_triggers": len(triggers),
        "adaptation_analytics": await get_adaptation_analytics(db),
        "latest_calibration": _calibration_to_dict(latest_cal) if latest_cal else None,
    }
