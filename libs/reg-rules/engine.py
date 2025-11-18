"""
Rules Engine - manages and executes regulatory rules.
"""

from typing import Any, Dict, List, Optional

from libs.dsl_schema.schema import Jurisdiction, RegulatoryFramework, RegulatoryRule
from libs.reg_rules.rules import (
    BaselIVRule,
    CECLRule,
    BaseRegulatoryRule,
    FRTBRule,
    IFRS9Rule,
    IRRBBRule,
    LCRRule,
    NSFRRule,
)


class RulesEngine:
    """Engine for managing and executing regulatory rules."""

    def __init__(self):
        self._rule_cache: Dict[str, BaseRegulatoryRule] = {}
        self._rule_factories = {
            RegulatoryFramework.BASEL_IV: BaselIVRule,
            RegulatoryFramework.FRTB_SA: lambda j, **kw: FRTBRule(j, approach="SA", **kw),
            RegulatoryFramework.FRTB_IMA: lambda j, **kw: FRTBRule(j, approach="IMA", **kw),
            RegulatoryFramework.IRRBB: IRRBBRule,
            RegulatoryFramework.LCR: LCRRule,
            RegulatoryFramework.NSFR: NSFRRule,
            RegulatoryFramework.CECL: CECLRule,
            RegulatoryFramework.IFRS_9: IFRS9Rule,
        }

    def get_rule(
        self,
        framework: RegulatoryFramework,
        jurisdiction: Jurisdiction,
        rule_version: str = "latest",
        parameters: Optional[Dict[str, Any]] = None,
    ) -> BaseRegulatoryRule:
        """Get or create a regulatory rule instance."""
        cache_key = f"{framework.value}:{jurisdiction.value}:{rule_version}"

        if cache_key not in self._rule_cache:
            factory = self._rule_factories.get(framework)
            if not factory:
                raise ValueError(f"Unsupported regulatory framework: {framework}")

            rule = factory(jurisdiction, rule_version=rule_version, parameters=parameters or {})
            self._rule_cache[cache_key] = rule

        return self._rule_cache[cache_key]

    def execute_rule(
        self,
        rule_config: RegulatoryRule,
        portfolio_data: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Execute a regulatory rule with given portfolio data."""
        if not rule_config.enabled:
            return {"status": "skipped", "reason": "rule_disabled"}

        rule = self.get_rule(
            rule_config.framework,
            rule_config.jurisdiction,
            rule_config.rule_version,
            rule_config.parameters,
        )

        # Validate required fields
        required_fields = rule.get_required_fields()
        missing_fields = [f for f in required_fields if f not in portfolio_data]
        if missing_fields:
            return {
                "status": "error",
                "error": f"Missing required fields: {missing_fields}",
            }

        try:
            result = rule.calculate(portfolio_data)
            result["status"] = "success"
            result["framework"] = rule_config.framework.value
            result["jurisdiction"] = rule_config.jurisdiction.value
            return result
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "framework": rule_config.framework.value,
            }

    def execute_rules(
        self,
        rules: List[RegulatoryRule],
        portfolio_data: Dict[str, Any],
    ) -> Dict[str, Dict[str, Any]]:
        """Execute multiple regulatory rules."""
        results = {}
        for rule in rules:
            if rule.enabled:
                rule_key = f"{rule.framework.value}_{rule.jurisdiction.value}"
                results[rule_key] = self.execute_rule(rule, portfolio_data)
        return results

    def clear_cache(self) -> None:
        """Clear the rule cache."""
        self._rule_cache.clear()

