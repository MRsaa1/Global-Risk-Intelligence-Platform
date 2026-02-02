"""Pipeline runner: run by id, list pipelines."""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from .base import BasePipeline, PipelineContext, PipelineResult
from .geodata_risk import GeodataRiskPipeline
from .climate_stress import ClimateStressPipeline
from .weather_forecast import WeatherForecastPipeline
from ..adapters.base import Region, TimeRange


_PIPELINES: Dict[str, BasePipeline] = {
    "geodata_risk": GeodataRiskPipeline(),
    "climate_stress": ClimateStressPipeline(),
    "weather_forecast": WeatherForecastPipeline(),
}


def get_pipeline(pipeline_id: str) -> Optional[BasePipeline]:
    """Return pipeline by id, or None."""
    return _PIPELINES.get(pipeline_id)


def list_pipelines() -> List[Dict[str, Any]]:
    """List all pipelines with id, name, description."""
    return [
        {
            "id": p.id,
            "name": p.name,
            "description": p.description,
        }
        for p in _PIPELINES.values()
    ]


async def run_pipeline(
    pipeline_id: str,
    context: PipelineContext,
) -> Optional[PipelineResult]:
    """Execute pipeline by id. Returns None if not found."""
    p = get_pipeline(pipeline_id)
    if not p:
        return None
    return await p.run(context)
