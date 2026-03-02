"""
BIOSEC Service - Biosecurity & Pandemic modeling engine.

Implements:
- BSL-4 lab registry with global locations
- SIR/SEIR pandemic spread modeling
- Airport connectivity graph for transmission pathways
- Pathogen threat assessment
"""
from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional
from uuid import uuid4

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# BSL-4 Lab Registry (real facilities, public data)
# ---------------------------------------------------------------------------

@dataclass
class BSL4Lab:
    """Biosafety Level 4 laboratory."""
    id: str
    name: str
    country: str
    city: str
    lat: float
    lng: float
    status: str = "operational"    # operational, under_construction, decommissioned
    operator: str = ""
    research_focus: List[str] = field(default_factory=list)
    risk_rating: float = 0.0      # 0-1 computed risk

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "country": self.country,
            "city": self.city,
            "lat": self.lat,
            "lng": self.lng,
            "status": self.status,
            "operator": self.operator,
            "research_focus": self.research_focus,
            "risk_rating": self.risk_rating,
        }


# Global BSL-4 facility database (public knowledge)
BSL4_REGISTRY: List[BSL4Lab] = [
    BSL4Lab("bsl4_001", "Wuhan Institute of Virology", "China", "Wuhan", 30.37, 114.26,
            operator="CAS", research_focus=["coronaviruses", "bat_viruses"], risk_rating=0.7),
    BSL4Lab("bsl4_002", "USAMRIID", "USA", "Fort Detrick", 39.44, -77.44,
            operator="US Army", research_focus=["biodefense", "ebola", "anthrax"], risk_rating=0.5),
    BSL4Lab("bsl4_003", "CDC BSL-4", "USA", "Atlanta", 33.80, -84.32,
            operator="CDC", research_focus=["ebola", "marburg", "smallpox"], risk_rating=0.4),
    BSL4Lab("bsl4_004", "NIBSC", "UK", "London", 51.67, -0.19,
            operator="MHRA", research_focus=["viral_hemorrhagic_fever"], risk_rating=0.3),
    BSL4Lab("bsl4_005", "Jean Mérieux-INSERM BSL-4", "France", "Lyon", 45.73, 4.87,
            operator="INSERM", research_focus=["ebola", "lassa_fever"], risk_rating=0.3),
    BSL4Lab("bsl4_006", "Bernhard Nocht Institute", "Germany", "Hamburg", 53.55, 9.97,
            operator="BNITM", research_focus=["tropical_diseases", "ebola"], risk_rating=0.3),
    BSL4Lab("bsl4_007", "CSIRO AAHL", "Australia", "Geelong", -38.17, 144.36,
            operator="CSIRO", research_focus=["hendra", "nipah", "ebola"], risk_rating=0.3),
    BSL4Lab("bsl4_008", "National Microbiology Lab", "Canada", "Winnipeg", 49.90, -97.15,
            operator="PHAC", research_focus=["ebola", "influenza"], risk_rating=0.4),
    BSL4Lab("bsl4_009", "RKI BSL-4", "Germany", "Berlin", 52.52, 13.38,
            operator="Robert Koch Institute", research_focus=["smallpox", "viral_hemorrhagic_fever"], risk_rating=0.3),
    BSL4Lab("bsl4_010", "VECTOR", "Russia", "Koltsovo", 54.82, 83.27,
            operator="Rospotrebnadzor", research_focus=["smallpox", "ebola", "biodefense"], risk_rating=0.6),
    BSL4Lab("bsl4_011", "NEIDL", "USA", "Boston", 42.34, -71.07,
            operator="Boston University", research_focus=["ebola", "SARS_family"], risk_rating=0.4),
    BSL4Lab("bsl4_012", "Galveston National Lab", "USA", "Galveston", 29.30, -94.79,
            operator="UTMB", research_focus=["biodefense", "ebola", "plague"], risk_rating=0.4),
    BSL4Lab("bsl4_013", "NCDC BSL-4", "India", "Pune", 18.52, 73.86,
            operator="ICMR", research_focus=["nipah", "crimean_congo"], risk_rating=0.5),
    BSL4Lab("bsl4_014", "Lugar Center", "Georgia", "Tbilisi", 41.69, 44.80,
            operator="NCDC Georgia", research_focus=["anthrax", "tularemia"], risk_rating=0.5),
    BSL4Lab("bsl4_015", "KCDC BSL-4", "South Korea", "Cheongju", 36.64, 127.49,
            operator="KDCA", research_focus=["MERS", "ebola", "SARS"], risk_rating=0.3),
]


# ---------------------------------------------------------------------------
# Major Airport Hubs (for spread modeling)
# ---------------------------------------------------------------------------

MAJOR_AIRPORTS = [
    {"code": "ATL", "city": "Atlanta", "lat": 33.64, "lng": -84.43, "annual_pax_m": 93},
    {"code": "DXB", "city": "Dubai", "lat": 25.25, "lng": 55.36, "annual_pax_m": 87},
    {"code": "DFW", "city": "Dallas", "lat": 32.90, "lng": -97.04, "annual_pax_m": 73},
    {"code": "LHR", "city": "London", "lat": 51.47, "lng": -0.46, "annual_pax_m": 80},
    {"code": "HND", "city": "Tokyo", "lat": 35.55, "lng": 139.78, "annual_pax_m": 85},
    {"code": "CDG", "city": "Paris", "lat": 49.01, "lng": 2.55, "annual_pax_m": 76},
    {"code": "PEK", "city": "Beijing", "lat": 40.08, "lng": 116.59, "annual_pax_m": 100},
    {"code": "SIN", "city": "Singapore", "lat": 1.35, "lng": 103.99, "annual_pax_m": 68},
    {"code": "FRA", "city": "Frankfurt", "lat": 50.03, "lng": 8.57, "annual_pax_m": 70},
    {"code": "ICN", "city": "Seoul", "lat": 37.46, "lng": 126.44, "annual_pax_m": 71},
    {"code": "YYZ", "city": "Toronto", "lat": 43.68, "lng": -79.63, "annual_pax_m": 50},
    {"code": "SYD", "city": "Sydney", "lat": -33.95, "lng": 151.18, "annual_pax_m": 44},
    {"code": "GRU", "city": "São Paulo", "lat": -23.43, "lng": -46.47, "annual_pax_m": 42},
    {"code": "NRT", "city": "Tokyo Narita", "lat": 35.77, "lng": 140.39, "annual_pax_m": 40},
    {"code": "JFK", "city": "New York", "lat": 40.64, "lng": -73.78, "annual_pax_m": 62},
]


@dataclass
class PandemicState:
    """SIR model state for pandemic spread simulation."""
    day: int
    susceptible: float
    infected: float
    recovered: float
    dead: float
    r_effective: float
    containment_level: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "day": self.day,
            "susceptible": round(self.susceptible),
            "infected": round(self.infected),
            "recovered": round(self.recovered),
            "dead": round(self.dead),
            "r_effective": round(self.r_effective, 3),
            "containment_level": self.containment_level,
        }


class BIOSECService:
    """Biosecurity & Pandemic modeling service."""

    def __init__(self):
        self._labs = {lab.id: lab for lab in BSL4_REGISTRY}
        self._airports = MAJOR_AIRPORTS

    def get_labs(self, country: Optional[str] = None) -> List[Dict[str, Any]]:
        """Get BSL-4 lab registry, optionally filtered by country."""
        labs = list(self._labs.values())
        if country:
            labs = [l for l in labs if l.country.lower() == country.lower()]
        return [l.to_dict() for l in labs]

    def get_airports(self) -> List[Dict[str, Any]]:
        """Get major airport hubs for spread modeling."""
        return self._airports

    def simulate_pandemic(
        self,
        population: float = 8e9,
        initial_infected: float = 100,
        r0: float = 3.0,
        ifr: float = 0.02,
        recovery_days: float = 14,
        days: int = 365,
        containment_day: int = 30,
        containment_effectiveness: float = 0.5,
    ) -> List[Dict[str, Any]]:
        """
        Run SIR pandemic spread simulation.

        Parameters:
            population: Total population
            initial_infected: Initial number of infected
            r0: Basic reproduction number
            ifr: Infection fatality rate
            recovery_days: Average days to recovery
            days: Simulation duration
            containment_day: Day containment measures begin
            containment_effectiveness: 0-1 effectiveness of containment
        """
        gamma = 1.0 / recovery_days    # Recovery rate
        beta = r0 * gamma               # Transmission rate

        S = population - initial_infected
        I = initial_infected
        R = 0.0
        D = 0.0

        results = []
        for day in range(days):
            containment = containment_effectiveness if day >= containment_day else 0.0
            effective_beta = beta * (1.0 - containment)
            r_eff = effective_beta / gamma

            # SIR differential equations (discrete)
            new_infections = effective_beta * S * I / population
            new_recoveries = gamma * I * (1.0 - ifr)
            new_deaths = gamma * I * ifr

            S -= new_infections
            I += new_infections - new_recoveries - new_deaths
            R += new_recoveries
            D += new_deaths

            # Clamp
            S = max(0, S)
            I = max(0, I)

            if day % max(1, days // 100) == 0 or day < 60:
                results.append(PandemicState(
                    day=day,
                    susceptible=S,
                    infected=I,
                    recovered=R,
                    dead=D,
                    r_effective=r_eff,
                    containment_level=containment,
                ).to_dict())

            # Stop if infections negligible
            if I < 1 and day > 30:
                results.append(PandemicState(
                    day=day, susceptible=S, infected=0, recovered=R,
                    dead=D, r_effective=0, containment_level=containment,
                ).to_dict())
                break

        return results

    def assess_lab_risk(self, lab_id: str) -> Dict[str, Any]:
        """Assess risk for a specific BSL-4 lab."""
        lab = self._labs.get(lab_id)
        if not lab:
            return {"error": f"Lab {lab_id} not found"}

        # Compute proximity to population centers and airports
        nearby_airports = []
        for ap in self._airports:
            dist = self._haversine(lab.lat, lab.lng, ap["lat"], ap["lng"])
            if dist < 500:  # Within 500 km
                nearby_airports.append({
                    "code": ap["code"],
                    "city": ap["city"],
                    "distance_km": round(dist),
                    "annual_pax_m": ap["annual_pax_m"],
                })

        spread_risk = min(1.0, sum(a["annual_pax_m"] for a in nearby_airports) / 200)

        return {
            "lab": lab.to_dict(),
            "nearby_airports": nearby_airports,
            "spread_risk_score": round(spread_risk, 3),
            "containment_rating": round(1.0 - lab.risk_rating, 2),
            "overall_risk": round((lab.risk_rating + spread_risk) / 2, 3),
        }

    def get_spread_network(self) -> Dict[str, Any]:
        """Get airport connectivity network for pandemic spread visualization."""
        nodes = [
            {"id": ap["code"], "label": ap["city"], "lat": ap["lat"], "lng": ap["lng"],
             "size": ap["annual_pax_m"], "type": "airport"}
            for ap in self._airports
        ]
        # Add BSL-4 labs as nodes
        for lab in self._labs.values():
            nodes.append({
                "id": lab.id, "label": lab.name, "lat": lab.lat, "lng": lab.lng,
                "size": 10, "type": "bsl4_lab", "risk_rating": lab.risk_rating,
            })

        # Create edges between airports (major routes)
        edges = []
        for i, a in enumerate(self._airports):
            for j, b in enumerate(self._airports):
                if i >= j:
                    continue
                dist = self._haversine(a["lat"], a["lng"], b["lat"], b["lng"])
                if dist < 12000:  # Most international routes
                    weight = min(a["annual_pax_m"], b["annual_pax_m"]) / 100
                    edges.append({
                        "source": a["code"],
                        "target": b["code"],
                        "weight": round(weight, 2),
                        "distance_km": round(dist),
                    })

        return {"nodes": nodes, "edges": edges}

    def get_dashboard(self) -> Dict[str, Any]:
        """Get BIOSEC dashboard summary."""
        labs = list(self._labs.values())
        high_risk = [l for l in labs if l.risk_rating >= 0.5]
        return {
            "total_labs": len(labs),
            "high_risk_labs": len(high_risk),
            "countries_with_bsl4": len(set(l.country for l in labs)),
            "airport_hubs": len(self._airports),
            "labs": [l.to_dict() for l in labs],
            "risk_summary": {
                "avg_risk": round(sum(l.risk_rating for l in labs) / len(labs), 3),
                "max_risk_lab": max(labs, key=lambda l: l.risk_rating).name,
            },
        }

    @staticmethod
    def _haversine(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
        """Haversine distance in km."""
        R = 6371
        lat1, lat2, lng1, lng2 = map(math.radians, [lat1, lat2, lng1, lng2])
        dlat = lat2 - lat1
        dlng = lng2 - lng1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng/2)**2
        return R * 2 * math.asin(math.sqrt(a))


# Global instance
biosec_service = BIOSECService()
