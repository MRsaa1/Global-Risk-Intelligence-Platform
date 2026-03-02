"""
Fraud detector: evaluate claims against rules; create SENTINEL alerts.

Rules: amount_threshold, frequency_per_claimant. Integrates with DamageClaim and SENTINEL.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import uuid4

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.fraud import DamageClaim, FraudDetectionRule

logger = logging.getLogger(__name__)


async def run_detection(db: AsyncSession) -> Dict[str, Any]:
    """Run active fraud rules against claims; create SENTINEL alerts when rules fire."""
    alerts_created = 0
    triggered: List[Dict[str, Any]] = []
    r = await db.execute(select(FraudDetectionRule).where(FraudDetectionRule.is_active.is_(True)))
    rules = r.scalars().all()
    for rule in rules:
        if rule.rule_type == "amount_threshold" and rule.field_name and rule.threshold_value is not None:
            col = getattr(DamageClaim, rule.field_name, None)
            if col is None:
                continue
            q = select(DamageClaim).where(col >= rule.threshold_value).where(
                DamageClaim.status.notin_(["rejected", "closed"])
            )
            res = await db.execute(q)
            claims = res.scalars().all()
            for c in claims:
                await _create_fraud_alert(rule.name, c.id, f"Claim {c.claim_number} exceeded {rule.field_name} threshold {rule.threshold_value}")
                alerts_created += 1
                triggered.append({"rule_id": rule.id, "rule_name": rule.name, "claim_id": c.id, "claim_number": c.claim_number})
        elif rule.rule_type == "frequency_per_claimant" and rule.threshold_value is not None and rule.window_hours:
            since = datetime.utcnow() - timedelta(hours=rule.window_hours)
            q = (
                select(DamageClaim.claimant_id, func.count(DamageClaim.id).label("cnt"))
                .where(DamageClaim.reported_at >= since)
                .where(DamageClaim.claimant_id.isnot(None))
                .group_by(DamageClaim.claimant_id)
                .having(func.count(DamageClaim.id) >= int(rule.threshold_value))
            )
            res = await db.execute(q)
            for row in res.fetchall():
                claimant_id, cnt = row[0], row[1]
                await _create_fraud_alert(rule.name, None, f"Claimant {claimant_id} has {cnt} claims in last {rule.window_hours}h")
                alerts_created += 1
                triggered.append({"rule_id": rule.id, "rule_name": rule.name, "claimant_id": claimant_id, "count": cnt})
    return {"alerts_created": alerts_created, "triggered": triggered}


def _create_fraud_alert(rule_name: str, claim_id: Optional[str], message: str) -> None:
    """Create a SENTINEL alert for fraud detector."""
    try:
        from src.layers.agents.sentinel import sentinel_agent, Alert, AlertSeverity, AlertType
        alert = Alert(
            id=uuid4(),
            alert_type=AlertType.FINANCIAL_THRESHOLD,
            severity=AlertSeverity.HIGH,
            title=f"Fraud rule triggered: {rule_name}",
            message=message,
            asset_ids=[claim_id] if claim_id else [],
            exposure=0.0,
            recommended_actions=["Review claim(s)", "Verify claimant"],
            created_at=datetime.utcnow(),
            source="FRAUD_DETECTOR",
        )
        sentinel_agent.active_alerts[alert.id] = alert
    except Exception as e:
        logger.warning("Could not create fraud alert: %s", e)


async def list_rules(db: AsyncSession) -> List[Dict[str, Any]]:
    """List all fraud detection rules."""
    r = await db.execute(select(FraudDetectionRule).order_by(FraudDetectionRule.name))
    rules = r.scalars().all()
    return [
        {"id": rule.id, "name": rule.name, "rule_type": rule.rule_type, "field_name": rule.field_name,
         "threshold_value": rule.threshold_value, "window_hours": rule.window_hours, "is_active": rule.is_active}
        for rule in rules
    ]


async def create_rule(
    db: AsyncSession,
    name: str,
    rule_type: str,
    field_name: Optional[str] = None,
    threshold_value: Optional[float] = None,
    window_hours: Optional[int] = None,
) -> FraudDetectionRule:
    """Create a fraud detection rule."""
    rule = FraudDetectionRule(
        id=str(uuid4()),
        name=name,
        rule_type=rule_type,
        field_name=field_name,
        threshold_value=threshold_value,
        window_hours=window_hours,
    )
    db.add(rule)
    await db.flush()
    return rule
