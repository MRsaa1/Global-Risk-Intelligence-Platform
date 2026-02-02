# Как открыть панель Earth-2 Command Center (E2CC) из браузера

Кнопка **«Open in Omniverse»** в Command Center открывает Earth-2 Command Center в новой вкладке. Чтобы панель E2CC реально открывалась, нужно:

1. **Запустить E2CC на сервере (saaaliance)** — приложение слушает порт 8010.
2. **Пробросить порт 8010 с Mac на сервер** — тогда в браузере `localhost:8010` будет вести на E2CC на сервере.
3. **В `apps/api/.env` на сервере** задать `E2CC_BASE_URL=http://localhost:8010` — API будет отдавать этот URL, браузер откроет его, и через port-forward запрос попадёт на E2CC.

---

## Шаг 1. Запустить E2CC на сервере (один раз)

На **Brev (saaaliance)** в терминале:

```bash
cd ~
git lfs install
git clone https://github.com/NVIDIA-Omniverse-blueprints/earth2-weather-analytics.git
cd earth2-weather-analytics
git lfs fetch --all
./deploy/deploy_e2cc.sh -s
```

В логах будет указан URL стримера (обычно `http://localhost:8010`). Оставь этот процесс запущенным (или запускай в screen/tmux).

Подробнее: **docs/OMNIVERSE_E2CC_SETUP.md**.

---

## Шаг 2. Port-forward 8010 на Mac

**На Mac** в отдельном терминале (оставь его открытым):

```bash
brev port-forward saaaliance
```

- Port on Brev machine: **8010**
- Port on your local machine: **8010** (или другой свободный, например 8011)

Тогда в браузере **http://localhost:8010** будет открывать E2CC на сервере.

---

## Шаг 3. E2CC_BASE_URL на сервере

В **apps/api/.env** на сервере должно быть:

```env
E2CC_BASE_URL=http://localhost:8010
```

Если на Mac при port-forward ты указал другой локальный порт (например 8011), то в браузере E2CC будет по **http://localhost:8011**. Но API отдаёт URL с сервера — на сервере мы не знаем твой локальный порт, поэтому обычно используют **8010:8010** и `E2CC_BASE_URL=http://localhost:8010`. Тогда кнопка «Open in Omniverse» открывает `http://localhost:8010`, и при запущенном port-forward 8010→8010 панель E2CC загружается.

После смены `.env` перезапусти API:

```bash
pkill -f "uvicorn src.main:app"
cd ~/global-risk-platform/apps/api && source .venv/bin/activate
nohup uvicorn src.main:app --host 0.0.0.0 --port 9002 > /tmp/api.log 2>&1 &
```

---

## Итог

- **Три терминала:** (1) сервер — E2CC `./deploy/deploy_e2cc.sh -s`; (2) Mac — port-forward 5182:5180 (web); (3) Mac — port-forward 8010:8010 (E2CC).
- В браузере: **http://localhost:5182/command** — Command Center; кнопка **Open in Omniverse** откроет **http://localhost:8010** — панель Earth-2 Command Center.

Если вкладка 8010 пустая или «не удалось подключиться» — проверь, что E2CC запущен на сервере и port-forward 8010 на Mac активен.
