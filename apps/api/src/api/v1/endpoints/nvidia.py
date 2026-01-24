"""
NVIDIA Integration endpoints - Earth-2, PhysicsNeMo, and NIM inference.
"""
from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings
from src.core.database import get_db
from src.core.security import get_current_active_user
from src.models.asset import Asset
from src.models.user import User
from src.services.nvidia_earth2 import earth2_service, Earth2Model
from src.services.nvidia_physics_nemo import physics_nemo_service

router = APIRouter()


# ==================== TEST ENDPOINT (no auth) ====================

@router.post("/test/chat")
async def test_nvidia_chat(message: str = "Hello, how are you?"):
    """
    Test NVIDIA LLM endpoint (no auth required).
    For development and testing only.
    """
    import httpx
    
    api_key = settings.nvidia_api_key
    if not api_key:
        return {"error": "NVIDIA_API_KEY not configured"}
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                "https://integrate.api.nvidia.com/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": "meta/llama-3.1-8b-instruct",
                    "messages": [{"role": "user", "content": message}],
                    "max_tokens": 256,
                },
            )
            
            if response.status_code != 200:
                return {
                    "error": f"NVIDIA API error: {response.status_code}",
                    "detail": response.text[:500],
                }
            
            data = response.json()
            return {
                "status": "success",
                "model": "meta/llama-3.1-8b-instruct",
                "response": data.get("choices", [{}])[0].get("message", {}).get("content", ""),
            }
    except Exception as e:
        return {"error": str(e)}


# ==================== EARTH-2 ENDPOINTS ====================

class WeatherForecastRequest(BaseModel):
    """Request for weather forecast."""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    forecast_hours: int = Field(default=72, ge=1, le=168)
    model: str = Field(default="fourcastnet")


class ClimateProjectionRequest(BaseModel):
    """Request for climate projection."""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    scenario: str = Field(default="ssp245")
    time_horizon: int = Field(default=2050, ge=2025, le=2100)
    model: str = Field(default="climate")


@router.post("/earth2/forecast")
async def get_weather_forecast(
    request: WeatherForecastRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    Get weather forecast from NVIDIA Earth-2.
    
    Uses FourCastNet model for high-resolution weather forecasting.
    """
    try:
        model = Earth2Model(request.model)
    except ValueError:
        raise HTTPException(status_code=400, detail=f"Invalid model: {request.model}")
    
    forecasts = await earth2_service.get_weather_forecast(
        latitude=request.latitude,
        longitude=request.longitude,
        forecast_hours=request.forecast_hours,
        model=model,
    )
    
    return {
        "latitude": request.latitude,
        "longitude": request.longitude,
        "forecast_hours": request.forecast_hours,
        "model": request.model,
        "forecasts": [
            {
                "forecast_time": f.forecast_time.isoformat(),
                "temperature_c": f.temperature_c,
                "precipitation_mm": f.precipitation_mm,
                "wind_speed_ms": f.wind_speed_ms,
                "wind_direction_deg": f.wind_direction_deg,
                "humidity_percent": f.humidity_percent,
                "pressure_hpa": f.pressure_hpa,
                "confidence": f.confidence,
            }
            for f in forecasts
        ],
    }


@router.post("/earth2/climate/project")
async def get_climate_projection(
    request: ClimateProjectionRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    Get climate projection from NVIDIA Earth-2.
    
    Uses CMIP6 downscaling for high-resolution climate projections.
    """
    projection = await earth2_service.get_climate_projection(
        latitude=request.latitude,
        longitude=request.longitude,
        scenario=request.scenario,
        time_horizon=request.time_horizon,
    )
    
    return {
        "latitude": projection.latitude,
        "longitude": projection.longitude,
        "scenario": projection.scenario,
        "time_horizon": projection.time_horizon,
        "temperature_change_c": projection.temperature_change_c,
        "precipitation_change_pct": projection.precipitation_change_pct,
        "extreme_heat_days": projection.extreme_heat_days,
        "extreme_precipitation_days": projection.extreme_precipitation_days,
        "sea_level_rise_m": projection.sea_level_rise_m,
        "confidence": projection.confidence,
    }


# ==================== PHYSICSNEMO ENDPOINTS ====================

class FloodSimulationRequest(BaseModel):
    """Request for flood simulation."""
    asset_id: str
    flood_depth_m: float = Field(..., ge=0)
    flood_velocity_ms: float = Field(default=0.5, ge=0)
    flood_duration_hours: float = Field(default=24, ge=0)
    use_physics_nemo: bool = Field(default=True)


class StructuralSimulationRequest(BaseModel):
    """Request for structural simulation."""
    asset_id: str
    magnitude: float = Field(..., ge=0, le=10)
    distance_km: float = Field(..., ge=0)
    simulation_type: str = Field(default="earthquake")  # earthquake or wind


@router.post("/physics-nemo/flood")
async def simulate_flood_physics_nemo(
    request: FloodSimulationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Simulate flood using NVIDIA PhysicsNeMo.
    
    Provides high-accuracy flood hydrodynamics simulation.
    """
    # Get asset
    result = await db.execute(
        select(Asset).where(Asset.id == request.asset_id)
    )
    asset = result.scalar_one_or_none()
    
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    # Get BIM geometry if available
    geometry = None
    if asset.bim_file_path:
        # In production, load and parse BIM file
        geometry = {
            "type": "building",
            "floors": asset.floors_above_ground or 1,
            "area_m2": asset.gross_floor_area_m2 or 1000,
        }
    
    if request.use_physics_nemo and geometry:
        result = await physics_nemo_service.simulate_flood(
            geometry=geometry,
            flood_input={
                "depth_m": request.flood_depth_m,
                "velocity_ms": request.flood_velocity_ms,
                "duration_hours": request.flood_duration_hours,
            },
            building_properties={
                "type": asset.asset_type.value,
                "basement_present": True,  # Would extract from BIM
            },
        )
        
        return {
            "asset_id": request.asset_id,
            "simulation_type": "physics_nemo",
            "max_depth_m": result.max_depth_m,
            "velocity_ms": result.velocity_ms,
            "duration_hours": result.duration_hours,
            "damage_ratio": result.damage_ratio,
            "confidence": result.confidence,
            "computation_time_ms": result.computation_time_ms,
        }
    else:
        # Fallback to simplified model
        from src.layers.simulation.physics_engine import physics_engine
        
        result = await physics_engine.simulate_flood(
            asset_id=request.asset_id,
            flood_depth_m=request.flood_depth_m,
            flood_velocity_ms=request.flood_velocity_ms,
            flood_duration_hours=request.flood_duration_hours,
            building_type=asset.asset_type.value,
            property_value=asset.current_valuation or 10_000_000,
            use_physics_nemo=False,
        )
        
        return {
            "asset_id": request.asset_id,
            "simulation_type": "simplified",
            "max_depth_m": result.max_depth_m,
            "velocity_ms": result.velocity_ms,
            "duration_hours": result.duration_hours,
            "damage_ratio": result.damage_ratio,
            "confidence": 0.75,
        }


@router.post("/physics-nemo/structural")
async def simulate_structural_physics_nemo(
    request: StructuralSimulationRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    Simulate structural response using NVIDIA PhysicsNeMo.
    
    Supports earthquake and wind loading simulations.
    """
    # Get asset
    result = await db.execute(
        select(Asset).where(Asset.id == request.asset_id)
    )
    asset = result.scalar_one_or_none()
    
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    geometry = {
        "type": "building",
        "floors": asset.floors_above_ground or 1,
        "area_m2": asset.gross_floor_area_m2 or 1000,
    }
    
    if request.simulation_type == "earthquake":
        nemo_result = await physics_nemo_service.simulate_earthquake(
            geometry=geometry,
            earthquake_input={
                "magnitude": request.magnitude,
                "distance_km": request.distance_km,
            },
            structural_properties={
                "type": asset.asset_type.value,
                "year_built": asset.year_built or 2000,
            },
        )
    else:  # wind
        nemo_result = await physics_nemo_service.simulate_wind(
            geometry=geometry,
            wind_input={
                "speed_ms": request.magnitude * 10,  # Convert magnitude to wind speed
            },
            structural_properties={
                "type": asset.asset_type.value,
            },
        )
    
    return {
        "asset_id": request.asset_id,
        "simulation_type": "physics_nemo",
        "damage_ratio": nemo_result.damage_ratio,
        "stress_max_mpa": nemo_result.stress_max_mpa,
        "displacement_max_mm": nemo_result.displacement_max_mm,
        "safety_factor": nemo_result.safety_factor,
        "confidence": nemo_result.confidence,
        "computation_time_ms": nemo_result.computation_time_ms,
    }


# ==================== NIM ENDPOINTS (Local Inference) ====================

from src.services.nvidia_nim import nim_service
from src.services.nvidia_flux import flux_service
from src.services.nvidia_llm import llm_service, LLMModel


@router.get("/nim/health")
async def check_nim_health():
    """
    Check health of local NVIDIA NIM services.
    """
    fourcastnet_healthy = await nim_service.check_health("fourcastnet")
    corrdiff_healthy = await nim_service.check_health("corrdiff")
    
    return {
        "fourcastnet": {
            "status": "healthy" if fourcastnet_healthy else "unavailable",
            "url": "http://localhost:8001",
        },
        "corrdiff": {
            "status": "healthy" if corrdiff_healthy else "unavailable",
            "url": "http://localhost:8000",
        },
    }


class NIMForecastRequest(BaseModel):
    """Request for NIM-based weather forecast."""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    simulation_length: int = Field(default=4, ge=1, le=40)  # 6-hour steps


@router.post("/nim/fourcastnet/forecast")
async def nim_weather_forecast(
    request: NIMForecastRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    Get weather forecast using local FourCastNet NIM.
    
    Runs inference on local GPU for maximum performance and privacy.
    Each step is 6 hours, so simulation_length=4 gives 24-hour forecast.
    """
    import numpy as np
    from datetime import datetime
    
    # Create mock input data (in production, fetch from ARCO/ERA5)
    input_data = np.random.randn(1, 1, 73, 721, 1440).astype('float32')
    input_time = datetime.utcnow()
    
    forecasts = await nim_service.fourcastnet_forecast(
        input_data=input_data,
        input_time=input_time,
        simulation_length=request.simulation_length,
    )
    
    if not forecasts:
        raise HTTPException(status_code=503, detail="FourCastNet NIM unavailable")
    
    # Extract point forecast for requested location
    lat_idx = int((request.latitude + 90) / 180 * 720)
    lon_idx = int(request.longitude / 360 * 1440) % 1440
    
    return {
        "latitude": request.latitude,
        "longitude": request.longitude,
        "input_time": input_time.isoformat(),
        "model": "fourcastnet-nim",
        "forecasts": [
            {
                "forecast_time": f.time.isoformat(),
                "lead_hours": f.lead_hours,
                "temperature_k": float(f.temperature_2m[lat_idx, lon_idx]),
                "wind_u_ms": float(f.wind_u_10m[lat_idx, lon_idx]),
                "wind_v_ms": float(f.wind_v_10m[lat_idx, lon_idx]),
                "precipitation_mm": float(f.precipitation[lat_idx, lon_idx]),
            }
            for f in forecasts
        ],
    }


class NIMDownscaleRequest(BaseModel):
    """Request for CorrDiff downscaling."""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    samples: int = Field(default=2, ge=1, le=10)
    steps: int = Field(default=12, ge=1, le=50)


@router.post("/nim/corrdiff/downscale")
async def nim_climate_downscale(
    request: NIMDownscaleRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    Get high-resolution climate data using local CorrDiff NIM.
    
    Downscales coarse climate data to high resolution using diffusion models.
    """
    import numpy as np
    
    # Create mock input data (in production, fetch from GEFS)
    input_data = np.random.randn(1, 1, 38, 129, 301).astype('float32')
    
    output = await nim_service.corrdiff_downscale(
        input_data=input_data,
        samples=request.samples,
        steps=request.steps,
    )
    
    if not output:
        raise HTTPException(status_code=503, detail="CorrDiff NIM unavailable")
    
    # Return summary statistics
    return {
        "latitude": request.latitude,
        "longitude": request.longitude,
        "samples": output.samples,
        "model": "corrdiff-nim",
        "temperature_2m": {
            "mean": float(np.mean(output.temperature_2m)),
            "std": float(np.std(output.temperature_2m)),
            "min": float(np.min(output.temperature_2m)),
            "max": float(np.max(output.temperature_2m)),
        },
        "precipitation": {
            "mean": float(np.mean(output.precipitation)),
            "std": float(np.std(output.precipitation)),
            "min": float(np.min(output.precipitation)),
            "max": float(np.max(output.precipitation)),
        },
    }


# ==================== FLUX ENDPOINTS (Image Generation for REPORTER) ====================

class ImageGenerationRequest(BaseModel):
    """Request for FLUX image generation."""
    prompt: str = Field(..., min_length=1, max_length=1000)
    mode: str = Field(default="base")  # base, canny, depth
    width: int = Field(default=1024, ge=256, le=2048)
    height: int = Field(default=1024, ge=256, le=2048)
    steps: int = Field(default=50, ge=1, le=100)
    seed: Optional[int] = None


class DamageVisualizationRequest(BaseModel):
    """Request for building damage visualization."""
    building_type: str = Field(default="commercial office")
    damage_type: str = Field(default="flood")  # flood, earthquake, fire, wind
    damage_severity: float = Field(default=0.5, ge=0, le=1)


@router.get("/flux/health")
async def check_flux_health():
    """Check health of FLUX NIM service."""
    is_healthy = await flux_service.check_nim_health()
    
    return {
        "status": "healthy" if is_healthy else "unavailable",
        "url": "http://localhost:8002",
        "model": "flux.1-dev",
    }


@router.post("/flux/generate")
async def generate_image(
    request: ImageGenerationRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    Generate an image using FLUX.1-dev.
    
    Used by REPORTER agent for report visualizations.
    """
    image = await flux_service.generate_image(
        prompt=request.prompt,
        mode=request.mode,
        width=request.width,
        height=request.height,
        steps=request.steps,
        seed=request.seed,
    )
    
    if not image:
        raise HTTPException(status_code=503, detail="FLUX service unavailable")
    
    return {
        "prompt": image.prompt,
        "width": image.width,
        "height": image.height,
        "seed": image.seed,
        "base64": image.base64_data,
    }


@router.post("/flux/damage-visualization")
async def generate_damage_visualization(
    request: DamageVisualizationRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    Generate building damage visualization for reports.
    
    Used by REPORTER agent to illustrate risk scenarios.
    """
    image = await flux_service.generate_building_damage_visualization(
        building_type=request.building_type,
        damage_type=request.damage_type,
        damage_severity=request.damage_severity,
    )
    
    if not image:
        raise HTTPException(status_code=503, detail="FLUX service unavailable")
    
    return {
        "building_type": request.building_type,
        "damage_type": request.damage_type,
        "damage_severity": request.damage_severity,
        "width": image.width,
        "height": image.height,
        "base64": image.base64_data,
    }


# ==================== LLM ENDPOINTS (Agent Intelligence) ====================

class LLMChatRequest(BaseModel):
    """Request for LLM chat completion."""
    prompt: str = Field(..., min_length=1)
    model: str = Field(default="meta/llama-3.1-70b-instruct")
    max_tokens: int = Field(default=2048, ge=1, le=4096)
    temperature: float = Field(default=0.7, ge=0, le=1)
    system_prompt: Optional[str] = None


class SentinelAlertRequest(BaseModel):
    """Request for SENTINEL alert generation."""
    event_type: str
    severity: str = Field(default="medium")  # low, medium, high, critical
    details: str


class AnalystRequest(BaseModel):
    """Request for ANALYST deep dive."""
    asset_id: str
    include_simulations: bool = Field(default=True)


class AdvisorRequest(BaseModel):
    """Request for ADVISOR recommendations."""
    asset_id: str
    budget_eur: float = Field(default=1_000_000, ge=0)


@router.post("/llm/chat")
async def llm_chat(
    request: LLMChatRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    Chat completion using NVIDIA LLM.
    
    Uses cloud API (no GPU required on server).
    Available models:
    - meta/llama-3.1-70b-instruct (best quality)
    - meta/llama-3.1-8b-instruct (fastest)
    - mistralai/mixtral-8x22b-instruct-v0.1 (multi-expert)
    """
    try:
        model = LLMModel(request.model)
    except ValueError:
        model = LLMModel.LLAMA_70B
    
    response = await llm_service.generate(
        prompt=request.prompt,
        model=model,
        max_tokens=request.max_tokens,
        temperature=request.temperature,
        system_prompt=request.system_prompt,
    )
    
    return {
        "content": response.content,
        "model": response.model,
        "tokens_used": response.tokens_used,
        "finish_reason": response.finish_reason,
    }


@router.post("/agents/sentinel/alert")
async def sentinel_generate_alert(
    request: SentinelAlertRequest,
    current_user: User = Depends(get_current_active_user),
):
    """
    SENTINEL Agent: Generate risk alert message.
    
    Uses fast Llama 8B for real-time alert generation.
    """
    alert = await llm_service.sentinel_alert(
        event_type=request.event_type,
        severity=request.severity,
        details=request.details,
    )
    
    return {
        "agent": "SENTINEL",
        "event_type": request.event_type,
        "severity": request.severity,
        "alert_message": alert,
    }


@router.post("/agents/analyst/analyze")
async def analyst_deep_dive(
    request: AnalystRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    ANALYST Agent: Generate deep risk analysis.
    
    Uses Llama 70B for complex reasoning.
    """
    # Get asset
    result = await db.execute(
        select(Asset).where(Asset.id == request.asset_id)
    )
    asset = result.scalar_one_or_none()
    
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    risk_data = {
        "climate_risk_score": asset.climate_risk_score or 0,
        "physical_risk_score": asset.physical_risk_score or 0,
        "network_risk_score": asset.network_risk_score or 0,
        "valuation_eur": asset.current_valuation or 0,
        "asset_type": asset.asset_type.value,
        "year_built": asset.year_built or "unknown",
    }
    
    simulation_results = {}
    if request.include_simulations:
        # Would run actual simulations here
        simulation_results = {
            "flood_damage_ratio": 0.15,
            "earthquake_damage_ratio": 0.08,
            "value_at_risk_1y": risk_data["valuation_eur"] * 0.05,
        }
    
    analysis = await llm_service.analyst_deep_dive(
        asset_name=asset.name,
        risk_data=risk_data,
        simulation_results=simulation_results,
    )
    
    return {
        "agent": "ANALYST",
        "asset_id": request.asset_id,
        "asset_name": asset.name,
        "analysis": analysis,
        "risk_data": risk_data,
        "simulation_results": simulation_results,
    }


@router.post("/agents/advisor/recommend")
async def advisor_recommendations(
    request: AdvisorRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_active_user),
):
    """
    ADVISOR Agent: Generate investment recommendations.
    
    Uses Llama 70B for strategic recommendations.
    """
    # Get asset
    result = await db.execute(
        select(Asset).where(Asset.id == request.asset_id)
    )
    asset = result.scalar_one_or_none()
    
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    
    risk_summary = f"Climate risk: {asset.climate_risk_score or 0}/100, Physical: {asset.physical_risk_score or 0}/100"
    
    # Sample mitigation options
    options = [
        {"name": "Flood barriers installation", "cost": 150_000, "benefit": "Reduce flood damage by 80%"},
        {"name": "Roof reinforcement", "cost": 80_000, "benefit": "Reduce wind damage by 60%"},
        {"name": "Drainage upgrade", "cost": 50_000, "benefit": "Reduce water damage by 40%"},
        {"name": "Emergency systems", "cost": 30_000, "benefit": "Reduce response time by 70%"},
    ]
    
    recommendations = await llm_service.advisor_recommendations(
        asset_name=asset.name,
        risk_summary=risk_summary,
        budget_eur=request.budget_eur,
        options=options,
    )
    
    return {
        "agent": "ADVISOR",
        "asset_id": request.asset_id,
        "asset_name": asset.name,
        "budget_eur": request.budget_eur,
        "recommendations": recommendations,
        "options_evaluated": options,
    }


# ==================== STRESS TEST REPORT WITH LLM ====================

class StressReportRequest(BaseModel):
    """Request for LLM-generated stress test report."""
    event_name: str
    event_type: str
    city_name: str
    severity: float = Field(default=0.5, ge=0, le=1)
    total_loss: float = Field(default=0)
    total_buildings: int = Field(default=0)
    total_population: int = Field(default=0)
    zones: list[dict] = Field(default=[])


@router.post("/llm/stress-report")
async def generate_stress_report_llm(
    request: StressReportRequest,
):
    """
    Generate LLM-powered stress test report.
    
    Uses NVIDIA Llama 3.1 to generate:
    - Executive summary
    - Mitigation recommendations
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Format zones for prompt
    zones_text = "\n".join([
        f"- {z.get('label', 'Zone')}: {z.get('risk_level', 'unknown').upper()} "
        f"(Buildings: {z.get('affected_buildings', 0)}, Loss: €{z.get('estimated_loss', 0)}M)"
        for z in request.zones[:5]
    ])
    
    # Generate executive summary
    summary_prompt = f"""Analyze this stress test scenario and provide a professional executive summary (2-3 paragraphs).

Stress Test: {request.event_name}
Type: {request.event_type}
Location: {request.city_name}
Severity: {request.severity:.0%}

Impact Assessment:
- Total Expected Loss: €{request.total_loss:,.0f}M
- Buildings Affected: {request.total_buildings:,}
- Population Impacted: {request.total_population:,}

Identified Risk Zones:
{zones_text}

Provide:
1. Executive summary of the risk scenario and its implications
2. Key findings with quantitative metrics
3. Immediate priorities for stakeholders

IMPORTANT: Write in plain text only. Do NOT use any markdown formatting such as asterisks, bold, headers, or bullet points with dashes.
Use professional risk management language. Be concise but comprehensive. Write in English."""

    try:
        summary_response = await llm_service.generate(
            prompt=summary_prompt,
            model=LLMModel.LLAMA_70B,
            max_tokens=600,
            temperature=0.3,
        )
        
        executive_summary = summary_response.content
        
        # Remove markdown formatting
        if executive_summary:
            import re
            # Remove bold/italic markers
            executive_summary = re.sub(r'\*\*([^*]+)\*\*', r'\1', executive_summary)
            executive_summary = re.sub(r'\*([^*]+)\*', r'\1', executive_summary)
            executive_summary = re.sub(r'__([^_]+)__', r'\1', executive_summary)
            executive_summary = re.sub(r'_([^_]+)_', r'\1', executive_summary)
            # Remove markdown headers
            executive_summary = re.sub(r'^#{1,6}\s*', '', executive_summary, flags=re.MULTILINE)
            # Clean up multiple newlines
            executive_summary = re.sub(r'\n{3,}', '\n\n', executive_summary)
            executive_summary = executive_summary.strip()
        
        if summary_response.finish_reason == "mock":
            executive_summary = None
            logger.warning("LLM returned mock response")
        else:
            logger.info(f"LLM generated executive summary ({summary_response.tokens_used} tokens)")
            
    except Exception as e:
        logger.error(f"LLM summary error: {e}")
        executive_summary = None
    
    # Generate mitigation actions
    mitigation_actions = []
    
    try:
        actions_prompt = f"""Generate 5 specific mitigation actions for this {request.event_type} risk scenario in {request.city_name}.

Event: {request.event_name}
Severity: {request.severity:.0%}
Expected Loss: €{request.total_loss:,.0f}M

Provide exactly 5 concise action items, each on a new line. Start each with a verb.
Write in plain text only. Do NOT use markdown formatting, asterisks, or special symbols.
Write in English only."""

        actions_response = await llm_service.generate(
            prompt=actions_prompt,
            model=LLMModel.LLAMA_8B,
            max_tokens=250,
            temperature=0.4,
        )
        
        if actions_response.finish_reason != "mock":
            import re
            # Parse actions from response and remove markdown
            lines = []
            for line in actions_response.content.split('\n'):
                line = line.strip().lstrip('•-1234567890. ')
                # Remove markdown bold/italic
                line = re.sub(r'\*\*([^*]+)\*\*', r'\1', line)
                line = re.sub(r'\*([^*]+)\*', r'\1', line)
                if line and len(line) > 10:
                    lines.append(line)
            mitigation_actions = lines[:5]
            logger.info(f"LLM generated {len(mitigation_actions)} actions")
            
    except Exception as e:
        logger.error(f"LLM actions error: {e}")
    
    return {
        "executive_summary": executive_summary,
        "mitigation_actions": mitigation_actions,
        "llm_model": "meta/llama-3.1-70b-instruct",
        "generated": executive_summary is not None,
    }
