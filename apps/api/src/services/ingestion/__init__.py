"""Real-time data ingestion pipeline and scheduled jobs."""

from src.services.ingestion.pipeline import run_ingestion_job

__all__ = ["run_ingestion_job"]
