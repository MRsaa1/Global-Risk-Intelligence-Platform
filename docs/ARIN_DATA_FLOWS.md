# ARIN Data Flows — Global Risk Platform

This document describes the complete data flow between the **Global Risk Platform**
(`risk.saa-alliance.com`, port 9002) and the **ARIN Platform** (`arin.saa-alliance.com`, port 8000).

---

## 1. Two ARIN Layers

| Layer | Where | Purpose |
|-------|-------|---------|
| **Internal ARIN** | Inside Global Risk | Local agents (SENTINEL, ANALYST, ADVISOR, ETHICIST, CIP/SCSS/SRO) operate on platform data. Accessed via `/api/v1/agents`, `/api/v1/arin/assess`, etc. |
| **External ARIN** | `arin.saa-alliance.com` | Central risk intelligence with 12 specialized agents and a unified verdict engine. Receives data from all SAA modules via Export API. |

---

## 2. Entity ID Convention

All entity IDs must be stable and reusable across systems. They serve as the **join key**
between Global Risk and External ARIN.

| Pattern | Example | Used for |
|---------|---------|----------|
| `portfolio_global` | `portfolio_global` | Default portfolio (matches ARIN) |
| `zone_{city}_{scenario}` | `zone_houston_flood` | Risk zones after stress tests |
| `asset_{type}_{id}` | `asset_building_42` | Individual physical assets |
| `portfolio_{uuid}` | `portfolio_a1b2c3d4` | Specific portfolio aggregates |
| `scenario_{name}_{severity}` | `scenario_hurricane_cat5_extreme` | Stress test scenarios |

Helper functions are available in `apps/api/src/services/arin_export.py`:

```python
from src.services.arin_export import (
    make_zone_entity_id,
    make_asset_entity_id,
    make_portfolio_entity_id,
    make_scenario_entity_id,
)
```

---

## 3. Export Payload Schema

**Endpoint:** `POST https://arin.saa-alliance.com/api/v1/unified/export`

**Headers:** `Content-Type: application/json` (+ optional `X-API-Key` if configured)

```json
{
    "source": "risk_management",
    "entity_id": "portfolio_global",
    "entity_type": "portfolio",
    "analysis_type": "global_risk_assessment",
    "data": {
        "risk_score": 65.4,
        "risk_level": "HIGH",
        "summary": "Portfolio: 42 assets, climate=58%, physical=45%, network=38%.",
        "recommendations": ["Review sector exposure", "Consider hedging"],
        "indicators": {
            "avg_climate_risk": 58,
            "avg_physical_risk": 45,
            "total_assets": 42
        },
        "image_url": "https://storage.example.com/inspections/building42.jpg",
        "data_sources": ["FEMA", "NOAA", "CMIP6", "local_sensors"]
    }
}
```

**Key rules:**
- `source` must be `"risk_management"` (maps to "Global Risk" in ARIN UI)
- `entity_id` must match an entity registered in ARIN (e.g. `portfolio_global`)
- After first successful POST, Global Risk appears as **Online** in ARIN Data Sources Status

### Analysis Types

| Type | Used by |
|------|---------|
| `global_risk_assessment` | Analytics portfolio summary |
| `stress_test` | Stress test results |
| `compliance_check` | SRO/compliance checks |
| `physical_asset_assessment` | Physical asset + image for Cosmos Reason 2 |

---

## 4. Verdict Response Schema

**Endpoint:** `GET {ARIN_BASE_URL}/api/v1/unified/verdict/{entity_id}`

```json
{
    "entity_id": "portfolio_global",
    "verdict": "AVOID",
    "risk_score": 87.3,
    "confidence": 0.82,
    "agent_results": {
        "market_risk": { "risk_score": 72, "reasoning": "..." },
        "credit_risk": { "risk_score": 65, "reasoning": "..." },
        "physical_asset_risk": {
            "risk_score": 91,
            "reasoning": "Flood damage assessment from Cosmos Reason 2...",
            "recommendations": ["...", "..."]
        }
    },
    "sources": ["risk_management", "news_analytics", "risk_analyzer"]
}
```

Verdict values: `BUY`, `SELL`, `HOLD`, `AVOID`.

---

## 5. Sending Media for Physical Asset Risk (Cosmos Reason 2)

ARIN includes a **Physical Asset Risk** agent that analyzes images/video using
**NVIDIA Cosmos Reason 2**. The agent looks for media URLs in the `data` payload.

### Supported media fields in `data` (priority order)

| Field | Description |
|-------|-------------|
| `image_url` | URL of image (JPEG, PNG, WebP, GIF, BMP, TIFF) |
| `media_url` | URL of image or video |
| `video_url` | URL of video (MP4, WebM, MOV, AVI) |
| `asset_image` | Alternative field for asset image URL |
| `photo_url` | Alternative field for photo URL |

URLs may start with `http://`, `https://`, or `data:` (base64 data URI).

Nested structures are also supported: `data.media.image_url`, `data.assets[].image_url`.

### How it works

1. Global Risk sends export with `image_url` in `data`
2. During Unified Analysis, the Physical Asset Risk agent:
   - Checks `task.parameters` for `media_path`/`media_url`
   - If not found, searches exports for the `entity_id` for media URLs
   - If `image_url` is found, sends it to **Cosmos Reason 2** for visual analysis
   - Returns: `risk_score`, `severity`, `findings`, `recommendations`, `reasoning`
3. If `COSMOS_REASON2_URL` is not configured, the agent returns a data-only assessment

### Base64 screenshots

When Global Risk captures a DOM screenshot via `html2canvas`, the base64 string is
converted to a `data:` URI on the backend:

```python
# In arin_export.py — base64 becomes a data: URI in image_url
export_data["image_url"] = f"data:image/png;base64,{image_base64}"
```

ARIN accepts `data:` URIs in the `image_url` field.

### Direct file upload (alternative)

ARIN also supports multipart file upload:

```bash
curl -X POST "https://arin.saa-alliance.com/api/v1/unified/physical-asset-analyze" \
  -F "entity_id=asset_building_42" \
  -F "entity_type=asset" \
  -F "media=@/path/to/inspection_photo.jpg"
```

### Without media

If no media URL is present but `risk_score`, `risk_level`, `summary` are provided,
the agent uses them for a data-only assessment with reduced confidence (`0.5`).

---

## 6. API Endpoints (Global Risk Side)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/v1/arin/assess` | Run internal multi-agent risk assessment |
| `POST` | `/api/v1/arin/export` | Manual export to external ARIN Platform |
| `GET`  | `/api/v1/arin/verdict/{entity_id}` | Proxy: fetch verdict from external ARIN |
| `POST` | `/api/v1/arin/physical-asset` | Export image + data for Cosmos analysis |
| `GET`  | `/api/v1/arin/human-reviews` | List pending human-in-the-loop reviews |
| `POST` | `/api/v1/arin/human-reviews/{id}/resolve` | Approve or reject escalation |

---

## 7. Configuration

| Variable | Example | Purpose |
|----------|---------|---------|
| `ARIN_BASE_URL` | `https://arin.saa-alliance.com` | Base URL for verdict proxy + fallback export |
| `ARIN_EXPORT_URL` | `https://arin.saa-alliance.com/api/v1/unified/export` | Explicit export endpoint |
| `ARIN_API_KEY` | *(empty unless required)* | `X-API-Key` authentication header |
| `ARIN_DEFAULT_ENTITY_ID` | `portfolio_global` | Fallback entity ID (must exist in ARIN) |

If only `ARIN_EXPORT_URL` is set, the base URL is derived from it for verdict calls.
If only `ARIN_BASE_URL` is set, the export URL is constructed as `{base}/api/v1/unified/export`.

---

## 8. Sequence Diagram

```mermaid
sequenceDiagram
    participant UI as GlobalRisk_UI
    participant API as GlobalRisk_API
    participant ARIN as ARIN_Platform
    participant Cosmos as Cosmos_Reason2

    Note over UI,Cosmos: Standard Export Flow
    UI->>API: POST /arin/export
    API->>ARIN: POST /unified/export (source=risk_management)
    ARIN-->>API: export_id
    API-->>UI: success (Global Risk now Online in ARIN)

    Note over UI,Cosmos: Physical Asset Export with Image
    UI->>UI: html2canvas screenshot to base64
    UI->>API: POST /arin/physical-asset (base64 + data)
    API->>ARIN: POST /unified/export (image_url=data:image/png;base64,...)
    ARIN->>Cosmos: Analyze image via Cosmos Reason 2
    Cosmos-->>ARIN: Text reasoning + risk_score
    ARIN-->>API: export_id

    Note over UI,Cosmos: Verdict Retrieval
    UI->>API: GET /arin/verdict/{entity_id}
    API->>ARIN: GET /unified/verdict/{entity_id}
    ARIN-->>API: verdict + agent_results (incl. physical_asset_risk)
    API-->>UI: ARINVerdictBadge data
```

---

## 9. Frontend Components

| Component | File | Purpose |
|-----------|------|---------|
| `SendToARINButton` | `apps/web/src/components/SendToARINButton.tsx` | Assess + export button with Physical AI checkbox |
| `ARINVerdictBadge` | `apps/web/src/components/ARINVerdictBadge.tsx` | Compact verdict pill (BUY/SELL/HOLD/AVOID) |
| `ARINWidget` | `apps/web/src/components/dashboard/ARINWidget.tsx` | Dashboard card |
| `ARINPage` | `apps/web/src/pages/ARINPage.tsx` | Full ARIN page (assess, decisions, reviews) |
| `DecisionObjectCard` | `apps/web/src/components/DecisionObjectCard.tsx` | Decision display card |

---

## 10. Source Registration in ARIN

Global Risk is registered as `"risk_management"` in ARIN and displays as **"Global Risk"** in the UI.
The export payload always includes `"source": "risk_management"`.

After the first successful export, Global Risk will appear:
- In **Data Sources Status** as **Online**
- In **Select Data Sources** dropdown during Unified Analysis
