"""Base pipeline and context/result types."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, Optional

from ..adapters.base import Region, TimeRange


@dataclass
class PipelineContext:
    """Context for pipeline execution."""

    region: Region
    scenario: Optional[str] = None
    time_range: Optional[TimeRange] = None
    options: Dict[str, Any] = field(default_factory=dict)


@dataclass
class PipelineResult:
    """Result of pipeline execution."""

    artifacts: Dict[str, Any] = field(default_factory=dict)
    meta: Dict[str, Any] = field(default_factory=dict)
    pipeline_id: str = ""

    def __post_init__(self) -> None:
        if not self.artifacts:
            self.artifacts = {}
        if not self.meta:
            self.meta = {}


class BasePipeline(ABC):
    """Abstract base for pipelines."""

    @property
    @abstractmethod
    def id(self) -> str:
        """Pipeline identifier (e.g. 'geodata_risk')."""
        ...

    @property
    def name(self) -> str:
        """Human-readable name."""
        return self.id

    @property
    def description(self) -> str:
        """Short description."""
        return ""

    @abstractmethod
    async def run(self, context: PipelineContext) -> PipelineResult:
        """Execute the pipeline."""
        ...
