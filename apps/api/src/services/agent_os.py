"""
Agent OS: Multi-agent workflow orchestration.

Workflow templates (YAML/JSON), shared context (Redis-backed or in-memory),
workflow executor with sequential/parallel steps and branching.
"""
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional
from uuid import uuid4

from src.core.config import settings

logger = logging.getLogger(__name__)

try:
    from src.services.approval_gate import approval_gate
except Exception:
    approval_gate = None
try:
    from src.services.agent_message_bus import message_bus
    from src.services.agent_message_bus import AgentMessage
except Exception:
    message_bus = None
    AgentMessage = None


async def _log_workflow_step_to_audit(
    template_id: str,
    run_id: str,
    step_id: str,
    agent: str,
    action: str,
    status: str,
    latency_ms: int,
) -> None:
    """Persist workflow step telemetry to agent_audit_log and in-memory log."""
    try:
        from src.services.agent_actions_log import append as log_append

        meta = {
            "template_id": template_id,
            "run_id": run_id,
            "step_id": step_id,
            "latency_ms": latency_ms,
        }
        await log_append(
            source="workflow_executor",
            agent_id=agent,
            action_type=action or "step",
            input_summary=f"{template_id} {run_id}",
            result_summary=status,
            meta=meta,
        )
    except Exception as e:
        logger.debug("Workflow step audit append skipped: %s", e)

    try:
        from src.core.database import get_async_session
        from src.models.agent_audit_log import AgentAuditLog
        from datetime import datetime, timezone

        async for session in get_async_session():
            record = AgentAuditLog(
                source="workflow_executor",
                agent_id=agent,
                action_type=action or "step",
                input_summary=f"{template_id} {run_id}",
                result_summary=status,
                timestamp=datetime.now(tz=timezone.utc),
                meta=json.dumps({"template_id": template_id, "run_id": run_id, "step_id": step_id, "latency_ms": latency_ms}),
            )
            session.add(record)
            await session.commit()
            break
    except Exception as e:
        logger.debug("Workflow step DB audit skipped: %s", e)


# ---------------------------------------------------------------------------
# Workflow definitions
# ---------------------------------------------------------------------------

@dataclass
class WorkflowStep:
    """A single step in a workflow."""
    id: str
    name: str
    agent: str  # SENTINEL, ANALYST, ADVISOR, REPORTER, ETHICIST
    action: str  # run_analysis, generate_report, review, approve
    params: Dict[str, Any] = field(default_factory=dict)
    depends_on: List[str] = field(default_factory=list)
    timeout_seconds: int = 300
    retry_count: int = 1
    condition: Optional[str] = None  # e.g. "prev.risk_score > 0.7"
    requires_approval: bool = False  # Human-in-the-loop gate before continuing


@dataclass
class WorkflowTemplate:
    """Template for a multi-agent workflow."""
    id: str
    name: str
    description: str
    steps: List[WorkflowStep]
    tags: List[str] = field(default_factory=list)
    version: str = "1.0"


@dataclass
class WorkflowRun:
    """An execution instance of a workflow."""
    id: str
    template_id: str
    status: str  # pending, running, completed, failed, cancelled
    steps_completed: List[str] = field(default_factory=list)
    steps_failed: List[str] = field(default_factory=list)
    context: Dict[str, Any] = field(default_factory=dict)
    started_at: float = 0
    completed_at: Optional[float] = None
    results: Dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Built-in workflow templates
# ---------------------------------------------------------------------------

BUILTIN_TEMPLATES = [
    WorkflowTemplate(
        id="report_workflow",
        name="Risk Assessment Report",
        description="Full risk assessment: analyze -> assess -> review -> generate report",
        steps=[
            WorkflowStep(id="s1", name="Data Collection", agent="SENTINEL", action="collect_data", params={"scope": "portfolio"}),
            WorkflowStep(id="s2", name="Risk Analysis", agent="ANALYST", action="run_analysis", depends_on=["s1"]),
            WorkflowStep(id="s3", name="Risk Assessment", agent="ADVISOR", action="assess_risks", depends_on=["s2"]),
            WorkflowStep(id="s4", name="Ethics Review", agent="ETHICIST", action="review", depends_on=["s3"]),
            WorkflowStep(id="s5", name="Report Generation", agent="REPORTER", action="generate_report", depends_on=["s4"]),
        ],
        tags=["report", "assessment"],
    ),
    WorkflowTemplate(
        id="assessment_workflow",
        name="Quick Risk Assessment",
        description="Fast assessment: sentinel scan -> analyst review -> advisor recommendation",
        steps=[
            WorkflowStep(id="s1", name="Scan", agent="SENTINEL", action="scan", params={"quick": True}),
            WorkflowStep(id="s2", name="Analyze", agent="ANALYST", action="analyze", depends_on=["s1"]),
            WorkflowStep(id="s3", name="Recommend", agent="ADVISOR", action="recommend", depends_on=["s2"]),
        ],
        tags=["quick", "assessment"],
    ),
    WorkflowTemplate(
        id="remediation_workflow",
        name="Risk Remediation",
        description="Identify risks -> plan remediation -> verify implementation",
        steps=[
            WorkflowStep(id="s1", name="Identify Risks", agent="SENTINEL", action="identify_risks"),
            WorkflowStep(id="s2", name="Plan Remediation", agent="ADVISOR", action="plan_remediation", depends_on=["s1"]),
            WorkflowStep(id="s3", name="Verify Ethics", agent="ETHICIST", action="verify", depends_on=["s2"]),
            WorkflowStep(id="s4", name="Generate Action Plan", agent="REPORTER", action="action_plan", depends_on=["s3"]),
        ],
        tags=["remediation", "action"],
    ),
    WorkflowTemplate(
        id="stress_test_workflow",
        name="Comprehensive Stress Test",
        description="Multi-scenario stress test with agent analysis and reporting",
        steps=[
            WorkflowStep(id="s1", name="Configure Scenarios", agent="ADVISOR", action="configure_scenarios"),
            WorkflowStep(id="s2", name="Run Simulations", agent="ANALYST", action="run_stress_tests", depends_on=["s1"]),
            WorkflowStep(id="s3", name="Analyze Results", agent="ANALYST", action="analyze_results", depends_on=["s2"]),
            WorkflowStep(id="s4", name="Generate Report", agent="REPORTER", action="generate_stress_report", depends_on=["s3"]),
        ],
        tags=["stress_test", "simulation"],
    ),
    WorkflowTemplate(
        id="full_assessment_workflow",
        name="Full Assessment (5-Agent Chain)",
        description="SENTINEL monitor -> ANALYST analyze -> ADVISOR recommend -> ETHICIST assess -> REPORTER synthesize",
        steps=[
            WorkflowStep(id="s1", name="Monitor & Detect", agent="SENTINEL", action="monitor"),
            WorkflowStep(id="s2", name="Deep Analysis", agent="ANALYST", action="analyze_alerts", depends_on=["s1"]),
            WorkflowStep(id="s3", name="Recommendations", agent="ADVISOR", action="recommend", depends_on=["s2"]),
            WorkflowStep(id="s4", name="Ethics Review", agent="ETHICIST", action="assess", depends_on=["s3"], requires_approval=True),
            WorkflowStep(id="s5", name="Final Report", agent="REPORTER", action="synthesize", depends_on=["s4"]),
        ],
        tags=["full", "assessment", "chain"],
        version="2.0",
    ),
    WorkflowTemplate(
        id="quantum_risk_assessment",
        name="Quantum Risk Assessment",
        description="Swarm-enhanced assessment: SENTINEL -> Swarm analysis -> ANALYST -> ADVISOR -> ETHICIST -> REPORTER",
        steps=[
            WorkflowStep(id="s1", name="Monitor & Detect", agent="SENTINEL", action="monitor"),
            WorkflowStep(id="s2", name="Deep Analysis", agent="ANALYST", action="analyze_alerts", depends_on=["s1"]),
            WorkflowStep(id="s3", name="Strategic Advice", agent="ADVISOR", action="recommend", depends_on=["s2"]),
            WorkflowStep(id="s4", name="Ethics Gate", agent="ETHICIST", action="assess", depends_on=["s3"]),
            WorkflowStep(id="s5", name="Executive Report", agent="REPORTER", action="synthesize", depends_on=["s4"]),
        ],
        tags=["quantum", "swarm", "full"],
        version="2.0",
    ),
]


# ---------------------------------------------------------------------------
# Shared context store (in-memory, optional Redis for multi-instance)
# ---------------------------------------------------------------------------

class SharedContextStore:
    """In-memory shared context for agent workflows. Optional Redis backend when use_redis_shared_context and enable_redis."""

    def __init__(self):
        self._store: Dict[str, Dict[str, Any]] = {}
        self._redis = None
        try:
            if getattr(settings, "use_redis_shared_context", False) and getattr(settings, "enable_redis", False):
                import redis
                self._redis = redis.Redis.from_url(
                    (getattr(settings, "redis_url", "redis://localhost:6379") or "redis://localhost:6379"),
                    decode_responses=True,
                )
        except Exception as e:
            logger.debug("Redis SharedContext not available: %s", e)

    def _key(self, workflow_id: str) -> str:
        return f"shared_context:{workflow_id}"

    def set(self, workflow_id: str, key: str, value: Any) -> None:
        if workflow_id not in self._store:
            self._store[workflow_id] = {}
        self._store[workflow_id][key] = value
        if self._redis:
            try:
                self._redis.hset(self._key(workflow_id), key, json.dumps(value, default=str))
            except Exception as e:
                logger.debug("Redis SharedContext set skipped: %s", e)

    def get(self, workflow_id: str, key: str) -> Any:
        if self._redis:
            try:
                raw = self._redis.hget(self._key(workflow_id), key)
                if raw is not None:
                    return json.loads(raw)
            except Exception as e:
                logger.debug("Redis SharedContext get skipped: %s", e)
        return self._store.get(workflow_id, {}).get(key)

    def get_all(self, workflow_id: str) -> Dict[str, Any]:
        if self._redis:
            try:
                data = self._redis.hgetall(self._key(workflow_id))
                if data:
                    return {k: json.loads(v) for k, v in data.items()}
            except Exception as e:
                logger.debug("Redis SharedContext get_all skipped: %s", e)
        return dict(self._store.get(workflow_id, {}))

    def delete(self, workflow_id: str) -> None:
        self._store.pop(workflow_id, None)
        if self._redis:
            try:
                self._redis.delete(self._key(workflow_id))
            except Exception as e:
                logger.debug("Redis SharedContext delete skipped: %s", e)


# ---------------------------------------------------------------------------
# Workflow executor
# ---------------------------------------------------------------------------

class WorkflowExecutor:
    """Executes workflow templates step by step with real agent dispatch."""

    def __init__(self):
        self._templates: Dict[str, WorkflowTemplate] = {t.id: t for t in BUILTIN_TEMPLATES}
        self._runs: Dict[str, WorkflowRun] = {}
        self.context_store = SharedContextStore()
        self._agents: Dict[str, Any] = {}
        self._init_agent_registry()

    def _init_agent_registry(self) -> None:
        """Lazy-load agent instances into the registry."""
        try:
            from src.layers.agents.sentinel import sentinel_agent
            self._agents["sentinel"] = sentinel_agent
        except Exception:
            pass
        try:
            from src.layers.agents.analyst import analyst_agent
            self._agents["analyst"] = analyst_agent
        except Exception:
            pass
        try:
            from src.layers.agents.advisor import advisor_agent
            self._agents["advisor"] = advisor_agent
        except Exception:
            pass
        try:
            from src.layers.agents.ethicist import ethicist_agent
            self._agents["ethicist"] = ethicist_agent
        except Exception:
            pass
        try:
            from src.layers.agents.reporter import reporter_agent
            self._agents["reporter"] = reporter_agent
        except Exception:
            pass

    def _get_agent(self, agent_name: str) -> Optional[Any]:
        return self._agents.get(agent_name.lower())

    def register_template(self, template: WorkflowTemplate) -> None:
        self._templates[template.id] = template

    def list_templates(self) -> List[Dict[str, Any]]:
        return [
            {
                "id": t.id, "name": t.name, "description": t.description,
                "steps_count": len(t.steps), "tags": t.tags, "version": t.version,
            }
            for t in self._templates.values()
        ]

    def get_template(self, template_id: str) -> Optional[WorkflowTemplate]:
        return self._templates.get(template_id)

    async def start_workflow(
        self,
        template_id: str,
        initial_context: Optional[Dict[str, Any]] = None,
    ) -> WorkflowRun:
        """Start executing a workflow from a template."""
        template = self._templates.get(template_id)
        if not template:
            raise ValueError(f"Template not found: {template_id}")

        run = WorkflowRun(
            id=f"wf_{str(uuid4())[:8]}",
            template_id=template_id,
            status="running",
            context=initial_context or {},
            started_at=time.time(),
        )
        self._runs[run.id] = run

        # Store initial context
        if initial_context:
            for k, v in initial_context.items():
                self.context_store.set(run.id, k, v)

        # Execute steps in dependency order
        completed_steps: set = set()
        hitl_timeout = getattr(settings, "workflow_hitl_timeout_seconds", 3600)
        prev_agent: Optional[str] = None
        for step in template.steps:
            step_start = time.time()
            # Check dependencies
            if all(dep in completed_steps for dep in step.depends_on):
                try:
                    # MessageBus: step_input before execution
                    if message_bus and AgentMessage:
                        context = self.context_store.get_all(run.id)
                        context_summary = {"keys": list(context.keys()), "count": len(context)}
                        await message_bus.send(AgentMessage(
                            sender=prev_agent or "orchestrator",
                            recipient=step.agent,
                            message_type="step_input",
                            payload=context_summary,
                            correlation_id=run.id,
                        ))
                    step_start = time.time()
                    result = await self._execute_step(run, step)
                    latency_ms = int((time.time() - step_start) * 1000)
                    await _log_workflow_step_to_audit(
                        template_id=run.template_id,
                        run_id=run.id,
                        step_id=step.id,
                        agent=step.agent,
                        action=step.action,
                        status=result.get("status", "completed"),
                        latency_ms=latency_ms,
                    )
                    # MessageBus: step_output after successful execution
                    if message_bus and AgentMessage:
                        result_summary = {
                            "status": result.get("status", "unknown"),
                            "keys": list(result.keys()),
                        }
                        await message_bus.send(AgentMessage(
                            sender=step.agent,
                            recipient="orchestrator",
                            message_type="step_output",
                            payload=result_summary,
                            correlation_id=run.id,
                        ))
                    prev_agent = step.agent
                    # Human-in-the-loop: require approval when step.requires_approval or high severity
                    need_hitl = step.requires_approval or result.get("severity") in ("high", "critical")
                    if need_hitl and approval_gate:
                        severity = result.get("severity", "high")
                        gate_id = await approval_gate.request_approval(
                            run.id, step.name, step.agent, payload=result, severity=severity
                        )
                        approval_result = await approval_gate.wait_for_approval(gate_id, timeout_seconds=hitl_timeout)
                        if approval_result.status not in ("approved", "modified"):
                            run.status = "rejected"
                            run.steps_failed.append(step.id)
                            run.completed_at = time.time()
                            return run
                        if approval_result.status == "modified" and getattr(approval_result, "modifications", None):
                            for k, v in (approval_result.modifications or {}).items():
                                self.context_store.set(run.id, k, v)
                    run.results[step.id] = result
                    run.steps_completed.append(step.id)
                    completed_steps.add(step.id)
                    try:
                        self.context_store.set(run.id, f"step_{step.id}_result", result)
                    except Exception:
                        pass
                except Exception as e:
                    logger.warning("Workflow step %s failed: %s", step.id, e)
                    run.steps_failed.append(step.id)
                    run.status = "failed"
                    latency_ms = int((time.time() - step_start) * 1000)
                    await _log_workflow_step_to_audit(
                        template_id=run.template_id,
                        run_id=run.id,
                        step_id=step.id,
                        agent=step.agent,
                        action=step.action,
                        status="failed",
                        latency_ms=latency_ms,
                    )
                    break

        if run.status != "failed":
            run.status = "completed"
        run.completed_at = time.time()
        return run

    async def _execute_step(self, run: WorkflowRun, step: WorkflowStep) -> Dict[str, Any]:
        """Execute a single workflow step with self-healing, reflection, and audit."""
        import asyncio as _asyncio
        logger.info("Executing step %s: agent=%s action=%s", step.id, step.agent, step.action)
        agent = self._get_agent(step.agent)
        if agent is None:
            logger.warning("Agent %s not found in registry, using mock", step.agent)
            return {
                "step_id": step.id,
                "agent": step.agent,
                "action": step.action,
                "status": "completed",
                "output": f"Step {step.name} executed by {step.agent} (mock)",
                "duration_ms": 50,
            }

        context = self.context_store.get_all(run.id)
        step_start = time.time()

        # Self-healing: retry with exponential backoff
        max_retries = step.retry_count or 2
        result = None
        last_error = None
        for attempt in range(max_retries):
            try:
                result = await agent.execute(step.action, step.params, context)
                break
            except Exception as exc:
                last_error = exc
                if attempt < max_retries - 1:
                    wait = 2 ** attempt
                    logger.warning("Step %s attempt %d failed: %s — retrying in %ds", step.id, attempt + 1, exc, wait)
                    await _asyncio.sleep(wait)

        if result is None:
            result = {
                "agent": step.agent,
                "action": step.action,
                "status": "degraded",
                "error": str(last_error),
                "fallback": True,
            }

        result["step_id"] = step.id

        # Reflection: LLM self-check on agent output
        try:
            from src.services.reflection import reflection_engine
            reflection = await reflection_engine.reflect(step.agent, result, context)
            result["_reflection"] = {
                "verdict": reflection.verdict,
                "reasoning": reflection.reasoning,
                "issues": reflection.issues_found,
            }
            if reflection.revised_result:
                result = {**reflection.revised_result, "step_id": step.id,
                          "_reflection": result["_reflection"]}
        except Exception as exc:
            logger.debug("Reflection skipped: %s", exc)

        # Audit trail
        try:
            from src.services.audit_trail import audit_trail
            await audit_trail.log_agent_action(
                agent_id=step.agent,
                action=step.action,
                workflow_run_id=run.id,
                step_id=step.id,
                result_summary=result.get("status", "unknown"),
                reflection_verdict=result.get("_reflection", {}).get("verdict"),
                duration_ms=int((time.time() - step_start) * 1000),
            )
        except Exception as exc:
            logger.debug("Audit trail skipped: %s", exc)

        return result

    def get_run(self, run_id: str) -> Optional[WorkflowRun]:
        return self._runs.get(run_id)

    def list_runs(self, limit: int = 50) -> List[Dict[str, Any]]:
        runs = sorted(self._runs.values(), key=lambda r: r.started_at, reverse=True)[:limit]
        return [
            {
                "id": r.id, "template_id": r.template_id, "status": r.status,
                "steps_completed": list(r.steps_completed),
                "steps_failed": list(r.steps_failed),
                "started_at": r.started_at,
                "completed_at": r.completed_at,
            }
            for r in runs
        ]


# Singleton
workflow_executor = WorkflowExecutor()
