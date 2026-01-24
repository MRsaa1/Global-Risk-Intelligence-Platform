"""Pytest configuration and fixtures."""
import os

# Prefer SQLite for tests before any src import that creates the engine
os.environ.setdefault("USE_SQLITE", "true")

from fastapi.testclient import TestClient

from src.main import app


def get_client() -> TestClient:
    """Return a TestClient for the FastAPI app."""
    return TestClient(app)
