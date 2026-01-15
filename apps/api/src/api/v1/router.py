"""API v1 router - combines all endpoints."""
from fastapi import APIRouter

from .endpoints import (
    assets,
    digital_twins,
    health,
    provenance,
    simulations,
    agents,
    auth,
    seed,
    feedback,
    nvidia,
    streaming,
    stress,
    geodata,
    stress_tests,
    historical_events,
    platform,
    alerts,
    predictions,
    whatif,
)

api_router = APIRouter()

# Health & Status
api_router.include_router(
    health.router,
    prefix="/health",
    tags=["health"],
)

# Authentication
api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["Authentication"],
)

# Seed Data (dev only)
api_router.include_router(
    seed.router,
    prefix="/seed",
    tags=["Seed Data (Dev)"],
)

# Feedback
api_router.include_router(
    feedback.router,
    prefix="/feedback",
    tags=["Feedback"],
)

# NVIDIA Integration
api_router.include_router(
    nvidia.router,
    prefix="/nvidia",
    tags=["NVIDIA Integration"],
)

# Layer 0: Verified Truth
api_router.include_router(
    provenance.router,
    prefix="/provenance",
    tags=["Layer 0: Verified Truth"],
)

# Layer 1: Living Digital Twins
api_router.include_router(
    assets.router,
    prefix="/assets",
    tags=["Layer 1: Assets"],
)

api_router.include_router(
    digital_twins.router,
    prefix="/twins",
    tags=["Layer 1: Digital Twins"],
)

# Layer 3: Simulation Engine
api_router.include_router(
    simulations.router,
    prefix="/simulations",
    tags=["Layer 3: Simulations"],
)

# Layer 4: Autonomous Agents
api_router.include_router(
    agents.router,
    prefix="/agents",
    tags=["Layer 4: Autonomous Agents"],
)

# Real-time Streaming
api_router.include_router(
    streaming.router,
    prefix="/streaming",
    tags=["Real-time Streaming"],
)

# Stress Testing
api_router.include_router(
    stress.router,
    prefix="/stress",
    tags=["Stress Testing"],
)

# Geo Data (for visualization)
api_router.include_router(
    geodata.router,
    prefix="/geodata",
    tags=["Geo Data"],
)

# Stress Tests (new comprehensive system)
api_router.include_router(
    stress_tests.router,
    tags=["Stress Tests"],
)

# Historical Events (for calibration)
api_router.include_router(
    historical_events.router,
    tags=["Historical Events"],
)

# Platform Status (all layers)
api_router.include_router(
    platform.router,
    prefix="/platform",
    tags=["Platform Status"],
)

# Real-time Alerts (SENTINEL)
api_router.include_router(
    alerts.router,
    prefix="/alerts",
    tags=["Real-time Alerts"],
)

# Predictive Analytics (ML)
api_router.include_router(
    predictions.router,
    prefix="/predictions",
    tags=["Predictive Analytics"],
)

# What-If Simulator & Cascade Analysis
api_router.include_router(
    whatif.router,
    prefix="/whatif",
    tags=["What-If Simulator"],
)
