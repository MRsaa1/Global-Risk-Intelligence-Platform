# Где взять 3D‑модели для платформы

Кратко: какие форматы поддерживаются, где искать бесплатные/доступные модели и куда их класть.

---

## Форматы в платформе

| Режим | Формат | Где используется |
|-------|--------|-------------------|
| **3D View** | GLB / glTF | Digital Twin Library → Attach к активу |
| **BIM (IFC)** | IFC, IFCZIP | Загрузка через «Upload from disk» на странице актива |
| **BIM (XKT)** | XKT (xeokit) | Файлы в `public/xeokit-data/projects/<id>/` + у актива поле `xkt_project_id` |

---

## 1. Модели для 3D View (GLB / glTF)

Нужны файлы **.glb** или **.gltf** (чаще всего один файл .glb). Их можно:
- добавлять в Digital Twin Library через API (каталог + загрузка в MinIO или URL);
- либо конвертировать из IFC/USD (см. ниже).

### Бесплатные базы GLB/glTF

| Источник | Что там | Ссылка |
|----------|---------|--------|
| **Khronos glTF Sample Models** | Эталонные модели (Duck, Avocado, Damaged Helmet и др.) | https://github.com/KhronosGroup/glTF-Sample-Models |
| **Sketchfab (CC0 / downloadable)** | Много зданий, инфраструктуры, техники; фильтр по лицензии | https://sketchfab.com (лицензия: CC0, CC BY и т.д.) |
| **Poly Pizza (Google)** | Архив Poly, много зданий и объектов | https://poly.pizza (поиск по «building», «factory» и т.д.) |
| **Quaternius (Ultimate Animated/Static packs)** | Здания, природа, транспорт (часто CC0) | https://quaternius.com |
| **Kenney Assets** | Игры/интерфейсы, часть — здания и объекты | https://kenney.nl/assets |
| **OpenGameArt.org** | 3D для игр, часто CC0/CC BY, можно искать здания | https://opengameart.org |
| **Free3D** | Модели разного качества, смотреть лицензию | https://free3d.com |

Что искать по запросам: **building**, **factory**, **warehouse**, **office**, **house**, **glb**, **gltf**, **CC0**, **free download**.

### Конвертация в GLB

- **IFC → GLB:** IfcOpenShell: `IfcConvert input.ifc output.glb` (https://ifcopenshell.org).
- **OBJ/FBX → GLB:** Blender (File → Export → glTF 2.0) или онлайн-конвертеры.
- **USD → GLB:** в платформе есть пайплайн USD→GLB (Celery/конвертер); каталог библиотеки может указывать на USD, конвертация создаёт GLB.

---

## 2. Модели для BIM (IFC)

Нужны файлы **.ifc** или **.ifczip**. Загружаются через «Upload from disk» на странице актива (режим BIM (IFC)).

### Бесплатные базы IFC

| Источник | Описание | Ссылка |
|----------|----------|--------|
| **buildingSMART Sample-Test-Files** | Официальные тестовые IFC (AC20 и др.) | https://github.com/buildingSMART/Sample-Test-Files |
| **bim-whale IFC samples** | BasicHouse и др., удобно для IFC.js | https://github.com/andrewisen/bim-whale-ifc-samples |
| **BIMData Research** | Реальные проекты (клиники, офисы) | https://github.com/bimdata/BIMData-Research-and-Development |
| **Open IFC Model Repository (Auckland)** | Академическая коллекция | https://openifcmodel.cs.auckland.ac.nz/ |
| **youshengCode IfcSampleFiles** | Тестовые IFC (Duplex, SampleCastle и др.) | https://github.com/youshengCode/IfcSampleFiles |

Подробнее и команды для скачивания: [docs/IFC_BIM_VIEWER_SOURCES.md](./IFC_BIM_VIEWER_SOURCES.md).

### Локальный демо‑файл

Чтобы работал пресет «Local demo» в BIM Viewer:

```bash
cd apps/web/public/samples
curl -L -o demo.ifc "https://raw.githubusercontent.com/andrewisen/bim-whale-ifc-samples/main/BasicHouse/IFC/BasicHouse.ifc"
```

---

## 3. Модели для BIM (XKT)

Нужен **XKT** (формат xeokit). Обычно получают конвертацией из IFC.

### Где взять XKT

| Вариант | Как |
|---------|-----|
| **Готовый демо** | В репозитории уже есть `public/xeokit-data/projects/Duplex/` (проект Duplex). |
| **Своя модель** | IFC → XKT конвертером xeokit, затем положить в `public/xeokit-data/projects/<ProjectId>/`. |

### Конвертация IFC → XKT

```bash
npm install -g @xeokit/xeokit-convert
xeokit-convert -s model.ifc -o public/xeokit-data/projects/MyBuilding/models/design/geometry.xkt
```

Нужна структура папок и `index.json` по образцу Duplex (см. `public/xeokit-data/README.md`). У актива в данных задать **xkt_project_id** = имя проекта (например `MyBuilding`).

---

## 4. Сводка: что искать и куда класть

| Цель | Что искать | Куда/как |
|------|-------------|-----------|
| **3D View (своя модель)** | GLB/glTF (здания, заводы, офисы) на Sketchfab, Poly Pizza, Quaternius, Free3D, glTF Sample Models | Digital Twin Library: через API добавить запись с URL или загрузить GLB в хранилище; затем Attach к активу |
| **BIM (IFC)** | IFC с buildingSMART, bim-whale, BIMData, youshengCode | «Upload from disk» на странице актива в режиме BIM (IFC) или в `public/samples/` для Local demo |
| **BIM (XKT)** | Готовый Duplex или свой IFC → XKT | `public/xeokit-data/projects/<id>/` + у актива поле `xkt_project_id` |

### Рекомендуемые базы для «своих» моделей

1. **GLB для 3D View:** Sketchfab (фильтр CC0/CC BY), Poly Pizza, Khronos glTF Sample Models, Quaternius.
2. **IFC для BIM:** buildingSMART Sample-Test-Files, bim-whale, youshengCode IfcSampleFiles — бесплатно и под наш BIM Viewer.
3. **XKT:** конвертировать из IFC через `@xeokit/xeokit-convert` и положить в `xeokit-data/projects/`.

Если нужен один конкретный источник под задачу (например, только здания или только заводы), можно сузить запрос по типу объекта и лицензии.
