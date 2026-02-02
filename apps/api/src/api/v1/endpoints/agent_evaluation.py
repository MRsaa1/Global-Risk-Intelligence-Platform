"""
Agent Evaluation Endpoints - NeMo Evaluator.

Provides APIs for:
- Run agent evaluations
- Get evaluation results
- Benchmark agent performance
"""
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel

from src.services.nemo_evaluator import (
    get_nemo_evaluator_service,
    TestCase,
)

router = APIRouter()


# ==================== SCHEMAS ====================

class EvaluationMetricResponse(BaseModel):
    """Evaluation metric response."""
    name: str
    value: float
    threshold: Optional[float] = None
    passed: bool


class AgentEvaluationResultResponse(BaseModel):
    """Agent evaluation result response."""
    agent_name: str
    evaluation_id: str
    test_suite: str
    metrics: List[EvaluationMetricResponse]
    overall_score: float
    passed: bool
    evaluated_at: str
    test_cases_count: int
    details: dict = {}


class EvaluateRequest(BaseModel):
    """Evaluation request."""
    agent_name: str
    test_suite: Optional[str] = None
    test_cases: Optional[List[dict]] = None  # Custom test cases


# ==================== ENDPOINTS ====================

@router.post("/evaluate", response_model=AgentEvaluationResultResponse)
async def evaluate_agent(request: EvaluateRequest):
    """
    Evaluate an agent's performance.
    
    Runs test suite and returns evaluation metrics.
    """
    evaluator = get_nemo_evaluator_service()
    
    if not evaluator.enabled:
        raise HTTPException(status_code=503, detail="NeMo Evaluator is disabled")
    
    # Convert test cases if provided
    test_cases = None
    if request.test_cases:
        test_cases = [
            TestCase(
                case_id=case.get("case_id", f"case_{i}"),
                input_data=case.get("input_data", {}),
                expected_output=case.get("expected_output"),
                expected_metrics=case.get("expected_metrics"),
            )
            for i, case in enumerate(request.test_cases)
        ]
    
    try:
        result = await evaluator.evaluate_agent(
            agent_name=request.agent_name,
            test_suite=request.test_suite,
            test_cases=test_cases,
        )
        
        return AgentEvaluationResultResponse(
            agent_name=result.agent_name,
            evaluation_id=str(result.evaluation_id),
            test_suite=result.test_suite,
            metrics=[
                EvaluationMetricResponse(
                    name=m.name,
                    value=round(m.value, 3),
                    threshold=round(m.threshold, 3) if m.threshold else None,
                    passed=m.passed,
                )
                for m in result.metrics
            ],
            overall_score=round(result.overall_score, 3),
            passed=result.passed,
            evaluated_at=result.evaluated_at.isoformat(),
            test_cases_count=result.test_cases_count,
            details=result.details,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Evaluation failed: {str(e)}")


@router.get("/results", response_model=List[AgentEvaluationResultResponse])
async def get_evaluation_results(
    agent_name: Optional[str] = Query(None, description="Filter by agent name"),
    limit: int = Query(50, ge=1, le=100),
):
    """
    Get evaluation results.
    
    Returns recent evaluation results with optional filtering.
    """
    evaluator = get_nemo_evaluator_service()
    
    if not evaluator.enabled:
        raise HTTPException(status_code=503, detail="NeMo Evaluator is disabled")
    
    results = evaluator.get_evaluation_results(
        agent_name=agent_name,
        limit=limit,
    )
    
    return [
        AgentEvaluationResultResponse(
            agent_name=r.agent_name,
            evaluation_id=str(r.evaluation_id),
            test_suite=r.test_suite,
            metrics=[
                EvaluationMetricResponse(
                    name=m.name,
                    value=round(m.value, 3),
                    threshold=round(m.threshold, 3) if m.threshold else None,
                    passed=m.passed,
                )
                for m in r.metrics
            ],
            overall_score=round(r.overall_score, 3),
            passed=r.passed,
            evaluated_at=r.evaluated_at.isoformat(),
            test_cases_count=r.test_cases_count,
            details=r.details,
        )
        for r in results
    ]


@router.get("/results/{agent_name}/latest", response_model=AgentEvaluationResultResponse)
async def get_latest_evaluation(agent_name: str):
    """Get latest evaluation result for an agent."""
    evaluator = get_nemo_evaluator_service()
    
    if not evaluator.enabled:
        raise HTTPException(status_code=503, detail="NeMo Evaluator is disabled")
    
    result = evaluator.get_latest_evaluation(agent_name)
    
    if not result:
        raise HTTPException(status_code=404, detail=f"No evaluation results found for {agent_name}")
    
    return AgentEvaluationResultResponse(
        agent_name=result.agent_name,
        evaluation_id=str(result.evaluation_id),
        test_suite=result.test_suite,
        metrics=[
            EvaluationMetricResponse(
                name=m.name,
                value=round(m.value, 3),
                threshold=round(m.threshold, 3) if m.threshold else None,
                passed=m.passed,
            )
            for m in result.metrics
        ],
        overall_score=round(result.overall_score, 3),
        passed=result.passed,
        evaluated_at=result.evaluated_at.isoformat(),
        test_cases_count=result.test_cases_count,
        details=result.details,
    )


@router.get("/test-suites")
async def get_test_suites():
    """Get available test suites."""
    evaluator = get_nemo_evaluator_service()
    
    if not evaluator.enabled:
        raise HTTPException(status_code=503, detail="NeMo Evaluator is disabled")
    
    suites = {}
    for suite_name, test_cases in evaluator.test_suites.items():
        suites[suite_name] = {
            "name": suite_name,
            "test_cases_count": len(test_cases),
            "test_cases": [
                {
                    "case_id": tc.case_id,
                    "input_data_keys": list(tc.input_data.keys()),
                    "has_expected_output": tc.expected_output is not None,
                    "has_expected_metrics": tc.expected_metrics is not None,
                }
                for tc in test_cases
            ]
        }
    
    return suites
