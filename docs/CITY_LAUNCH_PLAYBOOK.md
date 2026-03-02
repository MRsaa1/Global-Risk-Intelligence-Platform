# City Launch Playbook — 6–12 weeks

Process from sign-up to live city in 6–12 weeks without long integration consulting.

## Phases

| Phase | Weeks | Goals | Responsible |
|-------|--------|--------|-------------|
| **1. Onboarding** | 1–2 | Request received, reviewed, tenant/municipality created; base geography (boundaries, centroid) and pilot hazards (flood, heat) connected | Sales / Ops |
| **2. First assessment** | 3–6 | First risk run (Community Risk API), first Municipal Climate Insurability Report (draft), alerts configured for region | Delivery |
| **3. Go-live** | 7–12 | Adaptation plan (measures + grants), first disclosure export, subscription/contract signed | Delivery + Legal |

## Checklist (API)

Use **GET** `/api/v1/cadapt/launch-checklist?municipality_id={id}` to get:

- `steps`: list of steps with `id`, `label`, `done`
- `all_done`: true when all steps are complete

Steps:

1. **weeks_1_2** — Onboarding: request approved, tenant created  
2. **risk_assessed** — First risk assessment (Community Risk API)  
3. **first_report** — First Insurability Report (draft)  
4. **alerts_set** — Alerts configured for region  
5. **weeks_7_12** — Adaptation plan + disclosure export  
6. **subscription** — Subscription / contract signed  

## UI

In **Municipal Dashboard**, open the «Launch progress» block (or subscription tab): same steps with checkmarks from the API.

## References

- Endpoint: `apps/api/src/api/v1/endpoints/cadapt.py` (`/launch-checklist`)
- Onboarding: `MunicipalOnboardingRequest` (status: pending → in_review → onboarded)
- Subscriptions: `MunicipalSubscription` (tenant_id, status active)
