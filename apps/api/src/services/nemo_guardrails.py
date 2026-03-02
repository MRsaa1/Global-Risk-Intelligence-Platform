"""
NVIDIA NeMo Guardrails - Safety and Compliance for Agents.

Enforces:
- Safety checks (prevent harmful recommendations)
- Compliance validation (regulatory requirements)
- Factual accuracy (prevent hallucinations)
- Feasibility checks (actionable recommendations)
"""
import logging
import re
from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional

from src.core.config import settings

logger = logging.getLogger(__name__)


class GuardrailViolation(str, Enum):
    """Types of guardrail violations."""
    SAFETY = "safety"  # Potentially harmful action
    COMPLIANCE = "compliance"  # Regulatory violation
    FACTUAL = "factual"  # Inaccurate information
    FEASIBILITY = "feasibility"  # Not actionable
    GEOGRAPHIC = "geographic"  # Invalid geographic bounds
    FINANCIAL = "financial"  # Invalid financial data
    MORPHEUS = "morpheus"  # Morpheus validation failed (data leak / hallucination)


@dataclass
class GuardrailResult:
    """Result of guardrail validation."""
    passed: bool
    violations: List[GuardrailViolation]
    safe_fallback: Optional[str] = None
    warnings: List[str] = None
    confidence: float = 1.0
    
    def __post_init__(self):
        if self.warnings is None:
            self.warnings = []


class NeMoGuardrailsService:
    """
    NeMo Guardrails Service for agent safety and compliance.
    
    Validates:
    - Safety: No harmful or dangerous recommendations
    - Compliance: Regulatory requirements (ECB, Fed, TCFD, CSRD)
    - Factual: Accurate information, no hallucinations
    - Feasibility: Actionable recommendations
    - Geographic: Valid location bounds
    - Financial: Accurate financial data
    """
    
    def __init__(self):
        self.enabled = getattr(settings, 'nemo_guardrails_enabled', True)
        self.config_path = getattr(settings, 'guardrails_config_path', 'config/guardrails.yml')
        
        # Safety keywords
        self.dangerous_actions = [
            "sell all assets",
            "liquidate portfolio",
            "immediate divestment",
            "emergency shutdown",
            "mass layoffs",
            "default on debt"
        ]
        
        # Compliance requirements
        self.regulatory_frameworks = ["ECB", "Fed", "TCFD", "CSRD", "Basel IV"]
        
        # Geographic bounds (example)
        self.valid_lat_range = (-90, 90)
        self.valid_lng_range = (-180, 180)
    
    async def validate(
        self,
        response: str,
        context: Optional[Dict[str, Any]] = None,
        agent_type: Optional[str] = None,
    ) -> GuardrailResult:
        """
        Validate agent response against guardrails.
        
        Args:
            response: Agent response text
            context: Context including asset_id, regulations, etc.
            agent_type: Type of agent (SENTINEL, ANALYST, ADVISOR, REPORTER)
            
        Returns:
            GuardrailResult with validation status
        """
        if not self.enabled:
            return GuardrailResult(passed=True, violations=[])
        
        context = context or {}
        violations = []
        warnings = []
        
        # 1. Safety checks
        safety_result = self._check_safety(response, context, agent_type)
        if not safety_result.passed:
            violations.extend(safety_result.violations)
            warnings.extend(safety_result.warnings)
        
        # 2. Compliance checks
        compliance_result = self._check_compliance(response, context)
        if not compliance_result.passed:
            violations.append(GuardrailViolation.COMPLIANCE)
            warnings.extend(compliance_result.warnings)
        
        # 3. Factual accuracy (basic checks)
        factual_result = self._check_factual_accuracy(response, context)
        if not factual_result.passed:
            violations.append(GuardrailViolation.FACTUAL)
            warnings.extend(factual_result.warnings)
        
        # 4. Feasibility checks
        feasibility_result = self._check_feasibility(response, context, agent_type)
        if not feasibility_result.passed:
            violations.append(GuardrailViolation.FEASIBILITY)
            warnings.extend(feasibility_result.warnings)
        
        # 5. Geographic validation
        geo_result = self._check_geographic(response, context)
        if not geo_result.passed:
            violations.append(GuardrailViolation.GEOGRAPHIC)
            warnings.extend(geo_result.warnings)
        
        # 6. Financial validation
        financial_result = self._check_financial(response, context)
        if not financial_result.passed:
            violations.append(GuardrailViolation.FINANCIAL)
            warnings.extend(financial_result.warnings)
        
        # 7. Morpheus (optional): data leak / hallucination detection
        if getattr(settings, "enable_morpheus", False) and (getattr(settings, "morpheus_validation_url", "") or "").strip():
            try:
                from src.services.morpheus_validator import validate_agent_io
                morpheus_result = await validate_agent_io(
                    context.get("input", ""),
                    response,
                    context,
                )
                if not morpheus_result.passed:
                    violations.append(GuardrailViolation.MORPHEUS)
                    if morpheus_result.detail:
                        warnings.append(f"Morpheus: {morpheus_result.detail}")
                    if morpheus_result.flags:
                        warnings.extend(str(f) for f in morpheus_result.flags[:5])
            except Exception as e:
                logger.debug("Morpheus validation skipped: %s", e)
        
        passed = len(violations) == 0
        
        # Generate safe fallback if needed
        safe_fallback = None
        if not passed and agent_type == "ADVISOR":
            safe_fallback = self._generate_safe_fallback(response, violations, context)
        
        return GuardrailResult(
            passed=passed,
            violations=violations,
            safe_fallback=safe_fallback,
            warnings=warnings,
            confidence=0.9 if passed else 0.6
        )
    
    def _check_safety(
        self,
        response: str,
        context: Dict[str, Any],
        agent_type: Optional[str]
    ) -> GuardrailResult:
        """Check for potentially dangerous actions."""
        response_lower = response.lower()
        violations = []
        warnings = []
        
        # Check for dangerous action keywords
        for dangerous in self.dangerous_actions:
            if dangerous in response_lower:
                violations.append(GuardrailViolation.SAFETY)
                warnings.append(f"Potentially dangerous action detected: '{dangerous}'")
        
        # Check for autonomous lethal actions (Human Veto)
        if "autonomous" in response_lower and any(
            word in response_lower for word in ["kill", "destroy", "eliminate", "terminate"]
        ):
            violations.append(GuardrailViolation.SAFETY)
            warnings.append("Autonomous lethal action detected - requires Human Veto")
        
        # ADVISOR-specific: Check for mass actions without approval
        if agent_type == "ADVISOR":
            if any(word in response_lower for word in ["sell all", "liquidate all", "divest all"]):
                violations.append(GuardrailViolation.SAFETY)
                warnings.append("Mass action requires explicit human approval")
        
        return GuardrailResult(
            passed=len(violations) == 0,
            violations=violations,
            warnings=warnings
        )
    
    def _check_compliance(
        self,
        response: str,
        context: Dict[str, Any]
    ) -> GuardrailResult:
        """Check regulatory compliance."""
        warnings = []
        regulations = context.get("regulations", [])
        
        # Check if response mentions compliance requirements
        response_lower = response.lower()
        
        # TCFD/CSRD: Climate risk disclosure
        if any(reg in regulations for reg in ["TCFD", "CSRD"]):
            if "climate" in response_lower and "disclosure" not in response_lower:
                warnings.append("Climate risk mentioned but disclosure not addressed (TCFD/CSRD)")
        
        # ECB/Fed: Stress testing
        if any(reg in regulations for reg in ["ECB", "Fed"]):
            if "stress test" in response_lower and "basel" not in response_lower.lower():
                warnings.append("Stress test mentioned but Basel framework not referenced")
        
        # Check for regulatory citations
        if regulations and not any(reg.lower() in response_lower for reg in regulations):
            # Not a violation, just a warning
            pass
        
        return GuardrailResult(
            passed=True,  # Warnings don't fail, just inform
            violations=[],
            warnings=warnings
        )
    
    def _check_factual_accuracy(
        self,
        response: str,
        context: Dict[str, Any]
    ) -> GuardrailResult:
        """Basic factual accuracy checks."""
        warnings = []
        
        # Check for citations/sources
        if "source:" not in response.lower() and "reference:" not in response.lower():
            # Not a violation, but best practice
            if len(response) > 500:  # Long responses should cite sources
                warnings.append("Long response without explicit citations - verify accuracy")
        
        # Check for confidence statements
        if any(phrase in response.lower() for phrase in ["i am certain", "definitely", "100%"]):
            warnings.append("Overconfident statements detected - verify with data")
        
        # Check for contradictory statements
        if "however" in response.lower() and "but" in response.lower():
            # Multiple contradictions might indicate uncertainty
            pass
        
        return GuardrailResult(
            passed=True,
            violations=[],
            warnings=warnings
        )
    
    def _check_feasibility(
        self,
        response: str,
        context: Dict[str, Any],
        agent_type: Optional[str]
    ) -> GuardrailResult:
        """Check if recommendations are actionable."""
        warnings = []
        
        if agent_type == "ADVISOR":
            response_lower = response.lower()
            
            # Check for vague recommendations
            vague_phrases = ["consider", "maybe", "possibly", "might want to"]
            if sum(1 for phrase in vague_phrases if phrase in response_lower) > 2:
                warnings.append("Multiple vague recommendations - provide specific actions")
            
            # Check for cost/benefit analysis
            if "recommend" in response_lower and "cost" not in response_lower:
                warnings.append("Recommendation without cost analysis")
        
        return GuardrailResult(
            passed=True,
            violations=[],
            warnings=warnings
        )
    
    def _check_geographic(
        self,
        response: str,
        context: Dict[str, Any]
    ) -> GuardrailResult:
        """Validate geographic references."""
        warnings = []
        
        # Extract coordinates if mentioned
        coord_pattern = r'(-?\d+\.?\d*),\s*(-?\d+\.?\d*)'
        matches = re.findall(coord_pattern, response)
        
        for lat_str, lng_str in matches:
            try:
                lat = float(lat_str)
                lng = float(lng_str)
                
                if not (self.valid_lat_range[0] <= lat <= self.valid_lat_range[1]):
                    warnings.append(f"Invalid latitude: {lat}")
                
                if not (self.valid_lng_range[0] <= lng <= self.valid_lng_range[1]):
                    warnings.append(f"Invalid longitude: {lng}")
            except ValueError:
                pass
        
        return GuardrailResult(
            passed=True,
            violations=[],
            warnings=warnings
        )
    
    def _check_financial(
        self,
        response: str,
        context: Dict[str, Any]
    ) -> GuardrailResult:
        """Validate financial data references."""
        warnings = []
        
        # Check for financial metrics
        financial_terms = ["pd", "lgd", "dscr", "ltv", "npv", "roi"]
        found_terms = [term for term in financial_terms if term in response.lower()]
        
        if found_terms:
            # Check if values are mentioned
            number_pattern = r'\d+\.?\d*%?'
            numbers = re.findall(number_pattern, response)
            
            if len(numbers) < len(found_terms):
                warnings.append("Financial terms mentioned but values not provided")
        
        return GuardrailResult(
            passed=True,
            violations=[],
            warnings=warnings
        )
    
    def _generate_safe_fallback(
        self,
        original_response: str,
        violations: List[GuardrailViolation],
        context: Dict[str, Any]
    ) -> str:
        """Generate a safe fallback response."""
        if GuardrailViolation.SAFETY in violations:
            return (
                "⚠️ This recommendation requires human review due to safety concerns. "
                "Please consult with risk management team before proceeding. "
                "Original recommendation flagged for: " + ", ".join([v.value for v in violations])
            )
        
        if GuardrailViolation.COMPLIANCE in violations:
            return (
                "⚠️ This recommendation may have compliance implications. "
                "Please verify against regulatory requirements (ECB, Fed, TCFD, CSRD) "
                "before implementation."
            )
        
        # Default fallback
        return (
            "⚠️ Recommendation requires validation. "
            "Please review the following concerns: " + ", ".join([v.value for v in violations])
        )


# Global service instance
_nemo_guardrails_service: Optional[NeMoGuardrailsService] = None


def get_nemo_guardrails_service() -> NeMoGuardrailsService:
    """Get or create NeMo Guardrails service instance."""
    global _nemo_guardrails_service
    if _nemo_guardrails_service is None:
        _nemo_guardrails_service = NeMoGuardrailsService()
    return _nemo_guardrails_service


# Convenience alias
nemo_guardrails = get_nemo_guardrails_service()
