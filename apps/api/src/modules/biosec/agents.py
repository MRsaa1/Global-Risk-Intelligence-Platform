"""BIOSEC Agents - BIOSEC_SENTINEL for pathogen/outbreak monitoring."""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List

logger = logging.getLogger(__name__)


class BIOSECSentinelAgent:
    """
    BIOSEC_SENTINEL - Biosecurity monitoring agent.

    Responsibilities:
    - Monitor WHO/CDC outbreak feeds
    - Track BSL-4 lab incident reports
    - Detect unusual pathogen activity patterns
    - Model pandemic spread scenarios
    """

    AGENT_ID = "biosec_sentinel"
    AGENT_TYPE = "BIOSEC_SENTINEL"

    async def assess(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """ARIN-compatible assessment."""
        severity = input_data.get("severity", 0.3)
        pathogen_type = input_data.get("pathogen_type", "unknown")
        r0 = input_data.get("r0", 2.0)

        # Adjust severity based on R0
        if r0 > 5:
            severity = min(1.0, severity * 1.5)
        elif r0 > 3:
            severity = min(1.0, severity * 1.2)

        return {
            "agent_id": self.AGENT_ID,
            "agent_type": self.AGENT_TYPE,
            "risk_score": round(severity, 4),
            "confidence": 0.5,
            "reasoning": (
                f"Pathogen assessment ({pathogen_type}): R0={r0}, "
                f"adjusted severity={severity:.2%}. "
                f"{'HIGH ALERT: Rapid transmission potential.' if r0 > 5 else 'Standard monitoring.'}"
            ),
            "recommendations": self._recommendations(severity, r0),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

    def _recommendations(self, severity: float, r0: float) -> List[str]:
        recs = []
        if severity > 0.7:
            recs.extend([
                "IMMEDIATE: Activate pandemic response protocols",
                "Notify WHO and national health authorities",
                "Model airport-based transmission pathways",
            ])
        if r0 > 3:
            recs.append("Containment measures critical: R0 exceeds manageable threshold")
        recs.append("Update ERF biosecurity risk contribution with latest data")
        return recs


biosec_sentinel = BIOSECSentinelAgent()
