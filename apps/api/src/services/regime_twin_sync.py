"""
Regime-Aware Twin Sync
======================

Syncs Digital Twin parameters to the current market regime.

For each twin + asset pair, computes base_pd/base_lgd from asset data (live):
- Explicit: asset.probability_of_default / loss_given_default when set
- Else from risk scores (climate, physical, network) when present
- Else from asset_type typicals
- Else default 3% / 45%

Then: pd_override = base_pd * regime.pd_stress_factor, same for LGD.
Stores the result as JSON in DigitalTwin.regime_context.
"""

from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Optional, Tuple

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

logger = logging.getLogger(__name__)

# Typical base PD/LGD by asset type (when no explicit or risk-based value)
# PD in 0..1, LGD in 0..1 — variety so regime overlay differs per asset
_TYPE_BASE_PD_LGD: dict[str, Tuple[float, float]] = {
    "commercial_office": (0.028, 0.44),
    "commercial_retail": (0.032, 0.48),
    "industrial": (0.038, 0.52),
    "residential_multi": (0.022, 0.42),
    "residential_single": (0.026, 0.46),
    "infrastructure_power": (0.024, 0.40),
    "infrastructure_water": (0.020, 0.38),
    "infrastructure_transport": (0.030, 0.45),
    "energy_solar": (0.034, 0.50),
    "energy_wind": (0.036, 0.48),
    "energy_conventional": (0.040, 0.52),
    "logistics": (0.030, 0.46),
    "data_center": (0.026, 0.44),
    "healthcare": (0.024, 0.42),
    "education": (0.022, 0.40),
    "other": (0.030, 0.45),
}


def _derive_base_pd_lgd(asset) -> Tuple[float, float, str]:
    """
    Derive base PD and LGD from asset (live per-asset values).
    Returns (base_pd, base_lgd, source) with source in explicit|risk|type|default.
    """
    explicit_pd = getattr(asset, "probability_of_default", None)
    explicit_lgd = getattr(asset, "loss_given_default", None)
    if explicit_pd is not None and explicit_lgd is not None:
        return (
            max(0.001, min(0.99, float(explicit_pd))),
            max(0.01, min(0.95, float(explicit_lgd))),
            "explicit",
        )

    base_pd = max(0.001, min(0.99, float(explicit_pd))) if explicit_pd is not None else None
    base_lgd = max(0.01, min(0.95, float(explicit_lgd))) if explicit_lgd is not None else None

    # From risk scores (0–100) when at least one present
    climate = getattr(asset, "climate_risk_score", None)
    physical = getattr(asset, "physical_risk_score", None)
    network = getattr(asset, "network_risk_score", None)
    scores = [x for x in (climate, physical, network) if x is not None]
    if scores:
        risk_norm = sum(scores) / (len(scores) * 100.0)  # 0..1
        risk_norm = max(0.0, min(1.0, risk_norm))
        from_risk_pd = 0.01 + risk_norm * 0.11
        from_risk_lgd = 0.32 + risk_norm * 0.38
        return (
            base_pd if base_pd is not None else from_risk_pd,
            base_lgd if base_lgd is not None else from_risk_lgd,
            "risk",
        )

    # From asset type (plus small per-asset spread so same-type assets differ)
    atype = (getattr(asset, "asset_type", None) or "other").lower()
    type_pd, type_lgd = _TYPE_BASE_PD_LGD.get(atype, _TYPE_BASE_PD_LGD["other"])
    aid = str(getattr(asset, "id", "") or "")
    # Deterministic per-asset spread so same-type assets differ (±~0.5% PD, ±~2% LGD)
    h = sum(ord(c) for c in aid) % 1000
    spread_pd = (h / 1000.0 - 0.5) * 0.01
    spread_lgd = (h / 1000.0 - 0.5) * 0.04
    type_pd = max(0.008, min(0.15, type_pd + spread_pd))
    type_lgd = max(0.30, min(0.75, type_lgd + spread_lgd))
    return (
        base_pd if base_pd is not None else type_pd,
        base_lgd if base_lgd is not None else type_lgd,
        "type",
    )


async def sync_twins_to_regime(
    db: AsyncSession,
    regime_name: str,
) -> int:
    """
    Bulk-update all Digital Twins to reflect a given market regime.

    Args:
        db: Async database session.
        regime_name: One of bull, late_cycle, crisis, stagflation.

    Returns:
        Number of twins updated.
    """
    from src.models.digital_twin import DigitalTwin
    from src.models.asset import Asset
    from src.services.regime_engine import MarketRegime, get_regime_params

    regime = MarketRegime(regime_name)
    rp = get_regime_params(regime)

    result = await db.execute(
        select(DigitalTwin, Asset)
        .where(DigitalTwin.asset_id == Asset.id)
        .order_by(Asset.id)
    )
    pairs = result.all()

    if not pairs:
        logger.info("No digital twin / asset pairs found to sync")
        return 0

    for twin, asset in pairs:
        base_pd, base_lgd, pd_lgd_source = _derive_base_pd_lgd(asset)
        used_asset_pd_lgd = pd_lgd_source == "explicit"

        pd_override = min(base_pd * rp.pd_stress_factor, 0.99)
        lgd_override = min(base_lgd * rp.lgd_stress_factor, 0.95)

        context = {
            "regime": regime_name,
            "regime_label": rp.label,
            "energy_cost_multiplier": rp.energy_cost_multiplier,
            "transport_delay_factor": rp.transport_delay_factor,
            "pd_override": round(pd_override, 6),
            "lgd_override": round(lgd_override, 4),
            "base_pd": round(base_pd, 6),
            "base_lgd": round(base_lgd, 4),
            "used_asset_pd_lgd": used_asset_pd_lgd,
            "pd_lgd_source": pd_lgd_source,
            "volatility_multiplier": rp.volatility_multiplier,
            "recovery_speed_factor": rp.recovery_speed_factor,
            "updated_at": datetime.utcnow().isoformat(),
        }
        twin.regime_context = json.dumps(context)

    await db.commit()
    logger.info("Synced %d digital twins to regime '%s'", len(pairs), regime_name)
    return len(pairs)


async def get_twin_regime_context(
    db: AsyncSession,
    twin_id: str,
) -> Optional[dict]:
    """Return the parsed regime_context for a single twin, or None."""
    from src.models.digital_twin import DigitalTwin

    result = await db.execute(
        select(DigitalTwin).where(DigitalTwin.id == twin_id)
    )
    twin = result.scalar_one_or_none()
    if not twin or not twin.regime_context:
        return None
    try:
        return json.loads(twin.regime_context)
    except (json.JSONDecodeError, TypeError):
        return None
