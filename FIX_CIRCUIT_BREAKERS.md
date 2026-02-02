# 🔧 Исправление Circuit Breakers

## Проблема

System Overseer показывает открытые circuit breakers:
- ❌ Neo4j circuit breaker is OPEN
- ❌ Minio circuit breaker is OPEN  
- ❌ Timescale circuit breaker is OPEN

## Причина

Эти сервисы не запущены (Docker контейнеры не запущены или Docker не установлен).

---

## ✅ Решение

### Вариант 1: Установить и запустить Docker (если нужно)

**Установка Docker Desktop для macOS:**
1. Скачайте с https://www.docker.com/products/docker-desktop/
2. Установите и запустите Docker Desktop
3. Затем выполните:
```bash
cd /Users/artur220513timur110415gmail.com/global-risk-platform
docker compose up -d postgres redis neo4j minio
```

### Вариант 2: Игнорировать (рекомендуется для разработки)

**Эти circuit breakers НЕ критичны!** Платформа работает и без них:

- ✅ **Neo4j** - используется только для Knowledge Graph (опционально)
- ✅ **MinIO** - используется только для хранения файлов (опционально)  
- ✅ **Timescale** - используется только для временных рядов (опционально)

**Основные сервисы работают:**
- ✅ PostgreSQL (основная БД)
- ✅ Redis (кэш)
- ✅ API сервер
- ✅ Web сервер

**Просто игнорируйте эти предупреждения** - они не влияют на основную функциональность платформы.

### Вариант 3: Запустить сервисы локально (если нужно)

Если у вас установлены эти сервисы локально (не через Docker):

**Neo4j:**
```bash
# Запустите Neo4j локально на порту 7687
```

**MinIO:**
```bash
# Запустите MinIO локально на порту 9000
```

**TimescaleDB:**
```bash
# Запустите TimescaleDB локально на порту 5433
```

### Вариант 4: Ручной сброс через API (если сервисы запущены)

Если сервисы запущены, но circuit breakers все еще открыты:

```bash
# Сбросить Neo4j circuit breaker
curl -X POST http://localhost:9002/api/v1/oversee/circuit-breakers/neo4j/reset

# Сбросить Minio circuit breaker
curl -X POST http://localhost:9002/api/v1/oversee/circuit-breakers/minio/reset

# Сбросить Timescale circuit breaker
curl -X POST http://localhost:9002/api/v1/oversee/circuit-breakers/timescale/reset
```

### Вариант 5: Автоматическое исправление

System Overseer теперь **автоматически** пытается исправить эти проблемы при следующем цикле мониторинга (каждые 5 минут).

**Просто подождите** - Overseer проверит доступность сервисов и сбросит circuit breakers, если сервисы снова работают.

---

## 🔍 Проверка статуса

1. Откройте Command Center: http://127.0.0.1:5180/command
2. Проверьте раздел "System Overseer"
3. Через 1-2 минуты circuit breakers должны автоматически закрыться

---

## 📝 Примечание

Если Docker не установлен, убедитесь, что эти сервисы запущены локально:
- **Neo4j:** `bolt://localhost:7687`
- **MinIO:** `http://localhost:9000`
- **TimescaleDB:** `postgresql://localhost:5433`
