"""API v1 router - combines all endpoints."""
from fastapi import APIRouter

from .endpoints import (
    analytics,
    dashboard,
    assets,
    bcp,
    bcp,
    data_api,
    digital_twins,
    health,
    provenance,
    simulations,
    agents,
    finetuning,
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
    unified_stress,
    historical_events,
    risk_events,
    platform,
    pars,
    alerts,
    predictions,
    whatif,
    exports,
    bulk,
    preferences,
    bim,
    websocket,
    audit,
    arin,
    climate,
    earth_engine,
    asgi,
    cip,
    scss,
    sro,
    srs,
    cityos,
    fst,
    strategic_modules,
    oversee,
    aiq,
    ingestion,
    generative,
    nlp,
    backtesting,
    market_metrics,
    fat_tail,
    lpr,
    disinformation,
    etiology,
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
    # Master Plan: Spatial + Domain Modules
    h3_grid,
    erf,
    biosec,
    asm as asm_nuclear,
    cadapt,
    playbooks,
    cross_track,
    replay,
    audit_ext,
    compliance,
    country_risk,
    ue5,
    cascade_engine,
    enterprise_auth,
    developer,
    quantum,
    recovery_plans,
    rag,
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

# Enterprise Auth (SSO, 2FA, sessions, API keys, RBAC)
api_router.include_router(
    enterprise_auth.router,
    prefix="/auth/enterprise",
    tags=["Enterprise Auth"],
)

# Developer Ecosystem (webhooks, Agent OS, workflows)
api_router.include_router(
    developer.router,
    prefix="/developer",
    tags=["Developer"],
)

# Data API for B2B (insurers, REITs) — read-only risk data
api_router.include_router(
    data_api.router,
    prefix="/data",
    tags=["Data API (B2B)"],
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
    finetuning.router,
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

# Manual ingestion controls
api_router.include_router(
    ingestion.router,
    prefix="/ingestion",
    tags=["Ingestion Control"],
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

# Unified Stress (full assessment by location: all scenarios, metrics, report_v2)
api_router.include_router(
    unified_stress.router,
    tags=["Unified Stress"],
)

# BCP Generator (Business Continuity Plans)
api_router.include_router(
    bcp.router,
    prefix="/bcp",
    tags=["BCP Generator"],
)

# Recovery Plans (BCP linked to stress tests)
api_router.include_router(
    recovery_plans.router,
    prefix="/recovery-plans",
    tags=["Recovery Plans (BCP)"],
)

# Historical Events (for calibration)
api_router.include_router(
    historical_events.router,
    tags=["Historical Events"],
)

# Risk Events (external data: USGS, NOAA, EM-DAT, etc. — correct online risk & backtesting)
api_router.include_router(
    risk_events.router,
    tags=["Risk Events (External Data)"],
)

# Platform Status (all layers)
api_router.include_router(
    platform.router,
    prefix="/platform",
    tags=["Platform Status"],
)
api_router.include_router(
    pars.router,
    prefix="/pars",
    tags=["Layer 5: PARS Protocol"],
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

# RAG — document indexing and retrieval (cuRAG)
api_router.include_router(
    rag.router,
    prefix="/rag",
    tags=["RAG (cuRAG)"],
)

# Generative AI (explanations, recommendations, disclosure drafts, synthesis)
api_router.include_router(
    generative.router,
    prefix="/generative",
    tags=["Generative AI"],
)

# NLP (sentiment, entity sentiment; Google NL / AWS Comprehend or demo)
api_router.include_router(
    nlp.router,
    prefix="/nlp",
    tags=["NLP"],
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

# Backtesting (strategy x historical crises, persist runs)
api_router.include_router(
    backtesting.router,
    prefix="/backtesting",
    tags=["Backtesting"],
)

# Market metrics (volatility, liquidity for stress scenarios)
api_router.include_router(
    market_metrics.router,
    prefix="/market-metrics",
    tags=["Market Metrics"],
)

# Fat Tail (Black Swan) catalog and triggers
api_router.include_router(
    fat_tail.router,
    prefix="/fat-tail",
    tags=["Fat Tail"],
)

# LPR (Leader/Persona Risk) — psychological profile, Riva/Maxine/Vertex pipeline
api_router.include_router(
    lpr.router,
    prefix="/lpr",
    tags=["LPR"],
)

# Disinformation — sources, analysis, campaigns, panic-risk alerts
api_router.include_router(
    disinformation.router,
    prefix="/disinformation",
    tags=["Disinformation"],
)

# Etiology — cause-effect chains for Analyst and stress reports
api_router.include_router(
    etiology.router,
    prefix="/etiology",
    tags=["Etiology"],
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

# ARIN - Autonomous Risk Intelligence Network (Risk & Intelligence OS)
api_router.include_router(
    arin.router,
    prefix="/arin",
    tags=["ARIN - Risk Assessment"],
)

# Climate Data
api_router.include_router(
    climate.router,
    prefix="/climate",
    tags=["Climate Data"],
)
api_router.include_router(
    earth_engine.router,
    prefix="/earth-engine",
)
api_router.include_router(
    country_risk.router,
    prefix="/country-risk",
    tags=["Country Risk"],
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
api_router.include_router(
    srs.router,
    prefix="/srs",
    tags=["Module: Sovereign Risk Shield"],
)
api_router.include_router(
    cityos.router,
    prefix="/cityos",
    tags=["Module: City Operating System"],
)
api_router.include_router(
    fst.router,
    prefix="/fst",
    tags=["Module: Financial System Stress Test"],
)
api_router.include_router(
    asgi.router,
    prefix="/asgi",
    tags=["Module: AI Safety & Governance (ASGI)"],
)

# Dashboard (Today Card, Sentiment Meter)
api_router.include_router(
    dashboard.router,
    prefix="/dashboard",
    tags=["Dashboard"],
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

# H3 Hexagonal Grid (Spatial Core)
api_router.include_router(
    h3_grid.router,
    prefix="/h3",
    tags=["H3 Spatial Grid"],
)

# ERF - Existential Risk Framework (Meta-Layer)
api_router.include_router(
    erf.router,
    prefix="/erf",
    tags=["Module: Existential Risk Framework (ERF)"],
)

# BIOSEC - Biosecurity & Pandemic
api_router.include_router(
    biosec.router,
    prefix="/biosec",
    tags=["Module: Biosecurity & Pandemic (BIOSEC)"],
)

# ASM - Nuclear Safety & Monitoring
api_router.include_router(
    asm_nuclear.router,
    prefix="/asm",
    tags=["Module: Nuclear Safety & Monitoring (ASM)"],
)

# CADAPT - Climate Adaptation & Local Resilience (Track B)
api_router.include_router(
    cadapt.router,
    prefix="/cadapt",
    tags=["Module: Climate Adaptation (CADAPT)"],
)

# Playbooks — what to do now (municipal operations)
api_router.include_router(
    playbooks.router,
    prefix="/playbooks",
    tags=["Playbooks"],
)

# Cross-Track Synergy (Track B -> Track A data pipeline)
api_router.include_router(
    cross_track.router,
    prefix="/cross-track",
    tags=["Cross-Track Synergy"],
)

# Scenario Replay & Time Travel
api_router.include_router(
    replay.router,
    prefix="/replay",
    tags=["Scenario Replay"],
)

# Decision-Grade Audit Extension & Regulatory Disclosure
api_router.include_router(
    audit_ext.router,
    prefix="/audit-ext",
    tags=["Decision-Grade Audit"],
)

# Unified Compliance Dashboard (Gap X7)
api_router.include_router(
    compliance.router,
    prefix="/compliance",
    tags=["Compliance Dashboard"],
)

# UE5 Visual Simulation (Cesium for Unreal data endpoints)
api_router.include_router(
    ue5.router,
    tags=["UE5 Visual Simulation"],
)

# Cross-Module Cascade Engine, EP Curve, Bayesian Network, Forecasting,
# Auto-Recommendations, Sentinel Hub, WHO, CISA/MITRE
api_router.include_router(
    cascade_engine.router,
    prefix="/risk-engine",
    tags=["Risk Engine (Cascade, Bayesian, EP Curve, Forecasting)"],
)

# Quantum-Inspired Risk Intelligence (Path Integral, Tunneling, Entanglement, Swarm)
api_router.include_router(
    quantum.router,
    tags=["Quantum Risk Intelligence"],
)
