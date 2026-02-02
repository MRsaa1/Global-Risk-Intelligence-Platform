# Strategic Modules v2.0: Implementation Roadmap

**Scope:** Implementation map only. Foundational vision, module functions, and principles are in [STRATEGIC_MODULES_V2_VISION.md](STRATEGIC_MODULES_V2_VISION.md).

---

## 1. Mapping: V2 Modules → Existing Codebase

| V2 Module | Exists (Y/N) | Current `modules/` or `endpoints` | Notes |
|-----------|--------------|------------------------------------|-------|
| CIP | Y | `modules/cip/`, `/api/v1/cip` | — |
| SCSS | Y | `modules/scss/`, `/api/v1/scss` | — |
| SRO | Y | `modules/sro/`, `/api/v1/sro` | — |
| SRS | N | — | SWRO→SRS; no SWRO in codebase |
| CityOS | N | — | CMDP→CityOS; no CMDP in codebase |
| FST | N | — | Partial methodology overlap with `/stress`, `/stress_tests`; FST = banking/derivatives + physical shocks |
| BI | N | — | — |
| ETC | N | — | — |
| CIM | N | — | — |
| ASM | N | — | — |
| ASGI | N | — | — |
| POS | N | — | — |
| SDM | N | — | — |
| GEC | N | — | — |
| QSTP | N | — | — |
| CCE | N | — | CBR→CCE; no CBR in codebase |
| OEM | N | — | — |
| PSTC | N | — | — |
| IAFE | N | — | **Concept only; no implementation commitment.** |

---

## 2. Phase 1 (Years 1–5)

**Goals:** Master physical–financial reality and stability; prove product–market fit with commercial modules.

**Modules:** CIP, SCSS, SRO, SRS (ex-SWRO), CityOS (ex-CMDP), FST.

### Milestones by Year

| Year | Milestones | Dependencies |
|------|------------|--------------|
| 1 | CIP production-ready; SCSS MVP; base `StrategicModule` and registry. Align with v1 [STRATEGIC_MODULES_ROADMAP.md](STRATEGIC_MODULES_ROADMAP.md) Months 1–12 (CIP, start SCSS). **Done:** `StrategicModule` + `ModuleRegistry`; CIP, SCSS, SRO auto-registered on import; `GET /api/v1/strategic-modules` and `GET /api/v1/strategic-modules/{name}`. | Layer 0–4 |
| 2 | SCSS production-ready; SRO MVP; first SRS and CityOS design/scope. Months 13–24 (SRO). | CIP, SCSS, Layer 2–3 |
| 3 | SRO production-ready; SRS and CityOS MVP; FST scoped and designed. | SRO, Layer 3–4 |
| 4 | SRS and CityOS pilot; FST MVP; Phase 1 integration and cross-module queries. | All Phase 1 |
| 5 | FST pilot; Phase 1 complete; revenue and adoption targets per commercial plan. | — |

### Dependencies

- **CIP, SCSS, SRO:** Existing `modules/cip`, `modules/scss`, `modules/sro` and `/cip`, `/scss`, `/sro`; extend Layer 2 (Knowledge Graph), Layer 3 (cascade, stress), Layer 4 (agents).
- **SRS:** New module; migrates/extends v1 SWRO (demographics, regime stability, digital sovereignty, asset-based sovereign solvency). Depends on Layer 1–3 and economics/long-horizon models.
- **CityOS:** New module; subsumes v1 CMDP (Migration Management as submodule/mode). Depends on Layer 1–3, climate, demography; federated digital-twin and interoperability design.
- **FST:** New module; depends on SRO, Layer 2–3, stress-test framework; reuses methodology where applicable from `/stress`, `/stress_tests` but scoped to banking/derivatives and physical shocks.

### v1 Alignment

- Months 1–12: CIP (v1 ROADMAP) → V2 CIP.
- Months 7–18: SCSS (v1) → V2 SCSS.
- Months 13–24: SRO (v1) → V2 SRO.

---

## 3. Phase 2 (Years 5–15)

**Goals:** Expand into biological, cognitive, and energy domains; integrate ASM and ASGI.

**Modules:** BI, ETC, CIM, ASM, ASGI.

### Milestones by Year

| Year | Milestones | Dependencies |
|------|------------|--------------|
| 6–7 | BI and ETC design and MVP; CIM scoped; ASGI design. | Layer 3 extensions (ecological, energy); POS/Layer 3 where relevant |
| 8–9 | CIM MVP; ASGI MVP; ASM design and prerequisites (clearance, isolated infra). | Universal Causal Simulator (Layer 3) for CIM; ASM: classified infra |
| 10–12 | ASM MVP (when prerequisites met); BI, ETC, CIM, ASGI pilots and production. | ASM: government/classified |
| 13–15 | Phase 2 integration; cross-module analytics (BI↔POS, CIM↔ASGI, ETC↔SRO). | All Phase 2, Layer 3 extensions |

### Dependencies

- **BI:** Layer 0–3; ecosystem and natural-capital models; PARS for natural capital. No “tokenization” in public implementation; internal/R&D only if ever.
- **ETC:** Layer 0–3; grid, energy-market, and transition models; fusion and intercontinental as capability extensions.
- **CIM:** Layer 0–4; **Universal Causal Simulator (Layer 3)** for informational and epistemic cascade; PARS or equivalent for information infrastructure.
- **ASM:** Classified; separate DB, `ASM_*` KG namespace; security clearance and air-gapped infra. v1 ROADMAP ASM (Months 25–48) as reference.
- **ASGI:** Run-time registry and compliance; boundary with CCE (AGI alignment, bonds, Dead Man’s Switch in CCE). v1 ASGI (Months 85–120) as reference.

### Cross-Cutting: Universal Causal Simulator

- Introduce **Universal Causal Simulator** extensions in **Phase 2** (social, biological, informational causality). CIM and ASM scenarios are early consumers; extend through Phase 3–4.

---

## 4. Phase 3 (Years 15–25)

**Goals:** Planetary-scale modules; space debris; geoengineering research governance; quantum-safe.

**Modules:** POS, SDM, GEC, QSTP.

### Milestones by Year

| Year | Milestones | Dependencies |
|------|------------|--------------|
| 16–18 | POS production; SDM design and MVP; GEC research and governance design. | Layer 0–4; Earth observation; orbital data |
| 19–21 | SDM pilot (Kessler, Deorbit Guarantee, ADR fund, Orbital Zoning); GEC contingency and escrow governance; QSTP MVP. | SDM: Layer 0 proof for cleanup; QSTP: Layer 0 crypto audit |
| 22–25 | QSTP production; **Quantum-Native (Layer 0)** for critical paths by end of Phase 3; Phase 3 integration; link to OEM and CCE. | QSTP, Layer 0 v2.0 |

### Dependencies

- **POS:** v1 ROADMAP Months 61–96 as reference; Layer 0–5; planetary boundaries, Tipping Points Insurance, Atmospheric Ledger.
- **SDM:** New; Layer 0 (orbital/tracking proof), Layer 1–3; international coordination (UNOOSA, ITU).
- **GEC:** Research-grade only; simulation, risk, contingency; collateralization/escrow; no deployment control.
- **QSTP:** v1 Months 121–180 as reference; Layer 0–5; NIST/ETSI and national cyber; links to CIP.

### Cross-Cutting: Quantum-Native (Layer 0)

- **Quantum-Native Security (PQC, QKD)** for critical infrastructure and governance-bound channels: **not later than Phase 3.** QSTP and CIP are primary consumers.

---

## 5. Phase 4 (Years 25–30+)

**Goals:** Civilization-scale continuity, exo-economy, post-scarcity research; IAFE as concept only.

**Modules:** CCE (ex-CBR), OEM, PSTC, IAFE.

### Milestones by Year

| Year | Milestones | Dependencies |
|------|------------|--------------|
| 26–28 | CCE design and MVP (X-Risk taxonomy, civilizational backup, vaults); OEM design and MVP (cislunar, NEA, Mars economics). | Layer 0–5; orbital physics; latency-aware economics |
| 29–30 | PSTC design and scenario work; CCE and OEM pilots; **Self-Amending PARS (Layer 5)** and **Adversarial Resilience** in place. | PARS evolution; Byzantine/anti-capture |
| 30+ | Phase 4 integration; CCE/OEM/PSTC research and pilots. **IAFE:** Concept only, no implementation commitment; scenario and feasibility studies only. | — |

### Dependencies

- **CCE:** Subsumes v1 CBR; X-Risk (AGI, pandemic, nanotech, nuclear, asteroid, supervolcano); civilizational backup; Consciousness Preservation = research only. v1 CBR Months 145–240 as reference.
- **OEM:** Validated orbital physics and latency-aware economic extensions of the core simulation engine; space law and treaties.
- **PSTC:** UBD, meaning crisis, resource hoarding, transition triggers; Universal Causal for behavioral/social.
- **IAFE:** **Research Concept — scenario-only, non-operational.** Generation/Sleeper/Data ships, propulsion, destinations, economics, ethics. No implementation commitment.

### Cross-Cutting: Self-Amending PARS and Adversarial Resilience

- **Self-Amending Constitution (Layer 5 / PARS):** Rules and schemas evolve by consensus; Human Veto hard-coded. Target: Phase 4 governance and CCE/OEM/PSTC linkage.
- **Adversarial Resilience:** Byzantine fault tolerance and anti-capture in consensus and critical decisions. Introduce in Phase 4 alongside PARS evolution.

---

## 6. Cross-Cutting: Architectural Upgrades

| Upgrade | When | Phases | Notes |
|---------|------|--------|-------|
| **Quantum-Native Security (Layer 0)** | Not later than Phase 3 | 3 | PQC (lattice, hash-based); QKD for critical links; QSTP, CIP |
| **Universal Causal Simulator (Layer 3)** | From Phase 2, incremental | 2–4 | Social, biological, informational causality; CIM, ASM, PSTC |
| **Self-Amending PARS (Layer 5)** | Phase 4 | 4 | Consensus-based evolution; Human Veto hard-coded |
| **Adversarial Resilience** | Phase 4 | 4 | Byzantine fault tolerance; anti-capture in protocol and critical paths |

---

## 7. IAFE: Concept Only

**IAFE (Interstellar Ark Feasibility Engine)** is a **Research Concept — scenario-only, non-operational.** It covers:

- Generation, Sleeper, Data ships; propulsion; destination selection (e.g. Proxima b, TRAPPIST-1); economics and ethics.

There is **no implementation commitment**. Any work is feasibility and scenario study only, using Layers 0–5 conceptually. No dedicated `modules/` or production endpoints are planned in this roadmap.
