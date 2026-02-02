"""
Recovery Timeline Calculator
============================

Implements dynamic RTO/RPO calculation with critical path analysis
from Universal Stress Testing Methodology.

Features:
- Sector-specific base recovery times
- Severity-adjusted timelines
- Dependency delay calculation
- Critical path identification
- Resource requirement estimation
- Phased recovery planning

Reference: Universal Stress Testing Methodology v1.0, Part 2.3
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

logger = logging.getLogger(__name__)


class SectorType(str, Enum):
    """Sector types for recovery calculation."""
    INSURANCE = "insurance"
    REAL_ESTATE = "real_estate"
    FINANCIAL = "financial"
    ENTERPRISE = "enterprise"
    DEFENSE = "defense"


class Priority(str, Enum):
    """Asset/process priority levels."""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


# =============================================================================
# BASE RECOVERY TIMES (Days) - From Methodology
# =============================================================================

# Base RTO by sector and priority
BASE_RTO = {
    SectorType.INSURANCE: {
        Priority.CRITICAL: 1,      # 1 day
        Priority.HIGH: 7,          # 1 week
        Priority.MEDIUM: 30,       # 1 month
        Priority.LOW: 90           # 3 months
    },
    SectorType.REAL_ESTATE: {
        Priority.CRITICAL: 7,      # 1 week
        Priority.HIGH: 30,         # 1 month
        Priority.MEDIUM: 90,       # 3 months
        Priority.LOW: 180          # 6 months
    },
    SectorType.FINANCIAL: {
        Priority.CRITICAL: 0.17,   # 4 hours
        Priority.HIGH: 1,          # 1 day
        Priority.MEDIUM: 7,        # 1 week
        Priority.LOW: 30           # 1 month
    },
    SectorType.ENTERPRISE: {
        Priority.CRITICAL: 0.5,    # 12 hours
        Priority.HIGH: 3,          # 3 days
        Priority.MEDIUM: 14,       # 2 weeks
        Priority.LOW: 60           # 2 months
    },
    SectorType.DEFENSE: {
        Priority.CRITICAL: 0.25,   # 6 hours
        Priority.HIGH: 1,          # 1 day
        Priority.MEDIUM: 7,        # 1 week
        Priority.LOW: 30           # 1 month
    }
}

# Base RPO by sector (hours)
BASE_RPO = {
    SectorType.INSURANCE: 24,      # 24 hours
    SectorType.REAL_ESTATE: 72,    # 72 hours
    SectorType.FINANCIAL: 1,       # 1 hour
    SectorType.ENTERPRISE: 4,      # 4 hours
    SectorType.DEFENSE: 0.5        # 30 minutes
}


@dataclass
class AffectedAsset:
    """Asset affected by stress event."""
    id: str
    name: str
    priority: Priority
    value: float = 0.0
    dependencies: List[str] = field(default_factory=list)
    recovery_complexity: float = 1.0  # 1.0 = normal, >1 = more complex


@dataclass
class RecoveryPhase:
    """Recovery phase definition."""
    name: str
    start_hours: float
    end_hours: float
    description: str
    key_activities: List[str]
    resource_intensity: float  # 0-1


@dataclass
class AssetRecovery:
    """Recovery timeline for single asset."""
    asset_id: str
    asset_name: str
    priority: str
    start_hours: float
    duration_hours: float
    completion_hours: float


@dataclass
class RecoveryTimeline:
    """Complete recovery timeline result."""
    rto_critical_hours: float
    rto_full_hours: float
    rpo_hours: float
    timeline_days: float
    phases: List[RecoveryPhase]
    asset_recoveries: List[AssetRecovery]
    critical_path: List[str]
    resource_requirements: Dict[str, Any]
    bottlenecks: List[str]


# =============================================================================
# RECOVERY TIMELINE CALCULATOR
# =============================================================================

def calculate_recovery_timeline(
    sector: str,
    severity: float,
    affected_assets: List[AffectedAsset],
    dependencies: Optional[Dict[str, List[str]]] = None,
    resources: Optional[Dict[str, Any]] = None
) -> RecoveryTimeline:
    """
    Calculate recovery timeline with critical path analysis.
    
    Args:
        sector: Sector type
        severity: Severity level (0-1)
        affected_assets: List of affected assets with priorities
        dependencies: Dict mapping asset_id to list of dependency asset_ids
        resources: Available recovery resources
    
    Returns:
        RecoveryTimeline with phases, asset recoveries, and critical path
    """
    if dependencies is None:
        dependencies = {}
    
    if resources is None:
        resources = {"teams": 5, "budget_pct": 100}
    
    # Get sector enum
    try:
        sector_enum = SectorType(sector.lower())
    except ValueError:
        logger.warning(f"Unknown sector {sector}, defaulting to enterprise")
        sector_enum = SectorType.ENTERPRISE
    
    # Severity multiplier: 1x to 3x at 100% severity
    severity_mult = 1 + (severity * 2)
    
    # Get base RTO for sector
    sector_rto = BASE_RTO.get(sector_enum, BASE_RTO[SectorType.ENTERPRISE])
    
    # Calculate per-asset recovery
    asset_recoveries = {}
    
    for asset in affected_assets:
        priority = asset.priority if isinstance(asset.priority, Priority) else Priority(asset.priority.lower())
        base_time_days = sector_rto.get(priority, sector_rto[Priority.MEDIUM])
        
        # Convert to hours
        base_time_hours = base_time_days * 24
        
        # Apply severity and complexity multipliers
        recovery_time = base_time_hours * severity_mult * asset.recovery_complexity
        
        # Calculate dependency delays
        dep_delay = 0.0
        asset_deps = dependencies.get(asset.id, asset.dependencies)
        
        for dep_id in asset_deps:
            if dep_id in asset_recoveries:
                dep_delay = max(dep_delay, asset_recoveries[dep_id]["completion"])
        
        asset_recoveries[asset.id] = {
            "name": asset.name,
            "priority": priority.value,
            "start": dep_delay,
            "duration": recovery_time,
            "completion": dep_delay + recovery_time
        }
    
    # Find critical path (longest path through dependencies)
    if asset_recoveries:
        max_completion = max(ar["completion"] for ar in asset_recoveries.values())
        
        # Critical path: assets on the longest chain
        critical_path = find_critical_path(asset_recoveries, dependencies)
        
        # RTO for critical operations
        critical_assets = [
            ar for ar in asset_recoveries.values() 
            if ar["priority"] == Priority.CRITICAL.value
        ]
        rto_critical = min(ar["completion"] for ar in critical_assets) if critical_assets else max_completion
    else:
        max_completion = 0
        critical_path = []
        rto_critical = 0
    
    # RPO
    rpo_hours = BASE_RPO.get(sector_enum, 24)
    
    # Generate recovery phases
    phases = generate_phases(max_completion, sector_enum, severity)
    
    # Calculate resource requirements
    resource_reqs = calculate_resources(asset_recoveries, resources, severity)
    
    # Identify bottlenecks
    bottlenecks = identify_bottlenecks(asset_recoveries, dependencies)
    
    # Build asset recovery list
    recovery_list = [
        AssetRecovery(
            asset_id=asset_id,
            asset_name=data["name"],
            priority=data["priority"],
            start_hours=round(data["start"], 2),
            duration_hours=round(data["duration"], 2),
            completion_hours=round(data["completion"], 2)
        )
        for asset_id, data in asset_recoveries.items()
    ]
    
    return RecoveryTimeline(
        rto_critical_hours=round(rto_critical, 2),
        rto_full_hours=round(max_completion, 2),
        rpo_hours=round(rpo_hours, 2),
        timeline_days=round(max_completion / 24, 1),
        phases=phases,
        asset_recoveries=recovery_list,
        critical_path=critical_path,
        resource_requirements=resource_reqs,
        bottlenecks=bottlenecks
    )


def find_critical_path(
    asset_recoveries: Dict[str, Dict],
    dependencies: Dict[str, List[str]]
) -> List[str]:
    """
    Find critical path through asset recovery timeline.
    
    Args:
        asset_recoveries: Dict of asset recovery data
        dependencies: Dependency mapping
    
    Returns:
        List of asset names on critical path
    """
    if not asset_recoveries:
        return []
    
    # Find asset with maximum completion time
    max_asset = max(asset_recoveries.items(), key=lambda x: x[1]["completion"])
    
    path = [max_asset[1]["name"]]
    current_id = max_asset[0]
    
    # Trace back through dependencies
    while True:
        # Find dependencies of current asset
        deps = dependencies.get(current_id, [])
        
        if not deps:
            break
        
        # Find the dependency with latest completion (on critical path)
        critical_dep = None
        max_completion = 0
        
        for dep_id in deps:
            if dep_id in asset_recoveries:
                if asset_recoveries[dep_id]["completion"] > max_completion:
                    max_completion = asset_recoveries[dep_id]["completion"]
                    critical_dep = dep_id
        
        if critical_dep is None:
            break
        
        path.append(asset_recoveries[critical_dep]["name"])
        current_id = critical_dep
    
    return list(reversed(path))


def generate_phases(
    total_hours: float,
    sector: SectorType,
    severity: float
) -> List[RecoveryPhase]:
    """
    Generate recovery phases based on total timeline.
    
    Args:
        total_hours: Total recovery time in hours
        sector: Sector type
        severity: Severity level
    
    Returns:
        List of RecoveryPhase objects
    """
    # Phase boundaries (percentage of total time)
    phase_boundaries = [
        (0.0, 0.05, "Emergency Response"),
        (0.05, 0.15, "Stabilization"),
        (0.15, 0.40, "Initial Recovery"),
        (0.40, 0.75, "Core Recovery"),
        (0.75, 1.0, "Full Restoration")
    ]
    
    # Sector-specific activities
    sector_activities = {
        SectorType.INSURANCE: {
            "Emergency Response": ["Activate crisis team", "Initial claims triage", "Reinsurer notification"],
            "Stabilization": ["Deploy claims adjusters", "Establish hotlines", "Reserve estimation"],
            "Initial Recovery": ["Process priority claims", "Subrogation initiation", "Vendor coordination"],
            "Core Recovery": ["Bulk claims processing", "Reserve adjustments", "Regulatory reporting"],
            "Full Restoration": ["Claims finalization", "Lessons learned", "Model recalibration"]
        },
        SectorType.REAL_ESTATE: {
            "Emergency Response": ["Property inspection", "Tenant communication", "Emergency repairs"],
            "Stabilization": ["Damage assessment", "Insurance claims", "Temporary measures"],
            "Initial Recovery": ["Contractor engagement", "Permit acquisition", "Repair planning"],
            "Core Recovery": ["Major repairs", "Tenant relocation management", "Cash flow adjustment"],
            "Full Restoration": ["Final inspections", "Tenant return", "Market repositioning"]
        },
        SectorType.FINANCIAL: {
            "Emergency Response": ["Activate DR site", "Transaction halt", "Regulator notification"],
            "Stabilization": ["System validation", "Data reconciliation", "Client communication"],
            "Initial Recovery": ["Core systems restore", "Priority transactions", "Limit monitoring"],
            "Core Recovery": ["Full transaction processing", "Backlog clearing", "Risk recalculation"],
            "Full Restoration": ["System optimization", "Audit preparation", "Control enhancement"]
        },
        SectorType.ENTERPRISE: {
            "Emergency Response": ["BCP activation", "Employee safety", "Critical process assessment"],
            "Stabilization": ["Alternate site setup", "Supply chain assessment", "Customer notification"],
            "Initial Recovery": ["Priority production", "Inventory management", "Cash preservation"],
            "Core Recovery": ["Full production ramp", "Supply chain restoration", "Revenue recovery"],
            "Full Restoration": ["Efficiency optimization", "Lessons learned", "Resilience improvement"]
        },
        SectorType.DEFENSE: {
            "Emergency Response": ["Alert escalation", "Asset protection", "Command chain activation"],
            "Stabilization": ["Capability assessment", "Resource mobilization", "Alliance coordination"],
            "Initial Recovery": ["Priority capability restore", "Supply surge initiation", "Intel sharing"],
            "Core Recovery": ["Full capability restoration", "Reserve integration", "Mission readiness"],
            "Full Restoration": ["Capability enhancement", "After-action review", "Doctrine update"]
        }
    }
    
    activities = sector_activities.get(sector, sector_activities[SectorType.ENTERPRISE])
    
    phases = []
    for start_pct, end_pct, name in phase_boundaries:
        start_hours = total_hours * start_pct
        end_hours = total_hours * end_pct
        
        # Resource intensity varies by phase
        if name == "Emergency Response":
            intensity = 1.0
        elif name in ["Stabilization", "Initial Recovery"]:
            intensity = 0.8
        elif name == "Core Recovery":
            intensity = 0.6
        else:
            intensity = 0.4
        
        phases.append(RecoveryPhase(
            name=name,
            start_hours=round(start_hours, 2),
            end_hours=round(end_hours, 2),
            description=f"{name} phase for {sector.value} sector",
            key_activities=activities.get(name, ["Activity 1", "Activity 2"]),
            resource_intensity=intensity
        ))
    
    return phases


def calculate_resources(
    asset_recoveries: Dict[str, Dict],
    resources: Dict[str, Any],
    severity: float
) -> Dict[str, Any]:
    """
    Calculate resource requirements for recovery.
    
    Args:
        asset_recoveries: Asset recovery data
        resources: Available resources
        severity: Severity level
    
    Returns:
        Dict with resource requirements
    """
    n_assets = len(asset_recoveries)
    
    # Base team requirement
    base_teams = max(2, n_assets // 3)
    severity_factor = 1 + severity
    required_teams = int(base_teams * severity_factor)
    
    available_teams = resources.get("teams", 5)
    team_gap = max(0, required_teams - available_teams)
    
    # Budget estimation (relative)
    base_budget_pct = 100
    required_budget = base_budget_pct * severity_factor * (1 + n_assets * 0.05)
    available_budget = resources.get("budget_pct", 100)
    budget_gap = max(0, required_budget - available_budget)
    
    # External support needed
    external_support = team_gap > 0 or budget_gap > 20
    
    return {
        "required_teams": required_teams,
        "available_teams": available_teams,
        "team_gap": team_gap,
        "required_budget_pct": round(required_budget, 1),
        "available_budget_pct": available_budget,
        "budget_gap_pct": round(budget_gap, 1),
        "external_support_needed": external_support,
        "estimated_overtime_hours": int(severity * 40 * required_teams),
        "contractor_support": team_gap > 2
    }


def identify_bottlenecks(
    asset_recoveries: Dict[str, Dict],
    dependencies: Dict[str, List[str]]
) -> List[str]:
    """
    Identify bottlenecks in recovery timeline.
    
    Args:
        asset_recoveries: Asset recovery data
        dependencies: Dependency mapping
    
    Returns:
        List of bottleneck asset names
    """
    bottlenecks = []
    
    # Count how many assets depend on each asset
    dependency_counts = {}
    for asset_id, deps in dependencies.items():
        for dep in deps:
            dependency_counts[dep] = dependency_counts.get(dep, 0) + 1
    
    # Assets with many dependents are bottlenecks
    for asset_id, count in dependency_counts.items():
        if count >= 2 and asset_id in asset_recoveries:
            bottlenecks.append(f"{asset_recoveries[asset_id]['name']} ({count} dependents)")
    
    # Also check for long-duration assets
    if asset_recoveries:
        avg_duration = np.mean([ar["duration"] for ar in asset_recoveries.values()])
        for asset_id, data in asset_recoveries.items():
            if data["duration"] > avg_duration * 1.5:
                name = f"{data['name']} (long duration)"
                if name not in bottlenecks:
                    bottlenecks.append(name)
    
    return bottlenecks[:5]  # Top 5 bottlenecks


# =============================================================================
# QUICK RECOVERY CALCULATION FOR REPORT V2
# =============================================================================

def quick_recovery_calculation(
    sector: str,
    severity: float,
    n_entities: int,
    event_type: str
) -> Dict[str, Any]:
    """
    Quick recovery calculation for Report V2 integration.
    
    Simplified version that doesn't require full asset list.
    
    Args:
        sector: Sector type
        severity: Severity level (0-1)
        n_entities: Number of affected entities
        event_type: Type of stress event
    
    Returns:
        Dict with recovery metrics for Report V2
    """
    # Get sector enum
    try:
        sector_enum = SectorType(sector.lower())
    except ValueError:
        sector_enum = SectorType.ENTERPRISE
    
    # Severity multiplier
    severity_mult = 1 + (severity * 2)
    
    # Get base RTOs
    sector_rto = BASE_RTO.get(sector_enum, BASE_RTO[SectorType.ENTERPRISE])
    rpo_hours = BASE_RPO.get(sector_enum, 24)
    
    # RTO for critical operations
    rto_critical_hours = sector_rto[Priority.CRITICAL] * 24 * severity_mult
    
    # Full RTO (all operations)
    rto_full_days = sector_rto[Priority.LOW] * severity_mult
    
    # Event-type adjustments
    event_multipliers = {
        "flood": 1.3,
        "seismic": 1.5,
        "cyber": 0.7,
        "financial": 0.5,
        "pandemic": 1.8,
        "supply_chain": 1.4,
        "geopolitical": 1.2
    }
    event_mult = event_multipliers.get(event_type.lower(), 1.0)
    
    rto_full_days *= event_mult
    rto_critical_hours *= event_mult
    
    # Business interruption days
    bi_days = int(rto_full_days * 0.3)  # First 30% is interruption
    
    # Recovery timeline with phases
    timeline_phases = [
        {"phase": "Emergency", "start": "T+0", "end": f"T+{int(rto_critical_hours)}h", "description": "Critical operations recovery"},
        {"phase": "Stabilization", "start": f"T+{int(rto_critical_hours)}h", "end": f"T+{int(rto_full_days * 0.15)}d", "description": "Business stabilization"},
        {"phase": "Recovery", "start": f"T+{int(rto_full_days * 0.15)}d", "end": f"T+{int(rto_full_days)}d", "description": "Full recovery"}
    ]
    
    # Loss accumulation curve
    loss_accumulation = [
        {"time": "T+0", "cumulative_pct": 17, "description": "Immediate impact"},
        {"time": "T+24h", "cumulative_pct": 33, "description": "First day losses"},
        {"time": "T+72h", "cumulative_pct": 45, "description": "Initial assessment"},
        {"time": "T+1w", "cumulative_pct": 67, "description": "Week 1 accumulation"},
        {"time": "T+1m", "cumulative_pct": 85, "description": "Month 1 total"},
        {"time": "T+3m", "cumulative_pct": 95, "description": "Quarter 1 total"},
        {"time": f"T+{int(rto_full_days / 30)}m", "cumulative_pct": 100, "description": "Full impact realized"}
    ]
    
    return {
        "rto_critical_hours": round(rto_critical_hours, 1),
        "rto_full_days": round(rto_full_days, 1),
        "rpo_hours": round(rpo_hours, 1),
        "business_interruption_days": bi_days,
        "recovery_time_months": (int(rto_full_days / 30), int(rto_full_days / 30 * 1.5)),
        "timeline_phases": timeline_phases,
        "loss_accumulation": loss_accumulation,
        "estimated_workforce_recovery_pct": max(20, int(100 - severity * 50)),
        "supply_chain_recovery_weeks": int(severity * 8 + 2)
    }


def format_recovery_for_report(
    recovery: RecoveryTimeline
) -> Dict[str, Any]:
    """
    Format RecoveryTimeline for Report V2 output.
    
    Args:
        recovery: RecoveryTimeline object
    
    Returns:
        Dict formatted for Report V2 temporal_dynamics section
    """
    return {
        "rto_hours": recovery.rto_critical_hours,
        "rpo_hours": recovery.rpo_hours,
        "recovery_time_months": [
            int(recovery.timeline_days / 30),
            int(recovery.timeline_days / 30 * 1.2)
        ],
        "business_interruption_days": int(recovery.timeline_days * 0.3),
        "phases": [
            {
                "name": phase.name,
                "start_hours": phase.start_hours,
                "end_hours": phase.end_hours,
                "description": phase.description,
                "activities": phase.key_activities
            }
            for phase in recovery.phases
        ],
        "critical_path": recovery.critical_path,
        "bottlenecks": recovery.bottlenecks,
        "resource_gap": recovery.resource_requirements.get("team_gap", 0) > 0
    }
