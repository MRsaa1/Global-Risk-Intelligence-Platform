"""
Market data ingestion job: fetch VIX, SPX, HYG, LQD, 10Y, EUR/USD and broadcast to WebSocket.

Schedule: every 5 minutes. Requires enable_market_data=True (default).
Persists each snapshot to market_data_snapshots; emits DATA_REFRESH_COMPLETED for Live Data Bar.
"""
from datetime import datetime, timezone
from typing import Any, Dict

import structlog

from src.core.config import settings
from src.core.database import AsyncSessionLocal
from src.models.market_data_snapshot import MarketDataSnapshot
from src.services.external.market_data_client import fetch_market_data
from src.api.v1.endpoints.websocket import manager as ws_manager
from src.services.event_emitter import event_emitter

logger = structlog.get_logger()


async def run_market_data_job() -> Dict[str, Any]:
    """Fetch market data, persist snapshot, broadcast to market_data channel."""
    if not getattr(settings, "enable_market_data", True):
        return {"success": True, "source_id": "market_data", "summary": {"skipped": True}}

    try:
        data = await fetch_market_data()
        if not data:
            logger.warning("Market data job: no data returned")
            return {"success": False, "source_id": "market_data", "summary": {"count": 0}, "error": "no data"}

        now = datetime.now(timezone.utc)
        try:
            async with AsyncSessionLocal() as session:
                session.add(MarketDataSnapshot(captured_at=now, values=dict(data)))
                await session.commit()
        except Exception as db_err:
            logger.warning("Market data snapshot insert failed (broadcast continues)", error=str(db_err))

        await ws_manager.broadcast_to_channel("market_data", data)
        summary = {
            "source_id": "market_data",
            "count": len(data),
            "keys": list(data.keys()),
            "updated_at": now.isoformat(),
        }
        await event_emitter.emit_data_refresh_completed(source_id="market_data", summary=summary)
        logger.info("Market data broadcast", symbols=len(data), keys=list(data.keys()))
        return {
            "success": True,
            "source_id": "market_data",
            "summary": summary,
        }
    except Exception as e:
        logger.warning("Market data job failed", error=str(e))
        return {"success": False, "source_id": "market_data", "error": str(e)}
