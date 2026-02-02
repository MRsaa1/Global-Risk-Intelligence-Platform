# Generative AI: Use Cases and Endpoints

**Scope:** How Generative AI (NVIDIA NIM / LLM) is used across the platform for reports, explanations, recommendations, disclosure drafts, chat, agents, and data synthesis.

---

## 1. Mapping: Direction → Implementation

| Direction | How it helps | API / Service | Notes |
|-----------|---------------|---------------|-------|
| **Reports & summaries** | Executive summary for stress tests, flood zone conclusions, scenario conclusions (e.g. San Francisco +0.5 m) in natural language | Stress test `execute` (executive_summary), AIQ context, Reporter PDF | Existing; LLM in stress_tests and Reporter |
| **Explain scenarios** | "Why is this zone at risk?", "What does NGFS SSP5 mean for the portfolio?" — short, coherent text | `POST /api/v1/generative/explain-zone`, `POST /api/v1/generative/explain-scenario` | New; `generative_ai.py` |
| **Recommendations** | Text recommendations for mitigation, next steps after stress test, zone priorities | `POST /api/v1/generative/recommendations`; also stress test response and ADVISOR | New endpoint + existing agents |
| **Documents & regulation** | Draft disclosures, explanatory notes for stress tests under EBA/Fed/NGFS | `POST /api/v1/generative/disclosure-draft` | New |
| **Chat & Q&A** | "Ask about risks/portfolio/scenario" — dialog answers | `POST /api/v1/aiq/ask` | Existing AIQ |
| **Agent explanations** | SENTINEL/ANALYST: short explanations of alerts and recommendations | `POST /api/v1/agents/alert/{id}/analyze-and-recommend` (field `explanation`); `POST /api/v1/generative/alert-explanation` | New field + standalone endpoint |
| **Data synthesis** | Weather + geodata + historical events → one coherent summary | `POST /api/v1/generative/synthesize` | New |

---

## 2. API Reference

Base path: `/api/v1/generative`. All endpoints accept optional auth (work with or without login).

### Explain zone

- **POST /generative/explain-zone**  
  Body: `{ "zone_data": { ... }, "question": "Why is this zone at risk?" }`  
  Returns: `{ "explanation": "..." }`

### Explain scenario

- **POST /generative/explain-scenario**  
  Body: `{ "scenario_name": "NGFS SSP5", "scenario_context": {}, "portfolio_context": "..." }`  
  Returns: `{ "explanation": "..." }`

### Recommendations (text)

- **POST /generative/recommendations**  
  Body: `{ "stress_result": {}, "scenario_name": "", "zones_summary": "" }`  
  Returns: `{ "recommendations": "..." }`

### Disclosure draft

- **POST /generative/disclosure-draft**  
  Body: `{ "context": { ... }, "framework": "NGFS" }` — framework: EBA, Fed, or NGFS  
  Returns: `{ "draft": "...", "framework": "NGFS" }`

### Synthesize sources

- **POST /generative/synthesize**  
  Body: `{ "sources": [ { "kind": "weather", "data": {} }, { "kind": "historical_event", "snippet": "..." } ] }`  
  Returns: `{ "summary": "..." }`

### Alert explanation

- **POST /generative/alert-explanation**  
  Body: `{ "alert_title": "...", "alert_message": "...", "alert_type": "", "severity": "" }`  
  Returns: `{ "explanation": "..." }`

---

## 3. Chat & Q&A (existing)

- **POST /api/v1/aiq/ask**  
  Body: `{ "question": "...", "asset_id": null, "project_id": null, "include_overseer_status": true, "context": {} }`  
  Returns: `{ "answer": "...", "sources": [ ... ] }`  

Use for: "Ask about risks/portfolio/scenario" in the UI (dialog, not only dashboards).

---

## 4. Agent integration

- **POST /api/v1/agents/alert/{alert_id}/analyze-and-recommend**  
  Response now includes **`explanation`**: short LLM-generated text explaining what the alert means and why it matters (2–3 sentences).  
  Frontend can show this next to analysis and recommendations.

---

## 5. Service layer

- **`src/services/generative_ai.py`**  
  - `explain_zone(zone_data, question)`  
  - `explain_scenario(scenario_name, scenario_context, portfolio_context)`  
  - `recommendations_text(stress_result, scenario_name, zones_summary)`  
  - `disclosure_draft(context, framework)`  
  - `synthesize_sources(sources)`  
  - `alert_explanation(alert_title, alert_message, alert_type, severity)`  

All use `nvidia_llm.llm_service` (Llama 70B for most; Llama 8B for alert_explanation). Fallback to plain text message if LLM is unavailable.

---

## 6. UI integration (suggested)

- **Explain zone:** On zone click or tooltip: "Explain" → call `/generative/explain-zone`, show modal or panel.
- **Explain scenario:** On scenario card: "What does this mean?" → `/generative/explain-scenario`.
- **Recommendations:** After stress test: "Get text recommendations" → `/generative/recommendations` with result context.
- **Disclosure draft:** In report/export flow: "Generate EBA/Fed/NGFS draft" → `/generative/disclosure-draft`.
- **Chat:** Dedicated "Ask about risks" panel using `/aiq/ask`.
- **Alert explanation:** In AlertPanel, show `response.explanation` when "Analyze & Recommend" returns.

---

Version: 2026-01-30
