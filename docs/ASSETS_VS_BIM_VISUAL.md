# Активы в платформе vs «точные 3D копии» зданий (BIM)

*Февраль 2025*

---

## Коротко: в чём разница

| Что у вас в разделе **Assets** | Что вы хотите видеть (как в xeokit) |
|--------------------------------|-------------------------------------|
| **Точки/адреса и контуры зданий** (footprints) из OSM, Microsoft, Geofabrik | **Полноценные BIM-модели**: этажи, стены, окна, двери, дерево объектов, сечения, подсветка |
| Данные для карты и списка активов | Визуал как на [xeokit-bim-viewer](https://xeokit.github.io/xeokit-bim-viewer/) и [xeo.vision](https://xeo.vision/) |

**Да, вы правильно понимаете:** то, что сейчас в Assets — это **не** точные 3D-копии зданий. Это записи об объектах (координаты, адрес, тип, площадь и т.д.) и при желании контуры зданий для карты. Такой визуал дают источники вроде Geofabrik и Microsoft Building Footprints.

**«Точные 3D копии»** — это уже **BIM**: модели в формате IFC (или сконвертированные в XKT), которые открываются в BIM-вьюерах (xeokit, web-ifc и т.д.).

---

## Источники данных: для чего что нужно

### 1. Для списка активов и карты (контуры зданий, точки)

Используются **следы зданий (footprints)** и OSM-данные:

| Источник | Что даёт | Ссылка |
|----------|----------|--------|
| **Geofabrik OSM** | Континенты/страны: здания, дороги, границы (OSM). Формат `.osm.pbf`. | [North America](https://download.geofabrik.de/north-america.html), [Europe](https://download.geofabrik.de/europe.html), [Asia](https://download.geofabrik.de/asia.html) |
| **Microsoft GlobalMLBuildingFootprints** | ~1.4 млрд зданий по миру: полигоны + опционально высота. GeoJSON/CSV. | [GitHub](https://github.com/microsoft/GlobalMLBuildingFootprints) |

Это **не** 3D BIM: нет этажей, стен, окон. Это «где здание стоит» и его контур (и иногда высота) — для карты и таблицы активов. Импорт в платформу описан в [ASSET_DATA_SOURCES_FULL.md](./ASSET_DATA_SOURCES_FULL.md).

### 2. Для визуала «как в xeokit» — полноценный 3D BIM

Нужны **BIM-модели**:

| Формат | Откуда берётся | Где смотреть |
|--------|----------------|--------------|
| **IFC** | Экспорт из Revit/ArchiCAD, тестовые репозитории (buildingSMART, bim-whale и др.) | [IFC_BIM_VIEWER_SOURCES.md](./IFC_BIM_VIEWER_SOURCES.md) |
| **XKT** | Конвертация IFC → XKT (xeokit-convert, Creoox и др.) | Ниже раздел «Как получить визуал как у xeokit» |

Только при наличии IFC (или XKT) по конкретному зданию можно показать «точную 3D копию» в стиле xeokit.

---

## Как получить визуал как на xeokit-bim-viewer / xeo.vision

На [xeokit-bim-viewer](https://xeokit.github.io/xeokit-bim-viewer/) и [xeo.vision](https://xeo.vision/) показываются модели в формате **XKT** (не IFC напрямую в браузере). Pipeline такой:

1. **IFC** (из Revit/ArchiCAD или скачанные сэмплы) → конвертация в **XKT**
2. Загрузка **XKT** в xeokit-bim-viewer: дерево объектов, этажи, сечения, подсветка и т.д.

### Вариант A: Встроить xeokit-bim-viewer в платформу

- Установить пакет: `npm i @xeokit/xeokit-bim-viewer`
- По документации: [xeokit-bim-viewer](https://xeokit.github.io/xeokit-bim-viewer/) — создание viewer, загрузка проектов из `data/projects`, формат `index.json` и т.д.
- Конвертация IFC → XKT: [xeokit-convert](https://github.com/xeokit/xeokit-convert) или [IFC → GLB → XKT (Creoox)](https://xeokit.github.io/xeokit-bim-viewer/) (см. раздел Model Database).
- Для каждого актива в платформе: если есть привязанный IFC/XKT — открывать его в этом viewer вместо (или вместе с) текущим web-ifc.

### Вариант B: Оставить текущий BIM Viewer (web-ifc)

- Сейчас в платформе используется **web-ifc**: загрузка IFC прямо в браузере, без предконвертации в XKT.
- Плюс: не нужен отдельный шаг конвертации.
- Минус: у вас были ошибки парсинга (LINEWRITER_BUFFER); версии web-ifc выровняли до 0.0.57 — если после этого всё стабильно, можно продолжать использовать.
- Визуал будет проще, чем у xeokit (меньше «фишек» из коробки), но это уже просмотр IFC по зданию.

### Вариант C: Гибрид

- **Assets** по-прежнему заполняются из Geofabrik / Microsoft Building Footprints (список зданий, карта, контуры).
- Для части активов, по которым есть IFC/XKT (например, объекты с Revit/ArchiCAD), в карточке актива открывать **xeokit-bim-viewer** (или текущий BIM Viewer с IFC) — и тогда пользователь видит «точную 3D копию» только там, где есть BIM-модель.

---

## Связь с вашими ссылками

| Ссылка | Роль в вашей задаче |
|--------|----------------------|
| [xeokit-bim-viewer](https://xeokit.github.io/xeokit-bim-viewer/) | Эталон визуала: дерево объектов, этажи, XKT, 2D/3D. |
| [xeo.vision](https://xeo.vision/) | Пример продукта на xeokit. |
| [Geofabrik NA / Europe / Asia](https://download.geofabrik.de/) | Данные для **карты и списка активов** (здания как объекты OSM), не для BIM-визуала. |
| [Microsoft GlobalMLBuildingFootprints](https://github.com/microsoft/GlobalMLBuildingFootprints) | То же: **активы и контуры зданий** для импорта в платформу, не 3D BIM. |

Итого: Geofabrik и Microsoft — чтобы **знать, какие здания есть и где они**; xeokit и IFC/XKT — чтобы **показать точную 3D копию** там, где у вас есть BIM-модель.

---

## Что можно сделать дальше в коде

1. **Документация:** этот файл + [ASSET_DATA_SOURCES_FULL.md](./ASSET_DATA_SOURCES_FULL.md) и [IFC_BIM_VIEWER_SOURCES.md](./IFC_BIM_VIEWER_SOURCES.md) уже задают разделение «активы vs BIM-визуал».
2. **Опционально:** вынести в таск «Интеграция xeokit-bim-viewer» (отдельная страница/вкладка или замена BIM Viewer для активов с привязанным XKT).
3. **Конвертация:** описать в репозитории скрипт/пайплайн IFC → XKT и куда класть `.xkt` файлы, чтобы xeokit их подхватывал.

Если нужно, могу предложить конкретные шаги интеграции xeokit-bim-viewer в ваш фронт (куда поставить компонент, откуда брать `projectId`/путь к XKT для выбранного актива).
