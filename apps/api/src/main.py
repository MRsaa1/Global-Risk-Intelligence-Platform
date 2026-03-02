"""
Physical-Financial Risk Platform API

The Operating System for the Physical Economy.
"""
import asyncio
import logging
import time
from contextlib import asynccontextmanager
from typing import Callable

# Suppress uvicorn access log (per-request lines); our middleware logs aggregated counts
logging.getLogger("uvicorn.access").setLevel(logging.WARNING)

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse, Response as FastAPIResponse
import structlog

from src.core.config import settings
from src.core.database import close_databases, init_databases
from src.api.v1.router import api_router

# Configure structured logging
def _add_trace_context(logger, method_name, event_dict):
    """Add trace_id and span_id to structlog when OpenTelemetry context is active."""
    try:
        from opentelemetry import trace
        span = trace.get_current_span()
        if span and span.is_recording():
            ctx = span.get_span_context()
            if ctx.trace_id:
                event_dict["trace_id"] = format(ctx.trace_id, "032x")
            if ctx.span_id:
                event_dict["span_id"] = format(ctx.span_id, "016x")
    except Exception:
        pass
    return event_dict


structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,
        _add_trace_context,
        structlog.processors.JSONRenderer(),
    ],
)
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown."""
    # Record start time for /platform/metrics uptime
    app.state.started_at = time.time()
    # Startup
    logger.info("Starting Physical-Financial Risk Platform API...")
    try:
        await init_databases()
        logger.info("Database connections initialized")

        _ee_project = getattr(settings, "gcloud_project_id", "") or ""
        if _ee_project:
            logger.info("Earth Engine: project_id=%s", _ee_project)
        else:
            logger.info("Earth Engine: GCLOUD_PROJECT_ID not set (check apps/api/.env)")

        # Auto-fill strategic modules (CIP, SCSS, SRO) if empty.
        # Skipped in production unless ALLOW_SEED_IN_PRODUCTION=true to prevent demo data in prod DB.
        _allow_seed = getattr(settings, "allow_seed_in_production", False)
        if settings.environment != "production" or _allow_seed:
            try:
                from src.core.database import AsyncSessionLocal
                from src.services.strategic_modules_seed import seed_strategic_modules
                async with AsyncSessionLocal() as db:
                    result = await seed_strategic_modules(db)
                    if not result.get("cip_skipped") or not result.get("scss_skipped") or not result.get("sro_skipped"):
                        logger.info("Strategic modules auto-seeded: CIP=%s, SCSS=%s, SRO=%s",
                            result.get("cip_infrastructure", 0) or "skipped",
                            result.get("scss_suppliers", 0) or "skipped",
                            result.get("sro_institutions", 0) or "skipped",
                        )
            except Exception as e:
                logger.warning("Strategic modules auto-seed skipped or failed: %s", e)
        else:
            logger.info("Strategic modules auto-seed skipped in production (set ALLOW_SEED_IN_PRODUCTION=true to override)")

        # Auto-fill ingestion_sources catalog if empty (needed after migration 20260225_0001).
        if settings.environment != "production" or _allow_seed:
            try:
                from src.core.database import AsyncSessionLocal
                from src.services.ingestion.seed_ingestion_sources import seed_ingestion_sources_if_empty
                async with AsyncSessionLocal() as db:
                    result = await seed_ingestion_sources_if_empty(db)
                    if result.get("seeded", 0) > 0:
                        logger.info("Ingestion catalog auto-seeded: %s sources", result["seeded"])
            except Exception as e:
                logger.warning("Ingestion catalog auto-seed skipped or failed: %s", e)

        # Initialize Knowledge Graph schema
        try:
            from src.services.knowledge_graph import get_knowledge_graph_service
            if getattr(settings, "enable_neo4j", False):
                kg_service = get_knowledge_graph_service()
                await kg_service.initialize_schema()
                logger.info("Knowledge Graph schema initialized")
            else:
                logger.info("Knowledge Graph disabled (enable_neo4j=false)")
        except Exception as e:
            logger.warning(f"Knowledge Graph initialization failed: {e}")
        
        # Initialize Unified Agentic Architecture services (Phases 1-5)
        try:
            from src.services.reflection import reflection_engine  # noqa: F811
            from src.services.agent_message_bus import message_bus  # noqa: F811
            from src.services.audit_trail import audit_trail  # noqa: F811
            from src.services.approval_gate import approval_gate  # noqa: F811
            from src.services.agentic_retriever import get_agentic_retriever
            from src.services.whatif_generator import get_whatif_generator
            from src.services.synthetic_scenarios import get_synthetic_scenario_generator
            from src.services.physics_degradation import get_physics_degradation_service
            from src.services.knowledge_graph_extensions import get_graph_rag_service
            from src.services.uncertainty import uncertainty_quantifier  # noqa: F811
            from src.services.path_integral import path_integral_simulator  # noqa: F811
            from src.services.tunneling_detector import tunneling_detector  # noqa: F811
            from src.services.entanglement_map import entanglement_map  # noqa: F811
            from src.services.swarm_orchestrator import swarm_orchestrator  # noqa: F811

            get_agentic_retriever()
            get_whatif_generator()
            get_synthetic_scenario_generator()
            get_physics_degradation_service()
            get_graph_rag_service()

            logger.info(
                "Unified Agentic Architecture services loaded: "
                "reflection, message_bus, audit_trail, approval_gate, "
                "agentic_retriever, whatif_generator, synthetic_scenarios, "
                "physics_degradation, graph_rag, uncertainty, path_integral, "
                "tunneling_detector, entanglement_map, swarm_orchestrator"
            )
        except Exception as e:
            logger.warning("Agentic Architecture services partial load: %s", e)

        # Start SENTINEL monitoring (auto-start in production)
        try:
            from src.api.v1.endpoints.alerts import start_monitoring
            if settings.auto_start_sentinel or settings.environment == "production":
                await start_monitoring()
                logger.info("SENTINEL monitoring started automatically")
            else:
                logger.info("SENTINEL monitoring service ready (start via API)")
        except Exception as e:
            logger.warning(f"SENTINEL initialization failed: {e}")

        # Start OVERSEER background loop (system-wide monitoring AI)
        oversee_task = None
        try:
            from src.services.oversee import get_oversee_service
            interval = getattr(settings, "oversee_interval_sec", 300)

            async def _oversee_loop():
                svc = get_oversee_service()
                while True:
                    try:
                        await svc.run_cycle(use_llm=getattr(settings, "oversee_use_llm", True), include_events=True)
                    except asyncio.CancelledError:
                        break
                    except Exception as e:
                        logger.warning("OVERSEER cycle error: %s", e)
                    await asyncio.sleep(interval)

            oversee_task = asyncio.create_task(_oversee_loop())
            app.state.oversee_task = oversee_task
            logger.info("OVERSEER monitoring started (interval=%ss)", interval)
        except Exception as e:
            logger.warning("OVERSEER start failed: %s", e)

        # Start Redis events subscriber (broadcast events from Redis to in-process WebSocket clients)
        redis_subscriber_task = None
        if getattr(settings, "enable_redis", False) and (getattr(settings, "redis_url", "") or "").strip():
            try:
                from src.services.redis_bus import run_events_subscriber
                from src.api.v1.endpoints.websocket import manager as ws_manager
                async def _on_redis_event(channel: str, payload: dict):
                    await ws_manager.broadcast_to_channel(channel, payload)
                redis_subscriber_task = asyncio.create_task(run_events_subscriber(_on_redis_event))
                app.state.redis_subscriber_task = redis_subscriber_task
                logger.info("Redis events subscriber started")
            except Exception as e:
                logger.warning("Redis events subscriber start failed: %s", e)

        # Start APScheduler for real-time data ingestion (Phase 1)
        try:
            from src.core.scheduler import start_scheduler
            from src.services.ingestion.register_jobs import register_ingestion_jobs
            if getattr(settings, "enable_scheduler", True):
                start_scheduler()
                register_ingestion_jobs()
                logger.info("Scheduler started for real-time data ingestion")

                # Run key ingestion jobs once at startup so Dashboard shows data immediately
                # (IntervalTrigger otherwise fires first run only after N minutes)
                async def _run_ingestion_once():
                    logger.info(
                        "Ingestion: running initial jobs (market_data, natural_hazards, threat_intelligence, weather, biosecurity, cyber_threats, economic)..."
                    )
                    try:
                        from src.services.ingestion.jobs.market_data_job import run_market_data_job
                        await run_market_data_job()
                        logger.info("Ingestion: market_data run at startup")
                    except Exception as e:
                        logger.warning("Ingestion startup market_data failed: %s", e)
                    try:
                        from src.services.ingestion.jobs.natural_hazards_job import run_natural_hazards_job
                        await run_natural_hazards_job()
                        logger.info("Ingestion: natural_hazards run at startup")
                    except Exception as e:
                        logger.warning("Ingestion startup natural_hazards failed: %s", e)
                    try:
                        from src.services.ingestion.jobs.threat_intelligence_job import run_threat_intelligence_job
                        await run_threat_intelligence_job()
                        logger.info("Ingestion: threat_intelligence run at startup")
                    except Exception as e:
                        logger.warning("Ingestion startup threat_intelligence failed: %s", e)
                    try:
                        from src.services.ingestion.jobs.weather_job import run_weather_job
                        await run_weather_job()
                        logger.info("Ingestion: weather run at startup")
                    except Exception as e:
                        logger.warning("Ingestion startup weather failed: %s", e)
                    try:
                        from src.services.ingestion.jobs.biosecurity_job import run_biosecurity_job
                        await run_biosecurity_job()
                        logger.info("Ingestion: biosecurity run at startup")
                    except Exception as e:
                        logger.warning("Ingestion startup biosecurity failed: %s", e)
                    try:
                        from src.services.ingestion.jobs.cyber_threats_job import run_cyber_threats_job
                        await run_cyber_threats_job()
                        logger.info("Ingestion: cyber_threats run at startup")
                    except Exception as e:
                        logger.warning("Ingestion startup cyber_threats failed: %s", e)
                    try:
                        from src.services.ingestion.jobs.economic_job import run_economic_job
                        await run_economic_job()
                        logger.info("Ingestion: economic run at startup")
                    except Exception as e:
                        logger.warning("Ingestion startup economic failed: %s", e)
                asyncio.create_task(_run_ingestion_once())
        except Exception as e:
            logger.warning("Scheduler start failed: %s", e)

        # Полный чеклист продуктов NVIDIA в консоль/логи
        try:
            from src.services.nvidia_services_status import log_nvidia_services_checklist
            log_nvidia_services_checklist(logger)
        except Exception as e:
            logger.warning("NVIDIA services checklist failed: %s", e)

    except Exception as e:
        logger.error("Failed to initialize databases", error=str(e))
        # Continue anyway for development

    yield

    # Shutdown
    logger.info("Shutting down...")

    # Stop OVERSEER
    try:
        t = getattr(app.state, "oversee_task", None)
        if t and not t.done():
            t.cancel()
            try:
                await t
            except asyncio.CancelledError:
                pass
        logger.info("OVERSEER stopped")
    except Exception as e:
        logger.warning("OVERSEER shutdown error: %s", e)

    # Stop SENTINEL monitoring
    try:
        from src.api.v1.endpoints.alerts import stop_monitoring
        await stop_monitoring()
    except Exception as e:
        logger.warning(f"SENTINEL shutdown error: {e}")

    # Stop Redis events subscriber
    try:
        t = getattr(app.state, "redis_subscriber_task", None)
        if t and not t.done():
            t.cancel()
            try:
                await t
            except asyncio.CancelledError:
                pass
        from src.services.redis_bus import close_redis_bus
        await close_redis_bus()
    except Exception as e:
        logger.warning("Redis bus shutdown error: %s", e)

    # Stop APScheduler
    try:
        from src.core.scheduler import stop_scheduler
        stop_scheduler()
    except Exception as e:
        logger.warning("Scheduler shutdown error: %s", e)
    
    await close_databases()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="""
    ## Physical-Financial Risk Platform
    
    The Operating System for the Physical Economy.
    
    ### Five Layers of Reality:
    
    - **Layer 0: Verified Truth** - Cryptographic proofs of physical state
    - **Layer 1: Living Digital Twins** - 3D models with temporal history
    - **Layer 2: Network Intelligence** - Knowledge Graph of dependencies
    - **Layer 3: Simulation Engine** - Physics + Climate + Economics
    - **Layer 4: Autonomous Agents** - Monitoring, prediction, recommendation
    - **Layer 5: Protocol (PARS)** - Industry standard for physical-financial data
    
    ### Alpha User Features:
    
    - Authentication & Authorization (JWT)
    - Sample data seeding
    - User feedback collection
    - Analytics tracking
    """,
    lifespan=lifespan,
    default_response_class=ORJSONResponse,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== SYSTEM OVERSEER MIDDLEWARE ====================

from src.core.middleware.oversee_middleware import oversee_middleware

@app.middleware("http")
async def oversee_request_middleware(request: Request, call_next):
    """System Overseer middleware - tracks every API request."""
    return await oversee_middleware(request, call_next)


# ==================== MONITORING MIDDLEWARE ====================

# Throttled request log: one line per path per 10s with request count (avoids log flood for polling endpoints)
_REQUEST_LOG_KEY = "_request_log"
_THROTTLE_SEC = 10


@app.middleware("http")
async def add_process_time_header(request: Request, call_next: Callable) -> Response:
    """Add X-Process-Time header and log request details (throttled per path to avoid flood)."""
    start_time = time.time()
    
    # Process request
    response = await call_next(request)
    
    # Calculate processing time
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}"
    
    # Skip health checks and static files
    if request.url.path.startswith(("/health", "/docs", "/openapi", "/favicon")):
        return response
    
    # Throttled logging: one line per path per _THROTTLE_SEC with total request count
    state = getattr(add_process_time_header, _REQUEST_LOG_KEY, None)
    if state is None:
        state = {}
        setattr(add_process_time_header, _REQUEST_LOG_KEY, state)
    key = (request.method, request.url.path)
    now = time.time()
    if key not in state:
        state[key] = {"count": 0, "last_log": 0, "last_status": 200, "last_duration_ms": 0}
    state[key]["count"] += 1
    state[key]["last_status"] = response.status_code
    state[key]["last_duration_ms"] = round(process_time * 1000, 2)
    if now - state[key]["last_log"] >= _THROTTLE_SEC:
        n = state[key]["count"]
        state[key]["count"] = 0
        state[key]["last_log"] = now
        logger.info(
            "request",
            method=request.method,
            path=request.url.path,
            status_code=state[key]["last_status"],
            duration_ms=state[key]["last_duration_ms"],
            request_count=n,
            period_sec=_THROTTLE_SEC,
        )
    
    return response


# API Routes
app.include_router(api_router, prefix=settings.api_prefix)

# OpenTelemetry: setup and instrument (when OTEL_EXPORTER_OTLP_ENDPOINT is set)
try:
    from src.core.tracing import setup_tracing, instrument_fastapi
    if setup_tracing(service_name=settings.app_name):
        instrument_fastapi(app)
except Exception as e:
    logger.warning("Tracing setup skipped: %s", e)


@app.get("/", tags=["root"])
async def root():
    """Root endpoint."""
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "operational",
        "docs": "/docs",
        "alpha_features": [
            "Authentication",
            "Sample Data Seeding",
            "User Feedback",
            "Analytics",
        ],
    }


@app.get("/health", tags=["health"])
async def health_check():
    """Health check endpoint. demo_mode=True when ALLOW_SEED_IN_PRODUCTION — frontend may open all strategic modules without auth."""
    return {
        "status": "healthy",
        "version": settings.app_version,
        "environment": settings.environment,
        "demo_mode": getattr(settings, "allow_seed_in_production", False),
    }


@app.get("/metrics", tags=["monitoring"])
async def get_metrics_prometheus():
    """
    Prometheus metrics endpoint (text format for scraping).
    """
    from prometheus_client import generate_latest, CONTENT_TYPE_LATEST
    from src.core.metrics import DATA_SOURCE_LAST_REFRESH
    from src.services.ingestion.pipeline import get_last_refresh_times
    from dateutil import parser as date_parser
    from datetime import timezone

    # Update data source freshness gauges from ingestion cache
    try:
        last_refreshes = await get_last_refresh_times()
        for source_id, iso_ts in last_refreshes.items():
            if not iso_ts:
                continue
            try:
                dt = date_parser.isoparse(iso_ts)
                if dt.tzinfo:
                    dt = dt.astimezone(timezone.utc)
                else:
                    dt = dt.replace(tzinfo=timezone.utc)
                DATA_SOURCE_LAST_REFRESH.labels(source_id=source_id).set(dt.timestamp())
            except Exception:
                pass
    except Exception:
        pass

    return FastAPIResponse(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST,
    )


@app.get("/metrics/json", tags=["monitoring"])
async def get_metrics_json():
    """
    Basic metrics endpoint (JSON) for ad-hoc monitoring.
    For Prometheus, use GET /metrics.
    """
    import psutil
    import os
    
    # System metrics
    cpu_percent = psutil.cpu_percent(interval=0.1)
    memory = psutil.virtual_memory()
    disk = psutil.disk_usage("/")
    
    return {
        "system": {
            "cpu_percent": cpu_percent,
            "memory_percent": memory.percent,
            "memory_available_gb": round(memory.available / (1024**3), 2),
            "disk_percent": disk.percent,
            "disk_available_gb": round(disk.free / (1024**3), 2),
        },
        "process": {
            "pid": os.getpid(),
            "memory_mb": round(psutil.Process().memory_info().rss / (1024**2), 2),
        },
        "api": {
            "version": settings.app_version,
            "environment": settings.environment,
            "uptime_info": "See process manager for uptime",
        },
    }
