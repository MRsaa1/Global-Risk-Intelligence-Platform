# ЕДИНЫЙ МАСТЕР-ПЛАН ПРОЕКТА

**Цель:** за 8–10 недель получить killer demo для глобальных банков и регуляторов, не строя лишнего.

---

## 0. Ключевой принцип (зафиксируем сразу)

Мы **НЕ** строим платформу целиком.  
Мы строим **УБЕДИТЕЛЬНУЮ ИЛЛЮЗИЮ ЗАВЕРШЁННОЙ ПЛАТФОРМЫ**, где все ключевые элементы связаны в один сценарий.

Следовательно:

| | |
|---|--|
| ❌ | стратегические модули (10 шт.) — НЕ реализуем |
| ❌ | production-security, k8s, CI/CD — НЕ реализуем |
| ⚠️ | GPU, Cosmos, fine-tuning — по готовности; **NVIDIA Inception** — ✅ уже в программе (кредиты доступны) |
| ✅ | единый сценарий |
| ✅ | event-driven «живой организм» |
| ✅ | регуляторный нарратив |
| ✅ | визуальный wow-эффект |
| ✅ | AI как «мозг системы» |

---

## 1. Финальная структура демо (каркас)

Демо = один непрерывный сюжет:

> **Климатический шок** → **финансовый стресс** → **каскад** → **регуляторная реакция** → **восстановление** → **AI-рекомендации** → **cross-border контроль**

Всё ниже подчинено этому сюжету.

---

## 2. Архитектурный минимум (что реально должно работать)

### Обязательные слои (MVP)

| Layer | Статус | Что реально делаем |
|-------|--------|----------------------|
| Layer 0 – Verified Truth | ⚠️ частично | Добавить криптоподпись + audit trail (минимум) |
| Layer 1 – Digital Twins | ⚠️ частично | Используем как «якорь» активов, без полной физики |
| Layer 2 – Knowledge Graph | ✅ | Используем для каскадов |
| Layer 3 – Simulation | ✅ | Climate + Cascade + Finance (уже есть) |
| Layer 4 – AI Agents | ⚠️ | SENTINEL + ANALYST + ADVISOR + REPORTER (обязательно) |
| Layer 5 – PARS | ❌ | Mock + JSON schema + экспорт |

---

## 3. ЧТО МЫ СТРОИМ (и только это)

### 3.1 Функциональные блоки демо

1. **Command Center ↔ Dashboard (единый организм)**  
   → Фундамент. Ты уже правильно начал.

2. **Climate Stress Test**
   - SSP5-8.5, 2050
   - Realistic data / fallback
   - PDF-отчёт (LLM)

3. **Systemic Cascade**
   - Knowledge Graph
   - Monte Carlo
   - Hidden risk multiplier

4. **BCP / Recovery Plans**
   - Traffic Light
   - Auto-activation
   - Timeline recovery

5. **Cross-Border View**
   - Multi-jurisdiction aggregation
   - Compliance status

6. **AI Agents**
   - **SENTINEL** — мониторинг
   - **ANALYST** — разбор
   - **ADVISOR** — меры + ROI
   - **REPORTER** — регуляторные отчёты

---

## 4. ЧТО МЫ ОСОЗНАННО НЕ ДЕЛАЕМ

Чтобы не путаться:

| | | |
|---|--|--|
| ❌ | Strategic Modules (CIP, SCSS, etc.) | |
| ❌ | Полный IFC / BIM | |
| ❌ | IoT realtime | |
| ❌ | Kubernetes / Terraform | |
| ❌ | Полное шифрование данных | |
| ❌ | GNN каскады | |
| ❌ | GPU | |

Всё это — после пилота.

---

## 5. ЕДИНЫЙ ПЛАН ПО НЕДЕЛЯМ

### ФАЗА 1 — «Скелет» (Недели 1–2)

**Цель:** Платформа начинает «дышать» как единый организм.

**Делается:**
1. **Event-Driven Core**
   - Event schema
   - EventEmitter
   - Dual State (intent / confirmed)
   - WebSocket multi-channel
2. **Command Center ↔ Dashboard**
   - Общий Zustand store
   - Live-sync
   - Recent Activity
   - Active Operations
3. **Данные**
   - Seed assets (50–100)
   - Реальные координаты
   - Простейшие climate risk scores

**Результат:**  
✅ Любое действие сразу видно везде  
✅ Есть «ощущение живой системы»

---

### ФАЗА 2 — «Регуляторная ось» (Недели 3–4)

**Цель:** Показать: мы соответствуем требованиям регуляторов автоматически.

**Делается:**
1. **BCP / Recovery Plans (MVP)**
   - Models
   - Traffic Light
   - Auto-activation от stress test
   - Recovery timeline
2. **REPORTER Agent**
   - Генерация: TCFD / NGFS, Recovery Plan
   - PDF export (брендинг)
3. **Verified Truth (минимум)**
   - Hash + подпись
   - Audit trail
   - «Court-admissible» narrative (убедительно, не юридически идеально)

**Результат:**  
✅ «Compliance by design»  
✅ Регуляторы понимают ценность

---

### ФАЗА 3 — «Вау-визуал» (Недели 5–6)

**Цель:** Сделать демо запоминающимся.

**Делается:**
1. **Cascade Visualization**
   - Real-time анимация
   - Critical paths
   - Impact counters
2. **Multi-Jurisdiction View**
   - Глобус
   - Страны
   - Compliance status
3. **Immersive Entry**
   - Zoom from space
   - Smooth camera path
   - Один мощный opening shot

**Результат:**  
✅ «Мы такого не видели»  
✅ Сильный emotional hook

---

### ФАЗА 4 — «AI как мозг» (Недели 7–8)

**Цель:** Показать, что система думает сама.

**Делается:**
1. **SENTINEL** — авто-alerts, threshold breaches
2. **ANALYST** — root cause, scenario comparison
3. **ADVISOR** — меры, ROI, prioritization
4. **REPORTER (финал)** — scheduled reports, multi-stakeholder formats

**Результат:**  
✅ Proactive risk management  
✅ AI не «фича», а центральный элемент

---

### ФАЗА 5 — «Полировка» (Недели 9–10)

**Цель:** Демо, которое НЕ ломается.

**Делается:**
- End-to-end репетиция
- Performance cleanup
- Backup demo сценарий
- Q&A
- Executive deck

**Результат:**  
✅ Готово к банкам и регуляторам

---

## 6. КОНЦЕНТРАЦИЯ ВНИМАНИЯ (чтобы не расползтись)

Если сомневаешься — задавай себе вопрос:

> **Это напрямую усиливает демо-сценарий?**  
> **Да** → делаем  
> **Нет** → в бэклог

---

## 7. СЛЕДУЮЩИЙ КОНКРЕТНЫЙ ШАГ (СЕГОДНЯ)

Только один: **закончить Week 1: Event-Driven Command Center ↔ Dashboard.**

Это:
- снимет 50% хаоса
- сделает всё остальное линейным
- даст ощущение контроля

### Что входит в «закончить Week 1»

- Завершить правки по [AUDIT_AND_CONSOLIDATION.md](AUDIT_AND_CONSOLIDATION.md):
  - guard для `PORTFOLIO_UPDATED` (не перезаписывать `portfolioConfirmed` некорректной структурой)
  - убрать дубликат в канале `dashboard` (summary без `data`), чтобы не портить `progress` и др.
  - `ZONE_SELECTED`: `data.zone` на бэкенде и/или fallback на фронте
  - `STRESS_TEST_DELETED` и `RISK_ZONE_CREATED` в `EventTypes` и `get_channel_for_event`
- Ориентир по порядку работ — план **Audit Fixes** (portfolio-guard, dashboard-duplicate, zone-selected, event-types; при наличии времени — portfolio aggregates, ActiveOperationBadge, `models/__init__`).

---

## 8. Короткий вывод

Ты не запутался потому что «плохо думаешь».  
Ты запутался потому что у тебя уже архитектура уровня enterprise, а ресурсы — стартапа из 1 человека.

---

## Связь с другими документами

| Документ | Роль |
|----------|------|
| [UNIFIED_PLAN.md](UNIFIED_PLAN.md) | Более ранний план; для демо-масштаба приоритеты и фазы задаёт **MASTER_PLAN**. Детальная тактика (BCP, REPORTER, модули), бэклог. |
| [AUDIT_AND_CONSOLIDATION.md](AUDIT_AND_CONSOLIDATION.md) | Пробелы и риски по CC↔Dashboard и событиям; детализация для **Week 1** и **Фазы 1**. |
| План **Audit Fixes** | Порядок правок по аудиту (PORTFOLIO_UPDATED, ZONE_SELECTED, дубликат в dashboard, EventTypes и т.д.) — **конкретные шаги по завершению Week 1**. |
