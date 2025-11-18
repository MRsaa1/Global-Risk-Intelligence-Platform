"""
Core DSL schema definitions using Pydantic v2.
"""

from datetime import datetime
from enum import Enum
from typing import Any, Dict, List, Optional, Union

from pydantic import BaseModel, Field, field_validator


class Jurisdiction(str, Enum):
    """Supported regulatory jurisdictions."""

    US_FED = "US_FED"
    US_OCC = "US_OCC"
    ECB = "ECB"
    EBA = "EBA"
    PRA = "PRA"
    MAS = "MAS"
    FINMA = "FINMA"
    APRA = "APRA"


class RegulatoryFramework(str, Enum):
    """Supported regulatory frameworks."""

    BASEL_IV = "BASEL_IV"
    FRTB_SA = "FRTB_SA"
    FRTB_IMA = "FRTB_IMA"
    IRRBB = "IRRBB"
    CSRBB = "CSRBB"
    LCR = "LCR"
    NSFR = "NSFR"
    CECL = "CECL"
    IFRS_9 = "IFRS_9"
    CCAR = "CCAR"
    DFAST = "DFAST"


class ShockType(str, Enum):
    """Types of market shocks."""

    INTEREST_RATE = "interest_rate"
    FX = "fx"
    EQUITY = "equity"
    CREDIT_SPREAD = "credit_spread"
    COMMODITY = "commodity"
    VOLATILITY = "volatility"
    CORRELATION = "correlation"
    CUSTOM = "custom"


class MarketShock(BaseModel):
    """Market shock definition."""

    type: ShockType
    asset_class: str = Field(..., description="Asset class identifier")
    shock_value: Union[float, Dict[str, float]] = Field(
        ..., description="Shock value(s) - can be scalar or vector"
    )
    shock_type: str = Field(
        default="absolute", description="absolute or relative"
    )
    effective_date: Optional[datetime] = None
    description: Optional[str] = None

    @field_validator("shock_value")
    @classmethod
    def validate_shock_value(cls, v: Union[float, Dict[str, float]]) -> Union[float, Dict[str, float]]:
        """Validate shock value is numeric or dict of numerics."""
        if isinstance(v, dict):
            for key, val in v.items():
                if not isinstance(val, (int, float)):
                    raise ValueError(f"Shock value for {key} must be numeric")
        elif not isinstance(v, (int, float)):
            raise ValueError("Shock value must be numeric")
        return v


class RegulatoryRule(BaseModel):
    """Regulatory rule configuration."""

    framework: RegulatoryFramework
    jurisdiction: Jurisdiction
    rule_version: str = Field(default="latest", description="Rule version identifier")
    parameters: Dict[str, Any] = Field(default_factory=dict)
    enabled: bool = True


class PortfolioReference(BaseModel):
    """Reference to a portfolio for calculation."""

    portfolio_id: str
    as_of_date: datetime
    filters: Optional[Dict[str, Any]] = Field(
        default=None, description="Optional filters for portfolio subset"
    )


class CalculationStep(BaseModel):
    """Single step in calculation workflow."""

    step_id: str
    step_type: str = Field(..., description="Type of calculation step")
    inputs: List[str] = Field(
        default_factory=list, description="Dependencies on other steps"
    )
    parameters: Dict[str, Any] = Field(default_factory=dict)
    rule: Optional[RegulatoryRule] = None


class ScenarioMetadata(BaseModel):
    """Metadata for a scenario."""

    scenario_id: str
    name: str
    description: Optional[str] = None
    author: Optional[str] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None
    tags: List[str] = Field(default_factory=list)
    version: str = "1.0.0"


class ScenarioDSL(BaseModel):
    """Main scenario DSL schema."""

    metadata: ScenarioMetadata
    portfolio: PortfolioReference
    market_shocks: List[MarketShock] = Field(default_factory=list)
    regulatory_rules: List[RegulatoryRule] = Field(default_factory=list)
    calculation_steps: List[CalculationStep] = Field(default_factory=list)
    outputs: List[str] = Field(
        default_factory=list, description="Requested output metrics"
    )

    @classmethod
    def from_yaml(cls, file_path: str) -> "ScenarioDSL":
        """Load scenario from YAML file."""
        import yaml

        with open(file_path, "r", encoding="utf-8") as f:
            data = yaml.safe_load(f)
        return cls(**data)

    def to_yaml(self, file_path: str) -> None:
        """Save scenario to YAML file."""
        import yaml

        with open(file_path, "w", encoding="utf-8") as f:
            yaml.dump(self.model_dump(mode="json"), f, default_flow_style=False, allow_unicode=True)

    def validate(self) -> List[str]:
        """Validate scenario consistency and return list of errors."""
        errors = []

        # Check that all step inputs reference existing steps
        step_ids = {step.step_id for step in self.calculation_steps}
        for step in self.calculation_steps:
            for input_id in step.inputs:
                if input_id not in step_ids:
                    errors.append(
                        f"Step {step.step_id} references non-existent input: {input_id}"
                    )

        # Check that outputs reference existing steps
        for output_id in self.outputs:
            if output_id not in step_ids:
                errors.append(f"Output references non-existent step: {output_id}")

        return errors

