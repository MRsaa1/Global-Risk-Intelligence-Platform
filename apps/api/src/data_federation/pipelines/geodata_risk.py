"""geodata_risk pipeline: USGS + Weather -> cities -> risk -> hotspots + network."""
from __future__ import annotations

from ..adapters.registry import get_adapter
from ..adapters.base import Region, TimeRange
from .base import BasePipeline, PipelineContext, PipelineResult


class GeodataRiskPipeline(BasePipeline):
    """Pipeline: USGS + Weather adapters -> GeoDataService -> hotspots + network."""

    @property
    def id(self) -> str:
        return "geodata_risk"

    @property
    def name(self) -> str:
        return "Geodata Risk"

    @property
    def description(self) -> str:
        return "USGS + Weather -> cities -> risk -> GeoJSON hotspots + network."

    async def run(self, context: PipelineContext) -> PipelineResult:
        region = context.region
        opts = context.options or {}
        scenario = context.scenario or opts.get("scenario")
        min_risk = float(opts.get("min_risk", 0.0))
        max_risk = float(opts.get("max_risk", 1.0))

        # Run adapters (orchestrate sources)
        usgs = get_adapter("usgs")
        weather = get_adapter("weather")
        if usgs:
            await usgs.fetch(region, context.time_range, days=opts.get("days", 365))
        if weather:
            await weather.fetch(region, context.time_range)

        # Use GeoDataService for aggregation
        from src.services.geo_data import geo_data_service

        await geo_data_service._ensure_risk_scores(
            force_recalculate=bool(opts.get("recalculate", False)),
        )
        hotspots = geo_data_service.get_risk_hotspots_geojson(
            min_risk=min_risk,
            max_risk=max_risk,
            scenario=scenario,
        )
        network = geo_data_service.get_risk_network_json()

        return PipelineResult(
            artifacts={"hotspots": hotspots, "network": network},
            meta={
                "scenario": scenario,
                "min_risk": min_risk,
                "max_risk": max_risk,
                "pipeline": self.id,
            },
            pipeline_id=self.id,
        )
