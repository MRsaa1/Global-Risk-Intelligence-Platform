# Stress Test 4D Timeline — где смотреть на фронте

## Как увидеть фичу в интерфейсе

1. **Открой Command Center**  
   Страница: `/command` (или пункт меню Command Center).

2. **Запусти или выбери стресст-тест**  
   В Command Center должен быть выбран сценарий и выполнен стресст-тест (есть результат с зонами).

3. **Открой панель стресст-теста**  
   Когда выбран завершённый тест, открывается панель с результатами (UnifiedStressTestPanel). В ней есть кнопки:
   - **«Open in Cascade»** — открыть каскад в Analytics
   - **«Play 4D Timeline»** — запустить 4D таймлайн на глобусе

4. **Нажми «Play 4D Timeline»**  
   - В глобус (CesiumGlobe) подставляется URL CZML:  
     `GET /api/v1/stress-tests/{test_id}/czml`
   - Глобус загружает CZML, включает анимацию времени (clock) и показывает зоны по времени.

5. **Панель управления таймлайном внизу глобуса**  
   После загрузки CZML внизу глобуса появляется тёмная полоска:
   - **Play / Pause** — запуск/остановка анимации
   - **x1, x10, x100** — скорость воспроизведения
   - **Текущее время** — в формате `YYYY-MM-DD HH:MM`
   - **Скраб (range)** — перемотка по времени

Если кнопки «Play 4D Timeline» не видно: убедись, что выбран именно **завершённый** стресст-тест (есть `selectedStressTest?.id`), и что панель с результатами открыта (не свёрнута).

---

## Где реализовано в коде (фронт)

| Что | Файл | Что искать |
|-----|------|------------|
| Проп и загрузка CZML, clock, панель Play/Pause/скорость/скраб | `apps/web/src/components/CesiumGlobe.tsx` | `stressTestCzmlUrl`, `stressTestCzmlDataSourceRef`, «Stress test 4D timeline controls» |
| Кнопка «Play 4D Timeline» в панели стресст-теста | `apps/web/src/components/stress/UnifiedStressTestPanel.tsx` | `completedStressTestId`, `onPlayTimeline`, «Play 4D Timeline» |
| Та же кнопка в компактной панели (FourPanelLayout) | `apps/web/src/components/command/StressTestPanel.tsx` | `completedStressTestId`, `onPlayTimeline`, «Play 4D Timeline» |
| Стейт URL и передача в глобус и в панель | `apps/web/src/pages/CommandCenter.tsx` | `stressTestCzmlUrl`, `setStressTestCzmlUrl`, `completedStressTestId={selectedStressTest?.id}`, `onPlayTimeline={(url) => setStressTestCzmlUrl(url)}` |
| Проброс пропов в StressTestPanel | `apps/web/src/components/command/FourPanelLayout.tsx` | `completedStressTestId`, `onPlayTimeline` |

---

## Краткий поток данных

```
CommandCenter
  state: stressTestCzmlUrl

  → CesiumGlobe stressTestCzmlUrl={stressTestCzmlUrl}
       → при смене URL: load CZML, viewer.clock.shouldAnimate=true, multiplier=3600
       → при stressTestCzmlUrl задан: рисуется нижняя панель (Play/Pause, x1/x10/x100, время, скраб)

  → UnifiedStressTestPanel
       completedStressTestId={selectedStressTest?.id}
       onPlayTimeline={(url) => setStressTestCzmlUrl(url)}
       → кнопка "Play 4D Timeline" вызывает onPlayTimeline(`${API_BASE}/api/v1/stress-tests/${id}/czml`)
```

После клика «Play 4D Timeline» в стейт попадает URL, CesiumGlobe по нему грузит CZML и показывает таймлайн внизу.
