# Интеграция xeokit-bim-viewer (вариант A)

*Февраль 2025*

В платформу встроен **xeokit-bim-viewer** для визуала как на [xeokit.github.io/xeokit-bim-viewer](https://xeokit.github.io/xeokit-bim-viewer/) и [xeo.vision](https://xeo.vision/): дерево объектов, этажи, сечения, X-ray, BCF и т.д.

---

## Где включено

- **Страница актива (Asset detail)** → вкладка **«BIM (XKT)»**.
- По умолчанию загружается проект с `projectId = "Duplex"` (или `asset.xkt_project_id`, если задан в бэкенде).

---

## Данные (XKT)

Viewer грузит проекты из каталога **`apps/web/public/xeokit-data`** (в браузере — по базе `/xeokit-data`).

### Структура

```
public/xeokit-data/
  projects/
    index.json              ← список проектов: { "projects": [ { "id", "name" } ] }
    <projectId>/
      index.json            ← конфиг проекта, models, viewerContent, viewerState
      models/
        <modelId>/
          geometry.xkt      ← бинарный XKT (геометрия + метаданные)
```

Пример `projects/index.json`:

```json
{
  "projects": [
    { "id": "Duplex", "name": "Duplex" },
    { "id": "MyBuilding", "name": "My Building" }
  ]
}
```

Пример `projects/Duplex/index.json`:

```json
{
  "id": "Duplex",
  "name": "Duplex",
  "models": [
    { "id": "design", "name": "Design" }
  ],
  "viewerConfigs": { "backgroundColor": [0.12, 0.06, 0.1] },
  "viewerContent": { "modelsLoaded": ["design"] },
  "viewerState": { "tabOpen": "storeys" }
}
```

Файл `geometry.xkt` нужно получить конвертацией из IFC (см. ниже).

---

## Конвертация IFC → XKT

1. **xeokit-convert** (CLI):

   ```bash
   npx @xeokit/xeokit-convert -s path/to/model.ifc -o apps/web/public/xeokit-data/projects/MyProject/models/design/geometry.xkt
   ```

2. **Creoox IFC → GLB**, затем при необходимости GLB → XKT (см. [xeokit-bim-viewer](https://xeokit.github.io/xeokit-bim-viewer/) и [Viewing an IFC Model with xeokit](https://www.notion.so/xeokit/Viewing-an-IFC-Model-with-xeokit-c373e48bc4094ff5b6e5c5700ff580ee)).

3. Готовый XKT для демо Duplex можно взять из репозитория [xeokit-bim-viewer](https://github.com/xeokit/xeokit-bim-viewer/tree/master/app/data/projects/Duplex/models/design) и положить в `public/xeokit-data/projects/Duplex/models/design/geometry.xkt`.

Подробности и альтернативы — в `apps/web/public/xeokit-data/README.md`.

---

## Привязка к активу

- Сейчас используется общий проект по умолчанию (`Duplex`) или поле **`xkt_project_id`** у актива (если добавить его в API и форму актива).
- Дальше можно: в бэкенде хранить `xkt_project_id` (и при необходимости путь к проекту), на фронте передавать его в компонент **XeokitBIMViewer** как `projectId`.

---

## Лицензия

xeokit SDK (и xeokit-bim-viewer) распространяется под **AGPLv3**. Для проприетарного использования нужна коммерческая лицензия: [xeokit.io](https://xeokit.io), [contact@creoox.com](mailto:contact@creoox.com).
