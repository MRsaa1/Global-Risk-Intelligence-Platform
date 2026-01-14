# Visual Upgrade Plan: Global Risk Command Center

## Target Visual

Реализация интерфейса уровня enterprise aerospace/defense:
- 3D глобус с ночными огнями
- Digital Twin объектов
- Portfolio Risk Graph с cascade visualization
- Stress Lab с timeline
- Иммерсивный вход (зум из космоса)

---

## Phase 1: CesiumJS Integration (Week 1-2)

### Что делаем
Заменяем Deck.gl/Mapbox на CesiumJS для главного экрана.

### Почему CesiumJS
- Геодезически корректная Земля (WGS84)
- Масштабирование от планеты до здания
- Time-based data (stress over time)
- Используется в aerospace/defense/infrastructure

### Установка
```bash
npm install cesium resium
```

### Новые компоненты
- `GlobeView.tsx` — 3D глобус
- `InitScene.tsx` — иммерсивный вход
- `RiskOverlay.tsx` — слои рисков на глобусе

---

## Phase 2: Immersive Entry Experience (Week 2)

### Сценарий входа

```
1. Login → Success
2. InitScene (6-8 sec):
   - Глобус медленно вращается
   - "Welcome to Global Risk Command Center"
   - "Initializing global asset graph..."
   - "Loading climate scenarios..."
   - "Syncing portfolio state..."
3. Плавный зум к региону
4. UI-панели появляются fade-in
5. → Command Center
```

### Технически
- CesiumJS camera flight path
- Easing functions (client-side)
- Backend параллельно загружает данные
- Сервер НЕ участвует в рендеринге

### Правило
- Первый вход → full experience
- Последующие → сразу Command Center
- "Re-enter global view" — опционально

---

## Phase 3: Command Center Layout (Week 2-3)

### 4-панельный layout (как на скриншоте)

```
┌─────────────────────────────┬─────────────────────────────┐
│   Global Risk Command       │   Asset Digital Twin View   │
│   Center (Globe)            │   (3D Building)             │
│   - Portfolio Overview      │   - Valuation               │
│   - Stress Lab              │   - Risk metrics            │
│   - Asset Monitor           │   - Impact Analysis         │
├─────────────────────────────┼─────────────────────────────┤
│   Global Stress Testing     │   Portfolio Risk Graph      │
│   - Climate scenarios       │   - Network visualization   │
│   - Rate shocks             │   - Cascade detection       │
│   - Timeline                │   - Critical links          │
└─────────────────────────────┴─────────────────────────────┘
```

---

## Phase 4: Portfolio Risk Graph (Week 3)

### Требования
- Force-directed layout
- GPU-based rendering (для scale)
- Real-time stress propagation
- Cascade failure visualization

### Стек
- **Sigma.js** для старта (< 10k nodes)
- **Custom WebGL** для scale (> 10k nodes)
- **Cytoscape.js** как альтернатива

### Визуализация
- Узлы = активы
- Рёбра = зависимости
- Цвет = уровень риска
- Толщина = сила связи
- Анимация = cascade propagation

---

## Phase 5: Stress Lab (Week 3-4)

### Компоненты
- Scenario selector (Climate, Rates, Regional)
- Timeline slider (T0 → T+5Y)
- Comparison view (Baseline vs Scenario A vs B)
- Results panel (Expected Loss, Capital Impact)

### Backend
- Precompute сценарии
- Cache результаты
- UI переключает состояния (не пересчитывает)

### UX-хак: Иллюзия real-time
```
User clicks scenario →
Show loading (2-5 sec) →
Display cached/computed results →
User thinks it's live
```

---

## Technical Architecture

### Frontend
```
React + TypeScript
├── CesiumJS (globe)
├── Three.js (digital twins)
├── Sigma.js (graphs)
├── Framer Motion (transitions)
└── Zustand (state)
```

### Backend (GPU-ready, CPU-first)
```
Python + FastAPI
├── Ray (distributed compute)
├── NumPy + Numba (acceleration)
├── NetworkX (graphs)
├── PostgreSQL + TimescaleDB
├── Neo4j (graph DB)
└── Redis (cache)
```

### Rendering
```
3D rendering = CLIENT-SIDE (user's GPU)
Server = DATA + COMPUTE only
```

---

## What Your Server Handles

| Task | CPU Load | RAM |
|------|----------|-----|
| User session | Low | 50MB |
| Asset data | Low | 100MB |
| Stress scenario (1) | Medium | 2GB |
| Graph (10k nodes) | Medium | 1GB |
| Monte Carlo (1k iter) | High | 4GB |

**Your server (18 cores, 96GB RAM) handles this easily.**

---

## Color Palette (SAA Alliance Brand)

```css
:root {
  /* Primary */
  --gold: #D4AF37;
  --gold-light: #F4D03F;
  --gold-dark: #B8860B;
  
  /* Neutral */
  --black: #000000;
  --dark-bg: #0a0f1a;
  --dark-card: #111827;
  --white: #FFFFFF;
  
  /* Risk */
  --risk-low: #22c55e;
  --risk-medium: #f59e0b;
  --risk-high: #ef4444;
  --risk-critical: #dc2626;
  
  /* Accent */
  --accent-blue: #3b82f6;
  --accent-cyan: #22d3ee;
}
```

---

## MVP Timeline (6 weeks)

| Week | Deliverable |
|------|-------------|
| 1 | CesiumJS integration, basic globe |
| 2 | InitScene (immersive entry) |
| 3 | Command Center layout, panels |
| 4 | Digital Twin viewer improvements |
| 5 | Portfolio Risk Graph |
| 6 | Stress Lab, polish |

---

## What NOT to do in MVP

❌ VR/AR
❌ Hundreds of scenarios
❌ Full regulatory reports
❌ Photorealistic 3D
❌ Real-time global simulations

---

## Key Success Metrics

✅ Плавный вход (< 8 sec)
✅ UI отзывчивый (< 100ms)
✅ Стресс-сценарий < 10 sec
✅ Граф до 10k узлов
✅ "Wow" эффект при первом входе

---

## Files to Create/Modify

### New Components
- `apps/web/src/components/GlobeView.tsx` — CesiumJS globe
- `apps/web/src/components/InitScene.tsx` — Immersive entry
- `apps/web/src/components/RiskGraph.tsx` — Portfolio graph
- `apps/web/src/components/StressLab.tsx` — Stress testing UI
- `apps/web/src/pages/CommandCenter.tsx` — Main dashboard

### Modify
- `apps/web/src/pages/Dashboard.tsx` → redirect to CommandCenter
- `apps/web/tailwind.config.js` → SAA Alliance colors
- `apps/web/package.json` → add cesium, resium, sigma

---

## Conclusion

Такой визуал — это **следствие архитектуры, а не дизайн-решения**.

У тебя уже есть:
- ✅ Digital Twin backend
- ✅ Simulation Engine (базовый)
- ✅ Graph DB (Neo4j)
- ✅ 3D компоненты (Three.js)

Нужно добавить:
- CesiumJS для глобуса
- Иммерсивный вход
- Force-directed graph
- Command Center layout

**Это реально за 6 недель.**
