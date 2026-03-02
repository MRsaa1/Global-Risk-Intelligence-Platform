# Incident postmortem template

Use this template after a P1 or higher incident. Complete within the agreed window (e.g. 3–5 business days).

---

## Header

- **Title:** [Short descriptive title]
- **Date of incident:** YYYY-MM-DD
- **Time window (UTC):** HH:MM – HH:MM
- **Author(s):**
- **Status:** Draft | Final

---

## Summary

1–2 sentences: what happened, what was affected, and what was done to restore service.

---

## Affected systems

- API / Frontend / DB / Redis / WS / External dependency / Other: …

---

## Timeline

| Time (UTC) | Event |
|------------|--------|
| … | … |

---

## Root cause

Brief explanation of the underlying cause (not only the trigger).

---

## Impact

- Users/requests affected
- Duration of degradation
- Data loss or corruption (if any)

---

## Resolution

What was done to restore service (steps, rollback, fix deploy, etc.).

---

## Action items

| Action | Owner | Due | Done |
|--------|--------|-----|------|
| … | … | … | [ ] |

---

## Lessons and recommendations

- What we will do differently (monitoring, runbooks, code, process).
- Link to runbook or doc updates if created.

---

## References

- Monitoring: [MONITORING.md](MONITORING.md), [RUNBOOK_ONCALL.md](RUNBOOK_ONCALL.md)
- Release checklist: [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)
