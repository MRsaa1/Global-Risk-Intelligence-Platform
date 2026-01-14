import { useState } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { assetsApi } from '../lib/api'
import MapView from '../components/MapView'

export default function Map() {
  const [showRiskHeatmap, setShowRiskHeatmap] = useState(true)
  const [showInfrastructure, setShowInfrastructure] = useState(false)

  const { data: assetsData } = useQuery({
    queryKey: ['assets'],
    queryFn: () => assetsApi.list({ page: 1, page_size: 100 }),
  })

  const assets = assetsData?.items || []

  // Convert assets to map format
  const mapAssets = assets
    .filter((a) => a.latitude && a.longitude)
    .map((a) => ({
      id: a.id,
      name: a.name,
      latitude: a.latitude!,
      longitude: a.longitude!,
      climate_risk_score: a.climate_risk_score,
      physical_risk_score: a.physical_risk_score,
      network_risk_score: a.network_risk_score,
      valuation: a.current_valuation,
    }))

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="p-6 border-b border-dark-border">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">Geographic View</h1>
            <p className="text-dark-muted mt-1">
              Visualize assets and risks on the map with Deck.gl + Mapbox
            </p>
          </div>
          <div className="flex gap-2">
            <label className="flex items-center gap-2 px-4 py-2 bg-dark-card rounded-xl cursor-pointer hover:bg-dark-bg transition-colors">
              <input
                type="checkbox"
                checked={showRiskHeatmap}
                onChange={(e) => setShowRiskHeatmap(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Risk Heatmap</span>
            </label>
            <label className="flex items-center gap-2 px-4 py-2 bg-dark-card rounded-xl cursor-pointer hover:bg-dark-bg transition-colors">
              <input
                type="checkbox"
                checked={showInfrastructure}
                onChange={(e) => setShowInfrastructure(e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">Infrastructure</span>
            </label>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="flex-1 relative">
        {mapAssets.length > 0 ? (
          <MapView
            assets={mapAssets}
            showRiskHeatmap={showRiskHeatmap}
            showInfrastructure={showInfrastructure}
            onAssetClick={(assetId) => {
              window.location.href = `/assets/${assetId}`
            }}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center"
            >
              <p className="text-dark-muted">No assets with location data</p>
            </motion.div>
          </div>
        )}
      </div>
    </div>
  )
}
