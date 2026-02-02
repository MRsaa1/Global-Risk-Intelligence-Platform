# PHYSICAL-FINANCIAL RISK PLATFORM

## Identity Statement

> **This is not a SaaS product. This is a Decision Intelligence Platform.**

---

## What This System Is

```
┌─────────────────────────────────────────────────────────────────────┐
│  WEB-BASED DECISION INTELLIGENCE PLATFORM                          │
│  with immersive global risk visualization                          │
│                                                                     │
│  Category: Command Center / Operational Control System              │
│  Not: Dashboard / SaaS App / Analytics Tool                        │
└─────────────────────────────────────────────────────────────────────┘
```

### System Classification

| Attribute | Value |
|-----------|-------|
| Type | Decision Intelligence Platform |
| Interface | Risk Command Center |
| Paradigm | Operational Control System |
| User Mode | Observe → Decide → Act |

### Reference Systems

- Palantir Foundry / Gotham
- Bloomberg Terminal
- NATO C2 (Command & Control) Systems
- Energy Grid Control Rooms
- Flight Control Centers
- Crisis Management Rooms

---

## The User

### Primary Persona

**Chief Risk Officer (CRO)** or **Portfolio Risk Manager**

- Organization: Global bank, insurance company, asset manager
- Portfolio: $50B - $500B in physical assets and financial exposure
- Responsibility: Protect capital from physical and transition risks
- Authority: Can trigger hedges, reallocations, stress tests

### User Context

The user does NOT:
- "Use features"
- "Navigate pages"
- "Fill forms"
- "Read documentation"

The user DOES:
- **Observe** the system state
- **Understand** causal relationships
- **Decide** on interventions
- **Act** with confidence

---

## The Situation

### Trigger Events

1. **Climate Event**: Hurricane approaching $15B coastal portfolio
2. **Credit Shock**: Counterparty default cascading through network
3. **Geopolitical**: Sanctions affecting supply chain nodes
4. **Market Stress**: Correlation spike across asset classes

### Decision Context

| Parameter | Value |
|-----------|-------|
| Time to decision | 30 seconds (critical) to 15 minutes (strategic) |
| Cognitive load | Maximum |
| Error tolerance | Zero |
| Information density | High |
| Visual noise tolerance | Zero |

---

## The Decision

### Decision Types

1. **Immediate**: Activate hedge, exit position
2. **Tactical**: Reallocate capital, adjust limits
3. **Strategic**: Run stress test, update risk models
4. **Exploratory**: Understand new threat pattern

### Decision Flow

```
OBSERVE          ORIENT           DECIDE           ACT
   │                │                │               │
   ▼                ▼                ▼               ▼
┌──────┐       ┌──────────┐     ┌─────────┐    ┌─────────┐
│ See  │  ───▶ │Understand│ ───▶│ Choose  │───▶│ Execute │
│Scene │       │ Context  │     │ Action  │    │ Command │
└──────┘       └──────────┘     └─────────┘    └─────────┘
```

---

## Design Principles

### 1. One Screen

> If you need a second page, the first one doesn't work.

The entire decision space must be visible in one scene. Context switching destroys situational awareness.

### 2. Scene > Layout

> The user is "inside" the system, not "looking at" it.

This is not a dashboard with widgets. This is a spatial environment where data manifests as physical phenomena.

### 3. Focus > Navigation

> Click changes context, not page.

Navigation happens through attention and zoom, not through menus and tabs.

### 4. Silence > Noise

> Every pixel must carry meaning.

No decorative elements. No "nice to have" information. If it doesn't help the decision, it hurts the decision.

### 5. 30-Second Rule

> Critical decision must be possible in 30 seconds.

From opening the system to executing a protective action. Everything else is optimization.

---

## Visual Language

### What We Do

| Element | Implementation |
|---------|---------------|
| Scene | Full-screen immersive 3D environment |
| Context | Spatial relationships, not hierarchies |
| State | Light, color, movement as data |
| Causality | Animations explain, not decorate |
| Focus | Depth of field, attention hierarchy |

### What We Don't Do

| Anti-Pattern | Why |
|--------------|-----|
| Cards/Tiles | Creates visual competition |
| Tabs/Menus | Breaks immersion |
| Onboarding popups | System must be self-evident |
| "User-friendly" softening | Reduces information density |
| Decorative animations | Wastes cognitive bandwidth |

---

## Interface States

### 1. Global Observation (Default)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│                        ◉ EARTH                              │
│                     (dominant, 80%)                         │
│                                                             │
│  ┌────┐                                         ┌────────┐  │
│  │HUD │                                         │Context │  │
│  │12% │                                         │ Panel  │  │
│  └────┘                                         │(hidden)│  │
│                                                 └────────┘  │
│                      [ timeline 5% ]                        │
└─────────────────────────────────────────────────────────────┘
```

### 2. Focused Analysis (On hotspot click)

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│              ◉ EARTH              ┌──────────────────────┐  │
│           (zoomed, 60%)           │   CONTEXT PANEL      │  │
│                                   │                      │  │
│  ┌────┐                           │   Selected Region    │  │
│  │HUD │        ◉ Hotspot          │   Risk Factors       │  │
│  │    │        (focused)          │   Exposure           │  │
│  └────┘                           │   Actions            │  │
│                                   └──────────────────────┘  │
│                      [ timeline ]                           │
└─────────────────────────────────────────────────────────────┘
```

### 3. Stress Test Mode (On scenario activation)

```
┌─────────────────────────────────────────────────────────────┐
│  ⚠ STRESS TEST ACTIVE: Climate Physical (Severity: 80%)    │
│                                                             │
│                        ◉ EARTH                              │
│                   (stressed colors)                         │
│                                                             │
│  ┌────────┐                                    ┌──────────┐ │
│  │STRESSED│                                    │ RESULTS  │ │
│  │METRICS │                                    │ VaR/CVaR │ │
│  └────────┘                                    └──────────┘ │
│                                                             │
│          [ scenario timeline: T0 → T+5Y ]                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Success Criteria

### The Ultimate Test

> If you remove ALL text and numbers, the scene must still communicate:
> - Where is the risk?
> - How severe?
> - What's changing?

If it's just "a pretty globe" without text — it failed.

### Metrics

| Metric | Target |
|--------|--------|
| Time to first insight | < 3 seconds |
| Time to critical decision | < 30 seconds |
| Cognitive load (subjective) | "I see everything I need" |
| Visual noise (subjective) | "Nothing distracts me" |

---

## Technology Stack (Aligned with Identity)

### Visualization

| Layer | Technology | Purpose |
|-------|------------|---------|
| Globe | CesiumJS | WGS84, LOD, planetary scale |
| 3D Scene | Three.js | Digital twins, custom objects |
| Data Overlay | Deck.gl | Heatmaps, arcs, particles |
| UI | React + Framer Motion | HUD, context panels |

### Backend

| Layer | Technology | Purpose |
|-------|------------|---------|
| API | FastAPI | Risk models, stress tests |
| Compute | NumPy, SciPy | Monte Carlo, simulations |
| Real-time | WebSocket | Live updates |
| Data | PostgreSQL + PostGIS | Geospatial storage |

### Future (Enterprise)

| Layer | Technology | Purpose |
|-------|------------|---------|
| Physics | NVIDIA PhysicsNeMo | Physical simulations |
| Climate | NVIDIA Earth-2 | Weather/climate models |
| Photorealism | Unreal Engine 5 | Desktop client |
| Collaboration | NVIDIA Omniverse | USD pipeline |

---

## This Document Is A Filter

Every design decision, feature request, and visual choice must pass through this identity:

1. Does it help the user **observe** the system state?
2. Does it help the user **understand** causal relationships?
3. Does it help the user **decide** on interventions?
4. Does it help the user **act** with confidence?
5. Can it be done in **30 seconds**?

If the answer to any of these is "no" — reconsider.

---

## Related

- **Product Model (3D + AI in FinTech):** [docs/PRODUCT_MODEL_3D_FINTECH.md](docs/PRODUCT_MODEL_3D_FINTECH.md) — шесть направлений: оценка рисков по физическим активам, кредитование/страхование сложных объектов, REIT, fraud, project finance, иммерсивная аналитика.

---

*Last updated: January 2026*
