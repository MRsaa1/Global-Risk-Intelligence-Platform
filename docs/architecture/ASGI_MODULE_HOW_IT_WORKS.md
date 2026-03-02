# ASGI Module — как он должен работать

**AI Safety & Governance Infrastructure** — модуль надзора за ИИ-системами: регистрация AI-систем, мониторинг capability emergence и goal drift, криптографический аудит, compliance с регуляторными фреймворками (EU AI Act, US EO 14110, UK AI Safety).

**Phase 3 Scope:** Capability Emergence, Goal Drift, Cryptographic Audit, Multi-Jurisdiction Compliance.

---

## 1. Как он должен работать

1. **Регистрация AI-систем** — оператор добавляет ИИ-системы (LLM, агенты, мультимодальные модели) с типом, версией, capability level.
2. **Capability Emergence** — система записывает события (benchmark jump, novel capability, reasoning expansion); детектор анализирует метрики и генерирует алерты при превышении порогов.
3. **Goal Drift** — сохраняются снимки планов (plan_embedding, constraint_set, drift_from_baseline); анализатор вычисляет drift score и тренд (STABLE / CONCERNING).
4. **Cryptographic Audit** — события логируются в hash chain; можно верифицировать целостность по event_id; создаются Merkle anchors.
5. **Compliance** — фреймворки EU_AI_ACT, US_EO_14110, UK_AI_SAFETY; статус compliance по системе (stub: NOT_ASSESSED).
6. **Мониторинг** — агент **ASGI_SENTINEL** проверяет capability emergence и goal drift и создаёт алерты в общий поток платформы.

---

## 2. Что там должно быть представлено

| Элемент | Описание |
|--------|----------|
| **Список AI-систем** | Таблица: id, name, version, system_type, capability_level. |
| **Capability Emergence** | Alerts по системам; recommendation PAUSE/MONITOR; метрики (benchmark_jump, task_expansion, reasoning_depth, novel_tool_combo). |
| **Goal Drift** | drift_score (0–1), trend (STABLE/CONCERNING), constraint_relaxations, recommended_action. |
| **Cryptographic Audit** | Лог событий (POST /audit/log), верификация (GET /audit/verify/{id}), список anchors. |
| **Compliance** | Фреймворки (EU_AI_ACT, US_EO_14110, UK_AI_SAFETY); статус по системе; генерация отчёта. |

---

## 3. API Endpoints

| Метод | Путь | Описание |
|-------|------|----------|
| GET | /api/v1/asgi/systems | Список AI-систем |
| GET | /api/v1/asgi/systems/{id} | Детали системы |
| POST | /api/v1/asgi/systems | Регистрация системы |
| PUT | /api/v1/asgi/systems/{id} | Обновление системы |
| DELETE | /api/v1/asgi/systems/{id} | Удаление системы |
| GET | /api/v1/asgi/emergence/alerts | Текущие алерты capability emergence |
| GET | /api/v1/asgi/emergence/{system_id} | Emergence по системе |
| POST | /api/v1/asgi/emergence/events | Записать capability event |
| POST | /api/v1/asgi/emergence/acknowledge | Подтвердить алерт |
| GET | /api/v1/asgi/drift/{system_id} | Drift-анализ по системе |
| GET | /api/v1/asgi/drift/compare | Сравнение drift по нескольким системам |
| POST | /api/v1/asgi/drift/snapshots | Записать drift snapshot |
| GET | /api/v1/asgi/compliance/frameworks | Список фреймворков |
| GET | /api/v1/asgi/compliance/{system_id} | Compliance по системе |
| POST | /api/v1/asgi/compliance/report | Сгенерировать отчёт |
| GET | /api/v1/asgi/audit/verify/{event_id} | Верифицировать событие |
| GET | /api/v1/asgi/audit/anchors | Список Merkle anchors |
| POST | /api/v1/asgi/audit/log | Записать событие в audit trail |

---

## 4. Какие задачи выполнять

| Задача | Кто выполняет | Как |
|--------|----------------|-----|
| Регистрировать AI-систему | Пользователь / API | POST /api/v1/asgi/systems (name, version, system_type, capability_level). |
| Записывать capability event | Внешняя система / API | POST /api/v1/asgi/emergence/events (ai_system_id, event_type, metrics, severity). |
| Записывать drift snapshot | Внешняя система / API | POST /api/v1/asgi/drift/snapshots (ai_system_id, plan_embedding, constraint_set, drift_from_baseline). |
| Логировать audit event | Внешняя система / API | POST /api/v1/asgi/audit/log (event payload). |
| Просматривать emergence/drift | Пользователь | GET /emergence/alerts, /emergence/{id}, /drift/{id}, /drift/compare. |
| Мониторить capability и drift | ASGI_SENTINEL (агент) | В фоне: проверка emergence (recommendation=PAUSE) и drift (trend=CONCERNING, score≥0.3) → алерты в общий поток. |

---

## 5. Как должен быть наполнен

- **Минимум для демо:** 2+ AI-системы, несколько capability events, несколько drift snapshots, 3 compliance frameworks.
- **Источник данных:**
  - **Seed** при POST /api/v1/seed/seed (`strategic_modules_seed.seed_asgi`): compliance frameworks, 2 demo AI-системы (Qwen2.5-32B, Nemotron-4), capability events, drift snapshots.
  - Ручная регистрация через API.
- **Capability event types:** benchmark_jump, novel_capability, reasoning_expansion.
- **Metrics в events:** benchmark_jump (0–1), task_expansion (0–1), reasoning_depth (множитель), novel_tool_combo (int).

---

## 6. Какой агент-помощник должен там быть

**ASGI_SENTINEL** — агент мета-мониторинга AI-систем.

| Что делает | Как |
|------------|-----|
| Следит за capability emergence | Для каждой AI-системы вызывает CapabilityEmergenceDetector; при recommendation=PAUSE и нескольких алертах — создаёт HIGH alert. |
| Следит за goal drift | Для каждой системы вызывает GoalDriftAnalyzer; при trend=CONCERNING и drift_score≥0.3 — создаёт WARNING alert. |

Алерты попадают в общий поток платформы (GET /alerts, WebSocket, Dashboard, Command Center). Поле `source: "ASGI_SENTINEL"` для фильтрации.

**Где код:** `apps/api/src/modules/asgi/agents.py` (ASGISentinelAgent), вызов из `apps/api/src/api/v1/endpoints/alerts.py` в цикле мониторинга.

---

## 7. Краткая сводка

- **Назначение:** надзор за AI-системами — capability emergence, goal drift, crypto audit, compliance.
- **Представлено:** список AI-систем, emergence alerts, drift analysis, audit anchors, compliance frameworks.
- **Задачи:** регистрация систем и запись events/snapshots (API), просмотр emergence/drift (пользователь), алерты (ASGI_SENTINEL).
- **Наполнение:** seed при POST /seed (compliance + demo systems + events + snapshots) или ручной ввод.
- **Агент:** ASGI_SENTINEL — мониторинг emergence (PAUSE) и drift (CONCERNING), алерты в общий поток.
