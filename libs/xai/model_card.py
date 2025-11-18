"""
Model cards for model risk governance (SR 11-7 / ECB TRIM compliant).
"""

from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field
import structlog

logger = structlog.get_logger(__name__)


class ModelCard(BaseModel):
    """Model card for model risk governance."""

    model_id: str
    model_name: str
    model_version: str
    model_type: str = Field(..., description="Type of model (PD, LGD, EAD, etc.)")
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: Optional[datetime] = None

    # Model details
    description: Optional[str] = None
    purpose: Optional[str] = None
    methodology: Optional[str] = None
    assumptions: List[str] = Field(default_factory=list)

    # Data
    training_data: Optional[Dict[str, Any]] = None
    validation_data: Optional[Dict[str, Any]] = None
    data_quality: Optional[Dict[str, Any]] = None

    # Performance
    performance_metrics: Optional[Dict[str, Any]] = None
    validation_results: Optional[Dict[str, Any]] = None
    backtesting_results: Optional[Dict[str, Any]] = None

    # Limitations
    limitations: List[str] = Field(default_factory=list)
    known_issues: List[str] = Field(default_factory=list)

    # Governance
    owner: Optional[str] = None
    approver: Optional[str] = None
    approval_date: Optional[datetime] = None
    review_frequency: str = Field(default="annual", description="Review frequency")
    next_review_date: Optional[datetime] = None

    # Compliance
    regulatory_framework: List[str] = Field(
        default_factory=list, description="e.g., SR 11-7, ECB TRIM"
    )
    compliance_status: str = Field(default="pending", description="pending, approved, rejected")

    def to_dict(self) -> Dict[str, Any]:
        """Convert model card to dictionary."""
        return self.model_dump(mode="json")

    def to_markdown(self) -> str:
        """Convert model card to Markdown format."""
        lines = [
            f"# Model Card: {self.model_name}",
            "",
            f"**Model ID:** {self.model_id}",
            f"**Version:** {self.model_version}",
            f"**Type:** {self.model_type}",
            "",
            "## Description",
            self.description or "N/A",
            "",
            "## Purpose",
            self.purpose or "N/A",
            "",
            "## Methodology",
            self.methodology or "N/A",
            "",
            "## Performance Metrics",
            self._format_dict(self.performance_metrics) if self.performance_metrics else "N/A",
            "",
            "## Limitations",
            "\n".join(f"- {lim}" for lim in self.limitations) if self.limitations else "None",
            "",
            "## Governance",
            f"**Owner:** {self.owner or 'N/A'}",
            f"**Approver:** {self.approver or 'N/A'}",
            f"**Approval Date:** {self.approval_date or 'N/A'}",
            "",
            "## Compliance",
            f"**Regulatory Framework:** {', '.join(self.regulatory_framework)}",
            f"**Status:** {self.compliance_status}",
        ]
        return "\n".join(lines)

    def _format_dict(self, d: Dict[str, Any]) -> str:
        """Format dictionary for Markdown."""
        lines = []
        for key, value in d.items():
            lines.append(f"- **{key}:** {value}")
        return "\n".join(lines)


def generate_model_card(
    model_id: str,
    model_name: str,
    model_version: str,
    model_type: str,
    **kwargs: Any,
) -> ModelCard:
    """
    Generate a model card with default values.

    Args:
        model_id: Unique model identifier
        model_name: Model name
        model_version: Model version
        model_type: Type of model
        **kwargs: Additional fields for model card

    Returns:
        ModelCard instance
    """
    return ModelCard(
        model_id=model_id,
        model_name=model_name,
        model_version=model_version,
        model_type=model_type,
        **kwargs,
    )

