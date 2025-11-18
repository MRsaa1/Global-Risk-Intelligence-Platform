"""
Database session management.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from contextlib import contextmanager
import os

# Database URL from environment
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql://risk_user:risk_password@localhost:5432/risk_platform"
)

# Create engine
engine = create_engine(
    DATABASE_URL,
    pool_pre_ping=True,  # Verify connections before using
    pool_size=10,
    max_overflow=20,
    echo=os.getenv("SQL_ECHO", "false").lower() == "true",
)

# Session factory
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def get_db() -> Session:
    """
    Get database session (for dependency injection).
    
    Usage in Fastify:
    ```typescript
    const db = get_db();
    ```
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@contextmanager
def db_session():
    """Context manager for database session."""
    session = SessionLocal()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def init_db():
    """Initialize database (create tables)."""
    from apps.api_gateway.src.db.models import Base
    Base.metadata.create_all(bind=engine)


def drop_db():
    """Drop all tables (use with caution!)."""
    from apps.api_gateway.src.db.models import Base
    Base.metadata.drop_all(bind=engine)

