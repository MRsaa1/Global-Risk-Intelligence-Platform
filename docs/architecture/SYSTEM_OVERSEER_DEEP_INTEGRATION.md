# System Overseer: План глубокой интеграции

**Цель:** System Overseer должен контролировать **каждый аспект** работы платформы и **автоматически решать** проблемы.

---

## Текущее состояние

### ✅ Что уже есть:
- Базовый мониторинг: database, redis, neo4j, external APIs
- System metrics: CPU, memory
- Platform metrics: Layer 0-5
- Alerts summary
- Executive summary через LLM
- Background loop (каждые 5 минут)
- WebSocket broadcast

### ❌ Чего НЕТ:
- Мониторинг каждого API endpoint
- Мониторинг времени ответа
- Мониторинг каждой базы данных отдельно
- Мониторинг каждого модуля
- Мониторинг каждого агента
- Мониторинг каждого сервиса
- Автоматическое решение проблем
- Мониторинг загрузки данных

---

## План интеграции

### 1. Мониторинг всех API Endpoints (37 endpoints)

**Задача:** System Overseer должен знать статус каждого endpoint.

#### 1.1 Middleware для мониторинга запросов

```python
# apps/api/src/core/middleware/oversee_middleware.py
from fastapi import Request
import time
from src.services.oversee import get_oversee_service

async def oversee_middleware(request: Request, call_next):
    """Track every API request for System Overseer."""
    start_time = time.time()
    endpoint = f"{request.method} {request.url.path}"
    
    try:
        response = await call_next(request)
        duration_ms = (time.time() - start_time) * 1000
        
        # Record to Overseer
        oversee_service = get_oversee_service()
        await oversee_service.record_endpoint_metrics(
            endpoint=endpoint,
            status_code=response.status_code,
            duration_ms=duration_ms,
            success=200 <= response.status_code < 400,
        )
        
        return response
    except Exception as e:
        duration_ms = (time.time() - start_time) * 1000
        oversee_service = get_oversee_service()
        await oversee_service.record_endpoint_error(
            endpoint=endpoint,
            error=str(e),
            duration_ms=duration_ms,
        )
        raise
```

#### 1.2 Метрики для каждого endpoint

```python
# В OverseerService добавить:
async def check_all_endpoints(self) -> Dict[str, Any]:
    """Check health of all API endpoints."""
    endpoints_status = {}
    
    # Check each endpoint category
    categories = [
        "assets", "simulations", "stress_tests", "alerts",
        "agents", "cip", "scss", "sro", "whatif",
        "bim", "digital_twins", "provenance", "platform",
        "health", "oversee", "nvidia", "climate",
        # ... все 37 endpoints
    ]
    
    for category in categories:
        status = await self._check_endpoint_category(category)
        endpoints_status[category] = status
    
    return endpoints_status
```

#### 1.3 Правила для endpoints

- **Если endpoint не отвечает > 5 секунд** → SystemAlert: "API endpoint slow"
- **Если endpoint возвращает 500** → SystemAlert: "API endpoint error"
- **Если endpoint недоступен** → SystemAlert: "API endpoint unavailable"
- **Автоматическое решение:** Retry, fallback, circuit breaker

---

### 2. Мониторинг всех баз данных

**Задача:** Отдельный мониторинг каждой БД.

#### 2.1 PostgreSQL (основная БД)

```python
async def _check_postgresql_detailed(self) -> dict:
    """Detailed PostgreSQL monitoring."""
    try:
        from src.core.database import engine
        from sqlalchemy import text
        
        async with engine.connect() as conn:
            # Check connection
            await conn.execute(text("SELECT 1"))
            
            # Check query performance
            start = time.time()
            await conn.execute(text("SELECT COUNT(*) FROM assets"))
            query_time = (time.time() - start) * 1000
            
            # Check table sizes
            result = await conn.execute(text("""
                SELECT 
                    schemaname,
                    tablename,
                    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
                FROM pg_tables
                WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
                ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
                LIMIT 10
            """))
            
            return {
                "status": "connected",
                "query_time_ms": query_time,
                "table_sizes": [dict(row) for row in result],
            }
    except Exception as e:
        return {"status": "error", "error": str(e)}
```

#### 2.2 Neo4j (Knowledge Graph)

```python
async def _check_neo4j_detailed(self) -> dict:
    """Detailed Neo4j monitoring."""
    try:
        from src.services.knowledge_graph import get_knowledge_graph_service
        kg_service = get_knowledge_graph_service()
        
        if not kg_service.is_available:
            return {"status": "unavailable"}
        
        async with kg_service.driver.session() as session:
            # Check query performance
            start = time.time()
            result = await session.run("MATCH (n) RETURN count(n) as count")
            await result.single()
            query_time = (time.time() - start) * 1000
            
            # Get node/edge counts
            result = await session.run("""
                MATCH (n)
                RETURN labels(n)[0] as label, count(n) as count
                ORDER BY count DESC
            """)
            node_counts = {row["label"]: row["count"] for row in result}
            
            return {
                "status": "connected",
                "query_time_ms": query_time,
                "node_counts": node_counts,
            }
    except Exception as e:
        return {"status": "error", "error": str(e)}
```

#### 2.3 Redis

```python
async def _check_redis_detailed(self) -> dict:
    """Detailed Redis monitoring."""
    try:
        from src.services.cache import get_cache
        cache = await get_cache()
        
        # Check connection
        await cache.ping()
        
        # Get stats
        info = await cache.info()
        
        return {
            "status": "connected",
            "memory_used_mb": info.get("used_memory", 0) / 1024 / 1024,
            "keys": info.get("db0", {}).get("keys", 0),
            "hits": info.get("keyspace_hits", 0),
            "misses": info.get("keyspace_misses", 0),
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}
```

#### 2.4 MinIO (Object Storage)

```python
async def _check_minio_detailed(self) -> dict:
    """Detailed MinIO monitoring."""
    try:
        from src.core.config import settings
        from minio import Minio
        from minio.error import S3Error
        
        client = Minio(
            settings.minio_endpoint,
            access_key=settings.minio_access_key,
            secret_key=settings.minio_secret_key,
            secure=settings.minio_secure,
        )
        
        # Check buckets
        buckets = client.list_buckets()
        bucket_sizes = {}
        
        for bucket in buckets:
            objects = client.list_objects(bucket.name, recursive=True)
            total_size = sum(obj.size for obj in objects)
            bucket_sizes[bucket.name] = {
                "size_mb": total_size / 1024 / 1024,
                "object_count": sum(1 for _ in client.list_objects(bucket.name, recursive=True)),
            }
        
        return {
            "status": "connected",
            "buckets": bucket_sizes,
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}
```

#### 2.5 TimescaleDB

```python
async def _check_timescale_detailed(self) -> dict:
    """Detailed TimescaleDB monitoring."""
    try:
        from src.core.config import settings
        from sqlalchemy import create_engine, text
        
        engine = create_engine(settings.timescale_url)
        with engine.connect() as conn:
            # Check connection
            conn.execute(text("SELECT 1"))
            
            # Check hypertables
            result = conn.execute(text("""
                SELECT hypertable_name, num_dimensions
                FROM timescaledb_information.hypertables
            """))
            
            return {
                "status": "connected",
                "hypertables": [dict(row) for row in result],
            }
    except Exception as e:
        return {"status": "error", "error": str(e)}
```

#### 2.6 Правила для баз данных

- **Если PostgreSQL не отвечает** → SystemAlert: "Database unavailable" → **Автоматическое решение:** Retry connection, alert ops
- **Если запрос > 1 секунды** → SystemAlert: "Database slow query" → **Автоматическое решение:** Log slow query, suggest index
- **Если Neo4j недоступен** → SystemAlert: "Knowledge Graph unavailable" → **Автоматическое решение:** Fallback to mock, alert ops
- **Если Redis недоступен** → SystemAlert: "Cache unavailable" → **Автоматическое решение:** Fallback to in-memory cache
- **Если MinIO недоступен** → SystemAlert: "Object storage unavailable" → **Автоматическое решение:** Alert ops, use fallback storage

---

### 3. Мониторинг всех сервисов

#### 3.1 Knowledge Graph Service

```python
async def _check_knowledge_graph_service(self) -> dict:
    """Check Knowledge Graph service health."""
    try:
        from src.services.knowledge_graph import get_knowledge_graph_service
        kg_service = get_knowledge_graph_service()
        
        # Test query
        start = time.time()
        async with kg_service.driver.session() as session:
            result = await session.run("MATCH (n:Asset) RETURN count(n) as count LIMIT 1")
            await result.single()
        query_time = (time.time() - start) * 1000
        
        return {
            "status": "healthy" if kg_service.is_available else "unavailable",
            "query_time_ms": query_time,
            "available": kg_service.is_available,
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}
```

#### 3.2 Cascade Engine

```python
async def _check_cascade_engine(self) -> dict:
    """Check Cascade Engine health."""
    try:
        from src.layers.simulation.cascade_engine import CascadeEngine
        engine = CascadeEngine()
        
        # Test small simulation
        start = time.time()
        result = await engine.simulate(
            trigger_node_id="test",
            num_runs=10,  # Small test
        )
        sim_time = (time.time() - start) * 1000
        
        return {
            "status": "healthy",
            "test_simulation_time_ms": sim_time,
            "default_runs": engine.default_runs,
        }
    except Exception as e:
        return {"status": "error", "error": str(e)}
```

#### 3.3 Simulation Engine (Physics, Climate, Economics)

```python
async def _check_simulation_engines(self) -> dict:
    """Check all simulation engines."""
    engines_status = {}
    
    # Physics Engine
    try:
        from src.layers.simulation.physics_engine import PhysicsEngine
        physics = PhysicsEngine()
        engines_status["physics"] = {"status": "healthy"}
    except Exception as e:
        engines_status["physics"] = {"status": "error", "error": str(e)}
    
    # Climate Engine
    try:
        from src.services.climate_service import climate_service
        engines_status["climate"] = {"status": "healthy"}
    except Exception as e:
        engines_status["climate"] = {"status": "error", "error": str(e)}
    
    # Economics Engine
    try:
        from src.services.financial_models import financial_models_service
        engines_status["economics"] = {"status": "healthy"}
    except Exception as e:
        engines_status["economics"] = {"status": "error", "error": str(e)}
    
    return engines_status
```

#### 3.4 NVIDIA Services

```python
async def _check_nvidia_services(self) -> dict:
    """Check all NVIDIA services."""
    nvidia_status = {}
    
    # NVIDIA LLM
    try:
        from src.services.nvidia_llm import llm_service
        nvidia_status["llm"] = {"status": "configured" if llm_service.is_available else "not_configured"}
    except Exception as e:
        nvidia_status["llm"] = {"status": "error", "error": str(e)}
    
    # NVIDIA NIM (FourCastNet, CorrDiff)
    try:
        from src.services.nvidia_nim import nim_service
        fourcastnet_healthy = await nim_service.check_health("fourcastnet")
        corrdiff_healthy = await nim_service.check_health("corrdiff")
        nvidia_status["nim"] = {
            "fourcastnet": "healthy" if fourcastnet_healthy else "unhealthy",
            "corrdiff": "healthy" if corrdiff_healthy else "unhealthy",
        }
    except Exception as e:
        nvidia_status["nim"] = {"status": "error", "error": str(e)}
    
    # NVIDIA PhysicsNeMo
    try:
        from src.services.nvidia_physics_nemo import physics_nemo_service
        nvidia_status["physics_nemo"] = {"status": "configured" if physics_nemo_service.is_available else "not_configured"}
    except Exception as e:
        nvidia_status["physics_nemo"] = {"status": "error", "error": str(e)}
    
    return nvidia_status
```

---

### 4. Мониторинг всех модулей (CIP, SCSS, SRO)

```python
async def _check_strategic_modules(self) -> dict:
    """Check all strategic modules."""
    modules_status = {}
    
    # CIP Module
    try:
        from src.modules.cip.module import CIPModule
        cip = CIPModule()
        modules_status["cip"] = {
            "status": "active",
            "version": cip.version,
            "access_level": cip.access_level.value,
        }
    except Exception as e:
        modules_status["cip"] = {"status": "error", "error": str(e)}
    
    # SCSS Module
    try:
        from src.modules.scss.module import SCSSModule
        scss = SCSSModule()
        modules_status["scss"] = {
            "status": "active",
            "version": scss.version,
        }
    except Exception as e:
        modules_status["scss"] = {"status": "error", "error": str(e)}
    
    # SRO Module
    try:
        from src.modules.sro.module import SROModule
        sro = SROModule()
        modules_status["sro"] = {
            "status": "active",
            "version": sro.version,
        }
    except Exception as e:
        modules_status["sro"] = {"status": "error", "error": str(e)}
    
    return modules_status
```

---

### 5. Мониторинг всех агентов

```python
async def _check_agents(self) -> dict:
    """Check all agents health."""
    agents_status = {}
    
    # SENTINEL
    try:
        from src.layers.agents.sentinel import sentinel_agent
        agents_status["sentinel"] = {
            "status": "active",
            "active_alerts": len(sentinel_agent.active_alerts),
            "rules_count": len(sentinel_agent.rules),
        }
    except Exception as e:
        agents_status["sentinel"] = {"status": "error", "error": str(e)}
    
    # ANALYST
    try:
        from src.layers.agents.analyst import analyst_agent
        agents_status["analyst"] = {"status": "active"}
    except Exception as e:
        agents_status["analyst"] = {"status": "error", "error": str(e)}
    
    # ADVISOR
    try:
        from src.layers.agents.advisor import advisor_agent
        agents_status["advisor"] = {"status": "active"}
    except Exception as e:
        agents_status["advisor"] = {"status": "error", "error": str(e)}
    
    # REPORTER
    try:
        from src.layers.agents.reporter import reporter_agent
        agents_status["reporter"] = {"status": "active"}
    except Exception as e:
        agents_status["reporter"] = {"status": "error", "error": str(e)}
    
    return agents_status
```

---

### 6. Мониторинг производительности

#### 6.1 Время ответа API

```python
# В middleware уже записывается duration_ms
# Добавить в evaluate_rules:

if endpoint_metrics.get("avg_duration_ms", 0) > 5000:
    alerts.append(SystemAlert(
        code="api_slow",
        severity="warning",
        title="API endpoint slow",
        message=f"Average response time: {endpoint_metrics['avg_duration_ms']}ms",
        source="api",
    ))
```

#### 6.2 Загрузка данных

```python
async def _check_data_loading(self) -> dict:
    """Check data loading performance."""
    loading_status = {}
    
    # Check asset loading
    try:
        from src.core.database import get_db
        async for db in get_db():
            start = time.time()
            result = await db.execute(select(Asset).limit(100))
            await result.scalars().all()
            load_time = (time.time() - start) * 1000
            loading_status["assets"] = {"load_time_ms": load_time}
            break
    except Exception as e:
        loading_status["assets"] = {"status": "error", "error": str(e)}
    
    return loading_status
```

---

### 7. Автоматическое решение проблем

#### 7.1 Автоматические действия

```python
async def auto_resolve_issues(self, system_alerts: List[SystemAlert]) -> List[str]:
    """Automatically resolve issues where possible."""
    actions_taken = []
    
    for alert in system_alerts:
        if alert.code == "infra_redis" and alert.severity == "warning":
            # Try to reconnect Redis
            try:
                from src.services.cache import get_cache
                cache = await get_cache()
                await cache.ping()
                actions_taken.append("Redis reconnected")
            except:
                pass
        
        elif alert.code == "api_endpoint_error":
            # Retry endpoint
            actions_taken.append(f"Retried endpoint: {alert.message}")
        
        elif alert.code == "database_slow_query":
            # Log slow query for optimization
            actions_taken.append("Logged slow query for optimization")
        
        elif alert.code == "system_memory" and alert.severity == "warning":
            # Suggest cache cleanup
            actions_taken.append("Suggested cache cleanup")
    
    return actions_taken
```

#### 7.2 Circuit Breaker для внешних API

```python
class CircuitBreaker:
    """Circuit breaker for external APIs."""
    def __init__(self, failure_threshold=5, timeout=60):
        self.failure_threshold = failure_threshold
        self.timeout = timeout
        self.failure_count = 0
        self.last_failure_time = None
        self.state = "closed"  # closed, open, half_open
    
    async def call(self, func, *args, **kwargs):
        if self.state == "open":
            if time.time() - self.last_failure_time > self.timeout:
                self.state = "half_open"
            else:
                raise Exception("Circuit breaker is open")
        
        try:
            result = await func(*args, **kwargs)
            if self.state == "half_open":
                self.state = "closed"
                self.failure_count = 0
            return result
        except Exception as e:
            self.failure_count += 1
            self.last_failure_time = time.time()
            if self.failure_count >= self.failure_threshold:
                self.state = "open"
            raise
```

---

### 8. Расширенный snapshot

```python
async def collect_snapshot(self, include_events: bool = True) -> Dict[str, Any]:
    """Collect comprehensive snapshot."""
    # Existing checks
    health = await self._collect_health_checks()
    platform = await _fetch_platform_metrics()
    alerts = _get_sentinel_alerts()
    
    # NEW: Detailed checks
    databases = await self._collect_database_checks()
    services = await self._collect_service_checks()
    modules = await self._check_strategic_modules()
    agents = await self._check_agents()
    endpoints = await self._check_all_endpoints()
    performance = await self._check_performance()
    nvidia = await self._check_nvidia_services()
    
    return {
        "timestamp": datetime.utcnow().isoformat(),
        "health": health,
        "platform": platform,
        "alerts": alerts,
        "databases": databases,  # NEW
        "services": services,  # NEW
        "modules": modules,  # NEW
        "agents": agents,  # NEW
        "endpoints": endpoints,  # NEW
        "performance": performance,  # NEW
        "nvidia": nvidia,  # NEW
        "events_last_100": events_slice if include_events else [],
    }
```

---

### 9. Расширенные правила

```python
def evaluate_rules(self, snapshot: Dict[str, Any]) -> List[SystemAlert]:
    """Evaluate comprehensive rules."""
    alerts = []
    
    # Existing rules...
    
    # NEW: Database rules
    databases = snapshot.get("databases", {})
    if databases.get("postgresql", {}).get("status") != "connected":
        alerts.append(SystemAlert(
            code="database_postgresql",
            severity="critical",
            title="PostgreSQL unavailable",
            message="PostgreSQL database is not connected.",
            source="database",
        ))
    
    # NEW: Service rules
    services = snapshot.get("services", {})
    if services.get("knowledge_graph", {}).get("status") != "healthy":
        alerts.append(SystemAlert(
            code="service_kg",
            severity="high",
            title="Knowledge Graph service unhealthy",
            message="Knowledge Graph service is not responding correctly.",
            source="service",
        ))
    
    # NEW: Module rules
    modules = snapshot.get("modules", {})
    for module_name, module_status in modules.items():
        if module_status.get("status") == "error":
            alerts.append(SystemAlert(
                code=f"module_{module_name}",
                severity="high",
                title=f"{module_name.upper()} module error",
                message=module_status.get("error", "Unknown error"),
                source="module",
            ))
    
    # NEW: Endpoint rules
    endpoints = snapshot.get("endpoints", {})
    for endpoint_name, endpoint_status in endpoints.items():
        if endpoint_status.get("error_rate", 0) > 0.1:  # >10% errors
            alerts.append(SystemAlert(
                code=f"endpoint_{endpoint_name}",
                severity="high",
                title=f"{endpoint_name} endpoint high error rate",
                message=f"Error rate: {endpoint_status['error_rate']*100:.1f}%",
                source="api",
            ))
    
    # NEW: Performance rules
    performance = snapshot.get("performance", {})
    if performance.get("avg_response_time_ms", 0) > 5000:
        alerts.append(SystemAlert(
            code="performance_slow",
            severity="warning",
            title="System performance degraded",
            message=f"Average response time: {performance['avg_response_time_ms']}ms",
            source="performance",
        ))
    
    return alerts
```

---

## Реализация

### Этап 1: Middleware для мониторинга API (1-2 дня)
- [ ] Создать `oversee_middleware.py`
- [ ] Добавить в `main.py`
- [ ] Тестирование

### Этап 2: Детальный мониторинг баз данных (2-3 дня)
- [ ] Расширить `_check_database`, `_check_neo4j`, `_check_redis`
- [ ] Добавить `_check_minio_detailed`, `_check_timescale_detailed`
- [ ] Интегрировать в `collect_snapshot`

### Этап 3: Мониторинг сервисов и модулей (2-3 дня)
- [ ] Добавить проверки всех сервисов
- [ ] Добавить проверки всех модулей
- [ ] Добавить проверки всех агентов

### Этап 4: Автоматическое решение проблем (3-5 дней)
- [ ] Реализовать `auto_resolve_issues`
- [ ] Добавить Circuit Breaker
- [ ] Добавить retry логику
- [ ] Добавить fallback механизмы

### Этап 5: Расширенные правила и метрики (2-3 дня)
- [ ] Расширить `evaluate_rules`
- [ ] Добавить performance monitoring
- [ ] Добавить endpoint monitoring

---

## Итог

После реализации System Overseer будет:

✅ **Мониторить:**
- Все 37 API endpoints
- Все 5 баз данных (PostgreSQL, Neo4j, Redis, MinIO, TimescaleDB)
- Все сервисы (Knowledge Graph, Cascade Engine, Simulation Engines)
- Все модули (CIP, SCSS, SRO)
- Все агенты (SENTINEL, ANALYST, ADVISOR, REPORTER)
- Время ответа каждого запроса
- Загрузку данных
- Использование ресурсов

✅ **Автоматически решать:**
- Переподключение к базам данных
- Retry failed requests
- Circuit breaker для внешних API
- Fallback механизмы
- Очистка кэша при нехватке памяти

✅ **Алертить:**
- Критические проблемы немедленно
- Предупреждения о деградации
- Рекомендации по оптимизации

**System Overseer станет "мозгом" платформы, контролирующим каждый аспект работы.**
