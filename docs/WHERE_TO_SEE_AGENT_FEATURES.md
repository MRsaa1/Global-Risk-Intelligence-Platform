# Where to See Agent Features in the UI

The **Real-Time Threat Feed** (GDELT, Twitter, Reddit, Telegram) is **not** part of the agent updates. It shows external threat signals; "0 signals" means that feed is empty or not populated.

The **new agent features** (workflow templates, unified audit, metrics, ARIN, proactive remediation) are visible here:

---

## 1. Dashboard → System Overseer (full widget)

- **URL:** [http://127.0.0.1:5180/dashboard](http://127.0.0.1:5180/dashboard) — scroll to the **System Overseer** card.
- **You’ll see:**
  - Executive summary, status (Healthy / Degraded / Critical), system alerts.
  - **"Actions taken by Overseer"** when the agent auto-fixed something.
  - **New:** **Agent metrics (24h):** "Cycles 24h", "Auto-fix 24h", "AI-Q tools 24h".
  - **New:** **"Show last agent actions (audit)"** — opens the unified log (Overseer + agentic_orchestrator + ARIN).
- **Actions:** "Try to fix", "Refresh", "Ask" (Overseer via AI-Q).

---

## 2. Command Center → Overseer strip + AI-Q chat

- **URL:** [http://127.0.0.1:5180/command](http://127.0.0.1:5180/command).
- **Overseer (compact):** Top bar — status dot, "Overseer", "Agent fixed: N actions" when applicable.
- **AI-Q (floating button / chat):**
  - **Workflow triggers:** Type **"quarterly risk report"**, **"infrastructure health"**, or **"alert triage"** (or RU: "квартальный отчёт", "здоровье инфраструктуры", "триаж алертов") → runs the corresponding workflow (steps + result).
  - **Composite (multi-step):** Type **"check and fix"** or **"проверь и почини"** → Agentic Orchestrator runs several tools (e.g. oversee, agents) and returns "Done: Step 1 … Step 2 …".

---

## 3. ARIN — Risk & Intelligence OS

- **URL:** [http://127.0.0.1:5180/arin](http://127.0.0.1:5180/arin).
- Multi-agent risk assessment by object type (stress_test, infrastructure, asset, etc.); coordinator (ARIN) + specialists; consensus + DAE; human-in-the-loop on CRITICAL / high impact.

---

## 4. Proactive remediation (on CRITICAL alert)

- When the alerts system broadcasts a **CRITICAL** alert (e.g. from SENTINEL), the backend runs one Overseer cycle and attaches `proactive_remediation.actions` to the WebSocket message.
- Any UI that shows live alerts can display "Agent already ran remediation: …" from that payload.

---

## 5. API only (no UI yet)

- **Unified audit log:** `GET /api/v1/oversee/agent-actions?source=all` (or `source=overseer` | `arin` | `agentic_orchestrator`).
- **Feedback for AI-Q:** `POST /api/v1/aiq/feedback` (request_id, feedback: positive|negative, comment). Used for future fine-tuning; optional thumbs up/down in chat can call this.

---

**Summary:** For the **new agent updates**, use **Dashboard (Overseer widget with metrics + "Show last agent actions")** and **Command Center (AI-Q chat with workflow/composite phrases)**. The **Threat Feed** is a separate data feed and stays 0 until that pipeline is populated.
