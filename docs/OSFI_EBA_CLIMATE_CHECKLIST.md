# OSFI B-15 / EBA Climate — Checklist по плану

Явный чеклист выравнивания платформы под **OSFI Guideline B-15: Climate Risk Management** (Канада) и **EBA Guidelines on Management of ESG Risks** (EU), включая климатические сценарии и стресс-тестирование.

Использование:
- **✅** — реализовано в кодовой базе и доступно в UI/API.
- **⚠** — частично (есть задел или смежная функция, до полноты — доработка).
- **❌** — не реализовано по плану.

---

## OSFI B-15: Climate Risk Management

*Источник: OSFI Guideline B-15 (Climate Risk Management). Применимо к FRFIs (Канада).*

| # | Требование | Где в платформе | Статус |
|---|------------|------------------|--------|
| 1 | **Governance and Strategy** — oversight климатических рисков на уровне совета и менеджмента | Audit Extension: секция «Governance and Strategy» в disclosure package; Regulatory Engine: `OSFI_B15` в jurisdiction Canada | ✅ |
| 2 | **Risk Management** — интеграция климатических рисков в ERM | Stress Test + Risk Zone Calculator; regulatory_engine: entity FINANCIAL/CITY_REGION → EBA_Climate, OSFI_B15; Guardrails: TCFD/CSRD в контексте | ✅ |
| 3 | **Scenario Analysis** — климатические сценарии и стресс-тесты | Stress scenario registry: NGFS (SSP2-4.5, SSP5-8.5), Flood/Heat; Command Center + Stress Test Report; disclosure draft (NGFS/EBA/Fed) | ✅ |
| 4 | **Disclosure** — раскрытие климатических рисков | Audit Ext: `generate_disclosure_package("OSFI_B15")`; AuditExtPage: one-click TCFD, OSFI B-15, EBA; Stress Test Report → Generate disclosure draft | ✅ |
| 5 | **Climate transition plans** (B-15 Ch.2) | Секция «Transition Plan» в OSFI_B15 disclosure package с placeholder-текстом; readiness questionnaire включает пункт про transition plan | ✅ |
| 6 | **Scope 1 / Scope 2 GHG** (B-15 disclosure) | Секции «Scope 1 & 2 GHG» и «Scope 3 GHG» в OSFI_B15 disclosure с placeholder (данные — из внешнего inventory) | ✅ |
| 7 | **Scope 3 GHG** (B-15, сдвиг на 2028) | Секция в disclosure + пункт в readiness questionnaire; placeholder для FY2028 | ✅ |
| 8 | **Readiness self-assessment** (B-15 questionnaire) | API `GET /audit-ext/osfi-b15/readiness-questions`, `POST .../readiness-submit`; вкладка «OSFI B-15 Readiness» на AuditExtPage — опросник, отправка, счёт и список gaps | ✅ |

**Сводка OSFI B-15:** полное выравнивание по чеклисту: сценарии, disclosure (включая transition plan, GHG Scope 1/2/3, Metrics and Targets), readiness self-assessment реализованы. GHG-данные — placeholder (инвентаризация подключается отдельно).

---

## EBA Guidelines on Management of ESG Risks (Climate)

*Источник: EBA Guidelines on ESG risks; EU-wide stress testing (EBA/ECB).*

| # | Требование | Где в платформе | Статус |
|---|------------|------------------|--------|
| 1 | **Risk Identification** — выявление ESG/климатических рисков | Stress scenario registry: EBA_Adverse, NGFS climate; Risk Zone Calculator; entity type + jurisdiction → EBA_Climate в regulatory_engine | ✅ |
| 2 | **Risk Measurement** — квантификация ESG/климатических рисков | Stress tests (PD/LGD, capital impact); climate_service; financial_models; risk_zone_calculator (flood, heat, transition) | ✅ |
| 3 | **Monitoring and Reporting** — мониторинг и отчётность | Audit trail (audit_extension); Stress Test Report; AuditExtPage — disclosure packages; dashboard/Command Center | ✅ |
| 4 | **Stress Testing** — климатические сценарии в стресс-тестах | stress_scenario_registry: EBA, NGFS, Fed; StressTestSelector (EBA, Fed, NGFS, BIS); EBA_Adverse, NGFS_SSP*; generative disclosure draft (EBA/Fed/NGFS) | ✅ |
| 5 | **Materiality assessment** (EBA — exposure/portfolio/sector/scenario) | Секция «Materiality Assessment» в EBA disclosure с placeholder; сценарии и портфель в stress test | ✅ |
| 6 | **10-year+ horizon** (EBA) | Сценарии с horizon 2035–2050 в registry; в отчёте — по выбранному сценарию | ✅ |
| 7 | **Integration in risk appetite / ICAAP** | Упоминается в regulatory_engine (FINANCIAL); отдельный ICAAP-модуль не выделен | ⚠ |
| 8 | **Transition planning** (EBA) | Секция «Transition Planning» в EBA disclosure с placeholder | ✅ |

**Сводка EBA:** идентификация, измерение, мониторинг, стресс-тестирование, disclosure (включая materiality и transition planning) реализованы; ICAAP/risk appetite — через общий контекст.

---

## Общие элементы (TCFD-aligned)

| # | Элемент | Платформа | Статус |
|---|---------|-----------|--------|
| 1 | Governance (раскрытие) | REGULATORY_FRAMEWORKS.TCFD/OSFI_B15/EBA → governance section в disclosure package | ✅ |
| 2 | Strategy / scenario analysis | NGFS/EBA stress scenarios; Stress Test Report; flood/heat scenarios (CADAPT) | ✅ |
| 3 | Risk management (process) | Audit trail; stress test inputs/outputs; regulatory context по entity/jurisdiction | ✅ |
| 4 | Metrics and targets | Секция «Metrics and Targets» в OSFI_B15 и EBA disclosure (placeholder + привязка к stress test, AEL, 100-year loss) | ✅ |

---

## Где в коде

- **Disclosure packages (OSFI B-15, EBA):** `apps/api/src/services/audit_extension.py` — `REGULATORY_FRAMEWORKS`, `generate_disclosure_package()`; `apps/api/src/api/v1/endpoints/audit_ext.py`; `apps/web/src/pages/AuditExtPage.tsx`.
- **Jurisdiction → regulations (Canada: OSFI_B15, EU: EBA_Climate):** `apps/api/src/services/regulatory_engine.py` — `REGULATION_LABELS`, `JURISDICTION_CITY_REGION_REGULATIONS`, `get_applicable_regulations()`.
- **Stress scenarios (EBA, NGFS):** `apps/api/src/services/stress_scenario_registry.py`; UI: Stress Test Report, StressTestSelector, Command Center.
- **Disclosure draft (EBA/Fed/NGFS):** `apps/api/src/api/v1/endpoints/generative.py` — `disclosure-draft`; `StressTestReportContent.tsx` — выбор NGFS/EBA/Fed и кнопка «Generate disclosure draft».

---

## Рекомендации по закрытию пробелов

1. **OSFI B-15:** ✅ Реализовано: transition plan, GHG Scope 1/2/3, Metrics and Targets в disclosure; readiness questionnaire (API + UI на AuditExtPage).
2. **EBA:** ✅ Materiality assessment и Transition planning — секции в EBA disclosure с placeholder.
3. **Общее:** ✅ Metrics and Targets — секция в disclosure (OSFI_B15, EBA) с placeholder и отсылкой к платформенным метрикам.
4. **GHG inventory:** подключён реальный ввод и хранение: вкладка «GHG Inventory» на странице Regulatory Export — организация, отчётный период, Scope 1/2/3 (tCO2e), единица, источник; API `GET/PUT /audit-ext/ghg-inventory` и `GET .../ghg-inventory/list`. При генерации disclosure для того же org/period подставляются фактические данные вместо placeholder. **Оставшееся (опционально):** ICAAP/risk appetite — отдельный модуль при запросе.

После доработок — обновлять этот файл и статусы в [NOT_IMPLEMENTED.md](NOT_IMPLEMENTED.md).
