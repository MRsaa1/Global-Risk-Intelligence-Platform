# 🔧 Исправление: Порт 9002 занят

## ❌ Ошибка: `[Errno 48] Address already in use`

Это означает, что порт 9002 уже используется другим процессом.

---

## ✅ Решение 1: Найти и остановить процесс

### Шаг 1: Найти процесс

```bash
lsof -i :9002
```

Или:
```bash
lsof -ti :9002
```

### Шаг 2: Остановить процесс

Если нашли PID (например, 12345):
```bash
kill 12345
```

Или принудительно:
```bash
kill -9 12345
```

### Шаг 3: Запустить API снова

```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform/apps/api
source .venv/bin/activate
uvicorn src.main:app --reload --host 0.0.0.0 --port 9002
```

---

## ✅ Решение 2: Использовать другой порт

Если не можете остановить процесс, используйте другой порт:

```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform/apps/api
source .venv/bin/activate
uvicorn src.main:app --reload --host 0.0.0.0 --port 9003
```

**НО:** Тогда нужно обновить конфигурацию Vite, чтобы он проксировал на порт 9003.

---

## ✅ Решение 3: Использовать скрипт остановки

Если вы использовали `start-all-services.sh`, остановите все сервисы:

```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform
./stop-all-services.sh
```

Затем запустите снова:
```bash
./start-all-services.sh
```

---

## 🔍 Проверка

После остановки процесса, проверьте:

```bash
lsof -i :9002
```

Должно быть пусто (нет вывода).

---

## ⚡ Быстрая команда (все в одной строке)

```bash
kill -9 $(lsof -ti :9002) 2>/dev/null; cd /Users/artur220513timur110415gmail.com/global-risk-platform/apps/api && source .venv/bin/activate && uvicorn src.main:app --reload --host 0.0.0.0 --port 9002
```

Эта команда:
1. Убьет процесс на порту 9002 (если есть)
2. Перейдет в директорию API
3. Активирует виртуальное окружение
4. Запустит API

---

**Попробуйте Решение 1 сначала!**
