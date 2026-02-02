# Universal Stress Testing Methodology — где реализовано и как увидеть

## Где реализовано

### Бэкенд (API)

| Файл | Что делает |
|------|------------|
| `apps/api/src/services/universal_stress_engine.py` | Уравнение потерь L = Σ [EAD × LGD × PD × (1 + CF)] × DF, Monte Carlo 10K, секторные параметры |
| `apps/api/src/services/sector_calculators.py` | Формулы по секторам: Insurance (Solvency, Claims), Real Estate (DSCR, LTV), Financial (NPL, LCR), Enterprise (Cash Runway, Supply Buffer), Defense (Readiness, SPOF) |
| `apps/api/src/services/contagion_matrix.py` | 5×5 матрица контагиозности, эффекты 1/2/3 порядка, путь каскада |
| `apps/api/src/services/recovery_calculator.py` | RTO/RPO по секторам, фазы восстановления, критические пути |
| `apps/api/src/services/stress_report_metrics.py` | Report V2 теперь вызывает движки выше вместо масштабирования |
| `apps/api/src/services/nim_context_prompts.py` | Универсальный контекст-промпт и шаблоны для NIM |
| `apps/api/src/services/rapids_accelerator.py` | Опциональное GPU-ускорение (RAPIDS), fallback на CPU |
| `apps/api/src/schemas/universal_stress_schema.py` | Pydantic-модели входа/выхода (Part 4.1 и 6.1 методологии) |
| `apps/api/src/api/v1/endpoints/universal_stress.py` | Эндпоинты Universal Stress Testing |

### Фронтенд (Web)

| Файл | Что делает |
|------|------------|
| `apps/web/src/components/StressTestReportContent.tsx` | Блок «Stress Test Report 2.0»: бейджи методики (Monte Carlo, Contagion Matrix, Recovery Calc, Cascade GNN), секторные метрики, engines_used |
| `apps/web/src/lib/stressTestReportV2Types.ts` | Типы Report V2, в т.ч. `sector_metrics`, `engines_used` |

---

## Как увидеть

### 1. Через API (после запуска API на порту 9002)

**Запуск API (из корня репозитория):**
```bash
cd apps/api && source .venv/bin/activate && uvicorn src.main:app --host 0.0.0.0 --port 9002 --reload
```

**Эндпоинты:**

- **Выполнить полный стресс-тест по методологии:**
  - `POST /api/v1/stress-tests/universal`
  - Body (пример): `{ "sector": "financial", "scenario_type": "flood", "severity": 0.85, "total_exposure": 500000000 }`
  - Ответ: loss_distribution, timeline_analysis, cascade_analysis, report_v2, sector_metrics.

- **Параметры сектора (схема формул):**
  - `GET /api/v1/stress-tests/sectors/insurance/parameters`
  - Аналогично: `real_estate`, `financial`, `enterprise`, `defense`.

- **Валидация входной схемы:**
  - `POST /api/v1/stress-tests/validate-schema`
  - Body: JSON с полями sector, scenario_type, severity и т.д.

**Проверка в браузере или curl:**
- Открыть: http://127.0.0.1:9002/docs — в Swagger будут раздел «Universal Stress Testing» и эти эндпоинты.
- Пример запроса:
  ```bash
  curl -X POST "http://127.0.0.1:9002/api/v1/stress-tests/universal" \
    -H "Content-Type: application/json" \
    -d '{"sector":"financial","scenario_type":"flood","severity":0.85,"total_exposure":500000000}'
  ```

### 2. В UI приложения

1. Запустить API (порт 9002) и фронтенд (например, `npm run dev` в `apps/web`).
2. Открыть сценарий стресс-теста (Command Center → выбор сценария → запуск стресс-теста и открытие отчёта).
3. В отчёте:
   - Блок **«Stress Test Report 2.0»** — метрики (VaR, CVaR, RTO, контагиозность, сетевой риск, чувствительность, stakeholder, model uncertainty).
   - **Бейджи методики** в начале блока: Monte Carlo, Contagion Matrix, Recovery Calc, Cascade GNN (если бэкенд отдаёт соответствующие поля в report_v2).
   - **Секторные метрики** — отдельная подсекция, если в ответе API есть `report_v2.sector_metrics`.
   - В разделе **Model uncertainty** — индикаторы «Engines: Monte Carlo ✓, Contagion ✓, Recovery ✓, Sector ✓», если бэкенд заполняет `model_uncertainty.engines_used`.

Существующие сценарии (quick / NVIDIA-enhanced), которые уже вызывают `compute_report_v2`, автоматически получают расчёты из новых движков (universal_stress_engine, contagion_matrix, recovery_calculator, sector_calculators).

### 3. План и методология

- План реализации: `.cursor/plans/universal_stress_methodology_bc7820d0.plan.md`
- Описание метрик Report V2: `docs/STRESS_TEST_REPORT_V2_METRICS.md` (если есть в проекте)

---

**Итог:** методология применена в перечисленных сервисах и эндпоинтах; увидеть можно через **Swagger** (`/docs`), **вызовы POST/GET** к `/api/v1/stress-tests/...` и в **UI отчёта** стресс-теста (Report 2.0, бейджи, секторные метрики, engines used).
