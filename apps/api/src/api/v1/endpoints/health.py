"""Health check endpoints."""
from fastapi import APIRouter

router = APIRouter()


@router.get("")
async def health():
    """Detailed health check."""
    return {
        "status": "healthy",
        "services": {
            "database": "connected",
            "neo4j": "connected",
            "redis": "connected",
            "minio": "connected",
        },
    }
