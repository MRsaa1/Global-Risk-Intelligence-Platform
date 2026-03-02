# Интеграция Global Risk с ARIN Platform

Ответы для команды Global Risk по интеграции с ARIN Platform (Unified Analysis).

---

## 1. Куда встраивать экспорт

**И то и другое — автоматически + по кнопке.**

- **Автоматически** — после каждого расчёта глобального риска по сущности (Command Center, Analytics, SRO). Это основной поток: ARIN получает данные в реальном времени и может запускать своих агентов автономно через Event Orchestrator.
- **По кнопке «Send to ARIN»** — для ручной отправки конкретного отчёта или пересчитанного результата. Полезно для ad-hoc анализа, когда пользователь хочет принудительно обновить данные в ARIN.

**Приоритет реализации:** сначала автоматический (он даёт главную ценность), кнопку можно добавить вторым этапом.

---

## 2. Какие сущности отправлять

Все перечисленные — но с разными `analysis_type`, чтобы ARIN мог их различать:

| Что отправляет Global Risk | entity_type   | analysis_type           | Комментарий                                       |
|---------------------------|---------------|-------------------------|---------------------------------------------------|
| Риск портфеля             | `"portfolio"` | `"global_risk_assessment"` | Основной расчёт — отправлять после каждого пересчёта |
| Риск отдельного актива    | `"stock"` / `"crypto"` | `"asset_risk_analysis"` | Если считается по конкретному тикеру              |
| Стресс-тест / сценарий    | `"portfolio"` | `"stress_test"`         | В `data.indicators` передать параметры сценария   |
| Отчёт SRO / compliance    | `"portfolio"` | `"compliance_check"`    | В `data` передать compliance-метрики              |

**Главное правило:** `entity_id` должен совпадать с ID сущности в ARIN. Если Global Risk считает риск для портфеля `59c072bb...`, именно этот UUID нужно передать — тогда в ARIN данные привяжутся к правильной сущности.

Можно отправлять несколько экспортов для одной `entity_id` с разными `analysis_type` — ARIN их все сохранит и использует в агрегации.

---

## 3. Пример кода (Python)

### Функция экспорта

```python
import httpx
import os

ARIN_EXPORT_URL = os.getenv("ARIN_EXPORT_URL", "https://arin.saa-alliance.com/api/v1/unified/export")
ARIN_API_KEY = os.getenv("ARIN_API_KEY", "")  # если потребуется


async def export_to_arin(
    entity_id: str,
    entity_type: str,
    analysis_type: str,
    data: dict,
    metadata: dict | None = None,
):
    """Отправка результатов анализа в ARIN Platform."""
    payload = {
        "source": "risk_management",
        "entity_id": entity_id,
        "entity_type": entity_type,
        "analysis_type": analysis_type,
        "data": data,
        "metadata": metadata or {},
    }
    headers = {"Content-Type": "application/json"}
    if ARIN_API_KEY:
        headers["X-API-Key"] = ARIN_API_KEY

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(ARIN_EXPORT_URL, json=payload, headers=headers)
        resp.raise_for_status()
        return resp.json()
```

### Вызов после расчёта риска портфеля

```python
await export_to_arin(
    entity_id="59c072bb59594317dfc5b454f0c81105",
    entity_type="portfolio",
    analysis_type="global_risk_assessment",
    data={
        "risk_score": 62,
        "risk_level": "HIGH",
        "summary": "Elevated volatility and concentration risk detected.",
        "recommendations": [
            "Review sector exposure",
            "Consider hedging for FX exposure",
        ],
        "indicators": {
            "var_95": 0.02,
            "max_drawdown": -0.12,
            "sharpe_ratio": 0.85,
        },
    },
    metadata={
        "calculated_at": "2026-02-06T15:00:00Z",
        "model_version": "1.0",
    },
)
```

### Вызов для стресс-теста

```python
await export_to_arin(
    entity_id="59c072bb59594317dfc5b454f0c81105",
    entity_type="portfolio",
    analysis_type="stress_test",
    data={
        "risk_score": 78,
        "risk_level": "HIGH",
        "summary": "Stress test: market crash -30% scenario.",
        "recommendations": ["Set stop-loss at -15%"],
        "indicators": {
            "scenario": "market_crash_30pct",
            "portfolio_loss": -0.22,
            "recovery_days_est": 180,
        },
    },
)
```

---

## 4. Переменные окружения

Добавить в `.env`:

```bash
ARIN_EXPORT_URL=https://arin.saa-alliance.com/api/v1/unified/export
ARIN_API_KEY=           # оставить пустым, пока не потребуется
```

---

## 5. Реализация в Global Risk

| Компонент | Описание |
|-----------|----------|
| `apps/api/src/services/arin_export.py` | Сервис экспорта (export_to_arin, export_portfolio_risk, export_stress_test, export_compliance_check) |
| `apps/api/src/api/v1/endpoints/arin.py` | POST `/arin/export` — ручной экспорт |
| Analytics | Авто-экспорт после `GET /analytics/portfolio-summary` |
| SRO | Авто-экспорт после `GET /sro/dashboard/heatmap` |
| Stress Tests | Авто-экспорт после `POST /stress-tests/execute` и `POST /stress-tests/{id}/run` |
| UI | Кнопки «Export to ARIN»: Analytics, SRO Module, Stress Test Report |

---

## 6. Ссылка на полную спецификацию

Подробности endpoint, обязательные поля, структура `data`, ошибки и коды — см. спецификацию интеграции ARIN.
