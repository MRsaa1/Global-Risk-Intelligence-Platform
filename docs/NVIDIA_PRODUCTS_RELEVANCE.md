# Релевантность продуктов NVIDIA для PFRP

**Контекст:** Physical-Financial Risk Platform — климат, стресс-тесты, Digital Twins, агенты (SENTINEL, ANALYST, ADVISOR, REPORTER), RAG, отчёты.

Из полного каталога NVIDIA ниже — что **нужно**, что **уже есть**, что **опционально**, что **не нужно**.

---

## ✅ Нужно / уже используем

| Продукт | Зачем нам | Статус в проекте |
|--------|-----------|-------------------|
| **NeMo Framework** | LLM, агенты, диалоги | ✅ Интеграция (nvidia_llm, агенты) |
| **NeMo Guardrails** | Безопасность и контроль ответов | ✅ nemo_guardrails.py, config/guardrails.yml |
| **NeMo Agent Toolkit** | Профилирование и оркестрация агентов | ✅ Конфиг и сервисы (Phase 2) |
| **PhysicsNeMo** | Симуляции (flood, structural, thermal) | ✅ nvidia_physics_nemo.py, physics_engine |
| **Omniverse Kit** | 3D, E2CC, Nucleus, Digital Twin | ✅ omniverse.py, E2CC_BASE_URL, nucleus_fetch |
| **Riva** | Голосовые алерты, озвучка отчётов | 📋 Запланировано (приоритет UX) |
| **NVIDIA Dynamo** | Низкая задержка inference, масштабирование | 📋 Когда понадобится жёсткое снижение латентности |
| **TensorRT-LLM** | Оптимизация inference LLM | 📋 В связке с Dynamo при self-hosted LLM |
| **Triton Inference Server** | Serving моделей в проде | 📋 При развёртывании своих моделей на GPU |
| **CUDA Toolkit** | Основа для всего на GPU | 📋 Нужен на серверах с NIM/GPU |
| **NIM (FourCastNet, CorrDiff, FLUX, Nemotron)** | Погода, климат, картинки, LLM | ✅ nvidia_nim, data_federation, stress_tests |

---

## 🔶 Опционально / по сценариям

| Продукт | Когда может пригодиться |
|--------|--------------------------|
| **cuOpt** | Логистика, маршруты, supply chain risk (если появится модуль) |
| **IndeX** | Визуализация больших объёмов (климат, риски) в 3D |
| **WaveWorks** | Прибрежные риски, цунами, штормовые нагоны (если углублять coastal) |
| **PhysX** | Доп. физика в симуляциях (сейчас достаточно PhysicsNeMo) |
| **NVIDIA Warp** | Кастомная GPU-логика в Omniverse/OmniGraph |
| **FlashInfer** | Свой inference LLM с FlashAttention при масштабировании |
| **Megatron Core / NeMo Megatron** | Обучение своих моделей (сейчас в основном API) |
| **NVFLare** | Federated learning, если появятся сценарии без объединения данных |

---

## ❌ Не нужно под текущий фокус PFRP

| Категория | Примеры продуктов | Почему не приоритет |
|-----------|-------------------|----------------------|
| Drug discovery / biotech | **BioNeMo** | Не домен платформы |
| Biomedical imaging | **cuCIM, MONAI Core, MONAI Toolkit, Isaac for Healthcare** | Нет фокуса на медвизуализации |
| Robotics / surgical | **Isaac Sim, Isaac for Healthcare** | Нет фокуса на робототехнике |
| Gaming / avatars | **NVIDIA ACE for Games, Tokkio** | Не приоритет |
| Quantum | **cuQuantum** | Не в текущем roadmap |
| Low-level CUDA libs | **cuBLAS, cuBLASXt, cuBLASMp, cuFFT, cuSOLVER, cuSPARSE, CUTLASS, CCCL, libcu++** | Используются внутри стеков (NIM, Triton, TensorRT); напрямую не нужны, если не пишем свои ядра |
| Compilers / profiling | **NVRTC, CUPTI, Nsight*** | Нужны при разработке/оптимизации своего GPU-кода |
| HPC benchmarks | **HPC Benchmarks, HPC SDK** | Для тестов железа, не для продукта |
| Materials / rendering | **MDL SDK, vMaterials** | Для визуала в Omniverse — по желанию |
| Comms / distributed | **UCX, nvCOMP** | Внутри инфраструктуры, не на уровне приложения |
| Other domains | **Sionna** (wireless), **JAX** (если не стандарт стека), **DeepStream** (video) | Не под текущие сценарии рисков |

---

## Итог по приоритетам

1. **Уже в стеке:** NeMo (Framework, Guardrails, Agent Toolkit), PhysicsNeMo, Omniverse, NIM.
2. **Добавить по UX:** Riva (голосовые алерты и озвучка отчётов).
3. **По мере роста нагрузки:** Dynamo, TensorRT-LLM, Triton — для низкой латентности и масштабирования inference.
4. **По необходимости:** cuOpt (логистика), WaveWorks (прибрежные риски), IndeX (объёмная визуализация).
5. **Не трогать под текущий PFRP:** BioNeMo, MONAI/cuCIM, Isaac, ACE/Tokkio, cuQuantum, низкоуровневые CUDA-библиотеки (если не пишете свои ядра).

Версия: 2026-01-30
