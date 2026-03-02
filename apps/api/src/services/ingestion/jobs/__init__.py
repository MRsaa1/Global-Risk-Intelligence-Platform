"""Scheduled ingestion jobs for real-time data sources."""

from src.services.ingestion.jobs.natural_hazards_job import run_natural_hazards_job
from src.services.ingestion.jobs.threat_intelligence_job import run_threat_intelligence_job
from src.services.ingestion.jobs.biosecurity_job import run_biosecurity_job
from src.services.ingestion.jobs.cyber_threats_job import run_cyber_threats_job
from src.services.ingestion.jobs.economic_job import run_economic_job
from src.services.ingestion.jobs.weather_job import run_weather_job

__all__ = [
    "run_natural_hazards_job",
    "run_threat_intelligence_job",
    "run_biosecurity_job",
    "run_cyber_threats_job",
    "run_economic_job",
    "run_weather_job",
]
