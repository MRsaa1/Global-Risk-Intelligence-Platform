"""
EntanglementMap — cross-domain risk correlation propagation.

When any agent detects a change in one risk domain, the entanglement map
automatically triggers reassessment in correlated domains. Correlations
are stored as ENTANGLED_WITH edges in the knowledge graph.

Example: economic crisis (domain A) correlates with accelerated
infrastructure corrosion (domain B) through budget cuts.
"""
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional

import numpy as np

logger = logging.getLogger(__name__)

RISK_DOMAINS = [
    "climate",
    "financial",
    "operational",
    "infrastructure",
    "geopolitical",
    "social",
    "cyber",
]

# Initial 7x7 correlation matrix (empirical estimates)
_INITIAL_CORRELATIONS = np.array([
    # clim  fin   oper  infra geop  soc   cyber
    [1.00, 0.25, 0.35, 0.60, 0.15, 0.30, 0.10],  # climate
    [0.25, 1.00, 0.45, 0.30, 0.50, 0.35, 0.20],  # financial
    [0.35, 0.45, 1.00, 0.55, 0.20, 0.25, 0.30],  # operational
    [0.60, 0.30, 0.55, 1.00, 0.20, 0.40, 0.35],  # infrastructure
    [0.15, 0.50, 0.20, 0.20, 1.00, 0.45, 0.25],  # geopolitical
    [0.30, 0.35, 0.25, 0.40, 0.45, 1.00, 0.15],  # social
    [0.10, 0.20, 0.30, 0.35, 0.25, 0.15, 1.00],  # cyber
])


@dataclass
class EntanglementCoefficient:
    domain_a: str
    domain_b: str
    coefficient: float
    transmission_mechanism: str = ""
    lag_days: int = 0
    confidence: float = 0.5
    historical_evidence: List[str] = field(default_factory=list)


@dataclass
class CorrelationUpdate:
    source_domain: str
    source_change: float
    target_domain: str
    propagated_change: float
    transmission_mechanism: str = ""
    timestamp: float = 0.0


class EntanglementMap:
    """Cross-domain risk correlation storage and reactive propagation."""

    def __init__(self, knowledge_graph=None, contagion_matrix=None, message_bus=None):
        self._kg = knowledge_graph
        self._contagion = contagion_matrix
        self._bus = message_bus
        self._matrix = _INITIAL_CORRELATIONS.copy()
        self._domain_index = {d: i for i, d in enumerate(RISK_DOMAINS)}
        self._custom_correlations: List[EntanglementCoefficient] = []

    async def register_correlation(
        self,
        domain_a: str,
        domain_b: str,
        coefficient: float,
        mechanism: str = "",
        lag_days: int = 0,
    ) -> EntanglementCoefficient:
        ec = EntanglementCoefficient(
            domain_a=domain_a,
            domain_b=domain_b,
            coefficient=max(-1.0, min(1.0, coefficient)),
            transmission_mechanism=mechanism,
            lag_days=lag_days,
            confidence=0.7,
        )
        self._custom_correlations.append(ec)

        ia = self._domain_index.get(domain_a)
        ib = self._domain_index.get(domain_b)
        if ia is not None and ib is not None:
            self._matrix[ia, ib] = coefficient
            self._matrix[ib, ia] = coefficient

        # Store in KG if available
        try:
            if self._kg:
                from src.services.knowledge_graph_extensions import get_graph_rag_service
                grag = get_graph_rag_service()
                await grag.store_entanglement_edge(domain_a, domain_b, coefficient, mechanism)
        except Exception:
            pass

        logger.info("Entanglement registered: %s <-> %s (%.3f) via %s", domain_a, domain_b, coefficient, mechanism)
        return ec

    async def propagate_change(
        self,
        changed_domain: str,
        delta: float,
        asset_scope: Optional[List[str]] = None,
    ) -> List[CorrelationUpdate]:
        """Propagate risk change across entangled domains."""
        idx = self._domain_index.get(changed_domain)
        if idx is None:
            return []

        updates = []
        row = self._matrix[idx]
        for j, coeff in enumerate(row):
            target = RISK_DOMAINS[j]
            if target == changed_domain or abs(coeff) < 0.1:
                continue

            propagated = delta * coeff
            updates.append(CorrelationUpdate(
                source_domain=changed_domain,
                source_change=delta,
                target_domain=target,
                propagated_change=round(propagated, 4),
                timestamp=time.time(),
            ))

        # Push via message bus if available
        if self._bus and updates:
            try:
                from src.services.agent_message_bus import AgentMessage
                for u in updates:
                    msg = AgentMessage(
                        sender="entanglement_map",
                        recipient="analyst",
                        message_type="correlation_update",
                        payload={
                            "source_domain": u.source_domain,
                            "target_domain": u.target_domain,
                            "propagated_change": u.propagated_change,
                        },
                    )
                    await self._bus.send(msg)
            except Exception as exc:
                logger.debug("Message bus propagation failed: %s", exc)

        return updates

    async def discover_correlations(
        self,
        historical_incidents: List[dict],
        min_correlation: float = 0.3,
    ) -> List[EntanglementCoefficient]:
        """LLM-assisted correlation discovery from historical incidents."""
        discovered = []
        if not historical_incidents:
            return discovered

        try:
            from src.services.nvidia_llm import llm_service
            incidents_text = "\n".join(
                f"- {inc.get('title', 'Unknown')}: {inc.get('domain', 'unknown')} "
                f"(severity {inc.get('severity', 'unknown')})"
                for inc in historical_incidents[:20]
            )
            resp = await llm_service.generate(
                prompt=f"Analyze these incidents for hidden cross-domain correlations:\n{incidents_text}\n\n"
                       f"List pairs of domains that show hidden correlation. Format: domain_a|domain_b|coefficient|mechanism",
                max_tokens=512,
                temperature=0.5,
            )
            for line in resp.content.strip().split("\n"):
                parts = line.strip().split("|")
                if len(parts) >= 3:
                    try:
                        coeff = float(parts[2])
                        if abs(coeff) >= min_correlation:
                            ec = await self.register_correlation(
                                parts[0].strip(), parts[1].strip(), coeff,
                                mechanism=parts[3].strip() if len(parts) > 3 else "",
                            )
                            discovered.append(ec)
                    except (ValueError, IndexError):
                        pass
        except Exception as exc:
            logger.debug("LLM correlation discovery failed: %s", exc)

        return discovered

    async def get_entanglement_matrix(
        self,
        domains: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        """Return current NxN correlation matrix."""
        if domains:
            indices = [self._domain_index[d] for d in domains if d in self._domain_index]
            sub_matrix = self._matrix[np.ix_(indices, indices)]
            return {
                "domains": [d for d in domains if d in self._domain_index],
                "matrix": sub_matrix.tolist(),
            }
        return {
            "domains": RISK_DOMAINS,
            "matrix": self._matrix.tolist(),
        }


# Singleton
entanglement_map = EntanglementMap()
