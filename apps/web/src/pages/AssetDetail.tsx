import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeftIcon,
  CubeTransparentIcon,
  ClockIcon,
  ShieldCheckIcon,
  CurrencyDollarIcon,
  ShieldExclamationIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  Square3Stack3DIcon,
  BeakerIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { assetsApi, bimApi, insuranceApi, creditApi, seedApi, stressTestsApi, twinAssetsApi, twinsApi } from '../lib/api'
import type { QuickStressTestResult, StressScenarioItem } from '../lib/api'
import Viewer3D from '../components/Viewer3D'
import BIMViewer from '../components/BIMViewer'
import XeokitBIMViewer from '../components/XeokitBIMViewer'

export default function AssetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [viewMode, setViewMode] = useState<'3d' | 'bim' | 'xkt'>('3d')
  const [isModelPickerOpen, setIsModelPickerOpen] = useState(false)
  const [isStressTestPanelOpen, setIsStressTestPanelOpen] = useState(false)
  const [modelSearch, setModelSearch] = useState('')
  const [libraryCategory, setLibraryCategory] = useState<string>('')
  const [convertingItemId, setConvertingItemId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  // Fetch asset data
  const { data: asset, isLoading } = useQuery({
    queryKey: ['asset', id],
    queryFn: () => assetsApi.get(id!),
    enabled: !!id,
  })

  // Fetch BIM metadata when in BIM view (optional; API returns fallback if no BIM)
  const { data: bimMeta } = useQuery({
    queryKey: ['bim-metadata', id],
    queryFn: () => bimApi.getMetadata(id!),
    enabled: !!id && viewMode === 'bim',
  })

  // Fetch Insurance Quote
  const { data: insuranceQuote } = useQuery({
    queryKey: ['insurance-quote', id],
    queryFn: () => insuranceApi.getQuote({
      asset_id: id!,
      sum_insured: asset?.current_valuation || 10000000,
      coverage_type: 'property',
    }),
    enabled: !!id && !!asset,
  })

  // Fetch Credit Risk Profile
  const { data: creditProfile } = useQuery({
    queryKey: ['credit-profile', id],
    queryFn: () => creditApi.getRiskProfile({
      asset_id: id!,
      product: 'credit_facility',
      tenure_years: 10,
    }),
    enabled: !!id && !!asset,
  })

  // Phase 1.4: Degradation Forecast
  const { data: degradation } = useQuery({
    queryKey: ['asset-degradation', id],
    queryFn: () => assetsApi.getDegradation(id!, { horizon_years: 10, maintenance_quality: 'average' }),
    enabled: !!id && !!asset,
    staleTime: 30_000,
  })

  // Phase 2.3: Operational Risk (type-specific)
  const { data: operationalRisk } = useQuery({
    queryKey: ['operational-risk', id],
    queryFn: () => assetsApi.getOperationalRisk(id!),
    enabled: !!id && !!asset,
    staleTime: 30_000,
  })

  // Phase 2.4-2.5: Downtime Forecast
  const { data: downtimeForecast } = useQuery({
    queryKey: ['downtime-forecast', id],
    queryFn: () => assetsApi.getDowntimeForecast(id!, { horizon_years: 1 }),
    enabled: !!id && !!asset,
    staleTime: 30_000,
  })

  // Digital Twin geometry (GLB URL for web)
  const { data: geometry } = useQuery({
    queryKey: ['twin-geometry-url', id],
    queryFn: () => twinsApi.getGeometryUrl(id!),
    enabled: !!id,
    retry: false,
    staleTime: 30_000,
  })

  const modelUrl = geometry?.url || undefined

  const { data: libraryItems, isLoading: isLibraryLoading } = useQuery({
    queryKey: ['twin-asset-library', modelSearch, libraryCategory],
    queryFn: () => twinAssetsApi.list({ q: modelSearch || undefined, category: libraryCategory || undefined, limit: 50 }),
    enabled: isModelPickerOpen,
    staleTime: 10_000,
    refetchInterval: (query) => {
      if (!isModelPickerOpen) return false
      const data = query.state.data as any[] | undefined
      const hasInFlight =
        convertingItemId != null ||
        (Array.isArray(data) &&
          data.some((it: any) => !it?.glb_object && it?.extra_metadata?.conversion?.task_id))
      return hasInFlight ? 2000 : false
    },
  })

  const convertMutation = useMutation({
    onMutate: async (itemId: string) => {
      setConvertingItemId(itemId)
    },
    mutationFn: async (itemId: string) => {
      // enterprise path: queue Celery conversion
      return await twinAssetsApi.convertAsync(itemId, { usd_ext: '.usd', overwrite: false })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['twin-asset-library'] })
    },
    onSettled: () => {
      setConvertingItemId(null)
    },
  })

  const attachMutation = useMutation({
    mutationFn: async (itemId: string) => {
      return await twinAssetsApi.attachToAsset(itemId, { asset_id: id!, prefer: 'glb' })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['twin-geometry-url', id] })
      queryClient.invalidateQueries({ queryKey: ['asset', id] })
      // geometry query will refresh on next open; lightweight: just close
      setIsModelPickerOpen(false)
    },
  })

  // Stress test panel: scenario library + run + result (hooks must be before any early return)
  const { data: scenarioLibrary = [] } = useQuery({
    queryKey: ['stress-scenario-library'],
    queryFn: () => stressTestsApi.getScenarioLibrary(),
    enabled: isStressTestPanelOpen,
    staleTime: 60_000,
  })
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('')
  const [stressTestRunning, setStressTestRunning] = useState(false)
  const [stressTestResult, setStressTestResult] = useState<QuickStressTestResult | null>(null)
  const [stressTestError, setStressTestError] = useState<string | null>(null)

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

  const libraryList = Array.isArray(libraryItems) ? libraryItems : []

  const runStressTestForAsset = async () => {
    if (!asset || !selectedScenarioId) return
    const city = asset.city || asset.address?.split(',')[0]?.trim() || 'Unknown'
    const lat = asset.latitude ?? 0
    const lng = asset.longitude ?? 0
    if (!lat && !lng) {
      setStressTestError('Asset has no location. Add latitude/longitude to run a stress test.')
      return
    }
    setStressTestError(null)
    setStressTestResult(null)
    setStressTestRunning(true)
    try {
      const result = await stressTestsApi.executeQuick({
        city_name: city,
        center_latitude: lat || 50.1,
        center_longitude: lng || 8.7,
        event_id: selectedScenarioId,
        severity: 0.6,
        entity_name: asset.name,
        use_llm: true,
      })
      setStressTestResult(result)
    } catch (e: any) {
      setStressTestError(e?.response?.data?.detail || e?.message || 'Stress test failed')
    } finally {
      setStressTestRunning(false)
    }
  }

  const closeStressTestPanel = () => {
    setIsStressTestPanelOpen(false)
    setSelectedScenarioId('')
    setStressTestResult(null)
    setStressTestError(null)
  }

  return (
    <div className="h-full overflow-auto">
      {/* Stress Test Panel Modal */}
      {isStressTestPanelOpen && asset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-dark-card border border-dark-border rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-dark-border">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <BeakerIcon className="w-5 h-5 text-amber-400" />
                Run Stress Test
              </h2>
              <button
                type="button"
                onClick={closeStressTestPanel}
                className="p-2 rounded-lg text-dark-muted hover:text-white hover:bg-white/10 transition-colors"
                aria-label="Close"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1 space-y-4">
              <p className="text-sm text-dark-muted">
                Select a scenario applicable to this asset, then run the test. Results will show impact and recommendations.
              </p>
              <div>
                <label className="block text-xs font-medium text-dark-muted mb-2">Scenario</label>
                <select
                  value={selectedScenarioId}
                  onChange={(e) => setSelectedScenarioId(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl bg-dark-bg border border-dark-border text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  disabled={stressTestRunning}
                >
                  <option value="">— Select scenario —</option>
                  {(scenarioLibrary as StressScenarioItem[]).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.category})
                    </option>
                  ))}
                </select>
              </div>
              {stressTestError && (
                <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                  {stressTestError}
                </div>
              )}
              {stressTestResult && (
                <div className="space-y-3 rounded-xl bg-white/5 border border-white/10 p-4 text-sm">
                  <div className="flex flex-wrap gap-4">
                    <span className="text-dark-muted">Event:</span>
                    <span className="text-white font-medium">{stressTestResult.event_name}</span>
                    <span className="text-dark-muted">Loss:</span>
                    <span className="text-amber-400 font-mono">
                      {stressTestResult.currency || 'EUR'} {(stressTestResult.total_loss / 1e6).toFixed(2)}M
                    </span>
                    <span className="text-dark-muted">Buildings:</span>
                    <span className="text-white">{stressTestResult.total_buildings_affected}</span>
                  </div>
                  {stressTestResult.executive_summary && (
                    <div>
                      <p className="text-dark-muted text-xs uppercase tracking-wider mb-1">Summary</p>
                      <p className="text-white/90 leading-relaxed">{stressTestResult.executive_summary}</p>
                    </div>
                  )}
                  {stressTestResult.zones?.length > 0 && (
                    <div>
                      <p className="text-dark-muted text-xs uppercase tracking-wider mb-2">Zones</p>
                      <ul className="space-y-1">
                        {stressTestResult.zones.slice(0, 5).map((z, i) => (
                          <li key={i} className="flex justify-between gap-2 text-white/80">
                            <span>{z.label}</span>
                            <span className="text-amber-400/90">{z.risk_level}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-dark-border flex gap-2 justify-end">
              <button
                type="button"
                onClick={closeStressTestPanel}
                className="px-4 py-2 rounded-xl border border-dark-border text-dark-muted hover:text-white hover:bg-white/5 transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={runStressTestForAsset}
                disabled={!selectedScenarioId || stressTestRunning}
                className="px-4 py-2 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {stressTestRunning ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Running…
                  </>
                ) : (
                  <>
                    <BeakerIcon className="w-4 h-4" />
                    Run Stress Test
                  </>
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}

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
              onClick={() => setIsModelPickerOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white/80 hover:text-white hover:border-white/20 hover:bg-white/10 transition-colors"
              title="Select a Digital Twin model from the library"
            >
              <Square3Stack3DIcon className="w-5 h-5" />
              Select Model
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsStressTestPanelOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 transition-colors"
              title="Select a stress test scenario and run it for this asset"
            >
              <BeakerIcon className="w-5 h-5" />
              Run Stress Test
            </motion.button>
          </div>
        </div>
      </div>

      {/* 3D / BIM Viewer — full width, primary visual */}
      <div className="px-8 pb-6">
        <div className="glass rounded-2xl overflow-hidden h-[840px] min-h-[640px] relative flex flex-col">
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
              BIM (IFC)
            </button>
            <button
              onClick={() => setViewMode('xkt')}
              className={`px-3 py-1 rounded-lg text-sm ${
                viewMode === 'xkt'
                  ? 'bg-primary-500 text-white'
                  : 'bg-dark-card text-dark-muted hover:text-white'
              }`}
            >
              BIM (XKT)
            </button>
          </div>
          {/* Caption: real model vs placeholder */}
          {viewMode === '3d' && !modelUrl && (
            <div className="absolute top-4 left-4 z-10 px-3 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-sm max-w-xs">
              Placeholder view. Use <strong>Select Model</strong> above to attach a Digital Twin for a realistic 3D model.
            </div>
          )}
          {viewMode === '3d' && modelUrl && (
            <div className="absolute top-4 left-4 z-10 px-3 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-sm">
              Digital Twin model
            </div>
          )}
          {viewMode === 'xkt' && !(asset as any).xkt_project_id && (
            <div className="absolute top-4 left-4 z-10 px-3 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-sm max-w-xs">
              Demo model (Duplex). Set XKT project for this asset to view the real building.
            </div>
          )}
          <div className="flex-1 min-h-0 relative">
            {viewMode === '3d' ? (
              <Viewer3D
                key={`viewer3d-${asset.id}`}
                modelUrl={modelUrl}
                riskScores={{
                  climate: asset.climate_risk_score || 0,
                  physical: asset.physical_risk_score || 0,
                  network: asset.network_risk_score || 0,
                }}
                showRiskOverlay={!!modelUrl}
                floorsAboveGround={asset.floors_above_ground ?? undefined}
                grossFloorAreaM2={asset.gross_floor_area_m2 ?? undefined}
              />
            ) : viewMode === 'xkt' ? (
              <XeokitBIMViewer
                key={`xeokit-${asset.id}-${(asset as any).xkt_project_id || 'Duplex'}`}
                projectId={(asset as any).xkt_project_id || 'Duplex'}
                onLoad={() => {}}
                onError={(msg) => console.error('Xeokit BIM error:', msg)}
              />
            ) : (
              <BIMViewer
                key={`bim-${asset.id}`}
                assetId={asset.id}
                ifcUrl={asset.bim_file_path ? `/api/v1/assets/${asset.id}/bim` : undefined}
                onBimUploaded={() => queryClient.invalidateQueries({ queryKey: ['asset', id] })}
                onLoad={() => {}}
                onError={(error) => console.error('BIM error:', error)}
              />
            )}
          </div>
        </div>
      </div>

      {/* Info panels — grid across full useful area */}
      <div className="px-8 pb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* Risk Assessment */}
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

        {/* BIM Model Info (when in BIM view) */}
        {viewMode === 'bim' && bimMeta && (
          <div className="glass rounded-2xl p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <CubeTransparentIcon className="w-5 h-5 text-cyan-400" />
              BIM Model Info
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-dark-muted">Project</span>
                <span>{(bimMeta as any).project_name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-muted">Schema</span>
                <span>{(bimMeta as any).ifc_schema || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-muted">Elements</span>
                <span>{(bimMeta as any).element_count?.toLocaleString() ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-muted">Floors</span>
                <span>{(bimMeta as any).floor_count ?? '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-muted">Building</span>
                <span className="truncate max-w-[140px]" title={(bimMeta as any).building_name}>{(bimMeta as any).building_name || '—'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-muted">Site</span>
                <span className="truncate max-w-[140px]" title={(bimMeta as any).site_name}>{(bimMeta as any).site_name || '—'}</span>
              </div>
            </div>
          </div>
        )}

        {/* Asset Details */}
        <div className="glass rounded-2xl p-6">
          <h3 className="font-semibold mb-4">Asset Details</h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-dark-muted">Type</span>
              <span>{(asset as any).asset_type || 'Commercial Office'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark-muted">Location</span>
              <span>{asset.city}, {asset.country_code}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark-muted">Year Built</span>
              <span>{asset.year_built || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-dark-muted">Floors</span>
              <span>{(asset as any).floors_above_ground ?? 'N/A'}</span>
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

        {/* Insurance Quote */}
        {insuranceQuote && (
          <div className="glass rounded-2xl p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <ShieldExclamationIcon className="w-5 h-5 text-blue-400" />
              Insurance Quote
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-dark-muted">Annual Premium</span>
                <span className="font-bold text-lg text-green-400">
                  €{(insuranceQuote.annual_premium || 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-muted">Monthly</span>
                <span>€{(insuranceQuote.monthly_premium || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-muted">Coverage</span>
                <span className="capitalize">{insuranceQuote.coverage_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-muted">Sum Insured</span>
                <span>€{((insuranceQuote.sum_insured || 0) / 1000000).toFixed(1)}M</span>
              </div>
              <div className="pt-2 border-t border-dark-border">
                <div className="flex justify-between text-xs">
                  <span className="text-dark-muted">Base Premium</span>
                  <span>€{(insuranceQuote.base_premium || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-dark-muted">Risk Loading</span>
                  <span className="text-amber-400">+€{(insuranceQuote.risk_loading || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-dark-muted">Deductible Discount</span>
                  <span className="text-green-400">-€{(insuranceQuote.deductible_discount || 0).toLocaleString()}</span>
                </div>
              </div>
              {insuranceQuote.recommendations?.length > 0 && (
                <div className="pt-2 mt-2 border-t border-dark-border">
                  <p className="text-xs text-dark-muted mb-1">Recommendations:</p>
                  {insuranceQuote.recommendations.slice(0, 2).map((rec: string, i: number) => (
                    <p key={i} className="text-xs text-amber-300">• {rec}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Credit Risk Profile */}
        {creditProfile && (
          <div className="glass rounded-2xl p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <CurrencyDollarIcon className="w-5 h-5 text-emerald-400" />
              Credit Risk Profile
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-dark-muted">Credit Limit</span>
                <span className="font-bold text-lg text-emerald-400">
                  €{((creditProfile.credit_limit || 0) / 1000000).toFixed(1)}M</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-dark-muted">Rating</span>
                <span className={`font-bold px-2 py-0.5 rounded text-xs ${
                  ['AAA', 'AA', 'A'].includes(creditProfile.rating) ? 'bg-green-500/20 text-green-400' :
                  ['BBB', 'BB'].includes(creditProfile.rating) ? 'bg-amber-500/20 text-amber-400' :
                  'bg-red-500/20 text-red-400'
                }`}>
                  {creditProfile.rating}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-muted">PD</span>
                <span>{((creditProfile.probability_of_default || 0) * 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-muted">LGD</span>
                <span>{((creditProfile.loss_given_default || 0) * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-muted">Spread</span>
                <span>{creditProfile.spread_bps || 0} bps</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-muted">All-in Rate</span>
                <span>{((creditProfile.all_in_rate || 0) * 100).toFixed(2)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-muted">LTV</span>
                <span>{((creditProfile.ltv || 0) * 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-muted">Collateral Adequacy</span>
                <span className={creditProfile.collateral_adequacy >= 1.2 ? 'text-green-400' : 'text-amber-400'}>
                  {(creditProfile.collateral_adequacy || 0).toFixed(2)}x
                </span>
              </div>
              {creditProfile.recommendations?.length > 0 && (
                <div className="pt-2 mt-2 border-t border-dark-border">
                  <p className="text-xs text-dark-muted mb-1">Recommendations:</p>
                  {creditProfile.recommendations.slice(0, 2).map((rec: string, i: number) => (
                    <p key={i} className="text-xs text-amber-300">• {rec}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Degradation Forecast */}
        {degradation && (
          <div className="glass rounded-2xl p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-amber-400" />
              Degradation Forecast
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-dark-muted">Remaining Useful Life</span>
                <span className="font-bold text-white">{degradation.remaining_useful_life_years.toFixed(1)} yrs</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-dark-muted">Failure Probability (10y)</span>
                <span className={`font-semibold ${degradation.failure_probability > 0.5 ? 'text-red-400' : degradation.failure_probability > 0.25 ? 'text-amber-400' : 'text-green-400'}`}>
                  {(degradation.failure_probability * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-dark-muted">Recommended CAPEX</span>
                <span className="font-semibold text-amber-300">
                  €{Math.round(degradation.recommended_capex).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-dark-muted">Priority</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  degradation.recommended_capex_priority === 'critical' ? 'bg-red-500/20 text-red-300' :
                  degradation.recommended_capex_priority === 'high' ? 'bg-amber-500/20 text-amber-300' :
                  degradation.recommended_capex_priority === 'medium' ? 'bg-primary-500/20 text-primary-300' :
                  'bg-white/10 text-white/70'
                }`}>
                  {degradation.recommended_capex_priority.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Operational Risk */}
        {operationalRisk && (
          <div className="glass rounded-2xl p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <ShieldCheckIcon className="w-5 h-5 text-purple-400" />
              Operational Risk
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-dark-muted">Model</span>
                <span className="capitalize">{(operationalRisk.scoring_model || '').replace('_', ' ')}</span>
              </div>
              {'overall_score' in operationalRisk.result && (
                <div className="flex justify-between items-center">
                  <span className="text-dark-muted">Overall Score</span>
                  <span className={`font-bold ${
                    Number(operationalRisk.result.overall_score) >= 85 ? 'text-green-400' :
                    Number(operationalRisk.result.overall_score) >= 70 ? 'text-amber-400' : 'text-red-400'
                  }`}>
                    {Number(operationalRisk.result.overall_score).toFixed(0)}/100
                  </span>
                </div>
              )}
              {Array.isArray(operationalRisk.result.recommendations) && operationalRisk.result.recommendations.length > 0 && (
                <div className="pt-2 border-t border-dark-border">
                  <p className="text-xs text-dark-muted mb-1">Recommendations:</p>
                  {operationalRisk.result.recommendations.slice(0, 3).map((rec: string, i: number) => (
                    <p key={i} className="text-xs text-amber-300">• {rec}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Downtime Forecast */}
        {downtimeForecast && (
          <div className="glass rounded-2xl p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-400" />
              Downtime Forecast
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-dark-muted">Expected Downtime</span>
                <span className="font-semibold text-white">{downtimeForecast.expected_downtime_hours.toFixed(1)} h/year</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-dark-muted">Worst Case</span>
                <span className="text-amber-300">{downtimeForecast.worst_case_days.toFixed(1)} days</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-dark-muted">Uptime Probability</span>
                <span className="text-green-400">{(downtimeForecast.uptime_probability * 100).toFixed(0)}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-dark-muted">Expected Annual Loss</span>
                <span className="text-red-300">€{Math.round(downtimeForecast.expected_annual_loss).toLocaleString()}</span>
              </div>
              {downtimeForecast.recommendations?.length > 0 && (
                <div className="pt-2 border-t border-dark-border">
                  <p className="text-xs text-dark-muted mb-1">Top mitigations:</p>
                  {downtimeForecast.recommendations.slice(0, 3).map((rec: string, i: number) => (
                    <p key={i} className="text-xs text-amber-300">• {rec}</p>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Digital Twin Timeline — spans 2 cols on large screens */}
        <div className="sm:col-span-2 lg:col-span-3 xl:col-span-4">
          <div className="glass rounded-2xl p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-accent-400" />
              Digital Twin Timeline
            </h3>
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-px bg-dark-border" />
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {timeline.map((event, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    className="flex gap-4"
                  >
                    <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${
                      event.type === 'genesis' ? 'bg-primary-500' :
                      event.type === 'renovation' ? 'bg-accent-500' :
                      event.type === 'inspection' ? 'bg-amber-500' : 'bg-blue-500'
                    }`} />
                    <div className="min-w-0">
                      <p className="text-sm text-dark-muted">{event.date}</p>
                      <p className="font-medium text-sm">{event.title}</p>
                      <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded-full bg-dark-card text-dark-muted">
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

      {/* Model picker modal */}
        {isModelPickerOpen && (
          <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-6"
            onClick={() => setIsModelPickerOpen(false)}
          >
            <div
              className="w-full max-w-3xl bg-[#0a0f18] border border-white/10 rounded-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-white/10 flex items-center justify-between">
                <div>
                  <div className="text-white/80 font-medium">Digital Twin Library</div>
                  <div className="text-white/40 text-xs">Pick a model and attach it to this asset for 3D View</div>
                  <div className="text-white/30 text-xs mt-1">No models? Click Seed below to add catalog (incl. demo GLB). Then Attach.</div>
                </div>
                <button
                  onClick={() => setIsModelPickerOpen(false)}
                  className="text-white/40 hover:text-white/70 text-sm"
                >
                  Close
                </button>
              </div>

              <div className="p-4 border-b border-white/10 flex items-center gap-3">
                <input
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  placeholder="Search (factory, city, bank, datacenter...)"
                  className="flex-1 px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-white text-sm outline-none focus:border-primary-500/40"
                />
                <button
                  onClick={async () => {
                    try {
                      await seedApi.seedTwinAssets(false)
                      queryClient.invalidateQueries({ queryKey: ['twin-asset-library'] })
                    } catch {
                      // ignore
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 text-sm"
                  title="Add catalog if empty (includes demo GLB)"
                >
                  Seed
                </button>
                <button
                  onClick={async () => {
                    try {
                      await seedApi.seedTwinAssets(true)
                      queryClient.invalidateQueries({ queryKey: ['twin-asset-library'] })
                    } catch {
                      // ignore
                    }
                  }}
                  className="px-3 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 text-sm hover:bg-amber-500/30"
                  title="Replace catalog with fresh seed (adds Demo Duck GLB + USD placeholders)"
                >
                  Seed (replace all)
                </button>
              </div>

              <div className="px-4 pb-2 flex flex-wrap gap-2">
                <span className="text-xs text-white/50 self-center">Category:</span>
                {[
                  { value: '', label: 'All' },
                  { value: 'residential', label: 'Residential' },
                  { value: 'commercial', label: 'Commercial' },
                  { value: 'industrial', label: 'Industrial' },
                  { value: 'public', label: 'Public' },
                ].map(({ value, label }) => (
                  <button
                    key={value || 'all'}
                    type="button"
                    onClick={() => setLibraryCategory(value)}
                    className={`px-3 py-1.5 rounded-lg text-sm ${
                      libraryCategory === value
                        ? 'bg-primary-500 text-white'
                        : 'bg-white/5 border border-white/10 text-white/70 hover:bg-white/10'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="p-4 max-h-[420px] overflow-auto">
                {isLibraryLoading ? (
                  <div className="text-white/40 text-sm">Loading library...</div>
                ) : libraryList.length === 0 ? (
                  <div className="text-white/60 text-sm space-y-2">
                    <p>No models in the library yet.</p>
                    <p className="text-white/50 text-xs">Click <strong>Seed</strong> or <strong>Seed (replace all)</strong> to add catalog (incl. Demo Duck GLB). Then pick a Ready model and <strong>Attach</strong>.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {!libraryList.some((it: any) => !!it.glb_object) && (
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">
                        No model is Ready (GLB). Click <strong>Seed (replace all)</strong> above to add Demo Duck (GLB), then <strong>Attach</strong> it for 3D View.
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {libraryList.map((it: any) => {
                      const ready = !!it.glb_object
                      const conv = it?.extra_metadata?.conversion
                      const convState = (conv?.state as string | undefined) || null
                      const isInFlight = !ready && (!!conv?.task_id || convertingItemId === String(it.id))

                      return (
                        <div
                          key={it.id}
                          className="p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-white/80 font-medium truncate">{it.name}</div>
                              <div className="mt-1 flex items-center gap-2">
                                <div className="text-[10px] px-2 py-1 rounded bg-white/5 border border-white/10 text-white/50">
                                  {it.domain}/{it.kind}
                                </div>
                                {ready ? (
                                  <div className="text-[10px] px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-200/80">
                                    Ready (GLB)
                                  </div>
                                ) : isInFlight ? (
                                  <div className="text-[10px] px-2 py-1 rounded bg-cyan-500/10 border border-cyan-500/20 text-cyan-200/80">
                                    {convertingItemId === String(it.id)
                                      ? 'Queueing...'
                                      : `Converting${convState ? ` (${convState})` : ''}`}
                                  </div>
                                ) : (
                                  <div className="text-[10px] px-2 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-200/80">
                                    Needs convert
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {!ready && (
                                <button
                                  onClick={() => convertMutation.mutate(String(it.id))}
                                  disabled={convertMutation.isPending || isInFlight}
                                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 text-xs"
                                  title="Queue conversion (Celery worker)"
                                >
                                  Convert
                                </button>
                              )}
                              <button
                                onClick={() => attachMutation.mutate(String(it.id))}
                                disabled={attachMutation.isPending || !ready}
                                className={`px-3 py-2 rounded-xl border text-xs ${
                                  ready
                                    ? 'bg-primary-500/20 border-primary-500/30 text-primary-200/90 hover:bg-primary-500/25'
                                    : 'bg-white/5 border-white/10 text-white/30 cursor-not-allowed'
                                }`}
                                title={ready ? 'Attach model to this asset' : 'Convert first to get GLB for web'}
                              >
                                Attach
                              </button>
                            </div>
                          </div>
                          {it.description && (
                            <div className="text-white/40 text-xs mt-2 line-clamp-2">{it.description}</div>
                          )}
                          {(it.extra_metadata?.file_size_bytes != null || it.extra_metadata?.poly_count != null) && (
                            <div className="text-white/40 text-xs mt-1.5 flex flex-wrap gap-x-3 gap-y-0">
                              {it.extra_metadata?.file_size_bytes != null && (
                                <span title="File size">
                                  {it.extra_metadata.file_size_bytes < 1024
                                    ? `${it.extra_metadata.file_size_bytes} B`
                                    : it.extra_metadata.file_size_bytes < 1024 * 1024
                                      ? `${(it.extra_metadata.file_size_bytes / 1024).toFixed(1)} KB`
                                      : `${(it.extra_metadata.file_size_bytes / (1024 * 1024)).toFixed(1)} MB`}
                                </span>
                              )}
                              {it.extra_metadata?.poly_count != null && (
                                <span title="Poly count">{Number(it.extra_metadata.poly_count).toLocaleString()} tris</span>
                              )}
                            </div>
                          )}
                          {Array.isArray(it.tags) && it.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {it.tags.slice(0, 5).map((t: string) => (
                                <span
                                  key={t}
                                  className="text-[10px] px-2 py-0.5 rounded bg-black/30 border border-white/10 text-white/50"
                                >
                                  {t}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                  </div>
                )}
                {attachMutation.isError && (
                  <div className="text-red-300/80 text-xs mt-3">
                    Failed to attach model. Check that the library item has GLB available (or run conversion).
                  </div>
                )}
                {convertMutation.isSuccess && (
                  <div className="text-white/50 text-xs mt-3">
                    Conversion queued. Start the celery worker to process jobs.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
    </div>
  )
}
