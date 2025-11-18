"""
AI scenario generator - converts natural language to structured scenarios.
"""

import json
from typing import Any, Dict, List, Optional

import structlog
from openai import OpenAI

from libs.dsl_schema.schema import (
    CalculationStep,
    Jurisdiction,
    MarketShock,
    RegulatoryFramework,
    RegulatoryRule,
    ScenarioDSL,
    ScenarioMetadata,
    ShockType,
)

logger = structlog.get_logger(__name__)


class ScenarioGenerator:
    """Generate regulatory scenarios from natural language."""

    def __init__(
        self,
        openai_api_key: Optional[str] = None,
        model: str = "gpt-4",
        enable_fact_check: bool = True,
    ):
        """
        Initialize scenario generator.

        Args:
            openai_api_key: OpenAI API key (or use OPENAI_API_KEY env var)
            model: Model to use for generation
            enable_fact_check: Enable fact-checking of generated scenarios
        """
        self.client = OpenAI(api_key=openai_api_key)
        self.model = model
        self.enable_fact_check = enable_fact_check

    def generate(
        self,
        description: str,
        portfolio_id: str,
        jurisdiction: Jurisdiction = Jurisdiction.US_FED,
        frameworks: Optional[List[RegulatoryFramework]] = None,
    ) -> ScenarioDSL:
        """
        Generate scenario from natural language description.

        Args:
            description: Natural language scenario description
            portfolio_id: Target portfolio identifier
            jurisdiction: Regulatory jurisdiction
            frameworks: List of regulatory frameworks to include

        Returns:
            Generated ScenarioDSL
        """
        if frameworks is None:
            frameworks = [RegulatoryFramework.BASEL_IV, RegulatoryFramework.LCR]

        # Generate structured scenario using LLM
        prompt = self._build_prompt(description, jurisdiction, frameworks)
        response = self.client.chat.completions.create(
            model=self.model,
            messages=[
                {
                    "role": "system",
                    "content": "You are an expert in regulatory risk scenarios. Generate structured scenarios in JSON format.",
                },
                {"role": "user", "content": prompt},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
        )

        scenario_data = json.loads(response.choices[0].message.content)

        # Convert to ScenarioDSL
        scenario = self._parse_llm_response(scenario_data, portfolio_id, jurisdiction, frameworks)

        # Fact-check if enabled
        if self.enable_fact_check:
            issues = self._fact_check(scenario)
            if issues:
                logger.warning("Fact-check found issues", issues=issues)

        return scenario

    def _build_prompt(
        self,
        description: str,
        jurisdiction: Jurisdiction,
        frameworks: List[RegulatoryFramework],
    ) -> str:
        """Build prompt for LLM."""
        frameworks_str = ", ".join([f.value for f in frameworks])
        return f"""
Generate a regulatory stress scenario based on the following description:

Description: {description}

Jurisdiction: {jurisdiction.value}
Regulatory Frameworks: {frameworks_str}

Generate a JSON object with the following structure:
{{
  "name": "Scenario name",
  "description": "Detailed scenario description",
  "market_shocks": [
    {{
      "type": "interest_rate|fx|equity|credit_spread|commodity|volatility",
      "asset_class": "asset class identifier",
      "shock_value": 0.05 (or {{"key": value}} for vector shocks),
      "shock_type": "absolute|relative",
      "description": "Shock description"
    }}
  ],
  "calculation_steps": [
    {{
      "step_id": "step_identifier",
      "step_type": "regulatory_calculation",
      "inputs": [],
      "parameters": {{}}
    }}
  ],
  "outputs": ["step_identifier"]
}}

Ensure all shock values are realistic and consistent with the scenario description.
"""

    def _parse_llm_response(
        self,
        data: Dict[str, Any],
        portfolio_id: str,
        jurisdiction: Jurisdiction,
        frameworks: List[RegulatoryFramework],
    ) -> ScenarioDSL:
        """Parse LLM response into ScenarioDSL."""
        from datetime import datetime

        # Parse market shocks
        market_shocks = []
        for shock_data in data.get("market_shocks", []):
            shock = MarketShock(
                type=ShockType(shock_data["type"]),
                asset_class=shock_data["asset_class"],
                shock_value=shock_data["shock_value"],
                shock_type=shock_data.get("shock_type", "absolute"),
                description=shock_data.get("description"),
            )
            market_shocks.append(shock)

        # Create regulatory rules
        regulatory_rules = []
        for framework in frameworks:
            rule = RegulatoryRule(
                framework=framework,
                jurisdiction=jurisdiction,
                rule_version="latest",
            )
            regulatory_rules.append(rule)

        # Parse calculation steps
        calculation_steps = []
        for step_data in data.get("calculation_steps", []):
            step = CalculationStep(
                step_id=step_data["step_id"],
                step_type=step_data["step_type"],
                inputs=step_data.get("inputs", []),
                parameters=step_data.get("parameters", {}),
            )
            calculation_steps.append(step)

        # Create metadata
        metadata = ScenarioMetadata(
            scenario_id=f"generated_{portfolio_id}_{int(datetime.utcnow().timestamp())}",
            name=data.get("name", "Generated Scenario"),
            description=data.get("description"),
            author="AI Generator",
        )

        # Create scenario
        from libs.dsl_schema.schema import PortfolioReference

        scenario = ScenarioDSL(
            metadata=metadata,
            portfolio=PortfolioReference(
                portfolio_id=portfolio_id,
                as_of_date=datetime.utcnow(),
            ),
            market_shocks=market_shocks,
            regulatory_rules=regulatory_rules,
            calculation_steps=calculation_steps,
            outputs=data.get("outputs", []),
        )

        return scenario

    def _fact_check(self, scenario: ScenarioDSL) -> List[str]:
        """Fact-check generated scenario for consistency and realism."""
        issues = []

        # Check shock values are reasonable
        for shock in scenario.market_shocks:
            if isinstance(shock.shock_value, (int, float)):
                abs_value = abs(shock.shock_value)
                if shock.type == ShockType.INTEREST_RATE and abs_value > 0.10:
                    issues.append(f"Interest rate shock {abs_value} seems unusually large")
                elif shock.type == ShockType.FX and abs_value > 0.50:
                    issues.append(f"FX shock {abs_value} seems unusually large")
                elif shock.type == ShockType.EQUITY and abs_value > 0.30:
                    issues.append(f"Equity shock {abs_value} seems unusually large")

        # Check that outputs reference existing steps
        step_ids = {step.step_id for step in scenario.calculation_steps}
        for output_id in scenario.outputs:
            if output_id not in step_ids:
                issues.append(f"Output references non-existent step: {output_id}")

        return issues

