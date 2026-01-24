# Единый план: от текущего состояния к Killer Demo

**Цель:** Комплексная демонстрация для глобальных банков и регуляторов (30–45 мин).  
**Команда:** 1 человек + AI.  
**Ориентир:** 8–10 недель.

> **Актуальный стратегический фокус и фазы — в [MASTER_PLAN.md](MASTER_PLAN.md).**  
> Этот документ сохраняется как детальный тактический план (в т.ч. BCP, REPORTER, модули). Для решений «строим / не строим» и приоритета фаз используй MASTER_PLAN.

---

## Текущее состояние (кратко)

| Область | Статус | Важно для демо |
|---------|--------|----------------|
| Command Center | ✅ | Да |
| Dashboard | ✅ | Да |
| Stress Tests API | ✅ | Да |
| Knowledge Graph | ✅ | Да |
| Cascade Engine | ✅ | Да |
| EventEmitter / WebSocket | ✅ частично | Да |
| Command ↔ Dashboard sync | ⚠️ не до конца | **Критично** |
| Recovery Plans (BCP) | ❌ | **Критично** |
| Recovery Plans API | ❌ | **Критично** |
| Cascade Visualization | ⚠️ базовая | Нужно усилить |
| Multi-Jurisdiction View | ❌ | Желательно |
| InitScene / Entry | ⚠️ частично | Желательно |
| REPORTER / PDF | ⚠️ частично | Желательно |
| Strategic Modules (CIP, SCSS, SRO) | ⚠️ UI, нет backend | Низкий приоритет для демо |
| PARS, Layer 0 подписи, libs/ | ❌ | Не для демо |

---

## Фаза 0: Фундамент (1–2 недели)

**Цель:** Command Center и Dashboard — один «организм», данные и события живые.

### Неделя 1: Command Center ↔ Dashboard

1. **EventEmitter + WebSocket (backend)**
   - `event_emitter.py`: эмиссия в каналы `command_center`, `dashboard`.
   - `websocket.py`: поддержка этих каналов.
   - В `stress_tests` (и при необходимости в других местах): `emit` при start/complete/fail.

2. **Zustand + WebSocket (frontend)**
   - `platformStore.ts`: `portfolio`, `activeStressTest`, `recentEvents`, `wsStatus`.
   - `usePlatformWebSocket.ts`: подписка на `command_center`, `dashboard`; обновление store.
   - Dual state (intent/confirmed) — по желанию, минимум: один источник правды в store.

3. **Интеграция CommandCenter и Dashboard**
   - CommandCenter: при stress test, выборе зоны, открытии Twin — писать в store и/или слать события.
   - Dashboard: портфель, «At Risk», зоны — из `platformStore`; Recent Activity — из `recentEvents`.

4. **Компоненты Dashboard**
   - `ActiveOperationBadge` — «Stress Test Running…» и т.п.
   - `RecentActivityPanel` — последние N событий (stress, zone, twin).

**Критерий:** Запуск stress test в Command Center → Dashboard показывает «Running» и затем обновлённые метрики; Recent Activity пополняется.

---

### Неделя 2: Данные и мониторинг

1. **Данные для демо**
   - Seed: 50–100 активов (Европа, прибрежные зоны), несколько stress-test сценариев.
   - Knowledge Graph: 20–30 узлов (банки, компании, инфраструктура), связи, 2–3 SIFI.

2. **Внешние API (по возможности)**
   - NOAA: токен в `.env`, заменить fallback в `climate_service`/risk.
   - FEMA: проверить доступ, кэш, rate limit.

3. **Health и SENTINEL**
   - `health.py`: `/`, `/detailed` (DB, Redis, Neo4j, внешние API, psutil).
   - SENTINEL: автозапуск в `main.py` (или через флаг) и эмиссия в WebSocket при алертах.

**Критерий:** Seed загружен, health отдаёт адекватный статус, SENTINEL при необходимости шлёт события.

---

## Фаза 1: BCP / Recovery Plans (2–3 недели)

**Цель:** Часть 4 Killer Demo — «светофор» и автоматическая активация плана восстановления.

### Неделя 3: Backend Recovery Plans

1. **Модели**
   - `RecoveryPlan`: org_id, name, status, created_at, и т.п.
   - `RecoveryIndicator`: capital, liquidity, profitability; traffic_light (green/yellow/red); пороги.
   - `RecoveryMeasure`: описание, cost, impact, timeline.

2. **API**
   - CRUD для планов, индикаторов, мер.
   - `POST /recovery-plans/{id}/activate` (переход в «активен»).
   - `GET /recovery-plans/{id}/simulation` — когда индикаторы возвращаются в зелёную зону (упрощённая логика).

3. **Связь со stress tests**
   - После stress test: по правилам (например, capital &lt; X) выставлять индикаторы в red/yellow и автоматически вызывать `activate` у выбранного плана.
   - Эмиссия событий: `recovery_plan.activated`, `recovery_indicator.updated`.

### Неделя 4: Frontend Recovery Plans

1. **Recovery Dashboard (новая страница или секция)**
   - Traffic light: капитал, ликвидность, прибыльность (данные из API).
   - После stress test — переход в жёлтый/красный и отображение активного плана.

2. **Сценарий для демо**
   - Запуск climate stress test → индикаторы «краснеют» → автоматическая активация плана → меры и timeline.

**Критерий:** Stress test в сценарии банка с прибрежным портфелем → красные индикаторы → активация плана и показ мер.

---

## Фаза 2: Визуализация и «вау» (2 недели)

**Цель:** Части 2, 3, 5 Killer Demo — климат, каскады, юрисдикции, впечатляющий вход.

### Неделя 5: Cascade и Multi-Jurisdiction

1. **Cascade Visualization**
   - Улучшить `CascadeVisualizer` / `EventRiskGraph`: анимация распространения, подсветка critical path, «hidden risk multiplier» в UI.

2. **Multi-Jurisdiction View**
   - На глобусе: выделение стран/регионов (цвет или слой).
   - Панель: агрегат по юрисдикциям (НБУ, EBA, Fed и т.п.) и статус compliance (упрощённо).

### Неделя 6: Entry и полировка

1. **Immersive Entry (InitScene)**
   - В `CesiumGlobe`: полёт с 80k km → 20k km, 6–7 сек, по готовности `onGlobeReady`/`onEntryFlightComplete`.
   - В CommandCenter: координация с EntryAnimation («Approaching Earth…», «Syncing…»).

2. **Полировка**
   - Проверить сценарий «Европейский банк + прибрежный портфель» по шагам.
   - Убрать лишние логи, донастроить тексты и подсказки.

**Критерий:** Демо по климату и каскаду смотрится наглядно; вход с «вау»; мульти-юрисдикция хотя бы в виде карты и одной таблицы.

---

## Фаза 3: AI, отчёты, агенты (1–2 недели)

**Цель:** Части 2 и 6 — Executive Summary, PDF, SENTINEL/ANALYST/ADVISOR.

### Неделя 7: Отчёты и REPORTER

1. **PDF**
   - `exportStressTestPdf` и бэкенд: stress test + зоны + меры; брендинг и структура под TCFD/NGFS (упрощённо).
   - Кнопка «Export PDF» в Action Plan и/или в результатах stress test.

2. **Executive Summary (LLM)**
   - Endpoint или вызов в `stress_tests`: 1–2 абзаца по результатам (NVIDIA Cloud / fallback текст).
   - Блок в UI: «Executive Summary» под результатами stress test.

### Неделя 8: Агенты

1. **SENTINEL**
   - Уже есть; убедиться, что алерты доходят по WebSocket и отображаются в Command Center / Dashboard.

2. **ANALYST / ADVISOR**
   - Мини-интеграция: по выбранной зоне или stress test — короткий «анализ» и 2–3 «рекомендации» (LLM или шаблон). Один общий блок в UI.

**Критерий:** PDF экспортируется; Executive Summary и «рекомендации» появляются в сценарии демо.

---

## Фаза 4: Репетиция и запуск (1–2 недели)

### Недели 9–10

1. **End-to-end по сценарию Killer Demo**
   - Часть 1: Entry → Command Center.
   - Часть 2: Climate stress test (портфель → сценарий → зоны → impact → Summary → PDF).
   - Часть 3: Knowledge Graph → каскад от «падения банка» → визуализация.
   - Часть 4: Traffic light → красные индикаторы → активация Recovery Plan → меры.
   - Часть 5: Multi-Jurisdiction (карта + таблица).
   - Часть 6: SENTINEL/ANALYST/ADVISOR в одном-двух примерах.

2. **Стабильность**
   - Очистка ошибок, таймаутов, fallback при недоступности внешних API.
   - Health, логи, при необходимости — базовая мониторинг-страница.

3. **Материалы**
   - Краткий Executive Summary (1 стр).
   - Список «ключевых сообщений» по аудитории (банки, регуляторы, государства).
   - Чеклист и тайминг демо (5+10+10+10+5+5 мин).

**Критерий:** Демо 30–45 минут проходит без поломок; ключевые месседжи проговариваются.

---

## Что не входит в этот план (сознательно)

- Strategic Modules (CIP/SCSS/SRO) backend — только при остатке времени.
- PARS, libs/, полный Layer 0 (подписи) — после демо.
- K8s, Terraform, CI/CD — отдельный инфра-план.
- Полноценные unit/e2e — минимальный набор по критичным сценариям.

---

## Сводный таймлайн

| Неделя | Фокус | Результат |
|--------|-------|-----------|
| 1 | Command Center ↔ Dashboard (events, store, WebSocket) | Один живой «организм» |
| 2 | Seed, внешние API, health, SENTINEL | Данные и мониторинг |
| 3 | Recovery Plans backend (модели, API, связь со stress) | BCP на бэкенде |
| 4 | Recovery Dashboard, сценарий «светофор → план» | Часть 4 демо |
| 5 | Cascade viz, Multi-Jurisdiction | Части 3 и 5 |
| 6 | Entry, полировка сценариев | «Вау» и стабильность |
| 7 | PDF, Executive Summary | Отчёты и соответствие TCFD/NGFS |
| 8 | SENTINEL, ANALYST, ADVISOR в UI | Часть 6 демо |
| 9–10 | Репетиция, материалы, Q&A | Готовность к демо |

---

## С чего начать завтра

1. Проверить `event_emitter` и `websocket` — какие события уже есть и в какие каналы идут.
2. Доделать `platformStore` и `usePlatformWebSocket` под `stress_test.*`, `zone.*`, `portfolio.updated`.
3. Подключить CommandCenter и Dashboard к store: stress test и Recent Activity.
4. Один сквозной тест: stress test в Command Center → Dashboard показывает Running и затем обновлённые цифры.

После этого переходить к Неделе 2 (данные и мониторинг) и дальше по фазам.
