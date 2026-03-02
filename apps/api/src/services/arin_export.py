"""
ARIN Export Service - Send risk data to ARIN Platform (Unified Analysis).

Exports results to https://arin.saa-alliance.com/api/v1/unified/export
so ARIN can display Global Risk as a data source in Data Sources Status.
"""
import logging
from datetime import datetime, timezone
from typing import Any, Optional

import httpx

from src.core.config import settings

logger = logging.getLogger(__name__)

SOURCE = "risk_management"


# ---------------------------------------------------------------------------
# Entity ID convention helpers
# ---------------------------------------------------------------------------

def make_zone_entity_id(city: str, scenario: str) -> str:
    """Build entity_id for a zone: ``zone_{city}_{scenario}``."""
    return f"zone_{city.lower().replace(' ', '_')}_{scenario.lower()}"


def make_asset_entity_id(asset_type: str, asset_id: str) -> str:
    """Build entity_id for an asset: ``asset_{type}_{id}``."""
    return f"asset_{asset_type.lower().replace(' ', '_')}_{asset_id}"


def make_portfolio_entity_id(portfolio_id: str) -> str:
    """Build entity_id for a portfolio: ``portfolio_{id}``."""
    return f"portfolio_{portfolio_id}"


def make_scenario_entity_id(name: str, severity: str) -> str:
    """Build entity_id for a scenario: ``scenario_{name}_{severity}``."""
    return f"scenario_{name.lower().replace(' ', '_')}_{severity.lower()}"


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _risk_level_from_score(score: float) -> str:
    """Map risk score 0-100 to risk level string."""
    if score >= 80:
        return "CRITICAL"
    if score >= 60:
        return "HIGH"
    if score >= 40:
        return "MEDIUM"
    return "LOW"


def _build_export_url() -> str:
    """Return the ARIN unified export URL from settings (prefer explicit URL, fall back to base)."""
    url = getattr(settings, "arin_export_url", None) or ""
    if url:
        return url
    base = getattr(settings, "arin_base_url", None) or ""
    if base:
        return f"{base.rstrip('/')}/api/v1/unified/export"
    return ""


def _build_auth_headers() -> dict[str, str]:
    """Return common auth headers for ARIN requests."""
    headers: dict[str, str] = {"Content-Type": "application/json"}
    api_key = getattr(settings, "arin_api_key", None) or ""
    if api_key:
        headers["X-API-Key"] = api_key
    return headers


# ---------------------------------------------------------------------------
# Core export
# ---------------------------------------------------------------------------

async def export_to_arin(
    entity_id: str,
    entity_type: str,
    analysis_type: str,
    data: dict[str, Any],
    metadata: Optional[dict[str, Any]] = None,
    image_url: Optional[str] = None,
    image_base64: Optional[str] = None,
) -> Optional[dict[str, Any]]:
    """
    Send risk analysis results to ARIN Platform.

    Args:
        entity_id: ID of entity — must follow convention (zone_*, asset_*, portfolio_*, scenario_*).
        entity_type: "zone", "physical_asset", "portfolio", "scenario", etc.
        analysis_type: "global_risk_assessment", "asset_risk_analysis", "stress_test",
                       "compliance_check", "physical_asset_summary", etc.
        data: Analysis results (risk_score, risk_level, summary, recommendations, indicators).
        metadata: Optional metadata (calculated_at, model_version, etc.)
        image_url: Optional URL of image to include for Physical Asset Risk (Cosmos) analysis.
        image_base64: Optional base64-encoded image to include for Cosmos analysis.

    Returns:
        ARIN response dict or None if export disabled/failed.
    """
    url = _build_export_url()
    if not url:
        logger.warning(
            "ARIN export skipped: neither ARIN_EXPORT_URL nor ARIN_BASE_URL is set. "
            "Set one of them in the API .env so exports reach https://arin.saa-alliance.com"
        )
        return None

    logger.info(
        "ARIN export attempt: url=%s entity_id=%s entity_type=%s analysis_type=%s source=%s",
        url,
        entity_id,
        entity_type,
        analysis_type,
        SOURCE,
    )

    # Merge optional image/media into data payload.
    # ARIN searches for media in data["image_url"] first priority.
    # For base64, wrap as a data: URI so ARIN recognises it.
    export_data = {**data}
    if image_url:
        export_data["image_url"] = image_url
    elif image_base64:
        export_data["image_url"] = f"data:image/png;base64,{image_base64}"

    payload = {
        "source": SOURCE,
        "entity_id": entity_id,
        "entity_type": entity_type,
        "analysis_type": analysis_type,
        "data": export_data,
        "metadata": {
            **(metadata or {}),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "platform_version": "0.2.0",
        },
    }
    headers = _build_auth_headers()

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()
            result = resp.json()
            logger.info(
                "ARIN export success: entity_id=%s analysis_type=%s export_id=%s",
                entity_id,
                analysis_type,
                result.get("export_id", "?"),
            )
            return result
    except httpx.HTTPStatusError as e:
        logger.warning(
            "ARIN export HTTP error: url=%s entity_id=%s status=%s body=%s",
            url,
            entity_id,
            e.response.status_code,
            e.response.text[:500] if e.response.text else "",
        )
        return None
    except Exception as e:
        logger.warning("ARIN export failed: url=%s entity_id=%s error=%s", url, entity_id, e)
        return None


# ---------------------------------------------------------------------------
# Verdict retrieval (proxy for UI)
# ---------------------------------------------------------------------------

async def get_arin_verdict(entity_id: str) -> Optional[dict[str, Any]]:
    """
    Fetch the unified verdict for *entity_id* from external ARIN platform.

    Calls ``GET {ARIN_BASE_URL}/api/v1/unified/verdict/{entity_id}``.
    Returns the verdict dict or None when ARIN is not configured / unreachable.
    """
    base = getattr(settings, "arin_base_url", None) or ""
    if not base:
        # Fall back: derive base from arin_export_url by stripping /api/v1/unified/export
        export_url = getattr(settings, "arin_export_url", None) or ""
        if "/api/v1/unified/export" in export_url:
            base = export_url.split("/api/v1/unified/export")[0]
        else:
            logger.debug("ARIN verdict disabled (ARIN_BASE_URL not set)")
            return None

    url = f"{base.rstrip('/')}/api/v1/unified/verdict/{entity_id}"
    headers = _build_auth_headers()

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
            return resp.json()
    except httpx.HTTPStatusError as e:
        logger.warning("ARIN verdict HTTP error for %s: %s %s", entity_id, e.response.status_code, e.response.text)
        return None
    except Exception as e:
        logger.warning("ARIN verdict failed for %s: %s", entity_id, e)
        return None


async def export_portfolio_risk(
    entity_id: str,
    risk_score: float,
    avg_climate: float,
    avg_physical: float,
    avg_network: float,
    total_assets: int,
    critical_count: int,
    high_count: int,
) -> Optional[dict[str, Any]]:
    """Export portfolio global risk assessment to ARIN."""
    risk_level = _risk_level_from_score(risk_score)
    summary = (
        f"Portfolio risk assessment: {total_assets} assets, "
        f"climate={avg_climate:.0f}%, physical={avg_physical:.0f}%, network={avg_network:.0f}%. "
        f"Critical: {critical_count}, High: {high_count}."
    )
    recommendations = []
    if risk_score >= 60:
        recommendations.append("Review sector exposure")
        recommendations.append("Consider hedging for high-risk assets")
    if critical_count > 0:
        recommendations.append("Prioritize mitigation for critical assets")

    return await export_to_arin(
        entity_id=entity_id,
        entity_type="portfolio",
        analysis_type="global_risk_assessment",
        data={
            "risk_score": round(risk_score, 1),
            "risk_level": risk_level,
            "summary": summary,
            "recommendations": recommendations,
            "indicators": {
                "avg_climate_risk": avg_climate,
                "avg_physical_risk": avg_physical,
                "avg_network_risk": avg_network,
                "critical_count": critical_count,
                "high_count": high_count,
                "total_assets": total_assets,
            },
        },
        metadata={
            "calculated_at": datetime.now(timezone.utc).isoformat(),
            "model_version": "1.0",
        },
    )


async def export_stress_test(
    entity_id: str,
    scenario_name: str,
    risk_score: float,
    portfolio_loss: Optional[float] = None,
    recovery_days: Optional[int] = None,
    summary: Optional[str] = None,
    recommendations: Optional[list[str]] = None,
    compliance_verification_passed: Optional[bool] = None,
    compliance_verification_id: Optional[str] = None,
    frameworks_checked: Optional[list[str]] = None,
) -> Optional[dict[str, Any]]:
    """Export stress test result to ARIN; optionally include compliance verification."""
    risk_level = _risk_level_from_score(risk_score)
    data: dict[str, Any] = {
        "risk_score": round(risk_score, 1),
        "risk_level": risk_level,
        "summary": summary or f"Stress test: {scenario_name}",
        "recommendations": recommendations or ["Set stop-loss", "Review exposure"],
        "indicators": {
            "scenario": scenario_name,
            "portfolio_loss": portfolio_loss,
            "recovery_days_est": recovery_days,
        },
    }
    if compliance_verification_passed is not None:
        data["compliance_verification_passed"] = compliance_verification_passed
    if compliance_verification_id:
        data["compliance_verification_id"] = compliance_verification_id
    if frameworks_checked:
        data["frameworks_checked"] = frameworks_checked
    metadata: dict[str, Any] = {"calculated_at": datetime.now(timezone.utc).isoformat()}
    if compliance_verification_passed is not None:
        metadata["compliance_verification_passed"] = compliance_verification_passed
    return await export_to_arin(
        entity_id=entity_id,
        entity_type="portfolio",
        analysis_type="stress_test",
        data=data,
        metadata=metadata,
    )


async def export_physical_asset(
    entity_id: str,
    entity_type: str,
    data: dict[str, Any],
    image_url: Optional[str] = None,
    image_base64: Optional[str] = None,
    data_sources: Optional[list[str]] = None,
) -> Optional[dict[str, Any]]:
    """Export physical asset data (with optional image for Cosmos Reason 2) to ARIN."""
    return await export_to_arin(
        entity_id=entity_id,
        entity_type=entity_type,
        analysis_type="physical_asset_summary",
        data={
            **data,
            "data_sources": data_sources or [],
        },
        metadata={
            "calculated_at": datetime.now(timezone.utc).isoformat(),
            "includes_image": bool(image_url or image_base64),
        },
        image_url=image_url,
        image_base64=image_base64,
    )


async def export_compliance_check(
    entity_id: str,
    risk_score: float,
    summary: str,
    recommendations: list[str],
    indicators: Optional[dict[str, Any]] = None,
) -> Optional[dict[str, Any]]:
    """Export SRO/compliance check to ARIN."""
    risk_level = _risk_level_from_score(risk_score)
    return await export_to_arin(
        entity_id=entity_id,
        entity_type="portfolio",
        analysis_type="compliance_check",
        data={
            "risk_score": round(risk_score, 1),
            "risk_level": risk_level,
            "summary": summary,
            "recommendations": recommendations,
            "indicators": indicators or {},
        },
        metadata={"calculated_at": datetime.now(timezone.utc).isoformat()},
    )
