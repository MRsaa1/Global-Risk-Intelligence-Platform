# Тестирование всего, для чего взят GPU

Один чеклист: туннель → браузер → проверка API/NIM → UI (Command Center, Stress Test, BCP, Municipal, AI в отчёте).

**Цель:** весь стек связан с нашим сервисом: API, фронт, NIM (погода), **E2CC (Omniverse)** — чтобы кнопка «Open in Omniverse» открывала визуализацию Earth-2.  
**Предполагается:** на GPU-сервере запущены API (9002), фронт (5180), NIM (8001), при полном стеке — E2CC (8010). В `apps/api/.env`: `NVIDIA_API_KEY` для AI, `E2CC_BASE_URL=http://localhost:8010` для кнопки Omniverse.

---

## Шаг 0. Туннель и URL

**Терминал 1 (не закрывать).** Для полного стека (включая «Open in Omniverse») добавьте порт 8010:
```bash
ssh -i ~/.ssh/risk-platform-g5.pem -L 15180:localhost:5180 -L 19002:localhost:9002 -L 8010:localhost:8010 ubuntu@34.238.171.112
```
Если E2CC пока не развёрнут — можно без `-L 8010:localhost:8010`.

**Браузер (обязательно с `?api=...`):**
```
http://127.0.0.1:15180?api=http://127.0.0.1:19002
```

Без `?api=...` запросы пойдут на фронт, а не на API — будут Failed to fetch.

---

## Шаг 1. Быстрая проверка API и NIM (из терминала на Mac)

В **другом** терминале (туннель уже открыт в первом):

```bash
cd ~/global-risk-platform && ./scripts/check-gpu-from-mac.sh
```

Скрипт проверяет:
- `GET /api/v1/health` — API жив, `demo_mode`
- `GET /api/v1/health/nvidia` — NIM (FourCastNet) и прочие NVIDIA-сервисы

Если всё ок — переходите к проверкам в UI (шаги 2–8).

---

## Шаг 2. Command Center

1. Открыть **Command Center**: из главной или `http://127.0.0.1:15180/command?api=http://127.0.0.1:19002`
2. Проверить:
   - **PlatformWS: Connected** в консоли (без ошибок).
   - Слева внизу бейдж **NIM: ✓ FourCastNet** (если NIM запущен на сервере).
   - Глобус и панели загружаются.
   - **Алерты** (если есть): приходят в **Command Center** в блок **Recent Activity** справа внизу экрана (риск-алерты и платформенные события); на **Dashboard** — в панели **AlertPanel** (алерты от SENTINEL). Источник: API `GET /api/v1/alerts/summary`, WebSocket для real-time.

---

## Шаг 3. Стресс-тест и отчёт (GPU/NIM)

1. В Command Center выбрать сценарий (например Flood), город, нажать **Run stress test**.
2. Дождаться завершения.
3. Открыть **Stress Test Report** (или перейти в отчёт по ссылке).
4. Проверить:
   - В отчёте блок **Weather / climate** с упоминанием **FourCastNet NIM (GPU)** (если NIM включён).
   - Блоки **Explain scenario**, **Recommendations**, **NGFS disclosure**:
     - с `NVIDIA_API_KEY`: живой текст от модели;
     - без ключа: «Demo response. Optional: set NVIDIA_API_KEY…».

---

## Шаг 4. Stress Planner

1. Перейти в **Stress Planner** (из меню или `/stress-planner`).
2. Выбрать сектор, сценарий, нажать **Run**.
3. Ожидание: результат с метриками и **loss distribution** (mean loss, VaR и т.д.).
4. Если ошибка «API returned no loss distribution» — проверьте, что открыт URL с `?api=http://127.0.0.1:19002` и API на 9002 запущен.

---

## Шаг 5. BCP Generator

1. Перейти в **BCP Generator** (`/bcp-generator`).
2. Заполнить форму (сущность, сценарий), нажать генерацию.
3. Ожидание: появление текста плана (или демо-ответа при отсутствии ключа).
4. При «Failed to fetch» — снова проверка URL с `?api=...` и пересборка/деплой фронта.

---

## Шаг 6. Municipal Dashboard (CADAPT)

1. Перейти в **Strategic Modules** → **Climate Adaptation (CADAPT)** или `/municipal`.
2. Выбрать город.
3. Ожидание: загрузка Risk Summary, карты, Funding, Alerts без ошибки «Municipal dashboard fetch error».
4. Если виден жёлтый баннер «Cannot reach API…» — открыть приложение с `?api=http://127.0.0.1:19002` и обновить страницу (лучше полное обновление Cmd+Shift+R).

---

## Шаг 7. NIM: Test weather (если NIM запущен)

1. В **Command Center** слева внизу, рядом с бейджем **NIM: ✓ FourCastNet**, есть кнопка **Test weather (NIM)**.
2. Нажать её (кнопка активна только при `fourcastnet.status === 'healthy'`), дождаться ответа.
3. Ожидание: сообщение **«4 steps from FourCastNet NIM ✓»** появляется **справа от этой же кнопки** (зелёным мелким шрифтом). Если текст обрезан — навести курсор для tooltip. Если кнопка серая (disabled) — NIM на сервере не healthy; проверьте `./scripts/check-gpu-from-mac.sh` и на сервере `curl -s http://localhost:8001/v1/health/ready`.

---

## Шаг 8. Визуализации и прочее

- **Visualizations / Risk Flow Analysis:** выпадающий список «Stress test» заполнен (15–20+ сценариев). Если пусто — на сервере: `curl -X POST http://localhost:9002/api/v1/stress-tests/admin/seed`.
- **Digital Twin / 3D:** выбор города, загрузка Google Photorealistic 3D или OSM Buildings. Ошибки 503 от Google — со стороны их сервиса; в консоли одно сообщение «Some 3D tiles could not be loaded…».

---

## Шаг 9. E2CC (Open in Omniverse) — полная связка с нашим сервисом

Кнопка **«Open in Omniverse»** в Command Center открывает **Earth-2 Command Center (E2CC)** — визуализацию погоды/климата в NVIDIA Omniverse.

1. **Развернуть E2CC на GPU-сервере** (один раз). На сервере из корня проекта:
   ```bash
   cd ~/global-risk-platform
   chmod +x scripts/setup-e2cc-on-server.sh
   ./scripts/setup-e2cc-on-server.sh
   ```
   Скрипт ставит git-lfs, xvfb, клонирует [earth2-weather-analytics](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics), правит `.kit`, собирает E2CC.

2. **Запуск E2CC и полного стека.** При каждом запуске сервера можно поднимать всё одной командой:
   ```bash
   cd ~/global-risk-platform && ./scripts/run-on-gpu-server.sh
   ```
   Скрипт сам запустит E2CC в фоне (порт 8010), если E2CC уже собран. Либо вручную:
   ```bash
   ./scripts/start-e2cc.sh --background
   ```
   В `apps/api/.env` уже прописан `E2CC_BASE_URL=http://localhost:8010` (добавляется setup-server-gpu.sh и start-e2cc.sh).

3. **С Mac:** туннель с портом 8010 (Шаг 0). В Command Center бейдж **E2CC: ✓**, кнопка **«Open in Omniverse»** открывает `http://127.0.0.1:8010`.

Подробно: [OMNIVERSE_E2CC_SETUP.md](OMNIVERSE_E2CC_SETUP.md), [E2CC_ON_SERVER_AND_STRESS_TESTS.md](E2CC_ON_SERVER_AND_STRESS_TESTS.md).

---

## Краткая таблица

| № | Что тестируем        | Где смотреть                         | Успех |
|---|----------------------|--------------------------------------|--------|
| 1 | API + NIM            | `./scripts/check-gpu-from-mac.sh`    | health OK, fourcastnet_nim.ready при NIM |
| 2 | Command Center       | Command Center, бейдж NIM            | Подключение, глобус, алерты |
| 3 | Стресс-тест + отчёт  | Run stress test → Report             | FourCastNet в отчёте, AI или демо-текст |
| 4 | Stress Planner       | Stress Planner → Run                 | Результат с loss distribution |
| 5 | BCP Generator        | BCP Generator → Generate             | Текст плана без Failed to fetch |
| 6 | Municipal Dashboard  | CADAPT → выбор города                | Данные без баннера ошибки API |
| 7 | Test weather (NIM)   | Command Center → кнопка Test weather | Ответ от FourCastNet |
| 8 | Seed стресс-тестов   | Visualizations → список Stress test  | 15+ сценариев |
| 9 | **E2CC / Open in Omniverse** | Command Center → кнопка Omniverse, бейдж E2CC | E2CC: ✓, кнопка открывает визуализацию на 8010 |

---

## Если что-то не работает

- **Failed to fetch / Unexpected token '<'**  
  Открывать приложение с `?api=http://127.0.0.1:19002`. Пересобрать фронт и залить на сервер при необходимости.

- **API (:9002): down**  
  На сервере: `cd ~/global-risk-platform && ./scripts/run-on-gpu-server.sh`. Логи: `tail -f /tmp/api.log`.

- **NIM не ready**  
  На сервере: `export NGC_API_KEY=ваш_ключ && ./scripts/brev-start-nim.sh`. Проверка: `curl -s http://localhost:8001/v1/health/ready`.

- **Demo response вместо живого AI**  
  В `apps/api/.env` на сервере: `NVIDIA_API_KEY=ваш_ngc_ключ`, затем перезапуск API (`./scripts/run-on-gpu-server.sh`).

- **E2CC падает с «Segmentation fault (core dumped)»**  
  Крах в стеке RTX/Hydra (librtx, carb.scenerenderer-rtx, omni.hydra.rtx) при старте. Частые причины: (1) **GPU занят** (nvidia-smi: tritonserver/NIM используют почти всю память) — для E2CC с RTX не хватает памяти или конфликт; (2) headless (Xvfb) + драйвер 580/новый CUDA — баг в Omniverse Kit. Что пробовать: установить Mesa и `export LIBGL_ALWAYS_SOFTWARE=1` перед запуском; либо временно остановить Triton (`kill <PID>` из nvidia-smi), освободить GPU и снова `./deploy/deploy_e2cc.sh -s`. Если segfault сохраняется — на этом инстансе E2CC streamer не поддерживается; кнопка «Open in Omniverse» недоступна. Остальной стек (NIM, стресс-тесты, отчёты) работает без E2CC.

- **Кнопка «Open in Omniverse» не открывает / E2CC: not deployed**  
  Развернуть E2CC на сервере (Шаг 9): `./scripts/setup-e2cc-on-server.sh`, затем запустить streamer (`deploy_e2cc.sh -s`), в `.env` задать `E2CC_BASE_URL=http://localhost:8010`, перезапустить API. С Mac в туннель добавить `-L 8010:localhost:8010`.

Полный запуск и деплой: [DEPLOY_SAFE.md](../DEPLOY_SAFE.md), [GPU_LAUNCH_STEP_BY_STEP.md](GPU_LAUNCH_STEP_BY_STEP.md).

---

## Уточнения (FAQ)

**Куда приходят алерты?**  
В **Command Center** — блок **Recent Activity** справа внизу (риск-алерты и события платформы). На **Dashboard** — отдельная панель алертов (SENTINEL). Данные: API `/api/v1/alerts/summary` и WebSocket.

**Где должно быть сообщение «4 steps from FourCastNet NIM»?**  
Слева внизу в Command Center: сразу **справа от кнопки «Test weather (NIM)»** (рядом с бейджем NIM). Появляется только после нажатия кнопки и только если NIM в статусе healthy. Если кнопка неактивна — проверьте NIM на сервере.

**Кто считает Exceedance Probability Curve и «10 000 Monte Carlo · Gaussian copula»?**  
**Бэкенд API** на GPU-сервере:
- **Monte Carlo (10K симуляций), Gaussian copula, Cholesky decomposition:** модуль `universal_stress_engine.py` (сервис `execute_universal_stress_test`). Строит распределение потерь, VaR/CVaR, перцентили.
- **Exceedance Probability Curve, Report v2 метрики, контагион, recovery:** используются `stress_report_metrics.py`, контагион-матрица, секторные калькуляторы. Итог собирается в отчёт (Stress Test Report) в API и отображается во фронте.

**Где кнопка «Open in Omniverse» / Omniverse?**  
В **Command Center** (страница с глобусом) кнопки две:

1. **Внизу слева**, в одной полоске с бейджами **GPU mode**, **NIM: ✓ FourCastNet** и кнопкой **Test weather (NIM)** — рядом есть ссылка **«Omniverse»** с иконкой внешней ссылки. Это она.
2. **В боковой панели** при выборе сценария/хотспота на глобусе — появляется кнопка **«Open in Omniverse»** (под кнопкой «Open Digital Twin & Stress Test»).

Если кнопка серая или не открывает E2CC — на сервере не запущен E2CC (порт 8010). Проверка: `curl -s -o /dev/null -w "%{http_code}" http://localhost:8010` — должен быть 200 или 302; если 000 или connection refused, запустите: `./scripts/start-e2cc.sh --background` (после установки: `./scripts/setup-e2cc-on-server.sh`).

**Omniverse и Earth-2 (E2CC) от NVIDIA — зачем и как?**  
Всё задумано связанным с нашим сервисом: кнопка **«Open in Omniverse»** в Command Center открывает **E2CC (Earth-2 Command Center)** — визуализацию погоды/климата в NVIDIA Omniverse (глобус, слои, таймлайн). Чтобы кнопка работала, E2CC нужно развернуть и прописать в платформе.

- **Earth-2:** семейство NVIDIA (API, NIM FourCastNet/CorrDiff). **FourCastNet NIM** (порт 8001) у вас уже даёт погоду в стресс-тестах. **E2CC** — отдельное приложение на Omniverse Kit для визуализации; оно и открывается по кнопке.
- **Как включить (всё связано):** Шаг 9 выше: на сервере `./scripts/setup-e2cc-on-server.sh`, запуск streamer `deploy_e2cc.sh -s` (порт 8010), в `apps/api/.env` — `E2CC_BASE_URL=http://localhost:8010`, перезапуск API. Туннель с Mac: `-L 8010:localhost:8010`. Тогда бейдж **E2CC: ✓** и кнопка «Open in Omniverse» откроют визуализацию в новой вкладке.

Подробно: [OMNIVERSE_E2CC_SETUP.md](OMNIVERSE_E2CC_SETUP.md), [E2CC_ON_SERVER_AND_STRESS_TESTS.md](E2CC_ON_SERVER_AND_STRESS_TESTS.md).

**Riva, Dynamo, Triton в статусе «disabled» — что это и нужно ли включать?**  
Это **опциональные** сервисы NVIDIA; для чеклиста (NIM, стресс-тесты, BCP, Municipal, AI в отчёте) их включать не обязательно.

- **NVIDIA Riva** (localhost:50051): голосовые алерты SENTINEL, TTS для отчётов («Read aloud»), опциональный голосовой ввод. Включается через `ENABLE_RIVA=true`, `RIVA_URL=...` в `.env`; нужен развёрнутый Riva-контейнер и инициализация моделей.
- **NVIDIA Dynamo** (localhost:8004): низколатентный inference при масштабировании агентов. Включается через `enable_dynamo`, `dynamo_url`; для одного инстанса обычно не требуется.
- **Triton Inference Server** (localhost:8000): самодельный LLM/эмбеддинги (TensorRT-LLM). Альтернатива облачному `NVIDIA_API_KEY`; если ключ задан и отчёты генерируются — Triton не нужен.

Итого: **disabled** для всех трёх — нормально. Включать только если нужны голос (Riva), свой LLM (Triton) или масштабирование агентов (Dynamo).

**System Overseer показывает «Degraded» — это нормально?**  
На одном GPU-сервере (API + NIM + тяжёлые эндпоинты) часто видны предупреждения: высокое потребление памяти (Process memory ~2.5 GB), медленные ответы у `POST /api/v1/generative/recommendations`, `POST /api/v1/cadapt/flood-model/validate-batch`, `POST /api/v1/data-federation/pipelines/weather_forecast/run`, `POST /api/v1/bcp/generate`. Для **демо и тестирования** статус Degraded допустим, если основные сценарии (стресс-тест, отчёт, BCP, Municipal) отрабатывают. Для продакшена имеет смысл оптимизировать тяжёлые запросы, включить Redis при необходимости и при необходимости масштабировать API.
