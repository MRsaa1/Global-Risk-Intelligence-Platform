# Доступ к серверу с GPU (AWS)

Сервер: **100.30.226.186** (ubuntu, ключ `risk-platform-g5.pem`).

---

## 1. Вход на сервер

```bash
ssh -i ~/.ssh/risk-platform-g5.pem ubuntu@100.30.226.186
```

---

## 2. Вход + туннель (API и Web в браузере с локальной машины)

```bash
ssh -i ~/.ssh/risk-platform-g5.pem -L 15180:localhost:5180 -L 19002:localhost:9002 ubuntu@100.30.226.186
```

Держите сессию открытой. Тогда:
- **Web** доступен локально на порту **15180**
- **API** — на порту **19002**

---

## 3. Деплой на сервере (из локальной машины)

На **локальной** машине (не внутри SSH):

```bash
cd ~/global-risk-platform

export DEPLOY_HOST=100.30.226.186
export DEPLOY_PORT=22
export DEPLOY_USER=ubuntu
export DEPLOY_PROJECT_DIR=/home/ubuntu/global-risk-platform
export SSH_KEY=~/.ssh/risk-platform-g5.pem

./deploy-safe.sh
```

*(Исправьте путь к ключу, если он у вас лежит в другом месте.)*

---

## 4. Браузер (при поднятом туннеле)

- **Command Center:**  
  http://127.0.0.1:15180/command?api=http://127.0.0.1:19002  

- **Главная:**  
  http://127.0.0.1:15180?api=http://127.0.0.1:19002  

Параметр `?api=http://127.0.0.1:19002` задаёт базовый URL API для фронта.

---

## 5. На самом сервере после входа

Поднять все сервисы (NIM, API, Web):

```bash
cd ~/global-risk-platform
./scripts/start-all-gpu.sh
```

Проверка:

```bash
./scripts/check-server-gpu.sh
```

Логи:

```bash
tail -f /tmp/api.log
tail -f /tmp/web.log
```

---

## Переменные для деплоя (сводка)

| Переменная | Значение |
|------------|----------|
| `DEPLOY_HOST` | 100.30.226.186 |
| `DEPLOY_PORT` | 22 |
| `DEPLOY_USER` | ubuntu |
| `DEPLOY_PROJECT_DIR` | /home/ubuntu/global-risk-platform |
| `SSH_KEY` | ~/.ssh/risk-platform-g5.pem |

Локальные порты туннеля: **15180** (Web), **19002** (API).
