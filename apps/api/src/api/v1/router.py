"""API v1 router - combines all endpoints."""
from fastapi import APIRouter

from .endpoints import (
    analytics,
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
    exports,
    bulk,
    preferences,
    bim,
    websocket,
    audit,
    climate,
    cip,
    scss,
    sro,
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

# Export Endpoints (CSV, Excel)
api_router.include_router(
    exports.router,
    prefix="/exports",
    tags=["Data Export"],
)

# Bulk Operations (CSV upload, batch processing)
api_router.include_router(
    bulk.router,
    prefix="/bulk",
    tags=["Bulk Operations"],
)

# User Preferences (saved filters, dashboard settings)
api_router.include_router(
    preferences.router,
    prefix="/preferences",
    tags=["User Preferences"],
)

# BIM Processing (IFC files, 3D models)
api_router.include_router(
    bim.router,
    prefix="/bim",
    tags=["BIM Processing"],
)

# WebSocket Real-time Updates
api_router.include_router(
    websocket.router,
    prefix="/ws",
    tags=["WebSocket"],
)

# Audit Logging
api_router.include_router(
    audit.router,
    prefix="/audit",
    tags=["Audit Logging"],
)

# Climate Data
api_router.include_router(
    climate.router,
    prefix="/climate",
    tags=["Climate Data"],
)

# Strategic Modules (stubs)
api_router.include_router(
    cip.router,
    prefix="/cip",
    tags=["Module: Critical Infrastructure Protection"],
)
api_router.include_router(
    scss.router,
    prefix="/scss",
    tags=["Module: Supply Chain Sovereignty"],
)
api_router.include_router(
    sro.router,
    prefix="/sro",
    tags=["Module: Systemic Risk Observatory"],
)

# Analytics (Dashboard data)
api_router.include_router(
    analytics.router,
    prefix="/analytics",
    tags=["Analytics"],
)
