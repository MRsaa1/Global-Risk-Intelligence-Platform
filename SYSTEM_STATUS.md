# 🚀 Статус системы

## Запущенные сервисы

### API Gateway
- **URL**: http://localhost:8000
- **Health Check**: http://localhost:8000/health
- **Demo Data**: http://localhost:8000/api/v1/demo/data
- **WebSocket**: ws://localhost:8000/socket.io

### Control Tower UI
- **URL**: http://localhost:3000 (или порт, указанный Vite)
- **Demo Page**: http://localhost:3000/demo

## Быстрый доступ

### 1. Демо-страница (без аутентификации)
```
http://localhost:3000/demo
```
Показывает все функции с демо-данными

### 2. Полный функционал (с аутентификацией)
```
http://localhost:3000
```
- Username: любой (например, `demo`)
- Password: любой (например, `demo`)

## API Endpoints

### Public Endpoints
- `GET /health` - Health check
- `GET /api/v1/demo/data` - Demo data
- `GET /api/v1/demo/metrics` - Demo metrics
- `POST /api/v1/demo/login` - Demo login

### Protected Endpoints (требуют токен)
- `GET /api/v1/scenarios` - Список сценариев
- `POST /api/v1/scenarios` - Создание сценария
- `GET /api/v1/calculations` - Список расчетов
- `POST /api/v1/calculate` - Запуск расчета
- `GET /api/v1/portfolios` - Список портфелей

## Проверка статуса

```bash
# Health check
curl http://localhost:8000/health

# Demo data
curl http://localhost:8000/api/v1/demo/data

# Проверка портов
lsof -ti:8000  # API Gateway
lsof -ti:3000  # UI (или другой порт Vite)
```

## Логи

```bash
# API Gateway logs
tail -f /tmp/api-gateway.log

# UI logs
tail -f /tmp/control-tower.log
```

## Остановка сервисов

```bash
# Найти процессы
lsof -ti:8000
lsof -ti:3000

# Остановить
kill $(lsof -ti:8000)
kill $(lsof -ti:3000)
```

