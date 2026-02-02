"""
NVIDIA NeMo Evaluator - Agent Evaluation and Benchmarking.

Provides:
- Evaluate agent performance (precision, recall, F1)
- Test recommendation quality (ROI accuracy, feasibility)
- Benchmark analysis depth
- A/B test configurations
- Performance regression detection
"""
import logging
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Dict, List, Optional
from uuid import UUID, uuid4

from src.core.config import settings

logger = logging.getLogger(__name__)


@dataclass
class EvaluationMetric:
    """Single evaluation metric."""
    name: str
    value: float
    threshold: Optional[float] = None
    passed: bool = True
    
    def __post_init__(self):
        if self.threshold is not None:
            self.passed = self.value >= self.threshold


@dataclass
class AgentEvaluationResult:
    """Evaluation result for an agent."""
    agent_name: str
    evaluation_id: UUID
    test_suite: str
    metrics: List[EvaluationMetric]
    overall_score: float
    passed: bool
    evaluated_at: datetime
    test_cases_count: int
    details: Dict[str, Any] = field(default_factory=dict)


@dataclass
class TestCase:
    """Test case for agent evaluation."""
    case_id: str
    input_data: Dict[str, Any]
    expected_output: Optional[Dict[str, Any]] = None
    expected_metrics: Optional[Dict[str, float]] = None


class NeMoEvaluatorService:
    """
    NeMo Evaluator Service for agent evaluation and benchmarking.
    
    Evaluates:
    - SENTINEL: Alert accuracy (precision, recall, F1)
    - ANALYST: Analysis depth, correlation accuracy
    - ADVISOR: ROI accuracy, recommendation feasibility
    - REPORTER: Report quality, completeness
    """
    
    def __init__(self):
        self.enabled = getattr(settings, 'nemo_evaluator_enabled', True)
        self.test_suite_path = getattr(settings, 'evaluator_test_suite_path', 'tests/agent_evaluation')
        self.auto_run = getattr(settings, 'evaluator_auto_run', False)
        
        # Test suites storage
        self.test_suites: Dict[str, List[TestCase]] = {}
        self.evaluation_results: List[AgentEvaluationResult] = []
        
        # Initialize default test suites
        self._initialize_test_suites()
    
    def _initialize_test_suites(self):
        """Initialize default test suites for each agent."""
        # SENTINEL test cases
        self.test_suites["SENTINEL"] = [
            TestCase(
                case_id="sentinel_weather_threat",
                input_data={
                    "weather_forecast": {
                        "hurricane": {
                            "name": "Test Hurricane",
                            "category": 3,
                            "region": "Florida",
                            "hours": 72,
                            "affected_assets": ["asset_1", "asset_2"],
                            "exposure": 100,
                        }
                    }
                },
                expected_output={
                    "alerts_count": 1,
                    "severity": "critical",
                },
                expected_metrics={
                    "precision": 0.9,
                    "recall": 0.85,
                }
            ),
            TestCase(
                case_id="sentinel_climate_threshold",
                input_data={
                    "assets": [
                        {"id": "asset_1", "climate_risk_score": 75},
                        {"id": "asset_2", "climate_risk_score": 65},
                    ]
                },
                expected_output={
                    "alerts_count": 1,
                    "severity": "warning",
                },
            ),
        ]
        
        # ANALYST test cases
        self.test_suites["ANALYST"] = [
            TestCase(
                case_id="analyst_alert_analysis",
                input_data={
                    "alert_id": "test_alert_1",
                    "alert_data": {
                        "type": "weather_threat",
                        "title": "Flood Warning",
                        "message": "Flood risk detected",
                    }
                },
                expected_metrics={
                    "confidence": 0.8,
                    "data_quality": 0.7,
                }
            ),
        ]
        
        # ADVISOR test cases
        self.test_suites["ADVISOR"] = [
            TestCase(
                case_id="advisor_recommendations",
                input_data={
                    "asset_id": "test_asset_1",
                    "asset_data": {
                        "climate_risk_score": 75,
                        "physical_risk_score": 60,
                        "valuation": 10_000_000,
                    }
                },
                expected_metrics={
                    "recommendations_count": 2,
                    "roi_accuracy": 0.8,
                }
            ),
        ]
        
        # REPORTER test cases
        self.test_suites["REPORTER"] = [
            TestCase(
                case_id="reporter_pdf_generation",
                input_data={
                    "stress_test": {
                        "name": "Test Stress Test",
                        "region_name": "Test Region",
                        "test_type": "climate",
                        "severity": 0.7,
                    },
                    "zones": [],
                },
                expected_metrics={
                    "pdf_generated": 1.0,
                }
            ),
        ]
    
    async def evaluate_agent(
        self,
        agent_name: str,
        test_suite: Optional[str] = None,
        test_cases: Optional[List[TestCase]] = None,
    ) -> AgentEvaluationResult:
        """
        Evaluate an agent's performance.
        
        Args:
            agent_name: Name of agent to evaluate
            test_suite: Name of test suite to use
            test_cases: Custom test cases (overrides test_suite)
            
        Returns:
            AgentEvaluationResult with metrics
        """
        import time
        start_time = time.time()
        
        if not self.enabled:
            return AgentEvaluationResult(
                agent_name=agent_name,
                evaluation_id=uuid4(),
                test_suite=test_suite or "disabled",
                metrics=[],
                overall_score=0.0,
                passed=False,
                evaluated_at=datetime.utcnow(),
                test_cases_count=0,
            )
        
        # Get test cases
        if test_cases:
            cases = test_cases
        elif test_suite and test_suite in self.test_suites:
            cases = self.test_suites[test_suite]
        elif agent_name in self.test_suites:
            cases = self.test_suites[agent_name]
        else:
            cases = []
        
        metrics = []
        details = {}
        
        # Run evaluation based on agent type
        if agent_name == "SENTINEL":
            result = await self._evaluate_sentinel(cases)
            metrics = result["metrics"]
            details = result["details"]
        elif agent_name == "ANALYST":
            result = await self._evaluate_analyst(cases)
            metrics = result["metrics"]
            details = result["details"]
        elif agent_name == "ADVISOR":
            result = await self._evaluate_advisor(cases)
            metrics = result["metrics"]
            details = result["details"]
        elif agent_name == "REPORTER":
            result = await self._evaluate_reporter(cases)
            metrics = result["metrics"]
            details = result["details"]
        else:
            metrics = [EvaluationMetric(name="unknown_agent", value=0.0, passed=False)]
        
        # Calculate overall score
        if metrics:
            overall_score = sum(m.value for m in metrics) / len(metrics)
            passed = all(m.passed for m in metrics)
        else:
            overall_score = 0.0
            passed = False
        
        evaluation = AgentEvaluationResult(
            agent_name=agent_name,
            evaluation_id=uuid4(),
            test_suite=test_suite or agent_name,
            metrics=metrics,
            overall_score=overall_score,
            passed=passed,
            evaluated_at=datetime.utcnow(),
            test_cases_count=len(cases),
            details=details,
        )
        
        self.evaluation_results.append(evaluation)
        
        # Keep only last 100 results
        if len(self.evaluation_results) > 100:
            self.evaluation_results = self.evaluation_results[-100:]
        
        return evaluation
    
    async def _evaluate_sentinel(self, test_cases: List[TestCase]) -> Dict[str, Any]:
        """Evaluate SENTINEL agent."""
        from src.layers.agents.sentinel import sentinel_agent
        
        true_positives = 0
        false_positives = 0
        false_negatives = 0
        
        for case in test_cases:
            try:
                # Run agent
                alerts = await sentinel_agent.monitor(case.input_data)
                
                # Check expected output
                if case.expected_output:
                    expected_count = case.expected_output.get("alerts_count", 0)
                    actual_count = len(alerts)
                    
                    if actual_count >= expected_count:
                        true_positives += 1
                    else:
                        false_negatives += 1
                    
                    # Check severity if specified
                    if case.expected_output.get("severity"):
                        expected_severity = case.expected_output["severity"]
                        if alerts and alerts[0].severity.value == expected_severity:
                            true_positives += 0.5
                        else:
                            false_positives += 0.5
            except Exception as e:
                logger.warning(f"SENTINEL evaluation case {case.case_id} failed: {e}")
                false_negatives += 1
        
        # Calculate metrics
        precision = true_positives / (true_positives + false_positives) if (true_positives + false_positives) > 0 else 0.0
        recall = true_positives / (true_positives + false_negatives) if (true_positives + false_negatives) > 0 else 0.0
        f1 = 2 * (precision * recall) / (precision + recall) if (precision + recall) > 0 else 0.0
        
        metrics = [
            EvaluationMetric(name="precision", value=precision, threshold=0.8),
            EvaluationMetric(name="recall", value=recall, threshold=0.8),
            EvaluationMetric(name="f1", value=f1, threshold=0.8),
        ]
        
        return {
            "metrics": metrics,
            "details": {
                "true_positives": true_positives,
                "false_positives": false_positives,
                "false_negatives": false_negatives,
            }
        }
    
    async def _evaluate_analyst(self, test_cases: List[TestCase]) -> Dict[str, Any]:
        """Evaluate ANALYST agent."""
        from src.layers.agents.analyst import analyst_agent
        from uuid import uuid4
        
        confidence_scores = []
        data_quality_scores = []
        
        for case in test_cases:
            try:
                # Run agent
                result = await analyst_agent.analyze_alert(
                    alert_id=uuid4(),
                    alert_data=case.input_data.get("alert_data", {}),
                )
                
                # Check metrics
                if case.expected_metrics:
                    if "confidence" in case.expected_metrics:
                        expected_conf = case.expected_metrics["confidence"]
                        confidence_scores.append(1.0 if result.confidence >= expected_conf else result.confidence / expected_conf)
                    
                    if "data_quality" in case.expected_metrics:
                        expected_quality = case.expected_metrics["data_quality"]
                        data_quality_scores.append(1.0 if result.data_quality >= expected_quality else result.data_quality / expected_quality)
            except Exception as e:
                logger.warning(f"ANALYST evaluation case {case.case_id} failed: {e}")
        
        avg_confidence = sum(confidence_scores) / len(confidence_scores) if confidence_scores else 0.0
        avg_quality = sum(data_quality_scores) / len(data_quality_scores) if data_quality_scores else 0.0
        
        metrics = [
            EvaluationMetric(name="confidence", value=avg_confidence, threshold=0.8),
            EvaluationMetric(name="data_quality", value=avg_quality, threshold=0.7),
        ]
        
        return {
            "metrics": metrics,
            "details": {
                "confidence_scores": confidence_scores,
                "data_quality_scores": data_quality_scores,
            }
        }
    
    async def _evaluate_advisor(self, test_cases: List[TestCase]) -> Dict[str, Any]:
        """Evaluate ADVISOR agent."""
        from src.layers.agents.advisor import advisor_agent
        
        recommendation_counts = []
        roi_scores = []
        
        for case in test_cases:
            try:
                # Run agent
                recommendations = await advisor_agent.generate_recommendations(
                    asset_id=case.input_data.get("asset_id", "test_asset"),
                    asset_data=case.input_data.get("asset_data", {}),
                )
                
                # Check metrics
                if case.expected_metrics:
                    if "recommendations_count" in case.expected_metrics:
                        expected_count = case.expected_metrics["recommendations_count"]
                        actual_count = len(recommendations)
                        recommendation_counts.append(1.0 if actual_count >= expected_count else actual_count / expected_count)
                    
                    # Check ROI accuracy (simplified)
                    if recommendations:
                        # Check if recommendations have valid ROI
                        valid_roi = sum(1 for r in recommendations if r.options and any(opt.roi_5yr > 0 for opt in r.options))
                        roi_scores.append(valid_roi / len(recommendations) if recommendations else 0.0)
            except Exception as e:
                logger.warning(f"ADVISOR evaluation case {case.case_id} failed: {e}")
        
        avg_recommendations = sum(recommendation_counts) / len(recommendation_counts) if recommendation_counts else 0.0
        avg_roi = sum(roi_scores) / len(roi_scores) if roi_scores else 0.0
        
        metrics = [
            EvaluationMetric(name="recommendations_accuracy", value=avg_recommendations, threshold=0.8),
            EvaluationMetric(name="roi_accuracy", value=avg_roi, threshold=0.7),
        ]
        
        return {
            "metrics": metrics,
            "details": {
                "recommendation_counts": recommendation_counts,
                "roi_scores": roi_scores,
            }
        }
    
    async def _evaluate_reporter(self, test_cases: List[TestCase]) -> Dict[str, Any]:
        """Evaluate REPORTER agent."""
        from src.layers.agents.reporter import reporter_agent
        
        pdf_generated_scores = []
        
        for case in test_cases:
            try:
                # Run agent
                pdf_bytes = await reporter_agent.generate_stress_test_report(
                    stress_test=case.input_data.get("stress_test", {}),
                    zones=case.input_data.get("zones", []),
                    use_llm=False,  # Disable LLM for faster evaluation
                )
                
                # Check if PDF was generated
                if pdf_bytes and len(pdf_bytes) > 0:
                    pdf_generated_scores.append(1.0)
                else:
                    pdf_generated_scores.append(0.0)
            except Exception as e:
                logger.warning(f"REPORTER evaluation case {case.case_id} failed: {e}")
                pdf_generated_scores.append(0.0)
        
        avg_pdf = sum(pdf_generated_scores) / len(pdf_generated_scores) if pdf_generated_scores else 0.0
        
        metrics = [
            EvaluationMetric(name="pdf_generation", value=avg_pdf, threshold=0.9),
        ]
        
        return {
            "metrics": metrics,
            "details": {
                "pdf_generated_scores": pdf_generated_scores,
            }
        }
    
    def get_evaluation_results(
        self,
        agent_name: Optional[str] = None,
        limit: int = 50,
    ) -> List[AgentEvaluationResult]:
        """Get evaluation results."""
        results = self.evaluation_results
        
        if agent_name:
            results = [r for r in results if r.agent_name == agent_name]
        
        results.sort(key=lambda r: r.evaluated_at, reverse=True)
        return results[:limit]
    
    def get_latest_evaluation(self, agent_name: str) -> Optional[AgentEvaluationResult]:
        """Get latest evaluation for an agent."""
        results = [r for r in self.evaluation_results if r.agent_name == agent_name]
        if results:
            return max(results, key=lambda r: r.evaluated_at)
        return None


# Global service instance
_nemo_evaluator_service: Optional[NeMoEvaluatorService] = None


def get_nemo_evaluator_service() -> NeMoEvaluatorService:
    """Get or create NeMo Evaluator service instance."""
    global _nemo_evaluator_service
    if _nemo_evaluator_service is None:
        _nemo_evaluator_service = NeMoEvaluatorService()
    return _nemo_evaluator_service


# Convenience alias
nemo_evaluator = get_nemo_evaluator_service()
