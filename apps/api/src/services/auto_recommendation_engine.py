"""
Auto-Recommendation Engine (P4a)
==================================

After each stress test or cascade simulation, automatically generates
prioritized Action Plans using the platform's AI agents and rule engine.

Flow:
1. Stress test completes → results fed to this engine
2. Engine analyzes: affected zones, loss distribution, module impacts
3. Generates ranked recommendations with cost/benefit estimates
4. Stores as ActionPlan records linked to the stress test
5. Dashboard / Board Mode can display the latest recommendations

Integrates with:
- Decision Automation Engine (DAE) for policy-based actions
- Consensus Engine for multi-agent agreement
- Cross-Module Cascade Engine for inter-module recommendations
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

logger = logging.getLogger(__name__)


class Priority(str):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class ActionCategory(str):
    MITIGATION = "mitigation"
    TRANSFER = "transfer"          # insurance, hedging
    AVOIDANCE = "avoidance"        # exit exposure
    ACCEPTANCE = "acceptance"      # accept residual risk
    INFRASTRUCTURE = "infrastructure"
    OPERATIONAL = "operational"
    FINANCIAL = "financial"
    REGULATORY = "regulatory"


@dataclass
class Recommendation:
    """A single recommendation with cost/benefit analysis."""
    id: str = field(default_factory=lambda: str(uuid4()))
    title: str = ""
    description: str = ""
    category: str = "mitigation"
    priority: str = "medium"
    estimated_cost_m: float = 0.0  # €M
    estimated_loss_avoided_m: float = 0.0  # €M
    roi: float = 0.0
    time_to_implement: str = ""  # e.g. "30-60 days"
    affected_modules: List[str] = field(default_factory=list)
    affected_zones: List[str] = field(default_factory=list)
    confidence: float = 0.8  # 0-1

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "category": self.category,
            "priority": self.priority,
            "estimated_cost_m": round(self.estimated_cost_m, 2),
            "estimated_loss_avoided_m": round(self.estimated_loss_avoided_m, 2),
            "roi": round(self.roi, 1),
            "time_to_implement": self.time_to_implement,
            "affected_modules": self.affected_modules,
            "affected_zones": self.affected_zones,
            "confidence": round(self.confidence, 2),
        }


@dataclass
class ActionPlanResult:
    """Complete auto-generated action plan."""
    id: str = field(default_factory=lambda: str(uuid4()))
    stress_test_id: Optional[str] = None
    cascade_event_id: Optional[str] = None
    recommendations: List[Recommendation] = field(default_factory=list)
    total_mitigation_cost_m: float = 0.0
    total_loss_avoided_m: float = 0.0
    overall_roi: float = 0.0
    risk_reduction_pct: float = 0.0
    generated_at: str = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    method: str = "rule_based_with_heuristics"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "stress_test_id": self.stress_test_id,
            "cascade_event_id": self.cascade_event_id,
            "recommendations": [r.to_dict() for r in self.recommendations],
            "total_mitigation_cost_m": round(self.total_mitigation_cost_m, 2),
            "total_loss_avoided_m": round(self.total_loss_avoided_m, 2),
            "overall_roi": round(self.overall_roi, 1),
            "risk_reduction_pct": round(self.risk_reduction_pct, 1),
            "generated_at": self.generated_at,
            "method": self.method,
        }


# Rule-based recommendation templates by scenario type
SCENARIO_TEMPLATES: Dict[str, List[Dict[str, Any]]] = {
    "flood": [
        {"title": "Elevate critical infrastructure above flood level", "category": "infrastructure",
         "cost_pct": 0.05, "loss_avoided_pct": 0.35, "time": "60-180 days", "priority": "high"},
        {"title": "Deploy flood barriers and drainage upgrades", "category": "infrastructure",
         "cost_pct": 0.03, "loss_avoided_pct": 0.20, "time": "30-90 days", "priority": "high"},
        {"title": "Increase parametric flood insurance coverage", "category": "transfer",
         "cost_pct": 0.02, "loss_avoided_pct": 0.25, "time": "14-30 days", "priority": "critical"},
        {"title": "Relocate high-value assets from flood zones", "category": "avoidance",
         "cost_pct": 0.08, "loss_avoided_pct": 0.40, "time": "90-365 days", "priority": "medium"},
    ],
    "seismic": [
        {"title": "Seismic retrofit of critical structures", "category": "infrastructure",
         "cost_pct": 0.06, "loss_avoided_pct": 0.45, "time": "180-365 days", "priority": "high"},
        {"title": "Earthquake insurance with low deductible", "category": "transfer",
         "cost_pct": 0.03, "loss_avoided_pct": 0.30, "time": "14-30 days", "priority": "critical"},
    ],
    "financial": [
        {"title": "Increase liquidity buffers to 150% of requirements", "category": "financial",
         "cost_pct": 0.02, "loss_avoided_pct": 0.20, "time": "7-30 days", "priority": "critical"},
        {"title": "Diversify counterparty exposure", "category": "financial",
         "cost_pct": 0.01, "loss_avoided_pct": 0.15, "time": "30-90 days", "priority": "high"},
        {"title": "Hedge systemic risk with CDS / options", "category": "transfer",
         "cost_pct": 0.015, "loss_avoided_pct": 0.25, "time": "7-14 days", "priority": "high"},
    ],
    "pandemic": [
        {"title": "Activate business continuity plan for remote operations", "category": "operational",
         "cost_pct": 0.01, "loss_avoided_pct": 0.15, "time": "0-7 days", "priority": "critical"},
        {"title": "Diversify supply chain across 3+ regions", "category": "mitigation",
         "cost_pct": 0.04, "loss_avoided_pct": 0.30, "time": "60-180 days", "priority": "high"},
        {"title": "Stockpile critical supplies for 90 days", "category": "operational",
         "cost_pct": 0.02, "loss_avoided_pct": 0.10, "time": "30-60 days", "priority": "medium"},
    ],
    "geopolitical": [
        {"title": "Reduce exposure in sanctioned / conflict regions", "category": "avoidance",
         "cost_pct": 0.03, "loss_avoided_pct": 0.35, "time": "30-90 days", "priority": "critical"},
        {"title": "Political risk insurance for key markets", "category": "transfer",
         "cost_pct": 0.02, "loss_avoided_pct": 0.20, "time": "14-30 days", "priority": "high"},
    ],
    "cyber": [
        {"title": "Patch all CISA KEV vulnerabilities within 48 hours", "category": "infrastructure",
         "cost_pct": 0.005, "loss_avoided_pct": 0.20, "time": "1-7 days", "priority": "critical"},
        {"title": "Deploy zero-trust network architecture", "category": "infrastructure",
         "cost_pct": 0.04, "loss_avoided_pct": 0.30, "time": "90-180 days", "priority": "high"},
        {"title": "Cyber insurance with incident response coverage", "category": "transfer",
         "cost_pct": 0.015, "loss_avoided_pct": 0.25, "time": "14-30 days", "priority": "high"},
    ],
    "climate": [
        {"title": "Transition to climate-resilient infrastructure", "category": "infrastructure",
         "cost_pct": 0.07, "loss_avoided_pct": 0.40, "time": "180-365 days", "priority": "high"},
        {"title": "Carbon offset and ESG compliance upgrade", "category": "regulatory",
         "cost_pct": 0.02, "loss_avoided_pct": 0.10, "time": "30-90 days", "priority": "medium"},
    ],
    "supply_chain": [
        {"title": "Multi-source critical components from 3+ suppliers", "category": "mitigation",
         "cost_pct": 0.03, "loss_avoided_pct": 0.35, "time": "60-180 days", "priority": "high"},
        {"title": "Build strategic inventory buffer (90 days)", "category": "operational",
         "cost_pct": 0.02, "loss_avoided_pct": 0.15, "time": "30-60 days", "priority": "medium"},
    ],
}

# Default fallback templates
DEFAULT_TEMPLATES = [
    {"title": "Conduct comprehensive risk assessment", "category": "operational",
     "cost_pct": 0.005, "loss_avoided_pct": 0.05, "time": "14-30 days", "priority": "high"},
    {"title": "Update business continuity plan", "category": "operational",
     "cost_pct": 0.003, "loss_avoided_pct": 0.08, "time": "30-60 days", "priority": "medium"},
    {"title": "Review and increase insurance coverage", "category": "transfer",
     "cost_pct": 0.02, "loss_avoided_pct": 0.20, "time": "14-30 days", "priority": "high"},
]


def generate_action_plan(
    scenario_type: str,
    total_loss_m: float,
    severity: float = 0.5,
    affected_zones: Optional[List[str]] = None,
    affected_modules: Optional[List[str]] = None,
    stress_test_id: Optional[str] = None,
    cascade_event_id: Optional[str] = None,
) -> ActionPlanResult:
    """
    Generate an auto-recommendation action plan based on stress test results.

    Args:
        scenario_type: Type of scenario (flood, seismic, financial, etc.)
        total_loss_m: Total estimated loss in millions €
        severity: Scenario severity 0-1
        affected_zones: List of affected zone names
        affected_modules: List of affected module codes
        stress_test_id: Optional linked stress test ID
        cascade_event_id: Optional linked cascade event ID

    Returns:
        ActionPlanResult with ranked recommendations
    """
    if affected_zones is None:
        affected_zones = []
    if affected_modules is None:
        affected_modules = []

    templates = SCENARIO_TEMPLATES.get(
        scenario_type.lower(),
        SCENARIO_TEMPLATES.get("climate", DEFAULT_TEMPLATES),
    )

    recommendations: List[Recommendation] = []

    for tmpl in templates:
        cost = total_loss_m * tmpl["cost_pct"] * (0.8 + severity * 0.4)
        loss_avoided = total_loss_m * tmpl["loss_avoided_pct"] * (0.7 + severity * 0.6)
        roi = loss_avoided / cost if cost > 0 else 0

        # Adjust priority based on severity
        priority = tmpl["priority"]
        if severity >= 0.8 and priority == "high":
            priority = "critical"
        elif severity < 0.3 and priority == "critical":
            priority = "high"

        recommendations.append(Recommendation(
            title=tmpl["title"],
            description=f"Estimated to reduce {scenario_type} losses by "
                        f"€{loss_avoided:.1f}M at a cost of €{cost:.1f}M (ROI {roi:.1f}x). "
                        f"Severity: {severity:.0%}.",
            category=tmpl["category"],
            priority=priority,
            estimated_cost_m=cost,
            estimated_loss_avoided_m=loss_avoided,
            roi=roi,
            time_to_implement=tmpl["time"],
            affected_modules=affected_modules,
            affected_zones=affected_zones[:5],
            confidence=min(0.95, 0.6 + severity * 0.3),
        ))

    # Also add default templates if loss is significant
    if total_loss_m > 50:
        for tmpl in DEFAULT_TEMPLATES:
            if not any(r.title == tmpl["title"] for r in recommendations):
                cost = total_loss_m * tmpl["cost_pct"]
                loss_avoided = total_loss_m * tmpl["loss_avoided_pct"]
                roi = loss_avoided / cost if cost > 0 else 0
                recommendations.append(Recommendation(
                    title=tmpl["title"],
                    category=tmpl["category"],
                    priority=tmpl["priority"],
                    estimated_cost_m=cost,
                    estimated_loss_avoided_m=loss_avoided,
                    roi=roi,
                    time_to_implement=tmpl["time"],
                    confidence=0.7,
                ))

    # Sort by ROI descending, then by priority
    priority_order = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    recommendations.sort(key=lambda r: (-priority_order.get(r.priority, 9), -r.roi))

    total_cost = sum(r.estimated_cost_m for r in recommendations)
    total_avoided = sum(r.estimated_loss_avoided_m for r in recommendations)
    overall_roi = total_avoided / total_cost if total_cost > 0 else 0
    risk_reduction = (total_avoided / total_loss_m * 100) if total_loss_m > 0 else 0

    return ActionPlanResult(
        stress_test_id=stress_test_id,
        cascade_event_id=cascade_event_id,
        recommendations=recommendations,
        total_mitigation_cost_m=total_cost,
        total_loss_avoided_m=total_avoided,
        overall_roi=overall_roi,
        risk_reduction_pct=min(risk_reduction, 95),
    )
