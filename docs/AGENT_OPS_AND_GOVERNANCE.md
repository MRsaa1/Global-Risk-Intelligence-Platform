# Agent Operations and Governance

This document describes **observability**, **audit**, **human-in-the-loop**, and **explainability** for the platform’s AI agents. It supports regulatory and enterprise requirements for “what did the agents do?” and “who is accountable?”.

---

## 1. Audit trail of agent actions

- **Unified log:** All material agent actions are recorded in a single audit stream (in-memory ring buffer; optional DB persistence can be added later).
  - **Sources:** Overseer (each `auto_resolution` action), agentic_orchestrator (each successful tool call), and optionally ARIN (each `assess`).
  - **Fields per record:** `source`, `agent_id`, `action_type`, `input_summary`, `result_summary`, `timestamp`, optional `meta`.
- **API:** `GET /api/v1/oversee/agent-actions?source=all&limit=50` returns the most recent entries from the unified log. Without `source=all`, the response is limited to the last Overseer cycle’s `auto_resolution_actions` for backward compatibility.
- **Purpose:** Single place for “what did the agents do?” — foundation for AgentOps and compliance reporting.

**Implementation:** [apps/api/src/services/agent_actions_log.py](../apps/api/src/services/agent_actions_log.py); writes from [oversee.py](../apps/api/src/services/oversee.py) and [agentic_orchestrator.py](../apps/api/src/services/agentic_orchestrator.py).

---

## 2. Human-in-the-loop (HITL)

- **ARIN escalation:** When the multi-agent assessment (ARIN) yields **CRITICAL** risk, or **HIGH** with severity above threshold, or financial impact above €10M, or life-safety relevance, the decision object is flagged with `human_confirmation_required=True` and an `escalation_reason`. The verdict and suggested actions are then subject to human review before execution.
- **Overseer:** Auto-resolution (circuit breaker resets, agent restarts, etc.) is configurable; critical actions can be limited or disabled so that only humans trigger them.
- **Audit:** All auto-resolutions and tool calls are logged (see §1), so regulators and operators can see what was done automatically vs what required human approval.

**Implementation:** ARIN logic in [apps/api/src/services/arin_orchestrator.py](../apps/api/src/services/arin_orchestrator.py) (verdict, human_confirmation_required, escalation_reason); Overseer rules and auto_resolve behaviour in [oversee.py](../apps/api/src/services/oversee.py).

---

## 3. Explainability

- **Consensus and dissent:** ARIN returns not only the aggregated risk level but also per-agent assessments and dissent records (who disagreed and why). This supports “why did the system say CRITICAL?”.
- **DAE (Decision Audit Engine):** Each ARIN decision is evaluated and audited by the DAE, providing a structured audit trail for the decision.
- **Orchestrator steps:** The agentic orchestrator returns a list of steps (e.g. “Done: Step 1: …, Step 2: …”) so the user sees which tools were run and in what order. The same steps are reflected in the agent actions log.
- **Overseer summary:** The executive summary and optional LLM summary explain current system state and what the Overseer did (e.g. “Redis circuit breaker reset”).

**Implementation:** [consensus_engine](../apps/api/src/services/consensus_engine.py), [dae](../apps/api/src/services/dae.py), [agentic_orchestrator](../apps/api/src/services/agentic_orchestrator.py), [oversee](../apps/api/src/services/oversee.py).

---

## 4. Metrics (measurable impact)

- **Overseer status** includes `agent_metrics` for the last 24 hours:
  - `oversee_cycles_count_24h`
  - `auto_resolution_count_24h`
  - `aiq_tool_calls_count_24h`
- These support “measurable business impact” (e.g. fewer manual triages, faster recovery) and can be exposed in the Command Center or dashboards.

**Implementation:** [oversee.py](../apps/api/src/services/oversee.py) `_get_agent_metrics_24h()`, returned in `get_status()` under `agent_metrics`.

---

## 5. References

- [SPECIALIZED_RISK_AGENT.md](SPECIALIZED_RISK_AGENT.md) — Risk Agent identity and evolution alignment
- [IDENTITY.md](../IDENTITY.md) — Platform identity and “agent-first” narrative
- [AGENT_SELF_HEALING.md](AGENT_SELF_HEALING.md) — Overseer self-healing behaviour
- [MASTER_PLAN.md](../MASTER_PLAN.md) — Roadmap (Multi-Agent / Agent OS, fine-tuning, audit)
