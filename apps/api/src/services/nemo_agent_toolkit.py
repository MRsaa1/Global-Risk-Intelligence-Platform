"""
NVIDIA NeMo Agent Toolkit - Agent Monitoring, Profiling, and Optimization.

Provides:
- Performance tracking (latency, token usage, cost)
- Workflow definition and orchestration
- Tool registration and management
- Prompt optimization tracking
- Agent health metrics
"""
import asyncio
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Callable, Dict, List, Optional
from uuid import UUID, uuid4

from src.core.config import settings

logger = logging.getLogger(__name__)


class AgentType(str, Enum):
    """Types of agents."""
    SENTINEL = "SENTINEL"
    ANALYST = "ANALYST"
    ADVISOR = "ADVISOR"
    REPORTER = "REPORTER"
    ETHICIST = "ETHICIST"
    SYSTEM_OVERSEER = "SYSTEM_OVERSEER"


class WorkflowStatus(str, Enum):
    """Workflow execution status."""
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"


@dataclass
class AgentMetric:
    """Performance metric for an agent."""
    agent_name: str
    method_name: str
    timestamp: datetime
    latency_ms: float
    tokens_used: Optional[int] = None
    cost_usd: Optional[float] = None
    success: bool = True
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentProfile:
    """Profile data for an agent."""
    agent_name: str
    total_calls: int = 0
    total_errors: int = 0
    avg_latency_ms: float = 0.0
    p50_latency_ms: float = 0.0
    p95_latency_ms: float = 0.0
    p99_latency_ms: float = 0.0
    total_tokens: int = 0
    total_cost_usd: float = 0.0
    success_rate: float = 1.0
    last_call_at: Optional[datetime] = None
    health_score: float = 1.0  # 0.0-1.0


@dataclass
class Tool:
    """Agent tool definition."""
    name: str
    description: str
    function: Callable
    agent: AgentType
    parameters: Dict[str, Any] = field(default_factory=dict)


@dataclass
class WorkflowStep:
    """Step in a workflow."""
    step_id: str
    agent: AgentType
    method: str
    parameters: Dict[str, Any] = field(default_factory=dict)
    depends_on: List[str] = field(default_factory=list)  # Step IDs this depends on


@dataclass
class Workflow:
    """Agent workflow definition."""
    workflow_id: UUID
    name: str
    description: str
    steps: List[WorkflowStep]
    schedule: Optional[str] = None  # Cron expression
    enabled: bool = True
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class WorkflowExecution:
    """Workflow execution record."""
    execution_id: UUID
    workflow_id: UUID
    status: WorkflowStatus
    started_at: datetime
    completed_at: Optional[datetime] = None
    steps_completed: List[str] = field(default_factory=list)
    steps_failed: List[str] = field(default_factory=list)
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class NeMoAgentToolkit:
    """
    NeMo Agent Toolkit Service.
    
    Provides:
    - Performance tracking and profiling
    - Workflow orchestration
    - Tool management
    - Health monitoring
    """
    
    def __init__(self):
        self.enabled = getattr(settings, 'nemo_agent_toolkit_enabled', True)
        self.metrics_retention_days = getattr(settings, 'agent_toolkit_metrics_retention_days', 30)
        self.profiling_enabled = getattr(settings, 'agent_toolkit_profiling_enabled', True)
        
        # Storage
        self.metrics: List[AgentMetric] = []
        self.profiles: Dict[str, AgentProfile] = {}
        self.tools: Dict[str, Tool] = {}
        self.workflows: Dict[UUID, Workflow] = {}
        self.executions: Dict[UUID, WorkflowExecution] = {}
        
        # Initialize profiles for all agents (exclude SYSTEM_OVERSEER from display)
        for agent in AgentType:
            if agent != AgentType.SYSTEM_OVERSEER:
                self.profiles[agent.value] = AgentProfile(agent_name=agent.value)
    
    def track_agent(
        self,
        agent_name: str,
        method_name: str = None,
    ):
        """
        Decorator to track agent method performance.
        
        Usage:
            @toolkit.track_agent("SENTINEL", "monitor")
            async def monitor(self, context):
                ...
        """
        def decorator(func: Callable):
            async def wrapper(*args, **kwargs):
                if not self.enabled or not self.profiling_enabled:
                    return await func(*args, **kwargs)
                
                start_time = time.time()
                success = True
                error = None
                tokens_used = None
                cost_usd = None
                
                try:
                    result = await func(*args, **kwargs)
                    
                    # Estimate tokens if result is text
                    if isinstance(result, str):
                        tokens_used = len(result.split()) * 1.3  # Rough estimate
                    elif isinstance(result, dict) and "tokens_used" in result:
                        tokens_used = result.get("tokens_used")
                    
                    # Estimate cost (rough: $0.001 per 1K tokens)
                    if tokens_used:
                        cost_usd = (tokens_used / 1000) * 0.001
                    
                    return result
                except Exception as e:
                    success = False
                    error = str(e)
                    raise
                finally:
                    latency_ms = (time.time() - start_time) * 1000
                    
                    metric = AgentMetric(
                        agent_name=agent_name,
                        method_name=method_name or func.__name__,
                        timestamp=datetime.utcnow(),
                        latency_ms=latency_ms,
                        tokens_used=tokens_used,
                        cost_usd=cost_usd,
                        success=success,
                        error=error,
                    )
                    
                    self._record_metric(metric)
            
            return wrapper
        return decorator
    
    def _record_metric(self, metric: AgentMetric):
        """Record a performance metric."""
        self.metrics.append(metric)
        
        # Update profile
        profile = self.profiles[metric.agent_name]
        profile.total_calls += 1
        if not metric.success:
            profile.total_errors += 1
        
        # Update latency stats (simple moving average)
        if profile.total_calls == 1:
            profile.avg_latency_ms = metric.latency_ms
            profile.p50_latency_ms = metric.latency_ms
            profile.p95_latency_ms = metric.latency_ms
            profile.p99_latency_ms = metric.latency_ms
        else:
            # Exponential moving average
            alpha = 0.1
            profile.avg_latency_ms = (alpha * metric.latency_ms) + ((1 - alpha) * profile.avg_latency_ms)
            
            # Update percentiles (simplified - would use proper percentile calculation in production)
            if metric.latency_ms > profile.p95_latency_ms:
                profile.p95_latency_ms = metric.latency_ms
            if metric.latency_ms > profile.p99_latency_ms:
                profile.p99_latency_ms = metric.latency_ms
        
        # Update tokens and cost
        if metric.tokens_used:
            profile.total_tokens += metric.tokens_used
        if metric.cost_usd:
            profile.total_cost_usd += metric.cost_usd
        
        # Update success rate
        profile.success_rate = 1.0 - (profile.total_errors / profile.total_calls) if profile.total_calls > 0 else 1.0
        
        # Update health score (0.0-1.0)
        # Based on success rate and latency (lower latency = better)
        latency_score = max(0, 1.0 - (profile.avg_latency_ms / 5000))  # Penalize if > 5s
        profile.health_score = (profile.success_rate * 0.7) + (latency_score * 0.3)
        
        profile.last_call_at = metric.timestamp
        
        # Cleanup old metrics
        cutoff = datetime.utcnow() - timedelta(days=self.metrics_retention_days)
        self.metrics = [m for m in self.metrics if m.timestamp > cutoff]
    
    def register_tool(self, tool: Tool):
        """Register a tool for an agent."""
        tool_key = f"{tool.agent.value}:{tool.name}"
        self.tools[tool_key] = tool
        logger.info(f"Registered tool: {tool_key}")
    
    def get_tools(self, agent: Optional[AgentType] = None) -> List[Tool]:
        """Get tools for an agent or all tools."""
        if agent:
            return [t for t in self.tools.values() if t.agent == agent]
        return list(self.tools.values())
    
    def create_workflow(
        self,
        name: str,
        description: str,
        steps: List[WorkflowStep],
        schedule: Optional[str] = None,
    ) -> Workflow:
        """Create a new workflow."""
        workflow = Workflow(
            workflow_id=uuid4(),
            name=name,
            description=description,
            steps=steps,
            schedule=schedule,
        )
        self.workflows[workflow.workflow_id] = workflow
        logger.info(f"Created workflow: {workflow.name} ({workflow.workflow_id})")
        return workflow
    
    async def execute_workflow(
        self,
        workflow_id: UUID,
        initial_context: Optional[Dict[str, Any]] = None,
    ) -> WorkflowExecution:
        """Execute a workflow."""
        if workflow_id not in self.workflows:
            raise ValueError(f"Workflow {workflow_id} not found")
        
        workflow = self.workflows[workflow_id]
        if not workflow.enabled:
            raise ValueError(f"Workflow {workflow.name} is disabled")
        
        execution = WorkflowExecution(
            execution_id=uuid4(),
            workflow_id=workflow_id,
            status=WorkflowStatus.RUNNING,
            started_at=datetime.utcnow(),
        )
        self.executions[execution.execution_id] = execution
        
        context = initial_context or {}
        result = {}
        
        try:
            # Execute steps in order (respecting dependencies)
            completed_steps = set()
            
            while len(completed_steps) < len(workflow.steps):
                # Find steps ready to execute (dependencies met)
                ready_steps = [
                    s for s in workflow.steps
                    if s.step_id not in completed_steps
                    and all(dep in completed_steps for dep in s.depends_on)
                ]
                
                if not ready_steps:
                    # Circular dependency or missing step
                    raise ValueError("Cannot resolve workflow dependencies")
                
                # Execute ready steps (can be parallel in future)
                for step in ready_steps:
                    try:
                        step_result = await self._execute_step(step, context)
                        context[step.step_id] = step_result
                        result[step.step_id] = step_result
                        completed_steps.add(step.step_id)
                        execution.steps_completed.append(step.step_id)
                    except Exception as e:
                        execution.steps_failed.append(step.step_id)
                        logger.error(f"Workflow step {step.step_id} failed: {e}")
                        raise
            
            execution.status = WorkflowStatus.COMPLETED
            execution.result = result
        except Exception as e:
            execution.status = WorkflowStatus.FAILED
            execution.error = str(e)
            logger.error(f"Workflow {workflow.name} failed: {e}")
        finally:
            execution.completed_at = datetime.utcnow()
        
        return execution
    
    async def _execute_step(
        self,
        step: WorkflowStep,
        context: Dict[str, Any],
    ) -> Any:
        """Execute a single workflow step."""
        # Import agents dynamically
        if step.agent == AgentType.SENTINEL:
            from src.layers.agents.sentinel import sentinel_agent
            agent = sentinel_agent
        elif step.agent == AgentType.ANALYST:
            from src.layers.agents.analyst import analyst_agent
            agent = analyst_agent
        elif step.agent == AgentType.ADVISOR:
            from src.layers.agents.advisor import advisor_agent
            agent = advisor_agent
        elif step.agent == AgentType.REPORTER:
            from src.layers.agents.reporter import reporter_agent
            agent = reporter_agent
        elif step.agent == AgentType.ETHICIST:
            from src.layers.agents.ethicist import ethicist_agent
            agent = ethicist_agent
        else:
            raise ValueError(f"Unknown agent type: {step.agent}")
        
        # Get method
        method = getattr(agent, step.method)
        if not method:
            raise ValueError(f"Method {step.method} not found on {step.agent.value}")
        
        # Prepare parameters (can reference context from previous steps)
        params = {}
        for key, value in step.parameters.items():
            if isinstance(value, str) and value.startswith("$"):
                # Reference to context variable
                context_key = value[1:]
                params[key] = context.get(context_key)
            else:
                params[key] = value
        
        # Execute method
        if asyncio.iscoroutinefunction(method):
            return await method(**params)
        else:
            return method(**params)
    
    def get_metrics(
        self,
        agent_name: Optional[str] = None,
        start_time: Optional[datetime] = None,
        end_time: Optional[datetime] = None,
    ) -> List[AgentMetric]:
        """Get performance metrics."""
        metrics = self.metrics
        
        if agent_name:
            metrics = [m for m in metrics if m.agent_name == agent_name]
        
        if start_time:
            metrics = [m for m in metrics if m.timestamp >= start_time]
        
        if end_time:
            metrics = [m for m in metrics if m.timestamp <= end_time]
        
        return sorted(metrics, key=lambda m: m.timestamp, reverse=True)
    
    def get_profile(self, agent_name: str) -> Optional[AgentProfile]:
        """Get agent profile."""
        return self.profiles.get(agent_name)
    
    def get_all_profiles(self) -> Dict[str, AgentProfile]:
        """Get all agent profiles."""
        return self.profiles.copy()
    
    def get_workflow(self, workflow_id: UUID) -> Optional[Workflow]:
        """Get workflow by ID."""
        return self.workflows.get(workflow_id)
    
    def get_all_workflows(self) -> List[Workflow]:
        """Get all workflows."""
        return list(self.workflows.values())
    
    def get_workflow_execution(self, execution_id: UUID) -> Optional[WorkflowExecution]:
        """Get workflow execution by ID."""
        return self.executions.get(execution_id)
    
    def get_workflow_executions(
        self,
        workflow_id: Optional[UUID] = None,
        limit: int = 100,
    ) -> List[WorkflowExecution]:
        """Get workflow executions."""
        executions = list(self.executions.values())
        
        if workflow_id:
            executions = [e for e in executions if e.workflow_id == workflow_id]
        
        executions.sort(key=lambda e: e.started_at, reverse=True)
        return executions[:limit]
    
    def get_dashboard(self, agent_name: Optional[str] = None) -> Dict[str, Any]:
        """Get performance dashboard data."""
        if agent_name:
            profiles = {agent_name: self.profiles.get(agent_name)}
        else:
            profiles = self.profiles
        
        # Get recent metrics (last 24 hours)
        cutoff = datetime.utcnow() - timedelta(hours=24)
        recent_metrics = [m for m in self.metrics if m.timestamp > cutoff]
        
        dashboard = {
            "profiles": {
                name: {
                    "total_calls": p.total_calls,
                    "total_errors": p.total_errors,
                    "avg_latency_ms": round(p.avg_latency_ms, 2),
                    "p50_latency_ms": round(p.p50_latency_ms, 2),
                    "p95_latency_ms": round(p.p95_latency_ms, 2),
                    "p99_latency_ms": round(p.p99_latency_ms, 2),
                    "total_tokens": p.total_tokens,
                    "total_cost_usd": round(p.total_cost_usd, 4),
                    "success_rate": round(p.success_rate, 3),
                    "health_score": round(p.health_score, 3),
                    "last_call_at": p.last_call_at.isoformat() if p.last_call_at else None,
                }
                for name, p in profiles.items()
            },
            "recent_metrics_count": len(recent_metrics),
            "workflows_count": len(self.workflows),
            "tools_count": len(self.tools),
        }
        
        return dashboard


# Global service instance
_nemo_agent_toolkit: Optional[NeMoAgentToolkit] = None


def get_nemo_agent_toolkit() -> NeMoAgentToolkit:
    """Get or create NeMo Agent Toolkit service instance."""
    global _nemo_agent_toolkit
    if _nemo_agent_toolkit is None:
        _nemo_agent_toolkit = NeMoAgentToolkit()
    return _nemo_agent_toolkit


# Convenience alias
nemo_agent_toolkit = get_nemo_agent_toolkit()
