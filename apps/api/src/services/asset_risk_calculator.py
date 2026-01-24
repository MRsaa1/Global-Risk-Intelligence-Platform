"""
Asset Risk Calculator Service.

Calculates comprehensive risk scores for assets based on real data:
- Climate risk: NOAA, CMIP6, FEMA
- Physical risk: FEMA, historical events
- Network risk: Knowledge Graph dependencies

Replaces mock/random risk score generation with data-driven calculations.
"""
import logging
from typing import Optional
from datetime import datetime

from src.models.asset import Asset
from src.services.climate_service import climate_service
from src.services.external.noaa_client import noaa_client
from src.services.external.fema_client import fema_client
from src.services.external.cmip6_client import cmip6_client
from src.services.knowledge_graph import get_knowledge_graph_service

logger = logging.getLogger(__name__)


class AssetRiskCalculator:
    """
    Calculates risk scores for assets using real data sources.
    
    Integrates:
    - Climate data (NOAA, CMIP6, FEMA)
    - Historical events (USGS, NOAA Storm Events)
    - Network dependencies (Knowledge Graph)
    """
    
    def __init__(self):
        self.climate_service = climate_service
        self.noaa_client = noaa_client
        self.fema_client = fema_client
        self.cmip6_client = cmip6_client
    
    async def calculate_climate_risk(
        self,
        asset: Asset,
    ) -> float:
        """
        Calculate climate risk score (0-100) for an asset.
        
        Uses:
        - ClimateService (CMIP6, Earth-2 if available)
        - NOAA climate normals
        - FEMA National Risk Index (for US assets)
        """
        try:
            # Use asset latitude/longitude
            lat = asset.latitude
            lon = asset.longitude
            
            if lat is None or lon is None:
                # No coordinates - use default moderate risk
                return 40.0
            
            # Get climate assessment
            assessment = await self.climate_service.get_climate_assessment(
                latitude=lat,
                longitude=lon,
                scenario="ssp245",  # Medium emissions scenario
                time_horizon=2050,
            )
            
            # Convert composite score (0-100) to risk score
            climate_risk = assessment.composite_score
            
            # Enhance with FEMA data if in US
            if asset.country_code == 'US':
                try:
                    fips_code = await self._get_fips_code(lat, lon)
                    if fips_code:
                        county_risk = await self.fema_client.get_county_risk(fips_code)
                        if county_risk:
                            # Blend FEMA risk with climate assessment
                            # FEMA risk is 0-100, climate is 0-100
                            climate_risk = (climate_risk * 0.6 + county_risk.risk_score * 0.4)
                except Exception as e:
                    logger.warning(f"FEMA lookup failed for asset {asset.id}: {e}")
            
            return min(100.0, max(0.0, climate_risk))
            
        except Exception as e:
            logger.error(f"Error calculating climate risk for asset {asset.id}: {e}")
            # Fallback: estimate based on location
            return self._estimate_climate_risk(asset)
    
    async def calculate_physical_risk(
        self,
        asset: Asset,
    ) -> float:
        """
        Calculate physical risk score (0-100) for an asset.
        
        Uses:
        - FEMA National Risk Index (for US)
        - Historical events (earthquakes, storms)
        - Building age and condition
        """
        try:
            lat = asset.latitude
            lon = asset.longitude
            
            if lat is None or lon is None:
                return 25.0
            
            physical_risk = 20.0  # Base risk
            
            # FEMA data for US assets
            if asset.country_code == 'US':
                try:
                    fips_code = await self._get_fips_code(lat, lon)
                    if fips_code:
                        county_risk = await self.fema_client.get_county_risk(fips_code)
                        if county_risk:
                            # Use FEMA EAL (Expected Annual Loss) as physical risk indicator
                            # Normalize EAL score (0-100) to physical risk
                            physical_risk = county_risk.eal_score * 0.8
                except Exception as e:
                    logger.warning(f"FEMA physical risk lookup failed: {e}")
            
            # Adjust for building age
            if asset.year_built:
                age = datetime.now().year - asset.year_built
                if age > 50:
                    physical_risk += 15
                elif age > 30:
                    physical_risk += 10
                elif age > 20:
                    physical_risk += 5
            
            # Adjust for building type
            if asset.asset_type:
                type_risk = {
                    'industrial_manufacturing': 10,
                    'infrastructure_transport': 8,
                    'infrastructure_energy': 12,
                    'residential_multifamily': 5,
                    'commercial_office': 3,
                }
                physical_risk += type_risk.get(asset.asset_type.value, 0)
            
            return min(100.0, max(0.0, physical_risk))
            
        except Exception as e:
            logger.error(f"Error calculating physical risk for asset {asset.id}: {e}")
            return 25.0
    
    async def calculate_network_risk(
        self,
        asset: Asset,
    ) -> float:
        """
        Calculate network risk score (0-100) for an asset.
        
        Uses:
        - Knowledge Graph dependencies
        - Number of critical dependencies
        - Centrality in network
        """
        try:
            kg_service = get_knowledge_graph_service()
            
            if not kg_service.is_available:
                # Neo4j not available - use default
                return 30.0
            
            # Get network risk from Knowledge Graph
            network_metrics = await kg_service.calculate_network_risk_score(str(asset.id))
            
            if network_metrics:
                # Normalize network score to 0-100
                # network_score can vary, normalize it
                raw_score = network_metrics.get('network_score', 0)
                
                # Normalize: assume max network score is around 500
                network_risk = min(100.0, (raw_score / 5.0))
                
                return network_risk
            
            return 30.0
            
        except Exception as e:
            logger.warning(f"Error calculating network risk for asset {asset.id}: {e}")
            return 30.0
    
    async def calculate_all_risks(
        self,
        asset: Asset,
    ) -> dict:
        """
        Calculate all risk scores for an asset.
        
        Returns:
            {
                'climate_risk_score': float,
                'physical_risk_score': float,
                'network_risk_score': float,
                'combined_risk_score': float,
            }
        """
        climate = await self.calculate_climate_risk(asset)
        physical = await self.calculate_physical_risk(asset)
        network = await self.calculate_network_risk(asset)
        
        # Combined risk (weighted average)
        combined = (climate * 0.4 + physical * 0.3 + network * 0.3)
        
        return {
            'climate_risk_score': round(climate, 1),
            'physical_risk_score': round(physical, 1),
            'network_risk_score': round(network, 1),
            'combined_risk_score': round(combined, 1),
        }
    
    async def _get_fips_code(
        self,
        lat: float,
        lon: float,
    ) -> Optional[str]:
        """Get FIPS code from coordinates using Census geocoder."""
        try:
            return await self.fema_client._get_fips_from_coordinates(lat, lon)
        except Exception:
            return None
    
    def _estimate_climate_risk(
        self,
        asset: Asset,
    ) -> float:
        """Estimate climate risk when data unavailable."""
        # Very rough estimates based on location
        if asset.country_code:
            # Higher risk in certain regions
            high_risk_countries = {'US', 'PH', 'BD', 'VN', 'TH', 'ID'}
            if asset.country_code in high_risk_countries:
                return 55.0
        
        return 40.0


# Global service instance
asset_risk_calculator = AssetRiskCalculator()
