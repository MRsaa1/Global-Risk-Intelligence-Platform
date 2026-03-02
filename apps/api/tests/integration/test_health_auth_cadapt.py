"""
Integration tests: real app endpoints with TestClient.

Run against the same app as unit tests (no separate server).
For nightly, these can be run after migrations and app startup.
"""
import pytest
from fastapi.testclient import TestClient

from src.main import app


def get_client() -> TestClient:
    return TestClient(app)


def test_health():
    client = get_client()
    with client:
        r = client.get("/health")
    assert r.status_code == 200
    assert r.json().get("status") == "healthy"


def test_api_v1_health():
    client = get_client()
    with client:
        r = client.get("/api/v1/health")
    assert r.status_code == 200


def test_auth_flow_register_login():
    client = get_client()
    with client:
        email = f"inttest_{__import__('uuid').uuid4().hex[:8]}@test.example"
        r = client.post(
            "/api/v1/auth/register",
            json={"email": email, "password": "testpass123", "full_name": "Integration"},
        )
        assert r.status_code == 201
        r2 = client.post(
            "/api/v1/auth/login",
            json={"email": email, "password": "testpass123"},
        )
        assert r2.status_code == 200
        assert "access_token" in r2.json()


def test_cadapt_community_risk_critical_path():
    """Critical path: CADAPT community risk (read-only)."""
    client = get_client()
    with client:
        r = client.get("/api/v1/cadapt/community/risk?city=bastrop_tx")
    assert r.status_code == 200
    data = r.json()
    assert "hazards" in data or "community" in data
