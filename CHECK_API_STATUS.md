# 🔍 Проверка статуса API

## Проблема: API не отвечает

Если вы видите ошибки:
- `WebSocket connection failed`
- `Failed to load hotspots from API: Request timeout`

Это означает, что API сервер не запущен или упал.

---

## ✅ Быстрое решение

### Вариант 1: Автоматический запуск (рекомендуется)

```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform
./start-all-services.sh
```

Это запустит все сервисы в фоне с автоперезапуском.

---

### Вариант 2: Ручной запуск

**Терминал 1: API сервер**
```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform/apps/api
source .venv/bin/activate
uvicorn src.main:app --reload --host 0.0.0.0 --port 9002
```

**Терминал 2: Web сервер (если нужно)**
```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform/apps/web
npm run dev
```

---

## 🔍 Проверка статуса

### Проверить, запущен ли API:

```bash
curl http://127.0.0.1:9002/api/v1/health
```

Должен вернуть: `{"status":"healthy"}`

### Проверить логи API:

Если использовали `start-all-services.sh`:
```bash
tail -f logs/api.log
```

### Data Federation (smoke check):

Без запущенного API (через TestClient):
```bash
./scripts/check-data-federation.sh
```
или из `apps/api`:
```bash
python scripts/check_data_federation.py
```
Ожидается: `Data Federation smoke check passed.`

Unit- и интеграционные тесты (нужен pytest: `pip install -e ".[dev]"`):
```bash
cd apps/api && python -m pytest tests/test_data_federation_adapters.py tests/test_data_federation_pipelines.py tests/test_data_federation_api.py -v
```

---

## 🐛 Возможные проблемы

### 1. Ошибка импорта (после добавления NeMo)

Если API не запускается из-за ошибок импорта:
```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform/apps/api
source .venv/bin/activate
python -c "from src.services.nemo_retriever import get_nemo_retriever_service; print('OK')"
python -c "from src.services.nemo_guardrails import get_nemo_guardrails_service; print('OK')"
```

Если есть ошибки - сообщите мне.

### 2. Neo4j не доступен

Если Neo4j не запущен, RAG будет работать с ограничениями, но API должен запуститься.

### 3. Порт 9002 занят

```bash
lsof -i :9002
# Если занят, убейте процесс или используйте другой порт
```

---

## 📝 Логи для диагностики

Если проблема сохраняется, проверьте:

1. **Логи API:**
   ```bash
   tail -50 logs/api.log
   ```

2. **Ошибки Python:**
   ```bash
   cd apps/api
   source .venv/bin/activate
   python -m uvicorn src.main:app --reload --host 0.0.0.0 --port 9002
   ```
   (Запустит в foreground, увидите ошибки)

---

## ✅ После исправления

После перезапуска API:
1. Обновите страницу в браузере (Ctrl+R или Cmd+R)
2. Проверьте консоль браузера - ошибки должны исчезнуть
3. WebSocket должен подключиться
4. Hotspots должны загрузиться

---

**Если проблема не решается - пришлите логи из `logs/api.log`**
