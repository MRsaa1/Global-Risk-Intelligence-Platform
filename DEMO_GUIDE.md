# 🎯 Демонстрация функционала Global Risk Platform

## 🚀 Быстрый запуск

### Вариант 1: Автоматический запуск
```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform
./start-demo.sh
```

### Вариант 2: Ручной запуск

#### Terminal 1: API Gateway
```bash
cd apps/api-gateway
npm run dev
```
API Gateway запустится на: **http://localhost:8000**

#### Terminal 2: Control Tower UI
```bash
cd apps/control-tower
npm run dev
```
UI запустится на: **http://localhost:3000** (или другой порт от Vite)

---

## 📊 Доступ к системе

### 1. Откройте браузер
Перейдите на: **http://localhost:3000**

### 2. Вход в систему
- **Username**: любой (например, `demo`)
- **Password**: любой (например, `demo`)
- Система использует упрощенную демо-аутентификацию

### 3. Навигация

#### 🎯 Демо-страница (рекомендуется для первого просмотра)
- URL: **http://localhost:3000/demo**
- Показывает все функции с демо-данными
- Не требует аутентификации

#### 📊 Dashboard
- Обзор метрик риска
- Активные сценарии
- Статус расчетов
- Графики трендов

#### 📋 Scenarios
- Создание сценариев
- Просмотр списка
- Редактирование

#### ⚡ Calculations
- Запуск расчетов
- Мониторинг статуса
- Просмотр результатов
- Real-time обновления через WebSocket

#### 💼 Portfolios
- Список портфелей
- Метрики портфелей
- Детальная информация

---

## 🎨 Визуальные возможности

### Dashboard
- **Градиентные карточки** с метриками
- **Интерактивные графики** (Recharts)
  - Line charts для трендов
  - Bar charts для сравнения
- **Real-time обновления** через WebSocket
- **Цветовая индикация** статусов

### Расчеты
- **Детальная страница** с вкладками:
  - Overview - обзор с графиками
  - Basel IV - результаты Basel IV
  - Liquidity - метрики ликвидности
  - Details - полные детали
- **Экспорт отчетов** (PDF/Excel)
- **3D визуализации** (готовы к интеграции)

### Уведомления
- **Центр уведомлений** в шапке
- **Real-time алерты** о завершении расчетов
- **Цветовая индикация** по типам

---

## 🔧 API Endpoints для тестирования

### Health Check
```bash
curl http://localhost:8000/health
```

### Demo Data
```bash
curl http://localhost:8000/api/v1/demo/data
```

### Demo Metrics
```bash
curl http://localhost:8000/api/v1/demo/metrics
```

### Scenarios
```bash
# Список
curl http://localhost:8000/api/v1/scenarios

# Создание
curl -X POST http://localhost:8000/api/v1/scenarios \
  -H "Content-Type: application/json" \
  -d '{"name": "Test Scenario", "description": "Test"}'
```

### Calculations
```bash
# Список
curl http://localhost:8000/api/v1/calculations

# Запуск
curl -X POST http://localhost:8000/api/v1/calculate \
  -H "Content-Type: application/json" \
  -d '{"scenario_id": "scenario_1", "portfolio_id": "portfolio_1"}'
```

---

## 🎯 Демонстрируемые функции

### ✅ Реализовано и работает

1. **Dashboard**
   - Метрики в реальном времени
   - Графики трендов
   - Статусы расчетов

2. **Scenarios Management**
   - CRUD операции
   - Список и детали

3. **Calculations**
   - Запуск расчетов
   - Мониторинг статуса
   - Real-time обновления (WebSocket)
   - Детальная страница результатов
   - Экспорт отчетов

4. **Portfolios**
   - Список портфелей
   - Агрегированные метрики

5. **Real-Time Features**
   - WebSocket обновления
   - Уведомления
   - Live метрики

6. **Visualizations**
   - Интерактивные графики
   - Цветовая индикация
   - Responsive дизайн

---

## 📸 Скриншоты функционала

### Dashboard
- 4 карточки с ключевыми метриками (градиенты)
- Графики трендов (Line charts)
- Таблицы с данными
- Статусы с цветовой индикацией

### Calculations Detail
- Вкладки: Overview, Basel IV, Liquidity, Details
- Графики: Pie chart (структура капитала), Bar chart (метрики соответствия)
- Таблицы с детальными результатами
- Кнопки экспорта (PDF/Excel)

### Demo Page
- Полный обзор всех функций
- Демо-данные для быстрого просмотра
- Все метрики и графики

---

## 🐛 Troubleshooting

### Порт занят
Если порт 8000 или 3000 занят:
- API Gateway: измените `PORT` в `.env` или `src/main.ts`
- UI: измените `server.port` в `vite.config.ts`

### API не отвечает
1. Проверьте, что API Gateway запущен: `curl http://localhost:8000/health`
2. Проверьте логи: `tail -f /tmp/api-gateway.log`

### UI не загружается
1. Проверьте, что UI запущен
2. Проверьте консоль браузера (F12)
3. Проверьте, что API URL правильный в `.env`

### WebSocket не работает
1. Проверьте, что Socket.IO установлен
2. Проверьте CORS настройки
3. Проверьте WebSocket URL в коде

---

## 🎓 Что можно протестировать

1. **Создание сценария**
   - Перейдите в Scenarios
   - Нажмите "Create Scenario"
   - Заполните форму

2. **Запуск расчета**
   - Перейдите в Calculations
   - Нажмите "Start Calculation"
   - Выберите сценарий и портфель
   - Наблюдайте real-time обновления статуса

3. **Просмотр результатов**
   - После завершения расчета
   - Нажмите на иконку просмотра
   - Изучите детальную страницу с графиками

4. **Экспорт отчетов**
   - На странице результатов
   - Нажмите "Export PDF" или "Export Excel"

5. **Real-time обновления**
   - Запустите расчет
   - Наблюдайте обновления статуса без перезагрузки страницы
   - Получайте уведомления в центре уведомлений

---

**Система готова к демонстрации!** 🎉

