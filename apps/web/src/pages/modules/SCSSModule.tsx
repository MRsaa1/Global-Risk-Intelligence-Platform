/**
 * SCSS Module - Supply Chain Sovereignty System
 *
 * List suppliers, register new, view routes, sovereignty scores,
 * bottleneck analysis, and alternative supplier recommendations.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon,
  PlusIcon,
  XMarkIcon,
  ArrowPathIcon,
  LinkIcon,
  MapIcon,
  ExclamationTriangleIcon,
  BoltIcon,
} from '@heroicons/react/24/outline'
import { getModuleById } from '../../lib/modules'
import { scssApi } from '../../lib/api'
import type {
  SCSSSupplier,
  SCSSRoute,
  SCSSBottleneck,
  SCSSAlternative,
} from '../../lib/api'
import AccessGate from '../../components/modules/AccessGate'
import SendToARINButton from '../../components/SendToARINButton'
import ARINVerdictBadge from '../../components/ARINVerdictBadge'
import SupplyChainGraph from '../../components/scss/SupplyChainGraph'
import SupplyChainSankey from '../../components/scss/SupplyChainSankey'
import SupplyChainMapCesium from '../../components/scss/SupplyChainMapCesium'

type RoutesData = {
  supplier_id: string
  scss_id: string
  outgoing: SCSSRoute[]
  incoming: SCSSRoute[]
}

type SovereigntyData = {
  supplier_id?: string
  scss_id?: string
  name?: string
  sovereignty_score?: number
  components?: Record<string, number>
  recommendations?: string[]
  error?: string
}

type BottlenecksResult = {
  bottlenecks: SCSSBottleneck[]
  total_suppliers_analyzed?: number
  summary?: { critical: number; high: number; medium: number }
  diversification_score?: number
  bottleneck_score?: number
}

type ChainMapResult = Awaited<ReturnType<typeof scssApi.mapChain>>
type SimulateResult = Awaited<ReturnType<typeof scssApi.runSimulate>>

type AlternativesResult = {
  supplier_id: string
  scss_id: string
  name: string
  alternatives: SCSSAlternative[]
}

export default function SCSSModule() {
  const navigate = useNavigate()
  const module = getModuleById('scss')
  const [suppliers, setSuppliers] = useState<SCSSSupplier[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [registerModalOpen, setRegisterModalOpen] = useState(false)
  const [selectedSupplier, setSelectedSupplier] = useState<SCSSSupplier | null>(null)
  const [routesData, setRoutesData] = useState<RoutesData | null>(null)
  const [sovereigntyData, setSovereigntyData] = useState<SovereigntyData | null>(null)
  const [bottlenecksData, setBottlenecksData] = useState<BottlenecksResult | null>(null)
  const [alternativesData, setAlternativesData] = useState<AlternativesResult | null>(null)
  const [typeOptions, setTypeOptions] = useState<Array<{ value: string; name: string }>>([])
  const [tierOptions, setTierOptions] = useState<
    Array<{ value: string; name: string; description?: string }>
  >([])
  const [stats, setStats] = useState<Record<string, number> | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [bottlenecksLoading, setBottlenecksLoading] = useState(false)
  const [chainMapData, setChainMapData] = useState<ChainMapResult | null>(null)
  const [chainMapLoading, setChainMapLoading] = useState(false)
  const [chainMapFilterTier, setChainMapFilterTier] = useState<string>('')
  const [chainMapFilterRisk, setChainMapFilterRisk] = useState<string>('')
  const [chainMapFilterGeography, setChainMapFilterGeography] = useState<string>('')
  const [chainMapFilterCategory, setChainMapFilterCategory] = useState<string>('')
  const [chainMapView, setChainMapView] = useState<'network' | 'sankey' | 'map'>('map')
  const [simulateResult, setSimulateResult] = useState<SimulateResult | null>(null)
  const [simulateLoading, setSimulateLoading] = useState(false)
  const [simulateModalOpen, setSimulateModalOpen] = useState(false)
  const [sanctionsStatus, setSanctionsStatus] = useState<{
    last_scan: string | null
    ofac_configured: boolean
    eu_configured: boolean
    total_matches?: number
  } | null>(null)
  const chainMapContainerRef = useRef<HTMLDivElement>(null)
  const [chainMapAreaSize, setChainMapAreaSize] = useState({ width: 900, height: 546 })

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await scssApi.listSuppliers({ limit: 200 })
      setSuppliers(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load suppliers')
      setSuppliers([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadOptionsAndStats = useCallback(async () => {
    try {
      const [types, tiers, status, sanctions] = await Promise.all([
        scssApi.getTypes(),
        scssApi.getTiers(),
        scssApi.getStatus(),
        scssApi.getSanctionsStatus().catch(() => null),
      ])
      setTypeOptions(types)
      setTierOptions(tiers)
      setStats((status?.statistics as Record<string, number>) ?? null)
      setSanctionsStatus(sanctions ?? null)
    } catch {
      // non-blocking
    }
  }, [])

  useEffect(() => {
    loadList()
    loadOptionsAndStats()
  }, [loadList, loadOptionsAndStats])

  const handleRegisterSubmit = async (data: {
    name: string
    supplier_type?: string
    tier?: string
    country_code?: string
    region?: string
    city?: string
    latitude?: number
    longitude?: number
    description?: string
    industry_sector?: string
    is_critical?: boolean
    materials?: string[]
    capacity?: number
    lead_time_days?: number
    geopolitical_risk?: number
  }) => {
    setSubmitting(true)
    setFormError(null)
    try {
      await scssApi.registerSupplier(data)
      setRegisterModalOpen(false)
      await loadList()
      loadOptionsAndStats()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to register')
    } finally {
      setSubmitting(false)
    }
  }

  const handleViewRoutes = async (supplier: SCSSSupplier) => {
    setSelectedSupplier(supplier)
    setSovereigntyData(null)
    setBottlenecksData(null)
    setAlternativesData(null)
    try {
      const res = await scssApi.getRoutes(supplier.id, 'both')
      setRoutesData(res)
    } catch {
      setRoutesData(null)
    }
  }

  const handleViewSovereignty = async (supplier: SCSSSupplier) => {
    setSelectedSupplier(supplier)
    setRoutesData(null)
    setBottlenecksData(null)
    setAlternativesData(null)
    try {
      const res = await scssApi.getSovereignty(supplier.id)
      setSovereigntyData(res as SovereigntyData)
    } catch {
      setSovereigntyData({ error: 'Failed to load sovereignty' })
    }
  }

  const handleAnalyzeBottlenecks = async () => {
    setBottlenecksLoading(true)
    setBottlenecksData(null)
    try {
      const res = await scssApi.analyzeBottlenecks({})
      setBottlenecksData(res as BottlenecksResult)
      setRoutesData(null)
      setSovereigntyData(null)
      setAlternativesData(null)
      setSelectedSupplier(null)
    } catch {
      setBottlenecksData(null)
    } finally {
      setBottlenecksLoading(false)
    }
  }

  const handleGetAlternatives = async (supplier: SCSSSupplier) => {
    setSelectedSupplier(supplier)
    setRoutesData(null)
    setSovereigntyData(null)
    setBottlenecksData(null)
    try {
      const res = await scssApi.getAlternativeSuppliers(supplier.id, {
        limit: 10,
        prefer_different_country: true,
        same_supplier_type: true,
      })
      setAlternativesData(res)
    } catch {
      setAlternativesData(null)
    }
  }

  const handleMapChain = async (rootSupplierId: string) => {
    setChainMapLoading(true)
    setChainMapData(null)
    setChainMapFilterTier('')
    setChainMapFilterRisk('')
    setChainMapFilterGeography('')
    setChainMapFilterCategory('')
    setChainMapView('map')
    try {
      const res = await scssApi.mapChain({ root_supplier_id: rootSupplierId, max_tiers: 5 })
      setChainMapData(res)
    } catch {
      setChainMapData(null)
    } finally {
      setChainMapLoading(false)
    }
  }

  const chainMapFiltered = useMemo(() => {
    if (!chainMapData?.nodes?.length) return { nodes: [], edges: [], geographicSummary: [] as Array<{ country_code: string; supplier_count: number; share_pct: number }> }
    const riskBand = (r: number | undefined) => {
      if (r == null) return 'low'
      if (r >= 66) return 'critical'
      if (r >= 33) return 'high'
      if (r >= 10) return 'medium'
      return 'low'
    }
    let nodes = chainMapData.nodes
    if (chainMapFilterTier !== '') {
      const t = Number(chainMapFilterTier)
      if (!Number.isNaN(t)) nodes = nodes.filter((n) => n.tier === t)
    }
    if (chainMapFilterRisk !== '') {
      nodes = nodes.filter((n) => riskBand(n.geopolitical_risk) === chainMapFilterRisk)
    }
    if (chainMapFilterGeography !== '') {
      nodes = nodes.filter((n) => (n.country_code ?? '').toUpperCase() === chainMapFilterGeography.toUpperCase())
    }
    if (chainMapFilterCategory !== '') {
      nodes = nodes.filter((n) => (n.supplier_type ?? '') === chainMapFilterCategory)
    }
    const nodeIds = new Set(nodes.map((n) => n.id))
    const edges = (chainMapData.edges ?? []).filter(
      (e) => nodeIds.has(e.source_id) && nodeIds.has(e.target_id)
    )
    const countryCount: Record<string, number> = {}
    nodes.forEach((n) => {
      const c = n.country_code ?? '—'
      countryCount[c] = (countryCount[c] ?? 0) + 1
    })
    const total = nodes.length
    const geographicSummary = Object.entries(countryCount).map(([country_code, supplier_count]) => ({
      country_code,
      supplier_count,
      share_pct: total ? (supplier_count / total) * 100 : 0,
    }))
    return { nodes, edges, geographicSummary }
  }, [chainMapData, chainMapFilterTier, chainMapFilterRisk, chainMapFilterGeography, chainMapFilterCategory])

  const affectedBySimulationIds = useMemo(() => {
    if (!simulateResult || typeof simulateResult !== 'object') return []
    const impact = (simulateResult as { impact?: { affected_list?: Array<{ supplier_id?: string; id?: string }> } }).impact
    const list = impact?.affected_list
    if (!Array.isArray(list)) return []
    const ids: string[] = []
    list.forEach((a) => {
      const id = a.supplier_id ?? (a as { id?: string }).id
      if (id) ids.push(String(id))
    })
    return ids
  }, [simulateResult])

  const handleRunSimulate = async (body: Parameters<typeof scssApi.runSimulate>[0]) => {
    setSimulateLoading(true)
    setSimulateResult(null)
    try {
      const res = await scssApi.runSimulate(body)
      setSimulateResult(res)
    } catch {
      setSimulateResult(null)
    } finally {
      setSimulateLoading(false)
    }
  }

  const closePanels = () => {
    setSelectedSupplier(null)
    setRoutesData(null)
    setSovereigntyData(null)
    setBottlenecksData(null)
    setAlternativesData(null)
  }

  const hasDetailPanel =
    routesData !== null ||
    sovereigntyData !== null ||
    bottlenecksData !== null ||
    alternativesData !== null

  if (!module) {
    return <div className="p-8 text-zinc-200">Module not found</div>
  }

  useEffect(() => {
    const el = chainMapContainerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const { width, height } = entries[0]?.contentRect ?? { width: 0, height: 0 }
      if (width > 0 && height > 0) {
        setChainMapAreaSize({
          width: Math.max(300, Math.floor(width)),
          height: Math.max(300, Math.min(832, Math.floor(height))),
        })
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [chainMapData])

  return (
    <AccessGate accessLevel={module.accessLevel}>
      <div className="min-h-full p-6">
        <div className="w-full max-w-[1920px] mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <button
              onClick={() => navigate('/modules')}
              className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 mb-4 transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              <span className="text-sm">Back to Modules</span>
            </button>
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                  <module.icon className="w-8 h-8 text-zinc-300" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-display font-bold text-zinc-100">
                      {module.fullName}
                    </h1>
                    <span className="px-2 py-1 bg-zinc-700 text-zinc-200 text-xs rounded border border-zinc-600">
                      Active
                    </span>
                  </div>
                  <p className="text-zinc-400 text-sm">{module.description}</p>
                </div>
              </div>
              {stats && (
                <div className="flex gap-4 text-sm text-zinc-400">
                  <span>{stats.total_suppliers ?? 0} suppliers</span>
                  <span>{stats.total_routes ?? 0} routes</span>
                  <span>{stats.critical_suppliers ?? 0} critical</span>
                </div>
              )}
            </div>
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6 flex flex-wrap gap-3"
          >
            <button
              onClick={() => setRegisterModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-md border border-zinc-700 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Register Supplier
            </button>
            <button
              onClick={loadList}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md border border-zinc-700 transition-colors disabled:opacity-50"
            >
              <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={handleAnalyzeBottlenecks}
              disabled={bottlenecksLoading || suppliers.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-md border border-zinc-600 transition-colors disabled:opacity-50"
            >
              <ExclamationTriangleIcon className={`w-4 h-4 ${bottlenecksLoading ? 'animate-spin' : ''}`} />
              Analyze Bottlenecks
            </button>
            {suppliers.length > 0 && (
              <span className="inline-flex items-center gap-2">
                <select
                  id="chain-root-select"
                  className="px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm"
                  defaultValue=""
                >
                  <option value="">Map chain from…</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.scss_id})
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => {
                    const sel = document.getElementById('chain-root-select') as HTMLSelectElement
                    const id = sel?.value
                    if (id) handleMapChain(id)
                  }}
                  disabled={chainMapLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-md border border-zinc-700 transition-colors disabled:opacity-50"
                >
                  <MapIcon className={`w-4 h-4 ${chainMapLoading ? 'animate-spin' : ''}`} />
                  Map Chain
                </button>
              </span>
            )}
            <button
              onClick={() => setSimulateModalOpen(true)}
              disabled={suppliers.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-md border border-zinc-600 transition-colors disabled:opacity-50"
            >
              <BoltIcon className="w-4 h-4" />
              Simulate scenario
            </button>
          </motion.div>

          {error && (
            <div className="mb-4 p-4 rounded-md bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              {error}
            </div>
          )}

          {/* Sanctions / Compliance status */}
          {sanctionsStatus && (
            <div className="mb-4 p-4 rounded-md border border-zinc-700 bg-zinc-800/50 text-sm">
              <h4 className="text-zinc-200 font-medium mb-2">Sanctions screening</h4>
              <p className="text-zinc-400 text-xs mb-1">
                Source: {sanctionsStatus.ofac_configured ? 'OFAC configured' : ''} {sanctionsStatus.eu_configured ? 'EU sanctions configured' : ''}
                {!sanctionsStatus.ofac_configured && !sanctionsStatus.eu_configured && (
                  <span className="text-amber-400/90"> Using built-in demo list. Set SCSS_OFAC_API_URL / SCSS_EU_SANCTIONS_URL for production screening.</span>
                )}
              </p>
              <p className="text-zinc-500 text-xs">Last scan: {sanctionsStatus.last_scan ? new Date(sanctionsStatus.last_scan).toLocaleString() : 'Never'}</p>
            </div>
          )}

          {/* Chain map result — Professional layout: filters, graph, legend, metrics */}
          {chainMapData && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6 p-6 rounded-md bg-zinc-800 border border-zinc-700"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-zinc-100 font-display font-semibold flex items-center gap-2">
                  <MapIcon className="w-5 h-5" />
                  Supply Chain Map: {chainMapData.root_name}
                </h3>
                <button
                  onClick={() => setChainMapData(null)}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-100"
                  aria-label="Close"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Filters — institutional style */}
              <div className="mb-4 p-3 rounded-md bg-zinc-800 border border-zinc-700">
                <div className="text-zinc-400 text-xs font-medium mb-2 uppercase tracking-wider">Filters</div>
                <div className="flex flex-wrap gap-3 items-center">
                  <span className="text-zinc-500 text-sm">Tiers:</span>
                  <select
                    value={chainMapFilterTier}
                    onChange={(e) => setChainMapFilterTier(e.target.value)}
                    className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm"
                  >
                    <option value="">All</option>
                    {Array.from(new Set((chainMapData.nodes ?? []).map((n) => n.tier))).sort((a, b) => a - b).map((t) => (
                      <option key={t} value={String(t)}>T{t}</option>
                    ))}
                  </select>
                  <span className="text-zinc-500 text-sm ml-2">Risk:</span>
                  <select
                    value={chainMapFilterRisk}
                    onChange={(e) => setChainMapFilterRisk(e.target.value)}
                    className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm"
                  >
                    <option value="">All</option>
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </select>
                  <span className="text-zinc-500 text-sm ml-2">Geography:</span>
                  <select
                    value={chainMapFilterGeography}
                    onChange={(e) => setChainMapFilterGeography(e.target.value)}
                    className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm"
                  >
                    <option value="">All</option>
                    {(chainMapData.geographic_summary ?? []).map((g) => (
                      <option key={g.country_code} value={g.country_code}>{g.country_code}</option>
                    ))}
                  </select>
                  <span className="text-zinc-500 text-sm ml-2">Category:</span>
                  <select
                    value={chainMapFilterCategory}
                    onChange={(e) => setChainMapFilterCategory(e.target.value)}
                    className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm"
                  >
                    <option value="">All</option>
                    {Array.from(new Set((chainMapData.nodes ?? []).map((n) => n.supplier_type).filter(Boolean))).sort().map((t) => (
                      <option key={t!} value={t!}>{t!.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* View toggle: Network | Sankey | Map */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-zinc-500 text-sm">View:</span>
                <button
                  type="button"
                  onClick={() => setChainMapView('network')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    chainMapView === 'network'
                      ? 'bg-zinc-600 text-zinc-100'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Network
                </button>
                <button
                  type="button"
                  onClick={() => setChainMapView('sankey')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    chainMapView === 'sankey'
                      ? 'bg-zinc-600 text-zinc-100'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Sankey (flow)
                </button>
                <button
                  type="button"
                  onClick={() => setChainMapView('map')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    chainMapView === 'map'
                      ? 'bg-zinc-600 text-zinc-100'
                      : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  Map
                </button>
              </div>

              {/* Interactive graph, Sankey, or geographic map — size from container so it never overflows */}
              <div
                ref={chainMapContainerRef}
                className="mb-4 w-full max-w-full overflow-hidden"
                style={{ minHeight: typeof window !== 'undefined' ? Math.min(832, Math.max(546, Math.floor(window.innerHeight * 0.65))) : 546 }}
              >
                {chainMapView === 'network' && (
                  <SupplyChainGraph
                    nodes={chainMapFiltered.nodes}
                    edges={chainMapFiltered.edges}
                    rootSupplierId={chainMapData.root_supplier_id}
                    width={chainMapAreaSize.width}
                    height={chainMapAreaSize.height}
                  />
                )}
                {chainMapView === 'sankey' && (
                  <SupplyChainSankey
                    nodes={chainMapFiltered.nodes}
                    edges={chainMapFiltered.edges}
                    width={chainMapAreaSize.width}
                    height={chainMapAreaSize.height}
                  />
                )}
                {chainMapView === 'map' && (
                  <SupplyChainMapCesium
                    nodes={chainMapFiltered.nodes}
                    edges={chainMapFiltered.edges}
                    selectedSupplierId={
                      selectedSupplier && chainMapFiltered.nodes.some((n) => n.id === selectedSupplier.id)
                        ? selectedSupplier.id
                        : null
                    }
                    affectedSupplierIds={affectedBySimulationIds}
                    width={chainMapAreaSize.width}
                    height={chainMapAreaSize.height}
                  />
                )}
              </div>

              {/* Legend */}
              <div className="mb-4 flex flex-wrap items-center gap-4 text-xs text-zinc-400">
                <span className="font-medium text-zinc-300">Legend:</span>
                <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 mr-1" />Critical risk</span>
                <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 mr-1" />Medium risk</span>
                <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1" />Low risk</span>
                <span>Ring = critical supplier</span>
                <span>——— Direct dependency</span>
                {affectedBySimulationIds.length > 0 && (
                  <span><span className="inline-block w-4 h-0.5 bg-red-500 mr-1 align-middle" />Red = affected by scenario</span>
                )}
              </div>

              {/* Metrics panel — Phase 2: resilience, SPOF, critical bottlenecks from chain */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                <div className="p-3 rounded-md bg-zinc-800 border border-zinc-700">
                  <span className="text-zinc-500 text-xs block">Total suppliers</span>
                  <p className="text-zinc-100 font-semibold">{chainMapFiltered.nodes.length}</p>
                </div>
                <div className="p-3 rounded-md bg-zinc-800 border border-zinc-700">
                  <span className="text-zinc-500 text-xs block">Connections</span>
                  <p className="text-zinc-100 font-semibold">{chainMapFiltered.edges.length}</p>
                </div>
                <div className="p-3 rounded-md bg-zinc-800 border border-zinc-700">
                  <span className="text-zinc-500 text-xs block">Critical bottlenecks</span>
                  <p className="text-zinc-100 font-semibold">
                    {chainMapData.critical_bottlenecks_count ?? bottlenecksData?.summary?.critical ?? '—'}
                  </p>
                </div>
                <div className="p-3 rounded-md bg-zinc-800 border border-zinc-700">
                  <span className="text-zinc-500 text-xs block">SPOF</span>
                  <p className="text-zinc-100 font-semibold">
                    {chainMapData.single_points_of_failure?.length ?? '—'}
                  </p>
                </div>
                <div className="p-3 rounded-md bg-zinc-800 border border-zinc-700">
                  <span className="text-zinc-500 text-xs block">Resilience score</span>
                  <p className="text-zinc-100 font-semibold">
                    {chainMapData.resilience_score != null ? (chainMapData.resilience_score * 100).toFixed(0) + '%' : '—'}
                  </p>
                </div>
                <div className="p-3 rounded-md bg-zinc-800 border border-zinc-700">
                  <span className="text-zinc-500 text-xs block">Max tiers</span>
                  <p className="text-zinc-100 font-semibold">{chainMapData.max_tiers}</p>
                </div>
              </div>
              <div className="p-3 rounded-md bg-zinc-800 border border-zinc-700">
                <span className="text-zinc-400 text-xs font-medium block mb-2">Geographic distribution</span>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-200">
                  {chainMapFiltered.geographicSummary.length === 0 ? (
                    <span className="text-zinc-500">No data</span>
                  ) : (
                    chainMapFiltered.geographicSummary.map((g) => (
                      <span key={g.country_code}>
                        {g.country_code}: {g.supplier_count} ({g.share_pct.toFixed(0)}%)
                      </span>
                    ))
                  )}
                </div>
              </div>

              {Object.keys(chainMapData.tiers ?? {}).length > 0 && (
                <div className="mt-4">
                  <h4 className="text-zinc-300 text-sm font-medium mb-2">By tier</h4>
                  <div className="space-y-2">
                    {Object.entries(chainMapData.tiers).map(([tier, ids]) => (
                      <div key={tier} className="text-xs text-zinc-400">
                        <span className="text-zinc-300 font-medium">Tier {tier}:</span>{' '}
                        {ids?.length ?? 0} suppliers — {ids?.slice(0, 5).join(', ')}
                        {(ids?.length ?? 0) > 5 ? '…' : ''}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* Simulation result */}
          {simulateResult && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mb-6 p-6 rounded-md bg-zinc-800 border border-zinc-700"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-zinc-100 font-display font-semibold flex items-center gap-2">
                  <BoltIcon className="w-5 h-5" />
                  Simulation result
                  {(simulateResult as { demo_fallback?: boolean }).demo_fallback && (
                    <span className="text-amber-400/80 text-xs font-normal">(one supplier simulated as affected for demo)</span>
                  )}
                </h3>
                <button
                  onClick={() => setSimulateResult(null)}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-100"
                  aria-label="Close"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {/* Impact on key indicators — lead time, cost, financial result, other KPIs */}
              {(() => {
                const impact = simulateResult.impact as { affected_suppliers?: number; cost_increase_pct?: number; capacity_loss_pct?: number } | undefined
                const costAnalysis = simulateResult.cost_analysis as { estimated_cost_increase_pct?: number; estimated_revenue_impact_usd?: number; time_to_critical_days?: number } | undefined
                const kpi = simulateResult.kpi_impact as {
                  lead_time_delay_days?: number
                  lead_time_impact?: string
                  cost_increase_pct?: number
                  price_impact?: string
                  revenue_impact_usd?: number
                  margin_impact_pct?: number
                  financial_summary?: string
                  time_to_critical_days?: number
                  time_to_recovery_months?: number
                  capacity_loss_pct?: number
                  affected_suppliers_count?: number
                } | undefined
                const hasKpi = kpi != null
                const costPct = hasKpi ? kpi.cost_increase_pct : (impact?.cost_increase_pct ?? costAnalysis?.estimated_cost_increase_pct)
                const revenueImpact = hasKpi ? kpi.revenue_impact_usd : costAnalysis?.estimated_revenue_impact_usd
                const criticalDays = hasKpi ? kpi.time_to_critical_days : costAnalysis?.time_to_critical_days
                const affectedCount = hasKpi ? kpi.affected_suppliers_count : impact?.affected_suppliers
                const capacityLoss = hasKpi ? kpi.capacity_loss_pct : impact?.capacity_loss_pct
                if (costPct == null && revenueImpact == null && affectedCount == null) return null
                return (
                  <div className="mb-6 p-4 rounded-md bg-black/30 border border-zinc-700">
                    <h4 className="text-zinc-100 font-display font-medium mb-4">Impact on key indicators</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div className="p-3 rounded-md bg-zinc-800 border border-zinc-700">
                        <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Lead time</p>
                        <p className="text-amber-400/80 font-semibold">
                          +{hasKpi && kpi.lead_time_delay_days != null ? kpi.lead_time_delay_days : (affectedCount ? Math.min(90, 20 + (affectedCount * 10)) : 0)} days
                        </p>
                        <p className="text-zinc-400 text-xs mt-0.5">
                          {hasKpi ? (kpi.lead_time_impact ?? '—') : 'Est. delivery delay from route changes'}
                        </p>
                      </div>
                      <div className="p-3 rounded-md bg-zinc-800 border border-zinc-700">
                        <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Cost / Price</p>
                        <p className="text-amber-400/80 font-semibold">
                          +{(costPct ?? 0)}%
                        </p>
                        <p className="text-zinc-400 text-xs mt-0.5">
                          {hasKpi ? (kpi.price_impact ?? '—') : `BOM / supply cost increase up to +${costPct ?? 0}%`}
                        </p>
                      </div>
                      <div className="p-3 rounded-md bg-zinc-800 border border-zinc-700">
                        <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Financial result</p>
                        <p className="text-red-400/90 font-semibold">
                          ${Math.abs(revenueImpact ?? 0).toLocaleString()}
                        </p>
                        <p className="text-zinc-400 text-xs mt-0.5">
                          {hasKpi ? (kpi.financial_summary ?? '—') : 'Revenue impact (estimate)'}
                        </p>
                          {hasKpi && kpi.margin_impact_pct != null && (
                            <p className="text-zinc-500 text-xs mt-1">Margin: {kpi.margin_impact_pct}%</p>
                          )}
                      </div>
                      <div className="p-3 rounded-md bg-zinc-800 border border-zinc-700">
                        <p className="text-zinc-500 text-xs uppercase tracking-wider mb-1">Other indicators</p>
                        <p className="text-zinc-200 text-sm">
                          Affected suppliers: <span className="text-amber-400/80 font-medium">{affectedCount ?? 0}</span>
                        </p>
                        <p className="text-zinc-400 text-xs mt-1">
                          Time to critical: <span className="text-zinc-200">{criticalDays ?? 0} days</span>
                        </p>
                        {hasKpi && kpi.time_to_recovery_months != null && (
                          <p className="text-zinc-400 text-xs">
                            Recovery to ~80%: <span className="text-zinc-200">{kpi.time_to_recovery_months} mo.</span>
                          </p>
                        )}
                        <p className="text-zinc-400 text-xs">
                          Capacity loss: <span className="text-red-400/80">{capacityLoss ?? 0}%</span>
                        </p>
                      </div>
                    </div>
                  </div>
                )
              })()}

              {'impact' in simulateResult && simulateResult.impact != null && (
                <div className="mb-4 p-3 rounded-md bg-zinc-800">
                  <h4 className="text-zinc-300 text-sm font-medium mb-2">Impact</h4>
                  {typeof simulateResult.impact === 'string' ? (
                    <p className="text-zinc-200 text-sm">{simulateResult.impact}</p>
                  ) : (
                    <pre className="text-zinc-200 text-xs whitespace-pre-wrap">
                      {JSON.stringify(simulateResult.impact, null, 2)}
                    </pre>
                  )}
                </div>
              )}
              {'recovery_plan' in simulateResult && Array.isArray(simulateResult.recovery_plan) && (
                <div className="mb-4">
                  <h4 className="text-zinc-300 text-sm font-medium mb-2">Recovery plan</h4>
                  <ul className="list-disc list-inside text-zinc-300 text-sm space-y-1">
                    {(simulateResult.recovery_plan as string[]).map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}
              {'cost_analysis' in simulateResult && simulateResult.cost_analysis && (
                <div className="mb-4 p-3 rounded-md bg-zinc-800">
                  <h4 className="text-zinc-300 text-sm font-medium mb-2">Cost analysis</h4>
                  <pre className="text-zinc-300 text-xs whitespace-pre-wrap">
                    {JSON.stringify(simulateResult.cost_analysis, null, 2)}
                  </pre>
                </div>
              )}
              {'timeline' in simulateResult && Array.isArray(simulateResult.timeline) && (simulateResult.timeline as { month: number; capacity_pct: number }[]).length > 0 && (
                <div className="mb-4">
                  <h4 className="text-zinc-300 text-sm font-medium mb-2">Timeline (capacity %)</h4>
                  <div className="flex items-end gap-0.5 h-24">
                    {(simulateResult.timeline as { month: number; capacity_pct: number }[]).map((t) => (
                      <div
                        key={t.month}
                        className="flex-1 min-w-0 rounded-t bg-zinc-500 hover:bg-zinc-400 transition-colors"
                        style={{ height: `${Math.max(4, t.capacity_pct)}%` }}
                        title={`Month ${t.month}: ${t.capacity_pct}%`}
                      />
                    ))}
                  </div>
                  <div className="flex justify-between text-zinc-500 text-xs mt-1">
                    <span>M1</span>
                    <span>M{(simulateResult.timeline as { month: number }[]).length}</span>
                  </div>
                </div>
              )}
              {'mitigation_strategies' in simulateResult && Array.isArray(simulateResult.mitigation_strategies) && (simulateResult.mitigation_strategies as { name: string; cost_usd?: number; impact_reduction_pct?: number; roi?: number }[]).length > 0 && (
                <div className="p-3 rounded-md bg-zinc-800">
                  <h4 className="text-zinc-300 text-sm font-medium mb-2">Mitigation strategies</h4>
                  <ul className="space-y-2">
                    {(simulateResult.mitigation_strategies as { name: string; cost_usd?: number; impact_reduction_pct?: number; roi?: number }[]).map((m, i) => (
                      <li key={i} className="text-sm text-zinc-200 flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span>{m.name}</span>
                        {m.cost_usd != null && <span className="text-zinc-500">${(m.cost_usd / 1e6).toFixed(1)}M</span>}
                        {m.impact_reduction_pct != null && <span className="text-emerald-400/80">{m.impact_reduction_pct}% reduction</span>}
                        {m.roi != null && <span className="text-zinc-400">ROI {m.roi.toFixed(1)}x</span>}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div className="mt-4 flex flex-wrap gap-3">
                <SendToARINButton
                  sourceModule="scss"
                  objectType="supplier"
                  objectId={(simulateResult as { root_supplier_id?: string })?.root_supplier_id ?? `sim-${Date.now()}`}
                  inputData={simulateResult as Record<string, unknown>}
                  exportEntityId={(simulateResult as { root_supplier_id?: string })?.root_supplier_id ?? 'scss-sim'}
                  exportEntityType="portfolio"
                  exportAnalysisType="compliance_check"
                  exportData={{
                    risk_score: 55,
                    risk_level: 'MEDIUM',
                    summary: `SCSS simulation: ${(simulateResult as { scenario?: string }).scenario ?? 'supply chain'}.`,
                    recommendations: ['Review supplier exposure', 'Diversify sources'],
                    indicators: simulateResult as Record<string, unknown>,
                  }}
                  size="sm"
                />
                <ARINVerdictBadge entityId={(simulateResult as { root_supplier_id?: string })?.root_supplier_id ?? 'portfolio_global'} compact />
                <button
                  type="button"
                  onClick={() => {
                    const blob = new Blob([JSON.stringify(simulateResult, null, 2)], { type: 'application/json' })
                    const a = document.createElement('a')
                    a.href = URL.createObjectURL(blob)
                    a.download = `scss-simulation-${(simulateResult as { scenario?: string }).scenario ?? 'report'}-${Date.now()}.json`
                    a.click()
                    URL.revokeObjectURL(a.href)
                  }}
                  className="px-3 py-1.5 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm"
                >
                  Export report
                </button>
                <button
                  type="button"
                  onClick={() => navigate('/bcp-generator')}
                  className="px-3 py-1.5 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-100 text-sm"
                >
                  Create action plan
                </button>
              </div>
            </motion.div>
          )}

          {loading ? (
            <div className="p-8 text-center text-zinc-400">Loading suppliers…</div>
          ) : suppliers.length === 0 ? (
            <div className="p-8 rounded-md bg-zinc-800 border border-zinc-700 text-center text-zinc-400">
              No suppliers registered yet. Click “Register Supplier” to add one, then run “Analyze Bottlenecks” for chain-wide analysis.
            </div>
          ) : (
            <div className="rounded-md border border-zinc-700 overflow-hidden bg-zinc-800">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-700">
                    <th className="p-3 text-zinc-300 font-medium">Name</th>
                    <th className="p-3 text-zinc-300 font-medium">SCSS ID</th>
                    <th className="p-3 text-zinc-300 font-medium">Type</th>
                    <th className="p-3 text-zinc-300 font-medium">Tier</th>
                    <th className="p-3 text-zinc-300 font-medium">Country</th>
                    <th className="p-3 text-zinc-300 font-medium">Critical</th>
                    <th className="p-3 text-zinc-300 font-medium">Sovereignty</th>
                    <th className="p-3 text-zinc-300 font-medium">Geo risk</th>
                    <th className="p-3 text-zinc-300 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {suppliers.map((s) => (
                    <tr key={s.id} className="border-b border-zinc-800 hover:bg-zinc-800">
                      <td className="p-3 text-zinc-100">{s.name}</td>
                      <td className="p-3 text-zinc-400 font-mono text-xs">{s.scss_id}</td>
                      <td className="p-3 text-zinc-300">{s.supplier_type?.replace(/_/g, ' ') || '—'}</td>
                      <td className="p-3 text-zinc-300">{s.tier || '—'}</td>
                      <td className="p-3 text-zinc-300">{s.country_code || '—'}</td>
                      <td className="p-3 text-zinc-300">{s.is_critical ? 'Yes' : 'No'}</td>
                      <td className="p-3 text-zinc-300">
                        {s.sovereignty_score != null ? s.sovereignty_score.toFixed(0) : '—'}
                      </td>
                      <td className="p-3 text-zinc-300">
                        {s.geopolitical_risk != null ? s.geopolitical_risk.toFixed(0) : '—'}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleViewRoutes(s)}
                            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs border border-zinc-700"
                          >
                            Routes
                          </button>
                          <button
                            onClick={() => handleViewSovereignty(s)}
                            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs border border-zinc-700"
                          >
                            Sovereignty
                          </button>
                          <button
                            onClick={() => handleGetAlternatives(s)}
                            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs border border-zinc-700"
                          >
                            Alternatives
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Detail panels: Routes / Sovereignty / Bottlenecks / Alternatives */}
          {hasDetailPanel && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-8 p-6 rounded-md bg-zinc-800 border border-zinc-700"
            >
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <h2 className="text-zinc-100 font-display font-semibold">
                  {routesData !== null && 'Supply Routes'}
                  {sovereigntyData !== null && !sovereigntyData.error && 'Sovereignty Assessment'}
                  {sovereigntyData?.error && 'Sovereignty Error'}
                  {bottlenecksData !== null && 'Bottleneck Analysis'}
                  {alternativesData !== null && 'Alternative Suppliers'}
                </h2>
                <div className="flex items-center gap-2">
                  {(sovereigntyData ?? bottlenecksData ?? alternativesData) && (
                    <>
                      <SendToARINButton
                        sourceModule="scss"
                        objectType="supplier"
                        objectId={
                          sovereigntyData?.scss_id ??
                          alternativesData?.supplier_id ??
                          (bottlenecksData ? 'bottlenecks' : 'scss-report')
                        }
                        inputData={
                          (sovereigntyData ?? bottlenecksData ?? alternativesData) as Record<string, unknown>
                        }
                        exportEntityId={
                          sovereigntyData?.scss_id ??
                          alternativesData?.supplier_id ??
                          (bottlenecksData ? 'bottlenecks' : 'scss-report')
                        }
                        exportEntityType="portfolio"
                        exportAnalysisType="compliance_check"
                        exportData={{
                          risk_score: (sovereigntyData?.sovereignty_score ?? 0.5) * 100,
                          risk_level: (sovereigntyData?.sovereignty_score ?? 0) >= 0.7 ? 'HIGH' : (sovereigntyData?.sovereignty_score ?? 0) >= 0.4 ? 'MEDIUM' : 'LOW',
                          summary: sovereigntyData ? `SCSS sovereignty: ${sovereigntyData.name}, score ${(sovereigntyData.sovereignty_score ?? 0).toFixed(2)}.` : bottlenecksData ? 'SCSS bottlenecks report.' : 'SCSS alternatives report.',
                          recommendations: sovereigntyData?.recommendations ?? ['Review supply chain', 'Assess sovereignty'],
                          indicators: (sovereigntyData ?? bottlenecksData ?? alternativesData) as Record<string, unknown>,
                        }}
                        size="sm"
                      />
                    </>
                  )}
                  <button
                    onClick={closePanels}
                    className="p-1 rounded text-zinc-400 hover:text-zinc-100"
                    aria-label="Close"
                  >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              </div>

              {routesData !== null && selectedSupplier && (
                <div className="space-y-4">
                  <p className="text-zinc-300 text-sm">
                    Supplier: <span className="font-mono text-zinc-100">{selectedSupplier.scss_id}</span> — {selectedSupplier.name}
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="text-zinc-200 text-sm font-medium mb-2 flex items-center gap-2">
                        <MapIcon className="w-4 h-4" /> Outgoing ({routesData.outgoing.length})
                      </h3>
                      <ul className="space-y-1 text-sm text-zinc-400">
                        {routesData.outgoing.length === 0
                          ? 'None'
                          : routesData.outgoing.map((r) => (
                              <li key={r.id} className="font-mono text-xs flex items-center gap-2">
                                <LinkIcon className="w-3 h-3 flex-shrink-0" />
                                {r.source_id} → {r.target_id}
                                {r.transit_time_days != null && ` (${r.transit_time_days}d)`}
                                {r.is_primary && ' [primary]'}
                              </li>
                            ))}
                      </ul>
                    </div>
                    <div>
                      <h3 className="text-zinc-200 text-sm font-medium mb-2 flex items-center gap-2">
                        <MapIcon className="w-4 h-4" /> Incoming ({routesData.incoming.length})
                      </h3>
                      <ul className="space-y-1 text-sm text-zinc-400">
                        {routesData.incoming.length === 0
                          ? 'None'
                          : routesData.incoming.map((r) => (
                              <li key={r.id} className="font-mono text-xs flex items-center gap-2">
                                <LinkIcon className="w-3 h-3 flex-shrink-0" />
                                {r.source_id} → {r.target_id}
                                {r.transit_time_days != null && ` (${r.transit_time_days}d)`}
                              </li>
                            ))}
                      </ul>
                    </div>
                  </div>
                </div>
              )}

              {sovereigntyData !== null && !sovereigntyData.error && (
                <div className="space-y-2 text-sm">
                  <p className="text-zinc-200">
                    <span className="font-medium">{sovereigntyData.name ?? selectedSupplier?.name}</span>
                    {sovereigntyData.scss_id && (
                      <span className="text-zinc-400 font-mono ml-2">({sovereigntyData.scss_id})</span>
                    )}
                  </p>
                  <p className="text-zinc-300">
                    Sovereignty score: <strong className="text-zinc-100">{sovereigntyData.sovereignty_score?.toFixed(1) ?? '—'}</strong> (0–100)
                  </p>
                  {sovereigntyData.components && Object.keys(sovereigntyData.components).length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                      {Object.entries(sovereigntyData.components).map(([k, v]) => (
                        <div key={k} className="p-2 rounded bg-zinc-800">
                          <span className="text-zinc-500 text-xs">{k.replace(/_/g, ' ')}</span>
                          <p className="text-zinc-100">{typeof v === 'number' ? v.toFixed(1) : String(v)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  {sovereigntyData.recommendations && sovereigntyData.recommendations.length > 0 && (
                    <ul className="mt-2 space-y-1 text-zinc-400 text-xs">
                      {sovereigntyData.recommendations.map((rec, i) => (
                        <li key={i}>• {rec}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {sovereigntyData?.error && (
                <p className="text-amber-400/80 text-sm">{sovereigntyData.error}</p>
              )}

              {bottlenecksData !== null && (
                <div className="space-y-4">
                  {bottlenecksData.summary && (
                    <div className="flex flex-wrap gap-4 text-sm text-zinc-300">
                      <span>Analyzed: {bottlenecksData.total_suppliers_analyzed ?? 0}</span>
                      <span>Critical: {bottlenecksData.summary.critical ?? 0}</span>
                      <span>High: {bottlenecksData.summary.high ?? 0}</span>
                      <span>Medium: {bottlenecksData.summary.medium ?? 0}</span>
                      {bottlenecksData.diversification_score != null && (
                        <span className="text-emerald-300">
                          Diversification score: {(bottlenecksData.diversification_score * 100).toFixed(0)}%
                        </span>
                      )}
                      {bottlenecksData.bottleneck_score != null && (
                        <span className="text-amber-300">
                          Overall bottleneck score: {bottlenecksData.bottleneck_score.toFixed(2)}
                        </span>
                      )}
                    </div>
                  )}
                  {bottlenecksData.bottlenecks.length === 0 ? (
                    <p className="text-zinc-400 text-sm">No bottlenecks identified.</p>
                  ) : (
                    <ul className="space-y-3">
                      {bottlenecksData.bottlenecks.map((b) => (
                        <li
                          key={b.supplier_id}
                          className="p-3 rounded-md bg-zinc-800 border border-zinc-700"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-zinc-100 font-medium">{b.name}</span>
                            <span
                              className={`px-2 py-0.5 rounded text-xs ${
                                b.severity === 'critical'
                                  ? 'bg-red-500/20 text-red-300'
                                  : b.severity === 'high'
                                    ? 'bg-amber-500/20 text-amber-300'
                                    : 'bg-zinc-700 text-zinc-300'
                              }`}
                            >
                              {b.severity}
                            </span>
                          </div>
                          <p className="text-zinc-400 text-xs mt-1 font-mono">{b.scss_id} • {b.country_code ?? '—'}</p>
                          <p className="text-zinc-300 text-xs mt-1">
                            Score: {b.bottleneck_score?.toFixed(1) ?? '—'} • Downstream affected: {b.affected_downstream_count ?? 0}
                            {b.geopolitical_risk != null && ` • Geo risk: ${b.geopolitical_risk.toFixed(0)}`}
                          </p>
                          {b.risk_types?.length > 0 && (
                            <p className="text-zinc-500 text-xs mt-1">Risks: {b.risk_types.join(', ')}</p>
                          )}
                          {b.recommendations?.length > 0 && (
                            <ul className="mt-2 text-zinc-500 text-xs space-y-0.5">
                              {b.recommendations.slice(0, 3).map((r, i) => (
                                <li key={i}>• {r}</li>
                              ))}
                            </ul>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {alternativesData !== null && (
                <div className="space-y-4">
                  <p className="text-zinc-300 text-sm">
                    Alternatives for: <span className="font-medium text-zinc-100">{alternativesData.name}</span> ({alternativesData.scss_id})
                  </p>
                  {alternativesData.alternatives.length === 0 ? (
                    <p className="text-zinc-400 text-sm">No alternatives found.</p>
                  ) : (
                    <ul className="space-y-3">
                      {alternativesData.alternatives.map((alt) => (
                        <li
                          key={alt.supplier_id}
                          className="p-3 rounded-md bg-zinc-800 border border-zinc-700"
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-zinc-100 font-medium">{alt.name}</span>
                            <span className="text-zinc-300 text-xs font-mono">{alt.scss_id} • {alt.country_code ?? '—'}</span>
                            <span className="text-zinc-200 text-sm">Score: {alt.score?.toFixed(1) ?? '—'}</span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 text-xs">
                            {alt.pros?.length > 0 && (
                              <div>
                                <span className="text-green-400/80">Pros:</span>
                                <ul className="text-zinc-400 mt-0.5">
                                  {alt.pros.slice(0, 3).map((p, i) => (
                                    <li key={i}>• {p}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            {alt.cons?.length > 0 && (
                              <div>
                                <span className="text-zinc-400">Cons:</span>
                                <ul className="text-zinc-400 mt-0.5">
                                  {alt.cons.slice(0, 3).map((c, i) => (
                                    <li key={i}>• {c}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </motion.div>
          )}

          {/* Register modal */}
          {registerModalOpen && (
            <RegisterSupplierModal
              typeOptions={typeOptions}
              tierOptions={tierOptions}
              onClose={() => {
                setRegisterModalOpen(false)
                setFormError(null)
              }}
              onSubmit={handleRegisterSubmit}
              submitting={submitting}
              formError={formError}
            />
          )}

          {/* Simulate scenario modal */}
          {simulateModalOpen && (
            <SimulateScenarioModal
              suppliers={suppliers}
              initialRootSupplierId={chainMapData?.root_supplier_id ?? ''}
              onClose={() => setSimulateModalOpen(false)}
              onSubmit={async (body) => {
                await handleRunSimulate(body)
                setSimulateModalOpen(false)
              }}
              submitting={simulateLoading}
            />
          )}

          {/* API docs */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8 p-6 bg-zinc-800 rounded-md border border-zinc-700"
          >
            <h3 className="text-zinc-100 font-display font-semibold mb-4">API Endpoints</h3>
            <div className="space-y-3 font-mono text-sm text-zinc-300">
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-zinc-700 text-zinc-400 rounded text-xs">POST</span>
                <span>{module.apiPrefix}/suppliers</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded text-xs">GET</span>
                <span>{module.apiPrefix}/suppliers</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded text-xs">GET</span>
                <span>{module.apiPrefix}/suppliers/&#123;id&#125;/routes</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded text-xs">GET</span>
                <span>{module.apiPrefix}/suppliers/&#123;id&#125;/sovereignty</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded text-xs">GET</span>
                <span>{module.apiPrefix}/bottlenecks</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-zinc-700 text-zinc-400 rounded text-xs">POST</span>
                <span>{module.apiPrefix}/bottlenecks/analyze</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-zinc-700 text-zinc-400 rounded text-xs">POST</span>
                <span>{module.apiPrefix}/recommendations/alternative-suppliers</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded text-xs">GET</span>
                <span>{module.apiPrefix}/types</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded text-xs">GET</span>
                <span>{module.apiPrefix}/tiers</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AccessGate>
  )
}

function RegisterSupplierModal({
  typeOptions,
  tierOptions,
  onClose,
  onSubmit,
  submitting,
  formError,
}: {
  typeOptions: Array<{ value: string; name: string }>
  tierOptions: Array<{ value: string; name: string; description?: string }>
  onClose: () => void
  onSubmit: (data: {
    name: string
    supplier_type?: string
    tier?: string
    country_code?: string
    region?: string
    city?: string
    latitude?: number
    longitude?: number
    description?: string
    industry_sector?: string
    is_critical?: boolean
    materials?: string[]
    capacity?: number
    lead_time_days?: number
    geopolitical_risk?: number
  }) => Promise<void>
  submitting: boolean
  formError: string | null
}) {
  const [name, setName] = useState('')
  const [supplier_type, setSupplierType] = useState('other')
  const [tier, setTier] = useState('tier_1')
  const [country_code, setCountryCode] = useState('DE')
  const [region, setRegion] = useState('')
  const [city, setCity] = useState('')
  const [description, setDescription] = useState('')
  const [industry_sector, setIndustrySector] = useState('')
  const [is_critical, setIsCritical] = useState(false)
  const [latitude, setLatitude] = useState<number | ''>('')
  const [longitude, setLongitude] = useState<number | ''>('')
  const [materials, setMaterials] = useState('')
  const [capacity, setCapacity] = useState<number | ''>('')
  const [lead_time_days, setLeadTimeDays] = useState<number | ''>('')
  const [geopolitical_risk, setGeopoliticalRisk] = useState<number | ''>('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const materialsList = materials.trim() ? materials.split(',').map((s) => s.trim()).filter(Boolean) : undefined
    onSubmit({
      name: name.trim() || 'Unnamed',
      supplier_type,
      tier,
      country_code: country_code || 'DE',
      region: region || undefined,
      city: city || undefined,
      description: description || undefined,
      industry_sector: industry_sector || undefined,
      is_critical,
      latitude: latitude === '' ? undefined : Number(latitude),
      longitude: longitude === '' ? undefined : Number(longitude),
      materials: materialsList,
      capacity: capacity === '' ? undefined : Number(capacity),
      lead_time_days: lead_time_days === '' ? undefined : Number(lead_time_days),
      geopolitical_risk: geopolitical_risk === '' ? undefined : Number(geopolitical_risk),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-md shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 flex items-center justify-between border-b border-zinc-700">
          <h3 className="text-zinc-100 font-display font-semibold">Register Supplier</h3>
          <button onClick={onClose} className="p-1 rounded text-zinc-400 hover:text-zinc-100" aria-label="Close">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formError && (
            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              {formError}
            </div>
          )}
          <div>
            <label className="block text-zinc-300 text-sm mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500"
              placeholder="e.g. Acme Components GmbH"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-300 text-sm mb-1">Type</label>
              <select
                value={supplier_type}
                onChange={(e) => setSupplierType(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100"
              >
                {typeOptions.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.name}
                  </option>
                ))}
                {typeOptions.length === 0 && (
                  <>
                    <option value="raw_materials">Raw materials</option>
                    <option value="component">Component</option>
                    <option value="manufacturing">Manufacturing</option>
                    <option value="logistics">Logistics</option>
                    <option value="other">Other</option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="block text-zinc-300 text-sm mb-1">Tier</label>
              <select
                value={tier}
                onChange={(e) => setTier(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100"
              >
                {tierOptions.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.name}
                  </option>
                ))}
                {tierOptions.length === 0 && (
                  <>
                    <option value="tier_1">Tier 1</option>
                    <option value="tier_2">Tier 2</option>
                    <option value="tier_3">Tier 3</option>
                    <option value="tier_n">Tier N</option>
                  </>
                )}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-zinc-300 text-sm mb-1">Country code</label>
            <input
              type="text"
              value={country_code}
              onChange={(e) => setCountryCode(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500"
              placeholder="DE"
              maxLength={2}
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-300 text-sm mb-1">Region</label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-zinc-300 text-sm mb-1">City</label>
              <input
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500"
                placeholder="Optional"
              />
            </div>
          </div>
          <div>
            <label className="block text-zinc-300 text-sm mb-1">Industry sector</label>
            <input
              type="text"
              value={industry_sector}
              onChange={(e) => setIndustrySector(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500"
              placeholder="Optional"
            />
          </div>
          <div>
            <label className="block text-zinc-300 text-sm mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 resize-none"
              placeholder="Optional"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-300 text-sm mb-1">Latitude</label>
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-zinc-300 text-sm mb-1">Longitude</label>
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500"
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_critical"
              checked={is_critical}
              onChange={(e) => setIsCritical(e.target.checked)}
              className="rounded border-zinc-600 bg-zinc-800 text-zinc-100 focus:ring-white/20"
            />
            <label htmlFor="is_critical" className="text-zinc-300 text-sm">
              Critical supplier
            </label>
          </div>
          <div>
            <label className="block text-zinc-300 text-sm mb-1">Materials (comma-separated)</label>
            <input
              type="text"
              value={materials}
              onChange={(e) => setMaterials(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500"
              placeholder="e.g. lithium, cobalt"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-300 text-sm mb-1">Capacity (units/month)</label>
              <input
                type="number"
                min={0}
                value={capacity}
                onChange={(e) => setCapacity(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-zinc-300 text-sm mb-1">Lead time (days)</label>
              <input
                type="number"
                min={0}
                value={lead_time_days}
                onChange={(e) => setLeadTimeDays(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500"
                placeholder="Optional"
              />
            </div>
          </div>
          <div>
            <label className="block text-zinc-300 text-sm mb-1">Geopolitical risk (0–100)</label>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={geopolitical_risk}
              onChange={(e) => setGeopoliticalRisk(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500"
              placeholder="Optional"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-100 disabled:opacity-50"
            >
              {submitting ? 'Registering…' : 'Register'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function SimulateScenarioModal({
  suppliers,
  initialRootSupplierId = '',
  onClose,
  onSubmit,
  submitting,
}: {
  suppliers: SCSSSupplier[]
  initialRootSupplierId?: string
  onClose: () => void
  onSubmit: (body: Parameters<typeof scssApi.runSimulate>[0]) => Promise<void>
  submitting: boolean
}) {
  const [scenario, setScenario] = useState<'trade_war' | 'sanctions' | 'disaster'>('trade_war')
  const [country_code, setCountryCode] = useState('')
  const [country_codes_text, setCountryCodesText] = useState('')
  const [region, setRegion] = useState('')
  const [tariff_pct, setTariffPct] = useState<number | ''>('')
  const [severity, setSeverity] = useState<number | ''>('')
  const [root_supplier_id, setRootSupplierId] = useState(initialRootSupplierId)
  const [duration_months, setDurationMonths] = useState<number | ''>('')
  const [cascade, setCascade] = useState(true)

  useEffect(() => {
    setRootSupplierId(initialRootSupplierId)
  }, [initialRootSupplierId])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const country_codes = country_codes_text.trim()
      ? country_codes_text.split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)
      : undefined
    onSubmit({
      scenario,
      country_code: country_code || undefined,
      country_codes: country_codes?.length ? country_codes : undefined,
      region: region || undefined,
      tariff_pct: tariff_pct === '' ? undefined : Number(tariff_pct),
      severity: severity === '' ? undefined : Number(severity),
      root_supplier_id: root_supplier_id || undefined,
      duration_months: duration_months === '' ? undefined : Number(duration_months),
      cascade,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-md shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 flex items-center justify-between border-b border-zinc-700">
          <h3 className="text-zinc-100 font-display font-semibold">Geopolitical simulation</h3>
          <button onClick={onClose} className="p-1 rounded text-zinc-400 hover:text-zinc-100" aria-label="Close">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-zinc-300 text-sm mb-1">Scenario</label>
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value as 'trade_war' | 'sanctions' | 'disaster')}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100"
            >
              <option value="trade_war">Trade war</option>
              <option value="sanctions">Sanctions</option>
              <option value="disaster">Disaster</option>
            </select>
          </div>
          <div>
            <label className="block text-zinc-300 text-sm mb-1">Country code(s)</label>
            <input
              type="text"
              value={country_codes_text || country_code}
              onChange={(e) => {
                const v = e.target.value
                setCountryCodesText(v)
                if (v.length <= 2 && !v.includes(',')) setCountryCode(v)
              }}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500"
              placeholder="e.g. RU or RU, CN, TW"
            />
          </div>
          <div>
            <label className="block text-zinc-300 text-sm mb-1">Region</label>
            <input
              type="text"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500"
              placeholder="Optional"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-300 text-sm mb-1">Tariff %</label>
              <input
                type="number"
                min={0}
                step={0.1}
                value={tariff_pct}
                onChange={(e) => setTariffPct(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-zinc-300 text-sm mb-1">Severity (1–10, disaster)</label>
              <input
                type="number"
                min={1}
                max={10}
                step={0.5}
                value={severity}
                onChange={(e) => setSeverity(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500"
                placeholder="Optional"
              />
            </div>
          </div>
          <div>
            <label className="block text-zinc-300 text-sm mb-1">Root supplier (optional)</label>
            <select
              value={root_supplier_id}
              onChange={(e) => setRootSupplierId(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100"
            >
              <option value="">—</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.scss_id})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-zinc-300 text-sm mb-1">Duration (months)</label>
            <input
              type="number"
              min={1}
              value={duration_months}
              onChange={(e) => setDurationMonths(e.target.value === '' ? '' : Number(e.target.value))}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500"
              placeholder="Optional"
            />
          </div>
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="sim-cascade"
              checked={cascade}
              onChange={(e) => setCascade(e.target.checked)}
              className="rounded border-zinc-600 bg-zinc-800 text-zinc-100 focus:ring-white/20"
            />
            <label htmlFor="sim-cascade" className="text-zinc-300 text-sm">
              Cascading effects (timeline recovery)
            </label>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-100 disabled:opacity-50"
            >
              {submitting ? 'Running…' : 'Run simulation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
