# Развёртывание NVIDIA Riva (Docker)

Riva даёт TTS/STT для озвучки алертов и отчётов.

---

## Ограничения

- **Riva TTS/ASR NIM** (nvcr.io/nim/nvidia/riva-tts, riva-asr) — при `docker pull` возвращают **Payment Required**: образы доступны только по платной подписке (NVIDIA AI Enterprise и т.п.).
- **Riva Speech Skills** (nvcr.io/nvidia/riva/riva-speech) — теги в каталоге NGC могут не находиться (not found); возможны ограничения по доступу.
- **Mac:** нет NVIDIA GPU, контейнер Riva для инференса на Mac не запустится.

**Рекомендация для Mac и без подписки:** озвучка в приложении уже работает через **Web Speech API** в браузере (кнопка «Read aloud» в алертах и отчётах). Сервер Riva не обязателен.

---

## Вариант 1: Docker Compose (если есть доступ к образу)

Из корня репозитория:

```bash
docker compose -f docker-compose.riva.yml up -d
```

Проверка:

```bash
docker compose -f docker-compose.riva.yml logs -f riva-tts
```

Если при `docker compose up` появляется **Payment Required** — образ требует платную подписку; используйте озвучку в браузере (Web Speech API). Если контейнер падает из‑за отсутствия моделей — вариант 2 (NGC Quick Start).

---

## Вариант 2: NGC Quick Start (рекомендуется при первом запуске)

Модели и контейнеры качаются через NGC; нужен ключ NGC.

1. **Скачайте Riva Quick Start**  
   [NGC Riva Quick Start](https://catalog.ngc.nvidia.com/orgs/nvidia/teams/riva/resources/riva_quickstart) (выберите ресурс и скачайте архив).

2. **Распакуйте и перейдите в каталог**  
   Например: `cd /path/to/riva_quickstart_v2.x`

3. **Задайте NGC API key**  
   ```bash
   export NGC_API_KEY=ваш_ключ_ngc
   ```

4. **Инициализация (однократно, долго)**  
   ```bash
   bash riva_init.sh
   ```  
   Скачаются образы и модели.

5. **Запуск сервера**  
   ```bash
   bash riva_start.sh
   ```  
   В логах должно появиться: `Riva Conversational AI Server listening on 0.0.0.0:50051`.

6. **Через наш скрипт (если уже есть распакованный Quick Start)**  
   ```bash
   export RIVA_QUICKSTART_DIR=/path/to/riva_quickstart_v2.x
   export NGC_API_KEY=ваш_ключ
   ./scripts/start-riva.sh
   ```  
   Скрипт при необходимости запустит `riva_init.sh`, затем `riva_start.sh`.

---

## Подключение API к Riva

В `apps/api/.env`:

```env
ENABLE_RIVA=true
RIVA_URL=http://localhost:50051
```

Перезапустите API. Проверка:

```bash
curl -s http://localhost:9002/api/v1/nvidia/riva/health
# Ожидаем: {"enabled":true,"reachable":true}
```

Озвучка в UI (Read aloud в алертах и отчётах) будет идти через Riva.
