# Dashboard Investor-Ready Plan — Completion Checklist

All items below are **implemented**. Use this file as the single source of truth for plan status.

---

## Completed items

### 1. Remove duplicate Capital at Risk from Global Risk Posture header
- **Status:** DONE
- **Change:** Global Risk Posture block in Dashboard shows only posture level and arrow; no "Capital at Risk (30d)" in the header. Capital at Risk appears only in the first KPI card.
- **Where:** `apps/web/src/pages/Dashboard.tsx` — header block lines 775–782 contain only "Global Risk Posture" and posture level; KPI card with Capital at Risk at lines 791–799.

### 2. Create centralized formatEur() and replace ad-hoc formatters
- **Status:** DONE
- **Change:** Added `apps/web/src/lib/formatCurrency.ts` with `formatEur(value, 'base' | 'millions')`. Dashboard and AlertPanel use it; removed local `formatBillionsEur` / `formatCurrency`.
- **Where:**
  - `apps/web/src/lib/formatCurrency.ts` — central implementation
  - `apps/web/src/pages/Dashboard.tsx` — import `formatEur`, use for Capital at Risk and Stress Loss P95
  - `apps/web/src/components/AlertPanel.tsx` — import `formatEur`, use for exposure and expected loss

### 3. Change ClimateWidget city badges from C/H/M to CRIT/HIGH/MED
- **Status:** DONE
- **Change:** City risk badges show "CRIT", "HIGH", "MED" instead of "C", "H", "M".
- **Where:** `apps/web/src/components/ClimateWidget.tsx` line 297: `riskLevel === 'critical' ? 'CRIT' : riskLevel === 'high' ? 'HIGH' : 'MED'`

### 4. Fix Layer 0 "Verified Truth" when verification_rate=0
- **Status:** DONE
- **Change:** When `verification_rate` is 0, Layer 0 status is "pending" and description is "Verification not yet configured".
- **Where:** `apps/api/src/api/v1/endpoints/platform.py` — `l0_verification_rate` used to set `status` and `description` for Layer 0 (lines 313–321).

### 5. Use centralized formatter for Stress Loss P95 (e.g. €1424M → €1.4B)
- **Status:** DONE
- **Change:** Stress Loss P95 is rendered with `formatEur(institutionalKPIs.stressLossP95, 'millions')`, so large values display as €1.4B.
- **Where:** `apps/web/src/pages/Dashboard.tsx` line 805: `{formatEur(institutionalKPIs.stressLossP95, 'millions')}`

### 6. Add FreshnessIndicator to major Dashboard widgets
- **Status:** DONE
- **Change:** Added `FreshnessIndicator` component; used in Platform Layers footer and System Overseer widget. Shows "Updated X min ago" and "Stale" when data is older than TTL.
- **Where:**
  - `apps/web/src/components/dashboard/FreshnessIndicator.tsx` — new component
  - `apps/web/src/pages/Dashboard.tsx` — import and use in Platform Layers block: `<FreshnessIndicator timestamp={platformData.last_sync} ttlMinutes={60} label="Last sync" />`
  - `apps/web/src/components/dashboard/SystemOverseerWidget.tsx` — import and use: `<FreshnessIndicator timestamp={timestamp} ttlMinutes={10} label="Updated" />`

---

## How to verify

1. **Capital at Risk:** Open Dashboard — only one "Capital at Risk" value (in the 4-KPI row), not in the Global Risk Posture header.
2. **formatEur:** Same page — Capital at Risk and Stress Loss use readable units (e.g. €33.7M, €1.4B). AlertPanel shows amounts with formatEur.
3. **Climate badges:** Climate Risk Monitor city list shows CRIT/HIGH/MED, not single letters.
4. **Layer 0:** Platform Layers → Layer 0 shows "pending" and "Verification not yet configured" when DB has no verified provenance.
5. **Stress Loss:** Large stress loss (e.g. 1424 millions) displays as €1.4B.
6. **Freshness:** Platform Layers footer and System Overseer show "Last sync X min ago" / "Updated X min ago"; stale data shows "Stale" badge.
