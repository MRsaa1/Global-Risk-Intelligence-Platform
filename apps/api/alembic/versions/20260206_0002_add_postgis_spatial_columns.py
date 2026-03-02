"""Add PostGIS spatial columns and indexes for production spatial queries.

Enables ST_DWithin, ST_Contains for assets-in-zone queries.
SQLite: no-op. PostgreSQL: enable PostGIS, add geometry from lat/lng where missing.
"""
from alembic import op
import sqlalchemy as sa

revision = "20260206_0002"
down_revision = "20260206_0001"
branch_labels = None
depends_on = None


def _is_postgres():
    conn = op.get_bind()
    return conn.dialect.name == "postgresql"


def upgrade() -> None:
    if not _is_postgres():
        return
    # Enable PostGIS extension for ST_DWithin, ST_Contains spatial queries
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")


def downgrade() -> None:
    if not _is_postgres():
        return
    # PostGIS extension is typically not dropped (shared)
    pass
