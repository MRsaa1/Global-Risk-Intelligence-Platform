"""ERF data models - risk tiers, extinction probabilities, domain contributions."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional
from uuid import uuid4


class RiskTier(str, Enum):
    """Risk classification tiers per ERF framework."""
    TIER_X = "X"     # Extinction-level (P > 1%)
    TIER_1 = "1"     # Catastrophic (P 0.1-1%)
    TIER_2 = "2"     # Severe (P 0.01-0.1%)
    TIER_3 = "3"     # Elevated (P < 0.01%)
    MONITOR = "M"    # Monitoring only


class RiskDomain(str, Enum):
    """Risk domains tracked by ERF."""
    AGI = "agi"
    BIOSECURITY = "biosecurity"
    NUCLEAR = "nuclear"
    CLIMATE = "climate"
    FINANCIAL = "financial"
    CYBER = "cyber"
    NANO = "nanotechnology"


@dataclass
class DomainContribution:
    """Single domain's contribution to aggregate risk."""
    domain: RiskDomain
    probability: float           # Domain-specific P(catastrophe)
    confidence: float = 0.5      # 0-1 confidence in estimate
    source_module: str = ""      # Which platform module provides this
    last_updated: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    key_drivers: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "domain": self.domain.value,
            "probability": self.probability,
            "confidence": self.confidence,
            "source_module": self.source_module,
            "last_updated": self.last_updated.isoformat(),
            "key_drivers": self.key_drivers,
        }


@dataclass
class CrossDomainCorrelation:
    """Correlation between two risk domains."""
    domain_a: RiskDomain
    domain_b: RiskDomain
    correlation: float      # -1 to 1
    mechanism: str = ""     # How they're linked
    evidence_strength: str = "moderate"  # weak/moderate/strong

    def to_dict(self) -> Dict[str, Any]:
        return {
            "domain_a": self.domain_a.value,
            "domain_b": self.domain_b.value,
            "correlation": self.correlation,
            "mechanism": self.mechanism,
            "evidence_strength": self.evidence_strength,
        }


@dataclass
class ExtinctionProbability:
    """Computed extinction probability for a given timeframe."""
    id: str = field(default_factory=lambda: str(uuid4()))
    timeframe_years: int = 100
    target_year: int = 2100
    p_extinction: float = 0.0
    p_catastrophe: float = 0.0   # > 10% population loss
    tier: RiskTier = RiskTier.MONITOR
    domain_contributions: List[DomainContribution] = field(default_factory=list)
    correlations_applied: List[CrossDomainCorrelation] = field(default_factory=list)
    monte_carlo_runs: int = 10_000
    confidence_interval: tuple = (0.0, 0.0)
    computed_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    methodology: str = "inclusion_exclusion_correlated"

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "timeframe_years": self.timeframe_years,
            "target_year": self.target_year,
            "p_extinction": round(self.p_extinction, 6),
            "p_catastrophe": round(self.p_catastrophe, 6),
            "tier": self.tier.value,
            "domain_contributions": [d.to_dict() for d in self.domain_contributions],
            "correlations_applied": [c.to_dict() for c in self.correlations_applied],
            "monte_carlo_runs": self.monte_carlo_runs,
            "confidence_interval": [round(x, 6) for x in self.confidence_interval],
            "computed_at": self.computed_at.isoformat(),
            "methodology": self.methodology,
        }
