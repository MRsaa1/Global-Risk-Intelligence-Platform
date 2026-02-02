"""climate_stress pipeline: CMIP6 + FEMA + optional NIM -> climate overlay."""
from __future__ import annotations

from ..adapters.registry import get_adapter
from .base import BasePipeline, PipelineContext, PipelineResult


class ClimateStressPipeline(BasePipeline):
    """Pipeline: CMIP6 + FEMA (+ optional NIM) -> climate overlay for stress scenarios."""

    @property
    def id(self) -> str:
        return "climate_stress"

    @property
    def name(self) -> str:
        return "Climate Stress"

    @property
    def description(self) -> str:
        return "CMIP6 + FEMA (+ NIM) -> climate risk overlay for stress tests."

    async def run(self, context: PipelineContext) -> PipelineResult:
        region = context.region
        opts = context.options or {}
        scenario = context.scenario or opts.get("scenario", "ssp245")
        time_horizon = int(opts.get("time_horizon", 2050))
        use_nim = bool(opts.get("use_nim", False))

        # Run adapters
        cmip6 = get_adapter("cmip6")
        fema = get_adapter("fema")
        results = {}
        if cmip6:
            r = await cmip6.fetch(
                region,
                context.time_range,
                scenarios=opts.get("scenarios") or [scenario],
            )
            results["cmip6"] = r.data
        if fema:
            r = await fema.fetch(region, context.time_range)
            results["fema"] = r.data
        if use_nim:
            nim = get_adapter("nim")
            if nim:
                r = await nim.fetch(region, context.time_range, **opts)
                results["nim"] = r.data

        # Build overlay compatible with get_climate_risk_overlay format
        from src.services.geo_data import geo_data_service

        await geo_data_service._ensure_risk_scores(force_recalculate=False)
        overlay = geo_data_service.get_climate_risk_overlay(
            scenario=scenario,
            time_horizon=time_horizon,
        )
        overlay["adapter_results"] = {
            k: v for k, v in results.items()
        }

        return PipelineResult(
            artifacts={"overlay": overlay},
            meta={
                "scenario": scenario,
                "time_horizon": time_horizon,
                "use_nim": use_nim,
                "pipeline": self.id,
            },
            pipeline_id=self.id,
        )
