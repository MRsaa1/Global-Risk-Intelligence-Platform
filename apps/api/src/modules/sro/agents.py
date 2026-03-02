"""
SRO_SENTINEL Agent v2 - Systemic risk early warning (Phase 1.3).

Monitors financial institutions, anomaly detection, crisis pattern matching,
correlation breakdown. Emits alerts compatible with the main SENTINEL system.
"""
import logging
from datetime import datetime
from typing import Any, Dict, List
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from src.layers.agents.sentinel import Alert, AlertSeverity, AlertType

from .service import SROService

logger = logging.getLogger(__name__)

# Thresholds for SRO_SENTINEL alerts
SYSTEMIC_RISK_THRESHOLD = 70.0
CONTAGION_RISK_THRESHOLD = 60.0

# Alert levels (Phase 1.3)
ALERT_LEVELS = ["GREEN", "YELLOW", "ORANGE", "RED"]
ESCALATION_PROTOCOLS = {
    "YELLOW": ["risk_committee"],
    "ORANGE": ["board", "regulators"],
    "RED": ["emergency_protocol", "G7_coordination"],
}

# Crisis signature library for pattern matching
CRISIS_LIBRARY = {
    "2008_financial_crisis": {
        "signature": ["correlation_breakdown", "liquidity_freeze", "credit_spread_widening"],
        "lead_time_days": 90,
    },
    "2020_covid_shock": {
        "signature": ["vol_spike", "flight_to_safety", "supply_chain_disruption"],
        "lead_time_days": 14,
    },
    "2023_banking_crisis": {
        "signature": ["deposit_withdrawals", "interest_rate_stress", "sentiment_shift"],
        "lead_time_days": 7,
    },
}


class SROSentinelAgent:
    """
    SRO_SENTINEL v2 - Early warning for systemic risk.

    Checks:
    - Institutions under_stress
    - Breached systemic risk indicators
    - High systemic/contagion risk
    - Anomaly detection (Z-score, physical-financial coupling)
    - Crisis pattern matching
    - Correlation breakdown detection
    - Risk level assessment (GREEN/YELLOW/ORANGE/RED) with escalation
    """

    module = "sro"
    monitoring_frequency = 10  # seconds for MVP (spec suggests 100ms for production)

    def detect_anomalies(
        self,
        market_data: Dict[str, Any],
        physical_data: Dict[str, Any],
    ) -> List[Dict[str, Any]]:
        """
        Statistical anomaly detection.
        Methods: Z-score (volatility), physical-financial coupling.
        """
        anomalies: List[Dict[str, Any]] = []

        # Volatility Z-score (stub: use VIX-like if available)
        vix = market_data.get("vix") or 20.0
        vix_90d_mean = market_data.get("vix_90d_mean") or 18.0
        vix_90d_std = market_data.get("vix_90d_std") or 5.0
        if vix_90d_std > 0:
            vol_z_score = (vix - vix_90d_mean) / vix_90d_std
            if vol_z_score > 3.0:
                anomalies.append({
                    "type": "volatility_spike",
                    "severity": vol_z_score,
                    "timestamp": datetime.utcnow().isoformat(),
                })

        # Physical-financial coupling (grid stress + exposed institutions)
        grid_stress = physical_data.get("energy_grid_stress") or 0.0
        exposed_count = physical_data.get("exposed_institutions_count") or 0
        if grid_stress > 0.8 and exposed_count > 5:
            anomalies.append({
                "type": "physical_financial_coupling",
                "severity": "HIGH",
                "details": {
                    "grid_stress": grid_stress,
                    "exposed_institutions": exposed_count,
                },
            })

        return anomalies

    def match_crisis_patterns(self, anomalies: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """
        Compare current anomalies to historical crisis signatures.
        """
        anomaly_types = {a.get("type", "").replace("_", ""): a for a in anomalies}
        matches = []

        for crisis_name, crisis_def in CRISIS_LIBRARY.items():
            signature = crisis_def["signature"]
            matching = [s for s in signature if any(
                s.replace("_", "") in at or at in s.replace("_", "")
                for at in anomaly_types
            )]
            match_ratio = len(matching) / len(signature) if signature else 0
            if match_ratio > 0.6:
                matches.append({
                    "crisis": crisis_name,
                    "match_ratio": match_ratio,
                    "expected_lead_time_days": crisis_def["lead_time_days"],
                })

        return matches

    def detect_correlation_breakdown(
        self,
        correlation_7d: float = 0.5,
        correlation_90d_avg: float = 0.7,
        pair: tuple = ("equities", "bonds"),
    ) -> List[Dict[str, Any]]:
        """
        Detect when historical correlations break (often precedes crises).
        """
        unusual = []
        if abs(correlation_7d - correlation_90d_avg) > 0.5:
            unusual.append({
                "pair": list(pair),
                "current_correlation": correlation_7d,
                "historical_avg": correlation_90d_avg,
                "deviation": abs(correlation_7d - correlation_90d_avg),
            })
        return unusual

    def assess_risk_level(
        self,
        anomalies: List[Dict[str, Any]],
        patterns: List[Dict[str, Any]],
        correlations: List[Dict[str, Any]],
    ) -> str:
        """
        Aggregate signals into single risk level: GREEN, YELLOW, ORANGE, RED.
        """
        score = 0.0
        score += len(anomalies) * 0.1
        if patterns:
            score += max(p.get("match_ratio", 0) for p in patterns) * 0.5
        score += len(correlations) * 0.15

        if score >= 0.8:
            return "RED"
        if score >= 0.5:
            return "ORANGE"
        if score >= 0.2:
            return "YELLOW"
        return "GREEN"

    def escalate(
        self,
        level: str,
        evidence: Dict[str, Any],
    ) -> Alert:
        """
        Create escalation alert for ORANGE/RED levels.
        Recipients from ESCALATION_PROTOCOLS (risk_committee, board, regulators).
        """
        recipients = ESCALATION_PROTOCOLS.get(level, [])
        severity = AlertSeverity.CRITICAL if level == "RED" else AlertSeverity.HIGH
        return Alert(
            id=uuid4(),
            alert_type=AlertType.CASCADE_RISK,
            severity=severity,
            title=f"SRO_SENTINEL Escalation: {level}",
            message=f"Systemic risk level {level}. "
            f"Escalation to: {', '.join(recipients)}. "
            f"Anomalies: {len(evidence.get('anomalies', []))}, "
            f"Pattern matches: {len(evidence.get('patterns', []))}, "
            f"Correlation breakdowns: {len(evidence.get('correlations', []))}.",
            asset_ids=[],
            exposure=0,
            recommended_actions=[
                "Review evidence in SRO module",
                "Activate escalation protocol",
                "Coordinate with regulators",
            ],
            created_at=datetime.utcnow(),
            source="SRO_SENTINEL",
            explanation={
                "what": f"Systemic risk level {level} - anomaly/pattern/correlation triggers",
                "confidence": 0.65,
                "why_now": "Anomaly detection, crisis pattern match, or correlation breakdown",
                "sources": ["SRO_SENTINEL", "anomalies", "crisis_patterns", "correlation_breakdown"],
                "recommendations": ["Activate escalation protocol", "Coordinate with regulators"],
            },
        )

    async def run_cycle(self, db: AsyncSession) -> list[Alert]:
        """
        Run one monitoring cycle: institutions, indicators, anomalies,
        pattern matching, correlation breakdown, risk assessment, escalation.

        Returns:
            List of Alert instances (same type as main SENTINEL).
        """
        alerts: list[Alert] = []
        service = SROService(db)

        # --- Phase 1.3: Anomaly detection & risk assessment ---
        market_data = {"vix": 22.0, "vix_90d_mean": 18.0, "vix_90d_std": 5.0}
        physical_data = {"energy_grid_stress": 0.0, "exposed_institutions_count": 0}

        # Try to get real indicator data for market_data
        try:
            inds = await service.get_latest_indicators(indicator_type="volatility", limit=5)
            if inds:
                market_data["vix"] = inds[0].value
        except Exception:
            pass

        anomalies = self.detect_anomalies(market_data, physical_data)
        patterns = self.match_crisis_patterns(anomalies)
        correlations = self.detect_correlation_breakdown()

        risk_level = self.assess_risk_level(anomalies, patterns, correlations)
        if risk_level in ("ORANGE", "RED"):
            evidence = {"anomalies": anomalies, "patterns": patterns, "correlations": correlations}
            alerts.append(self.escalate(risk_level, evidence))

        # --- Legacy checks (institutions, indicators, systemic/contagion risk) ---
        try:
            institutions = await service.list_institutions(under_stress=True, limit=200, offset=0)
            for inst in institutions:
                alerts.append(
                    Alert(
                        id=uuid4(),
                        alert_type=AlertType.INFRASTRUCTURE_ISSUE,
                        severity=AlertSeverity.HIGH,
                        title=f"Institution under stress: {inst.name}",
                        message=f"{inst.sro_id} is flagged under stress. "
                        f"Systemic importance: {inst.systemic_importance}. "
                        f"Review systemic risk and contagion analysis.",
                        asset_ids=[inst.id],
                        exposure=float(inst.total_assets or 0),
                        recommended_actions=[
                            "Run systemic risk score",
                            "Run contagion analysis",
                            "Review correlations and exposures",
                        ],
                        created_at=datetime.utcnow(),
                        source="SRO_SENTINEL",
                        explanation={
                            "what": f"Institution {inst.name} is under stress",
                            "confidence": 0.75,
                            "why_now": "Under-stress flag set in SRO module",
                            "sources": ["sro_institutions"],
                            "recommendations": ["Run systemic risk score", "Run contagion analysis"],
                        },
                    )
                )
        except Exception as e:
            logger.warning("SRO_SENTINEL list_institutions (under_stress) failed: %s", e)

        try:
            breached = await service.get_breached_indicators()
            if breached:
                names = [b.indicator_name for b in breached[:5]]
                alerts.append(
                    Alert(
                        id=uuid4(),
                        alert_type=AlertType.CASCADE_RISK,
                        severity=AlertSeverity.WARNING,
                        title=f"Systemic risk indicators breached ({len(breached)})",
                        message=f"Breached: {', '.join(names)}{'…' if len(breached) > 5 else ''}. "
                        f"Review SRO indicators and thresholds.",
                        asset_ids=[],
                        exposure=0,
                        recommended_actions=[
                            "Review breached indicators in SRO module",
                            "Adjust thresholds or mitigate underlying risks",
                        ],
                        created_at=datetime.utcnow(),
                        source="SRO_SENTINEL",
                        explanation={
                            "what": f"Indicators breached: {', '.join(names)}",
                            "confidence": 0.8,
                            "why_now": "Threshold exceeded in SRO indicators",
                            "sources": ["sro_indicators"],
                            "recommendations": ["Review breached indicators", "Adjust thresholds"],
                        },
                    )
                )
        except Exception as e:
            logger.warning("SRO_SENTINEL get_breached_indicators failed: %s", e)

        try:
            all_inst = await service.list_institutions(limit=200, offset=0)
            for inst in all_inst:
                score = inst.systemic_risk_score
                if score is not None and score >= SYSTEMIC_RISK_THRESHOLD:
                    alerts.append(
                        Alert(
                            id=uuid4(),
                            alert_type=AlertType.CASCADE_RISK,
                            severity=AlertSeverity.HIGH if score >= 80 else AlertSeverity.WARNING,
                            title=f"High systemic risk: {inst.name}",
                            message=f"{inst.sro_id} systemic risk score {score:.0f}. "
                            f"Importance: {inst.systemic_importance}. Review contagion paths.",
                            asset_ids=[inst.id],
                            exposure=float(inst.total_assets or 0),
                            recommended_actions=[
                                "Run contagion analysis",
                                "Review correlations",
                                "Consider stress test",
                            ],
                            created_at=datetime.utcnow(),
                            source="SRO_SENTINEL",
                            explanation={
                                "what": f"High systemic risk score {score:.0f} for {inst.name}",
                                "confidence": 0.7,
                                "why_now": "Score exceeds threshold",
                                "sources": ["sro_institutions", "systemic_risk_score"],
                                "recommendations": ["Run contagion analysis", "Review correlations"],
                            },
                        )
                    )
        except Exception as e:
            logger.warning("SRO_SENTINEL systemic risk check failed: %s", e)

        try:
            for inst in (await service.list_institutions(limit=200, offset=0)):
                contagion = inst.contagion_risk
                if contagion is not None and contagion >= CONTAGION_RISK_THRESHOLD:
                    alerts.append(
                        Alert(
                            id=uuid4(),
                            alert_type=AlertType.CASCADE_RISK,
                            severity=AlertSeverity.WARNING,
                            title=f"High contagion risk: {inst.name}",
                            message=f"{inst.sro_id} contagion risk {contagion:.0f}. "
                            f"Distress could spread to counterparties. Run contagion analysis.",
                            asset_ids=[inst.id],
                            exposure=float(inst.total_assets or 0),
                            recommended_actions=[
                                "Run contagion analysis in SRO module",
                                "Review counterparty exposures",
                            ],
                            created_at=datetime.utcnow(),
                            source="SRO_SENTINEL",
                            explanation={
                                "what": f"High contagion risk {contagion:.0f} for {inst.name}",
                                "confidence": 0.7,
                                "why_now": "Contagion risk exceeds threshold",
                                "sources": ["sro_institutions", "contagion_risk"],
                                "recommendations": ["Run contagion analysis", "Review counterparty exposures"],
                            },
                        )
                    )
        except Exception as e:
            logger.warning("SRO_SENTINEL contagion risk check failed: %s", e)

        return alerts


# Singleton for use in alerts endpoint
sro_sentinel = SROSentinelAgent()
