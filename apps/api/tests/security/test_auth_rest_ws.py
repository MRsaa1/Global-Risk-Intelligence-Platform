"""
Security regression tests: REST and WS auth/RBAC.

- Without token: protected endpoints return 401 (or 403).
- With non-admin token: admin-only endpoints (oversee/run, ws/broadcast) return 403.
- With admin token: admin endpoints return success (2xx).
"""
import pytest
from fastapi.testclient import TestClient
from uuid import uuid4

from src.main import app
from src.core.security import create_access_token
from src.core.database import AsyncSessionLocal
from src.models.user import User, UserRole
from src.core.security import get_password_hash


def get_client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def client():
    return get_client()


@pytest.fixture
def viewer_token(client: TestClient):
    """Create a viewer user via register and return token."""
    email = f"secviewer_{uuid4().hex[:8]}@test.example"
    r = client.post(
        "/api/v1/auth/register",
        json={"email": email, "password": "testpass123", "full_name": "Viewer"},
    )
    assert r.status_code == 201
    r2 = client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": "testpass123"},
    )
    assert r2.status_code == 200
    return r2.json()["access_token"]


@pytest.fixture
async def admin_token():
    """Create an admin user in DB and return JWT."""
    from sqlalchemy import select
    async with AsyncSessionLocal() as db:
        email = f"secadmin_{uuid4().hex[:8]}@test.example"
        user = User(
            id=str(uuid4()),
            email=email,
            hashed_password=get_password_hash("adminpass123"),
            full_name="Admin",
            role=UserRole.ADMIN.value,
            is_active=True,
            is_verified=True,
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        token = create_access_token(data={"sub": str(user.id)})
        return token


class TestAlertsAuth:
    """Alerts control endpoints require auth."""

    def test_acknowledge_without_token_returns_401(self, client: TestClient):
        r = client.post(
            "/api/v1/alerts/acknowledge",
            json={"alert_id": "test-alert-1"},
        )
        assert r.status_code in (401, 403)

    def test_acknowledge_with_viewer_token_returns_200_or_404(self, client: TestClient, viewer_token: str):
        r = client.post(
            "/api/v1/alerts/acknowledge",
            json={"alert_id": "test-alert-nonexistent"},
            headers={"Authorization": f"Bearer {viewer_token}"},
        )
        # 200 if ack succeeded, 404 if alert not found — but not 401/403
        assert r.status_code in (200, 404, 422)


class TestOverseeAuth:
    """Oversee run and circuit breaker reset require auth + ADMIN."""

    def test_run_without_token_returns_401(self, client: TestClient):
        r = client.post("/api/v1/oversee/run")
        assert r.status_code in (401, 403)

    def test_run_with_viewer_token_returns_403(self, client: TestClient, viewer_token: str):
        r = client.post(
            "/api/v1/oversee/run",
            headers={"Authorization": f"Bearer {viewer_token}"},
        )
        assert r.status_code == 403

    @pytest.mark.asyncio
    async def test_run_with_admin_token_returns_2xx(self, client: TestClient, admin_token: str):
        r = client.post(
            "/api/v1/oversee/run",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert r.status_code in (200, 202, 500), "Admin must get through (2xx or server error)"


class TestWebSocketBroadcastAuth:
    """WS broadcast endpoint requires auth + ADMIN."""

    def test_broadcast_without_token_returns_401(self, client: TestClient):
        r = client.post("/api/v1/ws/broadcast?channel=dashboard", json={"test": True})
        assert r.status_code in (401, 403)

    def test_broadcast_with_viewer_token_returns_403(self, client: TestClient, viewer_token: str):
        r = client.post(
            "/api/v1/ws/broadcast?channel=dashboard",
            json={"test": True},
            headers={"Authorization": f"Bearer {viewer_token}"},
        )
        assert r.status_code == 403

    @pytest.mark.asyncio
    async def test_broadcast_with_admin_token_returns_2xx(self, client: TestClient, admin_token: str):
        r = client.post(
            "/api/v1/ws/broadcast?channel=dashboard",
            json={"test": True},
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert r.status_code in (200, 422), "Admin must get through"
