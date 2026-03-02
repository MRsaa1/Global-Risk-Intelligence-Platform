"""
DAE Engine - Core policy evaluation.

Evaluates DecisionObjects against policy rules and dispatches actions.
"""
import logging
from dataclasses import dataclass, field
from typing import Optional

from src.models.decision_object import DecisionObject
from .policies import PolicyRule, load_policies, evaluate_conditions
from .actions import ActionExecutor, ActionResult

logger = logging.getLogger(__name__)


@dataclass
class PolicyEvaluation:
    """Result of evaluating a rule against a DecisionObject."""
    rule_id: str
    matched: bool
    actions_triggered: list[str] = field(default_factory=list)
    action_results: list[ActionResult] = field(default_factory=list)


class DAEEngine:
    """
    Decision-to-Action Engine.
    Evaluates DecisionObjects against policies and executes actions.
    """

    def __init__(self, policies: Optional[list[PolicyRule]] = None):
        self._policies = policies or load_policies()
        self._action_executor = ActionExecutor()

    async def evaluate(self, decision: DecisionObject) -> list[PolicyEvaluation]:
        """
        Evaluate DecisionObject against all policies.
        Returns list of PolicyEvaluation for matched rules.
        """
        evaluations: list[PolicyEvaluation] = []

        for rule in self._policies:
            if not evaluate_conditions(decision, rule):
                evaluations.append(PolicyEvaluation(rule_id=rule.rule_id, matched=False))
                continue

            actions_triggered: list[str] = []
            action_results: list[ActionResult] = []

            for action_def in rule.actions:
                result = await self._action_executor.execute(
                    action_def.action,
                    decision=decision,
                    params=action_def.params,
                )
                actions_triggered.append(action_def.action)
                action_results.append(result)
                if not result.success:
                    logger.warning("DAE action %s failed: %s", action_def.action, result.error)

            evaluations.append(
                PolicyEvaluation(
                    rule_id=rule.rule_id,
                    matched=True,
                    actions_triggered=actions_triggered,
                    action_results=action_results,
                )
            )

        return evaluations

    async def evaluate_and_audit(self, decision: DecisionObject) -> list[PolicyEvaluation]:
        """
        Evaluate policies and ensure POL-AUDIT-ALL always logs to audit.
        """
        evals = await self.evaluate(decision)
        # POL-AUDIT-ALL has no conditions so it always matches
        return evals
