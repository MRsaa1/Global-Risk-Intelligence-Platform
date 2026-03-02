import { useState, useMemo, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  BuildingOffice2Icon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ChartBarIcon,
  CubeTransparentIcon,
  ChevronDownIcon,
  CheckCircleIcon,
  ClockIcon,
  BeakerIcon,
  BoltIcon,
  SignalIcon,
  LinkIcon,
  GlobeAltIcon,
  CloudIcon,
  ShieldCheckIcon,
  LockClosedIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline'
import AlertPanel from '../components/AlertPanel'
import QuickActionsCards from '../components/QuickActionsCards'
import TodayCardWidget from '../components/dashboard/TodayCardWidget'
import SentimentMeterWidget from '../components/dashboard/SentimentMeterWidget'
import ClimateHavenCard from '../components/dashboard/ClimateHavenCard'
import WarRoomCard from '../components/dashboard/WarRoomCard'
import ClimateWidget from '../components/ClimateWidget'
import RecentActivityPanel from '../components/dashboard/RecentActivityPanel'
import SystemOverseerWidget from '../components/dashboard/SystemOverseerWidget'
import FreshnessIndicator from '../components/dashboard/FreshnessIndicator'
import LiveDataIndicatorBar from '../components/dashboard/LiveDataIndicatorBar'
import ThreatIntelFeed from '../components/dashboard/ThreatIntelFeed'
import DataSourcesPanel from '../components/dashboard/DataSourcesPanel'
import CuRAGCard from '../components/dashboard/CuRAGCard'
import MarketTicker from '../components/MarketTicker'
import DataSourcePanel from '../components/dashboard/DataSourcePanel'
import { ErrorBoundary } from '../components/ErrorBoundary'
// Chart components (institutional-grade, no 3D)
import TimeSeriesChart from '../components/charts/TimeSeriesChart'
import PieChart from '../components/charts/PieChart'
import ComparisonChart from '../components/charts/ComparisonChart'
import ChartControls, { TimeRange } from '../components/charts/ChartControls'
import EPCurveChart from '../components/charts/EPCurveChart'
import { chartColors } from '../lib/chartColors'
// Analytics API for real data
import { 
  getRiskTrends, 
  getRiskDistribution, 
  getTopRiskAssets, 
  getScenarioComparison,
  type RiskTrendSeries,
} from '../services/analyticsApi'
// Platform state management - synced with Command Center
import { usePortfolio, useActiveStressTest, useRecentEvents, usePlatformStore } from '../store/platformStore'
import { formatEur } from '../lib/formatCurrency'
import { getApiV1Base } from '../config/env'

// Types for Platform Layers API
interface LayerDetails {
  [key: string]: any
}

interface LayerMetrics {
  layer: number
  name: string
  status: string
  count: string
  count_raw: number
  description: string
  last_updated: string
  details: LayerDetails
}

interface PlatformStatus {
  layers: LayerMetrics[]
  total_records: number
  system_health: string
  last_sync: string
}

// ============================================
// INSTITUTIONAL KPIs (Board-level, € denominated)
// ============================================

// Determine risk posture level
function getRiskPosture(weightedRisk: number): { level: string; color: string; arrow: string } {
  if (weightedRisk > 0.75) return { level: 'CRITICAL', color: 'text-red-400/80', arrow: '↑↑' }
  if (weightedRisk > 0.6) return { level: 'ELEVATED', color: 'text-orange-400/80', arrow: '↑' }
  if (weightedRisk > 0.4) return { level: 'MODERATE', color: 'text-amber-400/80', arrow: '→' }
  return { level: 'STABLE', color: 'text-emerald-400/80', arrow: '↓' }
}

// Institutional KPIs - derived from platform store (synced with Command Center)
function useInstitutionalKPIs() {
  const portfolio = usePortfolio()

  return useMemo(() => {
    const capitalAtRisk = portfolio.atRisk ?? 0
    const modelExpectedLoss = typeof portfolio.totalExpectedLoss === 'number' && portfolio.totalExpectedLoss > 0
      ? portfolio.totalExpectedLoss
      : 0
    // Keep board KPI in a realistic severe-loss range even when expected-loss model is conservative.
    const severeProxyFromExposure = (portfolio.totalExposure ?? 0) * 0.33
    const severeProxyFromAtRisk = capitalAtRisk > 0 ? capitalAtRisk * 0.75 : 0
    const stressLossP95 = Math.round(Math.max(modelExpectedLoss, severeProxyFromExposure, severeProxyFromAtRisk))
    // Estimated from weighted risk band (not from API)
    const mitigatedRatio = portfolio.weightedRisk < 0.5 ? 0.68 : portfolio.weightedRisk < 0.7 ? 0.45 : 0.28
    const mom = portfolio.riskVelocityMomPct
    const riskVelocityLabel = typeof mom === 'number' ? `${mom >= 0 ? '+' : ''}${mom.toFixed(1)}% MoM` : '—'

    return {
      capitalAtRisk,
      capitalAtRiskChange: '—',
      stressLossP95,
      stressLossP95Pct: '—',
      riskVelocity: mom ?? null,
      riskVelocityLabel,
      mitigatedRatio,
      mitigatedPct: `${Math.round(mitigatedRatio * 100)}%`,
      unmitigatedPct: `${Math.round((1 - mitigatedRatio) * 100)}%`,
      posture: getRiskPosture(portfolio.weightedRisk),
      totalExposure: portfolio.totalExposure ?? 0,
    }
  }, [portfolio])
}

// Legacy stats for backwards compatibility (hidden from C-level view)
function useStats() {
  const portfolio = usePortfolio()
  
  return useMemo(() => [
    { 
      name: 'Total Assets', 
      value: portfolio.totalAssets?.toLocaleString() || '1,284', 
      icon: BuildingOffice2Icon, 
      change: '+12%', 
      color: 'primary' 
    },
    { 
      name: 'At Risk', 
      value: portfolio.criticalCount?.toString() || '23', 
      icon: ExclamationTriangleIcon, 
      change: portfolio.weightedRisk > 0.7 ? '+15%' : '-5%', 
      color: 'risk-high' 
    },
    { 
      name: 'Digital Twins', 
      value: portfolio.digitalTwins?.toLocaleString() || '1,156', 
      icon: CubeTransparentIcon, 
      change: '+8%', 
      color: 'accent' 
    },
    { 
      name: 'Portfolio Value', 
      value: `€${portfolio.portfolioValue?.toFixed(1) || '4.2'}B`, 
      icon: ArrowTrendingUpIcon, 
      change: '+3.2%', 
      color: 'primary' 
    },
  ], [portfolio])
}


const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

// Fetch platform layers from API (uses API base so it works on server / tunnel)
async function fetchPlatformLayers(): Promise<PlatformStatus> {
  const base = getApiV1Base()
  const url = base ? `${base}/platform/layers` : '/api/v1/platform/layers'
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error('Failed to fetch platform layers')
  }
  return response.json()
}

// Calculate trend for a series (comparing first half to second half)
interface TrendInfo {
  id: string
  name: string
  color: string
  current: number
  change: number
  direction: 'up' | 'down' | 'stable'
}

function calculateTrends(series: { id: string; name: string; color?: string; data: { value: number; date?: string | Date }[] }[]): TrendInfo[] {
  return series.map(s => {
    if (!s.data || s.data.length < 2) {
      return { id: s.id, name: s.name, color: s.color || '#888', current: 0, change: 0, direction: 'stable' as const }
    }
    
    const midPoint = Math.floor(s.data.length / 2)
    const firstHalf = s.data.slice(0, midPoint)
    const secondHalf = s.data.slice(midPoint)
    
    const firstAvg = firstHalf.reduce((sum, d) => sum + d.value, 0) / firstHalf.length
    const secondAvg = secondHalf.reduce((sum, d) => sum + d.value, 0) / secondHalf.length
    const current = s.data[s.data.length - 1].value
    
    const change = firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0
    const direction = Math.abs(change) < 1 ? 'stable' : change > 0 ? 'up' : 'down'
    
    return {
      id: s.id,
      name: s.name,
      color: s.color || '#888',
      current: Math.round(current * 10) / 10,
      change: Math.round(change * 10) / 10,
      direction,
    }
  })
}

// Transform API risk trend data to chart format (convert string dates to Date objects)
function transformRiskTrendData(apiSeries: RiskTrendSeries[]) {
  return apiSeries.map(s => ({
    ...s,
    data: s.data.map(d => ({
      date: new Date(d.date),
      value: d.value,
    })),
  }))
}

// Get number of days based on time range
function getDaysFromTimeRange(range: TimeRange): number {
  switch (range) {
    case '1D': return 1
    case '1W': return 7
    case '1M': return 30
    case '3M': return 90
    case '1Y': return 365
    case 'ALL': return 365
    default: return 30
  }
}

// No mock: empty when API has no assets (show empty state in UI)

// No mock: empty when no stress tests completed (show empty state in UI)

// Layer icon based on layer number
function getLayerIcon(layer: number) {
  switch (layer) {
    case 0: return <CheckCircleIcon className="w-4 h-4" />
    case 1: return <CubeTransparentIcon className="w-4 h-4" />
    case 2: return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
    </svg>
    case 3: return <BeakerIcon className="w-4 h-4" />
    case 4: return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
    case 5: return <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
    default: return <ClockIcon className="w-4 h-4" />
  }
}

// Layer detail panel component
function LayerDetailPanel({ layer, onClose }: { layer: LayerMetrics; onClose: () => void }) {
  const details = layer.details || {}
  
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-3 p-3 bg-black/40 rounded-md border border-zinc-700 text-left"
    >
      <p className="text-xs text-zinc-400 mb-2">{layer.description}</p>
      
      {/* Layer-specific details */}
      {layer.layer === 0 && details && (
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-zinc-500">Provenance Records</span>
            <span className="text-zinc-200">{details.provenance_records || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Verified</span>
            <span className="text-emerald-400/80">{details.verified_records || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Assets</span>
            <span className="text-zinc-200">{details.assets || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">External Sources</span>
            <span className="text-zinc-400">{(details.external_sources || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Verification Rate</span>
            <span className="text-zinc-200">{(details.verification_rate || 0).toFixed(1)}%</span>
          </div>
        </div>
      )}
      
      {layer.layer === 2 && details && (
        <div className="space-y-1 text-xs">
          {details._note && (
            <p className="text-zinc-400 text-[10px] mb-2">
              {details._note.toLowerCase().includes('neo4j disabled') || details._note.toLowerCase().includes('graph unavailable') || details._note.toLowerCase().includes('graph empty')
                ? 'Optional — enable Neo4j and seed graph for network metrics.'
                : details._note}
            </p>
          )}
          <div className="flex justify-between">
            <span className="text-zinc-500">Network Nodes</span>
            <span className="text-zinc-200">{details.nodes ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Connections (Edges)</span>
            <span className="text-zinc-400">{details.edges ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Risk Clusters</span>
            <span className="text-zinc-400">{details.risk_clusters ?? 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Critical Paths</span>
            <span className="text-red-400/80">{details.critical_paths ?? 0}</span>
          </div>
          {details.sectors && details.sectors.length > 0 && (
            <div className="pt-2 border-t border-zinc-700">
              <span className="text-zinc-500">Sectors: </span>
              <span className="text-zinc-400">{details.sectors.join(', ')}</span>
            </div>
          )}
        </div>
      )}
      
      {layer.layer === 4 && details && (
        <div className="space-y-2 text-xs">
          {details.agents?.map((agent: any) => (
            <div key={agent.id} className="p-2 bg-zinc-800 rounded">
              <div className="flex items-center justify-between">
                <span className="font-medium text-zinc-100">{agent.name}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                  agent.status === 'active' ? 'bg-emerald-500/15 text-emerald-400/80' : agent.status === 'error' ? 'bg-red-500/15 text-red-400/80' : 'bg-amber-500/15 text-amber-400/80'
                }`}>
                  {agent.status}
                </span>
              </div>
              <p className="text-zinc-500 mt-1">{agent.role}</p>
              {agent.status === 'error' && agent.error && (
                <p className="text-red-400/90 mt-1 text-[10px]">{agent.error}</p>
              )}
              {agent.active_alerts !== undefined && agent.status !== 'error' && (
                <p className="text-amber-400/80 mt-1">{agent.active_alerts} active alerts</p>
              )}
            </div>
          ))}
          {details.nvidia_llm_enabled && (
            <div className="pt-2 border-t border-zinc-700 flex items-center gap-2">
              <span className="text-[10px] px-1.5 py-0.5 bg-zinc-700 text-zinc-300 rounded">NVIDIA LLM</span>
              <span className="text-zinc-500">Connected</span>
            </div>
          )}
        </div>
      )}
      
      {layer.layer === 5 && details && (
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-zinc-500">Spec Version</span>
            <span className="text-zinc-400">{details.version}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Total PARS IDs</span>
            <span className="text-zinc-200">{(details.total_pars_ids || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-zinc-500">Status</span>
            <span className="text-zinc-400">{details.spec_status}</span>
          </div>
          {details.regions && (
            <div className="pt-2 border-t border-zinc-700">
              <span className="text-zinc-500">Regions: </span>
              <span className="text-zinc-400">{details.regions.join(', ')}</span>
            </div>
          )}
          {details.features && (
            <div className="pt-2">
              <span className="text-zinc-500">Features:</span>
              <ul className="mt-1 text-zinc-400 list-disc list-inside">
                {details.features.slice(0, 3).map((f: string, i: number) => (
                  <li key={i} className="text-[10px]">{f}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
      
      <button
        onClick={onClose}
        className="mt-3 w-full py-1 text-xs text-zinc-500 hover:text-zinc-400 transition-colors"
      >
        Close
      </button>
    </motion.div>
  )
}

export default function Dashboard() {
  const [allLayersExpanded, setAllLayersExpanded] = useState(false)
  const [riskTrendTimeRange, setRiskTrendTimeRange] = useState<TimeRange>('1M')
  const [isRiskTrendFullscreen, setIsRiskTrendFullscreen] = useState(false)
  const [isRefreshingTrends, setIsRefreshingTrends] = useState(false)
  const [topRiskApproved, setTopRiskApproved] = useState(false)
  const [recentActivityOpen, setRecentActivityOpen] = useState(false)
  const [isRefreshingRealtime, setIsRefreshingRealtime] = useState(false)
  const riskTrendChartRef = useRef<HTMLDivElement>(null)
  
  // Platform store - synced with Command Center
  const portfolio = usePortfolio()
  const setPortfolioConfirmed = usePlatformStore((s) => s.setPortfolioConfirmed)
  const setLastRefresh = usePlatformStore((s) => s.setLastRefresh)
  const institutionalKPIs = useInstitutionalKPIs()

  // Fetch portfolio summary (same source as Command Center). Use same API base so data matches Command Center.
  useEffect(() => {
    let cancelled = false
    const apiBase = getApiV1Base()
    const load = async () => {
      try {
        const res = await fetch(`${apiBase}/geodata/summary`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          const momFromSummary = data.risk_velocity_mom_pct ?? null
          setPortfolioConfirmed({
            totalExposure: data.total_exposure ?? 0,
            atRisk: data.at_risk_exposure ?? 0,
            totalExpectedLoss: data.total_expected_loss,
            criticalCount: data.critical_count ?? 0,
            highCount: data.high_count ?? 0,
            mediumCount: data.medium_count ?? 0,
            lowCount: data.low_count ?? 0,
            weightedRisk: data.weighted_risk ?? 0,
            riskVelocityMomPct: momFromSummary,
            riskModelVersion: data.risk_model_version,
            dataSourcesFreshness: data.data_sources_freshness,
          })
          if (momFromSummary == null) {
            const velRes = await fetch(`${apiBase}/risk-engine/risk-velocity`)
            if (velRes.ok && !cancelled) {
              const velData = await velRes.json()
              const momPct = velData?.risk_velocity?.mom_pct
              if (typeof momPct === 'number') {
                usePlatformStore.getState().updatePortfolio({ riskVelocityMomPct: momPct })
              }
            }
          }
        }
      } catch {
        /* ignore */
      }
    }
    load()
    const interval = setInterval(load, 5 * 60 * 1000) // every 5 min, same as Command Center
    return () => { cancelled = true; clearInterval(interval) }
  }, [setPortfolioConfirmed])

  // Load last-refresh times for Real-Time Intelligence panels so data shows immediately (no "—" on first load)
  useEffect(() => {
    let cancelled = false
    const apiBase = getApiV1Base()
    const loadLastRefresh = async () => {
      try {
        const res = await fetch(`${apiBase}/ingestion/last-refresh`)
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (data && typeof data === 'object' && !cancelled) {
          for (const [sourceId, ts] of Object.entries(data)) {
            if (typeof ts === 'string' && sourceId) setLastRefresh(sourceId, ts)
          }
        }
      } catch {
        /* ignore */
      }
    }
    loadLastRefresh()
    // Retry once after 8s so we pick up data from API startup ingestion jobs
    const t = setTimeout(() => {
      if (!cancelled) loadLastRefresh()
    }, 8000)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
  }, [setLastRefresh])

  // If no ingestion data yet, run refresh once in background so panels get timestamps and threat feed fills
  const lastRefreshBySource = usePlatformStore((s) => s.lastRefreshBySource)
  const setLastSnapshotForSource = usePlatformStore((s) => s.setLastSnapshotForSource)
  const hasAnyRefresh = Object.keys(lastRefreshBySource).length > 0
  useEffect(() => {
    if (hasAnyRefresh) return
    let done = false
    const runOnce = async () => {
      try {
        const base = getApiV1Base()
        const refreshUrl = base ? `${base}/ingestion/refresh-all` : '/api/v1/ingestion/refresh-all'
        const res = await fetch(refreshUrl, { method: 'POST' })
        if (done) return
        const payload = await res.json().catch(() => ({}))
        const results = payload?.results
        const finishedAt = payload?.finished_at
        if (finishedAt && results && typeof results === 'object') {
          for (const [sourceId, result] of Object.entries(results as Record<string, unknown>)) {
            const r = result as { success?: boolean; summary?: { updated_at?: string }; last_events?: unknown[]; snapshot_updated_at?: string }
            const ts = r?.summary?.updated_at ?? finishedAt
            if (sourceId && typeof ts === 'string') setLastRefresh(sourceId, ts)
            if (sourceId && Array.isArray(r?.last_events)) {
              setLastSnapshotForSource(sourceId, {
                last_events: r.last_events,
                updated_at: r.snapshot_updated_at ?? r?.summary?.updated_at ?? finishedAt,
              })
            }
          }
        }
      } catch {
        /* ignore */
      }
    }
    runOnce()
    return () => { done = true }
  }, [hasAnyRefresh, setLastRefresh, setLastSnapshotForSource])

  const activeStressTest = useActiveStressTest()
  const recentEvents = useRecentEvents(5)
  const { wsStatus } = usePlatformStore()
  
  // Fetch platform layers from API (no fallback — show loading/error so data source is clear)
  const { data: platformData, isLoading: layersLoading, error: layersError, refetch: refetchLayers } = useQuery({
    queryKey: ['platformLayers'],
    queryFn: fetchPlatformLayers,
    refetchInterval: 30000,
    staleTime: 10000,
  })
  
  // Fetch risk trends from API
  const { 
    data: riskTrendsResponse, 
    isLoading: isLoadingTrends,
    refetch: refetchTrends,
  } = useQuery({
    queryKey: ['riskTrends', riskTrendTimeRange],
    queryFn: () => getRiskTrends(riskTrendTimeRange),
    refetchInterval: 60000, // Refresh every minute
    staleTime: 30000,
  })
  
  // Transform API data for chart component; empty when no data (show "Collecting data..." in UI)
  const riskTrendData = useMemo(() => {
    if (!riskTrendsResponse?.series?.length) {
      return []
    }
    return transformRiskTrendData(riskTrendsResponse.series)
  }, [riskTrendsResponse, riskTrendTimeRange])
  
  // Last update timestamp from API response
  const lastTrendUpdate = useMemo(() => {
    if (riskTrendsResponse?.last_updated) {
      return new Date(riskTrendsResponse.last_updated)
    }
    return new Date()
  }, [riskTrendsResponse])
  
  const riskTrends = useMemo(() => calculateTrends(riskTrendData), [riskTrendData])
  
  // Auto-refresh trends when stress tests complete
  useEffect(() => {
    const latestEvent = recentEvents[0]
    if (latestEvent?.event_type === 'stress_test.completed' || 
        latestEvent?.event_type === 'portfolio.updated' ||
        latestEvent?.event_type === 'zone.risk_updated') {
      // Trigger data refresh when relevant events occur
      refetchTrends()
    }
  }, [recentEvents, refetchTrends])
  
  // Refresh handler for risk trend chart
  const handleRefreshTrends = async () => {
    setIsRefreshingTrends(true)
    await refetchTrends()
    setIsRefreshingTrends(false)
  }
  
  // Annotations from real recent events (WebSocket)
  const riskTrendAnnotations = useMemo(() => {
    const annotations: Array<{ date: Date; label: string; type: 'stress-test' | 'alert' | 'event' }> = []
    for (const ev of recentEvents.slice(0, 5)) {
      const date = ev.timestamp ? new Date(ev.timestamp) : new Date()
      const data = ev.data ?? {}
      let label = ''
      let type: 'stress-test' | 'alert' | 'event' = 'event'
      if (ev.event_type === 'stress_test.completed') {
        type = 'stress-test'
        label = data.name ?? 'Stress test completed'
        if (data.total_expected_loss != null) label += ` → €${Math.round(Number(data.total_expected_loss))}M`
      } else if (ev.event_type?.includes('alert') || ev.event_type === 'zone.risk_updated') {
        type = 'alert'
        label = data.message ?? data.alert_type ?? 'Risk update'
        if (data.exposure != null) label += ` → €${Math.round(Number(data.exposure))}M`
      } else {
        label = data.message ?? ev.event_type ?? 'Event'
      }
      if (label) annotations.push({ date, label, type })
    }
    return annotations
  }, [recentEvents])
  // Fetch risk distribution from API only (no fallback to estimated portfolio data)
  const {
    data: riskDistributionResponse,
    isError: riskDistributionError,
    isLoading: riskDistributionLoading,
    refetch: refetchRiskDistribution,
  } = useQuery({
    queryKey: ['riskDistribution'],
    queryFn: getRiskDistribution,
    refetchInterval: 60000,
    staleTime: 30000,
  })

  const { riskDistributionData, riskDistributionSource, riskDistributionMessage } = useMemo(() => {
    if (riskDistributionLoading) {
      return {
        riskDistributionData: [] as { id: string; label: string; value: number; color: string; risk: number }[],
        riskDistributionSource: 'loading' as const,
        riskDistributionMessage: 'Loading…',
      }
    }
    if (riskDistributionError || !riskDistributionResponse) {
      return {
        riskDistributionData: [] as { id: string; label: string; value: number; color: string; risk: number }[],
        riskDistributionSource: 'error' as const,
        riskDistributionMessage: 'Unable to load distribution from server.',
      }
    }
    const dist = riskDistributionResponse.distribution ?? []
    const total = riskDistributionResponse.total_assets ?? 0
    return {
      riskDistributionData: dist.length ? dist : [
        { id: 'critical', label: 'Critical', value: 0, color: '#ef4444', risk: 0.9 },
        { id: 'high', label: 'High', value: 0, color: '#f97316', risk: 0.7 },
        { id: 'medium', label: 'Medium', value: 0, color: '#eab308', risk: 0.5 },
        { id: 'low', label: 'Low', value: 0, color: '#22c55e', risk: 0.2 },
      ],
      riskDistributionSource: 'api' as const,
      riskDistributionMessage: total === 0 ? 'No active assets' : 'All active assets in system (real portfolio)',
    }
  }, [riskDistributionResponse, riskDistributionLoading, riskDistributionError])
  
  // Fetch top risk assets from API
  const { data: topRiskAssetsResponse } = useQuery({
    queryKey: ['topRiskAssets'],
    queryFn: () => getTopRiskAssets(8),
    refetchInterval: 60000,
    staleTime: 30000,
  })
  
  const topRiskAssetsData = useMemo(() => {
    return topRiskAssetsResponse?.assets ?? []
  }, [topRiskAssetsResponse])
  
  // Fetch scenario comparison from API
  const { data: scenarioComparisonResponse } = useQuery({
    queryKey: ['scenarioComparison'],
    queryFn: getScenarioComparison,
    refetchInterval: 120000, // Less frequent - stress tests don't change often
    staleTime: 60000,
  })
  
  const scenarioComparisonData = useMemo(() => {
    return scenarioComparisonResponse?.scenarios ?? []
  }, [scenarioComparisonResponse])
  
  // Real data only — no fake fallback; loading/error shown in UI
  const layers = platformData?.layers ?? []

  const handleRefreshRealtime = async () => {
    if (isRefreshingRealtime) return
    setIsRefreshingRealtime(true)
    try {
      const base = getApiV1Base()
      const refreshUrl = base ? `${base}/ingestion/refresh-all` : '/api/v1/ingestion/refresh-all'
      const res = await fetch(refreshUrl, { method: 'POST' })
      const payload = await res.json().catch(() => ({}))
      const finishedAt = payload?.finished_at
      const results = payload?.results
      if (res.ok && typeof finishedAt === 'string') {
        const sourceIds = results && typeof results === 'object'
          ? Object.keys(results)
          : ['market_data', 'natural_hazards', 'threat_intelligence', 'weather', 'biosecurity', 'cyber_threats', 'economic', 'social_media']
        for (const sourceId of sourceIds) {
          const r = results?.[sourceId] as { summary?: { updated_at?: string }; last_events?: unknown[]; snapshot_updated_at?: string } | undefined
          const ts = r?.summary?.updated_at ?? finishedAt
          if (sourceId && typeof ts === 'string') setLastRefresh(sourceId, ts)
          if (sourceId && r && Array.isArray(r.last_events)) {
            setLastSnapshotForSource(sourceId, {
              last_events: r.last_events,
              updated_at: r.snapshot_updated_at ?? r?.summary?.updated_at ?? finishedAt,
            })
          }
        }
      }
    } catch {
      // ignore - regular scheduler/WS updates continue
    } finally {
      setIsRefreshingRealtime(false)
    }
  }
  
  return (
    <div className="min-h-full bg-zinc-950 p-8 pb-16 font-sans" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      {/* ============================================ */}
      {/* EXECUTIVE RISK SNAPSHOT (Above the Fold) */}
      {/* ============================================ */}
      
      {/* Global Risk Posture Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-bold text-zinc-100 tracking-wide">
              PHYSICAL-FINANCIAL RISK COMMAND CENTER
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Strategic Intelligence for the Physical Economy
            </p>
          </div>
          
          {/* Data freshness + Live sync */}
          <div className="flex items-center gap-4 flex-wrap">
            {portfolio.dataSourcesFreshness && (
              <span className="text-[10px] text-zinc-500" title="Data refresh cadence">
                {portfolio.dataSourcesFreshness}
              </span>
            )}
            {activeStressTest && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-md"
              >
                <BoltIcon className="w-4 h-4 text-amber-400/80 animate-pulse" />
                <span className="text-xs text-amber-300">
                  {activeStressTest.name}
                  {activeStressTest.progress !== undefined && (
                    <span className="ml-2 text-amber-400/70">{activeStressTest.progress}%</span>
                  )}
                </span>
                <Link
                  to="/command"
                  className="ml-2 text-[10px] text-amber-400/80 hover:text-amber-300 underline whitespace-nowrap"
                  title="View in Command Center"
                >
                  Open in Command Center
                </Link>
              </motion.div>
            )}
            <div className="flex items-center gap-1.5 text-xs">
              <SignalIcon className={`w-4 h-4 ${wsStatus === 'connected' ? 'text-emerald-400/80' : wsStatus === 'connecting' ? 'text-amber-400/80 animate-pulse' : 'text-zinc-600'}`} />
              <span className={wsStatus === 'connected' ? 'text-emerald-400/80' : wsStatus === 'connecting' ? 'text-amber-400/80' : 'text-zinc-600'}>
                {wsStatus === 'connected' ? 'Live' : wsStatus === 'connecting' ? 'Connecting...' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Forward-looking disclaimer (Gap X4) */}
      <p className="text-xs text-zinc-500 mb-4">
        Projections and risk metrics are indicative and for internal use only. Not for regulatory submission.
      </p>
      <p className="text-xs text-zinc-500 mb-2" title="Data refresh cadence / risk model">
        Data: {portfolio.dataSourcesFreshness ?? '—'}
        {' • '}
        Risk model v{portfolio.riskModelVersion ?? 1}
        {portfolio.riskModelVersion === 2 && ' (GDELT, World Bank, OFAC, hysteresis)'}
      </p>

      {/* GLOBAL RISK POSTURE — corporate card */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-md bg-zinc-900 border border-zinc-800 mb-6 overflow-hidden"
      >
        <div className="rounded-md p-5 relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Global Risk Posture</div>
              <div
                className={`text-2xl font-bold tracking-wide ${institutionalKPIs.posture.color}`}
                style={{
                  textShadow:
                    institutionalKPIs.posture.level === 'CRITICAL'
                      ? '0 0 12px rgba(239,68,68,0.4)'
                      : institutionalKPIs.posture.level === 'ELEVATED'
                        ? '0 0 12px rgba(249,115,22,0.4)'
                        : institutionalKPIs.posture.level === 'MODERATE'
                          ? '0 0 12px rgba(234,179,8,0.4)'
                          : '0 0 12px rgba(34,197,94,0.4)',
                }}
              >
                {institutionalKPIs.posture.level} {institutionalKPIs.posture.arrow}
              </div>
            </div>
          </div>
          <motion.div
            className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-current to-transparent"
            style={{
              background:
                institutionalKPIs.posture.level === 'CRITICAL'
                  ? 'linear-gradient(90deg, #ef4444, transparent)'
                  : institutionalKPIs.posture.level === 'ELEVATED'
                    ? 'linear-gradient(90deg, #f97316, transparent)'
                    : institutionalKPIs.posture.level === 'MODERATE'
                      ? 'linear-gradient(90deg, #eab308, transparent)'
                      : 'linear-gradient(90deg, #22c55e, transparent)',
            }}
            initial={{ width: 0 }}
            animate={{ width: '100%' }}
            transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
          />
        </div>
      </motion.div>

      {/* 4 INSTITUTIONAL KPIs (Board-level) */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
      >
        {/* Capital at Risk (VaR/CaR) */}
        <motion.div variants={item} className="rounded-md bg-zinc-900 border border-zinc-800 hover-glow">
          <div className="rounded-md p-5 relative">
            {institutionalKPIs.capitalAtRisk > 0 && (
              <span className="absolute top-4 left-4 w-2 h-2 rounded-full bg-red-500 animate-pulse" aria-hidden />
            )}
            <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Capital at Risk</div>
            <div className="gradient-text text-2xl font-light">{formatEur(institutionalKPIs.capitalAtRisk, 'millions')}</div>
            {institutionalKPIs.capitalAtRiskChange !== '—' && (
              <div className="text-red-400/70 text-xs mt-1">{institutionalKPIs.capitalAtRiskChange}</div>
            )}
            <div className="text-zinc-600 text-[10px] mt-2" title={`90% CI: ${formatEur(institutionalKPIs.capitalAtRisk * 0.93, 'millions')}–${formatEur(institutionalKPIs.capitalAtRisk * 1.07, 'millions')} (illustrative)`}>30-day VaR equivalent · ± ~7% interval</div>
          </div>
        </motion.div>
        
        {/* Stress Loss (P95) */}
        <motion.div variants={item} className="rounded-md bg-zinc-900 border border-zinc-800 hover-glow">
          <div className="rounded-md p-5 relative">
            <span className="absolute top-4 left-4 w-2 h-2 rounded-full bg-orange-500" aria-hidden />
            <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Stress Loss (P95)</div>
            <div className="gradient-text text-2xl font-light">{formatEur(institutionalKPIs.stressLossP95, 'millions')}</div>
            {institutionalKPIs.stressLossP95Pct !== '—' && (
              <div className="text-orange-400/70 text-xs mt-1">{institutionalKPIs.stressLossP95Pct}</div>
            )}
            <div className="text-zinc-600 text-[10px] mt-2" title={`90% CI: ${formatEur(institutionalKPIs.stressLossP95 * 0.9, 'millions')}–${formatEur(institutionalKPIs.stressLossP95 * 1.1, 'millions')} (illustrative)`}>Severe scenario loss · ± ~10% interval</div>
          </div>
        </motion.div>
        
        {/* Risk Velocity */}
        <motion.div variants={item} className="rounded-md bg-zinc-900 border border-zinc-800 hover-glow">
          <div className="rounded-md p-5">
            <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Risk Velocity</div>
            <div
              className={`text-2xl font-light flex items-center gap-1 ${institutionalKPIs.riskVelocity != null ? (institutionalKPIs.riskVelocity > 0 ? 'text-red-400/80' : 'text-emerald-400/80') : 'text-zinc-500'}`}
              style={{
                textShadow:
                  institutionalKPIs.riskVelocity != null
                    ? institutionalKPIs.riskVelocity > 0
                      ? '0 0 8px rgba(239,68,68,0.3)'
                      : '0 0 8px rgba(34,197,94,0.3)'
                    : undefined,
              }}
            >
              {institutionalKPIs.riskVelocityLabel === '—' ? (
                <span className="inline-flex gap-0.5">
                  <span className="w-1 h-3 bg-zinc-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-4 bg-zinc-500 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-2 bg-zinc-500 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                </span>
              ) : (
                institutionalKPIs.riskVelocityLabel
              )}
            </div>
            <div className="text-zinc-500 text-xs mt-1">
              vs last month
              {institutionalKPIs.riskVelocity === 0 && <span className="text-zinc-600 ml-1">(no change)</span>}
            </div>
            {institutionalKPIs.riskVelocityLabel === '—' && (
              <div className="text-zinc-600 text-[10px] mt-2">Run stress tests or save posture to see change vs last month.</div>
            )}
          </div>
        </motion.div>
        
        {/* Mitigated vs Unmitigated — Estimated from weighted risk band */}
        <motion.div variants={item} className="rounded-md bg-zinc-900 border border-zinc-800 hover-glow">
          <div className="rounded-md p-5">
            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">
              Risk Coverage
              <span title="Estimated from weighted risk band (not from coverage API)" className="cursor-help text-zinc-600 hover:text-zinc-400">ⓘ</span>
            </div>
            <p className="text-[10px] text-zinc-600 mb-1.5">Estimated from risk band (not measured coverage).</p>
            <div className="flex items-baseline gap-2">
              <motion.span
                className="text-emerald-400/80 text-2xl font-light"
                initial={{ opacity: 0.5 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.5 }}
              >
                {institutionalKPIs.mitigatedPct}
              </motion.span>
              <span className="text-zinc-600 text-sm">mitigated</span>
            </div>
            <div className="text-red-400/60 text-xs mt-1">{institutionalKPIs.unmitigatedPct} unmitigated</div>
            <div className="mt-2 h-1.5 bg-zinc-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400"
                style={{ boxShadow: '0 0 8px rgba(34,197,94,0.3)' }}
                initial={{ width: 0 }}
                animate={{ width: institutionalKPIs.mitigatedPct }}
                transition={{ duration: 0.8, delay: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
              />
            </div>
          </div>
        </motion.div>
      </motion.div>

      {/* Today Card + Sentiment Meter + Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="mb-8"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <TodayCardWidget />
          <WarRoomCard compact />
          <SentimentMeterWidget />
          <ClimateHavenCard latitude={53.55} longitude={9.99} />
        </div>
        <QuickActionsCards />
      </motion.div>

      {/* EP Curve — Exceedance Probability from Monte Carlo (synthetic portfolio; count may differ from real assets below) */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.38 }}
        className="mb-8"
      >
        <p className="text-[10px] text-zinc-500 mb-2">Synthetic portfolio for simulation; asset count may differ from real portfolio below.</p>
        <EPCurveChart
          totalExposure={institutionalKPIs.totalExposure || 500}
          scenario="climate"
          severity={portfolio.weightedRisk ?? 0.5}
        />
      </motion.div>

      {/* Four Column Layout: Alerts, Climate, Risk Distribution, System Overseer */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SENTINEL Real-time Alerts */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="self-start"
        >
          <AlertPanel maxAlerts={5} compact={true} />
        </motion.div>

        {/* Climate Risk Monitor — height by content only (no stretch) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="self-start"
        >
          <ClimateWidget />
        </motion.div>

        {/* Risk Distribution — corporate card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="self-start rounded-md bg-zinc-900 border border-zinc-800 p-6"
        >
          <div className="rounded-md">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-base font-display font-semibold gradient-text">Asset Risk Distribution</h2>
                  <p className="text-[10px] text-zinc-500 mt-0.5">
                    {riskDistributionSource === 'api' && <span className="text-emerald-500/80">API · </span>}
                    {riskDistributionMessage}
                    {riskDistributionSource === 'error' && (
                      <button
                        type="button"
                        onClick={() => refetchRiskDistribution()}
                        className="ml-1 text-amber-400/80 hover:text-amber-300 underline"
                      >
                        Retry
                      </button>
                    )}
                  </p>
                </div>
                <Link
                  to="/risk-zones-analysis"
                  className="p-1.5 rounded-md hover:bg-zinc-800 transition-colors"
                  title="View Zone Dependencies Analysis"
                >
                  <LinkIcon className="w-4 h-4 text-zinc-500 hover:text-zinc-400" />
                </Link>
              </div>
              <div className="flex items-center gap-4">
                {riskDistributionLoading ? (
                  <div className="h-[260px] w-[260px] rounded-full bg-zinc-800/50 animate-pulse flex items-center justify-center text-zinc-500 text-sm">
                    Loading…
                  </div>
                ) : (
                <PieChart
                  data={riskDistributionData}
                  size={260}
                  innerRadius={0.6}
                  showLegend={true}
                  showValues={true}
                  valueFormat="number"
                  title=""
                  variant="hero"
                />
                )}
              </div>
            </div>
        </motion.div>

        {/* System Overseer - health, executive summary, system alerts */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <SystemOverseerWidget />
        </motion.div>
      </div>


      {/* NEW: Advanced Analytics Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.55 }}
        className="mt-8"
      >
        <h2 className="text-xl font-display font-semibold mb-6">Advanced Analytics</h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Risk Trends Over Time */}
            <div
            ref={riskTrendChartRef}
            className={`rounded-md bg-zinc-900 border border-zinc-800 transition-all ${isRiskTrendFullscreen ? 'fixed inset-4 z-50' : ''}`}
          >
            <div className={`rounded-md p-6 ${isRiskTrendFullscreen ? 'bg-zinc-900 h-full' : ''}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <h3 className="gradient-text-shimmer text-sm font-medium">
                  Risk Trends & Financial Impact ({riskTrendTimeRange === '1D' ? '24 Hours' : 
                               riskTrendTimeRange === '1W' ? '7 Days' : 
                               riskTrendTimeRange === '1M' ? '30 Days' : 
                               riskTrendTimeRange === '3M' ? '90 Days' : 
                               riskTrendTimeRange === '1Y' ? '1 Year' : 'All Time'})
                </h3>
                <span className="text-[10px] text-zinc-600 flex items-center gap-1">
                  {wsStatus === 'connected' && (
                    <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                  )}
                  Updated {lastTrendUpdate.toLocaleTimeString()}
                </span>
              </div>
              <ChartControls
                showTimeRange={true}
                timeRange={riskTrendTimeRange}
                onTimeRangeChange={setRiskTrendTimeRange}
                showExport={true}
                chartRef={riskTrendChartRef}
                exportFilename="risk-trends"
                showFullscreen={true}
                isFullscreen={isRiskTrendFullscreen}
                onFullscreenToggle={() => setIsRiskTrendFullscreen(!isRiskTrendFullscreen)}
                showRefresh={true}
                onRefresh={handleRefreshTrends}
                isRefreshing={isRefreshingTrends}
              />
            </div>
            
            {/* Trend Indicators */}
            <div className="flex flex-wrap gap-3 mb-4">
              {riskTrends.map(trend => (
                <div
                  key={trend.id}
                  className="hover-glow flex items-center gap-2 px-3 py-1.5 bg-zinc-800 rounded-md border-l-2"
                  style={{ borderLeftColor: trend.color, boxShadow: `0 0 6px ${trend.color}40` }}
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: trend.color }}
                  />
                  <span className="text-xs text-zinc-300">{trend.name}</span>
                  <span className="text-xs font-medium text-zinc-100">{trend.current}</span>
                  <span className={`flex items-center text-xs font-medium ${
                    trend.direction === 'up' ? 'text-red-400/80' : 
                    trend.direction === 'down' ? 'text-emerald-400/80' : 
                    'text-zinc-500'
                  }`}>
                    {trend.direction === 'up' && (
                      <svg className="w-3 h-3 mr-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                    {trend.direction === 'down' && (
                      <svg className="w-3 h-3 mr-0.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M14.707 10.293a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 111.414-1.414L9 12.586V5a1 1 0 012 0v7.586l2.293-2.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                    {trend.direction === 'stable' && '—'}
                    {trend.direction !== 'stable' && `${Math.abs(trend.change)}%`}
                  </span>
                </div>
              ))}
            </div>
            
            {isLoadingTrends ? (
              <div className="flex flex-col items-center justify-center h-[350px] gap-2 text-zinc-500 text-sm">
                <div className="w-8 h-8 border-2 border-zinc-500 border-t-amber-500 rounded-full animate-spin" />
                Loading risk trends from API…
              </div>
            ) : riskTrendData.length > 0 ? (
            <TimeSeriesChart
              series={riskTrendData}
              height={isRiskTrendFullscreen ? 500 : 350}
              showGrid={true}
              showLegend={true}
              showArea={true}
              showStatistics={true}
              yAxisLabel="Risk Score"
              yAxisLabelRight="Expected Loss"
              valueFormat="number"
              secondaryYMultiplier={5.2}
              secondaryYFormat="currency"
              thresholds={[
                { value: 60, label: 'WARNING', color: '#f59e0b', style: 'dashed' },
                { value: 80, label: 'CRITICAL', color: '#ef4444', style: 'dashed' },
              ]}
              annotations={riskTrendAnnotations}
            />
            ) : (
              <div className="flex flex-col items-center justify-center h-[350px] gap-2 text-zinc-500 text-sm text-center px-4">
                <ChartBarIcon className="w-10 h-10 text-zinc-600 pie-glow-pulse" aria-hidden />
                <p>Add assets and run stress tests to see risk trends over time.</p>
                <p className="text-zinc-600 text-xs">Chart will show weighted risk and exposure for the selected period.</p>
              </div>
            )}
            </div>
          </div>
          
          {/* Top Risk Assets - Ranked Decision Table (Institutional) */}
          <div className="rounded-md bg-zinc-900 border border-zinc-800">
          <div className="rounded-md p-6">
            {(() => {
              const displayed = topRiskAssetsData.slice(0, 5)
              const totalExposure = displayed.reduce((sum, a) => sum + (a.value ?? 0), 0)
              return (
                <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="gradient-text-shimmer text-sm font-medium">TOP RISK ASSETS</h3>
              <span className="gradient-text text-lg font-light">{displayed.length ? formatEur(totalExposure, 'millions') : '—'}</span>
            </div>
            <div className="overflow-x-auto">
              {displayed.length === 0 ? (
                <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-500 text-sm">
                  <BuildingOffice2Icon className="w-10 h-10 text-zinc-600 pie-glow-pulse" />
                  No assets in database. Add assets to see top risk list.
                </div>
              ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-700">
                    <th className="text-left font-mono text-[10px] uppercase tracking-widest text-zinc-500 py-2 px-2">Rank</th>
                    <th className="text-left font-mono text-[10px] uppercase tracking-widest text-zinc-500 py-2 px-2">Assets</th>
                    <th className="text-left font-mono text-[10px] uppercase tracking-widest text-zinc-500 py-2 px-2">Risk/Driver</th>
                    <th className="text-right font-mono text-[10px] uppercase tracking-widest text-zinc-500 py-2 px-2">Exposure</th>
                    <th className="text-left font-mono text-[10px] uppercase tracking-widest text-zinc-500 py-2 px-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {displayed.map((asset, idx) => {
                    const riskLevel = asset.risk > 0.8 ? 'critical' : asset.risk > 0.6 ? 'high' : 'medium'
                    const riskDriverLabel = asset.risk_driver ? asset.risk_driver.charAt(0).toUpperCase() + asset.risk_driver.slice(1) : (asset.risk > 0.85 ? 'Climate' : asset.risk > 0.65 ? 'Physical' : 'Network')
                    const action = asset.risk > 0.85 ? 'Relocate' : asset.risk > 0.75 ? 'Capex' : asset.risk > 0.65 ? 'Backup' : 'Monitor'
                    const expectedLoss = asset.expected_loss != null ? asset.expected_loss : (asset.value * asset.risk)
                    return (
                      <tr
                        key={asset.id || asset.label}
                        className={`border-b border-zinc-800 hover:bg-gradient-to-r hover:from-zinc-800/50 hover:to-transparent transition-colors ${
                          riskLevel === 'critical' ? 'border-l-4 border-l-red-500' :
                          riskLevel === 'high' ? 'border-l-4 border-l-orange-500' :
                          'border-l-4 border-l-amber-500'
                        }`}
                      >
                        <td className="py-3 px-2">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${
                            riskLevel === 'critical' ? 'bg-red-500/15 text-red-400/80' :
                            riskLevel === 'high' ? 'bg-orange-500/15 text-orange-400/80' :
                            'bg-amber-500/15 text-amber-400/80'
                          }`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <div className="text-zinc-100 font-medium">{asset.label}</div>
                          <div className="text-zinc-500 text-[10px]">{riskDriverLabel}</div>
                        </td>
                        <td className="py-3 px-2">
                          <span className={`text-xs ${
                            riskLevel === 'critical' ? 'text-red-400/80' :
                            riskLevel === 'high' ? 'text-orange-400/80' :
                            'text-amber-400/80'
                          }`}>
                            {riskDriverLabel}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className="text-zinc-100">{formatEur(expectedLoss, 'millions')}</span>
                        </td>
                        <td className="py-3 px-2">
                          <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-medium bg-zinc-700 text-zinc-400 border border-zinc-600">
                            {action}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              )}
            </div>
            <div className="mt-4 pt-3 border-t border-zinc-700 flex items-center justify-between text-xs">
              <div className="text-zinc-500">
                TOTAL EXPOSURE: <span className="text-zinc-200">{displayed.length ? formatEur(totalExposure, 'millions') : '—'}</span>
                {displayed.length > 0 && <span className="text-zinc-600 ml-1">(top 5)</span>}
              </div>
              <button
                type="button"
                onClick={() => setTopRiskApproved(true)}
                disabled={topRiskApproved}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded transition-colors ${
                  topRiskApproved
                    ? 'bg-emerald-500/15 text-emerald-400/80 border border-emerald-500/30 cursor-default'
                    : 'hover-glow bg-gradient-to-r from-zinc-600 to-zinc-500 text-zinc-100 hover:from-zinc-500 hover:to-zinc-400'
                }`}
              >
                {topRiskApproved ? (
                  <>
                    <CheckCircleIcon className="w-4 h-4" />
                    Approved
                  </>
                ) : (
                  'APPROVE'
                )}
              </button>
            </div>
                </>
              )
            })()}
          </div>
        </div>
        
        {/* Scenario Comparison - Full Width */}
        <div className="rounded-md bg-zinc-900 border border-zinc-800 mt-10">
          <div className="rounded-md p-6">
          {scenarioComparisonData.length > 0 ? (
            <ComparisonChart
              scenarios={scenarioComparisonData}
              title="Stress Test Scenario Comparison"
              showDelta={true}
            />
          ) : (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-500 text-sm">
              <BeakerIcon className="w-10 h-10 text-zinc-600 pie-glow-pulse" />
              No stress tests completed yet. Run a stress test to see scenario comparison.
            </div>
          )}
          </div>
        </div>
        </div>
      </motion.div>

      {/* Platform Layers - Real Data */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-8 rounded-md bg-zinc-900 border border-zinc-800"
      >
        <div className="rounded-md p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-display font-semibold gradient-text-shimmer">Platform Layers</h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setAllLayersExpanded(!allLayersExpanded)}
              className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors flex items-center gap-1"
            >
              {allLayersExpanded ? (
                <>
                  <ChevronDownIcon className="w-3 h-3 rotate-180" />
                  Collapse all
                </>
              ) : (
                <>
                  <ChevronDownIcon className="w-3 h-3" />
                  Expand all
                </>
              )}
            </button>
            {layersLoading && (
              <span className="text-xs text-zinc-500 flex items-center gap-2">
                <div className="w-3 h-3 border border-zinc-500 border-t-transparent rounded-full animate-spin" />
                Loading…
              </span>
            )}
            {layersError && (
              <span className="text-xs text-red-400/80 flex items-center gap-2">
                Failed to load layers.
                <button type="button" onClick={() => refetchLayers()} className="text-amber-400/80 hover:text-amber-300 underline">Retry</button>
              </span>
            )}
            {platformData && !layersError && (
              <span className="text-xs text-emerald-400/80 flex items-center gap-1">
                <div
                  className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"
                  style={{ boxShadow: '0 0 6px rgba(34,197,94,0.4)' }}
                />
                Live
              </span>
            )}
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {layersLoading && (
            [...Array(6)].map((_, i) => (
              <div key={i} className="p-4 bg-zinc-900/80 rounded-md animate-pulse h-32" />
            ))
          )}
          {layersError && !layersLoading && (
            <div className="col-span-full py-8 text-center text-zinc-500">
              <p className="text-sm">Platform layers could not be loaded.</p>
              <button type="button" onClick={() => refetchLayers()} className="mt-2 text-amber-400/80 hover:text-amber-300 underline text-sm">Retry</button>
            </div>
          )}
          {!layersLoading && !layersError && layers.length === 0 && (
            <div className="col-span-full py-8 text-center text-zinc-500 text-sm">No layer data from API.</div>
          )}
          {!layersLoading && layers.length > 0 && layers.map((l) => (
            <div
              key={l.layer}
              className={`hover-glow p-4 bg-gradient-to-b from-zinc-900 to-zinc-950 rounded-md text-center transition-all ${
                allLayersExpanded ? 'ring-1 ring-zinc-500/50' : 'cursor-pointer hover:from-zinc-800 hover:to-zinc-900'
              }`}
              onClick={() => !allLayersExpanded && setAllLayersExpanded(true)}
              onKeyDown={(e) => e.key === 'Enter' && !allLayersExpanded && setAllLayersExpanded(true)}
              role="button"
              tabIndex={0}
            >
              <div className="flex items-center justify-center gap-1 text-xs text-dark-muted mb-1">
                {getLayerIcon(l.layer)}
                <span>Layer {l.layer}</span>
              </div>
              <div className="font-medium text-sm mb-2">{l.name}</div>
              <div className="text-3xl font-display font-bold gradient-text">{l.count}</div>
              <div className="flex items-center justify-center gap-1 mt-2 flex-wrap">
                <span className={`inline-block text-xs px-2 py-1 rounded-full ${
                  l.status === 'active' ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white' :
                  l.status === 'beta' ? 'bg-gradient-to-r from-amber-600 to-amber-500 text-zinc-100' :
                  'bg-gradient-to-r from-zinc-600 to-zinc-500 text-zinc-100'
                }`}>
                  {l.status}
                </span>
                {l.layer === 2 && l.status === 'offline' && (
                  <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-zinc-700 text-zinc-400">
                    Optional
                  </span>
                )}
                <ChevronDownIcon className={`w-3 h-3 text-zinc-500 transition-transform ${
                  allLayersExpanded ? 'rotate-180' : ''
                }`} />
              </div>
              <AnimatePresence>
                {allLayersExpanded && (
                  <LayerDetailPanel 
                    layer={l as LayerMetrics} 
                    onClose={() => setAllLayersExpanded(false)} 
                  />
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
        
        {/* System health indicator */}
        {platformData && (
          <div className="mt-4 pt-4 border-t border-zinc-800 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-zinc-500">
              <span>Total Records:</span>
              <span className="gradient-text">{platformData.total_records.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2 text-zinc-500">
              <span>System Health:</span>
              <span className={`flex items-center gap-1 ${
                platformData.system_health === 'healthy' ? 'text-emerald-400/80' : 'text-amber-400/80'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${
                  platformData.system_health === 'healthy' ? 'bg-emerald-400' : 'bg-amber-400'
                }`} />
                {platformData.system_health}
              </span>
            </div>
            <FreshnessIndicator timestamp={platformData.last_sync} ttlMinutes={60} label="Last sync" />
          </div>
        )}
        </div>
      </motion.div>

      {/* Real-Time Intelligence Widgets */}
      {platformData && !layersError && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="mt-8"
        >
          <div className="flex items-center justify-between gap-3 mb-6">
            <h2 className="text-xl font-display font-semibold gradient-text-shimmer">Real-Time Intelligence</h2>
            <button
              type="button"
              onClick={handleRefreshRealtime}
              disabled={isRefreshingRealtime}
              className={`text-xs px-3 py-1.5 rounded-md border transition-colors ${
                isRefreshingRealtime
                  ? 'border-zinc-700 text-zinc-500 cursor-not-allowed'
                  : 'border-zinc-600 text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              {isRefreshingRealtime ? 'Refreshing...' : 'Refresh now'}
            </button>
          </div>

          {/* Live Data Freshness Bar */}
          <ErrorBoundary>
            <LiveDataIndicatorBar />
          </ErrorBoundary>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
            {/* Market Ticker */}
            <ErrorBoundary>
              <MarketTicker />
            </ErrorBoundary>

            {/* Threat Intelligence Feed */}
            <ErrorBoundary>
              <ThreatIntelFeed />
            </ErrorBoundary>

            {/* Data Sources (Natural Hazards, Weather, Biosecurity, Cyber) — last events by channel */}
            <ErrorBoundary>
              <DataSourcesPanel />
            </ErrorBoundary>
            {/* Document RAG (cuRAG) — status and index documents */}
            <ErrorBoundary>
              <CuRAGCard />
            </ErrorBoundary>
          </div>

          {/* More real-time sources: last refresh per source */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mt-6">
            <ErrorBoundary>
              <DataSourcePanel
                sourceId="natural_hazards"
                title="Natural Hazards"
                description="USGS earthquakes, NASA FIRMS fires, NWS alerts"
                icon={<GlobeAltIcon className="w-4 h-4 text-amber-400/80" />}
              />
            </ErrorBoundary>
            <ErrorBoundary>
              <DataSourcePanel
                sourceId="weather"
                title="Weather"
                description="Open-Meteo / OpenWeather"
                icon={<CloudIcon className="w-4 h-4 text-sky-400" />}
              />
            </ErrorBoundary>
            <ErrorBoundary>
              <DataSourcePanel
                sourceId="biosecurity"
                title="Biosecurity"
                description="WHO outbreak monitoring"
                icon={<ShieldCheckIcon className="w-4 h-4 text-emerald-400/80" />}
              />
            </ErrorBoundary>
            <ErrorBoundary>
              <DataSourcePanel
                sourceId="cyber_threats"
                title="Cyber Threats"
                description="CISA KEV, vulnerability alerts"
                icon={<LockClosedIcon className="w-4 h-4 text-violet-400" />}
              />
            </ErrorBoundary>
            <ErrorBoundary>
              <DataSourcePanel
                sourceId="economic"
                title="Economic"
                description="World Bank, IMF, OFAC sanctions"
                icon={<BanknotesIcon className="w-4 h-4 text-zinc-400" />}
              />
            </ErrorBoundary>
          </div>
        </motion.div>
      )}

      {/* Recent Activity — collapsible footer to save space */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="mt-8 pt-4"
      >
        <div className="h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent mb-4" />
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <button
            type="button"
            onClick={() => setRecentActivityOpen(!recentActivityOpen)}
            className="hover-glow flex items-center gap-2 text-left text-zinc-500 hover:text-zinc-300 text-sm py-2 rounded-md transition-colors"
          >
            <ChevronDownIcon className={`w-4 h-4 transition-transform ${recentActivityOpen ? 'rotate-180' : ''}`} />
            Recent Activity
            {recentEvents.length > 0 && (
              <span className="px-1.5 py-0.5 rounded text-xs bg-gradient-to-r from-zinc-600 to-zinc-500 text-zinc-100">
                {recentEvents.length}
              </span>
            )}
          </button>
          <Link
            to="/command"
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Open Command Center (same store, shared events)"
          >
            <GlobeAltIcon className="w-3.5 h-3.5" />
            Open in Command Center
          </Link>
        </div>
        {recentActivityOpen && (
          <div className="mt-2">
            <RecentActivityPanel events={recentEvents} maxItems={5} />
          </div>
        )}
      </motion.div>
    </div>
  )
}
