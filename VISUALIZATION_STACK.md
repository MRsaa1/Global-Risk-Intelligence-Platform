# Visualization Stack - Final Recommendations

## ✅ Approved Stack

### 3D Visualization

| Component | Technology | Use Case |
|-----------|------------|----------|
| **BIM/3D Buildings** | ✅ Three.js + React Three Fiber + IFC.js | Digital Twins, building visualization |
| **Geospatial Maps** | ✅ Deck.gl + Mapbox | Asset locations, risk heatmaps, infrastructure |
| **Financial 3D Charts** | ✅ Plotly 3D | Risk-return scatter, scenario surfaces |
| **Heatmaps** | ✅ D3.js | Risk correlation matrices, portfolio heatmaps |
| **Simple Charts** | ✅ Recharts | Dashboards, line/bar/pie charts |

---

## Implementation Status

### ✅ Implemented

1. **Three.js + React Three Fiber**
   - `Viewer3D.tsx` - 3D building viewer with risk overlay
   - Integrated with React Three Fiber
   - Risk visualization by color

2. **IFC.js Integration**
   - `BIMViewer.tsx` - IFC file parser and viewer
   - Uses `web-ifc` for parsing
   - Ready for full BIM geometry rendering

3. **Deck.gl + Mapbox**
   - `MapView.tsx` - Geospatial map component
   - ScatterplotLayer for assets
   - HeatmapLayer for risk visualization
   - IconLayer for 3D buildings

4. **Plotly**
   - `FinancialChart.tsx` - 3D financial visualizations
   - Supports scatter3d, surface, efficient_frontier
   - Integrated with react-plotly.js

5. **D3.js**
   - `HeatmapChart.tsx` - Custom heatmap component
   - Risk correlation matrices
   - Portfolio heatmaps

6. **Recharts**
   - Already in use for dashboard charts
   - Simple line/bar/pie charts

---

## Component Usage

### BIM Viewer
```tsx
<BIMViewer
  ifcUrl="/api/v1/assets/{id}/bim"
  onLoad={(metadata) => console.log(metadata)}
  onError={(error) => console.error(error)}
/>
```

### Map View
```tsx
<MapView
  assets={assets}
  showRiskHeatmap={true}
  showInfrastructure={false}
  onAssetClick={(id) => navigate(`/assets/${id}`)}
/>
```

### Financial Chart
```tsx
<FinancialChart
  type="scatter3d"
  data={portfolioData}
  title="Risk-Return Analysis"
/>
```

### Heatmap
```tsx
<HeatmapChart
  data={correlationData}
  xLabels={riskTypes}
  yLabels={riskTypes}
  colorScale="RdYlGn"
/>
```

---

## Dependencies

### Frontend (`apps/web/package.json`)

```json
{
  "dependencies": {
    "@react-three/fiber": "^8.15.16",
    "@react-three/drei": "^9.96.1",
    "three": "^0.161.0",
    "web-ifc": "^0.0.50",
    "deck.gl": "^8.9.35",
    "@deck.gl/react": "^8.9.35",
    "@deck.gl/core": "^8.9.35",
    "@deck.gl/layers": "^8.9.35",
    "react-map-gl": "^7.1.7",
    "maplibre-gl": "^4.0.0",
    "plotly.js": "^2.27.0",
    "react-plotly.js": "^2.6.0",
    "d3": "^7.8.5",
    "recharts": "^2.10.4"
  }
}
```

---

## Next Steps

1. **Complete IFC.js Integration**
   - Full geometry parsing
   - Material mapping
   - Object selection

2. **Enhance Map Features**
   - Flood zone overlays
   - Infrastructure network visualization
   - 3D building extrusion

3. **Add More Chart Types**
   - Efficient frontier with optimization
   - Scenario comparison charts
   - Time-series risk evolution

---

**Status:** ✅ Stack approved and integrated  
**Version:** 0.1.0
