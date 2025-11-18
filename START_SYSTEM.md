# 🚀 Запуск системы

## Быстрый старт

### 1. Установка зависимостей

```bash
# Python зависимости
cd /Users/artur220513timur110415gmail.com/global-risk-platform
pip install -e ".[dev]"

# API Gateway зависимости
cd apps/api-gateway
npm install

# Control Tower UI зависимости
cd ../control-tower
npm install
```

### 2. Запуск базы данных (если используется Docker)

```bash
# Запуск PostgreSQL и Redis
docker run -d --name postgres -p 5432:5432 \
  -e POSTGRES_DB=risk_platform \
  -e POSTGRES_USER=risk_user \
  -e POSTGRES_PASSWORD=risk_password \
  postgres:16-alpine

docker run -d --name redis -p 6379:6379 redis:7-alpine
```

### 3. Настройка базы данных

```bash
cd apps/api-gateway
npx prisma generate
npx prisma migrate dev
```

### 4. Запуск сервисов

#### Terminal 1: API Gateway
```bash
cd apps/api-gateway
npm run dev
```
API Gateway будет доступен на: http://localhost:8000

#### Terminal 2: Control Tower UI
```bash
cd apps/control-tower
npm run dev
```
UI будет доступен на: http://localhost:5173 (или другой порт, который укажет Vite)

#### Terminal 3: Reg Calculator API (опционально)
```bash
cd apps/reg-calculator
python -m apps.reg_calculator.api
```
Reg Calculator API будет доступен на: http://localhost:8080

### 5. Доступ к системе

1. Откройте браузер: http://localhost:5173
2. Войдите в систему (или используйте тестовые credentials)
3. Исследуйте функционал:
   - 📊 Dashboard - обзор метрик
   - 📋 Scenarios - управление сценариями
   - ⚡ Calculations - запуск и мониторинг расчетов
   - 💼 Portfolios - просмотр портфелей

## Функционал

### Dashboard
- Обзор активных сценариев
- Статус расчетов (running/completed/failed)
- Метрики портфелей
- Тренды и графики
- Последняя активность

### Scenarios
- Создание новых сценариев
- Редактирование существующих
- Удаление сценариев
- Просмотр деталей

### Calculations
- Запуск новых расчетов
- Мониторинг статуса в реальном времени (WebSocket)
- Просмотр результатов
- Отмена расчетов
- Экспорт отчетов (PDF/Excel)

### Portfolios
- Список портфелей
- Агрегированные метрики
- Детальная информация

### Real-Time Features
- WebSocket обновления статусов расчетов
- Уведомления о завершении/ошибках
- Live метрики риска

## API Endpoints

### Health Check
```bash
curl http://localhost:8000/health
```

### Scenarios
```bash
# Список сценариев
curl http://localhost:8000/api/v1/scenarios

# Создание сценария
curl -X POST http://localhost:8000/api/v1/scenarios \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"name": "Test Scenario", "description": "Test"}'
```

### Calculations
```bash
# Запуск расчета
curl -X POST http://localhost:8000/api/v1/calculate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"scenario_id": "scenario_1", "portfolio_id": "portfolio_1"}'
```

## Troubleshooting

### Порт занят
Если порт занят, измените в:
- API Gateway: `apps/api-gateway/src/main.ts` (PORT)
- Control Tower: `apps/control-tower/vite.config.ts` (server.port)

### База данных не подключена
Проверьте:
- PostgreSQL запущен
- DATABASE_URL правильный
- Prisma миграции применены

### WebSocket не работает
Проверьте:
- Socket.IO установлен
- CORS настроен правильно
- WebSocket URL в UI правильный

