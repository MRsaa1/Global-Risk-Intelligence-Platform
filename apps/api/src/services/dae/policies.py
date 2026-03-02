"""
DAE Policy Definitions - 15 core rules for risk governance.

Policy structure aligns with Risk & Intelligence OS spec.
"""
from dataclasses import dataclass, field
from typing import Any

from src.models.decision_object import DecisionObject


@dataclass
class PolicyCondition:
    """Condition for policy rule."""
    field: str  # e.g. verdict.risk_level, consensus.confidence
    operator: str  # equals, greater_than, less_than, in, contains
    value: Any


@dataclass
class PolicyAction:
    """Action to execute when conditions match."""
    action: str  # notify_stakeholders, flag_for_review, require_human_confirmation, log_to_audit, suggest_hedge
    params: dict[str, Any] = field(default_factory=dict)


@dataclass
class PolicyRule:
    """Policy rule definition."""
    rule_id: str
    version: str
    effective_date: str
    description: str
    conditions: list[PolicyCondition]
    actions: list[PolicyAction]
    audit_log: bool = True
    retention_days: int = 2555


def _get_nested(obj: dict, path: str) -> Any:
    """Get nested value by dot path."""
    for key in path.split("."):
        obj = obj.get(key) if isinstance(obj, dict) else getattr(obj, key, None)
        if obj is None:
            return None
    return obj


def _eval_condition(do: DecisionObject, cond: PolicyCondition) -> bool:
    """Evaluate single condition against DecisionObject."""
    do_dict = do.model_dump()
    val = _get_nested(do_dict, cond.field)
    op = cond.operator
    target = cond.value

    if op == "exists" or op == "is_not_null":
        return val is not None
    if op == "not_exists" or op == "is_null":
        return val is None

    if val is None:
        return False

    if op == "equals":
        return val == target
    if op == "not_equals":
        return val != target
    if op == "greater_than":
        return isinstance(val, (int, float)) and val > target
    if op == "greater_than_or_equal":
        return isinstance(val, (int, float)) and val >= target
    if op == "less_than":
        return isinstance(val, (int, float)) and val < target
    if op == "less_than_or_equal":
        return isinstance(val, (int, float)) and val <= target
    if op == "in":
        return val in (target if isinstance(target, (list, tuple)) else [target])
    if op == "contains":
        return target in (val if isinstance(val, (list, tuple, str)) else [])
    return False


CORE_POLICIES: list[PolicyRule] = [
    # POL-RISK-HIGH-001
    PolicyRule(
        rule_id="POL-RISK-HIGH-001",
        version="2026.1",
        effective_date="2026-02-01",
        description="High risk response - notify and flag for expedited review",
        conditions=[
            PolicyCondition("verdict.risk_level", "equals", "HIGH"),
            PolicyCondition("verdict.confidence", "greater_than", 0.75),
        ],
        actions=[
            PolicyAction("notify_stakeholders", {"urgency": "high", "channels": ["dashboard"]}),
            PolicyAction("flag_for_review", {"review_type": "expedited", "sla_hours": 4}),
            PolicyAction("require_human_confirmation", {"approver_role": "senior_risk_officer"}),
        ],
    ),
    # POL-RISK-HIGH-002
    PolicyRule(
        rule_id="POL-RISK-HIGH-002",
        version="2026.1",
        effective_date="2026-02-01",
        description="High risk with dissent - escalate immediately",
        conditions=[
            PolicyCondition("verdict.risk_level", "equals", "HIGH"),
            PolicyCondition("dissent", "exists", True),
        ],
        actions=[
            PolicyAction("notify_stakeholders", {"urgency": "critical", "channels": ["dashboard", "email"]}),
            PolicyAction("flag_for_review", {"review_type": "immediate", "sla_hours": 1}),
            PolicyAction("require_human_confirmation", {"approver_role": "chief_risk_officer"}),
        ],
    ),
    # POL-RISK-MEDIUM-001
    PolicyRule(
        rule_id="POL-RISK-MEDIUM-001",
        version="2026.1",
        effective_date="2026-02-01",
        description="Medium risk - suggest review",
        conditions=[
            PolicyCondition("verdict.risk_level", "equals", "MEDIUM"),
            PolicyCondition("consensus.final_score", "greater_than", 0.5),
        ],
        actions=[
            PolicyAction("notify_stakeholders", {"urgency": "medium", "channels": ["dashboard"]}),
            PolicyAction("suggest_action", {"action_type": "review"}),
        ],
    ),
    # POL-RISK-LOW-001
    PolicyRule(
        rule_id="POL-RISK-LOW-001",
        version="2026.1",
        effective_date="2026-02-01",
        description="Low risk - monitor only",
        conditions=[
            PolicyCondition("verdict.risk_level", "equals", "LOW"),
        ],
        actions=[
            PolicyAction("log_to_audit", {"retention_days": 2555}),
        ],
    ),
    # POL-RECOMMEND-REDUCE-001
    PolicyRule(
        rule_id="POL-RECOMMEND-REDUCE-001",
        version="2026.1",
        effective_date="2026-02-01",
        description="Reduce recommendation - suggest hedge",
        conditions=[
            PolicyCondition("verdict.recommendation", "equals", "REDUCE"),
            PolicyCondition("verdict.confidence", "greater_than", 0.7),
        ],
        actions=[
            PolicyAction("suggest_hedge", {}),
            PolicyAction("notify_stakeholders", {"urgency": "high"}),
            PolicyAction("require_human_confirmation", {"approver_role": "portfolio_manager"}),
        ],
    ),
    # POL-RECOMMEND-ESCALATE-001
    PolicyRule(
        rule_id="POL-RECOMMEND-ESCALATE-001",
        version="2026.1",
        effective_date="2026-02-01",
        description="Escalate - board-level notification",
        conditions=[
            PolicyCondition("verdict.recommendation", "equals", "ESCALATE"),
        ],
        actions=[
            PolicyAction("notify_stakeholders", {"urgency": "critical", "channels": ["dashboard", "email"]}),
            PolicyAction("flag_for_review", {"review_type": "board", "sla_hours": 24}),
            PolicyAction("require_human_confirmation", {"approver_role": "board_member"}),
        ],
    ),
    # POL-CONFIDENCE-LOW-001
    PolicyRule(
        rule_id="POL-CONFIDENCE-LOW-001",
        version="2026.1",
        effective_date="2026-02-01",
        description="Low confidence - defer to human",
        conditions=[
            PolicyCondition("verdict.confidence", "less_than", 0.5),
        ],
        actions=[
            PolicyAction("require_human_confirmation", {"approver_role": "risk_analyst"}),
            PolicyAction("suggest_action", {"action_type": "gather_more_data"}),
        ],
    ),
    # POL-DISSENT-001
    PolicyRule(
        rule_id="POL-DISSENT-001",
        version="2026.1",
        effective_date="2026-02-01",
        description="Significant dissent - human review required",
        conditions=[
            PolicyCondition("dissent", "exists", True),
            PolicyCondition("dissent.dissent_strength", "greater_than", 0.3),
        ],
        actions=[
            PolicyAction("require_human_confirmation", {"approver_role": "senior_risk_officer"}),
            PolicyAction("notify_stakeholders", {"urgency": "medium"}),
        ],
    ),
    # POL-STRESS-TEST-001
    PolicyRule(
        rule_id="POL-STRESS-TEST-001",
        version="2026.1",
        effective_date="2026-02-01",
        description="Stress test scenario with high severity",
        conditions=[
            PolicyCondition("source_module", "equals", "stress_test"),
            PolicyCondition("consensus.final_score", "greater_than", 0.7),
        ],
        actions=[
            PolicyAction("notify_stakeholders", {"urgency": "high"}),
            PolicyAction("generate_report", {"report_type": "stress_test"}),
        ],
    ),
    # POL-CIP-001
    PolicyRule(
        rule_id="POL-CIP-001",
        version="2026.1",
        effective_date="2026-02-01",
        description="Critical infrastructure risk",
        conditions=[
            PolicyCondition("source_module", "equals", "cip"),
            PolicyCondition("verdict.risk_level", "in", ["HIGH", "CRITICAL"]),
        ],
        actions=[
            PolicyAction("notify_stakeholders", {"urgency": "high"}),
            PolicyAction("flag_for_review", {"review_type": "infrastructure"}),
        ],
    ),
    # POL-SCSS-001
    PolicyRule(
        rule_id="POL-SCSS-001",
        version="2026.1",
        effective_date="2026-02-01",
        description="Supply chain risk",
        conditions=[
            PolicyCondition("source_module", "equals", "scss"),
            PolicyCondition("verdict.risk_level", "equals", "HIGH"),
        ],
        actions=[
            PolicyAction("notify_stakeholders", {"urgency": "high"}),
            PolicyAction("suggest_action", {"action_type": "supply_chain_review"}),
        ],
    ),
    # POL-SRO-001
    PolicyRule(
        rule_id="POL-SRO-001",
        version="2026.1",
        effective_date="2026-02-01",
        description="Systemic risk - escalate to regulatory",
        conditions=[
            PolicyCondition("source_module", "equals", "sro"),
            PolicyCondition("verdict.risk_level", "equals", "HIGH"),
        ],
        actions=[
            PolicyAction("notify_stakeholders", {"urgency": "critical"}),
            PolicyAction("flag_for_review", {"review_type": "regulatory"}),
            PolicyAction("generate_report", {"report_type": "regulatory"}),
        ],
    ),
    # POL-AUDIT-ALL
    PolicyRule(
        rule_id="POL-AUDIT-ALL",
        version="2026.1",
        effective_date="2026-02-01",
        description="Log all decisions to audit (DORA 7-year retention)",
        conditions=[],
        actions=[
            PolicyAction("log_to_audit", {"retention_days": 2555}),
        ],
    ),
    # POL-HUMAN-GATE
    PolicyRule(
        rule_id="POL-HUMAN-GATE-001",
        version="2026.1",
        effective_date="2026-02-01",
        description="All high-risk require human confirmation",
        conditions=[
            PolicyCondition("verdict.human_confirmation_required", "equals", True),
        ],
        actions=[
            PolicyAction("require_human_confirmation", {"approver_role": "risk_officer"}),
        ],
    ),
    # POL-REPORT-GEN
    PolicyRule(
        rule_id="POL-REPORT-GEN-001",
        version="2026.1",
        effective_date="2026-02-01",
        description="Generate report for high-impact decisions",
        conditions=[
            PolicyCondition("verdict.risk_level", "equals", "HIGH"),
            PolicyCondition("verdict.confidence", "greater_than", 0.8),
        ],
        actions=[
            PolicyAction("generate_report", {"report_type": "risk_assessment"}),
        ],
    ),
]


def load_policies() -> list[PolicyRule]:
    """Return core policies (extensible for file-based loading)."""
    return list(CORE_POLICIES)


def evaluate_conditions(do: DecisionObject, rule: PolicyRule) -> bool:
    """Check if all conditions match. Empty conditions = always match."""
    if not rule.conditions:
        return True
    return all(_eval_condition(do, c) for c in rule.conditions)
