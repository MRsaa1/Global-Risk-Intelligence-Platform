#!/usr/bin/env python3
"""
One-time seed source_registry + USGS sync (no API server).

Run from apps/api:
  python scripts/risk_events_sync_once.py

Or with API running:
  curl -X POST "http://localhost:8000/api/v1/risk/events/sync?source=usgs&days=365&min_magnitude=5&seed_registry=true"
"""
import asyncio
import logging
import sys
from pathlib import Path

# Add apps/api to path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
logger = logging.getLogger(__name__)


async def main() -> int:
    from src.core.database import AsyncSessionLocal
    from src.services.external_risk_etl import seed_source_registry, run_full_sync_usgs

    logger.info("Seeding source_registry...")
    async with AsyncSessionLocal() as session:
        n = await seed_source_registry(session)
        await session.commit()
    logger.info("Seeded %s sources.", n)

    logger.info("Running USGS sync (extract -> normalize -> event_entities)...")
    counts = await run_full_sync_usgs(days=365, min_magnitude=5.0)
    logger.info("Sync done: raw=%s normalized=%s entities=%s", counts["raw"], counts["normalized"], counts["entities"])
    return 0


if __name__ == "__main__":
    sys.exit(asyncio.run(main()))
