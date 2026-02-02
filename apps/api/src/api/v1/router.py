"""API v1 router - combines all endpoints."""
from fastapi import APIRouter

from .endpoints import (
    analytics,
    assets,
    bcp,
    digital_twins,
    health,
    provenance,
    simulations,
    agents,
    agent_monitoring,
    agent_evaluation,
    data_curation,
    synthetic_data,
    auth,
    seed,
    feedback,
    nvidia,
    streaming,
    stress,
    geodata,
    data_federation,
    stress_tests,
    universal_stress,
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
    strategic_modules,
    oversee,
    aiq,
    generative,
    # New Phase Endpoints
    insurance,
    credit,
    spatial,
    projects,
    portfolios,
    fraud,
    annotations,
    risk_zones,
    twin_assets,
    omniverse,
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

# Digital Twin Asset Library (USD masters + GLB derivatives)
api_router.include_router(
    twin_assets.router,
    prefix="/twin-assets",
    tags=["Digital Twin Asset Library"],
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
api_router.include_router(
    agent_monitoring.router,
    prefix="/agents/monitoring",
    tags=["Layer 4: Agent Monitoring (NeMo Toolkit)"],
)
api_router.include_router(
    agent_evaluation.router,
    prefix="/agents/evaluate",
    tags=["Layer 4: Agent Evaluation (NeMo Evaluator)"],
)

# Data Curation (NeMo Curator)
api_router.include_router(
    data_curation.router,
    prefix="/data/curator",
    tags=["Data Curation (NeMo Curator)"],
)

# Synthetic Data (NeMo Data Designer)
api_router.include_router(
    synthetic_data.router,
    prefix="/data/synthetic",
    tags=["Synthetic Data (NeMo Data Designer)"],
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

# Data Federation (DFM-style adapters + pipelines)
api_router.include_router(
    data_federation.router,
    prefix="/data-federation",
    tags=["Data Federation"],
)

# Omniverse / E2CC launch (Open in Omniverse)
api_router.include_router(
    omniverse.router,
    prefix="/omniverse",
    tags=["Omniverse / E2CC"],
)

# Stress Tests (new comprehensive system)
api_router.include_router(
    stress_tests.router,
    tags=["Stress Tests"],
)

# Universal Stress Testing (Methodology v1.0)
api_router.include_router(
    universal_stress.router,
    tags=["Universal Stress Testing"],
)

# BCP Generator (Business Continuity Plans)
api_router.include_router(
    bcp.router,
    prefix="/bcp",
    tags=["BCP Generator"],
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

# System Overseer (monitoring AI)
api_router.include_router(
    oversee.router,
    prefix="/oversee",
    tags=["System Overseer"],
)

# AI-Q Assistant (Ask / Explain with citations)
api_router.include_router(
    aiq.router,
    prefix="/aiq",
    tags=["AI-Q Assistant"],
)

# Generative AI (explanations, recommendations, disclosure drafts, synthesis)
api_router.include_router(
    generative.router,
    prefix="/generative",
    tags=["Generative AI"],
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

# Strategic Modules (registry + CIP, SCSS, SRO)
api_router.include_router(
    strategic_modules.router,
    prefix="/strategic-modules",
    tags=["Strategic Modules Registry"],
)
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

# ==================== 3D + AI Fintech Strategy ====================

# Insurance Scoring
api_router.include_router(
    insurance.router,
    prefix="/insurance",
    tags=["Insurance Scoring"],
)

# Credit Risk
api_router.include_router(
    credit.router,
    prefix="/credit",
    tags=["Credit Risk"],
)

# Spatial Data (Point Cloud, Satellite)
api_router.include_router(
    spatial.router,
    prefix="/spatial",
    tags=["Spatial Data"],
)

# Project Finance
api_router.include_router(
    projects.router,
    prefix="/projects",
    tags=["Project Finance"],
)

# Portfolios and REIT
api_router.include_router(
    portfolios.router,
    prefix="/portfolios",
    tags=["Portfolios & REIT"],
)

# Fraud Detection
api_router.include_router(
    fraud.router,
    prefix="/fraud",
    tags=["Fraud Detection"],
)

# Scene Annotations
api_router.include_router(
    annotations.router,
    prefix="/annotations",
    tags=["3D Annotations"],
)

# Risk Zones Dependencies & Analysis
api_router.include_router(
    risk_zones.router,
    prefix="/risk-zones",
    tags=["Risk Zones Analysis"],
)
