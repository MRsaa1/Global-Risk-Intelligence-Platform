"""Seed data for source_registry (external risk data sources).

Aligns with docs/EXTERNAL_DATABASES_TO_INTEGRATE.md and Technical Spec v1.
"""
from typing import List, Dict, Any

# source_name, domain, license_type, refresh_frequency, priority_rank, active, tos_url, storage_restrictions
SOURCE_REGISTRY_ROWS: List[Dict[str, Any]] = [
    # Seismic
    {"source_name": "usgs", "domain": "seismic", "license_type": "public", "refresh_frequency": "daily", "priority_rank": 1, "active": True, "tos_url": "https://www.usgs.gov/policies-and-notices", "storage_restrictions": None},
    {"source_name": "emdat", "domain": "natcat", "license_type": "academic", "refresh_frequency": "monthly", "priority_rank": 1, "active": True, "tos_url": "https://www.emdat.be/", "storage_restrictions": "Cite CRED/EM-DAT"},
    # Climate / NatCat
    {"source_name": "noaa", "domain": "climate", "license_type": "public", "refresh_frequency": "weekly", "priority_rank": 1, "active": True, "tos_url": "https://www.ncdc.noaa.gov/", "storage_restrictions": None},
    {"source_name": "fema", "domain": "climate", "license_type": "public", "refresh_frequency": "weekly", "priority_rank": 2, "active": True, "tos_url": "https://www.fema.gov/", "storage_restrictions": None},
    {"source_name": "sigma", "domain": "insurance", "license_type": "commercial", "refresh_frequency": "monthly", "priority_rank": 2, "active": True, "tos_url": "https://www.swissre.com/", "storage_restrictions": "Check Swiss Re terms"},
    {"source_name": "natcat", "domain": "insurance", "license_type": "commercial", "refresh_frequency": "monthly", "priority_rank": 3, "active": True, "tos_url": "https://www.munichre.com/", "storage_restrictions": "Licence required"},
    # Financial
    {"source_name": "laeven_valencia", "domain": "financial", "license_type": "academic", "refresh_frequency": "yearly", "priority_rank": 1, "active": True, "tos_url": "https://www.imf.org/", "storage_restrictions": "Cite Laeven & Valencia"},
    # Cyber
    {"source_name": "veris_dbir", "domain": "cyber", "license_type": "public", "refresh_frequency": "yearly", "priority_rank": 1, "active": True, "tos_url": "https://www.verizon.com/", "storage_restrictions": None},
    # Conflict
    {"source_name": "ucdp", "domain": "conflict", "license_type": "academic", "refresh_frequency": "monthly", "priority_rank": 1, "active": True, "tos_url": "https://ucdp.uu.se/", "storage_restrictions": "Cite UCDP"},
    {"source_name": "acled", "domain": "conflict", "license_type": "academic", "refresh_frequency": "weekly", "priority_rank": 2, "active": True, "tos_url": "https://acleddata.com/", "storage_restrictions": "Cite ACLED"},
    # Internal/fallback
    {"source_name": "seed", "domain": "natcat", "license_type": "internal", "refresh_frequency": "manual", "priority_rank": 9, "active": True, "tos_url": None, "storage_restrictions": None},
]


def get_source_registry_seed() -> List[Dict[str, Any]]:
    """Return rows to upsert into source_registry."""
    return list(SOURCE_REGISTRY_ROWS)
