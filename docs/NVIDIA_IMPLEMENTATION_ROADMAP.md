# План внедрения NVIDIA: Riva, Dynamo, Triton, TensorRT, опциональные

**Цель:** внедрить Riva (голос), Dynamo/Triton/TensorRT (inference), опционально cuOpt, IndeX, WaveWorks и др. по сценариям.

---

## 1. Текущее состояние (сделано)

| Компонент | Конфиг | API / сервис | Статус |
|-----------|--------|---------------|--------|
| **Riva** | `enable_riva`, `riva_url`, `riva_tts_model`, `riva_stt_model` | `nvidia_riva.py`, `GET/POST /api/v1/nvidia/riva/*` | Конфиг + сервис TTS/STT + эндпоинты; Riva-контейнер — отдельно |
| **Dynamo** | `enable_dynamo`, `dynamo_url` | LLM → `dynamo_url/v1/chat/completions` | Конфиг + маршрутизация в `nvidia_llm.py` |
| **Triton** | `enable_triton`, `triton_url`, `triton_llm_model` | LLM → `triton_url/v1/chat/completions` | Конфиг + маршрутизация в `nvidia_llm.py` |
| **TensorRT-LLM** | `use_tensorrt_llm` | — | Флаг; при True LLM-клиент может использовать Triton с backend TensorRT-LLM |
| **cuOpt** | `enable_cuopt`, `cuopt_url` | `GET /api/v1/nvidia/cuopt/health` | Конфиг + health; сервис логистики — по сценарию |
| **IndeX** | `enable_index_viz`, `index_url` | `GET /api/v1/nvidia/index/health` | Конфиг + health; визуализация — по сценарию |
| **WaveWorks** | `enable_waveworks`, `waveworks_url` | `GET /api/v1/nvidia/waveworks/health` | Конфиг + health; прибрежные риски — по сценарию |

---

## 2. Riva (приоритет UX)

**Назначение:** голосовые алерты SENTINEL, озвучка отчётов (TTS), голосовой ввод (STT).

### Шаги

1. **Развернуть Riva** (локально или облако):
   - Локально: контейнер Riva Speech (gRPC 50051, REST при наличии).
   - В `.env`: `ENABLE_RIVA=true`, `RIVA_URL=http://<host>:50051` (или REST URL, например `:8009`).

2. **Проверка:**
   - `GET /api/v1/nvidia/riva/health` — enabled + reachable.
   - `POST /api/v1/nvidia/riva/tts` с `{"text": "Critical risk alert", "language": "en"}` — вернёт `audio_base64`.

3. **Интеграция в UI (готово):**
   - Alert Panel: в развёрнутом алерте кнопка «Озвучить алерт» → вызов TTS, воспроизведение.
   - StressTestReportContent: в блоке Executive Summary кнопка «Озвучить отчёт» (если есть текст) → TTS, воспроизведение.

4. **SENTINEL:** при критическом алерте опционально вызывать Riva TTS и отдавать фронту URL/stream для воспроизведения (или push-уведомление с аудио).

---

## 3. Dynamo (низкая задержка inference)

**Назначение:** масштабирование inference агентов, снижение латентности при большом числе запросов.

### Шаги

1. Развернуть NVIDIA Dynamo (распределённый inference).
2. В `.env`: `ENABLE_DYNAMO=true`, `DYNAMO_URL=http://<dynamo-gateway>:8004`.
3. В коде: в `nvidia_llm.py` (или отдельном inference router) при `enable_dynamo` маршрутизировать запросы на Dynamo вместо облачного API / локального NIM.
4. Статус уже отображается в `GET /api/v1/health/nvidia` → `dynamo`.

---

## 4. Triton + TensorRT-LLM (self-hosted LLM)

**Назначение:** развернуть свои модели (Nemotron, Llama и т.д.) на GPU с оптимизацией TensorRT-LLM.

### Шаги

1. Развернуть Triton Inference Server с backend TensorRT-LLM и загрузить модель (например Nemotron).
2. В `.env`: `ENABLE_TRITON=true`, `TRITON_URL=http://<triton>:8000`, `TRITON_LLM_MODEL=nemotron`, при необходимости `USE_TENSORRT_LLM=true`.
3. В `nvidia_llm.py`: при `enable_triton` использовать Triton HTTP/gRPC API для chat completions (формат как у OpenAI/NIM).
4. Статус: `GET /api/v1/health/nvidia` → `triton`.

---

## 5. CUDA Toolkit

**Назначение:** основа для локальных NIM, Triton, Riva на GPU.

- Установка на серверах с GPU: по [документации NVIDIA](https://docs.nvidia.com/cuda/cuda-installation-guide-linux/).
- В коде не требуется отдельная интеграция; конфиг не нужен. Учитывать в инструкциях по развёртыванию (Brev, Contabo, on-prem).

---

## 6. Опциональные (по сценариям)

| Продукт | Когда внедрять | Что добавить |
|---------|----------------|--------------|
| **cuOpt** | Модуль логистики / маршрутизации, supply chain risk | Сервис `cuopt_service.py`, эндпоинт `POST /api/v1/routing/optimize` или аналог; вызов cuOpt API при `enable_cuopt`. |
| **IndeX** | Визуализация больших объёмов (климат, риски) | Интеграция в 3D/веб-клиент (Cesium или отдельный viewer); запрос к IndeX API при `enable_index_viz`. |
| **WaveWorks** | Прибрежные риски, цунами, штормовые нагоны | Сервис `waveworks_service.py`, слой «океан/прибой» в сценариях; вызов при `enable_waveworks`. |
| **PhysX** | Доп. физика в симуляциях (если не хватает PhysicsNeMo) | Интеграция в physics_engine или отдельный модуль симуляции. |
| **Warp** | Кастомная GPU-логика в Omniverse/OmniGraph | По необходимости в скриптах Omniverse. |
| **FlashInfer** | Свой inference LLM с FlashAttention | Обычно внутри Triton/TensorRT-LLM; отдельная интеграция только при кастомном inference. |
| **Megatron** | Обучение своих моделей | Отдельный пайплайн обучения; не для runtime inference. |

Конфиг для cuOpt, IndeX, WaveWorks уже добавлен (`enable_*`, `*_url`). Реализацию сервисов и эндпоинтов включать по мере появления сценариев.

---

## 7. Как включить и проверить

**Riva (озвучка алертов и отчётов):**
```bash
# В apps/api/.env
ENABLE_RIVA=true
RIVA_URL=http://localhost:50051
```
После запуска Riva-контейнера: `GET /api/v1/nvidia/riva/health`. В UI: развернуть алерт → «Озвучить алерт»; в отчёте стресс-теста → «Озвучить отчёт».

**Dynamo (LLM через Dynamo):**
```bash
ENABLE_DYNAMO=true
DYNAMO_URL=http://<host>:8004
```
Все запросы к LLM пойдут на `DYNAMO_URL/v1/chat/completions`.

**Triton (своя модель на Triton):**
```bash
ENABLE_TRITON=true
TRITON_URL=http://<host>:8000
TRITON_LLM_MODEL=nemotron
```
LLM запросы пойдут на Triton с моделью `TRITON_LLM_MODEL`. Порядок приоритета: Dynamo → Triton → Cloud → NIM.

**Опциональные (только health):** `GET /api/v1/nvidia/cuopt/health`, `.../index/health`, `.../waveworks/health` — ответ `enabled`/`reachable` при заданных `ENABLE_*` и `*_URL`.

---

## 8. Чеклист внедрения

- [x] Конфиг: Riva, Dynamo, Triton, TensorRT-LLM, cuOpt, IndeX, WaveWorks
- [x] Riva: сервис TTS/STT, эндпоинты `/riva/health`, `/riva/tts`, `/riva/stt`
- [x] Статус в `/health/nvidia`: riva, dynamo, triton
- [x] UI: кнопки «Озвучить алерт» / «Озвучить отчёт» с вызовом TTS
- [ ] Развернуть Riva-контейнер и подключить (ENABLE_RIVA, RIVA_URL)
- [x] Маршрутизация LLM через Dynamo при ENABLE_DYNAMO (nvidia_llm.py)
- [x] Маршрутизация LLM через Triton при ENABLE_TRITON (nvidia_llm.py)
- [x] Health-эндпоинты cuOpt, IndeX, WaveWorks (`/nvidia/cuopt|index|waveworks/health`)

Версия: 2026-01-30
