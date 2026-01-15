"""
NVIDIA Stress Test Pipeline - Unified integration for stress testing.

Combines:
- Earth-2: Weather forecasting and climate data
- PhysicsNeMo: Physics-based simulations (flood, seismic, fire)
- LLM: Report generation and recommendations
- FLUX: Visualization generation (optional)

All services have automatic fallback to mock data if API unavailable.
"""
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional, List, Dict, Any
from enum import Enum

from src.services.nvidia_earth2 import earth2_service, WeatherForecast, ClimateProjection
from src.services.nvidia_physics_nemo import physics_nemo_service, FloodSimulationResult, StructuralSimulationResult
from src.services.nvidia_llm import llm_service, LLMModel
from src.services.risk_zone_calculator import EventCategory

logger = logging.getLogger(__name__)


class PipelineStage(str, Enum):
    """Pipeline execution stages."""
    WEATHER = "weather"
    PHYSICS = "physics"
    RISK_CALC = "risk_calculation"
    LLM_ANALYSIS = "llm_analysis"
    COMPLETE = "complete"


@dataclass
class WeatherContext:
    """Weather context for stress test."""
    temperature_c: float = 20.0
    precipitation_mm: float = 0.0
    wind_speed_ms: float = 5.0
    humidity_percent: float = 60.0
    pressure_hpa: float = 1013.0
    forecast_hours: int = 72
    is_mock: bool = True
    extreme_weather: bool = False
    weather_risk_multiplier: float = 1.0


@dataclass
class PhysicsContext:
    """Physics simulation context."""
    flood_depth_m: float = 0.0
    flood_velocity_ms: float = 0.0
    flood_duration_hours: float = 0.0
    seismic_magnitude: float = 0.0
    seismic_damage_ratio: float = 0.0
    wind_pressure_pa: float = 0.0
    wind_damage_ratio: float = 0.0
    fire_spread_rate: float = 0.0
    is_mock: bool = True
    physics_risk_multiplier: float = 1.0


@dataclass
class NVIDIAEnhancedResult:
    """Enhanced stress test result with NVIDIA data."""
    # Pipeline metadata
    pipeline_stages: List[str] = field(default_factory=list)
    execution_time_ms: int = 0
    nvidia_services_used: List[str] = field(default_factory=list)
    all_mock: bool = True
    
    # Weather data
    weather_context: Optional[WeatherContext] = None
    weather_forecast: Optional[List[Dict]] = None
    climate_projection: Optional[Dict] = None
    
    # Physics data
    physics_context: Optional[PhysicsContext] = None
    flood_simulation: Optional[Dict] = None
    structural_simulation: Optional[Dict] = None
    
    # LLM analysis
    executive_summary: Optional[str] = None
    detailed_analysis: Optional[str] = None
    mitigation_recommendations: List[str] = field(default_factory=list)
    
    # Risk adjustments
    weather_adjusted_severity: float = 0.5
    physics_adjusted_loss: float = 0.0
    confidence_score: float = 0.5
    
    # Data sources
    data_sources: List[str] = field(default_factory=list)


class NVIDIAStressPipeline:
    """
    Unified NVIDIA pipeline for stress testing.
    
    Executes the full pipeline:
    1. Weather forecast (Earth-2 FourCastNet)
    2. Physics simulation (PhysicsNeMo)
    3. Risk calculation (enhanced with physics)
    4. LLM analysis (Llama 3.1)
    
    All stages have automatic fallback to mock data.
    """
    
    def __init__(self):
        self.earth2 = earth2_service
        self.physics = physics_nemo_service
        self.llm = llm_service
    
    async def execute(
        self,
        latitude: float,
        longitude: float,
        event_type: EventCategory,
        severity: float = 0.5,
        city_name: str = "Unknown City",
        run_physics: bool = True,
        run_llm: bool = True,
    ) -> NVIDIAEnhancedResult:
        """
        Execute the full NVIDIA stress test pipeline.
        
        Args:
            latitude: Center latitude
            longitude: Center longitude
            event_type: Type of event (flood, seismic, etc.)
            severity: Base severity (0-1)
            city_name: Name of the city
            run_physics: Whether to run physics simulations
            run_llm: Whether to generate LLM analysis
            
        Returns:
            NVIDIAEnhancedResult with all pipeline outputs
        """
        import time
        start_time = time.time()
        
        result = NVIDIAEnhancedResult()
        result.data_sources = ["Risk Zone Calculator (local)"]
        
        # Stage 1: Weather forecast
        weather_context = await self._get_weather_context(latitude, longitude, event_type)
        result.weather_context = weather_context
        result.pipeline_stages.append(PipelineStage.WEATHER.value)
        
        if not weather_context.is_mock:
            result.nvidia_services_used.append("Earth-2 FourCastNet")
            result.data_sources.append("NVIDIA Earth-2 Weather Forecast")
            result.all_mock = False
        else:
            result.data_sources.append("Weather Model (simulated)")
        
        # Adjust severity based on weather
        adjusted_severity = severity * weather_context.weather_risk_multiplier
        result.weather_adjusted_severity = min(adjusted_severity, 1.0)
        
        # Stage 2: Physics simulation (if applicable)
        if run_physics and event_type in [EventCategory.FLOOD, EventCategory.SEISMIC, EventCategory.FIRE]:
            physics_context = await self._run_physics_simulation(
                latitude, longitude, event_type, adjusted_severity
            )
            result.physics_context = physics_context
            result.pipeline_stages.append(PipelineStage.PHYSICS.value)
            
            if not physics_context.is_mock:
                result.nvidia_services_used.append("PhysicsNeMo")
                result.data_sources.append("NVIDIA PhysicsNeMo Simulation")
                result.all_mock = False
            else:
                result.data_sources.append("Physics Engine (simplified)")
        
        result.pipeline_stages.append(PipelineStage.RISK_CALC.value)
        
        # Stage 3: LLM analysis
        if run_llm:
            llm_result = await self._generate_llm_analysis(
                event_type=event_type,
                city_name=city_name,
                severity=adjusted_severity,
                weather_context=weather_context,
                physics_context=result.physics_context,
            )
            
            result.executive_summary = llm_result.get("summary")
            result.detailed_analysis = llm_result.get("detailed")
            result.mitigation_recommendations = llm_result.get("recommendations", [])
            result.pipeline_stages.append(PipelineStage.LLM_ANALYSIS.value)
            
            if llm_result.get("is_real"):
                result.nvidia_services_used.append("NVIDIA LLM (Llama 3.1)")
                result.data_sources.append("NVIDIA LLM Analysis")
                result.all_mock = False
        
        result.pipeline_stages.append(PipelineStage.COMPLETE.value)
        
        # Calculate confidence
        if result.all_mock:
            result.confidence_score = 0.5
        elif len(result.nvidia_services_used) >= 2:
            result.confidence_score = 0.9
        else:
            result.confidence_score = 0.7
        
        result.execution_time_ms = int((time.time() - start_time) * 1000)
        
        logger.info(
            "NVIDIA pipeline completed",
            stages=len(result.pipeline_stages),
            services_used=len(result.nvidia_services_used),
            execution_time_ms=result.execution_time_ms,
            all_mock=result.all_mock,
        )
        
        return result
    
    async def _get_weather_context(
        self,
        latitude: float,
        longitude: float,
        event_type: EventCategory,
    ) -> WeatherContext:
        """Get weather forecast and create context."""
        try:
            forecasts = await self.earth2.get_weather_forecast(
                latitude=latitude,
                longitude=longitude,
                forecast_hours=72,
            )
            
            if forecasts:
                # Use first forecast point
                f = forecasts[0]
                
                # Calculate weather risk multiplier
                multiplier = 1.0
                extreme = False
                
                # Adjust for event type
                if event_type == EventCategory.FLOOD:
                    if f.precipitation_mm > 50:
                        multiplier = 1.5
                        extreme = True
                    elif f.precipitation_mm > 20:
                        multiplier = 1.2
                elif event_type == EventCategory.FIRE:
                    if f.temperature_c > 35 and f.humidity_percent < 30:
                        multiplier = 1.6
                        extreme = True
                    elif f.temperature_c > 30:
                        multiplier = 1.2
                elif event_type == EventCategory.SEISMIC:
                    # Weather doesn't significantly affect seismic
                    pass
                
                # Check if real data or mock
                is_mock = hasattr(f, 'is_mock') and f.is_mock
                
                return WeatherContext(
                    temperature_c=f.temperature_c,
                    precipitation_mm=f.precipitation_mm,
                    wind_speed_ms=f.wind_speed_ms,
                    humidity_percent=f.humidity_percent,
                    pressure_hpa=f.pressure_hpa,
                    forecast_hours=72,
                    is_mock=is_mock,
                    extreme_weather=extreme,
                    weather_risk_multiplier=multiplier,
                )
        except Exception as e:
            logger.warning(f"Weather forecast failed: {e}")
        
        # Return default context
        return WeatherContext(is_mock=True)
    
    async def _run_physics_simulation(
        self,
        latitude: float,
        longitude: float,
        event_type: EventCategory,
        severity: float,
    ) -> PhysicsContext:
        """Run physics simulation based on event type."""
        context = PhysicsContext()
        
        try:
            if event_type == EventCategory.FLOOD:
                # Simulate flood
                flood_input = {
                    "water_depth_m": 1.0 + severity * 3.0,  # 1-4m
                    "velocity_ms": 0.5 + severity * 2.0,     # 0.5-2.5 m/s
                    "duration_hours": 6 + severity * 18,     # 6-24 hours
                }
                
                result = await self.physics.simulate_flood(
                    geometry={"type": "generic_building"},
                    flood_input=flood_input,
                    building_properties={"material": "concrete", "age_years": 30},
                )
                
                context.flood_depth_m = flood_input["water_depth_m"]
                context.flood_velocity_ms = flood_input["velocity_ms"]
                context.flood_duration_hours = flood_input["duration_hours"]
                context.physics_risk_multiplier = 1.0 + result.damage_ratio
                context.is_mock = result.confidence < 0.5  # Low confidence = mock
                
            elif event_type == EventCategory.SEISMIC:
                # Simulate earthquake
                result = await self.physics.simulate_structural(
                    geometry={"type": "generic_building"},
                    loading={"type": "seismic", "magnitude": 5.0 + severity * 2.5},
                    building_properties={"material": "reinforced_concrete", "stories": 10},
                )
                
                context.seismic_magnitude = 5.0 + severity * 2.5
                context.seismic_damage_ratio = result.damage_ratio
                context.physics_risk_multiplier = 1.0 + result.damage_ratio * 2
                context.is_mock = result.confidence < 0.5
                
            elif event_type == EventCategory.FIRE:
                # Use structural wind model as proxy for fire impact
                result = await self.physics.simulate_structural(
                    geometry={"type": "generic_building"},
                    loading={"type": "wind", "wind_speed_ms": 20 + severity * 30},
                    building_properties={"material": "steel_frame", "stories": 5},
                )
                
                context.wind_pressure_pa = 400 + severity * 1000
                context.wind_damage_ratio = result.damage_ratio
                context.fire_spread_rate = 0.1 + severity * 0.4
                context.physics_risk_multiplier = 1.0 + result.damage_ratio
                context.is_mock = result.confidence < 0.5
                
        except Exception as e:
            logger.warning(f"Physics simulation failed: {e}")
            context.is_mock = True
        
        return context
    
    async def _generate_llm_analysis(
        self,
        event_type: EventCategory,
        city_name: str,
        severity: float,
        weather_context: WeatherContext,
        physics_context: Optional[PhysicsContext] = None,
    ) -> Dict[str, Any]:
        """Generate LLM-powered analysis."""
        result = {
            "summary": None,
            "detailed": None,
            "recommendations": [],
            "is_real": False,
        }
        
        try:
            # Build context for LLM
            context_parts = [
                f"Event Type: {event_type.value}",
                f"City: {city_name}",
                f"Severity: {severity:.0%}",
                f"Weather: {weather_context.temperature_c}°C, {weather_context.precipitation_mm}mm rain, {weather_context.wind_speed_ms}m/s wind",
            ]
            
            if physics_context:
                if physics_context.flood_depth_m > 0:
                    context_parts.append(f"Flood depth: {physics_context.flood_depth_m:.1f}m")
                if physics_context.seismic_magnitude > 0:
                    context_parts.append(f"Earthquake magnitude: {physics_context.seismic_magnitude:.1f}")
            
            prompt = f"""Analyze this risk scenario and provide a brief executive summary (2 paragraphs max).

Context:
{chr(10).join(context_parts)}

Provide:
1. A concise executive summary of the risk and expected impact
2. Key metrics and findings
3. Do NOT use any markdown formatting like asterisks, bold, or headers
4. Write in professional risk management language
5. Be specific about the numbers and impacts"""

            response = await self.llm.generate(
                prompt=prompt,
                model=LLMModel.LLAMA_70B,
                max_tokens=400,
                temperature=0.3,
            )
            
            if response.finish_reason != "mock" and response.content:
                import re
                # Clean markdown
                summary = response.content
                summary = re.sub(r'\*\*([^*]+)\*\*', r'\1', summary)
                summary = re.sub(r'\*([^*]+)\*', r'\1', summary)
                summary = re.sub(r'^#{1,6}\s*', '', summary, flags=re.MULTILINE)
                
                result["summary"] = summary.strip()
                result["is_real"] = True
            
            # Generate recommendations
            rec_prompt = f"""Generate 5 specific mitigation actions for {event_type.value} risk in {city_name}.
Severity: {severity:.0%}

Provide exactly 5 concise action items. Each should be a single sentence starting with a verb.
Do NOT use markdown formatting. Write in plain text only."""

            rec_response = await self.llm.generate(
                prompt=rec_prompt,
                model=LLMModel.LLAMA_8B,
                max_tokens=250,
                temperature=0.4,
            )
            
            if rec_response.finish_reason != "mock" and rec_response.content:
                lines = []
                for line in rec_response.content.split('\n'):
                    line = line.strip().lstrip('•-1234567890. ')
                    line = re.sub(r'\*\*([^*]+)\*\*', r'\1', line)
                    if line and len(line) > 10:
                        lines.append(line)
                
                result["recommendations"] = lines[:5]
                result["is_real"] = True
                
        except Exception as e:
            logger.warning(f"LLM analysis failed: {e}")
        
        return result
    
    async def get_climate_projection(
        self,
        latitude: float,
        longitude: float,
        scenario: str = "SSP245",
        time_horizon: int = 2050,
    ) -> Optional[ClimateProjection]:
        """Get climate projection for location."""
        try:
            projection = await self.earth2.get_climate_projection(
                latitude=latitude,
                longitude=longitude,
                scenario=scenario,
                time_horizon=time_horizon,
            )
            return projection
        except Exception as e:
            logger.warning(f"Climate projection failed: {e}")
            return None


# Global service instance
nvidia_stress_pipeline = NVIDIAStressPipeline()
