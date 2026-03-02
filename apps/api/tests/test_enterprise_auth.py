"""Tests for enterprise auth: TOTP, API keys, permissions, sessions."""
from conftest import get_client

client = get_client()


class TestTOTP:
    def test_totp_setup_and_verify(self):
        from src.core.enterprise_auth import TOTPService, _compute_totp
        result = TOTPService.setup("test@example.com")
        assert "secret" in result
        assert "uri" in result
        assert result["uri"].startswith("otpauth://totp/")

        # Generate valid code and verify
        code = _compute_totp(result["secret"])
        assert TOTPService.verify(result["secret"], code) is True
        assert TOTPService.verify(result["secret"], "000000") is False


class TestAPIKeys:
    def test_generate_api_key(self):
        from src.core.enterprise_auth import generate_api_key, hash_api_key
        raw, hashed = generate_api_key()
        assert raw.startswith("pfrp_")
        assert len(hashed) == 64
        assert hash_api_key(raw) == hashed


class TestPermissions:
    def test_role_permissions_defined(self):
        from src.models.enterprise_auth import ROLE_PERMISSIONS, Permission
        assert "admin" in ROLE_PERMISSIONS
        assert "analyst" in ROLE_PERMISSIONS
        assert "viewer" in ROLE_PERMISSIONS
        assert len(ROLE_PERMISSIONS["admin"]) >= len(ROLE_PERMISSIONS["analyst"])
        assert Permission.ADMIN_ALL.value in ROLE_PERMISSIONS["admin"]

    def test_permissions_matrix_endpoint(self):
        r = client.get("/api/v1/auth/enterprise/permissions/matrix")
        assert r.status_code == 200
        data = r.json()
        assert "admin" in data["roles"]
        assert len(data["permissions"]) > 10


class TestSSOConfig:
    def test_oauth2_providers_endpoint(self):
        r = client.get("/api/v1/auth/enterprise/oauth2/providers")
        assert r.status_code == 200
        data = r.json()
        assert "providers" in data
        assert "sso_enabled" in data


class TestIPWhitelist:
    def test_check_ip_whitelist(self):
        from src.core.enterprise_auth import check_ip_whitelist
        assert check_ip_whitelist("1.2.3.4", []) is True  # empty = allow all
        assert check_ip_whitelist("1.2.3.4", ["1.2.3.4"]) is True
        assert check_ip_whitelist("1.2.3.4", ["5.6.7.8"]) is False
