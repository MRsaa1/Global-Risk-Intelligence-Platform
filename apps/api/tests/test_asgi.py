"""ASGI Phase 3 tests: Capability Emergence, Goal Drift, Crypto Audit, API."""
import json
import pytest

from .conftest import get_client


# ==================== API Integration ====================


def test_asgi_systems_list() -> None:
    """GET /api/v1/asgi/systems returns list."""
    client = get_client()
    with client:
        r = client.get("/api/v1/asgi/systems")
    assert r.status_code == 200
    data = r.json()
    assert "items" in data
    assert "total" in data
    assert isinstance(data["items"], list)


def test_asgi_systems_post() -> None:
    """POST /api/v1/asgi/systems registers AI system."""
    client = get_client()
    with client:
        r = client.post(
            "/api/v1/asgi/systems",
            json={"name": "Test-LLM-1", "system_type": "llm", "capability_level": "narrow"},
        )
    assert r.status_code == 200
    data = r.json()
    assert "id" in data
    assert data["name"] == "Test-LLM-1"
    assert data["system_type"] == "llm"
    assert data["capability_level"] == "narrow"


def test_asgi_systems_get_404() -> None:
    """GET /api/v1/asgi/systems/99999 returns 404."""
    client = get_client()
    with client:
        r = client.get("/api/v1/asgi/systems/99999")
    assert r.status_code == 404


def test_asgi_compliance_frameworks() -> None:
    """GET /api/v1/asgi/compliance/frameworks returns frameworks (may be empty before seed)."""
    client = get_client()
    with client:
        r = client.get("/api/v1/asgi/compliance/frameworks")
    assert r.status_code == 200
    data = r.json()
    assert "frameworks" in data
    assert isinstance(data["frameworks"], list)


def test_asgi_audit_anchors() -> None:
    """GET /api/v1/asgi/audit/anchors returns anchors list."""
    client = get_client()
    with client:
        r = client.get("/api/v1/asgi/audit/anchors")
    assert r.status_code == 200
    data = r.json()
    assert "anchors" in data
    assert isinstance(data["anchors"], list)


def test_asgi_audit_log() -> None:
    """POST /api/v1/asgi/audit/log logs event and returns hash."""
    client = get_client()
    with client:
        r = client.post(
            "/api/v1/asgi/audit/log",
            json={"event": {"action": "test", "timestamp": "2026-02-06T12:00:00Z"}},
        )
    assert r.status_code == 200
    data = r.json()
    assert "event_hash" in data
    assert data["status"] == "logged"
    assert len(data["event_hash"]) == 64


def test_asgi_audit_verify() -> None:
    """GET /api/v1/asgi/audit/verify/1 verifies event (id 1 may not exist)."""
    client = get_client()
    with client:
        r = client.get("/api/v1/asgi/audit/verify/1")
    assert r.status_code == 200
    data = r.json()
    assert "event_id" in data
    assert "verified" in data


def test_asgi_emergence_alerts() -> None:
    """GET /api/v1/asgi/emergence/alerts returns alerts."""
    client = get_client()
    with client:
        r = client.get("/api/v1/asgi/emergence/alerts")
    assert r.status_code == 200
    data = r.json()
    assert "alerts" in data
    assert "count" in data
    assert isinstance(data["alerts"], list)


def test_asgi_drift_system() -> None:
    """GET /api/v1/asgi/drift/1 returns drift analysis (system 1 may not exist)."""
    client = get_client()
    with client:
        r = client.get("/api/v1/asgi/drift/1")
    assert r.status_code == 200
    data = r.json()
    assert "system_id" in data
    assert "drift_score" in data
    assert "trend" in data


# ==================== Unit-style (via API) ====================


def test_asgi_full_flow() -> None:
    """Full flow: register system, create capability event, create drift snapshot, get emergence/drift."""
    client = get_client()
    with client:
        # Register
        r1 = client.post("/api/v1/asgi/systems", json={"name": "FlowTest-LLM", "system_type": "llm"})
        assert r1.status_code == 200
        sys_id = r1.json()["id"]

        # Capability event
        r2 = client.post(
            "/api/v1/asgi/emergence/events",
            json={
                "ai_system_id": sys_id,
                "event_type": "benchmark_jump",
                "metrics": {"benchmark_jump": 0.08, "task_expansion": 0.02},
                "severity": 2,
            },
        )
        assert r2.status_code == 200
        assert r2.json().get("event_type") == "benchmark_jump"

        # Drift snapshot
        r3 = client.post(
            "/api/v1/asgi/drift/snapshots",
            json={"ai_system_id": sys_id, "drift_from_baseline": 0.05},
        )
        assert r3.status_code == 200
        assert r3.json().get("ai_system_id") == sys_id

        # Emergence for system
        r4 = client.get(f"/api/v1/asgi/emergence/{sys_id}")
        assert r4.status_code == 200
        assert r4.json().get("system_id") == str(sys_id)

        # Drift for system
        r5 = client.get(f"/api/v1/asgi/drift/{sys_id}")
        assert r5.status_code == 200
        assert r5.json().get("system_id") == str(sys_id)
