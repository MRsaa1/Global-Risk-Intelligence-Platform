"""
AgentMessageBus — inter-agent communication protocol.

Allows agents to send typed messages to each other during workflow
execution.  Backed by an in-memory queue (Redis in production).
Optional: when use_message_bus_persistence is True, messages are logged to agent_message_log.
"""
import asyncio
import json
import logging
import time
from collections import defaultdict
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from uuid import uuid4

from src.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class AgentMessage:
    id: str = ""
    sender: str = ""
    recipient: str = ""
    message_type: str = ""
    payload: Dict[str, Any] = field(default_factory=dict)
    correlation_id: str = ""
    priority: int = 0
    timestamp: float = 0.0
    replied: bool = False
    reply_payload: Optional[Dict[str, Any]] = None

    def __post_init__(self):
        if not self.id:
            self.id = f"msg_{uuid4().hex[:12]}"
        if not self.timestamp:
            self.timestamp = time.time()


class AgentMessageBus:
    """In-memory message bus for inter-agent communication."""

    def __init__(self):
        self._queues: Dict[str, List[AgentMessage]] = defaultdict(list)
        self._messages: Dict[str, AgentMessage] = {}
        self._history: List[AgentMessage] = []

    async def send(self, message: AgentMessage) -> str:
        self._queues[message.recipient.lower()].append(message)
        self._messages[message.id] = message
        self._history.append(message)
        if getattr(settings, "use_message_bus_persistence", False):
            asyncio.create_task(self._persist_message(message))
        logger.debug(
            "MSG %s -> %s [%s] corr=%s",
            message.sender, message.recipient, message.message_type, message.correlation_id,
        )
        return message.id

    async def _persist_message(self, message: AgentMessage) -> None:
        """Persist message to DB for audit by correlation_id."""
        try:
            from src.core.database import get_async_session
            from src.models.agent_message_log import AgentMessageLog
            payload_summary = json.dumps(message.payload)[:2000] if message.payload else None
            async for session in get_async_session():
                row = AgentMessageLog(
                    message_id=message.id,
                    correlation_id=message.correlation_id or "",
                    sender=message.sender,
                    recipient=message.recipient,
                    message_type=message.message_type,
                    payload_summary=payload_summary,
                    replied=message.replied,
                )
                session.add(row)
                await session.commit()
                break
        except Exception as e:
            logger.debug("MessageBus persist skipped: %s", e)

    async def receive(self, agent_name: str) -> Optional[AgentMessage]:
        queue = self._queues.get(agent_name.lower(), [])
        if queue:
            return queue.pop(0)
        return None

    async def request_response(
        self,
        message: AgentMessage,
        timeout: float = 30.0,
    ) -> Dict[str, Any]:
        """Send a message and wait for the recipient to reply."""
        msg_id = await self.send(message)
        deadline = time.time() + timeout
        while time.time() < deadline:
            stored = self._messages.get(msg_id)
            if stored and stored.replied:
                return stored.reply_payload or {}
            await asyncio.sleep(0.1)
        return {"error": "timeout", "message_id": msg_id}

    async def reply(self, message_id: str, payload: Dict[str, Any]) -> bool:
        msg = self._messages.get(message_id)
        if msg:
            msg.replied = True
            msg.reply_payload = payload
            return True
        return False

    def get_history(
        self,
        correlation_id: Optional[str] = None,
        limit: int = 100,
    ) -> List[Dict[str, Any]]:
        msgs = self._history
        if correlation_id:
            msgs = [m for m in msgs if m.correlation_id == correlation_id]
        return [
            {
                "id": m.id,
                "sender": m.sender,
                "recipient": m.recipient,
                "type": m.message_type,
                "correlation_id": m.correlation_id,
                "timestamp": m.timestamp,
                "replied": m.replied,
            }
            for m in msgs[-limit:]
        ]

    def clear(self) -> None:
        self._queues.clear()
        self._messages.clear()
        self._history.clear()


# Singleton
message_bus = AgentMessageBus()
