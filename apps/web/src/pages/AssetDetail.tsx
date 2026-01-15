import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeftIcon,
  CubeTransparentIcon,
  ClockIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { assetsApi } from '../lib/api'
import Viewer3D from '../components/Viewer3D'
import BIMViewer from '../components/BIMViewer'

export default function AssetDetail() {
  const { id } = useParams()
  const [viewMode, setViewMode] = useState<'3d' | 'bim'>('3d')

  // Fetch asset data
  const { data: asset, isLoading } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => assetsApi.get(id!),
    enabled: !!id,
  })

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 animate-pulse" />
          <p className="text-dark-muted">Loading asset...</p>
        </div>
      </div>
    )
  }

  if (!asset) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-red-400">Asset not found</p>
      </div>
    )
  }

  const timeline = [
    { date: '2015-03-15', type: 'genesis', title: 'Building Constructed' },
    { date: '2019-08-22', type: 'renovation', title: 'HVAC System Upgraded' },
    { date: '2023-11-10', type: 'inspection', title: 'Annual Structural Inspection' },
    { date: '2024-01-05', type: 'sensor', title: 'IoT Sensors Installed' },
  ]

  return (
    <div className="h-full overflow-auto">
      {/* Header */}
      <div className="p-8 border-b border-dark-border">
        <Link
          to="/assets"
          className="inline-flex items-center gap-2 text-dark-muted hover:text-white transition-colors mb-4"
        >
          <ArrowLeftIcon className="w-4 h-4" />
          Back to Assets
        </Link>
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold">{asset.name}</h1>
            <p className="text-dark-muted font-mono text-sm mt-1">{asset.pars_id}</p>
          </div>
          <div className="flex gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-4 py-2 bg-dark-card border border-dark-border rounded-xl text-white"
            >
              <CubeTransparentIcon className="w-5 h-5" />
              View Twin
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-xl font-medium"
            >
              Run Simulation
            </motion.button>
          </div>
        </div>
      </div>

      <div className="p-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 3D Viewer / BIM Viewer */}
        <div className="lg:col-span-2">
          <div className="glass rounded-2xl overflow-hidden h-[400px]">
            {/* View mode toggle */}
            <div className="absolute top-4 right-4 z-10 flex gap-2">
              <button
                onClick={() => setViewMode('3d')}
                className={`px-3 py-1 rounded-lg text-sm ${
                  viewMode === '3d'
                    ? 'bg-primary-500 text-white'
                    : 'bg-dark-card text-dark-muted hover:text-white'
                }`}
              >
                3D View
              </button>
              <button
                onClick={() => setViewMode('bim')}
                className={`px-3 py-1 rounded-lg text-sm ${
                  viewMode === 'bim'
                    ? 'bg-primary-500 text-white'
                    : 'bg-dark-card text-dark-muted hover:text-white'
                }`}
              >
                BIM Viewer
              </button>
            </div>

            {viewMode === '3d' ? (
              <Viewer3D
                riskScores={{
                  climate: asset.climate_risk_score || 0,
                  physical: asset.physical_risk_score || 0,
                  network: asset.network_risk_score || 0,
                }}
                showRiskOverlay={true}
              />
            ) : (
              <BIMViewer
                ifcUrl={(asset as any).bim_file_path ? `/api/v1/assets/${asset.id}/bim` : undefined}
                onLoad={(metadata) => console.log('BIM loaded:', metadata)}
                onError={(error) => console.error('BIM error:', error)}
              />
            )}
          </div>
        </div>

        {/* Info Panel */}
        <div className="space-y-6">
          {/* Risk Scores */}
          <div className="glass rounded-2xl p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <ShieldCheckIcon className="w-5 h-5 text-primary-400" />
              Risk Assessment
            </h3>
            <div className="space-y-4">
              {[
                { label: 'Climate Risk', value: asset.climate_risk_score || 0 },
                { label: 'Physical Risk', value: asset.physical_risk_score || 0 },
                { label: 'Network Risk', value: asset.network_risk_score || 0 },
              ].map((risk) => (
                <div key={risk.label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{risk.label}</span>
                    <span className={
                      (risk.value || 0) > 60 ? 'text-risk-high' :
                      (risk.value || 0) > 40 ? 'text-risk-medium' : 'text-risk-low'
                    }>{risk.value || 0}</span>
                  </div>
                  <div className="h-2 bg-dark-bg rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${risk.value || 0}%` }}
                      transition={{ duration: 1 }}
                      className={`h-full rounded-full ${
                        (risk.value || 0) > 60 ? 'bg-risk-high' :
                        (risk.value || 0) > 40 ? 'bg-risk-medium' : 'bg-risk-low'
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Details */}
          <div className="glass rounded-2xl p-6">
            <h3 className="font-semibold mb-4">Asset Details</h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-dark-muted">Type</span>
                <span>Commercial Office</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-muted">Location</span>
                <span>{asset.city}, {asset.country_code}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-muted">Year Built</span>
                <span>{asset.year_built}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-muted">Floors</span>
                <span>{(asset as any).floors_above_ground || 'N/A'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-muted">Area</span>
                <span>{(asset.gross_floor_area_m2 || 0).toLocaleString()} m²</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-muted">Valuation</span>
                <span className="font-semibold">€{((asset.current_valuation || 0) / 1000000).toFixed(0)}M</span>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="lg:col-span-3">
          <div className="glass rounded-2xl p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-accent-400" />
              Digital Twin Timeline
            </h3>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-dark-border" />
              <div className="space-y-6">
                {timeline.map((event, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="flex gap-4 ml-4"
                  >
                    <div className={`w-3 h-3 rounded-full mt-1.5 -ml-[7px] ${
                      event.type === 'genesis' ? 'bg-primary-500' :
                      event.type === 'renovation' ? 'bg-accent-500' :
                      event.type === 'inspection' ? 'bg-amber-500' : 'bg-blue-500'
                    }`} />
                    <div className="flex-1 pb-6">
                      <p className="text-sm text-dark-muted">{event.date}</p>
                      <p className="font-medium">{event.title}</p>
                      <span className="inline-block mt-1 text-xs px-2 py-1 rounded-full bg-dark-card text-dark-muted">
                        {event.type}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
