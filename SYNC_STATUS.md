# Статус синхронизации с сервером

## 🔄 Текущий статус

**Дата:** 2026-01-18 12:33  
**Локальная версия:** http://localhost:5180/command  
**Серверная версия:** https://risk.saa-alliance.com

---

## ✅ Что уже сделано

1. ✅ **Пакет создан** - локальная версия упакована
2. ✅ **Backup сервера** - создан backup текущей серверной версии
3. ✅ **Файлы скопированы** - новая версия загружена на сервер
4. ✅ **Проект распакован** - файлы извлечены на сервере
5. ✅ **Backend зависимости** - установлены Python пакеты
6. ⏳ **Frontend сборка** - в процессе (может занять 5-10 минут)

---

## 📊 Текущее состояние на сервере

### Backend
- ✅ **Работает** на порту 9002
- ✅ Процесс: `uvicorn src.main:app --host 0.0.0.0 --port 9002`
- ✅ PID: 3845420

### Frontend
- ⏳ **Собирается** - процесс `npm run build` запущен
- ⚠️ Старые процессы frontend всё ещё работают (нужно будет перезапустить)

---

## 🔍 Проверка статуса

### Проверить, завершилась ли сборка:

```bash
ssh -i ~/.ssh/id_ed25519_contabo -p 32769 arin@173.212.208.123 'cd ~/global-risk-platform/apps/web && ls -la dist/ | head -5'
```

Если видите файлы в `dist/` - сборка завершена.

### Проверить процессы:

```bash
ssh -i ~/.ssh/id_ed25519_contabo -p 32769 arin@173.212.208.123 'ps aux | grep -E "vite|uvicorn" | grep -v grep'
```

---

## 🚀 Завершение синхронизации

После завершения сборки frontend нужно:

### 1. Остановить старые процессы frontend

```bash
ssh -i ~/.ssh/id_ed25519_contabo -p 32769 arin@173.212.208.123 'pkill -f "vite preview"'
```

### 2. Запустить новый frontend

```bash
ssh -i ~/.ssh/id_ed25519_contabo -p 32769 arin@173.212.208.123 << 'ENDSSH'
cd ~/global-risk-platform/apps/web
nohup npm run preview -- --host 0.0.0.0 --port 5180 > /tmp/web.log 2>&1 &
echo "Frontend started on port 5180"
ENDSSH
```

### 3. Проверить, что всё работает

```bash
# Проверить backend
curl https://risk.saa-alliance.com/api/v1/health

# Проверить frontend
curl -I https://risk.saa-alliance.com
```

---

## 🔄 Альтернатива: Запустить скрипт завершения

Создан скрипт для завершения синхронизации:

```bash
./complete-sync.sh
```

---

## ⚠️ Если что-то пошло не так

### Проблема: Сборка зависла

```bash
# Убить процесс сборки
ssh -i ~/.ssh/id_ed25519_contabo -p 32769 arin@173.212.208.123 'pkill -f "vite build"'

# Запустить сборку заново
ssh -i ~/.ssh/id_ed25519_contabo -p 32769 arin@173.212.208.123 << 'ENDSSH'
cd ~/global-risk-platform/apps/web
npm run build
ENDSSH
```

### Проблема: Порты заняты

```bash
# Найти процессы на портах
ssh -i ~/.ssh/id_ed25519_contabo -p 32769 arin@173.212.208.123 'netstat -tuln | grep -E "5180|9002"'

# Убить процессы
ssh -i ~/.ssh/id_ed25519_contabo -p 32769 arin@173.212.208.123 'pkill -f "vite preview"; pkill -f "uvicorn"'
```

### Откат к предыдущей версии

```bash
ssh -i ~/.ssh/id_ed25519_contabo -p 32769 arin@173.212.208.123 << 'ENDSSH'
cd ~
# Найти backup
ls -la global-risk-platform-backup-*.tar.gz
# Восстановить (замените на актуальную дату)
tar -xzf global-risk-platform-backup-20260118_122924.tar.gz
ENDSSH
```

---

## 📋 Чеклист завершения

- [ ] Сборка frontend завершена (проверить `dist/` директорию)
- [ ] Старые процессы frontend остановлены
- [ ] Новый frontend запущен на порту 5180
- [ ] Backend работает на порту 9002
- [ ] Проверен доступ к https://risk.saa-alliance.com
- [ ] Проверен API: https://risk.saa-alliance.com/api/v1/health

---

**Следующий шаг:** Дождаться завершения сборки и выполнить шаги из раздела "Завершение синхронизации"
