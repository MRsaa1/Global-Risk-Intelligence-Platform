"""Application configuration."""
from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Make env loading robust regardless of current working directory.
    # - In dev we often run from repo root or from apps/api.
    # - In prod/docker the app root is typically /app (apps/api).
    _APP_DIR = Path(__file__).resolve().parents[2]  # .../apps/api/src/core/config.py -> .../apps/api

    model_config = SettingsConfigDict(
        env_file=(str(_APP_DIR / ".env"), ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",  # Allow extra env vars
    )
    
    # Application
    app_name: str = "Physical-Financial Risk Platform"
    app_version: str = "0.1.0"
    debug: bool = False
    environment: Literal["development", "staging", "production"] = "development"
    
    # Database mode
    use_sqlite: bool = False  # Use SQLite instead of PostgreSQL for simple deployments

    # Optional infra toggles (treat services as optional unless explicitly enabled)
    # These are especially important for lightweight/SQLite deployments where
    # Neo4j/MinIO/Timescale are not running and should not degrade health.
    enable_neo4j: bool = False
    enable_minio: bool = False
    enable_timescale: bool = False
    
    # API
    api_prefix: str = "/api/v1"
    api_host: str = "0.0.0.0"
    api_port: int = 9002
    
    # PostgreSQL (main database with PostGIS)
    database_url: str = "postgresql://pfrp_user:pfrp_secret_2024@localhost:5432/physical_financial_risk"
    
    # TimescaleDB (time-series)
    timescale_url: str = "postgresql://pfrp_user:pfrp_secret_2024@localhost:5433/timeseries"
    
    # Neo4j (Knowledge Graph)
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = "pfrp_graph_2024"
    
    # Redis
    redis_url: str = "redis://localhost:6379"
    
    # MinIO (Object Storage)
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = "pfrp_minio"
    minio_secret_key: str = "pfrp_minio_secret_2024"
    minio_secure: bool = False
    minio_bucket_assets: str = "assets"
    minio_bucket_reports: str = "reports"

    # Omniverse / OpenUSD (Nucleus)
    # Nucleus is the canonical store for USD scenes/assets (enterprise collaboration).
    # Web clients will typically consume derived formats (GLB/3D Tiles).
    enable_nucleus: bool = False
    nucleus_url: str = "http://localhost:3009"

    # E2CC (Earth-2 Command Center) launch URL for "Open in Omniverse"
    e2cc_base_url: str = "http://localhost:8010"
    nucleus_library_root: str = "/Library"  # recommended: /Library/City, /Library/Factory, /Library/Finance
    nucleus_projects_root: str = "/Projects"
    nucleus_mount_dir: str = ""  # e.g. /mnt/nucleus (optional; used by conversion workers)

    # Celery (background jobs)
    enable_celery: bool = False
    celery_broker_url: str = ""  # default: redis_url
    celery_result_backend: str = ""  # default: redis_url
    
    # Security
    secret_key: str = "change-me-in-production-use-openssl-rand-hex-32"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 hours
    
    # CORS
    cors_origins: list[str] = [
        "http://localhost:5180", 
        "http://127.0.0.1:5180",  # Add 127.0.0.1 for Vite dev server
        "http://localhost:5173", 
        "http://127.0.0.1:5173",
        "http://localhost:3000"
    ]
    
    # Climate Data
    cmip6_data_path: str = "./data/climate/cmip6"
    fema_flood_api: str = "https://hazards.fema.gov/gis/nfhl/rest/services"

    # High-Fidelity (WRF/ADCIRC) storage for Layer 4 API
    # Local path or S3 bucket; ETL writes {path_or_bucket}/{scenario_id}/flood.json, wind.json, metadata.json
    high_fidelity_storage_path: str = ""  # e.g. ./data/high_fidelity or /mnt/high_fidelity
    high_fidelity_s3_bucket: str = ""  # If set, loader reads from S3 instead of local path
    
    # NOAA API
    # Get from https://www.ncdc.noaa.gov/cdo-web/token
    # IMPORTANT: never commit real API tokens to the repo.
    noaa_api_token: str = ""

    # Entity resolution & news enrichment (Phase 2/3)
    newsapi_api_key: str = ""  # NewsAPI for scenario enrichment
    opencorporates_api_token: str = ""  # OpenCorporates for entity resolution
    
    # NVIDIA Integration
    # Back-compat: accept both NVIDIA_API_KEY and NVIDIA_LLM_API_KEY (some deployments set the latter).
    nvidia_api_key: str = Field(default="", validation_alias=AliasChoices("NVIDIA_API_KEY", "NVIDIA_LLM_API_KEY"))
    nvidia_corrdiff_api_key: str = ""
    nvidia_fourcastnet_api_key: str = ""
    ngc_api_key: str = ""
    
    # NVIDIA NIM endpoints (local inference)
    corrdiff_nim_url: str = "http://localhost:8000"
    fourcastnet_nim_url: str = "http://localhost:8001"
    flux_nim_url: str = "http://localhost:8002"
    llama_nim_url: str = "http://localhost:8003"
    
    # Agent-specific API keys
    nvidia_flux_api_key: str = ""
    
    # Deployment mode: cloud (NVIDIA API) or local (NIM with GPU)
    nvidia_mode: str = "cloud"
    
    # NVIDIA Cloud APIs
    # Note: LLM works via cloud API, but Earth-2/FLUX require local NIM
    nvidia_llm_api_url: str = "https://integrate.api.nvidia.com/v1"
    
    # Earth-2 and PhysicsNeMo require local NIM containers
    # These are placeholder URLs - actual deployment needs local GPU server
    earth2_api_url: str = "http://localhost:8001"  # Local NIM
    physics_nemo_api_url: str = "http://localhost:8002"  # Local NIM
    
    # Use local NIM or cloud
    # IMPORTANT:
    # - Default to cloud-only so dev envs don't constantly probe local NIM ports.
    # - Enable explicitly when a GPU/NIM stack is available.
    use_local_nim: bool = False
    # When False, climate/simulations use Open-Meteo + flood impact (CPU) only, no Earth-2.
    use_earth2: bool = True
    nvidia_inception_enabled: bool = False
    
    # Logging
    log_level: str = "INFO"
    
    # SENTINEL Monitoring
    auto_start_sentinel: bool = False  # Auto-start SENTINEL monitoring on startup
    sentinel_check_interval_seconds: int = 300  # Check every 5 minutes

    # OVERSEER (System-wide monitoring AI)
    oversee_interval_sec: int = 300  # Run every 5 minutes
    oversee_use_llm: bool = True  # Use NVIDIA LLM for executive_summary
    
    # NVIDIA NeMo Integration
    nemo_retriever_enabled: bool = True  # Enable RAG pipeline
    nemo_guardrails_enabled: bool = True  # Enable safety and compliance checks
    nemo_agent_toolkit_enabled: bool = True  # Enable agent monitoring (Phase 2)
    nemo_curator_enabled: bool = True  # Enable data curation (Phase 2)
    nemo_data_designer_enabled: bool = True  # Enable synthetic data generation (Phase 2)
    nemo_evaluator_enabled: bool = True  # Enable agent evaluation (Phase 2)
    nemo_customizer_enabled: bool = False  # Enable fine-tuning (Phase 3)
    
    # NeMo Retriever settings
    nemo_embedding_model: str = "nvidia/nv-embedqa-e5-v5"
    nemo_rerank_model: str = "nvidia/nv-rerankqa-mistral-4b-v3"
    
    # NeMo Guardrails settings
    guardrails_config_path: str = "config/guardrails.yml"
    
    # NeMo Agent Toolkit settings (Phase 2)
    agent_toolkit_metrics_retention_days: int = 30
    agent_toolkit_profiling_enabled: bool = True
    
    # NeMo Curator settings (Phase 2)
    curator_auto_clean_enabled: bool = True
    curator_quality_threshold: float = 0.8
    
    # NeMo Data Designer settings (Phase 2)
    data_designer_model: str = "nemotron-4"
    data_designer_temperature: float = 0.7
    
    # NeMo Evaluator settings (Phase 2)
    evaluator_test_suite_path: str = "tests/agent_evaluation"
    evaluator_auto_run: bool = False

    # Data Federation (DFM-style adapters + pipelines)
    use_data_federation_pipelines: bool = False
    data_federation_cache_ttl_sec: int = 3600

    # NVIDIA Riva (Speech AI) — voice alerts, TTS for reports
    enable_riva: bool = False
    riva_url: str = "http://localhost:50051"  # gRPC; or Riva cloud endpoint
    riva_tts_model: str = "ljspeech"  # or nvidia/parakeet-* for multilingual
    riva_stt_model: str = "nvidia/parakeet-rnnt-1.1b"

    # NVIDIA Dynamo — distributed low-latency inference (when scaling agents)
    enable_dynamo: bool = False
    dynamo_url: str = "http://localhost:8004"

    # Triton Inference Server — model serving (when self-hosting LLM/embeddings)
    enable_triton: bool = False
    triton_url: str = "http://localhost:8000"
    triton_llm_model: str = "nemotron"  # model name on Triton

    # TensorRT-LLM — optimized LLM inference (typically behind Triton)
    use_tensorrt_llm: bool = False  # When True, LLM client may route to Triton with TRT-LLM backend

    # Optional: cuOpt (routing), IndeX (volumetric viz), WaveWorks (ocean), PhysX, Warp, FlashInfer, Megatron
    enable_cuopt: bool = False
    cuopt_url: str = "http://localhost:8005"
    enable_index_viz: bool = False
    index_url: str = "http://localhost:8006"
    enable_waveworks: bool = False
    waveworks_url: str = "http://localhost:8007"

    # Demo/alpha: allow "Load demo data" (POST /seed/seed) in production for demo servers
    allow_seed_in_production: bool = False


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
