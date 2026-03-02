"""
Telegram OSINT client for public channel monitoring.

Uses Telegram Bot API. For reading public channels without joining, the bot must be
added as admin or use Telethon/MTProto (not implemented here). This client provides:
- get_me: verify bot token
- get_updates: poll messages sent to the bot (e.g. from a forwarding channel)
- Optional: document channel list for use with Telethon in a separate worker

Config: telegram_bot_token, telegram_channels (comma-separated).
"""
from __future__ import annotations

import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)

TELEGRAM_BOT_API = "https://api.telegram.org/bot{token}"
REQUEST_TIMEOUT = 15.0


@dataclass
class TelegramMessage:
    """Single message from Telegram."""
    update_id: int
    message_id: int
    chat_id: int
    text: str
    date: Optional[str] = None
    from_username: Optional[str] = None


class TelegramClient:
    """Client for Telegram Bot API."""

    def __init__(self, bot_token: Optional[str] = None, timeout: float = REQUEST_TIMEOUT):
        self.bot_token = (bot_token or "").strip()
        self.timeout = timeout

    @property
    def is_configured(self) -> bool:
        return bool(self.bot_token)

    def _base_url(self) -> str:
        return TELEGRAM_BOT_API.format(token=self.bot_token)

    async def get_me(self) -> Optional[Dict[str, Any]]:
        """Verify bot token."""
        if not self.is_configured:
            return None
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                r = await client.get(f"{self._base_url()}/getMe")
                if r.status_code == 200:
                    data = r.json()
                    if data.get("ok"):
                        return data.get("result")
        except Exception as e:
            logger.warning("Telegram getMe error: %s", e)
        return None

    async def get_updates(self, offset: Optional[int] = None, limit: int = 100) -> List[TelegramMessage]:
        """
        Poll updates (messages to the bot). Use for channels that forward to the bot.
        Returns list of TelegramMessage.
        """
        if not self.is_configured:
            return []
        params: Dict[str, Any] = {"limit": limit}
        if offset is not None:
            params["offset"] = offset
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                r = await client.get(f"{self._base_url()}/getUpdates", params=params)
                if r.status_code != 200:
                    return []
                data = r.json()
                if not data.get("ok"):
                    return []
        except Exception as e:
            logger.warning("Telegram getUpdates error: %s", e)
            return []

        out: List[TelegramMessage] = []
        for u in data.get("result", []):
            msg = u.get("message") or u.get("channel_post")
            if not msg:
                continue
            text = (msg.get("text") or msg.get("caption") or "").strip()
            out.append(TelegramMessage(
                update_id=u.get("update_id", 0),
                message_id=msg.get("message_id", 0),
                chat_id=msg.get("chat", {}).get("id", 0),
                text=text[:2000],
                date=msg.get("date"),
                from_username=(msg.get("from") or {}).get("username"),
            ))
        return out

    async def fetch_risk_signals(self, max_messages: int = 50) -> List[TelegramMessage]:
        """
        Fetch recent messages from bot updates (e.g. forwarded from monitored channels).
        For direct public channel reads, use Telethon in a separate service.
        """
        if not self.is_configured:
            return []
        return await self.get_updates(limit=max_messages)


def get_telegram_client(bot_token: Optional[str] = None) -> TelegramClient:
    if bot_token is None:
        try:
            from src.core.config import settings
            bot_token = getattr(settings, "telegram_bot_token", "") or ""
        except Exception:
            bot_token = ""
    return TelegramClient(bot_token=bot_token)
