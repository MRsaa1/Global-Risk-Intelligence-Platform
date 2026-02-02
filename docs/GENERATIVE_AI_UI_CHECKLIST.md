# Generative AI: Checklist — где что в UI

**Проверено:** все направления реализованы. Ниже — где именно и как увидеть.

---

## 1. Отчёты и резюме

| Что | Где в UI | Как увидеть |
|-----|----------|-------------|
| **Executive Summary** | Отчёт стресс-теста | Запустите стресс-тест → откройте отчёт (см. п. 2). Блок «Executive Summary» вверху. |
| **Read aloud** | 1) AlertPanel (развёрнутый алерт) 2) Отчёт стресс-теста (рядом с Executive Summary) | 1) Command Center → панель алертов → развернуть алерт → кнопка «Read aloud». 2) В отчёте — кнопка «Read aloud» рядом с Executive Summary. |

**Файлы:** `AlertPanel.tsx` (Read aloud в алерте), `StressTestReportContent.tsx` (Executive Summary + Read aloud).

---

## 2. Объяснение сценариев

| Что | Где в UI | Как увидеть |
|-----|----------|-------------|
| **Explain zone** | Command Center — панель стресс-теста при выбранной зоне | Command Center → выберите сценарий (S) → на карте/списке выберите зону → справа откроется панель «Stress Test Active» с блоком зоны → кнопка **«Explain zone»** под Risk Score. |
| **Explain scenario** | Отчёт стресс-теста — секция «Generative AI» | Запустите стресс-тест → откройте отчёт (кнопка «View Report» или переход на `/report`) → прокрутите до секции **«Generative AI»** → кнопка **«Explain scenario»**. |

**Файлы:** `UnifiedStressTestPanel.tsx` (Explain zone в Command Center), `StressTestReportContent.tsx` (Explain scenario в отчёте).  
**Примечание:** «Explain zone» также есть в `ZoneDetailPanel.tsx`, но этот компонент сейчас не используется в роутинге; активная реализация — в `UnifiedStressTestPanel`.

---

## 3. Рекомендации

| Что | Где в UI | Как увидеть |
|-----|----------|-------------|
| **Get recommendations** | Отчёт стресс-теста — секция «Generative AI» | То же, что п. 2: отчёт на `/report` → секция **«Generative AI»** → кнопка **«Get recommendations»**. Текст рекомендаций появляется под кнопками. |

**Файл:** `StressTestReportContent.tsx`.

---

## 4. Документы и регуляторика

| Что | Где в UI | Как увидеть |
|-----|----------|-------------|
| **Generate disclosure draft** | Отчёт стресс-теста — секция «Generative AI» | В той же секции «Generative AI»: выберите фреймворк **NGFS / EBA / Fed** в выпадающем списке → кнопка **«Generate disclosure draft»**. Черновик отображается под кнопками. |

**Файл:** `StressTestReportContent.tsx`.

---

## 5. Чат и Q&A

| Что | Где в UI | Как увидеть |
|-----|----------|-------------|
| **Ask about risks** | Command Center — плавающая кнопка | Command Center → справа внизу плавающая кнопка (иконка чипа) → открывается окно **«Risk AI Assistant»** с подсказкой «Ask about risks, portfolio, or stress scenarios». Ввод вопроса и ответ через AIQ (`/api/v1/aiq/ask`). |

**Файлы:** `AIAssistant.tsx`, `CommandCenter.tsx` (рендер `<AIAssistant />`).

---

## 6. Объяснения агентов

| Что | Где в UI | Как увидеть |
|-----|----------|-------------|
| **Summary в модалке Analyze & Recommend** | AlertPanel — развёрнутый алерт | Command Center → панель алертов → развернуть алерт → кнопка **«Analyze & Recommend»** → в открывшейся модалке сверху блок **«Summary»** (зелёный фон) с коротким LLM-объяснением алерта. Ниже — Analysis и Recommendations. |

**Файлы:** `AlertPanel.tsx` (модалка, `analyzeResult.explanation`), API `agents.py` (поле `explanation` в ответе analyze-and-recommend).

---

## 7. Синтез данных

| Что | Где в UI | Как увидеть |
|-----|----------|-------------|
| **API /generative/synthesize** | Без кнопки в UI | Эндпоинт реализован: `POST /api/v1/generative/synthesize` с телом `{ "sources": [ { "kind", "data" } ] }`. Вызов из UI (кнопка «Synthesize sources» и т.п.) можно добавить позже. |

**Файлы:** `generative.py` (API), `generative_ai.py` (сервис). UI — не реализован.

---

## Как гарантированно увидеть отчёт (п. 2–4)

- **Вариант A:** Command Center → запустить стресс-тест (сценарий + город) → после выполнения искать кнопку **«View Report»** / переход на страницу отчёта. На странице отчёта (`/report`) отображается `StressTestReportContent` с Executive Summary и секцией **«Generative AI»** (Explain scenario, Get recommendations, Generate disclosure draft).
- **Вариант B:** Если в вашей сборке отчёт открывается в модалке/оверлее (например, из Digital Twin), секция «Generative AI» будет в том же контенте отчёта — прокрутите вниз после Executive Summary.

---

## Краткая сводка

| Направление | Реализовано в UI | Где искать |
|-------------|------------------|------------|
| Отчёты и резюме | ✅ | Executive Summary + Read aloud (отчёт и алерт). |
| Объяснение сценариев | ✅ | **Explain zone** — панель зоны в Command Center; **Explain scenario** — секция «Generative AI» в отчёте. |
| Рекомендации | ✅ | Секция «Generative AI» в отчёте → «Get recommendations». |
| Документы/регуляторика | ✅ | Секция «Generative AI» в отчёте → NGFS/EBA/Fed → «Generate disclosure draft». |
| Чат и Q&A | ✅ | Command Center → плавающая кнопка → AIAssistant (AIQ). |
| Объяснения агентов | ✅ | AlertPanel → развернуть алерт → «Analyze & Recommend» → блок Summary в модалке. |
| Синтез данных | ✅ API, ❌ UI | Только API; кнопки в UI нет. |

После проверки: всё перечисленное выше реализовано и доступно в указанных местах.
