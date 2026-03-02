"""
Data quality contract: provenance, confidence, and freshness for risk outputs.

Every risk response should include:
- provenance: { data_sources: string[], source_id?: string, updated_at?: string }
- confidence: number in [0, 1]
- freshness (optional): age_seconds or last_updated_at for data age
"""
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional


def make_provenance(
    data_sources: Optional[List[str]] = None,
    source_id: Optional[str] = None,
    updated_at: Optional[str] = None,
) -> Dict[str, Any]:
    """Build provenance object for risk responses."""
    return {
        "data_sources": list(data_sources) if data_sources else [],
        "source_id": source_id,
        "updated_at": updated_at or datetime.now(timezone.utc).isoformat(),
    }


def make_risk_response_provenance(
    data_sources: Optional[List[str]] = None,
    source_id: Optional[str] = None,
    updated_at: Optional[str] = None,
    confidence: float = 0.7,
    freshness_seconds: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Return the standard provenance + confidence (+ optional freshness) block for risk API responses.
    Use in analytics, country_risk, digital_twins, simulations, climate_service, risk_zone_calculator.

    freshness_seconds: age of the underlying data in seconds; if provided, included as "freshness": { "age_seconds": n }.
    updated_at: ISO timestamp of last update; if not provided, defaults to now.
    """
    updated = updated_at or datetime.now(timezone.utc).isoformat()
    out: Dict[str, Any] = {
        "provenance": make_provenance(
            data_sources=data_sources,
            source_id=source_id,
            updated_at=updated,
        ),
        "confidence": min(1.0, max(0.0, confidence)),
    }
    if freshness_seconds is not None:
        out["freshness"] = {"age_seconds": round(freshness_seconds, 2)}
    return out
