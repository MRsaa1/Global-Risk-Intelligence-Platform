"""Database connections and session management.

Supports:
- SQLite (local development) - USE_SQLITE=true
- PostgreSQL with PostGIS (production) - USE_SQLITE=false

PostGIS enables spatial queries:
- ST_Contains, ST_Intersects for zone containment
- ST_Distance for proximity calculations
- ST_Buffer for zone expansion
"""
from contextlib import asynccontextmanager
from typing import AsyncGenerator
import os

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from .config import settings


# Detect database mode
USE_SQLITE = os.environ.get("USE_SQLITE", "true").lower() == "true"


def get_database_url() -> str:
    """
    Get database URL based on environment.
    
    Priority:
    1. USE_SQLITE=true → SQLite (local dev)
    2. DATABASE_URL env var → PostgreSQL
    3. settings.database_url → PostgreSQL from config
    """
    if USE_SQLITE:
        # SQLite (dev or production). Allow override via DATABASE_URL.
        default_db_path = os.path.join(os.path.dirname(__file__), "..", "..", "dev.db")
        db_url = os.environ.get("DATABASE_URL") or f"sqlite:///{default_db_path}"

        # Ensure async driver for SQLAlchemy async engine
        if db_url.startswith("sqlite://") and "+aiosqlite" not in db_url:
            db_url = db_url.replace("sqlite://", "sqlite+aiosqlite://", 1)

        return db_url
    
    # PostgreSQL for production
    db_url = os.environ.get("DATABASE_URL") or settings.database_url
    
    # Ensure asyncpg driver
    if db_url.startswith("postgresql://"):
        db_url = db_url.replace("postgresql://", "postgresql+asyncpg://", 1)
    
    return db_url


def is_using_postgis() -> bool:
    """Check if we're using PostgreSQL with PostGIS."""
    return not USE_SQLITE


database_url = get_database_url()

# Determine if using SQLite
is_sqlite = database_url.startswith("sqlite")


def _get_engine_kwargs() -> dict:
    """Get optimized engine configuration."""
    if is_sqlite:
        return {}  # SQLite doesn't support pooling options
    
    # PostgreSQL optimized settings
    return {
        "pool_size": 20,           # Number of connections in pool
        "max_overflow": 30,        # Extra connections beyond pool_size
        "pool_timeout": 30,        # Seconds to wait for connection
        "pool_recycle": 1800,      # Recycle connections after 30 min
        "pool_pre_ping": True,     # Verify connections before use
    }


engine = create_async_engine(
    database_url,
    echo=settings.debug,
    **_get_engine_kwargs(),
)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    """Base class for SQLAlchemy models."""
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Get database session."""
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# Mock Neo4j for development
class MockNeo4jSession:
    """Mock Neo4j session for development without Neo4j."""
    async def run(self, query, **params):
        return MockNeo4jResult()
    
    async def close(self):
        pass


class MockNeo4jResult:
    """Mock Neo4j result."""
    async def consume(self):
        pass
    
    async def data(self):
        return []


class MockNeo4jDriver:
    """Mock Neo4j driver for development."""
    def session(self):
        return MockNeo4jSession()
    
    async def close(self):
        pass


# Try to connect to Neo4j, fall back to mock
try:
    from neo4j import AsyncGraphDatabase
    neo4j_driver = AsyncGraphDatabase.driver(
        settings.neo4j_uri,
        auth=(settings.neo4j_user, settings.neo4j_password),
    )
except Exception:
    # Use mock driver if Neo4j is not available
    neo4j_driver = MockNeo4jDriver()


@asynccontextmanager
async def get_neo4j_session():
    """Get Neo4j session."""
    session = neo4j_driver.session()
    try:
        yield session
    finally:
        await session.close()


def _sqlite_sync_assets_columns(sync_conn):
    """Add missing columns to assets table for SQLite (e.g. after model changes)."""
    from sqlalchemy import text
    try:
        from src.models.asset import Asset
    except ImportError:
        return
    try:
        r = sync_conn.execute(text("PRAGMA table_info(assets)"))
        existing = {row[1] for row in r}
    except Exception:
        return
    def _sqlite_type(c):
        n = type(c.type).__name__
        if n in ("Integer", "BigInteger"):
            return "INTEGER"
        if n == "Float":
            return "REAL"
        return "TEXT"
    for col in Asset.__table__.c:
        if col.name in existing:
            continue
        try:
            sync_conn.execute(text(f'ALTER TABLE assets ADD COLUMN "{col.name}" {_sqlite_type(col)}'))
        except Exception:
            pass


async def init_databases():
    """Initialize database connections and create tables."""
    # Create SQLite/PostgreSQL tables
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        if is_sqlite:
            await conn.run_sync(_sqlite_sync_assets_columns)
    
    # Skip Neo4j verification in development
    if not isinstance(neo4j_driver, MockNeo4jDriver):
        try:
            async with get_neo4j_session() as session:
                result = await session.run("RETURN 1 as test")
                await result.consume()
        except Exception:
            print("Warning: Neo4j not available, using mock")


async def close_databases():
    """Close database connections."""
    await engine.dispose()
    await neo4j_driver.close()
