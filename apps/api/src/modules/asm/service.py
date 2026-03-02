"""
ASM Service - Nuclear Safety & Monitoring engine.

Implements:
- Nuclear reactor registry (IAEA PRIS public data)
- Nuclear winter climate cascade modeling
- Geopolitical escalation ladder
- Nuclear arsenal database
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

logger = logging.getLogger(__name__)


@dataclass
class NuclearReactor:
    """Nuclear power reactor entry."""
    id: str
    name: str
    country: str
    lat: float
    lng: float
    type: str              # PWR, BWR, PHWR, RBMK, etc.
    capacity_mw: int
    status: str = "operational"  # operational, under_construction, shutdown, decommissioned
    operator: str = ""
    commission_year: int = 0
    risk_factors: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "country": self.country,
            "lat": self.lat,
            "lng": self.lng,
            "type": self.type,
            "capacity_mw": self.capacity_mw,
            "status": self.status,
            "operator": self.operator,
            "commission_year": self.commission_year,
            "risk_factors": self.risk_factors,
        }


# Representative global reactor database (subset of IAEA PRIS, public data)
REACTOR_REGISTRY: List[NuclearReactor] = [
    NuclearReactor("nr_001", "Zaporizhzhia NPP", "Ukraine", 47.51, 34.58, "VVER-1000", 5700,
                   operator="Energoatom", commission_year=1984, risk_factors=["conflict_zone", "aging"]),
    NuclearReactor("nr_002", "Bruce Power", "Canada", 44.33, -81.60, "CANDU", 6384,
                   operator="Bruce Power", commission_year=1977, risk_factors=["aging", "lake_proximity"]),
    NuclearReactor("nr_003", "Kashiwazaki-Kariwa", "Japan", 37.43, 138.60, "BWR/ABWR", 7965,
                   operator="TEPCO", commission_year=1985, risk_factors=["seismic_zone", "aging"]),
    NuclearReactor("nr_004", "Gravelines", "France", 51.01, 2.10, "PWR", 5460,
                   operator="EDF", commission_year=1980, risk_factors=["coastal_flooding"]),
    NuclearReactor("nr_005", "Palo Verde", "USA", 33.39, -112.86, "PWR", 3937,
                   operator="APS", commission_year=1986, risk_factors=["water_scarcity"]),
    NuclearReactor("nr_006", "Kori/Shin-Kori", "South Korea", 35.32, 129.28, "PWR/APR-1400", 5600,
                   operator="KHNP", commission_year=1978, risk_factors=["coastal", "seismic_zone"]),
    NuclearReactor("nr_007", "Taishan", "China", 21.92, 112.98, "EPR", 3320,
                   operator="CGN", commission_year=2018, risk_factors=["typhoon_zone"]),
    NuclearReactor("nr_008", "Kudankulam", "India", 8.17, 77.71, "VVER-1000", 2000,
                   operator="NPCIL", commission_year=2013, risk_factors=["coastal_tsunami"]),
    NuclearReactor("nr_009", "Barakah", "UAE", 23.97, 52.26, "APR-1400", 5600,
                   operator="ENEC", commission_year=2020, risk_factors=["geopolitical"]),
    NuclearReactor("nr_010", "Hinkley Point C", "UK", 51.21, -3.13, "EPR", 3260,
                   status="under_construction", operator="EDF", risk_factors=["coastal_flooding"]),
    NuclearReactor("nr_011", "Flamanville", "France", 49.54, -1.88, "EPR", 1630,
                   operator="EDF", commission_year=2024, risk_factors=["coastal"]),
    NuclearReactor("nr_012", "Darlington", "Canada", 43.87, -78.77, "CANDU", 3512,
                   operator="OPG", commission_year=1990, risk_factors=["lake_proximity"]),
]


@dataclass
class NuclearState:
    """Nuclear-armed state data."""
    country: str
    estimated_warheads: int
    deployed: int
    icbm_capable: bool
    slbm_capable: bool
    second_strike: bool
    npt_signatory: bool

    def to_dict(self) -> Dict[str, Any]:
        return {
            "country": self.country,
            "estimated_warheads": self.estimated_warheads,
            "deployed": self.deployed,
            "icbm_capable": self.icbm_capable,
            "slbm_capable": self.slbm_capable,
            "second_strike": self.second_strike,
            "npt_signatory": self.npt_signatory,
        }


NUCLEAR_STATES = [
    NuclearState("United States", 5550, 1744, True, True, True, True),
    NuclearState("Russia", 6257, 1588, True, True, True, True),
    NuclearState("China", 350, 0, True, True, True, True),
    NuclearState("France", 290, 280, False, True, True, True),
    NuclearState("United Kingdom", 225, 120, False, True, True, True),
    NuclearState("Pakistan", 165, 0, False, False, False, False),
    NuclearState("India", 160, 0, True, True, False, False),
    NuclearState("Israel", 90, 0, False, True, False, False),
    NuclearState("North Korea", 45, 0, True, True, False, False),
]


# Escalation ladder levels
ESCALATION_LADDER = [
    {"level": 1, "name": "Diplomatic Tensions", "description": "Verbal threats, ambassador recalls", "p_next": 0.30},
    {"level": 2, "name": "Economic Sanctions", "description": "Trade restrictions, asset freezes", "p_next": 0.20},
    {"level": 3, "name": "Military Mobilization", "description": "Troop deployments, exercises near borders", "p_next": 0.15},
    {"level": 4, "name": "Conventional Conflict", "description": "Armed conflict, no nuclear use", "p_next": 0.08},
    {"level": 5, "name": "Tactical Nuclear Threat", "description": "Nuclear rhetoric, weapon repositioning", "p_next": 0.05},
    {"level": 6, "name": "Tactical Nuclear Use", "description": "Limited nuclear strike (battlefield)", "p_next": 0.03},
    {"level": 7, "name": "Strategic Exchange", "description": "Full strategic nuclear exchange", "p_next": 0.0},
]


class ASMService:
    """Nuclear Safety & Monitoring service."""

    def __init__(self):
        self._reactors = {r.id: r for r in REACTOR_REGISTRY}
        self._states = NUCLEAR_STATES

    def get_reactors(
        self,
        country: Optional[str] = None,
        status: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Get nuclear reactor registry."""
        reactors = list(self._reactors.values())
        if country:
            reactors = [r for r in reactors if r.country.lower() == country.lower()]
        if status:
            reactors = [r for r in reactors if r.status == status]
        return [r.to_dict() for r in reactors]

    def get_nuclear_states(self) -> List[Dict[str, Any]]:
        """Get nuclear-armed states data."""
        return [s.to_dict() for s in self._states]

    def get_escalation_ladder(self) -> List[Dict[str, Any]]:
        """Get geopolitical escalation ladder."""
        return ESCALATION_LADDER

    def simulate_nuclear_winter(
        self,
        warheads_used: int = 100,
        yield_kt_avg: float = 100,
        target_type: str = "mixed",
    ) -> Dict[str, Any]:
        """
        Simulate nuclear winter effects.

        Models:
        - Soot injection into stratosphere
        - Temperature drop timeline
        - Agricultural impact
        - Population effects
        """
        # Total megatonnage
        total_mt = warheads_used * yield_kt_avg / 1000

        # Soot model (Robock et al. approximation)
        soot_tg = min(150, total_mt * 0.8)  # Teragram soot injection

        # Temperature drop (global average)
        if soot_tg > 100:
            temp_drop_peak = -10.0  # Full nuclear winter
        elif soot_tg > 50:
            temp_drop_peak = -6.0
        elif soot_tg > 10:
            temp_drop_peak = -3.0
        else:
            temp_drop_peak = -1.0

        # Recovery timeline
        years_to_half_recovery = 3 if soot_tg > 50 else 2
        years_to_full_recovery = 10 if soot_tg > 50 else 5

        # Agricultural collapse
        crop_loss_pct = min(90, soot_tg * 0.6)

        # Famine estimate
        famine_deaths_billions = min(7.0, crop_loss_pct / 100 * 5.0)

        # Timeline
        timeline = []
        for year in range(11):
            if year == 0:
                temp = temp_drop_peak
            else:
                recovery = 1.0 - math.exp(-year / years_to_half_recovery)
                temp = temp_drop_peak * (1 - recovery)
            timeline.append({
                "year": year,
                "temp_change_c": round(temp, 2),
                "crop_production_pct": round(max(10, 100 + temp * 8), 1),
                "sunlight_reduction_pct": round(max(0, soot_tg * 0.5 * math.exp(-year / 3)), 1),
            })

        return {
            "scenario": {
                "warheads_used": warheads_used,
                "yield_kt_avg": yield_kt_avg,
                "total_megatons": round(total_mt, 1),
                "target_type": target_type,
            },
            "effects": {
                "soot_injection_tg": round(soot_tg, 1),
                "peak_temp_drop_c": temp_drop_peak,
                "crop_loss_pct": round(crop_loss_pct, 1),
                "estimated_famine_deaths_billions": round(famine_deaths_billions, 2),
                "years_to_half_recovery": years_to_half_recovery,
                "years_to_full_recovery": years_to_full_recovery,
            },
            "timeline": timeline,
            "classification": "nuclear_winter" if soot_tg > 50 else "nuclear_autumn" if soot_tg > 10 else "limited_impact",
        }

    def assess_reactor_risk(self, reactor_id: str) -> Dict[str, Any]:
        """Assess risk for a specific reactor."""
        reactor = self._reactors.get(reactor_id)
        if not reactor:
            return {"error": f"Reactor {reactor_id} not found"}

        # Risk scoring
        age_years = datetime.now().year - reactor.commission_year if reactor.commission_year > 0 else 0
        age_risk = min(1.0, age_years / 60)
        factor_risk = len(reactor.risk_factors) * 0.15
        type_risk = {"RBMK": 0.3, "BWR": 0.15, "PWR": 0.1, "VVER-1000": 0.15, "CANDU": 0.1, "EPR": 0.05}.get(reactor.type, 0.1)
        overall = min(1.0, (age_risk + factor_risk + type_risk) / 2)

        return {
            "reactor": reactor.to_dict(),
            "risk_assessment": {
                "age_risk": round(age_risk, 3),
                "design_risk": round(type_risk, 3),
                "factor_risk": round(factor_risk, 3),
                "overall_risk": round(overall, 3),
                "age_years": age_years,
            },
        }

    def get_dashboard(self) -> Dict[str, Any]:
        """Get ASM module dashboard."""
        reactors = list(self._reactors.values())
        operational = [r for r in reactors if r.status == "operational"]
        total_capacity = sum(r.capacity_mw for r in operational)
        total_warheads = sum(s.estimated_warheads for s in self._states)

        return {
            "reactors": {
                "total": len(reactors),
                "operational": len(operational),
                "total_capacity_gw": round(total_capacity / 1000, 1),
                "countries": len(set(r.country for r in reactors)),
                "registry": [r.to_dict() for r in reactors],
            },
            "nuclear_weapons": {
                "total_warheads": total_warheads,
                "nuclear_states": len(self._states),
                "states": [s.to_dict() for s in self._states],
            },
            "escalation_ladder": ESCALATION_LADDER,
        }


# Global instance
asm_service = ASMService()
