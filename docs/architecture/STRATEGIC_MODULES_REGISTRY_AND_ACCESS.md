# Strategic Modules: Registry, Access Control, Isolation, and Knowledge Graph

This document answers how the platform implements (and may evolve) module registration, access control, module isolation, and Knowledge Graph integration.

---

## 1. Module Registry System

**Current approach: Code-driven (Option B)**

Modules are **not** stored in the database. They are Python classes that implement `StrategicModule` and are registered in memory at application startup.

| Aspect | Current implementation |
|--------|-------------------------|
| **Where** | [apps/api/src/modules/base.py](apps/api/src/modules/base.py) — `StrategicModule` (ABC); [apps/api/src/modules/registry.py](apps/api/src/modules/registry.py) — `ModuleRegistry` |
| **Registration** | [apps/api/src/modules/__init__.py](apps/api/src/modules/__init__.py) — `_register_builtin_modules()` instantiates CIP, SCSS, SRO and calls `ModuleRegistry.register(module)` |
| **Storage** | In-memory dict: `ModuleRegistry._modules: Dict[str, StrategicModule]` keyed by `module.name.lower()` (e.g. `"cip"`, `"scss"`, `"sro"`) |
| **Metadata** | Each module defines: `name`, `description`, `access_level` (enum), `version`; abstract methods: `get_layer_dependencies()`, `get_knowledge_graph_nodes()`, `get_knowledge_graph_edges()`, `get_simulation_scenarios()`, `get_agents()` |

**No** `StrategicModule` DB model, `phase`, `status` (development/beta/production), or `enabled_for_organizations`. Phase and status are only in docs (e.g. STRATEGIC_MODULES_ROADMAP).

**Possible evolution (Option A — database-driven):**

- Add `strategic_modules` table (code, name, phase, version, status) and optionally `organization_modules` (org ↔ module, subscription_tier).
- Keep current code-driven registration for **built-in** modules; DB could override enabled/status per org or drive which modules are loaded.
- New endpoints could expose “available modules” from DB and still use the in-memory registry for runtime behaviour.

---

## 2. Access Control

**Current approach: Access-level based (simplified; not full RBAC or organization-based)**

| Aspect | Current implementation |
|--------|-------------------------|
| **Model** | **Access level per module**, not per-user permissions or per-organization subscriptions. |
| **Levels** | `ModuleAccessLevel`: PUBLIC, COMMERCIAL, CLASSIFIED, META ([base.py](apps/api/src/modules/base.py)). |
| **Check** | `StrategicModule.check_access(user_context: Dict)` — PUBLIC → always True; COMMERCIAL → `user_context.get("authenticated")`; CLASSIFIED → `security_clearance`; META → `meta_access`. |
| **API** | No `require_module_access("CIP")` dependency on routes. CIP/SCSS/SRO routers are mounted without a shared access dependency; auth is handled elsewhere (e.g. global auth middleware or per-route). |
| **Frontend** | [AccessGate.tsx](apps/web/src/components/modules/AccessGate.tsx) — wraps module pages; calls `/api/v1/auth/me`; maps `role === 'admin' \|\| 'superuser'` to `securityClearance` and `metaAccess`; shows “Access Restricted” when the user’s level is below the module’s `accessLevel`. |

So: **User → (authenticated, role) → Access level**; **Module → access_level**. Access = “user has at least the level required by the module.” There is **no**:

- Role → set of modules (e.g. “Infrastructure Manager” → [CIP, SCSS])
- Organization → subscription → list of modules
- Fine-grained permissions (e.g. `cip.view_infrastructure`, `cip.edit_infrastructure`)

**Possible evolution:**

- **RBAC:** Introduce roles and map role → allowed modules (or required permissions). `ModuleRegistry.check_access(user, module_code)` could require `user.get_all_permissions()` to contain module’s `REQUIRES_PERMISSIONS`.
- **Organization-based:** Add `organization_modules` (org_id, module_code, enabled, subscription_tier). Access = authenticated + user’s org has module enabled.
- **Permission-based:** Add `module_permissions` and `user_module_permissions`; `require_module_access("CIP")` checks user has e.g. `cip.view_infrastructure` for GET and `cip.edit_infrastructure` for POST.

---

## 3. Module Isolation

**Current approach: Database-level isolation; shared “core” models**

| Aspect | Current implementation |
|--------|-------------------------|
| **Tables** | Each module has its own tables and schema: `cip_infrastructure`, `cip_dependencies`; `scss_suppliers`, `scss_routes`, etc. ([modules/cip/models.py](apps/api/src/modules/cip/models.py), SCSS/SRO under [modules/scss](apps/api/src/modules/scss), [modules/sro](apps/api/src/modules/sro)). |
| **Shared** | Core app uses shared models: `assets`, `users`, etc. ([models/](apps/api/src/models/)). Modules can reference them (e.g. `CriticalInfrastructure.asset_id` → `assets.id`). |
| **Cross-module** | No cross-module DB queries in code today (e.g. CIP does not query `scss_suppliers`). `ModuleRegistry.get_cross_module_insights()` is not implemented (placeholder). |

So: **Module data is isolated per module schema; shared data is in the core.** Cross-module queries (e.g. “infrastructure that depends on SCSS suppliers”) are a future option and would require explicit APIs or services that join CIP + SCSS (or KG) rather than direct cross-table SQL in one module.

---

## 4. Knowledge Graph Integration

**Current approach: Common graph with shared labels (Option B); no per-module namespaces**

| Aspect | Current implementation |
|--------|-------------------------|
| **Nodes** | Single label `Infrastructure` for CIP-registered nodes ([knowledge_graph.py](apps/api/src/services/knowledge_graph.py) — `create_infrastructure_node()`). No `CIP:SUBSTATION` or `SCSS:SUPPLIER` labels. |
| **Edges** | Shared relationship types: `DEPENDS_ON`, `SUPPLIES_TO`, etc. `create_dependency(source_id, target_id, dependency_type="DEPENDS_ON", criticality=...)` — same type used across modules. |
| **Properties** | CIP passes extra properties (e.g. `criticality_level`, `country_code`, `cip_id`) via `**properties` into the node. No `module: "cip"` property set today; it could be added for filtering. |
| **Cross-module edges** | Allowed by design: same node `id` space and same relationship types. E.g. `CIP:FACTORY --[DEPENDS_ON]--> SCSS:SUPPLIER` would require SCSS to create supplier nodes with known ids and CIP (or a shared service) to create the edge. Not implemented yet. |

So: **One graph, shared node/edge types; differentiation by node id and properties, not by namespace prefix.** Optional next step: add a `module` property (e.g. `"cip"`, `"scss"`) on nodes and use it in queries for “CIP-only” or “cross-module” views.

---

## 5. Mapping to the “Recommended” Base Class

The suggested base class uses `CODE`, `NAME`, `PHASE`, `VERSION`, `REQUIRES_MODULES`, `REQUIRES_PERMISSIONS`, `get_models()`, `get_routes()`, `get_agents()`, `get_graph_schema()`, `initialize(organization)`, `health_check()`.

| Recommended | Current |
|-------------|---------|
| `CODE` | `name` (e.g. `"CIP"`) — used for API prefix and registry key. |
| `NAME` / `description` | `description` on `StrategicModule`. |
| `PHASE` | Only in roadmap docs; not on the class. |
| `VERSION` | `version` on `StrategicModule`. |
| `REQUIRES_MODULES` | Not present. |
| `REQUIRES_PERMISSIONS` | Not present; access is by `access_level` only. |
| `get_models()` | Models live in `modules/<code>/models.py`; not returned by the module class. |
| `get_routes()` | Routers are mounted in [router.py](apps/api/src/api/v1/router.py) (e.g. `cip.router` under `/cip`); module class does not expose routes. |
| `get_agents()` | Module returns **list of agent name strings** (e.g. `["CIP_SENTINEL"]`); actual agent is in `modules/cip/agents.py` and wired in alerts/oversee. |
| `get_graph_schema()` | Replaced by `get_knowledge_graph_nodes()` and `get_knowledge_graph_edges()` (list of type names). |
| `initialize(organization)` | Not present. |
| `health_check()` | Not on module; health is global API health. |

So the current design is a **lighter** version of the recommended base: code-driven registry, access by level, no DB for modules, no org initialization, and KG with a common graph and optional `module` property for future use.

---

## Summary

| Question | Current choice |
|----------|----------------|
| **1. Module registry** | **Code-driven (Option B):** in-memory registry, modules registered at startup; no DB table for modules. |
| **2. Access control** | **Access-level based:** PUBLIC / COMMERCIAL / CLASSIFIED / META; frontend AccessGate + `/auth/me`; no RBAC, org-based, or fine-grained permissions yet. |
| **3. Module isolation** | **DB-level:** each module has its own tables; shared core (e.g. assets, users); no cross-module queries implemented. |
| **4. Knowledge Graph** | **Common graph (Option B):** shared labels (e.g. `Infrastructure`), shared edge types (`DEPENDS_ON`, etc.); optional `module` property for future; cross-module edges possible by design. |

To move toward the recommended architecture you could: add a DB layer for module metadata and org-module enablement, add RBAC or org-based access and `require_module_access(module_code)`, implement `get_cross_module_insights` and cross-module KG queries, and add `module` to KG node properties and (if needed) `get_graph_schema()` / `initialize(organization)` / `health_check()` on the base class.
