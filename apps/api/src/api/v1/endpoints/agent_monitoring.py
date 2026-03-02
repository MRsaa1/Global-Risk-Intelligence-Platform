"""
Agent Monitoring Endpoints - NeMo Agent Toolkit.

Provides APIs for:
- Agent performance metrics
- Agent profiling data
- Workflow management
- Tool registration
"""
from datetime import datetime, timedelta
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from src.services.nemo_agent_toolkit import (
    get_nemo_agent_toolkit,
    AgentType,
    WorkflowStep,
    WorkflowStatus,
)

router = APIRouter()


# ==================== SCHEMAS ====================

class AgentProfileResponse(BaseModel):
    """Agent profile response."""
    agent_name: str
    total_calls: int
    total_errors: int
    avg_latency_ms: float
    p50_latency_ms: float
    p95_latency_ms: float
    p99_latency_ms: float
    total_tokens: int
    total_cost_usd: float
    success_rate: float
    health_score: float
    last_call_at: Optional[str] = None


class AgentMetricResponse(BaseModel):
    """Agent metric response."""
    agent_name: str
    method_name: str
    timestamp: str
    latency_ms: float
    tokens_used: Optional[int] = None
    cost_usd: Optional[float] = None
    success: bool
    error: Optional[str] = None
    metadata: dict = {}


class WorkflowStepRequest(BaseModel):
    """Workflow step request."""
    step_id: str
    agent: str
    method: str
    parameters: dict = {}
    depends_on: List[str] = []


class WorkflowRequest(BaseModel):
    """Workflow creation request."""
    name: str
    description: str
    steps: List[WorkflowStepRequest]
    schedule: Optional[str] = None


class WorkflowResponse(BaseModel):
    """Workflow response."""
    workflow_id: str
    name: str
    description: str
    steps_count: int
    schedule: Optional[str] = None
    enabled: bool
    created_at: str


class WorkflowExecutionResponse(BaseModel):
    """Workflow execution response."""
    execution_id: str
    workflow_id: str
    status: str
    started_at: str
    completed_at: Optional[str] = None
    steps_completed: List[str] = []
    steps_failed: List[str] = []
    result: Optional[dict] = None
    error: Optional[str] = None


class DashboardResponse(BaseModel):
    """Performance dashboard response."""
    profiles: dict
    recent_metrics_count: int
    workflows_count: int
    tools_count: int


# ==================== ENDPOINTS ====================

@router.get("/metrics", response_model=List[AgentMetricResponse])
async def get_agent_metrics(
    agent_name: Optional[str] = Query(None, description="Filter by agent name"),
    start_time: Optional[str] = Query(None, description="Start time (ISO format)"),
    end_time: Optional[str] = Query(None, description="End time (ISO format)"),
    limit: int = Query(100, ge=1, le=1000),
):
    """
    Get agent performance metrics.
    
    Returns performance metrics for agents with optional filtering.
    """
    toolkit = get_nemo_agent_toolkit()
    
    start_dt = None
    if start_time:
        try:
            start_dt = datetime.fromisoformat(start_time.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid start_time format")
    
    end_dt = None
    if end_time:
        try:
            end_dt = datetime.fromisoformat(end_time.replace('Z', '+00:00'))
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid end_time format")
    
    metrics = toolkit.get_metrics(
        agent_name=agent_name,
        start_time=start_dt,
        end_time=end_dt,
    )
    
    # Limit results
    metrics = metrics[:limit]
    
    return [
        AgentMetricResponse(
            agent_name=m.agent_name,
            method_name=m.method_name,
            timestamp=m.timestamp.isoformat(),
            latency_ms=round(m.latency_ms, 2),
            tokens_used=m.tokens_used,
            cost_usd=round(m.cost_usd, 4) if m.cost_usd else None,
            success=m.success,
            error=m.error,
            metadata=m.metadata,
        )
        for m in metrics
    ]


@router.get("/profiles", response_model=List[AgentProfileResponse])
async def get_agent_profiles(
    agent_name: Optional[str] = Query(None, description="Get specific agent profile"),
):
    """
    Get agent performance profiles.
    
    Returns aggregated performance data for agents.
    """
    toolkit = get_nemo_agent_toolkit()
    
    if agent_name:
        profile = toolkit.get_profile(agent_name)
        if not profile:
            raise HTTPException(status_code=404, detail=f"Agent {agent_name} not found")
        profiles = {agent_name: profile}
    else:
        profiles = toolkit.get_all_profiles()
    
    return [
        AgentProfileResponse(
            agent_name=p.agent_name,
            total_calls=p.total_calls,
            total_errors=p.total_errors,
            avg_latency_ms=round(p.avg_latency_ms, 2),
            p50_latency_ms=round(p.p50_latency_ms, 2),
            p95_latency_ms=round(p.p95_latency_ms, 2),
            p99_latency_ms=round(p.p99_latency_ms, 2),
            total_tokens=p.total_tokens,
            total_cost_usd=round(p.total_cost_usd, 4),
            success_rate=round(p.success_rate, 3),
            health_score=round(p.health_score, 3),
            last_call_at=p.last_call_at.isoformat() if p.last_call_at else None,
        )
        for p in profiles.values()
    ]


@router.get("/profiles/{agent_name}", response_model=AgentProfileResponse)
async def get_agent_profile(agent_name: str):
    """Get profile for a specific agent."""
    toolkit = get_nemo_agent_toolkit()
    
    profile = toolkit.get_profile(agent_name)
    if not profile:
        raise HTTPException(status_code=404, detail=f"Agent {agent_name} not found")
    
    return AgentProfileResponse(
        agent_name=profile.agent_name,
        total_calls=profile.total_calls,
        total_errors=profile.total_errors,
        avg_latency_ms=round(profile.avg_latency_ms, 2),
        p50_latency_ms=round(profile.p50_latency_ms, 2),
        p95_latency_ms=round(profile.p95_latency_ms, 2),
        p99_latency_ms=round(profile.p99_latency_ms, 2),
        total_tokens=profile.total_tokens,
        total_cost_usd=round(profile.total_cost_usd, 4),
        success_rate=round(profile.success_rate, 3),
        health_score=round(profile.health_score, 3),
        last_call_at=profile.last_call_at.isoformat() if profile.last_call_at else None,
    )


@router.get("/dashboard", response_model=DashboardResponse)
async def get_agent_dashboard(
    agent_name: Optional[str] = Query(None, description="Filter dashboard by agent"),
):
    """
    Get agent performance dashboard.
    
    Returns aggregated dashboard data with profiles and metrics.
    """
    try:
        toolkit = get_nemo_agent_toolkit()
        dashboard = toolkit.get_dashboard(agent_name=agent_name)
        return DashboardResponse(**dashboard)
    except Exception as e:
        import logging
        logging.getLogger(__name__).warning("Agent dashboard failed, returning fallback: %s", e)
        return DashboardResponse(profiles={}, recent_metrics_count=0, workflows_count=0, tools_count=0)


@router.get("/workflows", response_model=List[WorkflowResponse])
async def get_workflows():
    """Get all workflows (toolkit + orchestrator templates report, assessment, remediation)."""
    toolkit = get_nemo_agent_toolkit()
    workflows = toolkit.get_all_workflows()
    result = [
        WorkflowResponse(
            workflow_id=str(w.workflow_id),
            name=w.name,
            description=w.description,
            steps_count=len(w.steps),
            schedule=w.schedule,
            enabled=w.enabled,
            created_at=w.created_at.isoformat(),
        )
        for w in workflows
    ]
    # Orchestrator templates (run via POST /agents/run-chain)
    from src.services.agentic_orchestrator import WORKFLOW_TEMPLATES
    for name in ("report", "assessment", "remediation"):
        if name in WORKFLOW_TEMPLATES:
            steps_count = len(WORKFLOW_TEMPLATES[name])
            result.append(
                WorkflowResponse(
                    workflow_id=f"orchestrator:{name}",
                    name=name,
                    description=f"Orchestrator workflow: {name}. Run via POST /agents/run-chain.",
                    steps_count=steps_count,
                    schedule=None,
                    enabled=True,
                    created_at=datetime.utcnow().isoformat(),
                )
            )
    return result


@router.post("/workflows", response_model=WorkflowResponse)
async def create_workflow(request: WorkflowRequest):
    """Create a new workflow."""
    toolkit = get_nemo_agent_toolkit()
    
    # Convert request steps to WorkflowStep
    steps = []
    for step_req in request.steps:
        try:
            agent_type = AgentType(step_req.agent.upper())
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid agent type: {step_req.agent}")
        
        steps.append(WorkflowStep(
            step_id=step_req.step_id,
            agent=agent_type,
            method=step_req.method,
            parameters=step_req.parameters,
            depends_on=step_req.depends_on,
        ))
    
    workflow = toolkit.create_workflow(
        name=request.name,
        description=request.description,
        steps=steps,
        schedule=request.schedule,
    )
    
    return WorkflowResponse(
        workflow_id=str(workflow.workflow_id),
        name=workflow.name,
        description=workflow.description,
        steps_count=len(workflow.steps),
        schedule=workflow.schedule,
        enabled=workflow.enabled,
        created_at=workflow.created_at.isoformat(),
    )


@router.post("/workflows/{workflow_id}/execute", response_model=WorkflowExecutionResponse)
async def execute_workflow(
    workflow_id: str,
    initial_context: Optional[dict] = None,
):
    """Execute a workflow."""
    toolkit = get_nemo_agent_toolkit()
    
    try:
        wf_uuid = UUID(workflow_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid workflow_id format")
    
    try:
        execution = await toolkit.execute_workflow(
            workflow_id=wf_uuid,
            initial_context=initial_context or {},
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    
    return WorkflowExecutionResponse(
        execution_id=str(execution.execution_id),
        workflow_id=str(execution.workflow_id),
        status=execution.status.value,
        started_at=execution.started_at.isoformat(),
        completed_at=execution.completed_at.isoformat() if execution.completed_at else None,
        steps_completed=execution.steps_completed,
        steps_failed=execution.steps_failed,
        result=execution.result,
        error=execution.error,
    )


@router.get("/workflows/{workflow_id}/executions", response_model=List[WorkflowExecutionResponse])
async def get_workflow_executions(
    workflow_id: str,
    limit: int = Query(100, ge=1, le=1000),
):
    """Get workflow execution history."""
    toolkit = get_nemo_agent_toolkit()
    
    try:
        wf_uuid = UUID(workflow_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid workflow_id format")
    
    executions = toolkit.get_workflow_executions(workflow_id=wf_uuid, limit=limit)
    
    return [
        WorkflowExecutionResponse(
            execution_id=str(e.execution_id),
            workflow_id=str(e.workflow_id),
            status=e.status.value,
            started_at=e.started_at.isoformat(),
            completed_at=e.completed_at.isoformat() if e.completed_at else None,
            steps_completed=e.steps_completed,
            steps_failed=e.steps_failed,
            result=e.result,
            error=e.error,
        )
        for e in executions
    ]


@router.get("/tools")
async def get_tools(agent: Optional[str] = None):
    """Get registered tools."""
    toolkit = get_nemo_agent_toolkit()
    
    agent_type = None
    if agent:
        try:
            agent_type = AgentType(agent.upper())
        except ValueError:
            raise HTTPException(status_code=400, detail=f"Invalid agent type: {agent}")
    
    tools = toolkit.get_tools(agent=agent_type)
    
    return [
        {
            "name": t.name,
            "description": t.description,
            "agent": t.agent.value,
            "parameters": t.parameters,
        }
        for t in tools
    ]


@router.post("/start")
async def start_agents():
    """
    Start all agents (SENTINEL monitoring loop).
    This activates the background monitoring service.
    """
    try:
        # Import here to avoid circular dependency
        from src.api.v1.endpoints.alerts import start_monitoring
        
        await start_monitoring()
        return {
            "message": "Agents started successfully",
            "status": "active",
            "note": "SENTINEL monitoring is now running in the background"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to start agents: {str(e)}")


@router.post("/stop")
async def stop_agents():
    """
    Stop all agents (SENTINEL monitoring loop).
    """
    try:
        # Import here to avoid circular dependency
        from src.api.v1.endpoints.alerts import stop_monitoring
        
        await stop_monitoring()
        return {
            "message": "Agents stopped successfully",
            "status": "stopped"
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop agents: {str(e)}")


@router.get("/status")
async def get_agents_status():
    """
    Get current status of agents (running/stopped).
    """
    try:
        # Import here to avoid circular dependency
        from src.api.v1.endpoints.alerts import _is_monitoring
        
        return {
            "status": "active" if _is_monitoring else "stopped",
            "monitoring": _is_monitoring
        }
    except Exception as e:
        # Fallback if import fails
        return {
            "status": "unknown",
            "monitoring": False,
            "error": str(e)
        }


@router.post("/test/all")
async def test_all_agents():
    """
    Test all agents to generate sample metrics.
    
    This endpoint runs a quick test of all agents to demonstrate
    the monitoring system. Useful for seeing metrics populate.
    """
    from src.layers.agents.sentinel import sentinel_agent
    from src.layers.agents.analyst import analyst_agent
    from src.layers.agents.advisor import advisor_agent
    from src.layers.agents.reporter import reporter_agent
    from src.layers.agents.ethicist import ethicist_agent
    from uuid import uuid4
    
    results = {}
    
    try:
        # Test SENTINEL
        test_context = {
            "weather_forecast": {
                "hurricane": {
                    "name": "Test Hurricane",
                    "category": 3,
                    "region": "Test Region",
                    "hours": 72,
                    "affected_assets": ["test_asset_1"],
                    "exposure": 100,
                }
            },
            "assets": [
                {"id": "test_asset_1", "climate_risk_score": 75}
            ]
        }
        alerts = await sentinel_agent.monitor(test_context)
        results["SENTINEL"] = {
            "status": "success",
            "alerts_generated": len(alerts)
        }
    except Exception as e:
        results["SENTINEL"] = {"status": "error", "error": str(e)}
    
    try:
        # Test ANALYST
        test_alert_data = {
            "type": "weather_threat",
            "title": "Test Alert",
            "message": "Test alert for monitoring",
        }
        analysis = await analyst_agent.analyze_alert(
            alert_id=uuid4(),
            alert_data=test_alert_data
        )
        results["ANALYST"] = {
            "status": "success",
            "confidence": analysis.confidence
        }
    except Exception as e:
        results["ANALYST"] = {"status": "error", "error": str(e)}
    
    try:
        # Test ADVISOR
        test_asset_data = {
            "id": "test_asset_1",
            "climate_risk_score": 75,
            "physical_risk_score": 60,
            "valuation": 10_000_000,
        }
        recommendations = await advisor_agent.generate_recommendations(
            asset_id="test_asset_1",
            asset_data=test_asset_data
        )
        results["ADVISOR"] = {
            "status": "success",
            "recommendations_count": len(recommendations)
        }
    except Exception as e:
        results["ADVISOR"] = {"status": "error", "error": str(e)}
    
    try:
        # Test REPORTER
        test_stress_test = {
            "name": "Test Stress Test",
            "region_name": "Test Region",
            "test_type": "climate",
            "severity": 0.7,
        }
        pdf_bytes = await reporter_agent.generate_stress_test_report(
            stress_test=test_stress_test,
            zones=[],
            use_llm=False
        )
        results["REPORTER"] = {
            "status": "success",
            "pdf_size_bytes": len(pdf_bytes)
        }
    except Exception as e:
        results["REPORTER"] = {"status": "error", "error": str(e)}
    
    try:
        # Test ETHICIST
        assess_result = await ethicist_agent.assess({
            "severity": 0.5,
            "context": "Test stress scenario for ethics check",
        })
        results["ETHICIST"] = {
            "status": "success",
            "assessment": bool(assess_result),
        }
    except Exception as e:
        results["ETHICIST"] = {"status": "error", "error": str(e)}
    
    return {
        "message": "All agents tested. Check /api/v1/agents/monitoring/dashboard for updated metrics.",
        "results": results,
        "note": "Metrics will now show non-zero values. Refresh the dashboard to see updated data."
    }
