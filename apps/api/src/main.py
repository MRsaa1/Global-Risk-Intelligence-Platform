"""
Physical-Financial Risk Platform API

The Operating System for the Physical Economy.
"""
import asyncio
import time
from contextlib import asynccontextmanager
from typing import Callable

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import ORJSONResponse
import structlog

from src.core.config import settings
from src.core.database import close_databases, init_databases
from src.api.v1.router import api_router

# Configure structured logging
structlog.configure(
    processors=[
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.stdlib.add_log_level,
        structlog.processors.JSONRenderer(),
    ],
)
logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan - startup and shutdown."""
    # Startup
    logger.info("Starting Physical-Financial Risk Platform API...")
    try:
        await init_databases()
        logger.info("Database connections initialized")
        
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

@app.middleware("http")
async def add_process_time_header(request: Request, call_next: Callable) -> Response:
    """Add X-Process-Time header and log request details."""
    start_time = time.time()
    
    # Process request
    response = await call_next(request)
    
    # Calculate processing time
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = f"{process_time:.4f}"
    
    # Log request (skip health checks and static files)
    if not request.url.path.startswith(("/health", "/docs", "/openapi", "/favicon")):
        logger.info(
            "request",
            method=request.method,
            path=request.url.path,
            status_code=response.status_code,
            duration_ms=round(process_time * 1000, 2),
            client=request.client.host if request.client else "unknown",
        )
    
    return response


# API Routes
app.include_router(api_router, prefix=settings.api_prefix)


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
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": settings.app_version,
        "environment": settings.environment,
    }


@app.get("/metrics", tags=["monitoring"])
async def get_metrics():
    """
    Basic metrics endpoint for monitoring.
    
    In production, integrate with Prometheus/Grafana.
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
