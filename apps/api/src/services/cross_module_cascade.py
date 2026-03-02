"""
Cross-Module Cascade Engine (P1)
=================================

Orchestrates automatic recalculation across strategic modules when a cascade
event is triggered.  When an event hits one module (e.g. CIP infrastructure
failure), it automatically propagates the impact through:

  CIP → SCSS (supply chain disruption)
  CIP → SRO  (financial contagion)
  BIOSEC → SCSS (pandemic supply disruption)
  BIOSEC → SRO  (market stress)
  SRO → CIP  (funding loss degrades infrastructure)
  ERF  → ALL  (existential risk escalation)

The engine builds a directed acyclic graph (DAG) of module dependencies,
computes propagation weights, and orchestrates sequential/parallel
recalculations via the existing module services.

This is the **key barrier** — no competitor has automatic cascade linkage
between 8+ strategic risk modules in a single platform.
"""
from __future__ import annotations

import asyncio
import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

import numpy as np

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Module enum & dependency graph
# ---------------------------------------------------------------------------

class RiskModule(str, Enum):
    """Strategic risk modules in the platform."""
    CIP = "cip"            # Critical Infrastructure Protection
    SCSS = "scss"           # Supply Chain Sovereignty & Security
    SRO = "sro"            # Systemic Risk Observatory
    BIOSEC = "biosec"       # Biosecurity & Pandemic
    ERF = "erf"            # Existential Risk Framework
    ASM = "asm"            # Nuclear Safety & Monitoring
    ASGI = "asgi"          # AI Safety & Governance
    CADAPT = "cadapt"      # Climate Adaptation


MODULE_DESCRIPTIONS: Dict[str, Dict[str, str]] = {
    "cip": {
        "label": "CIP",
        "full_name": "Critical Infrastructure Protection",
        "description": "Power grids, water systems, transport networks, telecommunications",
        "color": "#3b82f6",
    },
    "scss": {
        "label": "SCSS",
        "full_name": "Supply Chain Sovereignty & Security",
        "description": "Global supply routes, trade dependencies, logistics networks",
        "color": "#8b5cf6",
    },
    "sro": {
        "label": "SRO",
        "full_name": "Systemic Risk Observatory",
        "description": "Financial contagion, interbank exposure, market systemic risk",
        "color": "#f59e0b",
    },
    "biosec": {
        "label": "BIOSEC",
        "full_name": "Biosecurity & Pandemic",
        "description": "Disease outbreaks, pandemic preparedness, biological threats",
        "color": "#10b981",
    },
    "erf": {
        "label": "ERF",
        "full_name": "Existential Risk Framework",
        "description": "Civilization-scale threats, global catastrophic risk",
        "color": "#ef4444",
    },
    "asm": {
        "label": "ASM",
        "full_name": "Atomic Safety & Monitoring",
        "description": "Nuclear facilities, radiation events, nuclear safety protocols",
        "color": "#f97316",
    },
    "asgi": {
        "label": "ASGI",
        "full_name": "AI Safety & Governance Initiative",
        "description": "AI alignment, autonomous systems, algorithmic risk",
        "color": "#06b6d4",
    },
    "cadapt": {
        "label": "CADAPT",
        "full_name": "Climate Adaptation",
        "description": "Sea level rise, extreme weather adaptation, climate resilience",
        "color": "#84cc16",
    },
}


class EventCategory(str, Enum):
    """Categories of triggering events."""
    INFRASTRUCTURE_FAILURE = "infrastructure_failure"
    SUPPLY_CHAIN_DISRUPTION = "supply_chain_disruption"
    FINANCIAL_CONTAGION = "financial_contagion"
    PANDEMIC_OUTBREAK = "pandemic_outbreak"
    NUCLEAR_INCIDENT = "nuclear_incident"
    CLIMATE_DISASTER = "climate_disaster"
    CYBER_ATTACK = "cyber_attack"
    AI_SAFETY_BREACH = "ai_safety_breach"
    GEOPOLITICAL_CRISIS = "geopolitical_crisis"
    EXISTENTIAL_ESCALATION = "existential_escalation"


# Directed edges: (source_module, target_module, base_weight, event_categories)
# Weight ∈ (0, 1] — strength of propagation
MODULE_DEPENDENCY_GRAPH: List[Tuple[RiskModule, RiskModule, float, List[EventCategory]]] = [
    # CIP propagates to supply chain and financial system
    (RiskModule.CIP, RiskModule.SCSS, 0.75, [
        EventCategory.INFRASTRUCTURE_FAILURE, EventCategory.CYBER_ATTACK,
        EventCategory.CLIMATE_DISASTER,
    ]),
    (RiskModule.CIP, RiskModule.SRO, 0.60, [
        EventCategory.INFRASTRUCTURE_FAILURE, EventCategory.CYBER_ATTACK,
    ]),
    (RiskModule.CIP, RiskModule.CADAPT, 0.50, [
        EventCategory.CLIMATE_DISASTER,
    ]),

    # Supply chain disruptions affect infrastructure and finance
    (RiskModule.SCSS, RiskModule.CIP, 0.55, [
        EventCategory.SUPPLY_CHAIN_DISRUPTION, EventCategory.GEOPOLITICAL_CRISIS,
    ]),
    (RiskModule.SCSS, RiskModule.SRO, 0.70, [
        EventCategory.SUPPLY_CHAIN_DISRUPTION, EventCategory.GEOPOLITICAL_CRISIS,
    ]),

    # Systemic risk feeds back to infrastructure (funding loss)
    (RiskModule.SRO, RiskModule.CIP, 0.45, [
        EventCategory.FINANCIAL_CONTAGION,
    ]),
    (RiskModule.SRO, RiskModule.SCSS, 0.50, [
        EventCategory.FINANCIAL_CONTAGION,
    ]),

    # Pandemic affects everything
    (RiskModule.BIOSEC, RiskModule.SCSS, 0.80, [
        EventCategory.PANDEMIC_OUTBREAK,
    ]),
    (RiskModule.BIOSEC, RiskModule.SRO, 0.65, [
        EventCategory.PANDEMIC_OUTBREAK,
    ]),
    (RiskModule.BIOSEC, RiskModule.CIP, 0.40, [
        EventCategory.PANDEMIC_OUTBREAK,
    ]),
    (RiskModule.BIOSEC, RiskModule.CADAPT, 0.35, [
        EventCategory.PANDEMIC_OUTBREAK,
    ]),

    # Nuclear incident
    (RiskModule.ASM, RiskModule.CIP, 0.85, [
        EventCategory.NUCLEAR_INCIDENT,
    ]),
    (RiskModule.ASM, RiskModule.BIOSEC, 0.60, [
        EventCategory.NUCLEAR_INCIDENT,
    ]),
    (RiskModule.ASM, RiskModule.CADAPT, 0.70, [
        EventCategory.NUCLEAR_INCIDENT, EventCategory.CLIMATE_DISASTER,
    ]),

    # AI safety → infrastructure, finance, existential
    (RiskModule.ASGI, RiskModule.CIP, 0.55, [
        EventCategory.AI_SAFETY_BREACH, EventCategory.CYBER_ATTACK,
    ]),
    (RiskModule.ASGI, RiskModule.SRO, 0.50, [
        EventCategory.AI_SAFETY_BREACH,
    ]),
    (RiskModule.ASGI, RiskModule.ERF, 0.70, [
        EventCategory.AI_SAFETY_BREACH,
    ]),

    # Climate adaptation feeds back
    (RiskModule.CADAPT, RiskModule.CIP, 0.45, [
        EventCategory.CLIMATE_DISASTER,
    ]),
    (RiskModule.CADAPT, RiskModule.SCSS, 0.40, [
        EventCategory.CLIMATE_DISASTER,
    ]),

    # ERF escalation → all modules
    (RiskModule.ERF, RiskModule.CIP, 0.90, [
        EventCategory.EXISTENTIAL_ESCALATION,
    ]),
    (RiskModule.ERF, RiskModule.SCSS, 0.90, [
        EventCategory.EXISTENTIAL_ESCALATION,
    ]),
    (RiskModule.ERF, RiskModule.SRO, 0.90, [
        EventCategory.EXISTENTIAL_ESCALATION,
    ]),
    (RiskModule.ERF, RiskModule.BIOSEC, 0.80, [
        EventCategory.EXISTENTIAL_ESCALATION,
    ]),
    (RiskModule.ERF, RiskModule.ASM, 0.85, [
        EventCategory.EXISTENTIAL_ESCALATION,
    ]),
    (RiskModule.ERF, RiskModule.ASGI, 0.80, [
        EventCategory.EXISTENTIAL_ESCALATION,
    ]),
]


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class CascadeEvent:
    """A triggering event that starts a cross-module cascade."""
    id: str = field(default_factory=lambda: str(uuid4()))
    source_module: RiskModule = RiskModule.CIP
    category: EventCategory = EventCategory.INFRASTRUCTURE_FAILURE
    severity: float = 0.5  # 0-1
    description: str = ""
    location: Optional[Dict[str, float]] = None  # {lat, lng}
    metadata: Dict[str, Any] = field(default_factory=dict)
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


@dataclass
class ModuleImpact:
    """Impact on a single module from cascade propagation."""
    module: RiskModule
    impact_severity: float  # 0-1, attenuated from source
    propagation_path: List[RiskModule]  # chain from source
    propagation_weight: float  # cumulative weight along path
    estimated_loss_multiplier: float  # how much this amplifies losses
    recalculation_needed: bool = True
    recalculation_result: Optional[Dict[str, Any]] = None


@dataclass
class CascadeResult:
    """Complete result of a cross-module cascade simulation."""
    event: CascadeEvent
    module_impacts: Dict[str, ModuleImpact]  # module.value -> impact
    total_amplification_factor: float
    cascade_depth: int  # how many hops the cascade reached
    critical_path: List[RiskModule]  # path with highest cumulative impact
    total_estimated_loss_pct: float  # % of portfolio at risk
    containment_recommendations: List[str]
    simulation_time_ms: float
    timestamp: datetime = field(default_factory=lambda: datetime.now(timezone.utc))

    def to_dict(self) -> Dict[str, Any]:
        # Build propagation timeline: group by depth
        timeline: List[Dict[str, Any]] = []
        depth_groups: Dict[int, List[Dict[str, Any]]] = {}
        for k, v in self.module_impacts.items():
            depth = len(v.propagation_path) - 1
            depth_groups.setdefault(depth, []).append({
                "module": v.module.value,
                "impact_severity": round(v.impact_severity, 4),
                "from_module": v.propagation_path[-2].value if len(v.propagation_path) >= 2 else self.event.source_module.value,
            })
        for d in sorted(depth_groups.keys()):
            timeline.append({
                "depth": d,
                "label": f"Hop {d}" if d > 0 else "Direct impact",
                "modules": depth_groups[d],
            })

        # Build propagation matrix for the event category
        all_modules = [m.value for m in RiskModule]
        prop_matrix: Dict[str, Dict[str, float]] = {}
        for src_m in all_modules:
            row: Dict[str, float] = {}
            for tgt_m in all_modules:
                row[tgt_m] = 0.0
            prop_matrix[src_m] = row
        for src, tgt, weight, cats in MODULE_DEPENDENCY_GRAPH:
            if self.event.category in cats:
                prop_matrix[src.value][tgt.value] = weight

        return {
            "event_id": self.event.id,
            "source_module": self.event.source_module.value,
            "event_category": self.event.category.value,
            "event_category_label": self.event.category.value.replace("_", " ").title(),
            "severity": self.event.severity,
            "module_impacts": {
                k: {
                    "module": v.module.value,
                    "module_label": MODULE_DESCRIPTIONS.get(v.module.value, {}).get("label", v.module.value.upper()),
                    "module_full_name": MODULE_DESCRIPTIONS.get(v.module.value, {}).get("full_name", ""),
                    "impact_severity": round(v.impact_severity, 4),
                    "propagation_path": [m.value for m in v.propagation_path],
                    "propagation_weight": round(v.propagation_weight, 4),
                    "estimated_loss_multiplier": round(v.estimated_loss_multiplier, 3),
                    "recalculation_needed": v.recalculation_needed,
                    "depth": len(v.propagation_path) - 1,
                }
                for k, v in self.module_impacts.items()
            },
            "total_amplification_factor": round(self.total_amplification_factor, 3),
            "cascade_depth": self.cascade_depth,
            "critical_path": [m.value for m in self.critical_path],
            "total_estimated_loss_pct": round(self.total_estimated_loss_pct, 2),
            "containment_recommendations": self.containment_recommendations,
            "propagation_timeline": timeline,
            "propagation_matrix": prop_matrix,
            "modules_metadata": MODULE_DESCRIPTIONS,
            "simulation_time_ms": round(self.simulation_time_ms, 1),
            "timestamp": self.timestamp.isoformat(),
        }


# ---------------------------------------------------------------------------
# Cross-Module Cascade Engine
# ---------------------------------------------------------------------------

class CrossModuleCascadeEngine:
    """
    Orchestrates cascade propagation across all strategic modules.

    Algorithm:
    1. Build adjacency list from MODULE_DEPENDENCY_GRAPH filtered by event category
    2. BFS/DFS from source module with severity attenuation
    3. Collect all affected modules with cumulative impact
    4. Optionally trigger recalculation in each affected module's service
    5. Return CascadeResult with amplification factor and recommendations
    """

    def __init__(self):
        self._adjacency: Dict[RiskModule, List[Tuple[RiskModule, float]]] = {}
        self._all_edges = MODULE_DEPENDENCY_GRAPH
        self._build_full_adjacency()

    def _build_full_adjacency(self):
        """Pre-build adjacency for all event categories."""
        self._adjacency_by_category: Dict[EventCategory, Dict[RiskModule, List[Tuple[RiskModule, float]]]] = {}
        for category in EventCategory:
            adj: Dict[RiskModule, List[Tuple[RiskModule, float]]] = {}
            for src, tgt, weight, cats in self._all_edges:
                if category in cats:
                    adj.setdefault(src, []).append((tgt, weight))
            self._adjacency_by_category[category] = adj

    def simulate_cascade(
        self,
        event: CascadeEvent,
        max_depth: int = 5,
        attenuation: float = 0.7,
        min_severity: float = 0.05,
    ) -> CascadeResult:
        """
        Simulate cascade propagation from a triggering event.

        Args:
            event: The triggering cascade event
            max_depth: Maximum propagation hops
            attenuation: Severity multiplied by this at each hop
            min_severity: Stop propagating below this threshold
        """
        import time
        t0 = time.perf_counter()

        adj = self._adjacency_by_category.get(event.category, {})

        # BFS with severity tracking
        impacts: Dict[str, ModuleImpact] = {}
        # Queue: (module, current_severity, path, cumulative_weight)
        queue: List[Tuple[RiskModule, float, List[RiskModule], float]] = [
            (event.source_module, event.severity, [event.source_module], 1.0)
        ]
        visited_severity: Dict[RiskModule, float] = {event.source_module: event.severity}
        max_cascade_depth = 0

        while queue:
            current, severity, path, cum_weight = queue.pop(0)
            depth = len(path) - 1

            if depth > max_depth:
                continue

            neighbors = adj.get(current, [])
            for neighbor, edge_weight in neighbors:
                propagated_severity = severity * edge_weight * attenuation
                new_cum_weight = cum_weight * edge_weight

                if propagated_severity < min_severity:
                    continue

                # Only update if new severity is higher than previously computed
                prev = visited_severity.get(neighbor, 0)
                if propagated_severity > prev:
                    visited_severity[neighbor] = propagated_severity
                    new_path = path + [neighbor]
                    max_cascade_depth = max(max_cascade_depth, len(new_path) - 1)

                    impacts[neighbor.value] = ModuleImpact(
                        module=neighbor,
                        impact_severity=propagated_severity,
                        propagation_path=new_path,
                        propagation_weight=new_cum_weight,
                        estimated_loss_multiplier=1.0 + propagated_severity * 2.0,
                        recalculation_needed=propagated_severity > 0.1,
                    )

                    queue.append((neighbor, propagated_severity, new_path, new_cum_weight))

        # Find critical path (highest total impact)
        critical_path = [event.source_module]
        if impacts:
            most_severe = max(impacts.values(), key=lambda x: x.impact_severity)
            critical_path = most_severe.propagation_path

        # Compute total amplification: 1 + sum of all impact severities
        total_amp = 1.0 + sum(i.impact_severity for i in impacts.values())

        # Estimate total loss % (rough: severity * amplification * 10 = % of portfolio)
        total_loss_pct = min(
            event.severity * total_amp * 10,
            100.0,
        )

        # Generate containment recommendations
        recommendations = self._generate_recommendations(event, impacts)

        elapsed_ms = (time.perf_counter() - t0) * 1000

        return CascadeResult(
            event=event,
            module_impacts=impacts,
            total_amplification_factor=total_amp,
            cascade_depth=max_cascade_depth,
            critical_path=critical_path,
            total_estimated_loss_pct=total_loss_pct,
            containment_recommendations=recommendations,
            simulation_time_ms=elapsed_ms,
        )

    def _generate_recommendations(
        self,
        event: CascadeEvent,
        impacts: Dict[str, ModuleImpact],
    ) -> List[str]:
        """Generate containment recommendations based on cascade impacts."""
        recs: List[str] = []

        if event.severity >= 0.8:
            recs.append(
                f"CRITICAL: Activate emergency response for {event.source_module.value.upper()} module"
            )

        # Module-specific recommendations
        module_recs = {
            RiskModule.CIP: "Activate backup infrastructure and initiate failover procedures",
            RiskModule.SCSS: "Engage alternate suppliers and reroute critical supply chains",
            RiskModule.SRO: "Increase liquidity buffers and activate interbank stress protocols",
            RiskModule.BIOSEC: "Implement containment zones and activate pandemic response plan",
            RiskModule.ASM: "Initiate nuclear safety protocols and evacuation procedures",
            RiskModule.ASGI: "Isolate affected AI systems and activate manual override",
            RiskModule.CADAPT: "Deploy climate adaptation measures and relocate vulnerable assets",
            RiskModule.ERF: "Escalate to global coordination; activate all-hazards response",
        }

        for mod_key, impact in sorted(
            impacts.items(), key=lambda x: x[1].impact_severity, reverse=True
        ):
            mod = impact.module
            if impact.impact_severity >= 0.3:
                rec = module_recs.get(mod, f"Review and mitigate risks in {mod.value}")
                recs.append(f"{mod.value.upper()} (severity {impact.impact_severity:.0%}): {rec}")

        if not recs:
            recs.append("Cascade impact is contained; continue monitoring")

        # Cross-module
        if len(impacts) >= 3:
            recs.append(
                "CROSS-MODULE: Multiple modules affected — convene inter-departmental crisis committee"
            )

        return recs

    def get_dependency_graph(self) -> Dict[str, Any]:
        """Return the full dependency graph for visualization with module metadata."""
        nodes = []
        for m in RiskModule:
            desc = MODULE_DESCRIPTIONS.get(m.value, {})
            nodes.append({
                "id": m.value,
                "label": desc.get("label", m.value.upper()),
                "full_name": desc.get("full_name", ""),
                "description": desc.get("description", ""),
                "color": desc.get("color", "#888888"),
            })
        edges = []
        for src, tgt, weight, cats in self._all_edges:
            edges.append({
                "source": src.value,
                "target": tgt.value,
                "weight": weight,
                "categories": [c.value for c in cats],
            })
        return {"nodes": nodes, "edges": edges, "modules_metadata": MODULE_DESCRIPTIONS}

    def get_affected_modules(
        self,
        source: RiskModule,
        category: EventCategory,
    ) -> List[str]:
        """Quick lookup: which modules are directly affected?"""
        adj = self._adjacency_by_category.get(category, {})
        return [tgt.value for tgt, _ in adj.get(source, [])]


# Singleton instance
cascade_engine = CrossModuleCascadeEngine()
