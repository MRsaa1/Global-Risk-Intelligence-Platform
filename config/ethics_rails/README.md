# Ethics Rails — ARIN / Ethicist

Config for ethical guardrails used by the Ethicist agent. Compatible with **NeMo Guardrails** (Colang flows) and rule-based fallback.

## Structure

| File | Purpose |
|------|---------|
| `harm_prevention.yml` | Prevent recommendations that could cause physical or existential harm |
| `fairness.yml` | Bias and fairness checks across populations and groups |
| `protect_pii.yml` | PII detection and redaction in inputs/outputs |

## Colang (NeMo Guardrails)

When NeMo Guardrails are connected, equivalent flows can be defined in `.colang`:

- **harm_prevention**: Block outputs that suggest lethal action, mass harm, or irreversible existential risk.
- **fairness**: Require equity checks before high-impact decisions.
- **protect_pii**: Redact or flag PII in user content and model outputs.

Rails are loaded from these YAML files and applied in the Ethicist pipeline; optional NeMo Guardrails API runs Colang flows when `NEMO_GUARDRAILS_URL` is set.

## Module matrix

Which rails apply to which source module is defined in `apps/api/src/services/ethics_rails.py` (module_check_matrix).
