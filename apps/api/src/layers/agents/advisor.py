"""
ADVISOR Agent - Decision Support and Recommendations.

Responsibilities:
- Generate action recommendations
- Evaluate options with ROI analysis
- Prioritize by impact and urgency
- Support human decision-making

Enhanced with:
- NVIDIA NeMo Guardrails for safety and compliance
- NeMo Agent Toolkit for performance tracking
"""
import logging
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Optional
from uuid import UUID, uuid4

logger = logging.getLogger(__name__)


class ActionType(str, Enum):
    """Types of recommended actions."""
    IMMEDIATE = "immediate"  # Do now
    SCHEDULED = "scheduled"  # Plan for future
    MONITOR = "monitor"  # Watch and wait
    INVESTIGATE = "investigate"  # Need more info


class ActionCategory(str, Enum):
    """Categories of actions."""
    MAINTENANCE = "maintenance"
    INSURANCE = "insurance"
    FINANCING = "financing"
    ADAPTATION = "adaptation"  # Climate adaptation
    DIVESTMENT = "divestment"
    HEDGING = "hedging"


@dataclass
class Option:
    """A decision option with analysis."""
    id: UUID
    name: str
    description: str
    category: ActionCategory
    
    # Costs
    upfront_cost: float
    annual_cost: float
    
    # Benefits
    risk_reduction: float  # % reduction in risk
    pd_impact_bps: float  # Change in PD
    value_impact: float  # Change in value
    
    # Analysis
    npv_5yr: float
    roi_5yr: float
    payback_years: Optional[float]
    
    # Confidence
    confidence: float


@dataclass
class Recommendation:
    """A recommendation with evaluated options."""
    id: UUID
    trigger: str  # What triggered this recommendation
    asset_id: Optional[str]
    
    # Context
    current_situation: str
    risk_if_no_action: str
    
    # Options
    options: list[Option]
    recommended_option: str  # ID of recommended option
    recommendation_reason: str
    
    # Urgency
    urgency: str  # immediate, high, medium, low
    deadline: Optional[datetime]
    
    # Metadata
    created_at: datetime


class AdvisorAgent:
    """
    ADVISOR Agent - Guiding decisions.
    
    Provides:
    - Actionable recommendations
    - Option evaluation with ROI
    - Prioritization by impact
    - Decision support interfaces
    """
    
    async def generate_recommendations(
        self,
        asset_id: str,
        asset_data: dict,
        alerts: Optional[list] = None,
        analysis: Optional[dict] = None,
        regulations: Optional[list] = None,
    ) -> list[Recommendation]:
        """
        Generate recommendations for an asset based on current state and alerts.
        
        Enhanced with NeMo Guardrails for safety and compliance validation.
        
        Args:
            asset_id: Asset to advise on
            asset_data: Current asset data
            alerts: Active alerts for this asset
            analysis: Analysis results from Analyst agent
            regulations: Regulatory frameworks to comply with (ECB, Fed, TCFD, CSRD)
            
        Returns:
            List of prioritized recommendations (validated by Guardrails)
        """
        import time
        start_time = time.time()
        
        try:
            recommendations = []
            regulations = regulations or []
            
            # Check climate risk
            climate_risk = asset_data.get("climate_risk_score", 0)
            if climate_risk > 60:
                rec = await self._generate_climate_adaptation_recommendation(
                    asset_id, asset_data, climate_risk
                )
                # Validate with Guardrails
                rec = await self._validate_recommendation(rec, asset_id, asset_data, regulations)
                if rec:
                    recommendations.append(rec)
            
            # Check physical condition
            physical_risk = asset_data.get("physical_risk_score", 0)
            if physical_risk > 50:
                rec = await self._generate_maintenance_recommendation(
                    asset_id, asset_data, physical_risk
                )
                # Validate with Guardrails
                rec = await self._validate_recommendation(rec, asset_id, asset_data, regulations)
                if rec:
                    recommendations.append(rec)
            
            # Check network risk
            network_risk = asset_data.get("network_risk_score", 0)
            if network_risk > 70:
                rec = await self._generate_resilience_recommendation(
                    asset_id, asset_data, network_risk
                )
                # Validate with Guardrails
                rec = await self._validate_recommendation(rec, asset_id, asset_data, regulations)
                if rec:
                    recommendations.append(rec)
            
            # Process any active alerts
            if alerts:
                for alert in alerts:
                    rec = await self._generate_alert_response_recommendation(
                        asset_id, asset_data, alert
                    )
                    if rec:
                        # Validate with Guardrails
                        rec = await self._validate_recommendation(rec, asset_id, asset_data, regulations)
                        if rec:
                            recommendations.append(rec)
            
            # Sort by urgency
            urgency_order = {"immediate": 0, "high": 1, "medium": 2, "low": 3}
            recommendations.sort(key=lambda r: urgency_order.get(r.urgency, 4))
            
            # Track performance
            await self._track_performance(
                "generate_recommendations",
                start_time,
                success=True,
                metadata={
                    "recommendations_count": len(recommendations),
                    "regulations": regulations,
                }
            )
            
            return recommendations
        except Exception as e:
            await self._track_performance("generate_recommendations", start_time, success=False, error=str(e))
            raise
    
    async def _track_performance(
        self,
        method_name: str,
        start_time: float,
        success: bool = True,
        error: Optional[str] = None,
        metadata: Optional[dict] = None,
    ):
        """Track agent performance with NeMo Agent Toolkit."""
        try:
            from src.services.nemo_agent_toolkit import get_nemo_agent_toolkit
            import time
            toolkit = get_nemo_agent_toolkit()
            
            if toolkit.enabled and toolkit.profiling_enabled:
                latency_ms = (time.time() - start_time) * 1000
                
                from src.services.nemo_agent_toolkit import AgentMetric
                metric = AgentMetric(
                    agent_name="ADVISOR",
                    method_name=method_name,
                    timestamp=datetime.utcnow(),
                    latency_ms=latency_ms,
                    success=success,
                    error=error,
                    metadata=metadata or {},
                )
                toolkit._record_metric(metric)
        except Exception as e:
            logger.debug(f"Agent Toolkit tracking failed: {e}")
    
    async def _validate_recommendation(
        self,
        recommendation: Recommendation,
        asset_id: str,
        asset_data: dict,
        regulations: list
    ) -> Optional[Recommendation]:
        """Validate recommendation with NeMo Guardrails."""
        try:
            from src.services.nemo_guardrails import get_nemo_guardrails_service
            guardrails = get_nemo_guardrails_service()
            
            # Build response text from recommendation
            response_text = f"""
            Recommendation: {recommendation.recommendation_reason}
            Options: {[opt.name for opt in recommendation.options]}
            Recommended: {recommendation.recommended_option}
            """
            
            # Validate
            result = await guardrails.validate(
                response=response_text,
                context={
                    "asset_id": asset_id,
                    "asset_data": asset_data,
                    "regulations": regulations,
                    "recommendation": recommendation
                },
                agent_type="ADVISOR"
            )
            
            if not result.passed:
                logger.warning(
                    f"Guardrail violations for recommendation {recommendation.id}: "
                    f"{[v.value for v in result.violations]}"
                )
                
                # If safety violation, return None (reject recommendation)
                from src.services.nemo_guardrails import GuardrailViolation
                if any(v == GuardrailViolation.SAFETY for v in result.violations):
                    logger.error(f"Safety violation - rejecting recommendation {recommendation.id}")
                    return None
                
                # For other violations, add warning to recommendation
                if result.safe_fallback:
                    recommendation.recommendation_reason = (
                        f"{recommendation.recommendation_reason}\n\n"
                        f"⚠️ Guardrail Warning: {result.safe_fallback}"
                    )
            
            # Add warnings if any
            if result.warnings:
                recommendation.recommendation_reason += "\n\nWarnings: " + "; ".join(result.warnings)
            
            return recommendation
        except Exception as e:
            logger.warning(f"Guardrails validation failed: {e}, allowing recommendation")
            return recommendation  # Allow if guardrails fail
    
    async def evaluate_options(
        self,
        asset_id: str,
        options: list[dict],
        horizon_years: int = 5,
        discount_rate: float = 0.08,
    ) -> list[Option]:
        """
        Evaluate a set of options with NPV and ROI analysis.
        
        Args:
            asset_id: Asset for context
            options: Options to evaluate
            horizon_years: Analysis horizon
            discount_rate: Discount rate for NPV
            
        Returns:
            Evaluated options with financial analysis
        """
        evaluated = []
        
        for opt in options:
            # Calculate NPV
            upfront = opt.get("upfront_cost", 0)
            annual = opt.get("annual_cost", 0)
            annual_benefit = opt.get("annual_benefit", 0)
            
            npv = -upfront
            for year in range(1, horizon_years + 1):
                net_flow = annual_benefit - annual
                npv += net_flow / ((1 + discount_rate) ** year)
            
            # Calculate ROI
            total_cost = upfront + annual * horizon_years
            total_benefit = annual_benefit * horizon_years
            roi = (total_benefit - total_cost) / total_cost if total_cost > 0 else 0
            
            # Calculate payback
            if annual_benefit > annual:
                payback = upfront / (annual_benefit - annual)
            else:
                payback = None
            
            evaluated.append(Option(
                id=uuid4(),
                name=opt.get("name", "Unnamed"),
                description=opt.get("description", ""),
                category=ActionCategory(opt.get("category", "maintenance")),
                upfront_cost=upfront,
                annual_cost=annual,
                risk_reduction=opt.get("risk_reduction", 0),
                pd_impact_bps=opt.get("pd_impact_bps", 0),
                value_impact=opt.get("value_impact", 0),
                npv_5yr=npv,
                roi_5yr=roi,
                payback_years=payback,
                confidence=opt.get("confidence", 0.8),
            ))
        
        # Sort by NPV
        evaluated.sort(key=lambda o: o.npv_5yr, reverse=True)
        
        return evaluated
    
    async def _generate_climate_adaptation_recommendation(
        self,
        asset_id: str,
        asset_data: dict,
        climate_risk: float,
    ) -> Recommendation:
        """Generate climate adaptation recommendation."""
        
        # Define options
        options = [
            Option(
                id=uuid4(),
                name="Do Nothing",
                description="Continue with current exposure",
                category=ActionCategory.MONITOR,
                upfront_cost=0,
                annual_cost=0,
                risk_reduction=0,
                pd_impact_bps=0,
                value_impact=-asset_data.get("valuation", 0) * 0.05,  # 5% value loss
                npv_5yr=-asset_data.get("valuation", 0) * 0.05 * 3,
                roi_5yr=-1,
                payback_years=None,
                confidence=0.9,
            ),
            Option(
                id=uuid4(),
                name="Physical Adaptation",
                description="Install flood barriers, improve drainage, upgrade HVAC",
                category=ActionCategory.ADAPTATION,
                upfront_cost=500000,
                annual_cost=20000,
                risk_reduction=40,
                pd_impact_bps=-30,
                value_impact=asset_data.get("valuation", 0) * 0.03,
                npv_5yr=200000,
                roi_5yr=0.35,
                payback_years=4.2,
                confidence=0.85,
            ),
            Option(
                id=uuid4(),
                name="Insurance Upgrade",
                description="Comprehensive climate coverage",
                category=ActionCategory.INSURANCE,
                upfront_cost=0,
                annual_cost=150000,
                risk_reduction=20,
                pd_impact_bps=-10,
                value_impact=0,
                npv_5yr=-400000,
                roi_5yr=-0.5,
                payback_years=None,
                confidence=0.95,
            ),
        ]
        
        return Recommendation(
            id=uuid4(),
            trigger=f"Climate risk score {climate_risk:.0f} exceeds threshold",
            asset_id=asset_id,
            current_situation=f"Asset has climate risk score of {climate_risk:.0f}/100, "
                             f"indicating significant exposure to climate hazards.",
            risk_if_no_action=f"Potential 5-10% value decline over 5 years. "
                             f"Increased PD by 30+ bps. Higher insurance costs.",
            options=options,
            recommended_option=str(options[1].id),  # Physical adaptation
            recommendation_reason="Physical adaptation provides positive NPV and reduces "
                                 "long-term risk exposure. Best balance of cost and protection.",
            urgency="medium" if climate_risk < 70 else "high",
            deadline=None,
            created_at=datetime.utcnow(),
        )
    
    async def _generate_maintenance_recommendation(
        self,
        asset_id: str,
        asset_data: dict,
        physical_risk: float,
    ) -> Recommendation:
        """Generate maintenance recommendation."""
        
        options = [
            Option(
                id=uuid4(),
                name="Do Nothing",
                description="Defer maintenance",
                category=ActionCategory.MONITOR,
                upfront_cost=0,
                annual_cost=0,
                risk_reduction=0,
                pd_impact_bps=45,  # Risk increases
                value_impact=-asset_data.get("valuation", 0) * 0.08,
                npv_5yr=-1200000,
                roi_5yr=-1,
                payback_years=None,
                confidence=0.9,
            ),
            Option(
                id=uuid4(),
                name="Enhanced Monitoring",
                description="Install sensors, quarterly inspections",
                category=ActionCategory.MAINTENANCE,
                upfront_cost=50000,
                annual_cost=30000,
                risk_reduction=15,
                pd_impact_bps=-5,
                value_impact=0,
                npv_5yr=-100000,
                roi_5yr=-0.4,
                payback_years=None,
                confidence=0.85,
            ),
            Option(
                id=uuid4(),
                name="Repair Now",
                description="Address structural issues immediately",
                category=ActionCategory.MAINTENANCE,
                upfront_cost=450000,
                annual_cost=10000,
                risk_reduction=50,
                pd_impact_bps=-30,
                value_impact=asset_data.get("valuation", 0) * 0.05,
                npv_5yr=400000,
                roi_5yr=0.75,
                payback_years=2.8,
                confidence=0.9,
            ),
        ]
        
        return Recommendation(
            id=uuid4(),
            trigger=f"Physical risk score {physical_risk:.0f} indicates maintenance need",
            asset_id=asset_id,
            current_situation=f"Asset physical condition score of {physical_risk:.0f}/100 "
                             f"indicates deterioration requiring attention.",
            risk_if_no_action="Accelerating deterioration, potential structural issues, "
                             "higher repair costs if deferred, liability exposure.",
            options=options,
            recommended_option=str(options[2].id),  # Repair now
            recommendation_reason="Immediate repair has highest NPV due to value preservation "
                                 "and avoided future costs. Eliminates risk of major failure.",
            urgency="high" if physical_risk > 60 else "medium",
            deadline=None,
            created_at=datetime.utcnow(),
        )
    
    async def _generate_resilience_recommendation(
        self,
        asset_id: str,
        asset_data: dict,
        network_risk: float,
    ) -> Recommendation:
        """Generate infrastructure resilience recommendation."""
        
        options = [
            Option(
                id=uuid4(),
                name="Backup Power",
                description="Install generator and UPS systems",
                category=ActionCategory.ADAPTATION,
                upfront_cost=200000,
                annual_cost=15000,
                risk_reduction=30,
                pd_impact_bps=-15,
                value_impact=asset_data.get("valuation", 0) * 0.02,
                npv_5yr=150000,
                roi_5yr=0.6,
                payback_years=3.5,
                confidence=0.9,
            ),
            Option(
                id=uuid4(),
                name="Diversify Suppliers",
                description="Reduce single-point dependencies",
                category=ActionCategory.ADAPTATION,
                upfront_cost=50000,
                annual_cost=25000,
                risk_reduction=25,
                pd_impact_bps=-10,
                value_impact=0,
                npv_5yr=50000,
                roi_5yr=0.3,
                payback_years=4.0,
                confidence=0.8,
            ),
        ]
        
        return Recommendation(
            id=uuid4(),
            trigger=f"Network risk score {network_risk:.0f} indicates dependency vulnerability",
            asset_id=asset_id,
            current_situation=f"Asset has high dependency on infrastructure with "
                             f"network risk score of {network_risk:.0f}/100.",
            risk_if_no_action="Vulnerability to cascade failures from infrastructure disruptions. "
                             "Hidden exposure not reflected in traditional risk models.",
            options=options,
            recommended_option=str(options[0].id),  # Backup power
            recommendation_reason="Backup power addresses the most critical dependency "
                                 "with best ROI and proven effectiveness.",
            urgency="medium",
            deadline=None,
            created_at=datetime.utcnow(),
        )
    
    async def _generate_alert_response_recommendation(
        self,
        asset_id: str,
        asset_data: dict,
        alert: dict,
    ) -> Optional[Recommendation]:
        """Generate recommendation in response to an alert."""
        
        alert_type = alert.get("type", "")
        
        if "hurricane" in alert_type.lower() or "flood" in alert_type.lower():
            options = [
                Option(
                    id=uuid4(),
                    name="Emergency Protocols",
                    description="Activate emergency response, protect valuables",
                    category=ActionCategory.IMMEDIATE,
                    upfront_cost=10000,
                    annual_cost=0,
                    risk_reduction=20,
                    pd_impact_bps=0,
                    value_impact=0,
                    npv_5yr=50000,  # Avoided losses
                    roi_5yr=4.0,
                    payback_years=0.1,
                    confidence=0.95,
                ),
            ]
            
            return Recommendation(
                id=uuid4(),
                trigger=alert.get("title", "Weather alert"),
                asset_id=asset_id,
                current_situation=alert.get("message", ""),
                risk_if_no_action="Potential significant damage and losses",
                options=options,
                recommended_option=str(options[0].id),
                recommendation_reason="Immediate action required to minimize potential losses",
                urgency="immediate",
                deadline=datetime.utcnow(),
                created_at=datetime.utcnow(),
            )
        
        return None


# Global agent instance
advisor_agent = AdvisorAgent()
