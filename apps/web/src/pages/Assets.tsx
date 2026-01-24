import { useState, useMemo, useRef, useEffect, Fragment } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  FunnelIcon,
  BuildingOffice2Icon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { assetsApi } from '../lib/api'
import EmptyState from '../components/EmptyState'
import { VirtualList } from '../components/VirtualList'

// Mock data (for development/demo purposes)
const _mockAssets = [
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
  const [showAddModal, setShowAddModal] = useState(false)
  const [mounted, setMounted] = useState(false)
  const [form, setForm] = useState({
    name: '',
    city: '',
    country_code: 'DE',
    asset_type: 'commercial_office',
    latitude: '',
    longitude: '',
    current_valuation: '',
    description: '',
  })
  const fileInputRef = useRef<HTMLInputElement>(null)
  const queryClient = useQueryClient()

  const resetForm = () =>
    setForm({
      name: '',
      city: '',
      country_code: 'DE',
      asset_type: 'commercial_office',
      latitude: '',
      longitude: '',
      current_valuation: '',
      description: '',
    })

  // Ensure component is mounted before rendering Portal
  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])


  // Fetch assets from API
  const { data, isLoading, error } = useQuery({
    queryKey: ['assets', search],
    queryFn: () => assetsApi.list({ search, page: 1, page_size: 100 }),
  })

  // Bulk import mutation
  const bulkImportMutation = useMutation({
    mutationFn: ({ file, skipErrors, calculateRisks }: { file: File; skipErrors: boolean; calculateRisks: boolean }) =>
      assetsApi.bulkImport(file, skipErrors, calculateRisks),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      alert('Assets imported successfully!')
    },
    onError: (error: any) => {
      alert(`Import failed: ${error.message}`)
    },
  })

  // Create asset mutation
  const createMutation = useMutation({
    mutationFn: (payload: Parameters<typeof assetsApi.create>[0]) => assetsApi.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      setShowAddModal(false)
      resetForm()
    },
    onError: (err: any) => {
      alert(err?.response?.data?.detail || err?.message || 'Failed to create asset')
    },
  })

  const handleBulkImport = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      bulkImportMutation.mutate({ file, skipErrors: false, calculateRisks: true })
    }
  }

  const handleDownloadTemplate = async () => {
    try {
      const blob = await assetsApi.getBulkTemplate()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'asset_upload_template.csv'
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (error) {
      alert('Failed to download template')
    }
  }

  const handleAddAsset = (e?: React.MouseEvent) => {
    e?.preventDefault()
    e?.stopPropagation()
    setShowAddModal(true)
  }

  const assets = data?.items || []
  const filteredAssets = assets.filter((asset) =>
    asset.name?.toLowerCase().includes(search.toLowerCase()) ||
    asset.city?.toLowerCase().includes(search.toLowerCase())
  )

  // Modal component - render it always via Portal
  const renderModal = () => {
    if (!mounted || typeof document === 'undefined' || !document.body) {
      return null
    }
    if (!showAddModal) {
      return null
    }
    
    return createPortal(
      <motion.div
        key="modal-backdrop"
        data-modal-backdrop
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
        style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: 0,
          display: 'flex',
          zIndex: 9999,
          pointerEvents: 'auto'
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setShowAddModal(false)
            resetForm()
          }
        }}
      >
            <motion.div
              key="modal-content"
              data-modal-content
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-dark-card rounded-2xl p-6 w-full max-w-md border border-white/10 mx-4 shadow-2xl"
              style={{ 
                position: 'relative', 
                zIndex: 10000,
                display: 'block'
              }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-display font-bold text-white">Add New Asset</h2>
                <button
                  onClick={() => {
                    setShowAddModal(false)
                    resetForm()
                  }}
                  className="text-dark-muted hover:text-white transition-colors cursor-pointer"
                  aria-label="Close modal"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2 text-white">Asset Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full px-4 py-2 bg-dark-bg border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary-500"
                    placeholder="Enter asset name"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-white">City</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    className="w-full px-4 py-2 bg-dark-bg border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary-500"
                    placeholder="Enter city"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white">Country</label>
                    <input
                      type="text"
                      maxLength={2}
                      value={form.country_code}
                      onChange={(e) => setForm((f) => ({ ...f, country_code: e.target.value.toUpperCase().slice(0, 2) }))}
                      className="w-full px-4 py-2 bg-dark-bg border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary-500"
                      placeholder="DE"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white">Type</label>
                    <select
                      value={form.asset_type}
                      onChange={(e) => setForm((f) => ({ ...f, asset_type: e.target.value }))}
                      className="w-full px-4 py-2 bg-dark-bg border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary-500"
                    >
                      <option value="commercial_office">Commercial Office</option>
                      <option value="commercial_retail">Commercial Retail</option>
                      <option value="industrial">Industrial</option>
                      <option value="residential_multi">Residential Multi</option>
                      <option value="logistics">Logistics</option>
                      <option value="data_center">Data Center</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={form.latitude}
                      onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                      className="w-full px-4 py-2 bg-dark-bg border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary-500"
                      placeholder="52.52"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-white">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={form.longitude}
                      onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                      className="w-full px-4 py-2 bg-dark-bg border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary-500"
                      placeholder="13.405"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-white">Valuation (EUR)</label>
                  <input
                    type="number"
                    min={0}
                    step="1000"
                    value={form.current_valuation}
                    onChange={(e) => setForm((f) => ({ ...f, current_valuation: e.target.value }))}
                    className="w-full px-4 py-2 bg-dark-bg border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary-500"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2 text-white">Description</label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full px-4 py-2 bg-dark-bg border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary-500 resize-none"
                    placeholder="Optional"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => {
                      setShowAddModal(false)
                      resetForm()
                    }}
                    className="flex-1 px-4 py-2 bg-dark-bg border border-white/10 text-white rounded-xl font-medium hover:bg-white/5 transition-colors cursor-pointer"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={createMutation.isPending || !form.name.trim()}
                    onClick={() => {
                      if (!form.name.trim()) {
                        alert('Asset name is required')
                        return
                      }
                      const lat = form.latitude ? parseFloat(form.latitude) : undefined
                      const lon = form.longitude ? parseFloat(form.longitude) : undefined
                      const val = form.current_valuation ? parseFloat(form.current_valuation) : undefined
                      createMutation.mutate({
                        name: form.name.trim(),
                        city: form.city.trim() || undefined,
                        country_code: form.country_code.trim() || 'DE',
                        asset_type: form.asset_type,
                        latitude: isNaN(lat!) ? undefined : lat,
                        longitude: isNaN(lon!) ? undefined : lon,
                        current_valuation: isNaN(val!) ? undefined : val,
                        description: form.description.trim() || undefined,
                      })
                    }}
                    className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {createMutation.isPending ? 'Creating...' : 'Create Asset'}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>,
      document.body
    )
  }

  if (isLoading) {
    return (
      <>
        <div className="h-full flex items-center justify-center">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500 animate-pulse" />
            <p className="text-dark-muted">Loading assets...</p>
          </div>
        </div>
        {renderModal()}
      </>
    )
  }

  if (error) {
    return (
      <>
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
        {renderModal()}
      </>
    )
  }

  if (filteredAssets.length === 0 && !search) {
    return (
      <>
        <div className="h-full overflow-auto p-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-display font-bold">Assets</h1>
              <p className="text-dark-muted mt-1">
                Manage your physical assets and their Digital Twins
              </p>
            </div>
            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleBulkImport}
                disabled={bulkImportMutation.isPending}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white rounded-xl font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-600 transition-colors"
              >
                <ArrowUpTrayIcon className="w-5 h-5" />
                {bulkImportMutation.isPending ? 'Importing...' : 'Bulk Import'}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleDownloadTemplate}
                className="flex items-center gap-2 px-5 py-2.5 bg-dark-card border border-primary-500/30 text-white rounded-xl font-medium text-sm hover:bg-primary-500/10 hover:border-primary-500/50 transition-colors"
              >
                <ArrowDownTrayIcon className="w-5 h-5" />
                Download Template
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={(e) => handleAddAsset(e)}
                className="flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white rounded-xl font-medium text-sm hover:bg-primary-600 transition-colors cursor-pointer"
              >
                <PlusIcon className="w-5 h-5" />
                Add Asset
              </motion.button>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            className="hidden"
          />
          <EmptyState
            icon={BuildingOffice2Icon}
            title="No assets yet"
            description="Get started by adding your first physical asset. Upload a BIM file to create a Digital Twin."
            action={{
              label: "Add Your First Asset",
              onClick: handleAddAsset,
            }}
          />
        </div>
        {renderModal()}
      </>
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
        <div className="flex gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleBulkImport}
            disabled={bulkImportMutation.isPending}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white rounded-xl font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary-600 transition-colors"
          >
            <ArrowUpTrayIcon className="w-5 h-5" />
            {bulkImportMutation.isPending ? 'Importing...' : 'Bulk Import'}
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleDownloadTemplate}
            className="flex items-center gap-2 px-5 py-2.5 bg-dark-card border border-primary-500/30 text-white rounded-xl font-medium text-sm hover:bg-primary-500/10 hover:border-primary-500/50 transition-colors"
          >
            <ArrowDownTrayIcon className="w-5 h-5" />
            Download Template
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
              onClick={(e) => handleAddAsset(e)}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary-500 text-white rounded-xl font-medium text-sm hover:bg-primary-600 transition-colors cursor-pointer"
          >
            <PlusIcon className="w-5 h-5" />
            Add Asset
          </motion.button>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleFileChange}
        className="hidden"
      />

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

      {/* Asset List - Use VirtualList for large lists */}
      {filteredAssets.length > 50 ? (
        <VirtualList
          items={filteredAssets}
          containerHeight="calc(100vh - 300px)"
          estimatedItemHeight={280}
          getItemKey={(asset) => asset.id}
          emptyState={
            <EmptyState
              icon={BuildingOffice2Icon}
              title="No assets found"
              description="Try adjusting your search or filters"
            />
          }
          renderItem={(asset) => (
            <Link
              to={`/assets/${asset.id}`}
              className="block glass rounded-2xl p-6 hover:glow-primary transition-all group mb-6"
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
                  <p className="text-lg font-semibold">{formatCurrency(asset.current_valuation || 0)}</p>
                </div>
                <div>
                  <p className="text-xs text-dark-muted">Area</p>
                  <p className="text-lg font-semibold">{((asset.gross_floor_area_m2 || 0) / 1000).toFixed(1)}K m²</p>
                </div>
              </div>

              {/* Risk Scores */}
              <div className="flex gap-4">
                <div className="flex-1 text-center p-2 bg-dark-bg rounded-lg">
                  <p className="text-xs text-dark-muted">Climate</p>
                  <p className={`font-semibold ${getRiskColor(asset.climate_risk_score || 0)}`}>
                    {asset.climate_risk_score || 0}
                  </p>
                </div>
                <div className="flex-1 text-center p-2 bg-dark-bg rounded-lg">
                  <p className="text-xs text-dark-muted">Physical</p>
                  <p className={`font-semibold ${getRiskColor(asset.physical_risk_score || 0)}`}>
                    {asset.physical_risk_score || 0}
                  </p>
                </div>
                <div className="flex-1 text-center p-2 bg-dark-bg rounded-lg">
                  <p className="text-xs text-dark-muted">Network</p>
                  <p className={`font-semibold ${getRiskColor(asset.network_risk_score || 0)}`}>
                    {asset.network_risk_score || 0}
                  </p>
                </div>
              </div>
            </Link>
          )}
        />
      ) : (
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
                    <p className="text-lg font-semibold">{formatCurrency(asset.current_valuation || 0)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-dark-muted">Area</p>
                    <p className="text-lg font-semibold">{((asset.gross_floor_area_m2 || 0) / 1000).toFixed(1)}K m²</p>
                  </div>
                </div>

                {/* Risk Scores */}
                <div className="flex gap-4">
                  <div className="flex-1 text-center p-2 bg-dark-bg rounded-lg">
                    <p className="text-xs text-dark-muted">Climate</p>
                    <p className={`font-semibold ${getRiskColor(asset.climate_risk_score || 0)}`}>
                      {asset.climate_risk_score || 0}
                    </p>
                  </div>
                  <div className="flex-1 text-center p-2 bg-dark-bg rounded-lg">
                    <p className="text-xs text-dark-muted">Physical</p>
                    <p className={`font-semibold ${getRiskColor(asset.physical_risk_score || 0)}`}>
                      {asset.physical_risk_score || 0}
                    </p>
                  </div>
                  <div className="flex-1 text-center p-2 bg-dark-bg rounded-lg">
                    <p className="text-xs text-dark-muted">Network</p>
                    <p className={`font-semibold ${getRiskColor(asset.network_risk_score || 0)}`}>
                      {asset.network_risk_score || 0}
                    </p>
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      )}

      {/* Add Asset Modal - Rendered via Portal to document.body */}
      {renderModal()}
      
      {/* Alternative: Direct render (for debugging) - uncomment if Portal doesn't work */}
      {showAddModal && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          style={{ 
            position: 'fixed', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0,
            zIndex: 9999
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowAddModal(false)
            }
          }}
        >
          <div
            className="bg-dark-card rounded-2xl p-6 w-full max-w-md border border-white/10 mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-display font-bold text-white">Add New Asset (Direct Render)</h2>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-dark-muted hover:text-white transition-colors cursor-pointer"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2 text-white">Asset Name</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-dark-bg border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary-500"
                  placeholder="Enter asset name"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2 text-white">City</label>
                <input
                  type="text"
                  className="w-full px-4 py-2 bg-dark-bg border border-white/10 rounded-xl text-white focus:outline-none focus:border-primary-500"
                  placeholder="Enter city"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-4 py-2 bg-dark-bg border border-white/10 text-white rounded-xl font-medium hover:bg-white/5 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    alert('Asset creation will be implemented')
                    setShowAddModal(false)
                  }}
                  className="flex-1 px-4 py-2 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition-colors cursor-pointer"
                >
                  Create Asset
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
