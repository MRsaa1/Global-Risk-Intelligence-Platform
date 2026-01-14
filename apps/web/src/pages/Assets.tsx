import { useState } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline'
import { useQuery } from '@tanstack/react-query'
import { assetsApi } from '../lib/api'
import EmptyState from '../components/EmptyState'

// Mock data
const mockAssets = [
  {
    id: '1',
    pars_id: 'PARS-EU-DE-MUC-A1B2C3D4',
    name: 'Munich Office Tower',
    asset_type: 'commercial_office',
    city: 'Munich',
    country_code: 'DE',
    gross_floor_area_m2: 45000,
    current_valuation: 120000000,
    climate_risk_score: 45,
    physical_risk_score: 22,
    network_risk_score: 68,
    status: 'active',
  },
  {
    id: '2',
    pars_id: 'PARS-EU-DE-BER-E5F6G7H8',
    name: 'Berlin Data Center',
    asset_type: 'data_center',
    city: 'Berlin',
    country_code: 'DE',
    gross_floor_area_m2: 12000,
    current_valuation: 85000000,
    climate_risk_score: 28,
    physical_risk_score: 15,
    network_risk_score: 82,
    status: 'active',
  },
  {
    id: '3',
    pars_id: 'PARS-EU-DE-HAM-I9J0K1L2',
    name: 'Hamburg Logistics Hub',
    asset_type: 'logistics',
    city: 'Hamburg',
    country_code: 'DE',
    gross_floor_area_m2: 75000,
    current_valuation: 65000000,
    climate_risk_score: 72,
    physical_risk_score: 38,
    network_risk_score: 45,
    status: 'active',
  },
]

function getRiskColor(score: number): string {
  if (score >= 70) return 'text-risk-high'
  if (score >= 40) return 'text-risk-medium'
  return 'text-risk-low'
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}

export default function Assets() {
  const [search, setSearch] = useState('')

  // Fetch assets from API
  const { data, isLoading, error } = useQuery({
    queryKey: ['assets', search],
    queryFn: () => assetsApi.list({ search, page: 1, page_size: 100 }),
  })

  const assets = data?.items || []
  const filteredAssets = assets.filter((asset) =>
    asset.name?.toLowerCase().includes(search.toLowerCase()) ||
    asset.city?.toLowerCase().includes(search.toLowerCase())
  )

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 animate-pulse" />
          <p className="text-dark-muted">Loading assets...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-red-400 mb-4">Failed to load assets</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary-500 text-white rounded-xl"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (filteredAssets.length === 0 && !search) {
    return (
      <div className="h-full overflow-auto p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-display font-bold">Assets</h1>
            <p className="text-dark-muted mt-1">
              Manage your physical assets and their Digital Twins
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-xl font-medium"
          >
            <PlusIcon className="w-5 h-5" />
            Add Asset
          </motion.button>
        </div>
        <EmptyState
          icon={BuildingOffice2Icon}
          title="No assets yet"
          description="Get started by adding your first physical asset. Upload a BIM file to create a Digital Twin."
          action={{
            label: "Add Your First Asset",
            onClick: () => {}, // Open add asset modal
          }}
        />
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold">Assets</h1>
          <p className="text-dark-muted mt-1">
            Manage your physical assets and their Digital Twins
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-xl font-medium"
        >
          <PlusIcon className="w-5 h-5" />
          Add Asset
        </motion.button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="flex-1 relative">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-dark-muted" />
          <input
            type="text"
            placeholder="Search assets..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-dark-card border border-dark-border rounded-xl text-white placeholder-dark-muted focus:outline-none focus:border-primary-500"
          />
        </div>
        <button className="flex items-center gap-2 px-4 py-3 bg-dark-card border border-dark-border rounded-xl text-dark-muted hover:text-white transition-colors">
          <FunnelIcon className="w-5 h-5" />
          Filters
        </button>
      </div>

      {/* Asset Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredAssets.map((asset, index) => (
          <motion.div
            key={asset.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Link
              to={`/assets/${asset.id}`}
              className="block glass rounded-2xl p-6 hover:glow-primary transition-all group"
            >
              {/* Header */}
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 bg-primary-500/20 rounded-xl">
                  <BuildingOffice2Icon className="w-6 h-6 text-primary-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold truncate group-hover:text-primary-400 transition-colors">
                    {asset.name}
                  </h3>
                  <p className="text-sm text-dark-muted">
                    {asset.city}, {asset.country_code}
                  </p>
                </div>
              </div>

              {/* PARS ID */}
              <div className="mb-4">
                <p className="text-xs font-mono text-dark-muted">{asset.pars_id}</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="text-xs text-dark-muted">Valuation</p>
                  <p className="text-lg font-semibold">{formatCurrency(asset.current_valuation)}</p>
                </div>
                <div>
                  <p className="text-xs text-dark-muted">Area</p>
                  <p className="text-lg font-semibold">{(asset.gross_floor_area_m2 / 1000).toFixed(1)}K m²</p>
                </div>
              </div>

              {/* Risk Scores */}
              <div className="flex gap-4">
                <div className="flex-1 text-center p-2 bg-dark-bg rounded-lg">
                  <p className="text-xs text-dark-muted">Climate</p>
                  <p className={`font-semibold ${getRiskColor(asset.climate_risk_score)}`}>
                    {asset.climate_risk_score}
                  </p>
                </div>
                <div className="flex-1 text-center p-2 bg-dark-bg rounded-lg">
                  <p className="text-xs text-dark-muted">Physical</p>
                  <p className={`font-semibold ${getRiskColor(asset.physical_risk_score)}`}>
                    {asset.physical_risk_score}
                  </p>
                </div>
                <div className="flex-1 text-center p-2 bg-dark-bg rounded-lg">
                  <p className="text-xs text-dark-muted">Network</p>
                  <p className={`font-semibold ${getRiskColor(asset.network_risk_score)}`}>
                    {asset.network_risk_score}
                  </p>
                </div>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
