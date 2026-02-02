"""
City Risk Calculator Service.

Calculates dynamic risk scores for cities using:
- Known risk factors from cities database
- External API data (USGS, OpenWeather, World Bank)
- Weighted formula combining multiple risk factors

Risk Formula:
    risk_score = (
        seismic_risk * 0.20 +
        flood_risk * 0.18 +
        hurricane_risk * 0.15 +
        political_risk * 0.12 +
        economic_exposure * 0.15 +
        infrastructure_risk * 0.10 +
        historical_volatility * 0.10
    )
"""
import asyncio
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import logging

from ..data.cities import (
    CityData, 
    CITIES_DATABASE,
    SEISMIC_BASE_RISK,
    CLIMATE_BASE_RISK,
    POLITICAL_BASE_RISK,
    SeismicZone,
    ClimateZone,
    PoliticalRegion,
    get_city,
    get_all_cities,
)

logger = logging.getLogger(__name__)


# Risk factor weights (sum = 1.0)
RISK_WEIGHTS = {
    "seismic": 0.20,
    "flood": 0.18,
    "hurricane": 0.15,
    "political": 0.12,
    "economic": 0.15,
    "infrastructure": 0.10,
    "historical": 0.10,
}


@dataclass
class RiskFactor:
    """Individual risk factor with metadata."""
    value: float  # 0.0 - 1.0
    source: str
    last_updated: datetime
    details: str = ""
    confidence: float = 1.0  # 0.0 - 1.0


@dataclass
class CityRiskScore:
    """Complete risk assessment for a city."""
    city_id: str
    name: str
    coordinates: tuple
    risk_score: float  # 0.0 - 1.0 (normalized)
    risk_factors: Dict[str, RiskFactor]
    calculation_method: str = "weighted_average"
    confidence: float = 1.0
    data_freshness: datetime = field(default_factory=datetime.utcnow)
    exposure: float = 0.0
    assets_count: int = 0


class CityRiskCalculator:
    """
    Calculates dynamic risk scores for cities.
    
    Uses a combination of:
    - Static known risk factors from database
    - Dynamic data from external APIs (when available)
    - Fallback values based on regional characteristics
    """
    
    def __init__(
        self,
        usgs_client: Optional[Any] = None,
        weather_client: Optional[Any] = None,
        worldbank_client: Optional[Any] = None,
    ):
        self.usgs_client = usgs_client
        self.weather_client = weather_client
        self.worldbank_client = worldbank_client
        
        # In-memory cache for calculated risk scores
        self._cache: Dict[str, CityRiskScore] = {}
        self._cache_ttl = timedelta(hours=24)
    
    async def calculate_risk(
        self,
        city_id: str,
        force_recalculate: bool = False,
        use_external_data: bool = True,
    ) -> Optional[CityRiskScore]:
        """
        Calculate risk score for a city.
        
        Args:
            city_id: City identifier
            force_recalculate: If True, bypass cache
            
        Returns:
            CityRiskScore or None if city not found
        """
        # Check cache first
        if not force_recalculate and city_id in self._cache:
            cached = self._cache[city_id]
            if datetime.utcnow() - cached.data_freshness < self._cache_ttl:
                return cached
        
        # Get city data
        city = get_city(city_id)
        if not city:
            logger.warning(f"City not found: {city_id}")
            return None
        
        # Calculate individual risk factors
        risk_factors = await self._calculate_all_factors(city, use_external_data=use_external_data)
        
        # Calculate weighted average
        total_score = 0.0
        total_weight = 0.0
        total_confidence = 0.0
        
        for factor_name, weight in RISK_WEIGHTS.items():
            if factor_name in risk_factors:
                factor = risk_factors[factor_name]
                total_score += factor.value * weight * factor.confidence
                total_weight += weight * factor.confidence
                total_confidence += factor.confidence
        
        # Normalize score
        if total_weight > 0:
            final_score = total_score / total_weight
        else:
            final_score = 0.5  # Default moderate risk
        
        # =============================================
        # CRITICAL OVERRIDE: Conflict zones and extreme risks
        # =============================================
        # If city is in active conflict zone or has extreme political risk,
        # the base weighted formula underestimates the risk.
        # Apply boosters for critical situations.
        
        political_factor = risk_factors.get("political")
        infra_factor = risk_factors.get("infrastructure")
        
        # Active conflict zone boost (political >= 0.85)
        if political_factor and political_factor.value >= 0.85:
            # Conflict zone: minimum risk is 0.75 + political contribution
            conflict_boost = political_factor.value * 0.3  # Add 25-30% for conflict
            final_score = max(final_score, 0.70) + conflict_boost
            logger.info(f"{city_id}: Conflict zone boost applied (+{conflict_boost:.2f})")
        
        # High political instability boost (political >= 0.70)
        elif political_factor and political_factor.value >= 0.70:
            political_boost = political_factor.value * 0.15  # Add 10-15%
            final_score = final_score + political_boost
            logger.info(f"{city_id}: Political instability boost applied (+{political_boost:.2f})")
        
        # Infrastructure crisis boost (infra >= 0.75 and political >= 0.60)
        if (infra_factor and infra_factor.value >= 0.75 and 
            political_factor and political_factor.value >= 0.60):
            infra_boost = 0.10
            final_score = final_score + infra_boost
            logger.info(f"{city_id}: Infrastructure crisis boost applied (+{infra_boost:.2f})")
        
        # Clamp to [0, 1]
        final_score = max(0.0, min(1.0, final_score))
        
        # Average confidence
        avg_confidence = total_confidence / len(risk_factors) if risk_factors else 0.5
        
        result = CityRiskScore(
            city_id=city_id,
            name=city.name,
            coordinates=(city.lng, city.lat),
            risk_score=final_score,
            risk_factors=risk_factors,
            calculation_method="weighted_average",
            confidence=avg_confidence,
            data_freshness=datetime.utcnow(),
            exposure=city.exposure,
            assets_count=city.assets_count,
        )
        
        # Cache result
        self._cache[city_id] = result
        
        return result
    
    async def calculate_all_cities(
        self,
        force_recalculate: bool = False,
        use_external_data: bool = True,
        max_concurrency: int = 25,
    ) -> List[CityRiskScore]:
        """
        Calculate risk scores for all cities.

        Notes:
        - External data (USGS/OpenWeather) can be slow and rate-limited; default is enabled
          for backwards compatibility but should usually be disabled for real-time API usage.
        - Concurrency is limited to avoid bursting external APIs.
        """
        cities = get_all_cities()

        sem = asyncio.Semaphore(max(1, max_concurrency))

        async def _one(city: CityData):
            async with sem:
                return await self.calculate_risk(
                    city.id,
                    force_recalculate=force_recalculate,
                    use_external_data=use_external_data,
                )

        results = await asyncio.gather(*[_one(c) for c in cities])
        return [r for r in results if r is not None]
    
    async def _calculate_all_factors(
        self,
        city: CityData,
        use_external_data: bool = True,
    ) -> Dict[str, RiskFactor]:
        """Calculate all risk factors for a city."""
        factors = {}
        
        # Seismic risk
        factors["seismic"] = await self._calculate_seismic_risk(city, use_external_data=use_external_data)
        
        # Flood/Hurricane risk
        factors["flood"] = await self._calculate_flood_risk(city, use_external_data=use_external_data)
        factors["hurricane"] = await self._calculate_hurricane_risk(city)
        
        # Political risk
        factors["political"] = await self._calculate_political_risk(city)
        
        # Economic exposure
        factors["economic"] = await self._calculate_economic_risk(city)
        
        # Infrastructure risk
        factors["infrastructure"] = await self._calculate_infrastructure_risk(city)
        
        # Historical volatility
        factors["historical"] = await self._calculate_historical_risk(city)
        
        return factors
    
    async def _calculate_seismic_risk(self, city: CityData, use_external_data: bool = True) -> RiskFactor:
        """Calculate seismic risk using USGS data or fallback."""
        # Try to get real-time data from USGS
        if use_external_data and self.usgs_client:
            try:
                # Hard timeout to keep API responsive
                earthquakes = await asyncio.wait_for(
                    self.usgs_client.get_recent_earthquakes(
                        lat=city.lat, lng=city.lng, radius_km=500, days=365
                    ),
                    timeout=3.0,
                )
                if earthquakes:
                    # Calculate risk based on earthquake frequency and magnitude
                    risk = self._calculate_earthquake_risk_from_data(earthquakes)
                    return RiskFactor(
                        value=risk,
                        source="USGS Earthquake Catalog",
                        last_updated=datetime.utcnow(),
                        details=f"{len(earthquakes)} earthquakes in last year within 500km",
                        confidence=0.95,
                    )
            except Exception as e:
                logger.warning(f"USGS API error for {city.name}: {e}")
        
        # Fallback to known risk factors
        if "earthquake" in city.known_risks:
            return RiskFactor(
                value=city.known_risks["earthquake"],
                source="Known Risk Database",
                last_updated=datetime.utcnow(),
                details=f"Based on {city.seismic_zone.value} zone",
                confidence=0.80,
            )
        
        # Fallback to zone-based risk
        base_risk = SEISMIC_BASE_RISK.get(city.seismic_zone, 0.15)
        return RiskFactor(
            value=base_risk,
            source="Seismic Zone Classification",
            last_updated=datetime.utcnow(),
            details=f"Zone: {city.seismic_zone.value}",
            confidence=0.70,
        )
    
    async def _calculate_flood_risk(self, city: CityData, use_external_data: bool = True) -> RiskFactor:
        """Calculate flood risk using weather data or fallback."""
        # Try to get real-time weather data
        if use_external_data and self.weather_client:
            try:
                weather = await asyncio.wait_for(
                    self.weather_client.get_flood_risk(lat=city.lat, lng=city.lng),
                    timeout=2.5,
                )
                if weather:
                    return RiskFactor(
                        value=weather.get("flood_risk", 0.5),
                        source="OpenWeather API",
                        last_updated=datetime.utcnow(),
                        details=weather.get("details", ""),
                        confidence=0.90,
                    )
            except Exception as e:
                logger.warning(f"Weather API error for {city.name}: {e}")
        
        # Fallback to known risk
        if "flood" in city.known_risks:
            return RiskFactor(
                value=city.known_risks["flood"],
                source="Known Risk Database",
                last_updated=datetime.utcnow(),
                details=f"Climate zone: {city.climate_zone.value}",
                confidence=0.80,
            )
        
        # Fallback to climate zone
        base_risk = CLIMATE_BASE_RISK.get(city.climate_zone, 0.35)
        # Adjust for monsoon and coastal cities
        if city.climate_zone in [ClimateZone.MONSOON, ClimateZone.COASTAL_FLOOD]:
            base_risk *= 1.1
        
        return RiskFactor(
            value=min(1.0, base_risk),
            source="Climate Zone Classification",
            last_updated=datetime.utcnow(),
            details=f"Zone: {city.climate_zone.value}",
            confidence=0.65,
        )
    
    async def _calculate_hurricane_risk(self, city: CityData) -> RiskFactor:
        """Calculate hurricane/typhoon risk."""
        # Check known risks
        hurricane_risk = city.known_risks.get("hurricane", 
                         city.known_risks.get("typhoon",
                         city.known_risks.get("cyclone", None)))
        
        if hurricane_risk is not None:
            return RiskFactor(
                value=hurricane_risk,
                source="Known Risk Database",
                last_updated=datetime.utcnow(),
                details=f"Climate zone: {city.climate_zone.value}",
                confidence=0.80,
            )
        
        # Calculate based on climate zone
        if city.climate_zone == ClimateZone.TROPICAL_CYCLONE:
            # Determine which basin
            if city.lng > 100:  # Pacific
                base_risk = 0.75
                details = "Western Pacific typhoon zone"
            elif city.lng < -30:  # Atlantic
                base_risk = 0.70
                details = "Atlantic hurricane zone"
            else:
                base_risk = 0.60
                details = "Indian Ocean cyclone zone"
        elif city.climate_zone == ClimateZone.MONSOON:
            base_risk = 0.50
            details = "Monsoon region, occasional cyclones"
        else:
            base_risk = 0.15
            details = "Low hurricane/typhoon exposure"
        
        return RiskFactor(
            value=base_risk,
            source="Climate Zone Classification",
            last_updated=datetime.utcnow(),
            details=details,
            confidence=0.70,
        )
    
    async def _calculate_political_risk(self, city: CityData) -> RiskFactor:
        """Calculate political stability risk."""
        # Check known political risks
        if "political" in city.known_risks:
            return RiskFactor(
                value=city.known_risks["political"],
                source="Known Risk Database",
                last_updated=datetime.utcnow(),
                details=f"Region: {city.political_region.value}",
                confidence=0.85,
            )
        
        if "conflict" in city.known_risks:
            return RiskFactor(
                value=city.known_risks["conflict"],
                source="Conflict Assessment",
                last_updated=datetime.utcnow(),
                details="Active or recent conflict zone",
                confidence=0.95,
            )
        
        # Fallback to regional classification
        base_risk = POLITICAL_BASE_RISK.get(city.political_region, 0.40)
        
        # Adjust for geopolitical tensions
        if "geopolitical" in city.known_risks:
            base_risk = max(base_risk, city.known_risks["geopolitical"])
        
        return RiskFactor(
            value=base_risk,
            source="Political Region Classification",
            last_updated=datetime.utcnow(),
            details=f"Region: {city.political_region.value}",
            confidence=0.70,
        )
    
    async def _calculate_economic_risk(self, city: CityData) -> RiskFactor:
        """Calculate economic exposure risk."""
        # Calculate based on exposure and assets
        if city.exposure > 0:
            # Higher exposure = higher risk (more to lose)
            # Normalize to 0-1 scale (max exposure ~55B)
            exposure_normalized = min(1.0, city.exposure / 60.0)
            
            # Combine with asset concentration
            asset_factor = min(1.0, city.assets_count / 1500)
            
            risk = (exposure_normalized * 0.6 + asset_factor * 0.4)
            
            return RiskFactor(
                value=risk,
                source="Portfolio Data",
                last_updated=datetime.utcnow(),
                details=f"${city.exposure}B exposure, {city.assets_count} assets",
                confidence=0.90,
            )
        
        # Default moderate economic risk
        return RiskFactor(
            value=0.50,
            source="Default Assessment",
            last_updated=datetime.utcnow(),
            details="No specific exposure data",
            confidence=0.50,
        )
    
    async def _calculate_infrastructure_risk(self, city: CityData) -> RiskFactor:
        """Calculate infrastructure vulnerability risk."""
        # Check known infrastructure risks
        if "infrastructure" in city.known_risks:
            return RiskFactor(
                value=city.known_risks["infrastructure"],
                source="Known Risk Database",
                last_updated=datetime.utcnow(),
                details="Based on infrastructure assessment",
                confidence=0.80,
            )
        
        # Estimate based on political region (proxy for infrastructure quality)
        risk_by_region = {
            PoliticalRegion.OECD_STABLE: 0.25,
            PoliticalRegion.OECD_MODERATE: 0.35,
            PoliticalRegion.EMERGING_STABLE: 0.50,
            PoliticalRegion.EMERGING_VOLATILE: 0.65,
            PoliticalRegion.CONFLICT_ZONE: 0.85,
        }
        
        base_risk = risk_by_region.get(city.political_region, 0.50)
        
        # Adjust for energy risks
        if "energy" in city.known_risks:
            base_risk = max(base_risk, city.known_risks["energy"] * 0.8)
        
        return RiskFactor(
            value=base_risk,
            source="Infrastructure Assessment",
            last_updated=datetime.utcnow(),
            details=f"Based on regional development level",
            confidence=0.60,
        )
    
    async def _calculate_historical_risk(self, city: CityData) -> RiskFactor:
        """Calculate historical volatility risk."""
        # Based on major events
        event_count = len(city.major_events)
        
        if event_count >= 3:
            risk = 0.80
            details = f"{event_count} major historical events"
        elif event_count == 2:
            risk = 0.60
            details = f"{event_count} major historical events"
        elif event_count == 1:
            risk = 0.40
            details = f"1 major historical event: {city.major_events[0]}"
        else:
            risk = 0.20
            details = "No major historical events recorded"
        
        return RiskFactor(
            value=risk,
            source="Historical Event Database",
            last_updated=datetime.utcnow(),
            details=details,
            confidence=0.85,
        )
    
    def _calculate_earthquake_risk_from_data(self, earthquakes: List[Dict]) -> float:
        """Calculate earthquake risk from USGS earthquake data."""
        if not earthquakes:
            return 0.1
        
        # Count by magnitude
        major_count = sum(1 for eq in earthquakes if eq.get("magnitude", 0) >= 6.0)
        moderate_count = sum(1 for eq in earthquakes if 4.0 <= eq.get("magnitude", 0) < 6.0)
        minor_count = sum(1 for eq in earthquakes if eq.get("magnitude", 0) < 4.0)
        
        # Weighted score
        risk = (
            major_count * 0.3 +
            moderate_count * 0.1 +
            minor_count * 0.01
        )
        
        # Normalize (assuming max ~10 major quakes = 1.0)
        return min(1.0, risk / 3.0)
    
    def get_cached_score(self, city_id: str) -> Optional[CityRiskScore]:
        """Get cached risk score if available."""
        return self._cache.get(city_id)
    
    def clear_cache(self):
        """Clear all cached risk scores."""
        self._cache.clear()
    
    def to_geojson_feature(self, score: CityRiskScore) -> Dict:
        """Convert risk score to GeoJSON feature."""
        return {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": list(score.coordinates),
            },
            "properties": {
                "id": score.city_id,
                "name": score.name,
                "risk": round(score.risk_score, 2),
                "exposure": score.exposure,
                "assets_count": score.assets_count,
                "confidence": round(score.confidence, 2),
                "calculation_method": score.calculation_method,
                "data_freshness": score.data_freshness.isoformat(),
                "risk_factors": {
                    name: {
                        "value": round(factor.value, 2),
                        "source": factor.source,
                        "details": factor.details,
                    }
                    for name, factor in score.risk_factors.items()
                },
            },
        }


# Global instance for convenience
_calculator_instance: Optional[CityRiskCalculator] = None


def get_city_risk_calculator() -> CityRiskCalculator:
    """Get or create global calculator instance."""
    global _calculator_instance
    if _calculator_instance is None:
        _calculator_instance = CityRiskCalculator()
    return _calculator_instance
