# 📋 Мастер-План: Physical-Financial Risk Platform

## 🎯 Общая цель

Создать enterprise-grade платформу для управления физико-финансовыми рисками с использованием NVIDIA AI stack, 3D визуализации и real-time мониторинга.

---

## ✅ ВЫПОЛНЕНО (Январь 2026)

### Phase 1: Digital Twin & Stress Testing UI ✅
- [x] Клик на город → сразу открывается Digital Twin
- [x] Кнопка "Run Stress Test" в Digital Twin панели
- [x] Умный алгоритм размещения зон риска по типу события
- [x] Визуализация зон риска на 3D карте (subtle ellipses)
- [x] Полный отчёт после стресс-теста (View Report)
- [x] Детализация по зонам (buildings, loss, population)
- [x] Таблица митигационных действий
- [x] Источники данных в отчёте

### Phase 2: Cesium 3D Models ✅
- [x] Premium города с высококачественными моделями (NY, Sydney, SF, Boston, Denver, Melbourne, DC, Montreal)
- [x] OSM Buildings для остальных городов (серые, профессиональные)
- [x] База координат для 70+ городов
- [x] Night mode глобус (NASA Black Marble + city lights)

### Phase 3: UI/UX Improvements ✅
- [x] Граф Cascade Analysis — фиксированная высота (450px)
- [x] Subtle зоны риска (меньше размер, прозрачность)
- [x] Интегрирован Stress Lab в Risk Zones меню
- [x] Onboarding для новых пользователей
- [x] Feedback модуль

### Phase 4: NVIDIA Services (Backend) ✅ MOCK MODE
| Сервис | Файл | Статус | Примечание |
|--------|------|--------|------------|
| **Earth-2** | `nvidia_earth2.py` | ✅ Готов | Weather + Climate |
| **PhysicsNeMo** | `nvidia_physics_nemo.py` | ✅ Готов | Flood/Quake/Wind |
| **NIM** | `nvidia_nim.py` | ✅ Готов | FourCastNet, CorrDiff |
| **LLM** | `nvidia_llm.py` | ✅ Готов | Llama 3.1, Mixtral |
| **FLUX** | `nvidia_flux.py` | ✅ Готов | Image generation |
| **Endpoints** | `nvidia.py` | ✅ Готов | REST API |

### Phase 5: AI Agents ✅ MOCK MODE
| Агент | Файл | Роль | Статус |
|-------|------|------|--------|
| **SENTINEL** | `sentinel.py` | Мониторинг 24/7, алерты | ✅ Логика готова |
| **ANALYST** | `analyst.py` | Глубокий анализ рисков | ✅ Структура |
| **ADVISOR** | `advisor.py` | Рекомендации, ROI | ✅ Структура |

---

## 🔥 NVIDIA INTEGRATION - Статус (Январь 2026)

### ✅ Что РАБОТАЕТ (Cloud API)

| Сервис | Endpoint | Статус | API Key |
|--------|----------|--------|---------|
| **LLM** (Llama, Mistral) | `integrate.api.nvidia.com` | ✅ **РАБОТАЕТ** | Настроен |
| Mistral Large 675B | ✅ | Самая мощная модель |
| Llama 3.1 70B | ✅ | Лучшее качество |
| Llama 3.1 8B | ✅ | Быстрые ответы |

### ⚠️ Что требует ЛОКАЛЬНЫЙ NIM + GPU

| Сервис | Требования | Статус |
|--------|------------|--------|
| **Earth-2 FourCastNet** | NVIDIA GPU 24GB+, Docker NIM | ❌ Mock mode |
| **CorrDiff** | NVIDIA GPU 16GB+, Docker NIM | ❌ Mock mode |
| **PhysicsNeMo** | NVIDIA GPU 24GB+, Docker NIM | ❌ Mock mode |
| **FLUX.1-dev** | NVIDIA GPU 24GB+, Docker NIM | ❌ Mock mode |

### 📋 Для полной NVIDIA интеграции нужно:

1. **GPU сервер** (арендовать или свой):
   - NVIDIA A100/H100 (80GB) - идеал
   - NVIDIA RTX 4090 (24GB) - минимум
   
2. **Docker + NVIDIA Runtime**:
   ```bash
   # Установить NVIDIA Container Toolkit
   distribution=$(. /etc/os-release;echo $ID$VERSION_ID)
   curl -s -L https://nvidia.github.io/nvidia-docker/gpgkey | sudo apt-key add -
   curl -s -L https://nvidia.github.io/nvidia-docker/$distribution/nvidia-docker.list | sudo tee /etc/apt/sources.list.d/nvidia-docker.list
   sudo apt-get update && sudo apt-get install -y nvidia-container-toolkit
   ```

3. **Запустить NIM контейнеры**:
   ```bash
   # FourCastNet (Weather)
   docker run --rm --runtime=nvidia --gpus all --shm-size 4g \
     -p 8001:8000 -e NGC_API_KEY \
     nvcr.io/nim/nvidia/fourcastnet:latest
   
   # FLUX (Images)
   docker run --rm --runtime=nvidia --gpus all --shm-size 4g \
     -p 8002:8000 -e NGC_API_KEY \
     nvcr.io/nim/black-forest-labs/flux-1-dev:latest
   ```

### 🎯 API Keys (Настроены)

```bash
# .env уже создан с ключами:
NVIDIA_API_KEY=nvapi-9fcj...      # LLM (работает!)
NVIDIA_FOURCASTNET_API_KEY=nvapi-FJim...  # Earth-2 (для NIM)
NVIDIA_FLUX_API_KEY=nvapi--VIS...  # FLUX (для NIM)
```

---

## 📋 СЛЕДУЮЩИЕ ЗАДАЧИ (Приоритеты)

### 🔴 P0 — Критические (нужны для демо)

#### 1. ✅ NVIDIA LLM Integration (ВЫПОЛНЕНО)
```
[x] Получить NVIDIA_API_KEY на build.nvidia.com
[x] Настроить .env с ключами
[x] Протестировать LLM chat (Llama 3.1 8B) - РАБОТАЕТ!
[ ] Интегрировать LLM в stress test отчёты
[ ] Использовать Mistral Large для complex analysis
```

#### 2. ✅ Backend Stress Tests API (ВЫПОЛНЕНО)
```
[x] POST /api/v1/stress-tests/execute - быстрый запуск с умным алгоритмом
    - Умный алгоритм зон по типу события (Python)
    - Интеграция с LLM для Executive Summary
    - Сохранение в базу данных
[x] POST /api/v1/stress-tests/{id}/run - запуск существующего теста
[x] GET /api/v1/stress-tests/{id}/zones - зоны из расчёта
[x] GET /api/v1/stress-tests/{id}/reports - отчёт в JSON
[x] Перенести алгоритм зон с фронта на Python (risk_zone_calculator.py)
[x] Frontend обновлён для использования backend API
```

#### 3. ✅ PostgreSQL/PostGIS (ВЫПОЛНЕНО)
```
[x] stress_tests table with PostGIS boundary geometry
[x] risk_zones table with PostGIS geometry + spatial indexes
[x] historical_events table with PostGIS support
[x] Миграции с Alembic (alembic/versions/001_initial_schema.py)
[x] Spatial utilities (src/core/spatial.py)
[x] Migration helper script (migrate.sh)
```

### 🟡 P1 — Важные (MVP)

#### 4. ✅ PDF Export отчётов (ВЫПОЛНЕНО)
```
[x] WeasyPrint установлен в pyproject.toml
[x] POST /api/v1/stress/report/pdf
[x] Карты, графики, метрики в PDF (SVG charts)
[x] Брендированный шаблон с header/footer
[x] Jinja2 templates для генерации
```

#### 5. ✅ Real-time Alerts (WebSocket) (ВЫПОЛНЕНО)
```
[x] WebSocket endpoint /api/v1/alerts/ws
[x] SENTINEL агент в real-time (background monitoring)
[x] REST API для управления алертами
[x] AlertPanel компонент на Dashboard
[x] Acknowledge/Resolve функциональность
[x] Фильтрация по severity
```

#### 6. ✅ Связка Stress Tests + NVIDIA (ВЫПОЛНЕНО)
```
[x] NVIDIA Stress Pipeline сервис (nvidia_stress_pipeline.py)
[x] POST /api/v1/stress-tests/execute/nvidia endpoint
[x] При запуске теста:
    1. Earth-2 → Weather forecast для города
    2. PhysicsNeMo → Симуляция по типу события
    3. LLM → Генерация рекомендаций
[x] Fallback на mock если API недоступен
[x] Pipeline execution info в response
[x] Weather/Physics context в отчёте
```

### 🟢 P2 — Улучшения (ВЫПОЛНЕНО)

#### 7. ✅ AI/ML Предиктивные модели (ВЫПОЛНЕНО)
```
[x] Модель раннего предупреждения (predictive_ml.py)
[x] Предсказание каскадов
[x] ML feature engineering (scikit-learn)
[x] API endpoints (/api/v1/predictions/*)
    - POST /early-warning - генерация раннего предупреждения
    - POST /forecast - прогноз рисков
    - POST /cascade - предсказание каскадов
    - POST /anomaly - детекция аномалий
    - POST /batch-warnings - пакетный анализ
```

#### 8. ✅ Каскады событий (PyG/NetworkX) (ВЫПОЛНЕНО)
```
[x] Graph Neural Network модель (cascade_gnn.py)
[x] Моделирование зависимостей (GraphNode, GraphEdge)
[x] Cascade simulation (BFS + GNN)
[x] Vulnerability analysis
[x] API endpoints (/api/v1/whatif/cascade/*)
    - POST /cascade/sample - создание тестового графа
    - POST /cascade/simulate - симуляция каскада
    - GET /cascade/vulnerability - анализ уязвимостей
```

#### 9. ✅ What-If симулятор (ВЫПОЛНЕНО)
```
[x] Predefined scenarios (Baseline, Optimistic, Pessimistic, Stress)
[x] Monte Carlo simulation (до 100K итераций)
[x] Сравнение сценариев
[x] Sensitivity analysis (эластичность параметров)
[x] Optimization (оптимизация митигации)
[x] API endpoints (/api/v1/whatif/*)
    - GET /parameters - параметры симуляции
    - POST /scenarios/predefined - создание сценариев
    - POST /run - запуск симуляции
    - POST /sensitivity - анализ чувствительности
    - POST /compare - сравнение сценариев
    - POST /optimize - оптимизация митигации
```

---

## 🏗️ Архитектура (Текущая)

### Frontend (React + Cesium)
```
CommandCenter.tsx
├── RiskLevelRow → выбор события/города
├── DigitalTwinPanel → 3D визуализация
│   ├── runStressTest() → анализ зон (на фронте!)
│   ├── Risk Zone Visualization (Cesium Entities)
│   └── View Report → StressTestReport panel
├── HistoricalEventPanel → исторические данные
└── CesiumGlobe → 3D глобус
```

### Backend (FastAPI + NVIDIA)
```
/api/v1/
├── nvidia/
│   ├── earth2/forecast        → Weather (FourCastNet)
│   ├── earth2/climate/project → Climate projections
│   ├── physics-nemo/flood     → Flood simulation
│   ├── physics-nemo/structural→ Earthquake/Wind
│   ├── nim/health             → NIM status
│   ├── flux/generate          → Image generation
│   ├── llm/chat               → LLM completion
│   └── agents/                → SENTINEL, ANALYST, ADVISOR
├── stress-tests/              → TODO: Backend logic
├── assets/                    → Asset management
└── digital-twins/             → Digital Twin API
```

### NVIDIA Stack
```
NVIDIA SERVICES (Mock → Real):
├─ Earth-2
│  ├─ FourCastNet (Weather 10-day)
│  ├─ CorrDiff (High-res downscaling)
│  └─ CMIP6 (Climate projections)
│
├─ PhysicsNeMo
│  ├─ Flood Hydrodynamics
│  ├─ Structural Seismic
│  ├─ Structural Wind
│  ├─ Thermal Building
│  └─ Fire Spread
│
├─ LLM (Cloud API)
│  ├─ Llama 3.1 70B (Complex reasoning)
│  ├─ Llama 3.1 8B (Fast alerts)
│  └─ Mixtral 8x22B (Multi-task)
│
├─ FLUX.1-dev
│  └─ Report visualizations
│
└─ NVIDIA Inception
   └─ $10K free credits
```

---

## 📊 Умный алгоритм размещения зон

### По типу события:
| Тип события | Логика размещения |
|-------------|-------------------|
| **flood** | Прибрежные зоны, низменности, поймы рек |
| **seismic** | Линии разлома, старые здания, высотки |
| **fire** | Индустриальные зоны, склады топлива |
| **financial** | CBD, биржи, банковские кварталы |
| **infrastructure** | Электростанции, дата-центры, транспорт |
| **supply_chain** | Порты, склады, логистические хабы |
| **pandemic** | Метрополии, аэропорты, плотная застройка |
| **geopolitical** | Границы, стратегические объекты |

### Данные для расчёта (текущие - mock):
- Building Registry Database (mock)
- Topographic Elevation Model (mock)
- Historical Event Records (mock)
- Infrastructure Grid Mapping (mock)
- Population Density Census (mock)

### Данные для расчёта (целевые - NVIDIA):
- **Earth-2**: Real weather/climate data
- **PhysicsNeMo**: Physics-based simulations
- **OpenStreetMap**: Building footprints
- **Copernicus DEM**: Elevation data

---

## 💰 Cost Estimation

### NVIDIA API (Monthly, 1000 assets):
| Сервис | Стоимость |
|--------|-----------|
| Earth-2 forecasts | ~$500/month |
| PhysicsNeMo simulations | ~$300/month |
| LLM (Llama 3.1 70B) | ~$200/month |
| FLUX images | ~$100/month |
| **Total** | **~$1,100/month** |

### С NVIDIA Inception:
- Первые $10K бесплатно
- ~9 месяцев бесплатного использования

---

## 🎯 Roadmap

### Фаза 1: NVIDIA Integration (Текущая неделя)
- [ ] Получить API ключ
- [ ] Настроить .env
- [ ] Протестировать все сервисы
- [ ] Связать stress tests с NVIDIA

### Фаза 2: Backend API (Следующая неделя)
- [ ] PostgreSQL schema
- [ ] Stress test endpoints
- [ ] PDF export
- [ ] Historical events

### Фаза 3: Real-time (2 недели)
- [ ] WebSocket alerts
- [ ] SENTINEL в production
- [ ] Dashboard alerts

### Фаза 4: AI/ML (Месяц)
- [ ] Predictive models
- [ ] Cascade analysis
- [ ] What-If simulator

---

## 📍 Текущий статус

**Версия:** 1.5.0 (Digital Twin + Stress Test Report)  
**Дата:** 2026-01-15  
**Деплой:** https://risk.saa-alliance.com  
**GitHub:** https://github.com/MRsaa1/Global-Risk-Intelligence-Platform

### Режим работы:
- **Frontend**: ✅ Полностью функционален
- **Backend NVIDIA**: ⚠️ Mock mode (нужен API key)
- **Database**: ⚠️ SQLite (нужен PostgreSQL для production)

---

## 🚀 Следующий шаг

**Рекомендуется:** Получить NVIDIA API Key
1. Зарегистрироваться на build.nvidia.com
2. Создать API key
3. Добавить в .env:
   ```bash
   NVIDIA_API_KEY=nvapi-xxxxx
   ```
4. Перезапустить backend
5. Протестировать:
   ```bash
   curl -X POST http://localhost:9002/api/v1/nvidia/earth2/forecast \
     -H "Content-Type: application/json" \
     -d '{"latitude": 40.7128, "longitude": -74.006, "forecast_hours": 72}'
   ```

После этого NVIDIA сервисы начнут возвращать **реальные данные** вместо mock.

---

## 📚 Документация

| Файл | Описание |
|------|----------|
| `docs/NVIDIA_INTEGRATION.md` | NVIDIA integration guide |
| `docs/NVIDIA_MODELS_FOR_AGENTS.md` | Models per agent |
| `INTEGRATION_COMPLETE.md` | What's been integrated |
| `VISUALIZATION_STACK.md` | Visualization libraries |
| `docs/architecture/FIVE_LAYERS.md` | 5-layer architecture |
