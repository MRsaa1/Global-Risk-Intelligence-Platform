"""
Financial-Physical Correlation Engine (SRO Phase 1.3).

Quantifies how physical system failures amplify through financial channels.
Integrates with Knowledge Graph and Cascade Engine.
"""
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


@dataclass
class TransmissionChannel:
    """Single transmission channel in amplification analysis."""
    channel: str
    institutions_affected: int
    contribution_to_amplification: float


@dataclass
class AmplificationAnalysis:
    """Result of amplification factor calculation."""
    initial_impact_usd: float
    amplified_impact_usd: float
    amplification_factor: float
    transmission_channels: List[TransmissionChannel]
    time_to_systemic_impact_days: int
    intervention_window_days: int


def _get_kg():
    """Lazy-import Knowledge Graph service."""
    try:
        from src.services.knowledge_graph import get_knowledge_graph_service
        kg = get_knowledge_graph_service()
        return kg if kg.is_available else None
    except Exception:
        return None


def _get_cascade_service():
    """Lazy-import Cascade GNN service."""
    try:
        from src.services.cascade_gnn import CascadeGNNService
        return CascadeGNNService()
    except Exception:
        return None


class FinancialPhysicalCorrelationEngine:
    """
    Quantifies how physical system failures amplify through financial channels.

    Use case: Texas Power Grid Failure (Feb 2021) counterfactual
    - Direct losses: $20B (energy sector)
    - Total economic impact: $130B (amplification ~6.5x)
    """

    def __init__(self, db_session=None):
        self.db = db_session

    async def calculate_amplification_factor(
        self,
        shock_origin_id: str,
        shock_origin_type: str = "infrastructure",
        time_horizon_days: int = 90,
    ) -> AmplificationAnalysis:
        """
        Calculate financial amplification for a physical shock.

        Args:
            shock_origin_id: ID of CIP asset, SCSS supplier, or infrastructure node
            shock_origin_type: "infrastructure", "supplier", or "asset"
            time_horizon_days: Simulation horizon

        Returns:
            AmplificationAnalysis with impact and transmission channels
        """
        kg = _get_kg()
        cascade_svc = _get_cascade_service()

        # 1. Query KG for financial exposure paths
        transmission_channels: List[TransmissionChannel] = []
        total_direct_exposure = 0.0
        institutions_affected = set()

        # 1a. Integrate with Cascade GNN: use propagation paths when available
        if cascade_svc and cascade_svc.nodes:
            trigger_id = shock_origin_id
            # Resolve alias: cascade_gnn may use different node IDs
            for nid in cascade_svc.nodes:
                if shock_origin_id in nid or nid == shock_origin_id:
                    trigger_id = nid
                    break
            if trigger_id in cascade_svc.nodes:
                try:
                    result = await cascade_svc.simulate_cascade(
                        trigger_node_id=trigger_id,
                        trigger_severity=0.8,
                        max_steps=min(20, time_horizon_days // 5),
                        propagation_threshold=0.3,
                    )
                    for node_id in result.affected_nodes:
                        institutions_affected.add(node_id)
                    if result.total_loss > 0:
                        total_direct_exposure = max(total_direct_exposure, result.total_loss)
                    if result.propagation_paths:
                        transmission_channels.append(
                            TransmissionChannel(
                                channel="cascade_gnn_propagation",
                                institutions_affected=len(result.affected_nodes),
                                contribution_to_amplification=0.5,
                            )
                        )
                except Exception as e:
                    logger.warning("Cascade GNN integration failed: %s", e)

        if kg:
            try:
                cascade_paths = await kg.query_energy_shock_cascade(shock_origin_id)
                for p in cascade_paths:
                    if p.get("bank_id"):
                        institutions_affected.add(p["bank_id"])
                    if p.get("counterparty_id"):
                        institutions_affected.add(p["counterparty_id"])
                    exp = p.get("exposure") or 0
                    total_direct_exposure += exp

                if cascade_paths:
                    transmission_channels.append(
                        TransmissionChannel(
                            channel="credit_default",
                            institutions_affected=len(institutions_affected),
                            contribution_to_amplification=0.6,
                        )
                    )
                    transmission_channels.append(
                        TransmissionChannel(
                            channel="fire_sales",
                            institutions_affected=len(institutions_affected),
                            contribution_to_amplification=0.4,
                        )
                    )
            except Exception as e:
                logger.warning("KG query for amplification failed: %s", e)

        # 2. Fallback: use SRO exposures from DB if available
        if self.db and not transmission_channels:
            try:
                from sqlalchemy import select
                from src.modules.sro.models import InstitutionExposure, FinancialInstitution

                result = await self.db.execute(
                    select(InstitutionExposure)
                    .where(InstitutionExposure.target_id == shock_origin_id)
                )
                exposures = list(result.scalars().all())
                for ex in exposures:
                    total_direct_exposure += ex.exposure_amount_usd or 0
                    institutions_affected.add(ex.institution_id)

                if exposures:
                    transmission_channels.append(
                        TransmissionChannel(
                            channel="direct_exposure",
                            institutions_affected=len(institutions_affected),
                            contribution_to_amplification=0.5,
                        )
                    )
                    transmission_channels.append(
                        TransmissionChannel(
                            channel="contagion",
                            institutions_affected=len(institutions_affected) * 2,
                            contribution_to_amplification=0.5,
                        )
                    )
            except Exception as e:
                logger.warning("DB query for exposures failed: %s", e)

        # 3. Heuristic amplification when no graph data
        if not transmission_channels:
            total_direct_exposure = 5e9  # Default $5B direct
            transmission_channels = [
                TransmissionChannel("credit_default", 12, 0.6),
                TransmissionChannel("fire_sales", 8, 0.4),
            ]
            institutions_affected = set(f"placeholder_{i}" for i in range(20))

        # 4. Calculate amplification
        amp_factor = 2.0 + 0.1 * len(institutions_affected)
        amp_factor = min(amp_factor, 10.0)
        amplified_impact = total_direct_exposure * amp_factor

        # 5. Consume CIP asset status and SCSS stress to adjust amplification
        cip_stress_mult = 1.0
        scss_stress_mult = 1.0
        if self.db:
            try:
                from sqlalchemy import select
                # CIP: check infrastructure operational status
                from src.modules.cip.models import CriticalInfrastructure
                cip_result = await self.db.execute(
                    select(CriticalInfrastructure.operational_status)
                    .where(
                        (CriticalInfrastructure.id == shock_origin_id)
                        | (CriticalInfrastructure.cip_id == shock_origin_id)
                        | (CriticalInfrastructure.asset_id == shock_origin_id)
                    )
                    .limit(1)
                )
                cip_row = cip_result.scalar_one_or_none()
                if cip_row and cip_row[0]:
                    status = str(cip_row[0]).lower()
                    if status in ("offline", "degraded"):
                        cip_stress_mult = 1.5 if status == "degraded" else 2.0
                # SCSS: check supply chain stress for target
                from src.modules.scss.models import SupplyRoute
                scss_result = await self.db.execute(
                    select(SupplyRoute.chokepoint_exposure, SupplyRoute.route_risk_score)
                    .where(
                        (SupplyRoute.source_id == shock_origin_id)
                        | (SupplyRoute.target_id == shock_origin_id)
                    )
                    .limit(5)
                )
                for row in scss_result.fetchall():
                    exp = (row[0] or 0) / 100
                    risk = (row[1] or 0) / 100
                    if exp > 0.5 or risk > 0.5:
                        scss_stress_mult = max(scss_stress_mult, 1.0 + (exp + risk) * 0.5)
            except Exception as e:
                logger.debug("CIP/SCSS status lookup failed: %s", e)

        amp_factor *= cip_stress_mult * scss_stress_mult
        amp_factor = min(amp_factor, 10.0)
        amplified_impact = total_direct_exposure * amp_factor

        # 6. Time estimates (heuristic)
        time_to_systemic = min(30, 5 + len(institutions_affected))
        intervention_window = max(3, time_to_systemic - 8)

        return AmplificationAnalysis(
            initial_impact_usd=total_direct_exposure,
            amplified_impact_usd=amplified_impact,
            amplification_factor=round(amp_factor, 2),
            transmission_channels=transmission_channels,
            time_to_systemic_impact_days=time_to_systemic,
            intervention_window_days=intervention_window,
        )


def get_correlation_engine(db_session=None) -> FinancialPhysicalCorrelationEngine:
    """Factory for correlation engine."""
    return FinancialPhysicalCorrelationEngine(db_session)
