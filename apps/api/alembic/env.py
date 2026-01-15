"""Alembic environment configuration for async PostgreSQL + PostGIS."""
import asyncio
import os
import sys
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# Add src to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

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
    """Get database URL from environment or config."""
    # Priority: environment variable > alembic.ini
    url = os.environ.get("DATABASE_URL")
    if url:
        # Convert postgresql:// to postgresql+asyncpg://
        if url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+asyncpg://", 1)
        return url
    
    # Fallback to alembic.ini
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
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
        compare_server_default=True,
        # PostGIS support
        include_schemas=True,
        render_as_batch=False,
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
