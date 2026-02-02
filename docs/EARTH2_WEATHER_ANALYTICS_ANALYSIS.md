# Earth-2 Weather Analytics — анализ и связь с проектом

Краткий разбор двух ресурсов и их применимость к **Global Risk Platform** при локальной разработке.

---

## 1. [NVIDIA Build — Earth-2 Weather Analytics](https://build.nvidia.com/nvidia/earth2-weather-analytics)

**Суть:** страница в каталоге NVIDIA NIM / Build. Описывает **Earth-2 Weather Analytics Blueprint** как готовый NIM/сервис для AI weather analytics на базе Earth-2.

**Что даёт:**
- Точка входа в каталог NIM и документацию по развёртыванию.
- Связь Earth-2 ↔ NIM (в т.ч. FourCastNet и др.).

**Для нас:** ориентир, где искать Earth-2–related NIM и апдейты по деплою (в т.ч. локально).

---

## 2. [GitHub — earth2-weather-analytics](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics)

**Суть:** reference‑реализация **Omniverse Blueprint** для геопространственного weather/climate‑сервиса. ~41 ★, 14 forks.

**Компоненты:**

| Компонент | Описание |
|-----------|----------|
| **Earth-2 Command Center (E2CC)** | Omniverse Kit‑приложение, визуализация геоданных. Фронтенд blueprint’а. |
| **Data Federation Mesh (DFM)** | Оркестрация пайплайнов, подключение источников (партнёрские/публичные хранилища) → E2CC, генерация текстур и т.п. |
| **FourCastNet NIM (FCN NIM)** | AI‑модель погоды в формате NIM, глобальный прогноз. |

**Технологии:** Python, Docker, Kubernetes/Helm, Omniverse, Git LFS.

**Документация в репо:**
- [00_workflow](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/00_workflow.md)
- [01_prerequisites](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/01_prerequisites.md) (SW/HW)
- [02_quickstart](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/02_quickstart.md)
- [03_microk8s_deployment](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/03_microk8s_deployment.md)
- [04_omniverse_app](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/04_omniverse_app.md) (E2CC)
- [05_data_federation_mesh](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/05_data_federation_mesh.md)
- [06_sequence](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/06_sequence.md), [07_troubleshooting](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/07_troubleshooting.md)

**Лицензия:** Omniverse License Agreement. Production — ответственность пользователя (security, AuthN/AuthZ, мониторинг и т.д.).

---

## 3. Связь с нашим проектом (локальная работа)

### Что уже есть

- **NIM:** FourCastNet, CorrDiff (при необходимости FLUX) — `apps/api/src/services/nvidia_nim.py`, конфиг (`fourcastnet_nim_url`, `corrdiff_nim_url`, `use_local_nim`).
- **Упоминания Earth-2:** Analytics, Assets, Physical-Financial Risk Platform (Earth-2, Physics NeMo, LLM).
- **Omniverse:** Nucleus, USD/GLB, сиды — `docs/OMNIVERSE_CONTENT_SEED.md`, `OMNIVERSE_NUCLEUS_ASSET_LIBRARY.md`.
- **Визуализация:** Cesium (глобус, зоны, маркеры), не Omniverse Kit.

### Что даёт Earth-2 Weather Analytics Blueprint

| Аспект | Blueprint | Наш проект |
|--------|-----------|------------|
| **FourCastNet NIM** | FCN NIM в полном стеке | Уже интегрирован, свой NIM‑сервис |
| **Визуализация** | E2CC (Omniverse Kit) | Cesium (веб) + **Omniverse — планируем** |
| **Данные** | DFM, партнёрские/публичные store | USGS, geo, stress, what‑if; **DFM-адаптеры — внедряем** |
| **Деплой** | K8s/Helm, MicroK8s | Docker Compose, `start-all-services.sh`, скрипты |

### Практические выводы для локальной разработки

1. **FourCastNet:** мы уже используем тот же класс моделей (NIM). Blueprint полезен как reference по:
   - формату API NIM,
   - сценариям деплоя (в т.ч. локально через Docker/K8s),
   - troubleshooting.

2. **Данные (DFM):** **внедряем.** Нужно реализовать адаптеры к внешним хранилищам и пайплайны для:
   - погодных/климатических источников,
   - геоданных под стресс‑тесты и what‑if.
   — Ориентир: [05_data_federation_mesh](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/05_data_federation_mesh.md).

3. **E2CC vs Cesium:** **Omniverse-визуализацию добавляем обязательно.** Cesium остаётся веб-слоем (глобус, Command Center); поверх — Omniverse Kit / E2CC-подобная визуализация для тяжёлых гео/погодных сцен. Blueprint ([04_omniverse_app](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/04_omniverse_app.md)) — reference при интеграции.

4. **Локальный старт:**
   - Продолжаем поднимать NIM (FourCastNet/CorrDiff) через наши `docker-compose` / скрипты.
   - При необходимости — смотрим `02_quickstart`, `03_microk8s_deployment`, `07_troubleshooting` в репо.
   - Build.nvidia.com используем для актуальных образов NIM и инструкций по Earth-2.

5. **Документация в репо:** `docs/` blueprint’а — хорошее дополнение к нашим `docs/NVIDIA_NEMO_INTEGRATION.md`, `OMNIVERSE_CONTENT_SEED.md` при расширении погодно‑климатического функционала.

### План работ

| Направление | Статус | Действия |
|-------------|--------|----------|
| **FourCastNet NIM** | В работе | Reference по API/деплою — blueprint |
| **DFM-адаптеры и пайплайны** | **Внедряем** | Адаптеры к погодным/климатическим источникам, геоданные для stress/what‑if; гайд [05_data_federation_mesh](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/05_data_federation_mesh.md) |
| **Omniverse-визуализация** | **Планируем** | Добавить E2CC-подобный слой поверх Cesium; гайд [04_omniverse_app](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/04_omniverse_app.md) |

---

## 4. Кратко

- **Build:** [Earth-2 Weather Analytics](https://build.nvidia.com/nvidia/earth2-weather-analytics) — каталог/описание NIM и Earth-2, полезно для деплоя и актуальных ссылок.
- **GitHub:** [earth2-weather-analytics](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics) — reference‑стек (E2CC + DFM + FourCastNet NIM), детальные гайды по установке и запуску.
- **У нас:** FourCastNet NIM уже в игре; **DFM-адаптеры и пайплайны — внедряем;** **Omniverse-визуализацию добавляем.** Blueprint — reference по NIM, DFM и E2CC.

Если нужно, следующим шагом можно оформить чеклист «локальный старт NIM + Earth-2» под наш `run-local-dev` / `start-all-services` и вынести его в `QUICK_START` или отдельный doc.
