"""
SRS_SENTINEL Agent - Sovereign Risk monitoring.

Monitors sovereign fund health, resource depletion timelines,
regime stability indicators and emits alerts when thresholds are breached.
"""
import logging
from datetime import datetime
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from src.layers.agents.sentinel import Alert, AlertSeverity, AlertType

from .service import SRSService

logger = logging.getLogger(__name__)

SOLVENCY_WARNING_THRESHOLD = 0.50
SOLVENCY_CRITICAL_THRESHOLD = 0.30
DEPLETION_WARNING_YEARS = 10
FUND_SIZE_CRITICAL_USD = 1e9  # $1B


class SRSSentinelAgent:
    """
    SRS_SENTINEL - Monitors sovereign risk posture.

    Checks:
    - Fund solvency score (via quick stress scenario)
    - Resource depletion horizon
    - Frozen / liquidating fund status
    - Low total assets
    """

    module = "srs"
    monitoring_frequency = 300  # seconds

    async def run_cycle(self, db: AsyncSession) -> list[Alert]:
        alerts: list[Alert] = []
        service = SRSService(db)

        try:
            funds = await service.list_funds(limit=500)
        except Exception as e:
            logger.warning("SRS_SENTINEL list_funds failed: %s", e)
            return alerts

        for fund in funds:
            # Frozen / liquidating funds
            if fund.status in ("frozen", "liquidating"):
                alerts.append(Alert(
                    id=uuid4(),
                    alert_type=AlertType.FINANCIAL_THRESHOLD,
                    severity=AlertSeverity.HIGH,
                    title=f"Sovereign fund {fund.status}: {fund.name}",
                    message=f"Fund {fund.srs_id} ({fund.country_code}) is {fund.status}. "
                            f"Total assets: ${(fund.total_assets_usd or 0) / 1e9:.1f}B.",
                    asset_ids=[fund.id],
                    exposure=fund.total_assets_usd or 0,
                    recommended_actions=[
                        "Review fund status and mandate",
                        "Assess impact on sovereign solvency",
                        "Monitor for further deterioration",
                    ],
                    created_at=datetime.utcnow(),
                ))

            # Very low fund assets
            if fund.total_assets_usd is not None and fund.total_assets_usd < FUND_SIZE_CRITICAL_USD and fund.status == "active":
                alerts.append(Alert(
                    id=uuid4(),
                    alert_type=AlertType.FINANCIAL_THRESHOLD,
                    severity=AlertSeverity.WARNING,
                    title=f"Low sovereign fund assets: {fund.name}",
                    message=f"Fund {fund.srs_id} has only ${(fund.total_assets_usd) / 1e6:.0f}M in assets.",
                    asset_ids=[fund.id],
                    exposure=fund.total_assets_usd,
                    recommended_actions=[
                        "Evaluate fund viability",
                        "Consider consolidation with larger fund",
                    ],
                    created_at=datetime.utcnow(),
                ))

        # Check deposits for near-depletion
        try:
            deposits = await service.list_deposits(limit=500)
        except Exception as e:
            logger.warning("SRS_SENTINEL list_deposits failed: %s", e)
            return alerts

        for dep in deposits:
            if dep.extraction_horizon_years is not None and dep.extraction_horizon_years <= DEPLETION_WARNING_YEARS:
                severity = AlertSeverity.CRITICAL if dep.extraction_horizon_years <= 3 else AlertSeverity.WARNING
                alerts.append(Alert(
                    id=uuid4(),
                    alert_type=AlertType.FINANCIAL_THRESHOLD,
                    severity=severity,
                    title=f"Resource nearing depletion: {dep.name}",
                    message=f"Deposit {dep.srs_id} ({dep.resource_type}, {dep.country_code}) "
                            f"has ~{dep.extraction_horizon_years} years remaining. "
                            f"Value: ${(dep.estimated_value_usd or 0) / 1e9:.1f}B.",
                    asset_ids=[dep.id],
                    exposure=dep.estimated_value_usd or 0,
                    recommended_actions=[
                        "Diversify national revenue sources",
                        "Accelerate sovereign fund contributions",
                        "Review extraction rate sustainability",
                    ],
                    created_at=datetime.utcnow(),
                ))

        # Run a quick solvency check per country
        countries = list({f.country_code for f in funds})
        for cc in countries[:20]:  # cap to avoid long cycles
            try:
                result = await service.run_scenario(
                    "sovereign_solvency_stress",
                    country_code=cc,
                    params={"stress_shock": 0.20, "mc_paths": 500, "horizon_years": 3},
                )
                score = result.get("result", {}).get("solvency_score", 1.0)
                if score < SOLVENCY_CRITICAL_THRESHOLD:
                    alerts.append(Alert(
                        id=uuid4(),
                        alert_type=AlertType.FINANCIAL_THRESHOLD,
                        severity=AlertSeverity.CRITICAL,
                        title=f"Critical sovereign solvency: {cc}",
                        message=f"Country {cc} solvency score {score:.2f} under 20% stress shock "
                                f"(threshold: {SOLVENCY_CRITICAL_THRESHOLD}).",
                        asset_ids=[f.id for f in funds if f.country_code == cc],
                        exposure=sum(f.total_assets_usd or 0 for f in funds if f.country_code == cc),
                        recommended_actions=[
                            "Initiate sovereign risk review",
                            "Engage fiscal policy advisors",
                            "Consider reserve drawdown contingency",
                        ],
                        created_at=datetime.utcnow(),
                    ))
                elif score < SOLVENCY_WARNING_THRESHOLD:
                    alerts.append(Alert(
                        id=uuid4(),
                        alert_type=AlertType.FINANCIAL_THRESHOLD,
                        severity=AlertSeverity.WARNING,
                        title=f"Sovereign solvency warning: {cc}",
                        message=f"Country {cc} solvency score {score:.2f} under stress.",
                        asset_ids=[f.id for f in funds if f.country_code == cc],
                        exposure=sum(f.total_assets_usd or 0 for f in funds if f.country_code == cc),
                        recommended_actions=["Monitor fiscal position", "Review fund allocation strategy"],
                        created_at=datetime.utcnow(),
                    ))
            except Exception as e:
                logger.debug("SRS_SENTINEL solvency check for %s failed: %s", cc, e)

        logger.info("SRS_SENTINEL cycle: %d alerts emitted", len(alerts))
        return alerts
