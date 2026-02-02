# Исправление 500 на /api/v1/twin-assets и /api/v1/seed/twin-assets

## Причина

Ошибка **500 Internal Server Error** при запросах к `GET /api/v1/twin-assets` и `POST /api/v1/seed/twin-assets` обычно связана с устаревшей схемой БД: в таблице `twin_asset_library` отсутствует колонка **`category`**.

После добавления категорий (Residential/Commercial/Industrial/Public) в каталог была создана миграция, которую нужно применить.

---

## Если Alembic пишет: `database "pfrp" does not exist`

Alembic по умолчанию подключается к PostgreSQL и ожидает базу **`pfrp`** (см. `apps/api/alembic.ini`). Эту базу нужно создать.

### Вариант 1: Создать базу в PostgreSQL (если PostgreSQL уже установлен)

Если у вас установлен PostgreSQL и в PATH есть `psql`:

```bash
psql -U postgres -c "CREATE DATABASE pfrp;"
cd ~/global-risk-platform/apps/api
alembic upgrade head
```

Если команды `psql` нет (например, на macOS без Homebrew postgres), используйте **Вариант 2 (SQLite)** — устанавливать PostgreSQL не нужно.

### Вариант 2: Использовать SQLite (без PostgreSQL)

Если PostgreSQL не нужен, можно использовать SQLite. Перед запуском миграций задайте переменную окружения (или добавьте в `apps/api/.env`):

```bash
cd ~/global-risk-platform/apps/api
export USE_SQLITE=true
export DATABASE_URL=sqlite:///./pfrp.db
alembic upgrade head
```

Alembic автоматически подставит драйвер `aiosqlite` для async. После этого запустите API с теми же переменными (или с `.env`), чтобы приложение использовало тот же файл БД.

## Что сделать

**Сначала перейдите в корень проекта** (папка `global-risk-platform`), затем в `apps/api`:

```bash
cd ~/global-risk-platform/apps/api
alembic upgrade head
```

Если проект лежит в другом месте, укажите полный путь, например:

```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform/apps/api
alembic upgrade head
```

Если API запущен в Docker:

```bash
docker compose exec api alembic upgrade head
# или
docker exec -it <api_container_name> alembic upgrade head
```

После успешного выполнения запросы к `/api/v1/twin-assets` и сиду библиотеки должны возвращать 200.

## Если видите: `SyntaxError: source code string cannot contain null bytes`

На macOS в папке `apps/api/alembic/versions/` иногда появляются служебные файлы **`._*`** (AppleDouble). Alembic пытается загрузить их как миграции и падает. Удалите их:

```bash
cd ~/global-risk-platform/apps/api/alembic/versions
rm -f ._*.py
```

После этого снова выполните `alembic upgrade head`.

---

## Если видите 503 с текстом про "Database schema outdated"

Сервер теперь при отсутствии колонки `category` возвращает **503** с сообщением:

`Database schema outdated: missing twin_asset_library.category. Run: cd apps/api && alembic upgrade head`

Выполните указанную команду в окружении, где работает API (локально или внутри контейнера).

## Остальные сообщения в консоли

- **Permissions policy violation: unload** — исходит от расширения браузера (например inject.js), не от приложения; можно игнорировать или отключить расширение.
- **Default export is deprecated. Instead use `import { create } from 'zustand'`** — предупреждение из зависимостей (например `@react-three/fiber`); не блокирует работу. При желании можно обновить `zustand` и зависимости (см. docs/ZUSTAND_DEPRECATION.md).
- **Download the React DevTools** — рекомендация установить расширение React DevTools; не ошибка.
