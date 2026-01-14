/**
 * Geospatial Map View using Deck.gl + Mapbox.
 * 
 * Displays:
 * - Assets as 3D buildings
 * - Climate risk heatmaps
 * - Infrastructure networks
 * - Flood zones
 */
import { useState, useMemo } from 'react'
import { Map } from 'react-map-gl'
import DeckGL from '@deck.gl/react'
import { ScatterplotLayer, IconLayer } from '@deck.gl/layers'
import { motion } from 'framer-motion'

// Mapbox token (should be in env)
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN || 'pk.eyJ1IjoibWFwYm94IiwiYSI6ImNrcm9uem4ycjBnM2gybm8zam9hN2p2c3gifQ.example'

interface MapViewProps {
  assets?: Array<{
    id: string
    name: string
    latitude: number
    longitude: number
    climate_risk_score?: number
    physical_risk_score?: number
    network_risk_score?: number
    valuation?: number
  }>
  showRiskHeatmap?: boolean
  showInfrastructure?: boolean
  onAssetClick?: (assetId: string) => void
}

export default function MapView({
  assets = [],
  showRiskHeatmap = true,
  showInfrastructure = false,
  onAssetClick,
}: MapViewProps) {
  const [viewState, setViewState] = useState({
    longitude: 11.5820,  // Munich center
    latitude: 48.1351,
    zoom: 6,
    pitch: 45,
    bearing: 0,
  })

  // Scatterplot layer for assets
  const assetLayer = useMemo(() => {
    if (!assets.length) return null

    return new ScatterplotLayer({
      id: 'assets',
      data: assets,
      getPosition: (d: any) => [d.longitude, d.latitude],
      getRadius: (d: any) => Math.sqrt((d.valuation || 10_000_000) / 1_000_000) * 100,
      getFillColor: (d: any) => {
        const score = d.climate_risk_score || 0
        if (score >= 70) return [239, 68, 68, 200]  // red
        if (score >= 40) return [245, 158, 11, 200]  // amber
        return [34, 197, 94, 200]  // green
      },
      radiusMinPixels: 5,
      radiusMaxPixels: 50,
      pickable: true,
      onClick: (info: any) => {
        if (info.object && onAssetClick) {
          onAssetClick(info.object.id)
        }
      },
    })
  }, [assets, onAssetClick])

  // Heatmap layer for climate risk (disabled - requires @deck.gl/aggregation-layers)
  const heatmapLayer = useMemo(() => {
    // HeatmapLayer requires @deck.gl/aggregation-layers package
    // To enable: npm install @deck.gl/aggregation-layers
    // Then import { HeatmapLayer } from '@deck.gl/aggregation-layers'
    return null
  }, [assets, showRiskHeatmap])

  // 3D building layer (simplified - would use actual building geometry)
  const buildingLayer = useMemo(() => {
    if (!assets.length) return null

    return new IconLayer({
      id: 'buildings',
      data: assets,
      getPosition: (d: any) => [d.longitude, d.latitude],
      getIcon: () => ({
        url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTEyIDJMMTMuMDkgOC4yNkwyMSA5TDEzLjA5IDE1Ljc0TDEyIDIyTDEwLjkxIDE1Ljc0TDMgOUwxMC45MSA4LjI2TDEyIDJaIiBmaWxsPSIjMDA1NmU2Ii8+Cjwvc3ZnPgo=',
        width: 24,
        height: 24,
        anchorY: 24,
      }),
      getSize: (d: any) => Math.sqrt((d.valuation || 10_000_000) / 1_000_000) * 2,
      sizeScale: 1,
      pickable: true,
    })
  }, [assets])

  const layers = [
    assetLayer,
    heatmapLayer,
    buildingLayer,
  ].filter(Boolean)

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden">
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState }) => setViewState(viewState)}
        controller={true}
        layers={layers}
      >
        <Map
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          reuseMaps
        />
      </DeckGL>

      {/* Legend */}
      <div className="absolute bottom-4 left-4 glass rounded-xl p-4">
        <p className="text-sm font-medium mb-3">Risk Legend</p>
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-green-500" />
            <span>Low (0-39)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-amber-500" />
            <span>Medium (40-69)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded-full bg-red-500" />
            <span>High (70-100)</span>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="absolute top-4 right-4 glass rounded-xl p-2 space-y-2">
        <button
          onClick={() => setViewState({ ...viewState, zoom: viewState.zoom + 1 })}
          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-dark-card transition-colors"
        >
          +
        </button>
        <button
          onClick={() => setViewState({ ...viewState, zoom: viewState.zoom - 1 })}
          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-dark-card transition-colors"
        >
          −
        </button>
      </div>
    </div>
  )
}
