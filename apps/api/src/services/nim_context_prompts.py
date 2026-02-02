"""
NIM Context Prompts for Universal Stress Testing
=================================================

Implements the Universal Context Prompt Framework from methodology Part 4.2.

Features:
- Universal context prompt template
- Sector-specific formula injection
- Historical context matching
- Action plan generation prompts
- Report narrative generation

Reference: Universal Stress Testing Methodology v1.0
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)


class SectorType(str, Enum):
    """Sector types."""
    INSURANCE = "insurance"
    REAL_ESTATE = "real_estate"
    FINANCIAL = "financial"
    ENTERPRISE = "enterprise"
    DEFENSE = "defense"


# =============================================================================
# SECTOR-SPECIFIC FORMULAS (for injection into prompts)
# =============================================================================

SECTOR_FORMULAS = {
    SectorType.INSURANCE: """
INSURANCE SECTOR FORMULAS:
  EAD: Sum of policy limits by line of business
  LGD: Historical loss ratio × stress multiplier
  PD:  Event probability (CAT models, pandemic curves)
  CF:  Reinsurance cascade, investment correlation
  DF:  Claims development pattern (tail)
  
  Key Metrics:
    Solvency_Ratio = (Available_Capital - Stressed_Losses) / SCR
    Claims_Coverage = (Reserves + Reinsurance) / Expected_Claims
    Aggregate_Exposure = Σ(Policy_Limits) × Correlation_Factor
    VaR = μ + σ × Z(confidence) × √(holding_period)
""",
    SectorType.REAL_ESTATE: """
REAL ESTATE SECTOR FORMULAS:
  EAD: Property values + construction in progress
  LGD: LTV ratio × market decline percentage
  PD:  Default probability (tenant/borrower)
  CF:  Financing cascade, supply chain
  DF:  Project timeline extension
  
  Key Metrics:
    Cash_Runway = (Cash + Facilities) / Burn_Rate
    Occupancy_Stress = Current_Occupancy × (1 - Demand_Shock)
    DSCR = NOI_Stressed / Debt_Service
    LTV_Stress = Debt / (Property_Value × (1 - Market_Decline))
""",
    SectorType.FINANCIAL: """
FINANCIAL INSTITUTIONS FORMULAS:
  EAD: Loan book + trading positions + derivatives
  LGD: (1 - Recovery_Rate) × Collateral_Haircut
  PD:  PD migration matrix under stress
  CF:  Interbank exposure, counterparty chains
  DF:  Liquidity horizon (LCR buckets)
  
  Key Metrics:
    NPL_Ratio = (Defaults × LGD) / Total_Loans
    LCR = HQLA / Net_Outflows_30d
    CET1_Impact = -Losses / RWA
    VaR_Trading = Σ(Position × Volatility × Z × √t)
""",
    SectorType.ENTERPRISE: """
ENTERPRISE SECTOR FORMULAS:
  EAD: Revenue exposure + asset base + inventory
  LGD: Operating leverage × revenue decline
  PD:  Supply chain failure probability
  CF:  Customer/supplier network effects
  DF:  Business interruption duration
  
  Key Metrics:
    Cash_Runway = Cash / ((Revenue × (1-Decline)) - Fixed_Costs)
    Supply_Buffer = Inventory_Days / Critical_Lead_Time
    Operations_Rate = Available_Workforce / Required_Workforce
    Recovery_Time = Σ(Process_Recovery) + Dependencies
""",
    SectorType.DEFENSE: """
DEFENSE & SECURITY FORMULAS:
  EAD: Program values + capability gaps
  LGD: Mission impact severity
  PD:  Threat probability (intelligence-based)
  CF:  Alliance dependencies, infrastructure
  DF:  Surge capacity timeline
  
  Key Metrics:
    Inventory_Coverage = Strategic_Reserves / Consumption_Rate
    Readiness_Index = Operational_Units / Required_Units
    SPOF_Score = 1 - (Redundant_Paths / Total_Paths)
    Capability_Gap = Required_Capability - Available_After_Stress
"""
}


# =============================================================================
# UNIVERSAL CONTEXT PROMPT TEMPLATE
# =============================================================================

UNIVERSAL_CONTEXT_PROMPT = """
You are a specialized stress testing AI. Analyze the following scenario and compute 
comprehensive risk metrics applicable to the {sector} sector.

## SCENARIO CONTEXT
{scenario_description}

## SECTOR PROFILE
- Sector: {sector}
- Criticality Level: {criticality}
- Response Timeline: {timeline}
- Target Risk Reduction: {risk_reduction_target}%

## EXPOSURE DATA
{exposure_summary}

## CALCULATION METHODOLOGY
Master Loss Equation: L = Σ [EAD × LGD × PD × (1 + CF)] × DF

{sector_formulas}

## YOUR TASKS

1. **PARAMETER EXTRACTION**
   Extract and validate all parameters needed for stress calculations:
   - Event probability (PD)
   - Severity multiplier (LGD factor)
   - Duration estimates (DF)
   - Cascade factors (CF)
   
2. **CALCULATION EXECUTION**
   Apply the sector-specific formulas above and compute:
   - Expected Loss (mean)
   - VaR at 95% and 99% confidence
   - CVaR/Expected Shortfall at 99%
   - Recovery timeline (RTO critical, RTO full)
   
3. **CROSS-VALIDATION**
   Compare with historical events:
   {historical_context}
   
4. **ACTION PLAN GENERATION**
   Generate phase-specific actions for:
   - Phase 1 (Emergency): {phase1_timeline}
   - Phase 2 (Stabilization): {phase2_timeline}
   - Phase 3 (Recovery): {phase3_timeline}
   
5. **REGULATORY MAPPING**
   Ensure compliance with: {regulatory_frameworks}

## OUTPUT FORMAT
Provide structured JSON output following the StressTestResult schema with:
- executive_summary
- loss_distribution (mean, median, var_95, var_99, cvar_99)
- timeline_analysis (rto_critical, rto_full, phases)
- cascade_analysis (amplification_factor, critical_path)
- action_plan (phase_1, phase_2, phase_3)
"""


# =============================================================================
# PROMPT BUILDERS
# =============================================================================

@dataclass
class PromptContext:
    """Context for building NIM prompts."""
    sector: str
    scenario_description: str
    criticality: str = "high"
    timeline: str = "72h"
    risk_reduction_target: float = 25.0
    exposure_summary: str = ""
    historical_context: str = "No historical events provided"
    regulatory_frameworks: str = "EBA, TCFD, NGFS"
    phase1_timeline: str = "0-6 hours"
    phase2_timeline: str = "6-72 hours"
    phase3_timeline: str = "72h - 30 days"


def build_universal_context_prompt(context: PromptContext) -> str:
    """
    Build the universal context prompt for NIM.
    
    Args:
        context: PromptContext with all required fields
    
    Returns:
        Formatted prompt string
    """
    try:
        sector_enum = SectorType(context.sector.lower())
    except ValueError:
        sector_enum = SectorType.ENTERPRISE
    
    sector_formulas = SECTOR_FORMULAS.get(sector_enum, SECTOR_FORMULAS[SectorType.ENTERPRISE])
    
    return UNIVERSAL_CONTEXT_PROMPT.format(
        sector=context.sector,
        scenario_description=context.scenario_description,
        criticality=context.criticality,
        timeline=context.timeline,
        risk_reduction_target=context.risk_reduction_target,
        exposure_summary=context.exposure_summary or "Total exposure data not provided",
        sector_formulas=sector_formulas,
        historical_context=context.historical_context,
        phase1_timeline=context.phase1_timeline,
        phase2_timeline=context.phase2_timeline,
        phase3_timeline=context.phase3_timeline,
        regulatory_frameworks=context.regulatory_frameworks
    )


# =============================================================================
# SPECIALIZED PROMPTS
# =============================================================================

EXECUTIVE_SUMMARY_PROMPT = """
Generate a concise executive summary for the following stress test results.

## STRESS TEST RESULTS
- Scenario: {scenario_name}
- Sector: {sector}
- Expected Loss: €{expected_loss_m}M
- VaR (99%): €{var_99_m}M
- Recovery Time: {recovery_months} months
- Affected Entities: {affected_entities}

## REQUIREMENTS
1. Start with a single headline sentence capturing the key risk
2. State severity rating (0-1 scale) with confidence level
3. Indicate if immediate actions are required
4. Mention regulatory disclosure implications

## FORMAT
Return a JSON object with:
{{
  "headline": "string",
  "severity_rating": float,
  "confidence_level": float,
  "immediate_actions_required": boolean,
  "regulatory_disclosure_required": boolean,
  "key_insights": ["string", "string", "string"]
}}
"""


ACTION_PLAN_PROMPT = """
Generate a detailed action plan for the following stress scenario.

## SCENARIO
- Event: {event_type}
- Severity: {severity}
- Sector: {sector}
- Expected Loss: €{expected_loss_m}M
- Timeline: {timeline}

## REQUIREMENTS
Generate actions for three phases:
1. **Phase 1 (Emergency)**: Immediate actions (0-6 hours)
2. **Phase 2 (Stabilization)**: Short-term actions (6-72 hours)
3. **Phase 3 (Recovery)**: Medium-term actions (72h - 30 days)

Each action should include:
- Description
- Owner/responsible party
- Required resources
- Success metric
- Expected risk reduction (0-1)

## FORMAT
Return a JSON object following the ActionPlan schema.
"""


HISTORICAL_COMPARISON_PROMPT = """
Compare the current stress scenario with historical events.

## CURRENT SCENARIO
- Event Type: {event_type}
- Location: {location}
- Severity: {severity}
- Expected Loss: €{expected_loss_m}M

## HISTORICAL EVENTS DATABASE
{historical_events_json}

## REQUIREMENTS
1. Identify the 3 most similar historical events
2. Calculate similarity scores (0-100%)
3. Extract lessons learned from each
4. Identify calibration factors for the current scenario

## FORMAT
Return a JSON object with:
{{
  "similar_events": [
    {{
      "name": "string",
      "date": "YYYY-MM-DD",
      "similarity_score": float,
      "actual_loss": float,
      "key_lessons": ["string"]
    }}
  ],
  "calibration_recommendations": ["string"],
  "confidence_adjustment": float
}}
"""


REGULATORY_MAPPING_PROMPT = """
Map the stress test results to regulatory requirements.

## STRESS TEST SUMMARY
- Sector: {sector}
- Scenario: {scenario_type}
- Expected Loss: €{expected_loss_m}M
- Capital Impact: {capital_impact_bps} bps
- Recovery Time: {recovery_months} months

## APPLICABLE FRAMEWORKS
{regulatory_frameworks}

## REQUIREMENTS
For each applicable framework, assess:
1. Alignment status (aligned/partial/not aligned)
2. Capital impact in CET1 basis points
3. Disclosure readiness
4. Gap analysis if not fully aligned

## FORMAT
Return a JSON object mapping each framework to compliance status.
"""


NARRATIVE_REPORT_PROMPT = """
Generate a professional narrative report for the stress test results.

## STRESS TEST DATA
{stress_test_json}

## REQUIREMENTS
Generate a comprehensive report with the following sections:
1. Executive Summary (3-4 sentences)
2. Scenario Description (2-3 paragraphs)
3. Key Findings (bullet points)
4. Financial Impact Analysis (1-2 paragraphs)
5. Recovery Timeline (1 paragraph)
6. Risk Mitigation Recommendations (bullet points)
7. Conclusion (2-3 sentences)

## STYLE GUIDELINES
- Professional, clear, and concise
- Use specific numbers and percentages
- Avoid jargon; explain technical terms
- Focus on actionable insights

## FORMAT
Return plain text formatted as a professional report.
"""


# =============================================================================
# PROMPT FACTORY
# =============================================================================

def build_executive_summary_prompt(
    scenario_name: str,
    sector: str,
    expected_loss_m: float,
    var_99_m: float,
    recovery_months: int,
    affected_entities: int
) -> str:
    """Build executive summary generation prompt."""
    return EXECUTIVE_SUMMARY_PROMPT.format(
        scenario_name=scenario_name,
        sector=sector,
        expected_loss_m=expected_loss_m,
        var_99_m=var_99_m,
        recovery_months=recovery_months,
        affected_entities=affected_entities
    )


def build_action_plan_prompt(
    event_type: str,
    severity: float,
    sector: str,
    expected_loss_m: float,
    timeline: str = "72h"
) -> str:
    """Build action plan generation prompt."""
    return ACTION_PLAN_PROMPT.format(
        event_type=event_type,
        severity=severity,
        sector=sector,
        expected_loss_m=expected_loss_m,
        timeline=timeline
    )


def build_historical_comparison_prompt(
    event_type: str,
    location: str,
    severity: float,
    expected_loss_m: float,
    historical_events: List[Dict[str, Any]]
) -> str:
    """Build historical comparison prompt."""
    return HISTORICAL_COMPARISON_PROMPT.format(
        event_type=event_type,
        location=location,
        severity=severity,
        expected_loss_m=expected_loss_m,
        historical_events_json=json.dumps(historical_events, indent=2)
    )


def build_regulatory_mapping_prompt(
    sector: str,
    scenario_type: str,
    expected_loss_m: float,
    capital_impact_bps: int,
    recovery_months: int,
    regulatory_frameworks: List[str]
) -> str:
    """Build regulatory mapping prompt."""
    return REGULATORY_MAPPING_PROMPT.format(
        sector=sector,
        scenario_type=scenario_type,
        expected_loss_m=expected_loss_m,
        capital_impact_bps=capital_impact_bps,
        recovery_months=recovery_months,
        regulatory_frameworks=", ".join(regulatory_frameworks)
    )


def build_narrative_report_prompt(stress_test_data: Dict[str, Any]) -> str:
    """Build narrative report generation prompt."""
    return NARRATIVE_REPORT_PROMPT.format(
        stress_test_json=json.dumps(stress_test_data, indent=2)
    )


# =============================================================================
# NIM INTEGRATION HELPERS
# =============================================================================

async def call_nim_with_prompt(
    prompt: str,
    model: str = "nvidia/llama-3.1-nemotron-70b-instruct",
    temperature: float = 0.3,
    max_tokens: int = 2000
) -> Optional[str]:
    """
    Call NIM with the given prompt.
    
    This is a placeholder that should be integrated with the actual
    nvidia_llm.py service.
    
    Args:
        prompt: The prompt to send
        model: NIM model to use
        temperature: Generation temperature
        max_tokens: Maximum tokens to generate
    
    Returns:
        Generated response or None if failed
    """
    try:
        from src.services.nvidia_llm import nvidia_llm_service
        
        response = await nvidia_llm_service.generate(
            prompt=prompt,
            model=model,
            temperature=temperature,
            max_tokens=max_tokens
        )
        return response
        
    except ImportError:
        logger.warning("nvidia_llm_service not available")
        return None
    except Exception as e:
        logger.error(f"NIM call failed: {e}")
        return None


def parse_json_response(response: str) -> Optional[Dict[str, Any]]:
    """
    Parse JSON from NIM response.
    
    Handles cases where response includes markdown code blocks.
    
    Args:
        response: Raw response string
    
    Returns:
        Parsed JSON dict or None
    """
    if not response:
        return None
    
    # Try to extract JSON from markdown code block
    if "```json" in response:
        start = response.find("```json") + 7
        end = response.find("```", start)
        if end > start:
            response = response[start:end].strip()
    elif "```" in response:
        start = response.find("```") + 3
        end = response.find("```", start)
        if end > start:
            response = response[start:end].strip()
    
    try:
        return json.loads(response)
    except json.JSONDecodeError as e:
        logger.warning(f"Failed to parse JSON response: {e}")
        return None


# =============================================================================
# FULL STRESS TEST ANALYSIS WITH NIM
# =============================================================================

async def run_nim_stress_analysis(
    scenario_description: str,
    sector: str,
    exposure_data: Dict[str, Any],
    severity: float,
    historical_events: Optional[List[Dict]] = None
) -> Dict[str, Any]:
    """
    Run complete stress test analysis using NIM.
    
    Args:
        scenario_description: Natural language scenario description
        sector: Target sector
        exposure_data: Exposure data dict
        severity: Severity level (0-1)
        historical_events: Optional list of historical events for comparison
    
    Returns:
        Dict with analysis results including executive summary, 
        action plan, and regulatory mapping
    """
    results = {
        "nim_analysis": True,
        "executive_summary": None,
        "action_plan": None,
        "historical_comparison": None,
        "regulatory_mapping": None,
        "narrative_report": None
    }
    
    # Build context
    context = PromptContext(
        sector=sector,
        scenario_description=scenario_description,
        exposure_summary=json.dumps(exposure_data, indent=2) if exposure_data else "",
        historical_context=json.dumps(historical_events[:3], indent=2) if historical_events else "None available"
    )
    
    # Generate universal analysis
    universal_prompt = build_universal_context_prompt(context)
    universal_response = await call_nim_with_prompt(universal_prompt)
    
    if universal_response:
        parsed = parse_json_response(universal_response)
        if parsed:
            results["nim_analysis_raw"] = parsed
    
    # Generate executive summary
    if exposure_data.get("expected_loss"):
        summary_prompt = build_executive_summary_prompt(
            scenario_name=scenario_description[:100],
            sector=sector,
            expected_loss_m=exposure_data.get("expected_loss", 0) / 1_000_000,
            var_99_m=exposure_data.get("var_99", 0) / 1_000_000,
            recovery_months=exposure_data.get("recovery_months", 12),
            affected_entities=exposure_data.get("affected_entities", 0)
        )
        summary_response = await call_nim_with_prompt(summary_prompt)
        if summary_response:
            results["executive_summary"] = parse_json_response(summary_response)
    
    return results
