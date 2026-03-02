# Phase E: Phase 2–4 Strategic Modules — Spec and Layer Binding

**Deliverable:** Per-module specification and Layer 0–5 binding; where implementation exists: module in `modules/`, API, minimal UI, registration.

**Order:** Phase 2 → Phase 3 → Phase 4. Within phase, by dependencies (e.g. CIM depends on Universal Causal Simulator; QSTP on Layer 0 PQC).

---

## Phase 2 Modules

### BI (Biosphere Interface)
- **Scope:** Ecosystem and natural-capital models; PARS for natural capital. No public “tokenization”; internal/R&D only if ever.
- **Layer 0:** Sensor and survey verification (ecosystem, habitat).
- **Layer 1:** Digital twins of ecosystems and habitats.
- **Layer 2:** KG nodes: ecosystem, species, service nodes.
- **Layer 3:** Ecological cascade, degradation models.
- **Layer 4:** ANALYST, ADVISOR agents.
- **Layer 5:** PARS extension for natural capital.
- **Status:** Spec only; implementation optional.

### ETC (Energy Transition Commander)
- **Scope:** Grid and market data; plants, grids, storage; energy flow and dependency; physics, markets, transition.
- **Layer 0:** Verified grid and market data.
- **Layer 1:** Twins of plants, grids, storage.
- **Layer 2:** Energy flow, dependency graph.
- **Layer 3:** Physics, markets, transition simulation.
- **Layer 4:** ANALYST, ADVISOR.
- **Layer 5:** PARS for energy assets.
- **Status:** Spec only; implementation optional.

### CIM (Cognitive Infrastructure Monitor)
- **Scope:** Information sources and channels; content, influence, propagation graph; Universal Causal Simulator for ideological/informational cascade.
- **Layer 0:** Provenance of key information artifacts.
- **Layer 1:** Information sources, channels as twins.
- **Layer 2:** Content, influence, propagation graph.
- **Layer 3:** Universal Causal Simulator (informational cascade).
- **Layer 4:** ANALYST, SENTINEL.
- **Layer 5:** PARS or equivalent for critical information infrastructure.
- **Status:** Spec only; implementation optional. Depends on Universal Causal Simulator (Layer 3).

### ASM (Nuclear Safety & Monitoring) — production-ready
- **Scope:** Reactor monitoring, nuclear winter cascade, escalation tracking. Already in code.
- **Layer 0:** Classified provenance, air-gapped.
- **Layer 1:** Adversary infrastructure from open/classified sources.
- **Layer 2:** ASM_* namespace in KG.
- **Layer 3:** Deterrence, cascade.
- **Layer 4:** ASM_ANALYST.
- **Layer 5:** Classified PARS namespace.
- **Status:** **Implemented.** Module: `apps/api/src/modules/asm/`. API: `/api/v1/asm`. UI: route `modules/asm`. Registered in router and frontend `lib/modules.ts`. Production-ready per plan.

### ASGI (AI Safety & Governance) — production-ready
- **Scope:** AI system and compute verification; systems, clusters; capability emergence, misuse.
- **Layer 0:** AI system and compute verification.
- **Layer 1:** Systems, clusters as twins.
- **Layer 2:** AI_SYSTEM, COMPUTE_CLUSTER, TRAINING_DATASET.
- **Layer 3:** Capability emergence, misuse models.
- **Layer 4:** ASGI_SENTINEL, ANALYST.
- **Layer 5:** PARS for AI systems.
- **Status:** **Implemented.** Module: `apps/api/src/modules/asgi/`. API: `/api/v1/asgi`. UI: route `modules/asgi`. Registered in router and frontend. Production-ready per plan.

---

## Phase 3 Modules

### POS (Planetary Operating System)
- **Scope:** Earth observation, sensor verification; planetary-scale twin; OCEAN, ATMOSPHERE, BIOSPHERE; planetary dynamics, tipping points.
- **Layer 0:** Earth observation, sensor verification.
- **Layer 1:** Planetary-scale twin.
- **Layer 2:** OCEAN, ATMOSPHERE, BIOSPHERE nodes.
- **Layer 3:** Planetary dynamics, tipping points.
- **Layer 4:** POS_SENTINEL, REPORTER.
- **Layer 5:** Open PARS for planetary data.
- **Status:** Spec only; implementation optional.

### SDM (Space Debris Manager)
- **Scope:** Orbital and tracking proof; debris, satellites, zones; orbital dependency, collision risk; Kessler, deorbit, ADR economics.
- **Layer 0:** Orbital and tracking proof.
- **Layer 1:** Debris, satellites, zones as twins.
- **Layer 2:** Orbital dependency, collision risk.
- **Layer 3:** Kessler, deorbit, ADR economics.
- **Layer 4:** ANALYST, ADVISOR.
- **Layer 5:** PARS or protocol for orbital objects.
- **Status:** Spec only; implementation optional.

### GEC (Geoengineering Controller)
- **Scope:** (Refer to STRATEGIC_MODULES_V2_VISION for full scope.) Governance-bound; Layer 0–5 alignment.
- **Status:** Spec only; implementation optional.

### QSTP (Quantum-Safe Transition Platform)
- **Scope:** Crypto audit, migration status; crypto systems as assets; CRYPTO_SYSTEM, QUANTUM_THREAT, MIGRATION_PATH; quantum timeline, migration simulation.
- **Layer 0:** Crypto audit, migration status (PQC).
- **Layer 1:** Crypto systems as assets.
- **Layer 2:** CRYPTO_SYSTEM, QUANTUM_THREAT, MIGRATION_PATH.
- **Layer 3:** Quantum timeline, migration simulation.
- **Layer 4:** QSTP_ADVISOR, REPORTER.
- **Layer 5:** PARS for cryptographic systems.
- **Status:** Spec only; implementation optional. Depends on Layer 0 PQC.

---

## Phase 4 Modules

### CCE (Civilization Continuity Engine)
- **Scope:** Vault and artifact verification; vaults, repositories; EXISTENTIAL_RISK, KNOWLEDGE_REPOSITORY, PRESERVATION_VAULT; existential scenarios.
- **Layer 0–5:** Per STRATEGIC_MODULES_V2_VISION. PARS for knowledge and continuity.
- **Status:** Spec only; implementation optional.

### OEM (Orbital & Exo-Economy Manager)
- **Scope:** Orbital and mission verification; orbital and surface assets; orbital mechanics, economics, latency.
- **Layer 0–5:** Per STRATEGIC_MODULES_V2_VISION. PARS for space economy.
- **Status:** Spec only; implementation optional.

### PSTC (Post-Scarcity Transition Controller)
- **Scope:** (Refer to roadmap.) Design and scenario work.
- **Status:** Spec only; implementation optional.

### IAFE
- **Status:** **Concept and scenarios only.** No implementation commitment. See `docs/architecture/IAFE_CONCEPT_SCENARIOS.md`.

---

## Registration Summary

| Module | In `modules/` | API prefix | UI route | Status |
|--------|----------------|------------|----------|--------|
| ASM    | Yes            | /api/v1/asm | modules/asm | Production-ready |
| ASGI   | Yes            | /api/v1/asgi | modules/asgi | Production-ready |
| BI, ETC, CIM, POS, SDM, GEC, QSTP, CCE, OEM, PSTC | No (spec only) | — | — | Spec + Layer binding |
| IAFE   | No (concept only) | — | — | Document only |
