# External API clients
from .usgs_client import USGSClient
from .usgs_elevation_client import USGSElevationClient, usgs_elevation_client
from .usgs_waterwatch_client import USGSWaterWatchClient, usgs_waterwatch_client
from .nasa_smap_client import NASASMAPClient, nasa_smap_client
from .osm_drainage_client import OSMDrainageClient, osm_drainage_client
from .weather_client import WeatherClient
from .gdelt_client import GDELTClient, gdelt_client
from .worldbank_client import WorldBankClient, worldbank_client
from .imf_client import IMFClient, imf_client
from .ofac_client import OFACClient, ofac_client
from .open_meteo_client import OpenMeteoClient, open_meteo_client

__all__ = [
    "USGSClient",
    "USGSElevationClient",
    "usgs_elevation_client",
    "USGSWaterWatchClient",
    "usgs_waterwatch_client",
    "NASASMAPClient",
    "nasa_smap_client",
    "OSMDrainageClient",
    "osm_drainage_client",
    "WeatherClient",
    "GDELTClient",
    "gdelt_client",
    "WorldBankClient",
    "worldbank_client",
    "IMFClient",
    "imf_client",
    "OFACClient",
    "ofac_client",
    "OpenMeteoClient",
    "open_meteo_client",
]
