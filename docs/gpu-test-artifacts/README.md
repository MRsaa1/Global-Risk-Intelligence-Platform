# Артефакты тестов GPU vs без GPU

Сюда сохраняются результаты запуска скриптов:

- **local/** — вывод `./scripts/gpu-test-local.sh` (режим без GPU)
- **gpu/** — вывод `./scripts/gpu-test-gpu.sh` (режим с GPU)

Запуск **на GPU-сервере**: сначала зайти в репо, потом скрипт (BASE_URL не нужен):

    ssh -i ... ubuntu@100.30.226.186
    cd ~/global-risk-platform
    ./scripts/gpu-test-gpu.sh

Запуск **с Mac через туннель**: туннель уже поднят (ssh -L 19002:localhost:9002 ...), на Mac в другом терминале:

    cd /path/to/global-risk-platform
    BASE_URL=http://127.0.0.1:19002 ./scripts/gpu-test-gpu.sh

TOKEN — всегда в кавычках, подставьте реальный JWT (не буквально &lt;jwt&gt;): `TOKEN='eyJ...' ./scripts/gpu-test-gpu.sh`

После обоих запусков выполните `./scripts/gpu-test-compare.sh` для сравнения.

Файлы:
- `health_nvidia.json` — ответ `GET /api/v1/health/nvidia`
- `nim_health.json` — ответ `GET /api/v1/nvidia/nim/health`
- `execute_response.json` — ответ `POST /api/v1/stress-tests/execute` (если задан `TOKEN`)

## Как передать TOKEN (zsh / bash)

В zsh JWT передавайте в кавычках, иначе shell воспримет скобки/символы как команды:

    TOKEN='eyJ...' ./scripts/gpu-test-local.sh
    TOKEN='...' BASE_URL=http://127.0.0.1:19002 ./scripts/gpu-test-gpu.sh

JWT можно взять после входа в веб (Local Storage или запрос в DevTools).
