# REPORTER / PDF — статус

Текущее состояние REPORTER-агента и PDF-отчётности.

## REPORTER Agent

- **Местоположение**: `apps/api/src/layers/agents/reporter.py`.
- **Роль**: собирает результаты предыдущих шагов воркфлоу (SENTINEL, ANALYST, ADVISOR, ETHICIST) и формирует итоговый отчёт через `nvidia_llm.reporter_summary()`.
- **Действия**: `generate_report`, `synthesize`, `action_plan`, `generate_stress_report` → единый путь `_synthesize`; вывод — текстовый отчёт (и при наличии LLM — структурированный summary).
- **Каскад и контекст**: каскадная аналитика и контекст стресс-теста уже используются в воркфлоу и при формировании отчётов (доработаны ранее). REPORTER получает данные из `context` (шаги step_*_result).

## PDF

- **Сервис**: `apps/api/src/services/pdf_report.py` — `PDFReportService`, генерация стресс-тест и регуляторных отчётов (ReportLab).
- **Экспорт**: стресс-тест PDF — из `stress_tests` endpoints и agents (generate_stress_report); BCP PDF — `POST /bcp/export/pdf`; регуляторные форматы — `compliance/export`, `regulatory_formatters`.
- **Каскад в PDF**: при наличии каскадных метрик в отчёте они включаются в контент и в PDF (через report_v2 / unified stress и шаблоны).

## План улучшений отчётов и PDF — что сделано, что нет

### UI (StressTestReportContent и связанные)

| Пункт | Статус | Где |
|-------|--------|-----|
| Разделение Expected Loss и Total loss в подписях | ✅ Сделано | Подпись под метриками: «Expected Loss (above) = Monte Carlo mean… Total loss (Impact summary below) = direct scenario impact»; в таблице зон — «Expected Loss», в Impact Summary — «Total Loss». |
| Уточнение Recovery («Full economic normalization») | ✅ Сделано | Блок Recovery: «Full economic normalization» в подписи (строка под recovery_time_months). |
| Примечание к бэктесту | ✅ Сделано | Секция «Backtesting (Region-Calibrated)» + текст «Backtest calibrated on global events; regional calibration can be applied when data is available.» |
| Формат «future lives» в Ethicist | ⚠️ Частично | В `DecisionObjectCard` есть форматирование больших чисел (1e+15) для читаемости; в теле stress report/PDF verdict показывается как переданный текст — при наличии «future lives» в verdict можно добавить единое форматирование в рендере отчёта. |
| Источник «No comparable historical events» | ✅ Сделано | Текст «No comparable historical events found for this scenario and region.» при отсутствии сравнений. |
| Примечание при Cascade 0 nodes | ✅ Сделано | При `affected_count === 0 && total_loss > 0` выводится «Loss includes trigger node.»; в PDF (pdf_report) при 0 nodes и loss > 0 добавляется примечание. |

### WeasyPrint vs ReportLab (паритет)

| Пункт | Статус | Детали |
|-------|--------|--------|
| Report V2 блоки в HTML-шаблоне (WeasyPrint) | ✅ Есть | Секция «Stress Test Report 2.0»: probabilistic_metrics, temporal_dynamics, regulatory_relevance, cascade_simulations. |
| Финансовый контагион — все 4 субсектора + total в WeasyPrint | ✅ Сделано | В HTML-шаблоне (DEFAULT_TEMPLATE) выводятся banking, insurance, **real_estate**, **supply_chain** и строка **Total economic impact** при наличии. |

### Оформление PDF

| Пункт | Статус |
|-------|--------|
| Единый корпоративный шрифт | ❌ Нет (низкий приоритет) — сейчас Helvetica Neue / Arial / дефолты ReportLab. |

## Итог

- **Частично (уже доработан каскад и др.)**: REPORTER и PDF в работе; каскад и контекст стресс-теста интегрированы. Дальнейшие доработки — по мере требований к формату отчётов и новым шаблонам.
- **Осталось по плану улучшений:** (1) ~~WeasyPrint: добавить в блок Financial contagion субсекторы real_estate, supply_chain и total~~ — сделано; (2) при желании — единое форматирование «future lives» в теле отчёта/PDF при наличии Ethicist verdict; (3) корпоративный шрифт — по желанию.
