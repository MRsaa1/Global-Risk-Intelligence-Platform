/**
 * Assets — Manage physical assets and Digital Twins; 3D view and stress testing.
 * Unified Corporate Style: zinc palette, section labels font-mono text-[10px]
 * uppercase tracking-widest text-zinc-500, rounded-md only, no glass/blur. See Implementation Audit.
 */
import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  PlusIcon,
  MagnifyingGlassIcon,
  BuildingOffice2Icon,
  ArrowUpTrayIcon,
  ArrowDownTrayIcon,
  InformationCircleIcon,
} from '@heroicons/react/24/outline'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { assetsApi, seedApi, FinancialProductType } from '../lib/api'
import { authService } from '../lib/auth'
import EmptyState from '../components/EmptyState'
import { VirtualList } from '../components/VirtualList'

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
  const [countryCode, setCountryCode] = useState<string>('')
  const [city, setCity] = useState<string>('')
  const [assetType, setAssetType] = useState<string>('')
  const [financialProduct, setFinancialProduct] = useState<FinancialProductType | ''>('')
  const [showAddModal, setShowAddModal] = useState(false)
  const [showDataSourcesModal, setShowDataSourcesModal] = useState(false)
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


  // Fetch filter options for Country, City, Type dropdowns
  const { data: filterOptions } = useQuery({
    queryKey: ['assets-filter-options'],
    queryFn: () => assetsApi.getFilterOptions(),
    staleTime: 60_000,
  })

  // Fetch assets from API (with country, city, type filters)
  const { data, isLoading, error } = useQuery({
    queryKey: ['assets', search, countryCode, city, assetType, financialProduct],
    queryFn: () =>
      assetsApi.list({
        search: search || undefined,
        page: 1,
        page_size: 100,
        country_code: countryCode || undefined,
        city: city || undefined,
        asset_type: assetType || undefined,
        financial_product: financialProduct || undefined,
      }),
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

  // Seed demo data (dev; requires admin)
  const seedMutation = useMutation({
    mutationFn: () => seedApi.run(authService.getToken()),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      queryClient.invalidateQueries({ queryKey: ['assets-filter-options'] })
      const msg = data?.message || `Demo base loaded: ${data?.assets_created ?? 100}+ assets. Open any asset for 3D view and stress testing.`
      alert(msg)
    },
    onError: (err: any) => {
      alert(err?.response?.data?.detail || err?.message || 'Seed failed. Ensure you are logged in as admin and API is in non-production.')
    },
  })

  // Refresh 3D models for existing twins (by asset type) — no re-seed
  const refreshTwinModelsMutation = useMutation({
    mutationFn: () => seedApi.refreshTwinModels(),
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ['assets'] })
      const msg = data?.message || `Updated ${data?.updated ?? 0} digital twin(s) with building models. Open any asset to see the 3D view.`
      alert(msg)
    },
    onError: (err: any) => {
      alert(err?.response?.data?.detail || err?.message || 'Refresh failed.')
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
    financialProduct ? asset.financial_product === financialProduct : true
  )

  // Data sources modal - where to get data for Assets and Digital Twins (NVIDIA, Cesium 3D)
  const renderDataSourcesModal = () => {
    if (!mounted || typeof document === 'undefined' || !document.body || !showDataSourcesModal) return null
    return createPortal(
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
        onClick={() => setShowDataSourcesModal(false)}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-zinc-900 rounded-md border border-zinc-800 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        >
          <div className="flex items-center justify-between p-6 border-b border-zinc-800 flex-shrink-0">
            <h2 className="text-xl font-display font-semibold text-zinc-100">Data sources for Assets & Digital Twins</h2>
            <button
              onClick={() => setShowDataSourcesModal(false)}
              className="text-zinc-500 hover:text-zinc-100 transition-colors cursor-pointer p-1"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-6 overflow-y-auto space-y-5 text-sm font-sans">
            <section>
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Quick start</h3>
              <ul className="text-zinc-500 space-y-1 list-disc list-inside">
                <li><strong className="text-zinc-100">Demo data:</strong> &quot;Load demo data&quot; on Assets (dev) or <code className="text-zinc-400">POST /api/v1/seed/seed</code></li>
                <li><strong className="text-zinc-100">CSV template:</strong> &quot;Download Template&quot; or <code className="text-zinc-400">GET /api/v1/bulk/assets/template</code></li>
                <li><strong className="text-zinc-100">Bulk import:</strong> &quot;Bulk Import&quot; → select CSV (UTF-8, up to 1000 rows, max 10 MB)</li>
              </ul>
            </section>
            <section>
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Important CSV columns</h3>
              <p className="text-zinc-500 mb-2">Required: <code className="text-zinc-400 font-mono text-xs">name</code>. For 3D & Digital Twins: <code className="text-zinc-400 font-mono text-xs">latitude</code>, <code className="text-zinc-400 font-mono text-xs">longitude</code>, <code className="text-zinc-400 font-mono text-xs">city</code>, <code className="text-zinc-400 font-mono text-xs">country_code</code>. Recommended: <code className="text-zinc-400 font-mono text-xs">asset_type</code>, <code className="text-zinc-400 font-mono text-xs">valuation</code>, <code className="text-zinc-400 font-mono text-xs">gross_floor_area_m2</code>, <code className="text-zinc-400 font-mono text-xs">year_built</code>.</p>
            </section>
            <section>
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Where to get data</h3>
              <p className="text-zinc-500 mb-2"><strong className="text-zinc-100">Open:</strong> OpenAddresses, OpenStreetMap, cadastral/geoportals, Urban Atlas (EU). <strong className="text-zinc-100">Commercial:</strong> CoStar, JLL, CBRE, Vexcel, Nearmap. <strong className="text-zinc-100">Your own:</strong> ERP, CMMS, BIM (IFC) via <code className="text-zinc-400 font-mono text-xs">POST /assets/&#123;id&#125;/upload-bim</code>.</p>
            </section>
            <section>
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Premium 3D cities (Cesium)</h3>
              <p className="text-zinc-500">New York, Sydney, San Francisco, Boston, Denver, Melbourne, Washington DC. Use exact <code className="text-zinc-400 font-mono text-xs">city</code> names for photogrammetry 3D; other cities use OSM Buildings with <code className="text-zinc-400 font-mono text-xs">latitude</code>/<code className="text-zinc-400 font-mono text-xs">longitude</code>.</p>
            </section>
            <section>
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">NVIDIA (Earth-2, Physics NeMo, LLM)</h3>
              <p className="text-zinc-500">Need: <code className="text-zinc-400 font-mono text-xs">latitude</code>, <code className="text-zinc-400 font-mono text-xs">longitude</code>, <code className="text-zinc-400 font-mono text-xs">city</code>, <code className="text-zinc-400 font-mono text-xs">gross_floor_area_m2</code> or <code className="text-zinc-400 font-mono text-xs">valuation</code>, <code className="text-zinc-400 font-mono text-xs">asset_type</code>, <code className="text-zinc-400 font-mono text-xs">year_built</code>.</p>
            </section>
            <p className="text-zinc-500 pt-2 border-t border-zinc-800">
              <strong className="text-zinc-400">Full guide:</strong> <code className="text-zinc-400">ASSET_DATA_SOURCES.md</code> in project root.
            </p>
          </div>
        </motion.div>
      </motion.div>,
      document.body
    )
  }

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
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
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
              className="bg-zinc-900 rounded-md p-6 w-full max-w-md border border-zinc-800 mx-4 shadow-2xl"
              style={{ position: 'relative', zIndex: 10000, display: 'block' }}
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-display font-semibold text-zinc-100">Add New Asset</h2>
                <button
                  onClick={() => { setShowAddModal(false); resetForm() }}
                  className="text-zinc-500 hover:text-zinc-100 transition-colors cursor-pointer"
                  aria-label="Close modal"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-4 font-sans">
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Asset Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 focus:outline-none focus:border-zinc-600"
                    placeholder="Enter asset name"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">City</label>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 focus:outline-none focus:border-zinc-600"
                    placeholder="Enter city"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Country</label>
                    <input
                      type="text"
                      maxLength={2}
                      value={form.country_code}
                      onChange={(e) => setForm((f) => ({ ...f, country_code: e.target.value.toUpperCase().slice(0, 2) }))}
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 focus:outline-none focus:border-zinc-600"
                      placeholder="DE"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Type</label>
                    <select
                      value={form.asset_type}
                      onChange={(e) => setForm((f) => ({ ...f, asset_type: e.target.value }))}
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 focus:outline-none focus:border-zinc-600"
                    >
                      <option value="commercial_office" className="bg-zinc-900">Commercial Office</option>
                      <option value="commercial_retail" className="bg-zinc-900">Commercial Retail</option>
                      <option value="industrial" className="bg-zinc-900">Industrial</option>
                      <option value="residential_multi" className="bg-zinc-900">Residential Multi</option>
                      <option value="logistics" className="bg-zinc-900">Logistics</option>
                      <option value="data_center" className="bg-zinc-900">Data Center</option>
                      <option value="other" className="bg-zinc-900">Other</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Latitude</label>
                    <input
                      type="number"
                      step="any"
                      value={form.latitude}
                      onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value }))}
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 focus:outline-none focus:border-zinc-600"
                      placeholder="52.52"
                    />
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Longitude</label>
                    <input
                      type="number"
                      step="any"
                      value={form.longitude}
                      onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value }))}
                      className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 focus:outline-none focus:border-zinc-600"
                      placeholder="13.405"
                    />
                  </div>
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Valuation (EUR)</label>
                  <input
                    type="number"
                    min={0}
                    step="1000"
                    value={form.current_valuation}
                    onChange={(e) => setForm((f) => ({ ...f, current_valuation: e.target.value }))}
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 focus:outline-none focus:border-zinc-600"
                    placeholder="Optional"
                  />
                </div>
                <div>
                  <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Description</label>
                  <textarea
                    rows={2}
                    value={form.description}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                    className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 focus:outline-none focus:border-zinc-600 resize-none"
                    placeholder="Optional"
                  />
                </div>
                <div className="flex gap-3 pt-4">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => { setShowAddModal(false); resetForm() }}
                    className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md font-medium hover:bg-zinc-700 transition-colors cursor-pointer"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={createMutation.isPending || !form.name.trim()}
                    onClick={() => {
                      if (!form.name.trim()) { alert('Asset name is required'); return }
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
                    className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md font-medium hover:bg-zinc-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
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
        <div className="min-h-full p-6 bg-zinc-950 flex items-center justify-center">
          <div className="w-full max-w-[1920px] mx-auto text-center">
            <div className="h-1 rounded-full bg-zinc-700 overflow-hidden mb-4 w-48 mx-auto">
              <div className="h-full w-1/3 bg-zinc-500 animate-pulse" />
            </div>
            <p className="text-zinc-500 font-sans">Loading assets...</p>
          </div>
        </div>
        {renderModal()}
        {renderDataSourcesModal()}
      </>
    )
  }

  if (error) {
    return (
      <>
        <div className="min-h-full p-6 bg-zinc-950 flex items-center justify-center">
          <div className="w-full max-w-[1920px] mx-auto text-center">
            <p className="text-red-400/80 mb-4 font-sans">Failed to load assets</p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 font-sans hover:bg-zinc-700"
            >
              Retry
            </button>
          </div>
        </div>
        {renderModal()}
        {renderDataSourcesModal()}
      </>
    )
  }

  if (filteredAssets.length === 0 && !search) {
    return (
      <>
        <div className="min-h-full p-6 bg-zinc-950 pb-16">
          <div className="w-full max-w-[1920px] mx-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-zinc-800 rounded-md border border-zinc-700">
                  <BuildingOffice2Icon className="w-8 h-8 text-zinc-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-display font-semibold text-zinc-100">Assets</h1>
                  <p className="text-zinc-500 text-sm mt-1 font-sans flex items-center gap-2 flex-wrap">
                    Manage your physical assets and their Digital Twins
                    <button type="button" onClick={() => setShowDataSourcesModal(true)} className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-400 transition-colors font-mono text-[10px] uppercase tracking-wider" title="Where to get data for Assets and Digital Twins (NVIDIA, Cesium 3D)">
                      <InformationCircleIcon className="w-4 h-4 flex-shrink-0" />
                      Data sources
                    </button>
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleBulkImport} disabled={bulkImportMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md font-medium text-sm font-sans disabled:opacity-50 hover:bg-zinc-700">
                  <ArrowUpTrayIcon className="w-5 h-5" />
                  {bulkImportMutation.isPending ? 'Importing...' : 'Bulk Import'}
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleDownloadTemplate}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md font-medium text-sm font-sans hover:bg-zinc-700">
                  <ArrowDownTrayIcon className="w-5 h-5" />
                  Download Template
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md font-medium text-sm font-sans hover:bg-zinc-700 disabled:opacity-50">
                  {seedMutation.isPending ? 'Loading...' : 'Load demo data'}
                </motion.button>
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={(e) => handleAddAsset(e)}
                  className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md font-medium text-sm font-sans hover:bg-zinc-700 cursor-pointer">
                  <PlusIcon className="w-5 h-5" />
                  Add Asset
                </motion.button>
              </div>
            </div>
            <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileChange} className="hidden" />
            <EmptyState
              icon={BuildingOffice2Icon}
              title="No assets yet"
              description="Load demo data (button above) to add 100+ sample buildings (Munich, Berlin, Madrid, New York, etc.), then open any asset for real 3D view and stress testing. Or add manually, Bulk Import, or use Data sources for CSV."
              action={{ label: "Add Your First Asset", onClick: handleAddAsset }}
            />
          </div>
        </div>
        {renderModal()}
        {renderDataSourcesModal()}
      </>
    )
  }

  return (
    <div className="min-h-full p-6 bg-zinc-950 pb-16">
      <div className="w-full max-w-[1920px] mx-auto">
        {/* Header — Unified Corporate Style */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-zinc-800 rounded-md border border-zinc-700">
              <BuildingOffice2Icon className="w-8 h-8 text-zinc-400" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-semibold text-zinc-100">Assets</h1>
              <p className="text-zinc-500 text-sm mt-1 font-sans flex items-center gap-2 flex-wrap">
                Manage your physical assets and their Digital Twins. Open any asset for 3D view and stress testing.
                <button type="button" onClick={() => setShowDataSourcesModal(true)} className="inline-flex items-center gap-1.5 text-zinc-500 hover:text-zinc-400 transition-colors font-mono text-[10px] uppercase tracking-wider" title="Where to get data for Assets and Digital Twins (NVIDIA, Cesium 3D)">
                  <InformationCircleIcon className="w-4 h-4 flex-shrink-0" />
                  Data sources
                </button>
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleBulkImport}
              disabled={bulkImportMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md font-medium text-sm font-sans disabled:opacity-50 disabled:cursor-not-allowed hover:bg-zinc-700 transition-colors"
            >
              <ArrowUpTrayIcon className="w-5 h-5" />
              {bulkImportMutation.isPending ? 'Importing...' : 'Bulk Import'}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleDownloadTemplate}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md font-medium text-sm font-sans hover:bg-zinc-700 transition-colors"
            >
              <ArrowDownTrayIcon className="w-5 h-5" />
              Download Template
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => seedMutation.mutate()}
              disabled={seedMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md font-medium text-sm font-sans hover:bg-zinc-700 transition-colors disabled:opacity-50"
              title="Add 100+ sample buildings (Munich, Berlin, Madrid, NY…) for 3D view and stress testing"
            >
              {seedMutation.isPending ? 'Loading...' : 'Load demo data'}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => refreshTwinModelsMutation.mutate()}
              disabled={refreshTwinModelsMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md font-medium text-sm font-sans hover:bg-zinc-700 transition-colors disabled:opacity-50"
              title="Update existing Digital Twins with new 3D building models (no re-seed)"
            >
              {refreshTwinModelsMutation.isPending ? 'Updating...' : 'Refresh 3D models'}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={(e) => handleAddAsset(e)}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md font-medium text-sm font-sans hover:bg-zinc-700 transition-colors cursor-pointer"
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

        {/* Filters — corp: bg-zinc-900, section labels */}
        <div className="rounded-md p-4 border border-zinc-800 bg-zinc-900 mb-6 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input
              type="text"
              placeholder="Search assets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 font-sans"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Country:</span>
            <select
              value={countryCode}
              onChange={(e) => setCountryCode(e.target.value)}
              className="px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm font-sans min-w-[140px] focus:outline-none focus:border-zinc-600"
              aria-label="Filter by country"
            >
              <option value="">All countries</option>
              {(filterOptions?.countries ?? []).map((c) => (
                <option key={c} value={c} className="bg-zinc-900">{c}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">City:</span>
            <select
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm font-sans min-w-[140px] focus:outline-none focus:border-zinc-600"
              aria-label="Filter by city"
            >
              <option value="">All cities</option>
              {(filterOptions?.cities ?? []).map((c) => (
                <option key={c} value={c} className="bg-zinc-900">{c}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Type:</span>
            <select
              value={assetType}
              onChange={(e) => setAssetType(e.target.value)}
              className="px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm font-sans min-w-[160px] focus:outline-none focus:border-zinc-600"
              aria-label="Filter by asset type"
            >
              <option value="">All types</option>
              {(filterOptions?.asset_types ?? []).map((t) => (
                <option key={t} value={t} className="bg-zinc-900">{t.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Product:</span>
            <select
              value={financialProduct}
              onChange={(e) => setFinancialProduct(e.target.value as FinancialProductType | '')}
              className="px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm font-sans min-w-[140px] focus:outline-none focus:border-zinc-600"
              aria-label="Filter by financial product"
            >
              <option value="">All products</option>
              <option value="mortgage" className="bg-zinc-900">Mortgage</option>
              <option value="property_insurance" className="bg-zinc-900">Property insurance</option>
              <option value="project_finance" className="bg-zinc-900">Project finance</option>
              <option value="infra_bond" className="bg-zinc-900">Infra bond</option>
              <option value="credit_facility" className="bg-zinc-900">Credit facility</option>
              <option value="lease" className="bg-zinc-900">Lease</option>
              <option value="other" className="bg-zinc-900">Other</option>
            </select>
          </div>
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
              className="block rounded-md p-6 border border-zinc-700 bg-zinc-900 hover:border-zinc-600 transition-all group mb-6"
            >
              <div className="flex items-start gap-4 mb-4">
                <div className="p-3 bg-zinc-800 rounded-md border border-zinc-700">
                  <BuildingOffice2Icon className="w-6 h-6 text-zinc-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-semibold text-zinc-100 truncate group-hover:text-zinc-300 transition-colors">
                    {asset.name}
                  </h3>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 mt-0.5">
                    {asset.city}, {asset.country_code}
                  </p>
                </div>
              </div>
              <div className="mb-4">
                <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{asset.pars_id}</p>
              </div>
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Valuation</p>
                  <p className="text-lg font-semibold font-mono tabular-nums text-zinc-100 mt-0.5">{formatCurrency(asset.current_valuation || 0)}</p>
                </div>
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Area</p>
                  <p className="text-lg font-semibold font-mono tabular-nums text-zinc-100 mt-0.5">{((asset.gross_floor_area_m2 || 0) / 1000).toFixed(1)}K m²</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="flex-1 text-center p-2 bg-zinc-800 border border-zinc-700/60 rounded-md">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Climate</p>
                  <p className={`font-semibold font-mono mt-0.5 ${getRiskColor(asset.climate_risk_score || 0)}`}>
                    {asset.climate_risk_score || 0}
                  </p>
                </div>
                <div className="flex-1 text-center p-2 bg-zinc-800 border border-zinc-700/60 rounded-md">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Physical</p>
                  <p className={`font-semibold font-mono mt-0.5 ${getRiskColor(asset.physical_risk_score || 0)}`}>
                    {asset.physical_risk_score || 0}
                  </p>
                </div>
                <div className="flex-1 text-center p-2 bg-zinc-800 border border-zinc-700/60 rounded-md">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Network</p>
                  <p className={`font-semibold font-mono mt-0.5 ${getRiskColor(asset.network_risk_score || 0)}`}>
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
              transition={{ delay: index * 0.05 }}
            >
              <Link
                to={`/assets/${asset.id}`}
                className="block rounded-md p-6 border border-zinc-700 bg-zinc-900 hover:border-zinc-600 transition-all group"
              >
                <div className="flex items-start gap-4 mb-4">
                  <div className="p-3 bg-zinc-800 rounded-md border border-zinc-700">
                    <BuildingOffice2Icon className="w-6 h-6 text-zinc-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-display font-semibold text-zinc-100 truncate group-hover:text-zinc-300 transition-colors">
                      {asset.name}
                    </h3>
                    <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 mt-0.5">
                      {asset.city}, {asset.country_code}
                    </p>
                  </div>
                </div>
                <div className="mb-4">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{asset.pars_id}</p>
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Valuation</p>
                    <p className="text-lg font-semibold font-mono tabular-nums text-zinc-100 mt-0.5">{formatCurrency(asset.current_valuation || 0)}</p>
                  </div>
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Area</p>
                    <p className="text-lg font-semibold font-mono tabular-nums text-zinc-100 mt-0.5">{((asset.gross_floor_area_m2 || 0) / 1000).toFixed(1)}K m²</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex-1 text-center p-2 bg-zinc-800 border border-zinc-700/60 rounded-md">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Climate</p>
                    <p className={`font-semibold font-mono mt-0.5 ${getRiskColor(asset.climate_risk_score || 0)}`}>
                      {asset.climate_risk_score || 0}
                    </p>
                  </div>
                  <div className="flex-1 text-center p-2 bg-zinc-800 border border-zinc-700/60 rounded-md">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Physical</p>
                    <p className={`font-semibold font-mono mt-0.5 ${getRiskColor(asset.physical_risk_score || 0)}`}>
                      {asset.physical_risk_score || 0}
                    </p>
                  </div>
                  <div className="flex-1 text-center p-2 bg-zinc-800 border border-zinc-700/60 rounded-md">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Network</p>
                    <p className={`font-semibold font-mono mt-0.5 ${getRiskColor(asset.network_risk_score || 0)}`}>
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
        {renderDataSourcesModal()}

        {/* Alternative: Direct render (for debugging) */}
        {showAddModal && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
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
            className="bg-zinc-900 rounded-md p-6 w-full max-w-md border border-zinc-800 mx-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-display font-semibold text-zinc-100">Add New Asset (Direct Render)</h2>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-500 hover:text-zinc-100 transition-colors cursor-pointer">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="space-y-4 font-sans">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Asset Name</label>
                <input type="text" className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 focus:outline-none focus:border-zinc-600" placeholder="Enter asset name" />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">City</label>
                <input type="text" className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 focus:outline-none focus:border-zinc-600" placeholder="Enter city" />
              </div>
              <div className="flex gap-3 pt-4">
                <button onClick={() => setShowAddModal(false)} className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md font-medium hover:bg-zinc-700 cursor-pointer">Cancel</button>
                <button onClick={() => { alert('Asset creation will be implemented'); setShowAddModal(false) }} className="flex-1 px-4 py-2 bg-zinc-800 border border-zinc-700 text-zinc-100 rounded-md font-medium hover:bg-zinc-700 cursor-pointer">Create Asset</button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
