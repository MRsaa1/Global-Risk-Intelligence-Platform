# Pilot readiness checklist (Weeks 12–13)

Use this checklist before pilot launch and for Go/No-Go. Fill in dates and owners where applicable.

---

## Before pilot

- [ ] **Security re-audit** — Checklist or external audit completed.  
  Date: ___________  Owner: ___________

- [ ] **Performance re-audit** — Load and critical paths validated.  
  Date: ___________  Owner: ___________

---

## Disaster drill

- [ ] **DB failure** — Procedure documented; restore tested (or script in `scripts/`).  
  Notes: ___________

- [ ] **WS/API failure** — Restart and health-check procedure verified.  
  Notes: ___________

- [ ] **Scripts** — If present in repo (e.g. `scripts/`), listed and owned.  
  List: ___________

---

## Release candidate

- [ ] **Release candidate created** — Tag and/or artifact.  
  Ref: [RELEASE_CHECKLIST.md](RELEASE_CHECKLIST.md)  
  Tag/URL: ___________

---

## Steering review

- [ ] **Steering review conducted** — KPI from 90-day plan recorded.  
  Date: ___________  
  KPI reference: 90-day plan (P0/P1 = 0, CI pass rate ≥ 95%, lint = 0 in critical files, MTTR, moat demo).

---

## Roadmap Q3 2026

- [ ] **Roadmap Q3 2026 approved**  
  Document: [ROADMAP_Q3_2026.md](ROADMAP_Q3_2026.md) (or link)  
  Date: ___________

---

## Go/No-Go criteria (summary)

- All P0/P1 security items closed
- CI stable and blocking
- Visual critical path free of lint/runtime blockers
- SLO / security / ROI artifacts ready for pilot sales
