# Команда деплоя на сервер

## Основная команда (без таймаута, базы и ключи сохраняются)

Из **корня репозитория** (где лежат `apps/api` и `apps/web`):

```bash
cd ~/global-risk-platform && ./deploy-safe.sh
```

Скрипт по умолчанию настроен под **Contabo** (хост `contabo`, порт 32769, пользователь `arin`, ключ `~/.ssh/id_ed25519_contabo`, каталог `/home/arin/global-risk-platform`).

## Переопределение хоста/порта (если не Contabo)

```bash
export DEPLOY_HOST=your-server.com
export DEPLOY_PORT=22
export DEPLOY_USER=deploy
export DEPLOY_PROJECT_DIR=/home/deploy/global-risk-platform
export SSH_KEY=~/.ssh/your_key
./deploy-safe.sh
```

## Что делает деплой

1. Собирает архив (без `node_modules`, `.env`, `*.db`, `.git`).
2. На сервере бэкапит `.env` и все `*.db` в `~/pfrp-preserve/`.
3. Загружает архив, распаковывает код.
4. Восстанавливает `.env` и базы из бэкапа.
5. Ставит зависимости API и веба, миграции Alembic, **сборка фронта** (`npm run build`).
6. Перезапуск API (uvicorn) и веба (serve).
7. Вызов seed стресс-тестов (`POST /api/v1/stress-tests/admin/seed`).

## После деплоя

- Сайт: `https://risk.saa-alliance.com` (или ваш домен/порт).
- API: порт 9002, веб: 5180.
- Логи: `ssh contabo 'tail -f /tmp/api.log'`, `ssh contabo 'tail -f /tmp/web.log'`.

Подробности: [DEPLOY_SAFE.md](../DEPLOY_SAFE.md), [DEPLOY_FULL.md](DEPLOY_FULL.md).
