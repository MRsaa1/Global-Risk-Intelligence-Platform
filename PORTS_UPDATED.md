# 🔄 Порты обновлены

## ✅ Изменения портов

Изменены порты для избежания конфликтов с занятыми портами:

### Старые порты (заняты)
- ❌ 3000 - занят
- ❌ 5174 - занят  
- ❌ 8080 - занят
- ❌ 3001 - занят
- ❌ 8501 - занят
- ❌ 5001 - занят

### Новые порты
- ✅ **Control Tower UI**: **9000** (было 3000)
- ✅ **API Gateway**: **9001** (было 8000)
- ✅ **WebSocket**: **ws://localhost:9001/socket.io**

---

## 🌐 Новые адреса

### Control Tower UI
```
http://localhost:9000
```

### Demo Page (рекомендуется)
```
http://localhost:9000/demo
```

### API Gateway
```
http://localhost:9001
```

### Health Check
```
http://localhost:9001/health
```

### Demo Data
```
http://localhost:9001/api/v1/demo/data
```

---

## 🔧 Обновленные файлы

1. `apps/control-tower/vite.config.ts` - порт изменен на 9000
2. `apps/api-gateway/src/main.ts` - порт изменен на 9001
3. `apps/api-gateway/src/main-simple.ts` - порт изменен на 9001
4. `apps/control-tower/src/services/api.ts` - API URL обновлен
5. `apps/control-tower/src/pages/Login.tsx` - API URL обновлен
6. `apps/control-tower/src/pages/Demo.tsx` - API URL обновлен
7. `apps/control-tower/src/pages/CalculationDetail.tsx` - API URL обновлен
8. `apps/control-tower/src/components/Layout.tsx` - WebSocket URL обновлен
9. `apps/control-tower/src/hooks/useWebSocket.ts` - WebSocket URL обновлен

---

## 🚀 Запуск системы

### API Gateway
```bash
cd apps/api-gateway
npm run dev
```
Запустится на: **http://localhost:9001**

### Control Tower UI
```bash
cd apps/control-tower
npm run dev
```
Запустится на: **http://localhost:9000**

---

## ✅ Проверка

```bash
# Health check
curl http://localhost:9001/health

# Demo data
curl http://localhost:9001/api/v1/demo/data

# Проверка портов
lsof -ti:9000  # UI
lsof -ti:9001  # API Gateway
```

---

**Порты обновлены! Система готова к работе на новых портах.** 🎉

