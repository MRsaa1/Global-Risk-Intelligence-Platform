"""Application configuration."""
from functools import lru_cache
from typing import Literal

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""
    
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
    )
    
    # Application
    app_name: str = "Physical-Financial Risk Platform"
    app_version: str = "0.1.0"
    debug: bool = False
    environment: Literal["development", "staging", "production"] = "development"
    
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
    
    # Security
    secret_key: str = "change-me-in-production-use-openssl-rand-hex-32"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 hours
    
    # CORS
    cors_origins: list[str] = ["http://localhost:5180", "http://localhost:5173", "http://localhost:3000"]
    
    # Climate Data
    cmip6_data_path: str = "./data/climate/cmip6"
    fema_flood_api: str = "https://hazards.fema.gov/gis/nfhl/rest/services"
    
    # NVIDIA Integration
    nvidia_api_key: str = ""
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
    
    # NVIDIA Cloud APIs (fallback)
    earth2_api_url: str = "https://api.nvidia.com/v1/earth2"
    physics_nemo_api_url: str = "https://api.nvidia.com/v1/physics-nemo"
    
    # Use local NIM or cloud
    use_local_nim: bool = True
    nvidia_inception_enabled: bool = False
    
    # Logging
    log_level: str = "INFO"


@lru_cache
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()


settings = get_settings()
