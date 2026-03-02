import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeftIcon,
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
import { assetsApi, insuranceApi, creditApi, seedApi, stressTestsApi, twinAssetsApi, twinsApi, agentsApi } from '../lib/api'
import type { QuickStressTestResult, StressScenarioItem, DecisionObject } from '../lib/api'
import DecisionObjectCard from '../components/DecisionObjectCard'
import Viewer3D from '../components/Viewer3D'

type StressImpact = 'low' | 'medium' | 'high' | 'critical'
function getStressResultForViewer(
  result: QuickStressTestResult | null,
  asset: { current_valuation?: number } | null | undefined
): { eventName: string; impactLevel: StressImpact; totalLoss?: number; currency?: string } | undefined {
  if (!result || !asset) return undefined
  const fromZone = (r: string): StressImpact => {
    const s = (r || '').toUpperCase()
    if (s.includes('CRITICAL')) return 'critical'
    if (s.includes('HIGH')) return 'high'
    if (s.includes('MEDIUM')) return 'medium'
    return 'low'
  }
  let impactLevel: StressImpact = 'low'
  if (result.zones?.length) {
    const levels = result.zones.map((z) => fromZone(z.risk_level))
    if (levels.some((l) => l === 'critical')) impactLevel = 'critical'
    else if (levels.some((l) => l === 'high')) impactLevel = 'high'
    else if (levels.some((l) => l === 'medium')) impactLevel = 'medium'
  } else {
    const valuation = (asset as any)?.current_valuation || 1
    const ratio = result.total_loss / valuation
    if (ratio >= 0.3) impactLevel = 'critical'
    else if (ratio >= 0.15) impactLevel = 'high'
    else if (ratio >= 0.05) impactLevel = 'medium'
  }
  return {
    eventName: result.event_name || result.event_type || 'Stress test',
    impactLevel,
    totalLoss: result.total_loss,
    currency: result.currency,
  }
}

export default function AssetDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  // Single 3D view (BIM IFC/XKT tabs removed — using GLB Digital Twin models only)
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

  // Fetch regime context for the twin (if available)
  const { data: twinData } = useQuery({
    queryKey: ['twin', id],
    queryFn: () => twinsApi.get(id!),
    enabled: !!id,
    retry: false,
    staleTime: 30_000,
  })
  const { data: regimeCtxData } = useQuery({
    queryKey: ['twin-regime-context', twinData?.id],
    queryFn: () => twinsApi.getRegimeContext(twinData?.id),
    enabled: !!twinData?.id,
    retry: false,
    staleTime: 30_000,
  })
  const regimeCtx = regimeCtxData?.regime_context as
    | { regime: string; regime_label: string; pd_override: number; lgd_override: number; used_asset_pd_lgd?: boolean; pd_lgd_source?: string }
    | null
    | undefined

  const syncRegimeMutation = useMutation({
    mutationFn: (regime: string) => twinsApi.syncRegime(regime),
    onSuccess: (_, regime) => {
      queryClient.invalidateQueries({ queryKey: ['twin-regime-context'] })
      queryClient.invalidateQueries({ queryKey: ['twin', id] })
    },
  })

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
  // ARIN Decision Object (Risk & Intelligence OS)
  const [decisionObject, setDecisionObject] = useState<DecisionObject | null>(null)
  const [decisionObjectLoading, setDecisionObjectLoading] = useState(false)
  const [decisionObjectError, setDecisionObjectError] = useState<string | null>(null)
  const [showDecisionObjectPanel, setShowDecisionObjectPanel] = useState(false)

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-md bg-gradient-to-br from-zinc-500 to-zinc-400 animate-pulse" />
          <p className="text-dark-muted">Loading asset...</p>
        </div>
      </div>
    )
  }

  if (!asset) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-red-400/80">Asset not found</p>
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
    setStressTestError(null)
    // Keep stressTestResult so 3D building stays highlighted after closing the modal
  }

  const fetchDecisionObject = async () => {
    if (!asset) return
    setDecisionObjectError(null)
    setDecisionObject(null)
    setDecisionObjectLoading(true)
    setShowDecisionObjectPanel(true)
    try {
      const do_ = await agentsApi.getDecisionObject(asset.id)
      setDecisionObject(do_)
    } catch (e: any) {
      setDecisionObjectError(e?.response?.data?.detail || e?.message || 'Failed to load ARIN assessment')
    } finally {
      setDecisionObjectLoading(false)
    }
  }

  const closeDecisionObjectPanel = () => {
    setShowDecisionObjectPanel(false)
    setDecisionObject(null)
    setDecisionObjectError(null)
  }

  return (
    <div className="min-h-full bg-zinc-950">
      {/* ARIN Decision Object Panel Modal */}
      {showDecisionObjectPanel && asset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-dark-card border border-dark-border rounded-md shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-dark-border">
              <h2 className="text-lg font-display font-semibold text-zinc-100 flex items-center gap-2">
                <ShieldExclamationIcon className="w-5 h-5 text-zinc-400" />
                ARIN Assessment (Risk & Intelligence OS)
              </h2>
              <button
                type="button"
                onClick={closeDecisionObjectPanel}
                className="p-2 rounded-md text-dark-muted hover:text-zinc-100 hover:bg-zinc-700 transition-colors"
                aria-label="Close"
              >
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto flex-1">
              {decisionObjectError && (
                <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                  {decisionObjectError}
                </div>
              )}
              {decisionObject && (
                <DecisionObjectCard decision={decisionObject} compact={false} />
              )}
            </div>
          </motion.div>
        </div>
      )}

      {/* Stress Test Panel Modal */}
      {isStressTestPanelOpen && asset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-dark-card border border-dark-border rounded-md shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="flex items-center justify-between p-4 border-b border-dark-border">
              <h2 className="text-lg font-display font-semibold text-zinc-100 flex items-center gap-2">
                <BeakerIcon className="w-5 h-5 text-zinc-400" />
                Run Stress Test
              </h2>
              <button
                type="button"
                onClick={closeStressTestPanel}
                className="p-2 rounded-md text-dark-muted hover:text-zinc-100 hover:bg-zinc-700 transition-colors"
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
                  className="w-full px-4 py-2.5 rounded-md bg-dark-bg border border-dark-border text-zinc-100 focus:ring-2 focus:ring-zinc-500 focus:border-transparent"
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
                <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                  {stressTestError}
                </div>
              )}
              {stressTestResult && (
                <div className="space-y-3">
                  <div className="rounded-md bg-zinc-800 border border-zinc-700 p-4 text-sm">
                    <div className="flex flex-wrap gap-4 items-center">
                      <span className="text-dark-muted">Event:</span>
                      <span className="text-zinc-100 font-medium">{stressTestResult.event_name}</span>
                      {stressTestResult.compliance_verification?.verified && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-400/80 text-xs font-medium" title="Regulatory verification passed">
                          Compliance verified
                        </span>
                      )}
                      <span className="text-dark-muted">Loss:</span>
                      <span className="text-amber-400/80 font-mono">
                        {stressTestResult.currency || 'EUR'} {(stressTestResult.total_loss / 1e6).toFixed(2)}M
                      </span>
                      <span className="text-dark-muted">Buildings:</span>
                      <span className="text-zinc-100">{stressTestResult.total_buildings_affected}</span>
                    </div>
                    {stressTestResult.executive_summary && (
                      <div className="mt-3">
                        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Summary</p>
                        <p className="text-zinc-100 leading-relaxed">{stressTestResult.executive_summary}</p>
                      </div>
                    )}
                    {stressTestResult.zones?.length > 0 && (
                      <div className="mt-3">
                        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Zones</p>
                        <ul className="space-y-1">
                          {stressTestResult.zones.slice(0, 5).map((z, i) => (
                            <li key={i} className="flex justify-between gap-2 text-zinc-200">
                              <span>{z.label}</span>
                              <span className="text-amber-400/90">{z.risk_level}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                  {stressTestResult.decision_object && (
                    <DecisionObjectCard decision={stressTestResult.decision_object} compact />
                  )}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-dark-border flex gap-2 justify-end">
              <button
                type="button"
                onClick={closeStressTestPanel}
                className="px-4 py-2 rounded-md border border-dark-border text-dark-muted hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
              >
                Close
              </button>
              <button
                type="button"
                onClick={runStressTestForAsset}
                disabled={!selectedScenarioId || stressTestRunning}
                className="px-4 py-2 rounded-md bg-zinc-500 text-zinc-100 font-medium hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {stressTestRunning ? (
                  <>
                    <span className="inline-block w-4 h-4 border-2 border-zinc-500 border-t-zinc-300 rounded-full animate-spin" />
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
          className="inline-flex items-center gap-2 text-dark-muted hover:text-zinc-100 transition-colors mb-4"
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
              className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-200 hover:text-zinc-100 hover:border-zinc-600 hover:bg-zinc-700 transition-colors"
              title="Select a Digital Twin model from the library"
            >
              <Square3Stack3DIcon className="w-5 h-5" />
              Select Model
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={fetchDecisionObject}
              disabled={decisionObjectLoading}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-500/20 text-zinc-400 border border-zinc-500/40 rounded-md font-medium hover:bg-zinc-500/30 transition-colors disabled:opacity-50"
              title="Get ARIN multi-agent risk assessment (Risk & Intelligence OS)"
            >
              {decisionObjectLoading ? (
                <>
                  <span className="inline-block w-4 h-4 border-2 border-zinc-400/30 border-t-zinc-400 rounded-full animate-spin" />
                  Loading…
                </>
              ) : (
                <>
                  <ShieldExclamationIcon className="w-5 h-5" />
                  ARIN Assessment
                </>
              )}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsStressTestPanelOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-500 text-zinc-100 rounded-md font-medium hover:bg-zinc-600 transition-colors"
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
        <div className="glass rounded-md overflow-hidden h-[840px] min-h-[640px] relative flex flex-col">
          {/* Caption: real model vs placeholder */}
          {!modelUrl && (
            <div className="absolute top-4 left-4 z-10 px-3 py-2 rounded-md bg-zinc-500/20 border border-zinc-500/40 text-zinc-200 text-sm max-w-xs">
              Placeholder view. Use <strong>Select Model</strong> above to attach a Digital Twin for a realistic 3D model.
            </div>
          )}
          {modelUrl && (
            <div className="absolute top-4 left-4 z-10 flex flex-wrap items-center gap-2">
              <span className="px-3 py-2 rounded-md bg-zinc-500/20 border border-zinc-500/40 text-zinc-200 text-sm">
                Digital Twin model
              </span>
              {regimeCtx && (
                <span
                  className={`px-3 py-2 rounded-md text-xs font-medium border ${
                    regimeCtx.regime === 'crisis'
                      ? 'bg-red-500/20 text-red-400/80 border-red-500/40'
                      : regimeCtx.regime === 'stagflation'
                        ? 'bg-orange-500/20 text-orange-400/80 border-orange-500/40'
                        : regimeCtx.regime === 'late_cycle'
                          ? 'bg-amber-500/20 text-amber-400/80 border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-400/80 border-emerald-500/40'
                  }`}
                  title={
                    regimeCtx.used_asset_pd_lgd
                      ? undefined
                      : regimeCtx.pd_lgd_source === 'risk'
                        ? 'From asset risk scores (climate, physical, network).'
                        : regimeCtx.pd_lgd_source === 'type'
                          ? 'From asset type typicals.'
                          : 'Default base. Set PD/LGD or risk scores on asset for live values.'
                  }
                >
                  {regimeCtx.regime_label}: PD {(regimeCtx.pd_override * 100).toFixed(1)}%, LGD {(regimeCtx.lgd_override * 100).toFixed(0)}%
                </span>
              )}
              {!regimeCtx && (
                <span className="px-2 py-1 rounded-md bg-zinc-700/50 text-zinc-500 text-xs">
                  No regime
                </span>
              )}
              <select
                className="rounded-md bg-zinc-700 border border-zinc-600 text-zinc-200 text-xs px-2 py-1.5 focus:ring-1 focus:ring-zinc-500 min-w-[140px]"
                value={regimeCtx?.regime ?? ''}
                onChange={(e) => {
                  const v = e.target.value
                  if (v) syncRegimeMutation.mutate(v)
                }}
                disabled={syncRegimeMutation.isPending}
                title="Change market regime for this twin"
              >
                <option value="">{regimeCtx ? 'Change regime…' : 'Sync to regime…'}</option>
                <option value="bull">Bull</option>
                <option value="late_cycle">Late Cycle</option>
                <option value="crisis">Crisis</option>
                <option value="stagflation">Stagflation</option>
              </select>
              {syncRegimeMutation.isPending && (
                <span className="text-xs text-zinc-400">Syncing…</span>
              )}
            </div>
          )}
          <div className="flex-1 min-h-0 relative">
            <Viewer3D
              key={`viewer3d-${asset.id}`}
              modelUrl={modelUrl}
              riskScores={{
                climate: asset.climate_risk_score || 0,
                physical: asset.physical_risk_score || 0,
                network: asset.network_risk_score || 0,
              }}
              showRiskOverlay={!!modelUrl}
              floorsAboveGround={(asset as any).floors_above_ground ?? undefined}
              grossFloorAreaM2={asset.gross_floor_area_m2 ?? undefined}
              stressResult={getStressResultForViewer(stressTestResult, asset)}
            />
          </div>
        </div>
      </div>

      {/* Info panels — grid across full useful area */}
      <div className="px-8 pb-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {/* Risk Assessment */}
        <div className="glass rounded-md p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <ShieldCheckIcon className="w-5 h-5 text-zinc-400" />
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

        {/* Asset Details */}
        <div className="glass rounded-md p-6">
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
          <div className="glass rounded-md p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <ShieldExclamationIcon className="w-5 h-5 text-zinc-400" />
              Insurance Quote
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-dark-muted">Annual Premium</span>
                <span className="font-bold text-lg text-green-400/80">
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
                  <span className="text-amber-400/80">+€{(insuranceQuote.risk_loading || 0).toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-dark-muted">Deductible Discount</span>
                  <span className="text-green-400/80">-€{(insuranceQuote.deductible_discount || 0).toLocaleString()}</span>
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
          <div className="glass rounded-md p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <CurrencyDollarIcon className="w-5 h-5 text-zinc-400" />
              Credit Risk Profile
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-dark-muted">Credit Limit</span>
                <span className="font-bold text-lg text-zinc-400">
                  €{((creditProfile.credit_limit || 0) / 1000000).toFixed(1)}M</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-dark-muted">Rating</span>
                <span className={`font-bold px-2 py-0.5 rounded text-xs ${
                  ['AAA', 'AA', 'A'].includes(creditProfile.rating) ? 'bg-green-500/20 text-green-400/80' :
                  ['BBB', 'BB'].includes(creditProfile.rating) ? 'bg-amber-500/20 text-amber-400/80' :
                  'bg-red-500/20 text-red-400/80'
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
                <span className={creditProfile.collateral_adequacy >= 1.2 ? 'text-green-400/80' : 'text-amber-400/80'}>
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
          <div className="glass rounded-md p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-zinc-400" />
              Degradation Forecast
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-dark-muted">Remaining Useful Life</span>
                <span className="font-bold text-zinc-100">{degradation.remaining_useful_life_years.toFixed(1)} yrs</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-dark-muted">Failure Probability (10y)</span>
                <span className={`font-semibold ${degradation.failure_probability > 0.5 ? 'text-red-400/80' : degradation.failure_probability > 0.25 ? 'text-amber-400/80' : 'text-green-400/80'}`}>
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
                  degradation.recommended_capex_priority === 'medium' ? 'bg-zinc-500/20 text-zinc-300' :
                  'bg-zinc-700 text-zinc-300'
                }`}>
                  {degradation.recommended_capex_priority.toUpperCase()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Operational Risk */}
        {operationalRisk && (
          <div className="glass rounded-md p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <ShieldCheckIcon className="w-5 h-5 text-zinc-400" />
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
                    Number(operationalRisk.result.overall_score) >= 85 ? 'text-green-400/80' :
                    Number(operationalRisk.result.overall_score) >= 70 ? 'text-amber-400/80' : 'text-red-400/80'
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
          <div className="glass rounded-md p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5 text-red-400/80" />
              Downtime Forecast
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-dark-muted">Expected Downtime</span>
                <span className="font-semibold text-zinc-100">{downtimeForecast.expected_downtime_hours.toFixed(1)} h/year</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-dark-muted">Worst Case</span>
                <span className="text-amber-300">{downtimeForecast.worst_case_days.toFixed(1)} days</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-dark-muted">Uptime Probability</span>
                <span className="text-green-400/80">{(downtimeForecast.uptime_probability * 100).toFixed(0)}%</span>
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
          <div className="glass rounded-md p-6">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <ClockIcon className="w-5 h-5 text-zinc-400" />
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
                      event.type === 'genesis' ? 'bg-zinc-500' :
                      event.type === 'renovation' ? 'bg-zinc-500' :
                      event.type === 'inspection' ? 'bg-zinc-500' : 'bg-zinc-500'
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
            className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6"
            onClick={() => setIsModelPickerOpen(false)}
          >
            <div
              className="w-full max-w-3xl bg-zinc-950 border border-zinc-800 rounded-md overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-4 border-b border-zinc-700 flex items-center justify-between">
                <div>
                  <div className="text-zinc-200 font-medium">Digital Twin Library</div>
                  <div className="text-zinc-500 text-xs">Pick a model and attach it to this asset for 3D View</div>
                  <div className="text-zinc-600 text-xs mt-1">No models? Click Seed below to add catalog (incl. demo GLB). Then Attach.</div>
                </div>
                <button
                  onClick={() => setIsModelPickerOpen(false)}
                  className="text-zinc-500 hover:text-zinc-300 text-sm"
                >
                  Close
                </button>
              </div>

              <div className="p-4 border-b border-zinc-700 flex items-center gap-3">
                <input
                  value={modelSearch}
                  onChange={(e) => setModelSearch(e.target.value)}
                  placeholder="Search (factory, city, bank, datacenter...)"
                  className="flex-1 px-3 py-2 rounded-md bg-black/30 border border-zinc-700 text-zinc-100 text-sm outline-none focus:border-zinc-500/40"
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
                  className="px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 text-sm"
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
                  className="px-3 py-2 rounded-md bg-zinc-500/20 border border-zinc-500/40 text-zinc-200 text-sm hover:bg-zinc-500/30"
                  title="Replace catalog with fresh seed (adds Demo Duck GLB + USD placeholders)"
                >
                  Seed (replace all)
                </button>
              </div>

              <div className="px-4 pb-2 flex flex-wrap gap-2">
                <span className="text-xs text-zinc-500 self-center">Category:</span>
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
                    className={`px-3 py-1.5 rounded-md text-sm ${
                      libraryCategory === value
                        ? 'bg-zinc-500 text-zinc-100'
                        : 'bg-zinc-800 border border-zinc-700 text-zinc-300 hover:bg-zinc-700'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              <div className="p-4 max-h-[420px] overflow-auto">
                {isLibraryLoading ? (
                  <div className="text-zinc-500 text-sm">Loading library...</div>
                ) : libraryList.length === 0 ? (
                  <div className="text-zinc-400 text-sm space-y-2">
                    <p>No models in the library yet.</p>
                    <p className="text-zinc-500 text-xs">Click <strong>Seed</strong> or <strong>Seed (replace all)</strong> to add catalog (incl. Demo Duck GLB). Then pick a Ready model and <strong>Attach</strong>.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {!libraryList.some((it: any) => !!it.glb_object) && (
                      <div className="p-3 rounded-md bg-zinc-500/10 border border-zinc-500/30 text-zinc-200 text-sm">
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
                          className="p-4 rounded-md bg-zinc-800 border border-zinc-700 hover:border-zinc-600 transition-colors"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="text-zinc-200 font-medium truncate">{it.name}</div>
                              <div className="mt-1 flex items-center gap-2">
                                <div className="text-[10px] px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-500">
                                  {it.domain}/{it.kind}
                                </div>
                                {ready ? (
                                  <div className="text-[10px] px-2 py-1 rounded bg-zinc-500/10 border border-zinc-500/20 text-zinc-200/80">
                                    Ready (GLB)
                                  </div>
                                ) : isInFlight ? (
                                  <div className="text-[10px] px-2 py-1 rounded bg-zinc-500/10 border border-zinc-500/20 text-zinc-200/80">
                                    {convertingItemId === String(it.id)
                                      ? 'Queueing...'
                                      : `Converting${convState ? ` (${convState})` : ''}`}
                                  </div>
                                ) : (
                                  <div className="text-[10px] px-2 py-1 rounded bg-zinc-500/10 border border-zinc-500/20 text-zinc-200/80">
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
                                  className="px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 text-xs"
                                  title="Queue conversion (Celery worker)"
                                >
                                  Convert
                                </button>
                              )}
                              <button
                                onClick={() => attachMutation.mutate(String(it.id))}
                                disabled={attachMutation.isPending || !ready}
                                className={`px-3 py-2 rounded-md border text-xs ${
                                  ready
                                    ? 'bg-zinc-500/20 border-zinc-500/30 text-zinc-200/90 hover:bg-zinc-500/25'
                                    : 'bg-zinc-800 border-zinc-700 text-zinc-600 cursor-not-allowed'
                                }`}
                                title={ready ? 'Attach model to this asset' : 'Convert first to get GLB for web'}
                              >
                                Attach
                              </button>
                            </div>
                          </div>
                          {it.description && (
                            <div className="text-zinc-500 text-xs mt-2 line-clamp-2">{it.description}</div>
                          )}
                          {(it.extra_metadata?.file_size_bytes != null || it.extra_metadata?.poly_count != null) && (
                            <div className="text-zinc-500 text-xs mt-1.5 flex flex-wrap gap-x-3 gap-y-0">
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
                                  className="text-[10px] px-2 py-0.5 rounded bg-black/30 border border-zinc-700 text-zinc-500"
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
                  <div className="text-zinc-500 text-xs mt-3">
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
