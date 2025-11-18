# 🌐 Информация о доступе

## ✅ Система запущена на новых портах

### 🎯 Основные адреса

#### Control Tower UI
```
http://localhost:9000
```

#### Demo Page (рекомендуется)
```
http://localhost:9000/demo
```
**Особенности**:
- Не требует аутентификации
- Показывает все функции
- Графики и визуализации
- Демо-данные

#### API Gateway
```
http://localhost:9001
```

---

## 📊 Визуальные компоненты

### 1. Demo Page
**URL**: http://localhost:9000/demo

**Что увидите**:
- 4 градиентные карточки с метриками:
  - Активные сценарии: 5
  - Расчеты в процессе: 2
  - Завершенные расчеты: 12
  - Портфели: 8

- График трендов (30 дней):
  - Line Chart: Capital Ratio и LCR
  - Интерактивные tooltips

- Таблицы:
  - Список сценариев (CCAR, EBA)
  - Последние расчеты (completed, running)
  - Портфели с метриками

### 2. Dashboard
**URL**: http://localhost:9000

**После входа** (username: `demo`, password: `demo`):
- Полный функционал
- Real-time обновления
- Уведомления

### 3. Calculation Detail
**URL**: http://localhost:9000/calculations/:id

**Вкладки**:
- Overview: графики и метрики
- Basel IV: результаты Basel IV
- Liquidity: метрики ликвидности
- Details: полные детали

**Графики**:
- Pie Chart: структура капитала
- Bar Chart: метрики соответствия

---

## 🎨 Дизайн

### Цветовая схема
- **Фиолетовый градиент**: Активные сценарии
- **Розовый градиент**: Расчеты в процессе
- **Синий градиент**: Завершенные расчеты
- **Зеленый градиент**: Портфели

### Компоненты
- Material-UI
- Recharts (интерактивные графики)
- Responsive дизайн
- Градиентные карточки

---

## 🔧 API Endpoints

### Health Check
```bash
curl http://localhost:9001/health
```

### Demo Data
```bash
curl http://localhost:9001/api/v1/demo/data
```

### Demo Metrics
```bash
curl http://localhost:9001/api/v1/demo/metrics
```

---

## ✅ Порты

### Используемые
- ✅ **9000**: Control Tower UI
- ✅ **9001**: API Gateway

### Зарезервированные (не используются)
- ❌ 3000
- ❌ 5174
- ❌ 8080
- ❌ 3001
- ❌ 8501
- ❌ 5001

---

## 🚀 Быстрый старт

1. **Откройте Demo Page**
   ```
   http://localhost:9000/demo
   ```

2. **Или войдите в систему**
   ```
   http://localhost:9000
   Username: demo
   Password: demo
   ```

3. **Исследуйте функционал**:
   - Dashboard
   - Scenarios
   - Calculations
   - Portfolios

---

**Система готова! Откройте http://localhost:9000/demo** 🎉

