"""Celery application for background tasks.

We run Celery separately from the FastAPI process (docker-compose already defines
`celery-worker`). Redis is used as broker + result backend.
"""

from __future__ import annotations

from celery import Celery

from src.core.config import settings


def _default_redis_url() -> str:
    return getattr(settings, "redis_url", "redis://localhost:6379")


broker_url = (getattr(settings, "celery_broker_url", "") or "").strip() or _default_redis_url()
result_backend = (getattr(settings, "celery_result_backend", "") or "").strip() or _default_redis_url()

celery_app = Celery(
    "pfrp",
    broker=broker_url,
    backend=result_backend,
    include=[
        "src.tasks.twin_asset_tasks",
    ],
)

celery_app.conf.update(
    task_track_started=True,
    task_time_limit=60 * 30,  # 30 minutes hard limit
    task_soft_time_limit=60 * 25,
    worker_prefetch_multiplier=1,
    task_acks_late=True,
)

