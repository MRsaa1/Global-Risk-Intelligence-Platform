"""Alembic environment configuration for async PostgreSQL + PostGIS."""
import asyncio
import os
import sys
from logging.config import fileConfig
from pathlib import Path

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Add src to path
_api_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, _api_dir)

# Load .env from apps/api so DATABASE_URL / USE_SQLITE are set (server uses SQLite, not PostgreSQL)
_env_file = Path(_api_dir) / ".env"
if _env_file.exists():
    with open(_env_file, encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, _, v = line.partition("=")
                k, v = k.strip(), v.strip().strip('"').strip("'")
                if k and os.environ.get(k) is None:
                    os.environ[k] = v

# Import models to ensure they're registered with Base
from src.core.database import Base
from src.models import (
    Asset,
    DigitalTwin,
    TwinTimeline,
    TwinState,
    DataProvenance,
    VerificationRecord,
    User,
    StressTest,
    RiskZone,
    ZoneAsset,
    StressTestReport,
    ActionPlan,
    HistoricalEvent,
)

# Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Target metadata for 'autogenerate'
target_metadata = Base.metadata


def get_url() -> str:
    """Get database URL from .env (loaded above), then alembic.ini."""
    url = os.environ.get("DATABASE_URL")
    use_sqlite = os.environ.get("USE_SQLITE", "true").lower() == "true"
    if use_sqlite and not url:
        # Default SQLite path (same as app): apps/api/prod.db or dev.db
        default_path = os.path.join(_api_dir, "prod.db")
        if not os.path.exists(default_path):
            default_path = os.path.join(_api_dir, "dev.db")
        url = f"sqlite:///{default_path}"
    if url:
        # Convert postgresql:// to postgresql+asyncpg:// for async engine
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        # Convert sqlite:// to sqlite+aiosqlite:// for async migrations
        elif url.startswith("sqlite://") and "+aiosqlite" not in url:
            url = url.replace("sqlite://", "sqlite+aiosqlite://", 1)
        return url

    # Fallback to alembic.ini (PostgreSQL)
    return config.get_main_option("sqlalchemy.url")


def run_migrations_offline() -> None:
    """
    Run migrations in 'offline' mode.
    
    Generates SQL script without connecting to DB.
    """
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    """Run migrations with given connection."""
    is_sqlite = str(connection.engine.url).startswith("sqlite")
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
        include_schemas=True,
        render_as_batch=is_sqlite,
    )

    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    """Run migrations in async mode with asyncpg."""
    configuration = config.get_section(config.config_ini_section)
    configuration["sqlalchemy.url"] = get_url()
    
    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    """Run migrations in 'online' mode with async engine."""
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
