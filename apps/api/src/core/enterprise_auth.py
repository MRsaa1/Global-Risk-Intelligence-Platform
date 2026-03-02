"""
Enterprise Authentication: SSO (OAuth2/OIDC), 2FA (TOTP), session management, and API keys.

Additive to existing JWT auth -- all new paths are feature-flagged.
"""
import hashlib
import hmac
import logging
import secrets
import time
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional
from uuid import uuid4

from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# TOTP (2FA)
# ---------------------------------------------------------------------------

TOTP_DIGITS = 6
TOTP_INTERVAL = 30
TOTP_WINDOW = 1  # allow +/- 1 interval


def _generate_totp_secret() -> str:
    """Generate a random base32 TOTP secret."""
    import base64
    return base64.b32encode(secrets.token_bytes(20)).decode("ascii").rstrip("=")


def _compute_totp(secret: str, timestamp: Optional[int] = None) -> str:
    """Compute TOTP code from secret and timestamp."""
    import base64
    import struct
    if timestamp is None:
        timestamp = int(time.time())
    counter = timestamp // TOTP_INTERVAL
    # Decode base32 secret (add padding if needed)
    padded = secret + "=" * (8 - len(secret) % 8) if len(secret) % 8 else secret
    key = base64.b32decode(padded, casefold=True)
    msg = struct.pack(">Q", counter)
    h = hmac.new(key, msg, hashlib.sha1).digest()
    offset = h[-1] & 0x0F
    code = struct.unpack(">I", h[offset:offset + 4])[0] & 0x7FFFFFFF
    return str(code % (10 ** TOTP_DIGITS)).zfill(TOTP_DIGITS)


def verify_totp(secret: str, code: str) -> bool:
    """Verify a TOTP code with window tolerance."""
    now = int(time.time())
    for delta in range(-TOTP_WINDOW, TOTP_WINDOW + 1):
        expected = _compute_totp(secret, now + delta * TOTP_INTERVAL)
        if hmac.compare_digest(expected, code):
            return True
    return False


def generate_totp_uri(secret: str, email: str, issuer: str = "PFRP") -> str:
    """Generate otpauth:// URI for QR code scanning."""
    from urllib.parse import quote
    return f"otpauth://totp/{quote(issuer)}:{quote(email)}?secret={secret}&issuer={quote(issuer)}&digits={TOTP_DIGITS}&period={TOTP_INTERVAL}"


class TOTPService:
    """TOTP 2FA operations."""

    @staticmethod
    def setup(email: str) -> Dict[str, str]:
        """Generate new TOTP secret and provisioning URI."""
        secret = _generate_totp_secret()
        uri = generate_totp_uri(secret, email)
        return {"secret": secret, "uri": uri}

    @staticmethod
    def verify(secret: str, code: str) -> bool:
        return verify_totp(secret, code)


# ---------------------------------------------------------------------------
# OAuth2 / OIDC (SSO)
# ---------------------------------------------------------------------------

class OAuth2Config:
    """OAuth2/OIDC provider configuration."""
    def __init__(
        self,
        provider: str,
        client_id: str,
        client_secret: str,
        discovery_url: str,
        redirect_uri: str,
        scopes: List[str] | None = None,
    ):
        self.provider = provider
        self.client_id = client_id
        self.client_secret = client_secret
        self.discovery_url = discovery_url
        self.redirect_uri = redirect_uri
        self.scopes = scopes or ["openid", "email", "profile"]
        self._discovery_doc: Dict[str, Any] | None = None

    async def get_discovery(self) -> Dict[str, Any]:
        if self._discovery_doc:
            return self._discovery_doc
        try:
            import httpx
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(self.discovery_url)
                r.raise_for_status()
                self._discovery_doc = r.json()
                return self._discovery_doc
        except Exception as e:
            logger.warning("OAuth2 discovery fetch failed for %s: %s", self.provider, e)
            return {}

    def get_authorize_url(self, state: str) -> str:
        """Build authorization URL (synchronous, uses well-known pattern)."""
        from urllib.parse import urlencode
        base = self.discovery_url.replace("/.well-known/openid-configuration", "").rstrip("/")
        authorize_endpoint = f"{base}/authorize"
        params = {
            "client_id": self.client_id,
            "response_type": "code",
            "redirect_uri": self.redirect_uri,
            "scope": " ".join(self.scopes),
            "state": state,
        }
        return f"{authorize_endpoint}?{urlencode(params)}"

    async def exchange_code(self, code: str) -> Dict[str, Any]:
        """Exchange authorization code for tokens."""
        try:
            import httpx
            disc = await self.get_discovery()
            token_endpoint = disc.get("token_endpoint", "")
            if not token_endpoint:
                return {"error": "No token endpoint in discovery"}
            async with httpx.AsyncClient(timeout=15) as client:
                r = await client.post(token_endpoint, data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": self.redirect_uri,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                })
                r.raise_for_status()
                return r.json()
        except Exception as e:
            logger.warning("OAuth2 code exchange failed: %s", e)
            return {"error": str(e)}

    async def get_userinfo(self, access_token: str) -> Dict[str, Any]:
        """Fetch user info from the OIDC userinfo endpoint."""
        try:
            import httpx
            disc = await self.get_discovery()
            userinfo_endpoint = disc.get("userinfo_endpoint", "")
            if not userinfo_endpoint:
                return {"error": "No userinfo endpoint"}
            async with httpx.AsyncClient(timeout=10) as client:
                r = await client.get(userinfo_endpoint, headers={"Authorization": f"Bearer {access_token}"})
                r.raise_for_status()
                return r.json()
        except Exception as e:
            return {"error": str(e)}


def get_oauth2_config() -> Optional[OAuth2Config]:
    """Build OAuth2Config from settings if configured."""
    client_id = getattr(settings, "oauth2_client_id", "") or ""
    client_secret = getattr(settings, "oauth2_client_secret", "") or ""
    discovery = getattr(settings, "oauth2_discovery_url", "") or ""
    if not (client_id and client_secret and discovery):
        return None
    redirect_uri = getattr(settings, "oauth2_redirect_uri", "") or f"https://{getattr(settings, 'api_host', 'localhost')}:{getattr(settings, 'api_port', 9002)}/api/v1/auth/oauth2/callback"
    return OAuth2Config(
        provider=getattr(settings, "oauth2_provider", "generic"),
        client_id=client_id,
        client_secret=client_secret,
        discovery_url=discovery,
        redirect_uri=redirect_uri,
    )


# ---------------------------------------------------------------------------
# API Keys
# ---------------------------------------------------------------------------

def generate_api_key() -> tuple[str, str]:
    """Generate an API key and its hash. Returns (raw_key, hash)."""
    raw = f"pfrp_{secrets.token_urlsafe(32)}"
    key_hash = hashlib.sha256(raw.encode()).hexdigest()
    return raw, key_hash


def hash_api_key(raw_key: str) -> str:
    return hashlib.sha256(raw_key.encode()).hexdigest()


# ---------------------------------------------------------------------------
# Session tracking
# ---------------------------------------------------------------------------

def generate_session_id() -> str:
    return f"sess_{secrets.token_urlsafe(24)}"


# ---------------------------------------------------------------------------
# IP Whitelisting
# ---------------------------------------------------------------------------

def check_ip_whitelist(client_ip: str, whitelist: List[str]) -> bool:
    """Check if client IP is in the whitelist. Empty whitelist = allow all."""
    if not whitelist:
        return True
    return client_ip in whitelist
