"""
Historical Events Importer Service.

Imports real historical events from external sources:
- USGS Earthquake Catalog
- NOAA Storm Events Database
- FEMA Disaster Declarations

Converts external data to HistoricalEvent model for calibration.
"""
import json
import logging
from datetime import datetime, timedelta
from typing import List, Optional, Dict
from uuid import uuid4

from src.models.historical_event import HistoricalEvent
from src.models.stress_test import StressTestType
from src.services.external.usgs_client import usgs_client
from src.services.external.noaa_client import noaa_client
from src.services.external.fema_client import fema_client

logger = logging.getLogger(__name__)


class HistoricalEventsImporter:
    """
    Imports historical events from external APIs.
    
    Sources:
    - USGS: Earthquakes
    - NOAA: Storm events
    - FEMA: Disaster declarations
    """
    
    def __init__(self):
        self.usgs_client = usgs_client
        self.noaa_client = noaa_client
        self.fema_client = fema_client
    
    async def import_usgs_earthquakes(
        self,
        lat: float,
        lon: float,
        radius_km: float = 500,
        days: int = 365,
        min_magnitude: float = 5.0,
    ) -> List[HistoricalEvent]:
        """
        Import earthquakes from USGS for a region.
        
        Args:
            lat: Center latitude
            lon: Center longitude
            radius_km: Search radius
            days: Days to look back
            min_magnitude: Minimum magnitude
            
        Returns:
            List of HistoricalEvent objects
        """
        try:
            earthquakes = await self.usgs_client.get_recent_earthquakes(
                lat=lat,
                lng=lon,
                radius_km=radius_km,
                days=days,
                min_magnitude=min_magnitude,
            )
            
            events = []
            for eq in earthquakes:
                magnitude = eq.get('magnitude', 0)
                place = eq.get('place', 'Unknown')
                eq_time = eq.get('time', datetime.utcnow())
                coords = eq.get('coordinates', [])
                
                # Calculate severity from magnitude
                # M5.0 = 0.3, M6.0 = 0.5, M7.0 = 0.8, M8.0+ = 1.0
                severity = min(1.0, max(0.0, (magnitude - 4.0) / 4.0))
                
                # Estimate financial impact (rough)
                # M5.0 = $10M, M6.0 = $100M, M7.0 = $1B, M8.0 = $10B
                financial_loss = 10_000_000 * (10 ** (magnitude - 5.0))
                
                event = HistoricalEvent(
                    id=str(uuid4()),
                    name=f"Earthquake M{magnitude:.1f} - {place}",
                    description=f"Magnitude {magnitude} earthquake at {place}",
                    event_type=StressTestType.SEISMIC.value,
                    start_date=eq_time.date() if isinstance(eq_time, datetime) else None,
                    center_latitude=coords[1] if len(coords) > 1 else lat,
                    center_longitude=coords[0] if len(coords) > 0 else lon,
                    severity_actual=severity,
                    financial_loss_eur=financial_loss,
                    affected_population=int(financial_loss / 1000),  # Rough estimate
                    casualties=int(severity * 100),  # Rough estimate
                    sources=json.dumps(["USGS Earthquake Catalog"]),
                    source_urls=json.dumps([f"https://earthquake.usgs.gov/earthquakes/eventpage/{eq.get('id')}"]),
                    tags=json.dumps(["earthquake", "seismic", "usgs", f"magnitude-{magnitude:.1f}"]),
                    is_verified=True,
                    verified_by="USGS",
                    verified_at=datetime.utcnow(),
                )
                
                events.append(event)
            
            logger.info(f"Imported {len(events)} earthquakes from USGS")
            return events
            
        except Exception as e:
            logger.error(f"Error importing USGS earthquakes: {e}")
            return []
    
    async def import_noaa_storm_events(
        self,
        state: str,
        start_date: datetime,
        end_date: datetime,
    ) -> List[HistoricalEvent]:
        """
        Import storm events from NOAA for a US state.
        
        Args:
            state: US state code (e.g., "TX", "FL")
            start_date: Start date
            end_date: End date
            
        Returns:
            List of HistoricalEvent objects
        """
        try:
            storm_events = await self.noaa_client.get_storm_events(
                state=state,
                start_date=start_date,
                end_date=end_date,
            )
            
            events = []
            for storm in storm_events:
                # Map storm type to event type
                event_type_map = {
                    "Hurricane": StressTestType.CLIMATE.value,
                    "Tornado": StressTestType.CLIMATE.value,
                    "Flood": StressTestType.CLIMATE.value,
                    "Wildfire": StressTestType.FIRE.value,
                }
                
                event_type = event_type_map.get(storm.event_type, StressTestType.CLIMATE.value)
                
                # Estimate severity from magnitude
                severity = 0.5
                if storm.magnitude:
                    if storm.magnitude_type == "Category":
                        # Hurricane category 1-5
                        severity = min(1.0, storm.magnitude / 5.0)
                    elif storm.magnitude_type == "EF Scale":
                        # Tornado EF0-EF5
                        severity = min(1.0, storm.magnitude / 5.0)
                
                event = HistoricalEvent(
                    id=str(uuid4()),
                    name=f"{storm.event_type} - {storm.state}",
                    description=storm.description or f"{storm.event_type} event in {storm.state}",
                    event_type=event_type,
                    start_date=storm.begin_date.date() if isinstance(storm.begin_date, datetime) else None,
                    end_date=storm.end_date.date() if isinstance(storm.end_date, datetime) else None,
                    region_name=storm.state,
                    country_codes="US",
                    center_latitude=None,  # Would need to geocode state
                    center_longitude=None,
                    severity_actual=severity,
                    financial_loss_eur=storm.damage_property + storm.damage_crops,
                    casualties=storm.deaths + storm.injuries,
                    sources=json.dumps(["NOAA Storm Events Database"]),
                    tags=json.dumps(["storm", "noaa", storm.event_type.lower()]),
                    is_verified=True,
                    verified_by="NOAA",
                    verified_at=datetime.utcnow(),
                )
                
                events.append(event)
            
            logger.info(f"Imported {len(events)} storm events from NOAA")
            return events
            
        except Exception as e:
            logger.error(f"Error importing NOAA storm events: {e}")
            return []
    
    async def import_fema_disasters(
        self,
        state: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None,
    ) -> List[HistoricalEvent]:
        """
        Import FEMA disaster declarations.
        
        Note: FEMA API is limited, this is a placeholder for future integration.
        """
        # FEMA disaster declarations would require additional API access
        # For now, return empty list
        logger.info("FEMA disaster import not yet implemented")
        return []
    
    async def import_for_region(
        self,
        lat: float,
        lon: float,
        radius_km: float = 500,
        days: int = 365,
        country_code: Optional[str] = None,
    ) -> List[HistoricalEvent]:
        """
        Import all historical events for a region.
        
        Args:
            lat: Center latitude
            lon: Center longitude
            radius_km: Search radius
            days: Days to look back
            country_code: Country code (for state-specific imports)
            
        Returns:
            Combined list of all imported events
        """
        all_events = []
        
        # Import earthquakes (global)
        earthquakes = await self.import_usgs_earthquakes(
            lat=lat,
            lon=lon,
            radius_km=radius_km,
            days=days,
            min_magnitude=5.0,
        )
        all_events.extend(earthquakes)
        
        # Import storm events (US only)
        if country_code == 'US':
            # Would need state code from coordinates
            # For now, skip storm events
            pass
        
        logger.info(f"Imported {len(all_events)} total historical events for region")
        return all_events


# Global service instance
historical_events_importer = HistoricalEventsImporter()
