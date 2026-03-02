"""
City Asset Value (exposure) reference — billions USD.

Estimates aligned to metro GDP / real estate / infrastructure open data:
- Metro GDP share (e.g. Brookings Global Metro Monitor, UN World Urbanization)
- Real estate and infrastructure at risk (order-of-magnitude proxies)

Used by GET /api/v1/geodata/cities to return realistic Asset Value (exposure) for the UI.
When a city id is in this map, it overrides the static value in CITIES_DATABASE.
"""

from typing import Optional

# city_id (normalized: lowercase, no spaces/dashes) -> exposure in billions USD
# Sources: metro GDP estimates, real estate/infrastructure proxies (public reports)
REFERENCE_EXPOSURE_B: dict[str, float] = {
    # US — metro GDP / asset value proxy
    "newyork": 82.0,
    "losangeles": 68.0,
    "sanfrancisco": 52.0,
    "chicago": 42.0,
    "houston": 38.0,
    "miami": 36.0,
    "boston": 34.0,
    "washington": 48.0,
    "denver": 28.0,
    "seattle": 32.0,
    "philadelphia": 30.0,
    "phoenix": 26.0,
    "sanantonio": 18.0,
    "sandiego": 32.0,
    "dallas": 38.0,
    "austin": 22.0,
    "atlanta": 28.0,
    "detroit": 18.0,
    "portland": 18.0,
    "lasvegas": 24.0,
    "minneapolis": 20.0,
    "cleveland": 14.0,
    "tampa": 18.0,
    "orlando": 16.0,
    "charlotte": 22.0,
    "sacramento": 14.0,
    "oakland": 24.0,
    # Europe
    "london": 58.0,
    "paris": 52.0,
    "frankfurt": 28.0,
    "berlin": 38.0,
    "munich": 26.0,
    "amsterdam": 22.0,
    "madrid": 28.0,
    "barcelona": 24.0,
    "rome": 22.0,
    "milan": 28.0,
    "zurich": 24.0,
    "vienna": 18.0,
    "brussels": 16.0,
    "dublin": 14.0,
    "stockholm": 18.0,
    "copenhagen": 14.0,
    "oslo": 12.0,
    "helsinki": 14.0,
    "warsaw": 16.0,
    "prague": 12.0,
    "budapest": 10.0,
    "lisbon": 12.0,
    "athens": 10.0,
    # Asia-Pacific
    "tokyo": 94.0,
    "singapore": 42.0,
    "hongkong": 48.0,
    "sydney": 38.0,
    "melbourne": 36.0,
    "shanghai": 68.0,
    "beijing": 58.0,
    "seoul": 52.0,
    "mumbai": 48.0,
    "delhi": 42.0,
    "bangalore": 28.0,
    "jakarta": 32.0,
    "bangkok": 28.0,
    "kualalumpur": 22.0,
    "manila": 24.0,
    "taipei": 28.0,
    "osaka": 38.0,
    # Americas
    "toronto": 42.0,
    "vancouver": 28.0,
    "montreal": 32.0,
    "calgary": 18.0,
    "mexicocity": 48.0,
    "saopaulo": 52.0,
    "buenosaires": 28.0,
    "santiago": 22.0,
    "bogota": 20.0,
    "lima": 18.0,
    # Other
    "dubai": 38.0,
    "istanbul": 28.0,
    "moscow": 52.0,
    "johannesburg": 22.0,
    "cairo": 18.0,
    "lagos": 16.0,
    "queenstown": 2.0,
    "quebec": 12.0,
}


def _normalize_id(city_id: str) -> str:
    return (city_id or "").lower().replace(" ", "").replace("-", "").replace("_", "")


def get_exposure_b(city_id: str) -> Optional[float]:
    """
    Return reference exposure (asset value) in billions USD for the city, if available.
    Otherwise None (caller should use CITIES_DATABASE value).
    """
    if not city_id:
        return None
    key = _normalize_id(city_id)
    return REFERENCE_EXPOSURE_B.get(key)
