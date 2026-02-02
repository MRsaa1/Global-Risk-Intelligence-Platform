"""
REPORTER Agent - Automated Report Generation.

Layer 4: Autonomous Agents.
Responsibilities:
- Generate executive summaries (NVIDIA LLM when available)
- Produce PDF reports (stress tests, TCFD/NGFS-style)
- Optional: scheduled reports, multi-stakeholder formats

Enhanced with NeMo Agent Toolkit for performance tracking.
"""
import logging
import time
from typing import Any, Dict, List, Optional

from src.services.pdf_report import generate_pdf_report, HAS_PDF

logger = logging.getLogger(__name__)


class ReporterAgent:
    """
    REPORTER Agent - Automated report generation.
    
    Orchestrates:
    - NVIDIA LLM (reporter_summary) for executive summaries when use_llm=True
    - pdf_report service for PDF generation
    """

    async def generate_stress_test_report(
        self,
        stress_test: Dict[str, Any],
        zones: List[Dict[str, Any]],
        actions: Optional[List[Dict[str, Any]]] = None,
        *,
        use_llm: bool = True,
    ) -> bytes:
        """
        Generate a PDF stress test report.
        
        When use_llm=True and executive_summary is not already in stress_test,
        tries to generate one via NVIDIA LLM (reporter_summary). On LLM failure,
        falls back to the default summary from pdf_report.
        
        Args:
            stress_test: Dict with name, region_name/city, test_type, severity, etc.
            zones: Risk zones
            actions: Optional recommended actions
            use_llm: If True, try LLM for executive summary when none provided
            
        Returns:
            PDF file as bytes
        """
        start_time = time.time()
        
        try:
            if not HAS_PDF:
                raise ImportError(
                    "PDF generation is not available. Install reportlab (recommended for macOS) "
                    "or WeasyPrint + system libs (cairo, pango)."
                )
            executive_summary = stress_test.get("executive_summary")
            if use_llm and not executive_summary:
                try:
                    from src.services.nvidia_llm import llm_service
                    data = {
                        "city": stress_test.get("region_name", stress_test.get("city", "N/A")),
                        "scenario": stress_test.get("scenario_name", stress_test.get("test_type", "Custom")),
                        "severity_pct": int((stress_test.get("severity") or 0.5) * 100),
                        "zones_count": len(zones),
                        "actions_count": len(actions or []),
                    }
                    if stress_test.get("entity_name"):
                        data["entity_name"] = stress_test["entity_name"]
                    if stress_test.get("entity_type"):
                        data["entity_type"] = stress_test["entity_type"]
                    executive_summary = await llm_service.reporter_summary(
                        "executive_summary", data, "executive"
                    )
                except Exception as e:
                    logger.warning("REPORTER: LLM summary failed, using default: %s", e)
            
            pdf_bytes = generate_pdf_report(
                stress_test=stress_test,
                zones=zones,
                actions=actions,
                executive_summary=executive_summary,
            )
            
            # Track performance
            await self._track_performance(
                "generate_stress_test_report",
                start_time,
                success=True,
                metadata={
                    "zones_count": len(zones),
                    "use_llm": use_llm,
                    "pdf_size_bytes": len(pdf_bytes),
                }
            )
            
            return pdf_bytes
        except Exception as e:
            await self._track_performance("generate_stress_test_report", start_time, success=False, error=str(e))
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
            from datetime import datetime
            toolkit = get_nemo_agent_toolkit()
            
            if toolkit.enabled and toolkit.profiling_enabled:
                latency_ms = (time.time() - start_time) * 1000
                
                from src.services.nemo_agent_toolkit import AgentMetric
                metric = AgentMetric(
                    agent_name="REPORTER",
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


# Global agent instance
reporter_agent = ReporterAgent()
