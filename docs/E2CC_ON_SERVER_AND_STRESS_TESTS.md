# Запуск E2CC на сервере и тестирование наших стресс-тестов

Единый сценарий: **установить и запустить Earth-2 Climate Cloud (E2CC)** на Brev, затем **запустить нашу платформу** и **тестировать стресс-тесты** на этом же сервере.

---

## Что в итоге

| Компонент | Порт | Назначение |
|-----------|------|------------|
| **Наша платформа (API)** | 9002 | Стресс-тесты, Command Center, геоданные |
| **Наша платформа (Web)** | 5180 | UI: Command Center, стресс-тесты, отчёты |
| **FourCastNet NIM** | 8001 | Погодный прогноз (GPU), используется в стресс-тестах |
| **E2CC (Earth-2 Command Center)** | 8010 | Визуализация погоды/климата, кнопка «Open in Omniverse» |

Все четыре работают на **одном сервере (Brev)**. С Mac доступ через **port-forward**.

---

## Часть 1. Подготовка сервера (Brev)

Уже должно быть:

- Ubuntu 22.04, NVIDIA GPU, драйвер (`nvidia-smi`), Docker.
- Проект скопирован: `~/global-risk-platform`.

Если E2CC ещё не ставили — переходите к **Части 2**. Если ставили и падало с ошибками расширений или «No run loop» — в **Части 2** есть исправления.

---

## Часть 2. Установка и запуск E2CC на сервере

**Быстрый путь (одна команда до сборки):** из корня нашего проекта на сервере:

```bash
cd ~/global-risk-platform
chmod +x scripts/setup-e2cc-on-server.sh
./scripts/setup-e2cc-on-server.sh
```

Скрипт ставит git-lfs, xvfb, клонирует earth2-weather-analytics, правит версии расширений в .kit и собирает E2CC. В конце выведет команды для запуска E2CC (Xvfb + deploy_e2cc.sh -s). Дальше — шаги 2.4–2.5 ниже.

**Пошагово (если нужно вручную):**

### 2.1. Клонирование и LFS

**На Brev:**

```bash
cd ~
sudo apt install -y git-lfs xvfb
git lfs install
git clone https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics.git
cd earth2-weather-analytics
git lfs fetch --all
git lfs pull
```

### 2.2. Исправление версий расширений (streamer)

Иначе сборка/запуск streamer может падать с «Can't find extension» (6.2.2, 1.0.10, 107.0.3).

```bash
cd ~/earth2-weather-analytics
KIT_FILE="e2cc/source/apps/omni.earth_2_command_center.app_streamer.kit"

sed -i 's/omni.kit.streamsdk.plugins-6.2.2/omni.kit.streamsdk.plugins-6.2.1/' "$KIT_FILE"
sed -i 's/omni.kit.widgets.custom-1.0.10/omni.kit.widgets.custom-1.0.9/' "$KIT_FILE"
sed -i 's/omni.kit.window.section-107.0.3/omni.kit.window.section-107.0.2/' "$KIT_FILE"

grep -E "streamsdk|widgets.custom|window.section" "$KIT_FILE"
# Должно быть: 6.2.1, 1.0.9, 107.0.2
```

### 2.3. Сборка E2CC

```bash
cd ~/earth2-weather-analytics/e2cc
./build.sh --release --no-docker
```

Ждать до конца (может занять 10–30 минут).

### 2.4. Запуск E2CC в режиме streamer (headless: Xvfb)

На сервере без дисплея нужен виртуальный дисплей, иначе возможны «No run loop» / «ResourceManager».

**Вариант A — вручную в двух терминалах**

Терминал 1 — виртуальный дисплей и E2CC:

```bash
cd ~/earth2-weather-analytics
Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX &
export DISPLAY=:99
./deploy/deploy_e2cc.sh -s
```

Оставить процесс работать. В логах будет URL стримера (обычно `http://localhost:8010`).

**Вариант B — через tmux (удобно держать в фоне)**

```bash
tmux new -s e2cc
cd ~/earth2-weather-analytics
Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX &
export DISPLAY=:99
./deploy/deploy_e2cc.sh -s
# Отключиться: Ctrl+B, затем D
# Вернуться: tmux attach -t e2cc
```

### 2.5. Проверка E2CC

На сервере:

```bash
curl -s http://localhost:8010 | head -5
```

Если отвечает HTML — E2CC слушает 8010.

---

## Часть 3. Запуск нашей платформы на том же сервере

### 3.1. NIM (FourCastNet)

```bash
cd ~/global-risk-platform
export NGC_API_KEY=your_ngc_api_key
chmod +x scripts/brev-start-nim.sh
./scripts/brev-start-nim.sh
```

Дождаться «FourCastNet NIM ready on http://localhost:8001».

### 3.2. API и Web

```bash
cd ~/global-risk-platform
chmod +x scripts/brev-deploy.sh
./scripts/brev-deploy.sh
```

Скрипт создаёт `apps/api/.env` (в т.ч. USE_LOCAL_NIM, NIM URL), ставит зависимости, собирает фронт, запускает API на 9002 и веб на 5180.

### 3.3. E2CC_BASE_URL для кнопки «Open in Omniverse»

В **apps/api/.env** на сервере добавьте или проверьте:

```env
E2CC_BASE_URL=http://localhost:8010
```

Перезапуск API после смены .env:

```bash
pkill -f "uvicorn src.main:app" 2>/dev/null
cd ~/global-risk-platform/apps/api && source .venv/bin/activate
nohup uvicorn src.main:app --host 0.0.0.0 --port 9002 > /tmp/api.log 2>&1 &
```

---

## Часть 4. Доступ с Mac (port-forward) и тестирование

### 4.1. Port-forward на Mac

В терминале на Mac (оставить открытым):

```bash
brev port-forward saaaliance
```

Настроить пары портов, например:

| Порт на Brev | Порт на Mac | Сервис |
|--------------|-------------|--------|
| 5180 | 5180 или 5182 | Web (Command Center, стресс-тесты) |
| 9002 | 9002 | API |
| 8010 | 8010 | E2CC |

### 4.2. Открыть платформу в браузере

- **Command Center:** `http://localhost:5180/command` (или тот порт, который указали для 5180).
- **API Docs:** `http://localhost:9002/docs`.

В Command Center внизу слева должны быть бейдж **GPU mode** и **NIM: ✓ FourCastNet**, если NIM запущен и в .env стоит USE_LOCAL_NIM=true.

### 4.3. Тестирование стресс-тестов на сервере

1. Открыть раздел **Stress Test** (или Command Center → стресс-тесты).
2. Выбрать сценарий (например климатический/погодный).
3. Запустить выполнение.
4. Открыть отчёт.

В отчёте при работающем NIM должен быть блок: **«Weather / climate: FourCastNet NIM (GPU). This run used the GPU server for AI weather forecast.»** и в источниках данных — FourCastNet NIM (GPU). Так проверяется, что стресс-тесты реально используют NIM на сервере.

### 4.4. Кнопка «Open in Omniverse»

В Command Center нажать **Open in Omniverse**. Должна открыться вкладка с E2CC (по адресу `http://localhost:8010` при port-forward 8010→8010). Если вкладка пустая — проверить, что E2CC запущен на сервере (см. 2.4–2.5) и port-forward 8010 активен.

---

## Краткий чеклист на сервере

| Шаг | Команда / действие |
|-----|--------------------|
| 1 | Клонировать earth2-weather-analytics, git lfs pull |
| 2 | Исправить .kit (streamsdk 6.2.1, widgets.custom 1.0.9, window.section 107.0.2) |
| 3 | `cd e2cc && ./build.sh --release --no-docker` |
| 4 | Запустить Xvfb, DISPLAY=:99, `./deploy/deploy_e2cc.sh -s` (в tmux при необходимости) |
| 5 | `~/global-risk-platform`: NGC_API_KEY + `./scripts/brev-start-nim.sh` |
| 6 | `./scripts/brev-deploy.sh` |
| 7 | В apps/api/.env: E2CC_BASE_URL=http://localhost:8010, перезапустить API |
| 8 | На Mac: brev port-forward 5180, 9002, 8010 |

---

## Устранение неполадок

| Проблема | Решение |
|----------|---------|
| «Can't find extension» при запуске E2CC | Выполнить шаг 2.2 (sed по .kit), пересобрать e2cc. |
| «No run loop» / «ResourceManager» при запуске E2CC | Запускать с Xvfb и DISPLAY=:99 (шаг 2.4). |
| **«No app window» / «Failed to acquire ResourceManager» / «No Resource Manager, is RTX not available?»** | См. раздел ниже: headless требует либо `--no-window`, либо виртуальный дисплей NVIDIA. |
| NIM не стартует | Проверить NGC_API_KEY, Docker, порт 8001. |
| Нет бейджа GPU mode в Command Center | USE_LOCAL_NIM=true, FOURCASTNET_NIM_URL=http://localhost:8001 в .env, перезапуск API. |
| «Open in Omniverse» не открывает E2CC | E2CC запущен на 8010, на Mac настроен port-forward 8010→8010, в .env задан E2CC_BASE_URL=http://localhost:8010. |

### «No app window» / ResourceManager на headless (Brev без дисплея)

Xvfb даёт только программный буфер; RTX/Omniverse Kit нужен **GPU-контекст** или режим **без окна** для стриминга.

**Xvfb завершился с Exit 1:** дисплей :99 не поднялся (занят или ошибка). Сделай: `pkill -9 Xvfb 2>/dev/null; sleep 1`, затем запусти Xvfb на другом номере, например `Xvfb :98 -screen 0 1920x1080x24 -ac +extension GLX &` и `export DISPLAY=:98`. Либо перейди к варианту 2 (виртуальный дисплей NVIDIA) и не используй Xvfb.

**Вариант 1 — флаг `--no-window` (режим headless streaming по [документации Kit](https://docs.omniverse.nvidia.com/kit/docs/kit-manual/latest/guide/linux_troubleshooting.html))**

Скрипт `deploy_e2cc.sh -s` вызывает `./e2cc/_build/linux-x86_64/release/omni.earth_2_command_center.app_streamer.sh` и не передаёт в Kit дополнительные аргументы.

- **Пробовать передать флаг снаружи** (если .sh пробрасывает `"$@"` в kit):

  ```bash
  cd ~/earth2-weather-analytics
  export DISPLAY=:98
  ./e2cc/_build/linux-x86_64/release/omni.earth_2_command_center.app_streamer.sh --no-window
  ```

- **Если не сработало** — отредактировать streamer-скрипт. Открыть файл:

  ```bash
  nano ~/earth2-weather-analytics/e2cc/_build/linux-x86_64/release/omni.earth_2_command_center.app_streamer.sh
  ```

  Найти строку с вызовом `kit` (или `exec ... kit`) и в конец списка аргументов добавить **`--no-window`**. Сохранить и снова запустить:

  ```bash
  ./deploy/deploy_e2cc.sh -s
  ```

**Вариант 2 — виртуальный дисплей NVIDIA (рекомендуется при «ResourceManager» / «RTX not available»)**

Xvfb не даёт GPU-контекст; RTX нужен дисплей, привязанный к GPU. Создай виртуальный дисплей на драйвере NVIDIA и запусти X на нём, затем E2CC.

**Шаг 0 — X-сервер (если нет `Xorg`):**

```bash
sudo apt update
sudo apt install -y xserver-xorg-core
```

На Brev пакеты `nvidia-utils` и `xserver-xorg-video-nvidia` могут отсутствовать в репозитории. Тогда конфиг X создаём **вручную** (см. шаг 1).

**Шаг 1 — конфиг X для виртуального дисплея NVIDIA**

**Вариант A** — если есть `nvidia-xconfig` (например после `apt install nvidia-driver-XXX` с утилитами):

```bash
sudo nvidia-xconfig --use-display-device=None --virtual=1920x1080
```

**Вариант B** — если `nvidia-xconfig` нет (типично на Brev): создать `/etc/X11/xorg.conf` вручную:

```bash
sudo tee /etc/X11/xorg.conf << 'EOF'
Section "ServerLayout"
    Identifier "Layout0"
    Screen 0 "Screen0"
EndSection

Section "Device"
    Identifier "Device0"
    Driver "nvidia"
    Option "UseDisplayDevice" "None"
    Option "VirtualHeadCount" "1"
    Option "HardDPMS" "false"
EndSection

Section "Screen"
    Identifier "Screen0"
    Device "Device0"
    DefaultDepth 24
    SubSection "Display"
        Depth 24
        Virtual 1920 1080
    EndSubSection
EndSection
EOF
```

Проверь: `cat /etc/X11/xorg.conf` — должны быть секции Device (Driver "nvidia") и Screen с Virtual 1920 1080.

**Шаг 2 — остановить всё, что держит дисплей (Xvfb, старый X):**

```bash
pkill -9 Xvfb 2>/dev/null
pkill -9 X 2>/dev/null
sleep 2
```

**Шаг 3 — запустить X-сервер на виртуальном дисплее :0 (бинарник — Xorg):**

```bash
sudo Xorg :0 -config /etc/X11/xorg.conf &
sleep 3
export DISPLAY=:0
```

Если `Xorg` не в PATH: `sudo /usr/lib/xorg/Xorg :0 -config /etc/X11/xorg.conf &`

**Шаг 4 — в этом же терминале (с DISPLAY=:0) запустить E2CC streamer:**

```bash
cd ~/earth2-weather-analytics
./deploy/deploy_e2cc.sh -s
```

Не использовать Xvfb — только этот X на GPU. Если после перезагрузки сервера E2CC снова не видит дисплей, повтори шаги 2–4 (или добавь запуск Xorg в systemd/скрипт при старте).

**Segmentation fault при запуске streamer:** приложение падает при старте (например «Segmentation fault (core dumped)» в `deploy_e2cc.sh`). Возможные причины: несовместимость виртуального дисплея с RTX/Kit, драйвер или окружение. Что сделать: (1) Проверить, что X и GLX работают: `DISPLAY=:0 glxinfo 2>/dev/null | head -30` или `xdpyinfo -display :0`. (2) Попробовать **desktop** вместо streamer: `export DISPLAY=:0; ./deploy/deploy_e2cc.sh -d` — если desktop тоже падает, проблема в дисплее/GPU. (3) См. [07_troubleshooting](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/07_troubleshooting.md) blueprint. (4) На чисто headless Brev E2CC streamer может быть неустойчив; платформа (NIM, стресс-тесты, Command Center) работает без E2CC; кнопка «Open in Omniverse» тогда будет открывать URL только при запущенном E2CC на машине с дисплеем или в подходящем окружении.

**Конкретно: AWS g6e (L40S) + driver 580 + Xvfb.** При запуске streamer с `Xvfb :99` падение в `librtx.mdltranslator`, `carb.scenerenderer-rtx`, `omni.hydra.rtx` — типично. RTX/Hydra ожидают полноценный GPU-контекст; Xvfb его не даёт. На таких инстансах E2CC streamer **не поддерживается**. Рекомендация: считать E2CC опциональным; использовать NIM (FourCastNet), стресс-тесты и Command Center без «Open in Omniverse».

**Ссылки:** [Omniverse Kit — Linux Troubleshooting](https://docs.omniverse.nvidia.com/kit/docs/kit-manual/latest/guide/linux_troubleshooting.html) (Q6, Q7 — physical display / headless with `--no-window`), [earth2-weather-analytics Troubleshooting](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/07_troubleshooting.md).

---

## Ссылки

**Официальный blueprint (NVIDIA):**

- **GitHub:** [NVIDIA-Omniverse-blueprints/earth2-weather-analytics](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics) — README, клон: `git clone https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics.git`, затем `git lfs fetch --all`.
- **Документация в репо:** Workflow Overview, [Prerequisites](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/01_prerequisites.md), [Quickstart](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/02_quickstart.md), [Deployment](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/03_microk8s_deployment.md), [E2CC Guide](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/04_omniverse_app.md), [DFM Guide](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/05_data_federation_mesh.md), [Troubleshooting](https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics/blob/main/docs/07_troubleshooting.md).

**В этом репо:**

- **Полная установка Omniverse + E2CC (Ubuntu):** [OMNIVERSE_E2CC_UBUNTU_INSTALL.md](OMNIVERSE_E2CC_UBUNTU_INSTALL.md)
- **E2CC и кнопка Open in Omniverse:** [OMNIVERSE_E2CC_SETUP.md](OMNIVERSE_E2CC_SETUP.md), [OMNIVERSE_OPEN_IN_BROWSER.md](OMNIVERSE_OPEN_IN_BROWSER.md)
- **Деплой платформы на Brev:** [BREV_DEPLOYMENT.md](BREV_DEPLOYMENT.md)
- **Чем отличается GPU-сервер в UI и отчётах:** [GPU_SERVER_DIFFERENCES.md](GPU_SERVER_DIFFERENCES.md)
