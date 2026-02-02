# Управление сервисами платформы

## Автоматический запуск всех сервисов

### Запуск всех сервисов в фоне с автоперезапуском

```bash
./start-all-services.sh
```

Этот скрипт:
- ✅ Запускает Docker контейнеры (PostgreSQL, Redis, Neo4j, MinIO)
- ✅ Запускает API сервер (порт 9002) с автоперезапуском
- ✅ Запускает Web dev server (порт 5180) с автоперезапуском
- ✅ Все сервисы работают в фоне и автоматически перезапускаются при падении
- ✅ Можно закрыть терминал - сервисы продолжат работать

### Остановка всех сервисов

```bash
./stop-all-services.sh
```

## Логи сервисов

Все логи сохраняются в директории `.services-logs/`:

- `api.log` - логи API сервера
- `web.log` - логи Web dev server
- `docker.log` - логи Docker контейнеров
- `startup.log` - логи запуска скрипта

### Просмотр логов в реальном времени

```bash
# API сервер
tail -f .services-logs/api.log

# Web сервер
tail -f .services-logs/web.log

# Docker контейнеры
docker-compose logs -f
```

## Проверка статуса сервисов

### Проверить, запущены ли сервисы

```bash
# Проверить API
curl http://localhost:9002/health

# Проверить Web
curl http://127.0.0.1:5180

# Проверить процессы
ps aux | grep -E "(uvicorn|vite)" | grep -v grep
```

### Проверить PIDs сервисов

```bash
# API PID
cat .services-logs/api.pid

# Web PID
cat .services-logs/web.pid
```

## Автоперезапуск

Сервисы автоматически перезапускаются при падении:
- Если API сервер упадет, он перезапустится через 5 секунд
- Если Web сервер упадет, он перезапустится через 5 секунд
- Все ошибки логируются в соответствующие файлы логов

## Ручной запуск отдельных сервисов

### API сервер

```bash
cd apps/api
source .venv/bin/activate
uvicorn src.main:app --reload --host 0.0.0.0 --port 9002
```

### Web dev server

```bash
cd apps/web
npm run dev
```

### Docker инфраструктура

```bash
docker-compose up -d postgres redis neo4j minio
```

## Порты сервисов

- **API**: http://localhost:9002
- **API Docs**: http://localhost:9002/docs
- **Web**: http://127.0.0.1:5180
- **PostgreSQL**: localhost:5432
- **Neo4j**: http://localhost:7474
- **MinIO**: http://localhost:9001
- **Redis**: localhost:6379

## Устранение проблем

### Сервисы не запускаются

1. Проверьте логи:
   ```bash
   tail -f .services-logs/api.log
   tail -f .services-logs/web.log
   ```

2. Проверьте, не заняты ли порты:
   ```bash
   lsof -i :9002  # API
   lsof -i :5180  # Web
   ```

3. Остановите все сервисы и запустите заново:
   ```bash
   ./stop-all-services.sh
   ./start-all-services.sh
   ```

### Docker контейнеры не запускаются

```bash
# Проверить статус
docker-compose ps

# Перезапустить
docker-compose restart

# Просмотреть логи
docker-compose logs -f
```

### API не отвечает

1. Проверьте, что API запущен:
   ```bash
   curl http://localhost:9002/health
   ```

2. Проверьте логи:
   ```bash
   tail -f .services-logs/api.log
   ```

3. Проверьте, что база данных доступна:
   ```bash
   docker-compose ps postgres
   ```
