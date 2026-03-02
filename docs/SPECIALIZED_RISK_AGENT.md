# Specialized Risk Agent

This document describes the platform’s **Risk Agent**: what it is, what domain data and scenarios it uses, and how it differs from a generic AI assistant.

## What the Risk Agent Is

The Risk Agent is a **specialized AI** for physical-financial risk. It is not a generic chatbot. It:

- **Monitors** portfolios and infrastructure 24/7 (SENTINEL, Overseer).
- **Triages** alerts and system health (Overseer rules, circuit breakers).
- **Runs** stress scenarios and diagnostics on demand (AI-Q, agentic orchestrator).
- **Acts** autonomously where configured: self-healing (Overseer `auto_resolve_issues`), remediation commands (start/stop agents, reset circuit breakers, run oversee).
- **Answers** questions with domain context: stress tests, risk zones, compliance (CIP, SCSS, SRO, ASGI), climate, and platform status.

In product narrative, **AI-Q** (conversation), **Overseer** (health + self-healing), and **SENTINEL** (real-time alerts) are one agent with different modes: chat, monitoring, and remediation.

## Domain Data and Scenarios the Agent Uses

| Domain | Data / scenarios | Where used |
|--------|------------------|------------|
| **Stress tests** | Flood, earthquake, hurricane, climate, credit, geopolitical, cyber, pandemic, etc. | Stress test APIs, AI-Q context, reports, cascade |
| **Risk zones** | Geo layers, H3 grid, zone levels (Critical / High / Medium / Low) | Command Center, risk zone analysis, AI-Q explanations |
| **Entity ontology** | Healthcare, Financial, Enterprise, Infrastructure, Airport, etc. and their risk zones | [config/entity_ontology.json](../config/entity_ontology.json), stress and zone logic |
| **Regulatory / compliance** | CIP, SCSS, SRO, ASGI, ERF, BIOSEC, ASM, CADAPT modules | Strategic modules, compliance dashboard, AI-Q and agents |
| **Platform health** | DB, Redis, Neo4j, NVIDIA services, SENTINEL, circuit breakers, endpoints | Overseer snapshot, AI-Q `overseer_status`, self-healing |
| **Assets, portfolios, projects** | Digital twins, portfolios, project finance | Layer 1–5 metrics, AI-Q context when provided |

The agent’s answers and actions are grounded in this data (APIs, status, citations). It does not rely only on general knowledge.

## How This Differs from a Generic Chatbot

| Aspect | Generic AI | Risk Agent |
|--------|------------|------------|
| **Scope** | Broad Q&A | Physical-financial risk, platform operations, stress tests, compliance |
| **Data** | Public / training data | Live platform data: oversee status, stress results, zones, modules, health |
| **Actions** | Usually none | Runs diagnostics, remediation (oversee, agents, circuit breakers), navigation |
| **Autonomy** | Reactive only | Proactive: Overseer runs on a schedule and self-heals; SENTINEL monitors continuously |
| **Output** | Free-form text | Citations, actions (open health, run stress test), and structured remediation results |

We position on **outcomes** (e.g. less manual triage, faster decisions, fewer missed risks) and **domain accuracy** (stress scenarios, regulatory context, platform state), not on “AI feature” alone.

## Roadmap: Fine-Tuning and Client Data

Planned direction (no fixed implementation date):

- **Fine-tuning / adaptation** of the agent’s language model on **client- or portfolio-specific data** (e.g. historical incidents, internal stress scenarios, precedent decisions). This would deepen specialization per enterprise.
- **Metrics** for measurable impact (e.g. time to triage, number of auto-remediations, usage of agent actions) to support “measurable business impact” and trust.

### End-to-end scenario: client fine-tuning (Phase C3)

One verified flow from upload to agent answers with client context:

1. **Upload a client dataset**  
   `POST /api/v1/agents/fine-tuning/datasets` with a file (JSON/CSV of portfolios, incidents, or precedents per platform schema). The API stores the file under `data/finetune/datasets/{id}/` and creates a `client_finetune_datasets` record.

2. **Run fine-tuning**  
   `POST /api/v1/agents/fine-tuning/run` with body `{ "dataset_id": "<id>", "task": "risk_analysis" }`. The pipeline calls the NeMo Customizer (or mock); a `client_finetune_runs` record is created with status `completed` and `model_path_or_id` (mock or real).

3. **Enable the client model**  
   `PUT /api/v1/agents/fine-tuning/settings` with body `{ "use_client_finetune_model": true, "active_run_id": "<run_id>" }` (or `client_model_path`). Settings are persisted in `data/finetune_output/agent_finetune_settings.json`.

4. **Ask the agent with client context**  
   Use AI-Q (e.g. `POST /api/v1/aiq/ask`). When client model is enabled, the draft step injects a **client context** snippet into the system prompt. With a real NeMo deployment, the LLM endpoint can be switched to the fine-tuned model; with mock, the same LLM is used and the prompt carries the client context.

**Checklist:** Upload dataset → run → set settings with `active_run_id` → one AI-Q question; response should reflect that the agent is using client-specific context.

See also: [NVIDIA_NEMO_INTEGRATION.md](NVIDIA_NEMO_INTEGRATION.md) (Customizer, config, script), [IDENTITY.md](../IDENTITY.md), [AGENT_SELF_HEALING.md](AGENT_SELF_HEALING.md), [PRODUCT_MODEL_3D_FINTECH.md](PRODUCT_MODEL_3D_FINTECH.md).

## Evolution alignment

The platform sits at the boundary of **Generation 1 (Specialists)** and **Generation 2 (Coordinators)** — i.e. **Виток 1–2** in the evolution model.

| Виток | Generic | Specialized (us) | Our status |
|-------|---------|------------------|------------|
| **2025–2026 (1)** | Personal assistants, single-task | Vertical domain agents, tool use | ✅ SENTINEL, ANALYST, ADVISOR, Overseer, AI-Q; domain (risk, CIP/SCSS/SRO); tools (oversee, circuit breakers, Jira/ServiceNow). |
| **2026–2028 (2)** | Agent OS, dynamic composition | Autonomous experts, CoT + tools, self-improvement | Partially: ARIN (multi-agent by object_type), agentic Reason→Plan→Act, consensus_engine. Planned: shared context, persistent memory, self-improvement loop. |
| **2027–2028 (3)** | Cognitive companions, enterprise orchestrators | Multi-agent teams, agent societies | Foreshadowed: modular agents (CIP_SENTINEL, SRO_SENTINEL, etc.) in one loop; ARIN by object_type. Not yet: agent-to-agent negotiation, hierarchy, marketplace. |

- **Already in place (Виток 2 elements):** orchestration (ARIN by object type, agentic Reason→Plan→Act), multi-agent consensus (consensus_engine, DAE), tool use (oversee, circuit breakers, Jira/ServiceNow). Modular agents (CIP, SCSS, SRO, ASGI, etc.) are composed in one monitoring loop and in ARIN routing. Unified agent audit log (Overseer + agentic) and 24h metrics in Overseer status.
- **Planned (no fixed dates):** shared context for request-scoped agent chains; optional ARIN entries in agent audit; workflow templates (report, assessment, remediation); proactive remediation on critical alert; feedback (thumbs up/down) for fine-tuning; fine-tuning on client data (see Roadmap above).

**Roles (ARIN):** The **coordinator** is ARIN: it aggregates specialist assessments, runs consensus and DAE, and produces the final verdict. **Specialists** (SENTINEL, ANALYST, ADVISOR, ETHICIST, and module agents like CIP_SENTINEL, SRO_SENTINEL) only provide assessments; they do not decide the final outcome. This prepares for future “agent society” hierarchy without changing the stack.

See also: [AGENT_OPS_AND_GOVERNANCE.md](AGENT_OPS_AND_GOVERNANCE.md), [MASTER_PLAN.md](../MASTER_PLAN.md) roadmap section.
