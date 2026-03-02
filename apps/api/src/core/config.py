"""Application configuration."""
import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Literal

from pydantic import AliasChoices, Field, computed_field, field_validator
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
    
    # PostgreSQL (main database with PostGIS) — set via DATABASE_URL env var
    database_url: str = ""
    
    # TimescaleDB (time-series) — set via TIMESCALE_URL env var
    timescale_url: str = ""
    
    # Neo4j (Knowledge Graph)
    neo4j_uri: str = "bolt://localhost:7687"
    neo4j_user: str = "neo4j"
    neo4j_password: str = ""
    
    # Redis — по умолчанию выключен для локальной разработки без Docker.
    # Для продакшена или с docker compose: ENABLE_REDIS=true, REDIS_URL=redis://localhost:6379
    enable_redis: bool = False
    redis_url: str = "redis://localhost:6379"
    # When True and enable_redis, SharedContextStore (workflow context) uses Redis for multi-instance
    use_redis_shared_context: bool = False
    
    # MinIO (Object Storage)
    minio_endpoint: str = "localhost:9000"
    minio_access_key: str = ""
    minio_secret_key: str = ""
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

    # Scheduler (real-time data ingestion: APScheduler for periodic jobs)
    enable_scheduler: bool = True
    scheduler_timezone: str = "UTC"
    
    # Security — SECRET_KEY must be set in production. In dev, a random key is generated per process.
    secret_key: str = ""
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 hours

    # Enterprise Auth: SSO / OAuth2 / OIDC
    sso_enabled: bool = False
    oauth2_provider: str = "generic"  # generic, okta, azure_ad, google
    oauth2_client_id: str = ""
    oauth2_client_secret: str = ""
    oauth2_discovery_url: str = ""  # e.g. https://accounts.google.com/.well-known/openid-configuration
    oauth2_redirect_uri: str = ""

    # Enterprise Auth: 2FA
    totp_enabled: bool = False

    # Enterprise Auth: API keys
    api_key_auth_enabled: bool = True

    # Google Cloud
    gcloud_project_id: str = ""
    gcloud_service_account_json: str = ""
    enable_earth_engine: bool = True  # Use Google Earth Engine when GCLOUD_* are set
    bigquery_project_id: str = ""
    bigquery_dataset_id: str = "pfrp_analytics"
    vertex_ai_region: str = "us-central1"
    cds_api_key: str = ""
    cds_api_url: str = "https://cds.climate.copernicus.eu/api/v2"
    google_maps_api_key: str = ""

    @field_validator("secret_key", mode="after")
    @classmethod
    def ensure_secret_key(cls, v: str) -> str:
        """Generate a random secret_key for dev if not provided. In production, reject empty/placeholder."""
        import os
        env = (os.environ.get("ENVIRONMENT") or "").strip().lower()
        if env == "production":
            if not v or (v.strip() in ("", "change-me-in-production-use-openssl-rand-hex-32", "change-me-use-openssl-rand-hex-32")):
                raise ValueError(
                    "SECRET_KEY must be set in production (use e.g. openssl rand -hex 32). "
                    "Refusing to start with empty or placeholder key."
                )
            return v
        if v and v not in ("", "change-me-in-production-use-openssl-rand-hex-32", "change-me-use-openssl-rand-hex-32"):
            return v
        import secrets
        import warnings
        generated = secrets.token_hex(32)
        warnings.warn(
            "SECRET_KEY is not set — using a random ephemeral key. "
            "JWTs will be invalidated on every restart. "
            "Set SECRET_KEY in .env for production!",
            stacklevel=2,
        )
        return generated
    
    # CORS — stored as string so env is not auto JSON-parsed (avoids SettingsError on invalid JSON)
    cors_origins_str: str = Field(
        default='["http://localhost:5180","http://127.0.0.1:5180","http://localhost:15180","http://127.0.0.1:15180","http://localhost:5173","http://127.0.0.1:5173","http://localhost:3000"]',
        validation_alias=AliasChoices("CORS_ORIGINS", "cors_origins_str"),
        description="JSON array of origins, e.g. [\"https://example.com\"]",
    )

    @staticmethod
    def _parse_cors_origins(s: str) -> list[str]:
        """Parse CORS_ORIGINS string: JSON array or single URL."""
        if not s or not isinstance(s, str):
            return []
        s = s.strip()
        if s.startswith("'") and s.endswith("'"):
            s = s[1:-1]
        if s.startswith('"') and s.endswith('"'):
            s = s[1:-1]
        try:
            out = json.loads(s)
            return out if isinstance(out, list) else [s] if s else []
        except json.JSONDecodeError:
            return [s] if s else []

    @computed_field
    @property
    def cors_origins(self) -> list[str]:
        """CORS allowed origins (list)."""
        return self._parse_cors_origins(self.cors_origins_str)

    
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

    # NASA FIRMS (active fire detection)
    # Free MAP_KEY from https://firms.modaps.eosdis.nasa.gov/api/area/
    firms_map_key: str = ""

    # Entity resolution & news enrichment (Phase 2/3)
    newsapi_api_key: str = ""  # NewsAPI for scenario enrichment
    opencorporates_api_token: str = ""  # OpenCorporates for entity resolution

    # Risk Intelligence Engine (v2)
    risk_model_version: int = 2  # 1 = legacy 7 factors, 2 = GDELT/World Bank/OFAC + hysteresis (default: v2)
    fred_api_key: str = ""  # FRED API for US economic indicators (optional)
    gdelt_cache_ttl_minutes: int = 15  # GDELT DOC API cache TTL
    # Long cache for risk scores so levels stay stable (no critical↔high flicker on server)
    risk_cache_ttl_hours: int = 24  # RISK_CACHE_TTL_HOURS; set 24 on server for stable display

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
    # Optional model overrides (e.g. local NIM model names): fast (SENTINEL), deep (ANALYST/ADVISOR), report (REPORTER)
    nvidia_llm_model_fast: str = ""
    nvidia_llm_model_deep: str = ""
    nvidia_llm_model_report: str = ""
    
    # Earth-2 and PhysicsNeMo require local NIM containers
    # These are placeholder URLs - actual deployment needs local GPU server
    earth2_api_url: str = "http://localhost:8001"  # Local NIM
    physics_nemo_api_url: str = "http://localhost:8002"  # Local NIM
    
    # Use local NIM or cloud
    # IMPORTANT:
    # - Default to cloud-only so dev envs don't constantly probe local NIM ports.
    # - Enable explicitly when a GPU/NIM stack is available.
    use_local_nim: bool = False
    # Feature flags: when False, skip NIM for that feature (weather uses Open-Meteo; FLUX disabled or cloud)
    use_nim_weather: bool = True
    use_nim_flux: bool = True
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
    # If set (e.g. http://127.0.0.1:9002), Overseer will probe critical API routes and alert on 404/5xx
    oversee_critical_routes_base_url: str = ""
    
    # NVIDIA NeMo Integration
    nemo_retriever_enabled: bool = True  # Enable RAG pipeline
    nemo_guardrails_enabled: bool = True  # Enable safety and compliance checks
    nemo_agent_toolkit_enabled: bool = True  # Enable agent monitoring (Phase 2)
    nemo_curator_enabled: bool = True  # Enable data curation (Phase 2)
    nemo_data_designer_enabled: bool = True  # Enable synthetic data generation (Phase 2)
    nemo_evaluator_enabled: bool = True  # Enable agent evaluation (Phase 2)
    nemo_customizer_enabled: bool = False  # Enable fine-tuning (Phase 3)
    nemo_customizer_api_url: str = ""  # When set, Customizer calls real NeMo fine-tune API
    nemo_finetune_base_model: str = "nemotron-4-340b"
    nemo_finetune_output_dir: str = ""  # Local path for adapter/weights; used by run_nemo_finetune
    nemo_gym_api_url: str = ""  # When set, RL Gym calls real NeMo Gym API
    nemo_rl_api_url: str = ""   # When set, RL service calls real NeMo RL API

    # Client fine-tuning: use client model or inject client context (Phase C3)
    use_client_finetune_model: bool = False
    client_model_path: str = ""  # Path or model_id when using client model; can be set via API

    # NeMo Retriever settings
    nemo_embedding_model: str = "nvidia/nv-embedqa-e5-v5"
    nemo_rerank_model: str = "nvidia/nv-rerankqa-mistral-4b-v3"
    
    # NVIDIA cuRAG — GPU-accelerated document RAG (optional)
    enable_curag: bool = False
    curag_index_path: str = ""  # Directory for index persistence; empty = in-memory only
    curag_embedding_model: str = ""  # Optional override; empty = use nvidia-rag default
    
    # NeMo Guardrails settings
    guardrails_config_path: str = "config/guardrails.yml"
    # Ethics rails (Colang-compatible config: harm_prevention, fairness, protect_pii)
    ethics_rails_config_path: str = "config/ethics_rails"
    # Optional: when set, Ethicist calls NeMo Guardrails API for Colang flows
    nemo_guardrails_url: str = ""
    # NVIDIA Morpheus — optional agent output validation (data leak, hallucination detection)
    enable_morpheus: bool = False
    morpheus_validation_url: str = ""  # e.g. http://morpheus:8080/validate
    morpheus_timeout_sec: float = 10.0
    # Human-in-the-loop: escalation threshold (EUR) and life-safety flag
    ethicist_escalation_threshold_eur: float = 10_000_000.0
    ethicist_life_safety_severity_threshold: float = 0.85
    # When True, persist HITL approval requests to hitl_approval_requests table (survives restarts)
    use_hitl_persistence: bool = False
    # When True, persist AgentMessageBus messages to agent_message_log (audit by correlation_id)
    use_message_bus_persistence: bool = False
    
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
    riva_tts_voice: str = ""  # e.g. "English-US.Female-1" or "Magpie-Multilingual.EN-US.Sofia" for female; empty = default
    riva_stt_model: str = "nvidia/parakeet-rnnt-1.1b"

    # NVIDIA Dynamo — distributed low-latency inference (when scaling agents)
    enable_dynamo: bool = False
    dynamo_url: str = "http://localhost:8004"

    # Triton Inference Server — model serving (when self-hosting LLM/embeddings)
    enable_triton: bool = False
    triton_url: str = "http://localhost:8000"
    triton_llm_model: str = "nemotron"  # model name on Triton

    # Nemotron for complex reasoning and plan_steps (AI-Q / agentic)
    use_nemotron_for_reasoning: bool = False
    nemotron_model_id: str = ""  # override, e.g. nvidia/nemotron-4-340b-instruct; empty = use NEMOTRON_NANO_9B

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

    # SCSS Phase 5: ERP/PLM sync adapters (optional; when set, sync uses real endpoints)
    scss_sap_base_url: str = ""  # e.g. https://sap.example.com/api/suppliers
    scss_sap_token: str = ""    # Bearer or Basic auth
    scss_oracle_base_url: str = ""
    scss_oracle_token: str = ""
    scss_edi_endpoint_url: str = ""  # EDI gateway (e.g. AS2/API)
    scss_edi_api_key: str = ""

    # SCSS Phase 6: Sanctions screening (optional; when set, compliance uses real lists)
    scss_ofac_api_url: str = ""   # OFAC SDN list API or self-hosted mirror
    scss_ofac_api_key: str = ""
    scss_eu_sanctions_url: str = ""  # EU Consolidated list API
    scss_eu_sanctions_api_key: str = ""

    # Social Media / OSINT (Phase 3)
    twitter_bearer_token: str = ""
    reddit_client_id: str = ""
    reddit_client_secret: str = ""
    telegram_bot_token: str = ""
    telegram_channels: str = ""  # comma-separated public channel handles
    enable_social_media: bool = False

    # ARIN Platform Integration (Unified Analysis export)
    # When ARIN_EXPORT_URL is set, risk data is sent to ARIN after each calculation
    arin_base_url: str = ""  # e.g. https://arin.saa-alliance.com (used for verdict proxy + fallback export)
    arin_export_url: str = ""  # e.g. https://arin.saa-alliance.com/api/v1/unified/export
    arin_api_key: str = ""  # X-API-Key if ARIN requires authentication
    arin_default_entity_id: str = "portfolio_global"  # Fallback — must match entity in ARIN

    # External integrations (Phase 5: agentic adapter stubs — secrets from env only)
    jira_base_url: str = ""   # e.g. https://your-domain.atlassian.net
    jira_email: str = ""
    jira_api_token: str = ""  # Atlassian API token
    servicenow_instance: str = ""  # e.g. your-instance.service-now.com
    servicenow_username: str = ""
    servicenow_password: str = ""


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
