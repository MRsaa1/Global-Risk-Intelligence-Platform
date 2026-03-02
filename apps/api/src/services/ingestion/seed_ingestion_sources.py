"""
Seed default ingestion_sources so the catalog is not empty after migration.

Run once after `alembic upgrade head` so scheduled run_catalog_ingestion_job has sources to run.
"""
from datetime import datetime, timezone
from typing import Any, Dict, List
from uuid import uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.models.ingestion_source import IngestionSource


DEFAULT_SOURCES: List[Dict[str, Any]] = [
    {"name": "Market Data", "source_type": "market_data", "refresh_interval_minutes": 5},
    {"name": "Natural Hazards", "source_type": "natural_hazards", "refresh_interval_minutes": 5},
    {"name": "Threat Intelligence", "source_type": "threat_intelligence", "refresh_interval_minutes": 15},
    {"name": "Weather", "source_type": "weather", "refresh_interval_minutes": 30},
    {"name": "Biosecurity", "source_type": "biosecurity", "refresh_interval_minutes": 60},
    {"name": "Cyber Threats", "source_type": "cyber_threats", "refresh_interval_minutes": 360},
    {"name": "Economic", "source_type": "economic", "refresh_interval_minutes": 24 * 60},
    {"name": "Social Media", "source_type": "social_media", "refresh_interval_minutes": 10},
    {"name": "Population", "source_type": "population", "refresh_interval_minutes": 24 * 60},
    {"name": "Infrastructure", "source_type": "infrastructure", "refresh_interval_minutes": 60},
]


async def seed_ingestion_sources_if_empty(db: AsyncSession) -> Dict[str, Any]:
    """Insert default ingestion sources if the catalog is empty. Idempotent."""
    result = await db.execute(select(IngestionSource).limit(1))
    if result.scalar_one_or_none() is not None:
        return {"seeded": 0, "message": "Ingestion catalog already has entries"}

    now = datetime.now(timezone.utc)
    for row in DEFAULT_SOURCES:
        rec = IngestionSource(
            id=str(uuid4()),
            name=row["name"],
            source_type=row["source_type"],
            endpoint_url=None,
            refresh_interval_minutes=row["refresh_interval_minutes"],
            config=None,
            enabled=True,
            created_at=now,
            updated_at=now,
        )
        db.add(rec)
    await db.commit()
    return {"seeded": len(DEFAULT_SOURCES), "message": f"Inserted {len(DEFAULT_SOURCES)} default ingestion sources"}
