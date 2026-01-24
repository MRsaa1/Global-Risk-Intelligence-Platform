# Strategic Modules Implementation Plan

## Directory Structure

```
apps/api/src/
├── modules/                          # Strategic Modules
│   ├── __init__.py
│   ├── base.py                      # Base StrategicModule class
│   ├── registry.py                  # Module registry
│   │
│   ├── cip/                         # Module 1: Critical Infrastructure Protection
│   │   ├── __init__.py
│   │   ├── models.py                # CIP-specific models
│   │   ├── service.py               # CIP business logic
│   │   ├── endpoints.py             # CIP API endpoints
│   │   └── agents.py                # CIP_SENTINEL agent
│   │
│   ├── scss/                        # Module 2: Supply Chain Sovereignty
│   │   ├── __init__.py
│   │   ├── models.py
│   │   ├── service.py
│   │   ├── endpoints.py
│   │   └── agents.py                # SCSS_ADVISOR agent
│   │
│   ├── asm/                         # Module 3: Adversarial & Strategic Mapping
│   │   ├── __init__.py
│   │   ├── models.py
│   │   ├── service.py
│   │   ├── endpoints.py
│   │   └── agents.py                # ASM_ANALYST agent
│   │
│   ├── sro/                         # Module 4: Systemic Risk Observatory
│   │   ├── __init__.py
│   │   ├── models.py
│   │   ├── service.py
│   │   ├── endpoints.py
│   │   └── agents.py                # SRO_SENTINEL agent
│   │
│   ├── swro/                        # Module 5: Sovereign Wealth & Resources
│   │   ├── __init__.py
│   │   ├── models.py
│   │   ├── service.py
│   │   ├── endpoints.py
│   │   └── agents.py                # SWRO_ADVISOR agent
│   │
│   ├── pos/                         # Module 6: Planetary Operating System
│   │   ├── __init__.py
│   │   ├── models.py
│   │   ├── service.py
│   │   ├── endpoints.py
│   │   └── agents.py                # POS_SENTINEL agent
│   │
│   ├── cmdp/                        # Module 7: Climate Migration & Demography
│   │   ├── __init__.py
│   │   ├── models.py
│   │   ├── service.py
│   │   ├── endpoints.py
│   │   └── agents.py                # CMDP_ADVISOR agent
│   │
│   ├── asgi/                        # Module 8: AI Safety & Governance
│   │   ├── __init__.py
│   │   ├── models.py
│   │   ├── service.py
│   │   ├── endpoints.py
│   │   └── agents.py                # ASGI_SENTINEL agent
│   │
│   ├── qstp/                        # Module 9: Quantum-Safe Transition
│   │   ├── __init__.py
│   │   ├── models.py
│   │   ├── service.py
│   │   ├── endpoints.py
│   │   └── agents.py                # QSTP_ADVISOR agent
│   │
│   └── cbr/                         # Module 10: Civilizational Backup & Resilience
│       ├── __init__.py
│       ├── models.py
│       ├── service.py
│       ├── endpoints.py
│       └── agents.py                # CBR_ANALYST agent
│
├── api/v1/endpoints/
│   ├── modules/                     # Module API routers
│   │   ├── __init__.py
│   │   ├── cip.py
│   │   ├── scss.py
│   │   ├── asm.py
│   │   ├── sro.py
│   │   ├── swro.py
│   │   ├── pos.py
│   │   ├── cmdp.py
│   │   ├── asgi.py
│   │   ├── qstp.py
│   │   └── cbr.py
│
└── models/
    └── modules/                     # Module database models
        ├── __init__.py
        ├── cip.py
        ├── scss.py
        ├── asm.py
        ├── sro.py
        ├── swro.py
        ├── pos.py
        ├── cmdp.py
        ├── asgi.py
        ├── qstp.py
        └── cbr.py
```

---

## Base StrategicModule Class

All modules inherit from `StrategicModule` base class:

```python
# apps/api/src/modules/base.py

from abc import ABC, abstractmethod
from typing import Dict, List, Optional
from enum import Enum

class ModuleAccessLevel(Enum):
    PUBLIC = "public"
    COMMERCIAL = "commercial"
    CLASSIFIED = "classified"
    META = "meta"

class StrategicModule(ABC):
    """Base class for all strategic modules."""
    
    def __init__(
        self,
        name: str,
        description: str,
        access_level: ModuleAccessLevel,
        version: str = "1.0.0"
    ):
        self.name = name
        self.description = description
        self.access_level = access_level
        self.version = version
        self.enabled = True
    
    @abstractmethod
    def get_layer_dependencies(self) -> Dict[str, List[str]]:
        """Return which layers this module depends on."""
        pass
    
    @abstractmethod
    def get_knowledge_graph_nodes(self) -> List[str]:
        """Return node types this module adds to Knowledge Graph."""
        pass
    
    @abstractmethod
    def get_knowledge_graph_edges(self) -> List[str]:
        """Return edge types this module adds to Knowledge Graph."""
        pass
    
    @abstractmethod
    def get_simulation_scenarios(self) -> List[str]:
        """Return simulation scenarios this module provides."""
        pass
    
    @abstractmethod
    def get_agents(self) -> List[str]:
        """Return agent types this module provides."""
        pass
    
    def get_api_prefix(self) -> str:
        """Return API prefix for this module."""
        return f"/api/v1/{self.name.lower()}"
    
    def check_access(self, user_context: Dict) -> bool:
        """Check if user has access to this module."""
        if self.access_level == ModuleAccessLevel.PUBLIC:
            return True
        if self.access_level == ModuleAccessLevel.COMMERCIAL:
            return user_context.get("authenticated", False)
        if self.access_level == ModuleAccessLevel.CLASSIFIED:
            return user_context.get("security_clearance", False)
        if self.access_level == ModuleAccessLevel.META:
            return user_context.get("meta_access", False)
        return False
```

---

## Module Registry

Central registry for all modules:

```python
# apps/api/src/modules/registry.py

from typing import Dict, List
from .base import StrategicModule, ModuleAccessLevel

class ModuleRegistry:
    """Registry for all strategic modules."""
    
    _modules: Dict[str, StrategicModule] = {}
    
    @classmethod
    def register(cls, module: StrategicModule):
        """Register a module."""
        cls._modules[module.name.lower()] = module
    
    @classmethod
    def get(cls, name: str) -> Optional[StrategicModule]:
        """Get a module by name."""
        return cls._modules.get(name.lower())
    
    @classmethod
    def list_all(cls) -> List[StrategicModule]:
        """List all registered modules."""
        return list(cls._modules.values())
    
    @classmethod
    def list_by_access_level(cls, level: ModuleAccessLevel) -> List[StrategicModule]:
        """List modules by access level."""
        return [m for m in cls._modules.values() if m.access_level == level]
    
    @classmethod
    def get_cross_module_insights(cls, module_names: List[str]) -> Dict:
        """Get insights that span multiple modules."""
        # Query Knowledge Graph for cross-module relationships
        # Example: "What infrastructure depends on supply chains from hotspots?"
        pass
```

---

## Integration with Existing Services

### 1. Knowledge Graph Integration

Each module extends the Knowledge Graph:

```python
# Example: CIP module adds infrastructure nodes

from src.services.knowledge_graph import KnowledgeGraphService

class CIPService:
    def __init__(self):
        self.kg = KnowledgeGraphService()
        self.module_namespace = "cip"
    
    def register_infrastructure(self, infrastructure_data: Dict):
        # Create infrastructure node
        node = self.kg.create_node(
            node_type="INFRASTRUCTURE",
            properties={
                "id": infrastructure_data["id"],
                "type": infrastructure_data["type"],
                "criticality": infrastructure_data["criticality"],
                "module": self.module_namespace
            }
        )
        
        # Link to existing assets if applicable
        if infrastructure_data.get("asset_id"):
            self.kg.create_edge(
                source_id=infrastructure_data["asset_id"],
                target_id=node["id"],
                edge_type="IS_INFRASTRUCTURE"
            )
```

### 2. Simulation Engine Integration

Modules extend simulation scenarios:

```python
# Example: SRO module adds systemic risk simulation

from src.layers.simulation.cascade_engine import CascadeEngine

class SROService:
    def __init__(self):
        self.cascade_engine = CascadeEngine()
    
    def simulate_systemic_risk(self, scenario: Dict):
        # Use existing cascade engine with financial-physical correlations
        result = self.cascade_engine.run(
            scenario_type="systemic_risk",
            initial_shock=scenario["initial_shock"],
            correlation_matrix=scenario["correlations"],
            propagation_rules=scenario["rules"]
        )
        return result
```

### 3. Agent Integration

Modules create specialized agents:

```python
# Example: CIP_SENTINEL agent

from src.layers.agents.sentinel import SentinelAgent

class CIPSentinelAgent(SentinelAgent):
    """Specialized SENTINEL for Critical Infrastructure Protection."""
    
    def __init__(self):
        super().__init__()
        self.module = "cip"
        self.monitoring_frequency = 60  # seconds
    
    async def monitor(self):
        """Monitor critical infrastructure 24/7."""
        # Check infrastructure health
        # Detect anomalies
        # Generate alerts
        pass
    
    def get_alert_priority(self, alert: Dict) -> str:
        """Higher priority for critical infrastructure alerts."""
        if alert.get("infrastructure_type") == "power_grid":
            return "critical"
        return super().get_alert_priority(alert)
```

---

## Database Schema Extensions

Each module adds tables to PostgreSQL:

```python
# Example: CIP module models

from sqlalchemy import Column, String, Float, JSON, ForeignKey
from src.core.database import Base

class CriticalInfrastructure(Base):
    __tablename__ = "critical_infrastructure"
    __table_args__ = {"schema": "cip"}
    
    id = Column(String, primary_key=True)
    asset_id = Column(String, ForeignKey("assets.id"), nullable=True)
    infrastructure_type = Column(String)
    criticality_score = Column(Float)
    dependencies = Column(JSON)  # List of dependent infrastructure IDs
    module_metadata = Column(JSON)  # Module-specific data
```

---

## API Router Integration

Add module routers to main API:

```python
# apps/api/src/api/v1/router.py

from .endpoints.modules import cip, scss, sro, pos, cmdp, asgi, qstp, cbr

# Module routers
api_router.include_router(
    cip.router,
    prefix="/cip",
    tags=["Module: Critical Infrastructure Protection"],
)

api_router.include_router(
    scss.router,
    prefix="/scss",
    tags=["Module: Supply Chain Sovereignty"],
)

# ... etc for all modules
```

---

## Frontend Integration

Create module-specific pages/components:

```
apps/web/src/
├── modules/
│   ├── cip/
│   │   ├── CIPDashboard.tsx
│   │   ├── InfrastructureMap.tsx
│   │   └── CascadeVisualizer.tsx
│   ├── scss/
│   │   ├── SCSSDashboard.tsx
│   │   ├── SupplyChainMap.tsx
│   │   └── BottleneckAnalyzer.tsx
│   └── ... (other modules)
```

---

## Implementation Checklist

### Phase 1: Foundation (Months 1-6)

**Backend:**
- [ ] Create `modules/` directory structure
- [ ] Implement `StrategicModule` base class
- [ ] Implement `ModuleRegistry`
- [ ] Create database migration for module tables
- [ ] Set up module-specific Knowledge Graph namespaces

**Frontend:**
- [ ] Create `modules/` directory structure
- [ ] Create base `ModuleDashboard` component
- [ ] Add module navigation to Layout

**Integration:**
- [ ] Update `router.py` to include module endpoints
- [ ] Update Knowledge Graph service to support namespaces
- [ ] Create module initialization system

### Phase 2: Core Modules (Months 7-18)

**CIP (Critical Infrastructure Protection):**
- [ ] Implement CIP models
- [ ] Implement CIP service
- [ ] Implement CIP endpoints
- [ ] Create CIP_SENTINEL agent
- [ ] Create CIP frontend dashboard

**SCSS (Supply Chain Sovereignty):**
- [ ] Implement SCSS models
- [ ] Implement SCSS service
- [ ] Implement SCSS endpoints
- [ ] Create SCSS_ADVISOR agent
- [ ] Create SCSS frontend dashboard

**SRO (Systemic Risk Observatory):**
- [ ] Implement SRO models
- [ ] Implement SRO service
- [ ] Implement SRO endpoints
- [ ] Create SRO_SENTINEL agent
- [ ] Create SRO frontend dashboard

### Phase 3: Advanced Modules (Months 19-36)

- [ ] POS (Planetary Operating System)
- [ ] CMDP (Climate Migration & Demography)
- [ ] ASGI (AI Safety & Governance)
- [ ] QSTP (Quantum-Safe Transition)

### Phase 4: Strategic Modules (Months 37-60)

- [ ] ASM (Adversarial Mapping) - requires classified infrastructure
- [ ] SWRO (Sovereign Wealth & Resources)
- [ ] CBR (Civilizational Backup & Resilience)

---

## Testing Strategy

### Unit Tests
- Test each module's service methods
- Test module-specific agents
- Test Knowledge Graph integration

### Integration Tests
- Test cross-module queries
- Test module → layer integration
- Test API endpoints

### Security Tests
- Test access control per module
- Test classified module isolation
- Test data encryption

---

## Documentation

Each module should have:
- `README.md` - Module overview
- `API.md` - API documentation
- `MODELS.md` - Data model documentation
- `INTEGRATION.md` - Integration guide

---

## Next Steps

1. **Review architecture** with team
2. **Create base framework** (StrategicModule, Registry)
3. **Start with CIP module** (highest commercial value)
4. **Iterate and refine** based on feedback
5. **Scale to other modules** following established patterns
