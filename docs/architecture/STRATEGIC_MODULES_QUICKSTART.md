# Strategic Modules: Quick Start Guide

## 🚀 Get Started in 30 Minutes

This guide will help you start implementing the Strategic Modules architecture.

---

## Step 1: Understand the Vision (5 min)

Read these documents in order:

1. **STRATEGIC_MODULES_SUMMARY.md** - Quick overview (5 min)
2. **STRATEGIC_MODULES.md** - Full architecture (15 min)
3. **STRATEGIC_MODULES_MATRIX.md** - Integration matrix (10 min)

**Total: 30 minutes**

---

## Step 2: Review Current Architecture (10 min)

Understand how modules will integrate:

```bash
# Review existing 5-layer architecture
cat docs/architecture/FIVE_LAYERS.md

# Review existing services
ls -la apps/api/src/services/
ls -la apps/api/src/layers/
```

Key services to understand:
- `knowledge_graph.py` - Will be extended by modules
- `cascade_engine.py` - Will add module-specific scenarios
- `agents/sentinel.py` - Will create module-specific agents
- `digital_twins.py` - Will model new asset types

---

## Step 3: Create Base Framework (15 min)

### 3.1 Create Directory Structure

```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform

# Create module directories
mkdir -p apps/api/src/modules
mkdir -p apps/api/src/api/v1/endpoints/modules
mkdir -p apps/api/src/models/modules

# Create base files
touch apps/api/src/modules/__init__.py
touch apps/api/src/modules/base.py
touch apps/api/src/modules/registry.py
```

### 3.2 Implement Base Classes

Copy the base classes from `STRATEGIC_MODULES_IMPLEMENTATION.md`:

1. Open `apps/api/src/modules/base.py`
2. Copy `StrategicModule` class (from IMPLEMENTATION.md)
3. Open `apps/api/src/modules/registry.py`
4. Copy `ModuleRegistry` class (from IMPLEMENTATION.md)

### 3.3 Test Base Framework

```python
# Test in Python REPL
from apps.api.src.modules.base import StrategicModule, ModuleAccessLevel
from apps.api.src.modules.registry import ModuleRegistry

# Create a test module
class TestModule(StrategicModule):
    def get_layer_dependencies(self):
        return {"Layer 1": ["digital_twins"]}
    # ... implement other abstract methods

# Register module
module = TestModule("test", "Test Module", ModuleAccessLevel.COMMERCIAL)
ModuleRegistry.register(module)

# Verify
assert ModuleRegistry.get("test") == module
print("✅ Base framework works!")
```

---

## Step 4: Implement First Module - CIP (2-4 weeks)

### 4.1 Create CIP Structure

```bash
mkdir -p apps/api/src/modules/cip
touch apps/api/src/modules/cip/__init__.py
touch apps/api/src/modules/cip/models.py
touch apps/api/src/modules/cip/service.py
touch apps/api/src/modules/cip/endpoints.py
touch apps/api/src/modules/cip/agents.py
```

### 4.2 Implement CIP Models

```python
# apps/api/src/models/modules/cip.py
from sqlalchemy import Column, String, Float, JSON, ForeignKey
from src.core.database import Base

class CriticalInfrastructure(Base):
    __tablename__ = "critical_infrastructure"
    __table_args__ = {"schema": "cip"}
    
    id = Column(String, primary_key=True)
    asset_id = Column(String, ForeignKey("assets.id"), nullable=True)
    infrastructure_type = Column(String)  # power_grid, water_treatment, etc.
    criticality_score = Column(Float)
    dependencies = Column(JSON)  # List of dependent infrastructure IDs
```

### 4.3 Implement CIP Service

```python
# apps/api/src/modules/cip/service.py
from src.services.knowledge_graph import KnowledgeGraphService
from src.modules.base import StrategicModule, ModuleAccessLevel

class CIPService:
    def __init__(self):
        self.kg = KnowledgeGraphService()
        self.module_namespace = "cip"
    
    async def register_infrastructure(self, data: dict):
        # Create infrastructure node in Knowledge Graph
        node = await self.kg.create_node(
            node_type="INFRASTRUCTURE",
            properties={
                "id": data["id"],
                "type": data["type"],
                "criticality": data["criticality"],
                "module": self.module_namespace
            }
        )
        return node
```

### 4.4 Create CIP Endpoints

```python
# apps/api/src/api/v1/endpoints/modules/cip.py
from fastapi import APIRouter, Depends
from src.modules.cip.service import CIPService

router = APIRouter()
cip_service = CIPService()

@router.post("/infrastructure/register")
async def register_infrastructure(data: dict):
    """Register critical infrastructure."""
    return await cip_service.register_infrastructure(data)
```

### 4.5 Register CIP Router

```python
# apps/api/src/api/v1/router.py
from .endpoints.modules import cip

api_router.include_router(
    cip.router,
    prefix="/cip",
    tags=["Module: Critical Infrastructure Protection"],
)
```

### 4.6 Test CIP Module

```bash
# Start API
cd apps/api
uvicorn src.main:app --reload

# Test endpoint
curl -X POST http://localhost:8000/api/v1/cip/infrastructure/register \
  -H "Content-Type: application/json" \
  -d '{
    "id": "power-grid-1",
    "type": "power_grid",
    "criticality": 0.95
  }'
```

---

## Step 5: Create Database Migration

```bash
cd apps/api

# Create migration
alembic revision -m "add_cip_module"

# Edit migration file to add CIP tables
# See: apps/api/alembic/versions/XXXX_add_cip_module.py

# Run migration
alembic upgrade head
```

---

## Step 6: Create Frontend Component (Optional)

```bash
# Create CIP dashboard component
mkdir -p apps/web/src/modules/cip
touch apps/web/src/modules/cip/CIPDashboard.tsx
```

```typescript
// apps/web/src/modules/cip/CIPDashboard.tsx
export default function CIPDashboard() {
  return (
    <div>
      <h1>Critical Infrastructure Protection</h1>
      {/* Add CIP-specific UI */}
    </div>
  );
}
```

---

## Step 7: Iterate and Scale

Once CIP module is working:

1. ✅ Add more CIP functionality (cascade simulation, monitoring)
2. ✅ Create SCSS module (follow same pattern)
3. ✅ Create SRO module (follow same pattern)
4. ✅ Add cross-module queries
5. ✅ Scale to other modules

---

## Common Patterns

### Pattern 1: Module Service

```python
class ModuleService:
    def __init__(self):
        self.kg = KnowledgeGraphService()
        self.module_namespace = "module_name"
    
    async def create_entity(self, data: dict):
        # Create node in Knowledge Graph
        node = await self.kg.create_node(
            node_type="MODULE_ENTITY",
            properties={**data, "module": self.module_namespace}
        )
        return node
```

### Pattern 2: Module Endpoint

```python
router = APIRouter()
service = ModuleService()

@router.post("/entities")
async def create_entity(data: dict):
    return await service.create_entity(data)
```

### Pattern 3: Module Agent

```python
from src.layers.agents.sentinel import SentinelAgent

class ModuleSentinelAgent(SentinelAgent):
    def __init__(self):
        super().__init__()
        self.module = "module_name"
    
    async def monitor(self):
        # Module-specific monitoring
        pass
```

---

## Troubleshooting

### Issue: Module not found
**Solution:** Make sure module is registered in `ModuleRegistry`

### Issue: Knowledge Graph node not created
**Solution:** Check Neo4j connection, verify node type is allowed

### Issue: API endpoint 404
**Solution:** Verify router is included in `router.py`

### Issue: Database migration fails
**Solution:** Check schema name, verify table doesn't exist

---

## Next Steps

1. ✅ Complete Step 1-3 (base framework)
2. ✅ Implement CIP module (Step 4)
3. ✅ Test and iterate
4. ✅ Scale to SCSS and SRO modules
5. ✅ Follow roadmap for remaining modules

---

## Resources

- **Full Architecture:** `docs/architecture/STRATEGIC_MODULES.md`
- **Implementation Details:** `docs/architecture/STRATEGIC_MODULES_IMPLEMENTATION.md`
- **30-Year Roadmap:** `docs/architecture/STRATEGIC_MODULES_ROADMAP.md`
- **Integration Matrix:** `docs/architecture/STRATEGIC_MODULES_MATRIX.md`
- **Summary:** `STRATEGIC_MODULES_SUMMARY.md`

---

**Ready to start? Begin with Step 1!** 🚀
