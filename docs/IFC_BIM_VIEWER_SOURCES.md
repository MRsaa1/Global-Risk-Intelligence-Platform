# IFC файлы и BIM Viewer — источники и интеграция

*Обновлено: февраль 2025*

---

## Что такое IFC

**IFC (Industry Foundation Classes)** — открытый стандарт обмена BIM-данными между программами (Revit, ArchiCAD, Tekla и др.).

**Версии:**
- IFC 2x3 (распространённая)
- IFC 4 (современная)
- IFC 4.3 (новейшая)

---

## Где взять IFC бесплатно

| Источник | Описание | Ссылка |
|----------|----------|--------|
| **buildingSMART Sample-Test-Files** | Официальные тестовые модели, IFC 2x3/4/4.3 | https://github.com/buildingSMART/Sample-Test-Files |
| **bim-whale IFC samples** | Простые модели для IFC.js (BasicHouse и др.) | https://github.com/andrewisen/bim-whale-ifc-samples |
| **BIMData Research** | Реальные проекты (клиники, офисы), ~100 IFC | https://github.com/bimdata/BIMData-Research-and-Development (см. IFC_FILES.md) |
| **Open IFC Model Repository** | Академическая коллекция (Auckland) | https://openifcmodel.cs.auckland.ac.nz/ |
| **youshengCode IfcSampleFiles** | Тестовые IFC для обучения | https://github.com/youshengCode/IfcSampleFiles |

**Быстрый старт (скачать один файл):**
```bash
# buildingSMART — AC20 Institute
wget "https://cdn.jsdelivr.net/gh/buildingSMART/Sample-Test-Files@master/IFC%202x3/Architectural%20design%20example/AC20-Institute-Var-2-IFC.ifc"

# bim-whale BasicHouse
wget https://raw.githubusercontent.com/andrewisen/bim-whale-ifc-samples/main/BasicHouse/IFC/BasicHouse.ifc
```

---

## Сравнение BIM Viewers (кратко)

| Viewer | Платформа | Цена | IFC | Скорость | Open Source | Для чего |
|--------|-----------|------|-----|----------|-------------|----------|
| **xeokit** | Web | бесплатно | отлично | очень быстро | да | Разработка, большие модели (через XKT) |
| **That Open / web-ifc-viewer** (бывший IFC.js) | Web | бесплатно | отлично | хорошо | да | Прямая загрузка IFC в браузере |
| **BIM Vision** | Windows | бесплатно | отлично | хорошо | нет | Desktop просмотр |
| **IFCWebServer** | Web | бесплатно (basic) | отлично | средне | нет | Collaboration, cloud |
| **bimviewer.org** | Web | бесплатно | IFC, RVT, DWG | средне | нет | Быстрый просмотр без установки |
| **Trimble Connect** | Web/Mobile | платно | отлично | хорошо | нет | Enterprise, collaboration |

**Конвертация:** xeokit требует IFC → XKT (инструмент `@xeokit/xeokit-convert`). That Open (web-ifc) загружает IFC напрямую.

---

## Инструменты конвертации

- **IfcOpenShell (Python):** чтение/запись IFC, IFC → glTF, извлечение свойств.  
  https://ifcopenshell.org/  
  `pip install ifcopenshell` → `IfcConvert model.ifc model.glb`
- **xeokit-convert:** IFC → XKT для xeokit viewer.  
  `npm install -g @xeokit/xeokit-convert` → `xeokit-convert -s model.ifc -o model.xkt`

---

## Интеграция в наш проект

### Текущий стек

- **Frontend:** [apps/web/src/components/BIMViewer.tsx](../apps/web/src/components/BIMViewer.tsx) — **web-ifc** (That Open Engine, бывший IFC.js) + Three.js + React Three Fiber. IFC загружается по URL или из `ArrayBuffer` (файл с диска).
- **API:**
  - `POST /api/v1/assets/{asset_id}/upload-bim` — загрузка IFC для актива (файл сохраняется в MinIO).
  - `GET /api/v1/assets/{asset_id}/bim` — отдача IFC файла актива (presigned URL или stream).
- **Клиент:** [apps/web/src/lib/api.ts](../apps/web/src/lib/api.ts) — `assetsApi.uploadBim(id, file)`.

### Как пользоваться

1. **Демо-модели:** на странице актива → вкладка «BIM Viewer» → блок «Demo models» → выбрать пресет. Рекомендуется **Local demo**: положите файл `demo.ifc` в `apps/web/public/samples/` (см. `public/samples/README.md` — там команда `curl` для скачивания), тогда пресет «Local demo» работает без CORS. Остальные пресеты грузят IFC по ссылке (raw GitHub); при 404 или CORS используйте «Upload from disk».
2. **Своя модель:** кнопка «Upload from disk» → выбор .ifc или .ifczip → загрузка через API, привязка к активу.
3. **Скачать образцы:** ссылка «Download sample IFC files» (buildingSMART) или «More sources» в доку — затем загрузить через «Upload from disk».

### Большие модели (будущее)

Для очень больших IFC рекомендуется пайплайн **IFC → XKT** и просмотр через **xeokit**:

1. Backend: после загрузки IFC опционально конвертировать в XKT (xeokit-convert или аналог), хранить XKT в MinIO.
2. Frontend: при наличии XKT показывать модель в xeokit viewer (отдельный режим или авто-выбор по размеру).

Трудозатраты: неделя+ (конвертер, API, фронт). Текущий web-ifc остаётся для средних и малых моделей.

---

## Полезные ссылки

- buildingSMART Sample-Test-Files: https://github.com/buildingSMART/Sample-Test-Files  
- bim-whale IFC samples: https://github.com/andrewisen/bim-whale-ifc-samples  
- xeokit SDK: https://xeokit.github.io/xeokit-bim-viewer/  
- **That Open Engine (web-ifc-viewer, бывший IFC.js):**  
  - GitHub: https://github.com/ThatOpen/web-ifc-viewer  
  - Документация: https://thatopen.github.io/engine_web-ifc/docs/  
  - Live demo: https://tomleelive.github.io/IFCjs-web-ifc-viewer/ или https://chuongmep.github.io/ifcjs-webpack/  
  - Community Discord: https://discord.gg/FXfyR4XrKT  
- IfcOpenShell: https://ifcopenshell.org/
