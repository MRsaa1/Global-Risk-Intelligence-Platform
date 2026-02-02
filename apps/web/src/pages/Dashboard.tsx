import { useState, useMemo, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import {
  BuildingOffice2Icon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  CubeTransparentIcon,
  ChevronDownIcon,
  CheckCircleIcon,
  ClockIcon,
  BeakerIcon,
  BoltIcon,
  SignalIcon,
  BriefcaseIcon,
  CurrencyDollarIcon,
  ShieldExclamationIcon,
  LinkIcon,
} from '@heroicons/react/24/outline'
import AlertPanel from '../components/AlertPanel'
import ClimateWidget from '../components/ClimateWidget'
import RecentActivityPanel from '../components/dashboard/RecentActivityPanel'
import SystemOverseerWidget from '../components/dashboard/SystemOverseerWidget'
// Chart components (institutional-grade, no 3D)
import TimeSeriesChart from '../components/charts/TimeSeriesChart'
import PieChart from '../components/charts/PieChart'
import ComparisonChart from '../components/charts/ComparisonChart'
import ChartControls, { TimeRange } from '../components/charts/ChartControls'
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
import { usePlatformWebSocket } from '../hooks/usePlatformWebSocket'

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

// Format billions for display
function formatBillionsEur(value: number): string {
  if (value >= 1000) return `€${(value / 1000).toFixed(1)}T`
  if (value >= 1) return `€${value.toFixed(0)}M`
  return `€${(value * 1000).toFixed(0)}K`
}

// Determine risk posture level
function getRiskPosture(weightedRisk: number): { level: string; color: string; arrow: string } {
  if (weightedRisk > 0.75) return { level: 'CRITICAL', color: 'text-red-400', arrow: '↑↑' }
  if (weightedRisk > 0.6) return { level: 'ELEVATED', color: 'text-orange-400', arrow: '↑' }
  if (weightedRisk > 0.4) return { level: 'MODERATE', color: 'text-amber-400', arrow: '→' }
  return { level: 'STABLE', color: 'text-emerald-400', arrow: '↓' }
}

// Institutional KPIs - derived from platform store (synced with Command Center)
function useInstitutionalKPIs() {
  const portfolio = usePortfolio()
  
  return useMemo(() => {
    // Calculate institutional metrics
    const capitalAtRisk = portfolio.atRisk || 420 // €M
    const stressLossP95 = Math.round(capitalAtRisk * 0.75) // P95 = ~75% of CaR
    const riskVelocity = portfolio.weightedRisk > 0.6 ? 22 : portfolio.weightedRisk > 0.4 ? 8 : -5 // % MoM
    const mitigatedRatio = portfolio.weightedRisk < 0.5 ? 0.68 : portfolio.weightedRisk < 0.7 ? 0.45 : 0.28
    
    return {
      capitalAtRisk,
      capitalAtRiskChange: '+€65M WoW',
      stressLossP95,
      stressLossP95Pct: '+11%',
      riskVelocity,
      riskVelocityLabel: riskVelocity > 0 ? `+${riskVelocity}%` : `${riskVelocity}%`,
      mitigatedRatio,
      mitigatedPct: `${Math.round(mitigatedRatio * 100)}%`,
      unmitigatedPct: `${Math.round((1 - mitigatedRatio) * 100)}%`,
      posture: getRiskPosture(portfolio.weightedRisk),
      totalExposure: portfolio.totalExposure || 4200, // €M
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

// Fetch platform layers from API
async function fetchPlatformLayers(): Promise<PlatformStatus> {
  const response = await fetch('/api/v1/platform/layers')
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

// Generate time series data for risk trends
function generateRiskTrendData(timeRange: TimeRange = '1M') {
  const now = new Date()
  const days = getDaysFromTimeRange(timeRange)
  const series = [
    { id: 'climate', name: 'Climate Risk', color: chartColors.series.climate },
    { id: 'physical', name: 'Physical Risk', color: chartColors.series.physical },
    { id: 'network', name: 'Network Risk', color: chartColors.series.network },
    { id: 'financial', name: 'Financial Risk', color: chartColors.series.financial },
  ]
  
  // Adjust data points based on range
  const dataPoints = Math.min(days, days <= 7 ? days * 24 : days) // Hourly for 1D/1W, daily otherwise
  
  return series.map(s => ({
    ...s,
    data: Array.from({ length: dataPoints }, (_, i) => {
      const date = new Date(now)
      if (days <= 7) {
        date.setHours(date.getHours() - (dataPoints - 1 - i))
      } else {
        date.setDate(date.getDate() - (dataPoints - 1 - i))
      }
      // Different base values and volatility for each series
      const baseValue = s.id === 'climate' ? 45 : s.id === 'physical' ? 28 : s.id === 'network' ? 62 : 35
      const volatility = s.id === 'network' ? 15 : 10
      return {
        date,
        value: Math.max(0, Math.min(100, baseValue + (Math.random() - 0.5) * volatility + Math.sin(i / 5) * 5)),
      }
    }),
  }))
}

// Mock data for risk distribution pie chart
function getRiskDistributionData() {
  return [
    { id: 'critical', label: 'Critical', value: 23, color: chartColors.risk.critical, risk: 0.9 },
    { id: 'high', label: 'High', value: 45, color: chartColors.risk.high, risk: 0.7 },
    { id: 'medium', label: 'Medium', value: 112, color: chartColors.risk.medium, risk: 0.5 },
    { id: 'low', label: 'Low', value: 347, color: chartColors.risk.low, risk: 0.2 },
  ]
}

// Mock data for top risk assets bar chart
function getTopRiskAssetsData() {
  return [
    { label: 'Frankfurt Tower', value: 92, risk: 0.92 },
    { label: 'London Bridge Offices', value: 87, risk: 0.87 },
    { label: 'Tokyo Central', value: 78, risk: 0.78 },
    { label: 'Singapore Marina', value: 72, risk: 0.72 },
    { label: 'NYC Financial', value: 68, risk: 0.68 },
    { label: 'Dubai Downtown', value: 65, risk: 0.65 },
    { label: 'Sydney Harbor', value: 58, risk: 0.58 },
    { label: 'Paris La Defense', value: 52, risk: 0.52 },
  ]
}

// Mock data for scenario comparison
function getScenarioComparisonData() {
  return [
    {
      id: 'climate-stress',
      name: 'Climate Stress',
      description: 'Impact of extreme climate events on portfolio',
      metrics: [
        { id: 'portfolio', label: 'Portfolio Value', before: 4200000000, after: 3780000000, format: 'currency' as const, higherIsBetter: true },
        { id: 'var', label: 'Value at Risk', before: 180000000, after: 520000000, format: 'currency' as const, higherIsBetter: false },
        { id: 'avg-risk', label: 'Average Risk', before: 0.35, after: 0.58, format: 'percent' as const, higherIsBetter: false },
        { id: 'critical', label: 'Critical Assets', before: 12, after: 34, format: 'number' as const, higherIsBetter: false },
      ],
    },
    {
      id: 'market-crash',
      name: 'Market Crash',
      description: '2008-style financial crisis scenario',
      metrics: [
        { id: 'portfolio', label: 'Portfolio Value', before: 4200000000, after: 2940000000, format: 'currency' as const, higherIsBetter: true },
        { id: 'var', label: 'Value at Risk', before: 180000000, after: 890000000, format: 'currency' as const, higherIsBetter: false },
        { id: 'avg-risk', label: 'Average Risk', before: 0.35, after: 0.72, format: 'percent' as const, higherIsBetter: false },
        { id: 'critical', label: 'Critical Assets', before: 12, after: 89, format: 'number' as const, higherIsBetter: false },
      ],
    },
    {
      id: 'geopolitical',
      name: 'Geopolitical',
      description: 'Regional conflict impact analysis',
      metrics: [
        { id: 'portfolio', label: 'Portfolio Value', before: 4200000000, after: 3570000000, format: 'currency' as const, higherIsBetter: true },
        { id: 'var', label: 'Value at Risk', before: 180000000, after: 410000000, format: 'currency' as const, higherIsBetter: false },
        { id: 'avg-risk', label: 'Average Risk', before: 0.35, after: 0.51, format: 'percent' as const, higherIsBetter: false },
        { id: 'critical', label: 'Critical Assets', before: 12, after: 28, format: 'number' as const, higherIsBetter: false },
      ],
    },
  ]
}

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
      className="mt-3 p-3 bg-black/40 rounded-lg border border-white/10 text-left"
    >
      <p className="text-xs text-white/60 mb-2">{layer.description}</p>
      
      {/* Layer-specific details */}
      {layer.layer === 0 && details && (
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-white/40">Provenance Records</span>
            <span className="text-white/80">{details.provenance_records || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">Verified</span>
            <span className="text-emerald-400">{details.verified_records || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">Assets</span>
            <span className="text-white/80">{details.assets || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">External Sources</span>
            <span className="text-amber-400">{(details.external_sources || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">Verification Rate</span>
            <span className="text-white/80">{(details.verification_rate || 0).toFixed(1)}%</span>
          </div>
        </div>
      )}
      
      {layer.layer === 2 && details && (
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-white/40">Network Nodes</span>
            <span className="text-white/80">{details.nodes || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">Connections (Edges)</span>
            <span className="text-amber-400">{details.edges || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">Risk Clusters</span>
            <span className="text-amber-400">{details.risk_clusters || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">Critical Paths</span>
            <span className="text-red-400">{details.critical_paths || 0}</span>
          </div>
          {details.sectors && (
            <div className="pt-2 border-t border-white/10">
              <span className="text-white/40">Sectors: </span>
              <span className="text-white/60">{details.sectors.join(', ')}</span>
            </div>
          )}
        </div>
      )}
      
      {layer.layer === 4 && details && (
        <div className="space-y-2 text-xs">
          {details.agents?.map((agent: any) => (
            <div key={agent.id} className="p-2 bg-white/5 rounded">
              <div className="flex items-center justify-between">
                <span className="font-medium text-white/90">{agent.name}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                  agent.status === 'active' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {agent.status}
                </span>
              </div>
              <p className="text-white/40 mt-1">{agent.role}</p>
              {agent.active_alerts !== undefined && (
                <p className="text-amber-400 mt-1">{agent.active_alerts} active alerts</p>
              )}
            </div>
          ))}
          {details.nvidia_llm_enabled && (
            <div className="pt-2 border-t border-white/10 flex items-center gap-2">
              <span className="text-[10px] px-1.5 py-0.5 bg-green-500/20 text-green-400 rounded">NVIDIA LLM</span>
              <span className="text-white/40">Connected</span>
            </div>
          )}
        </div>
      )}
      
      {layer.layer === 5 && details && (
        <div className="space-y-1 text-xs">
          <div className="flex justify-between">
            <span className="text-white/40">Spec Version</span>
            <span className="text-purple-400">{details.version}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">Total PARS IDs</span>
            <span className="text-white/80">{(details.total_pars_ids || 0).toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-white/40">Status</span>
            <span className="text-amber-400">{details.spec_status}</span>
          </div>
          {details.regions && (
            <div className="pt-2 border-t border-white/10">
              <span className="text-white/40">Regions: </span>
              <span className="text-white/60">{details.regions.join(', ')}</span>
            </div>
          )}
          {details.features && (
            <div className="pt-2">
              <span className="text-white/40">Features:</span>
              <ul className="mt-1 text-white/60 list-disc list-inside">
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
        className="mt-3 w-full py-1 text-xs text-white/40 hover:text-white/60 transition-colors"
      >
        Close
      </button>
    </motion.div>
  )
}

export default function Dashboard() {
  const [expandedLayer, setExpandedLayer] = useState<number | null>(null)
  const [riskTrendTimeRange, setRiskTrendTimeRange] = useState<TimeRange>('1M')
  const [isRiskTrendFullscreen, setIsRiskTrendFullscreen] = useState(false)
  const [isRefreshingTrends, setIsRefreshingTrends] = useState(false)
  const riskTrendChartRef = useRef<HTMLDivElement>(null)
  
  // Platform store - synced with Command Center
  const institutionalKPIs = useInstitutionalKPIs()
  const activeStressTest = useActiveStressTest()
  const recentEvents = useRecentEvents(5)
  const { wsStatus } = usePlatformStore()
  
  // Platform WebSocket - receives events from Command Center (including command_center for zones/twins)
  usePlatformWebSocket(['dashboard', 'stress_tests', 'alerts', 'command_center'])
  
  // Fetch platform layers from API
  const { data: platformData, isLoading, error } = useQuery({
    queryKey: ['platformLayers'],
    queryFn: fetchPlatformLayers,
    refetchInterval: 30000, // Refresh every 30 seconds
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
  
  // Transform API data for chart component
  const riskTrendData = useMemo(() => {
    if (!riskTrendsResponse?.series) {
      // Fallback mock data if API fails
      return generateRiskTrendData(riskTrendTimeRange)
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
  
  // Financial impact annotations for the risk trend chart (institutional style)
  const riskTrendAnnotations = useMemo(() => {
    const now = new Date()
    const days = getDaysFromTimeRange(riskTrendTimeRange)
    
    // Generate auto-annotations with financial impact
    const annotations: Array<{ date: Date; label: string; type: 'stress-test' | 'alert' | 'event' }> = []
    
    if (days >= 5) {
      const stressTestDate = new Date(now)
      stressTestDate.setDate(stressTestDate.getDate() - 3)
      annotations.push({
        date: stressTestDate,
        label: 'Flood risk ↑ → €32M exposure',
        type: 'alert',
      })
    }
    
    if (days >= 7) {
      const stressTestDate = new Date(now)
      stressTestDate.setDate(stressTestDate.getDate() - 5)
      annotations.push({
        date: stressTestDate,
        label: 'Network risk spike → Supplier X',
        type: 'stress-test',
      })
    }
    
    if (days >= 14) {
      const alertDate = new Date(now)
      alertDate.setDate(alertDate.getDate() - 12)
      annotations.push({
        date: alertDate,
        label: 'Heat stress → €48M at risk',
        type: 'alert',
      })
    }
    
    if (days >= 21) {
      const eventDate = new Date(now)
      eventDate.setDate(eventDate.getDate() - 18)
      annotations.push({
        date: eventDate,
        label: 'Mitigation deployed → €12M saved',
        type: 'event',
      })
    }
    
    return annotations
  }, [riskTrendTimeRange])
  // Fetch risk distribution from API
  const { data: riskDistributionResponse } = useQuery({
    queryKey: ['riskDistribution'],
    queryFn: getRiskDistribution,
    refetchInterval: 60000,
    staleTime: 30000,
  })
  
  const riskDistributionData = useMemo(() => {
    if (!riskDistributionResponse?.distribution) {
      return getRiskDistributionData() // Fallback
    }
    const total = riskDistributionResponse.total_assets ?? 0
    const allZero = riskDistributionResponse.distribution.every((d) => (d.value ?? 0) === 0)
    if (total === 0 || allZero) {
      return getRiskDistributionData() // Fallback when DB has no assets
    }
    return riskDistributionResponse.distribution
  }, [riskDistributionResponse])
  
  // Fetch top risk assets from API
  const { data: topRiskAssetsResponse } = useQuery({
    queryKey: ['topRiskAssets'],
    queryFn: () => getTopRiskAssets(8),
    refetchInterval: 60000,
    staleTime: 30000,
  })
  
  const topRiskAssetsData = useMemo(() => {
    if (!topRiskAssetsResponse?.assets?.length) {
      return getTopRiskAssetsData() // Fallback when DB has no assets
    }
    return topRiskAssetsResponse.assets
  }, [topRiskAssetsResponse])
  
  // Fetch scenario comparison from API
  const { data: scenarioComparisonResponse } = useQuery({
    queryKey: ['scenarioComparison'],
    queryFn: getScenarioComparison,
    refetchInterval: 120000, // Less frequent - stress tests don't change often
    staleTime: 60000,
  })
  
  const scenarioComparisonData = useMemo(() => {
    if (!scenarioComparisonResponse?.scenarios) {
      return getScenarioComparisonData() // Fallback
    }
    return scenarioComparisonResponse.scenarios
  }, [scenarioComparisonResponse])
  
  // Fallback data if API fails
  const fallbackLayers = [
    { layer: 0, name: 'Verified Truth', status: 'active', count: '12.4K', count_raw: 12400, description: 'Cryptographic data provenance', details: {} },
    { layer: 1, name: 'Digital Twins', status: 'active', count: '1,156', count_raw: 1156, description: '3D asset representations', details: {} },
    { layer: 2, name: 'Network Intelligence', status: 'active', count: '8.2K', count_raw: 8200, description: 'Risk graph connections', details: {} },
    { layer: 3, name: 'Simulation Engine', status: 'active', count: '234', count_raw: 234, description: 'Monte Carlo simulations', details: {} },
    { layer: 4, name: 'Autonomous Agents', status: 'beta', count: '3', count_raw: 3, description: 'AI agents', details: {} },
    { layer: 5, name: 'Protocol (PARS)', status: 'dev', count: 'v0.1', count_raw: 0, description: 'Asset reference protocol', details: {} },
  ]
  
  const layers = platformData?.layers || fallbackLayers
  
  return (
    <div className="h-full overflow-auto p-8">
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
            <h1 className="text-2xl font-display font-bold text-white/90 tracking-wide">
              PHYSICAL-FINANCIAL RISK COMMAND CENTER
            </h1>
            <p className="text-white/40 text-sm mt-1">
              Strategic Intelligence for the Physical Economy
            </p>
          </div>
          
          {/* Live sync + status indicators */}
          <div className="flex items-center gap-4">
            {activeStressTest && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-lg"
              >
                <BoltIcon className="w-4 h-4 text-amber-400 animate-pulse" />
                <span className="text-xs text-amber-300">
                  {activeStressTest.name}
                  {activeStressTest.progress !== undefined && (
                    <span className="ml-2 text-amber-400/70">{activeStressTest.progress}%</span>
                  )}
                </span>
              </motion.div>
            )}
            <div className="flex items-center gap-1.5 text-xs">
              <SignalIcon className={`w-4 h-4 ${wsStatus === 'connected' ? 'text-emerald-400' : wsStatus === 'connecting' ? 'text-amber-400 animate-pulse' : 'text-white/30'}`} />
              <span className={wsStatus === 'connected' ? 'text-emerald-400' : wsStatus === 'connecting' ? 'text-amber-400' : 'text-white/30'}>
                {wsStatus === 'connected' ? 'Live' : wsStatus === 'connecting' ? 'Connecting...' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* GLOBAL RISK POSTURE - Hero Line */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-2xl p-5 border border-white/10 mb-6"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="text-white/40 text-xs uppercase tracking-widest">Global Risk Posture</div>
            <div className={`text-2xl font-bold tracking-wide ${institutionalKPIs.posture.color}`}>
              {institutionalKPIs.posture.level} {institutionalKPIs.posture.arrow}
            </div>
          </div>
          <div className="text-right">
            <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Capital at Risk (30d)</div>
            <div className="text-white text-xl font-light">
              €{institutionalKPIs.capitalAtRisk}M 
              <span className="text-red-400/80 text-sm ml-2">{institutionalKPIs.capitalAtRiskChange}</span>
            </div>
          </div>
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
        <motion.div variants={item} className="glass rounded-xl p-5 border border-white/5">
          <div className="text-white/40 text-[10px] uppercase tracking-widest mb-2">Capital at Risk</div>
          <div className="text-white text-2xl font-light">€{institutionalKPIs.capitalAtRisk}M</div>
          <div className="text-red-400/70 text-xs mt-1">{institutionalKPIs.capitalAtRiskChange}</div>
          <div className="text-white/30 text-[10px] mt-2">30-day VaR equivalent</div>
        </motion.div>
        
        {/* Stress Loss (P95) */}
        <motion.div variants={item} className="glass rounded-xl p-5 border border-white/5">
          <div className="text-white/40 text-[10px] uppercase tracking-widest mb-2">Stress Loss (P95)</div>
          <div className="text-white text-2xl font-light">€{institutionalKPIs.stressLossP95}M</div>
          <div className="text-orange-400/70 text-xs mt-1">{institutionalKPIs.stressLossP95Pct}</div>
          <div className="text-white/30 text-[10px] mt-2">Severe scenario loss</div>
        </motion.div>
        
        {/* Risk Velocity */}
        <motion.div variants={item} className="glass rounded-xl p-5 border border-white/5">
          <div className="text-white/40 text-[10px] uppercase tracking-widest mb-2">Risk Velocity</div>
          <div className={`text-2xl font-light ${institutionalKPIs.riskVelocity > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {institutionalKPIs.riskVelocityLabel}
          </div>
          <div className="text-white/50 text-xs mt-1">vs last month</div>
          <div className="text-white/30 text-[10px] mt-2">Rate of risk change</div>
        </motion.div>
        
        {/* Mitigated vs Unmitigated */}
        <motion.div variants={item} className="glass rounded-xl p-5 border border-white/5">
          <div className="text-white/40 text-[10px] uppercase tracking-widest mb-2">Risk Coverage</div>
          <div className="flex items-baseline gap-2">
            <span className="text-emerald-400 text-2xl font-light">{institutionalKPIs.mitigatedPct}</span>
            <span className="text-white/30 text-sm">mitigated</span>
          </div>
          <div className="text-red-400/60 text-xs mt-1">{institutionalKPIs.unmitigatedPct} unmitigated</div>
          <div className="mt-2 h-1.5 bg-white/10 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 rounded-full"
              style={{ width: institutionalKPIs.mitigatedPct }}
            />
          </div>
        </motion.div>
      </motion.div>

      {/* Quick Actions - 3D + AI Fintech Strategy */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8"
      >
        <Link to="/projects" className="block group">
          <div className="glass rounded-2xl p-5 border border-amber-500/20 hover:border-amber-500/50 transition-all hover:bg-amber-500/5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <BriefcaseIcon className="w-5 h-5 text-amber-400" />
                  <p className="text-sm font-semibold text-white/90">Project Finance</p>
                </div>
                <p className="text-xs text-white/50">IRR/NPV, Phases, CAPEX/OPEX</p>
              </div>
              <ArrowTrendingUpIcon className="w-6 h-6 text-amber-400/50 group-hover:text-amber-400 transition-colors" />
            </div>
          </div>
        </Link>
        <Link to="/portfolios" className="block group">
          <div className="glass rounded-2xl p-5 border border-emerald-500/20 hover:border-emerald-500/50 transition-all hover:bg-emerald-500/5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CurrencyDollarIcon className="w-5 h-5 text-emerald-400" />
                  <p className="text-sm font-semibold text-white/90">Portfolios & REIT</p>
                </div>
                <p className="text-xs text-white/50">NAV, FFO, Yield, Stress Tests</p>
              </div>
              <ArrowTrendingUpIcon className="w-6 h-6 text-emerald-400/50 group-hover:text-emerald-400 transition-colors" />
            </div>
          </div>
        </Link>
        <Link to="/fraud" className="block group">
          <div className="glass rounded-2xl p-5 border border-red-500/20 hover:border-red-500/50 transition-all hover:bg-red-500/5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <ShieldExclamationIcon className="w-5 h-5 text-red-400" />
                  <p className="text-sm font-semibold text-white/90">Fraud Detection</p>
                </div>
                <p className="text-xs text-white/50">Claims, 3D Compare, Verification</p>
              </div>
              <ArrowTrendingUpIcon className="w-6 h-6 text-red-400/50 group-hover:text-red-400 transition-colors" />
            </div>
          </div>
        </Link>
        <Link to="/action-plans" className="block group">
          <div className="glass rounded-2xl p-5 border border-amber-500/20 hover:border-amber-500/50 transition-all hover:bg-amber-500/5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <BeakerIcon className="w-5 h-5 text-amber-400" />
                  <p className="text-sm font-semibold text-white/90">STRESS TEST ACTION PLAN</p>
                </div>
                <p className="text-xs text-white/50">Template: 5 sectors, phases, metrics, step-by-step</p>
              </div>
              <ArrowTrendingUpIcon className="w-6 h-6 text-amber-400/50 group-hover:text-amber-400 transition-colors" />
            </div>
          </div>
        </Link>
        <Link to="/stress-planner" className="block group">
          <div className="glass rounded-2xl p-5 border border-amber-500/20 hover:border-amber-500/50 transition-all hover:bg-amber-500/5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <BeakerIcon className="w-5 h-5 text-amber-400" />
                  <p className="text-sm font-semibold text-white/90">Stress Planner</p>
                </div>
                <p className="text-xs text-white/50">All scenario types, Monte Carlo, real API</p>
              </div>
              <ArrowTrendingUpIcon className="w-6 h-6 text-amber-400/50 group-hover:text-amber-400 transition-colors" />
            </div>
          </div>
        </Link>
        {/* Institutional Modes */}
        <Link to="/board-mode" className="block group">
          <div className="glass rounded-2xl p-5 border border-purple-500/20 hover:border-purple-500/50 transition-all hover:bg-purple-500/5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CubeTransparentIcon className="w-5 h-5 text-purple-400" />
                  <p className="text-sm font-semibold text-white/90">Board Mode</p>
                </div>
                <p className="text-xs text-white/50">5-slide executive presentation</p>
              </div>
              <ArrowTrendingUpIcon className="w-6 h-6 text-purple-400/50 group-hover:text-purple-400 transition-colors" />
            </div>
          </div>
        </Link>
        <Link to="/regulator-mode" className="block group">
          <div className="glass rounded-2xl p-5 border border-slate-500/20 hover:border-slate-500/50 transition-all hover:bg-slate-500/5">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircleIcon className="w-5 h-5 text-slate-400" />
                  <p className="text-sm font-semibold text-white/90">Regulator Mode</p>
                </div>
                <p className="text-xs text-white/50">ECB / DORA / ISO 22301 view</p>
              </div>
              <ArrowTrendingUpIcon className="w-6 h-6 text-slate-400/50 group-hover:text-slate-400 transition-colors" />
            </div>
          </div>
        </Link>
      </motion.div>

      {/* Four Column Layout: Alerts, Climate, Risk Distribution, System Overseer */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* SENTINEL Real-time Alerts - height matches Climate Risk Monitor */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="h-full flex flex-col min-h-0"
        >
          <AlertPanel maxAlerts={5} compact={true} fillHeight />
        </motion.div>

        {/* Climate Risk Monitor - LIVE DATA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="h-full min-h-0"
        >
          <ClimateWidget />
        </motion.div>

        {/* Risk Distribution — by risk level across all active assets (not portfolio-scoped) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="glass rounded-2xl p-6 border border-white/5"
        >
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-display font-semibold text-white/80">Asset Risk Distribution</h2>
              <p className="text-[10px] text-white/40 mt-0.5">All active assets in system</p>
            </div>
            <Link 
              to="/risk-zones-analysis"
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
              title="View Zone Dependencies Analysis"
            >
              <LinkIcon className="w-4 h-4 text-cyan-400/60 hover:text-cyan-400" />
            </Link>
          </div>
          <PieChart
            data={riskDistributionData}
            size={200}
            innerRadius={0.55}
            showLegend={true}
            showValues={true}
            valueFormat="number"
            title=""
          />
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
            className={`glass rounded-2xl p-6 border border-white/5 transition-all ${
              isRiskTrendFullscreen 
                ? 'fixed inset-4 z-50 bg-dark-card' 
                : ''
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <h3 className="text-white/80 text-sm font-medium">
                  Risk Trends & Financial Impact ({riskTrendTimeRange === '1D' ? '24 Hours' : 
                               riskTrendTimeRange === '1W' ? '7 Days' : 
                               riskTrendTimeRange === '1M' ? '30 Days' : 
                               riskTrendTimeRange === '3M' ? '90 Days' : 
                               riskTrendTimeRange === '1Y' ? '1 Year' : 'All Time'})
                </h3>
                <span className="text-[10px] text-white/30 flex items-center gap-1">
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
                  className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg"
                >
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: trend.color }}
                  />
                  <span className="text-xs text-white/70">{trend.name}</span>
                  <span className="text-xs font-medium text-white/90">{trend.current}</span>
                  <span className={`flex items-center text-xs font-medium ${
                    trend.direction === 'up' ? 'text-red-400' : 
                    trend.direction === 'down' ? 'text-emerald-400' : 
                    'text-white/50'
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
          </div>
          
          {/* Top Risk Assets - Ranked Decision Table (Institutional) */}
          <div className="glass rounded-2xl p-6 border border-white/5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white/80 text-sm font-medium">TOP RISK ASSETS</h3>
              <span className="text-amber-400 text-lg font-light">€221M ↗</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left text-white/40 text-[10px] uppercase tracking-wider py-2 px-2">Rank</th>
                    <th className="text-left text-white/40 text-[10px] uppercase tracking-wider py-2 px-2">Assets</th>
                    <th className="text-left text-white/40 text-[10px] uppercase tracking-wider py-2 px-2">Risk/Vet</th>
                    <th className="text-right text-white/40 text-[10px] uppercase tracking-wider py-2 px-2">Exposure</th>
                    <th className="text-left text-white/40 text-[10px] uppercase tracking-wider py-2 px-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {topRiskAssetsData.slice(0, 5).map((asset, idx) => {
                    const riskLevel = asset.risk > 0.8 ? 'critical' : asset.risk > 0.6 ? 'high' : 'medium'
                    const riskDriver = asset.risk > 0.85 ? 'Flood' : asset.risk > 0.75 ? 'Heat' : asset.risk > 0.65 ? 'Network' : 'Heat'
                    const owner = asset.risk > 0.8 ? 'Infra' : asset.risk > 0.7 ? 'Ops' : 'Risk'
                    const action = asset.risk > 0.85 ? 'Relocate' : asset.risk > 0.75 ? 'Capex' : asset.risk > 0.65 ? 'Backup' : 'Monitor'
                    const expectedLoss = Math.round(asset.value * 0.52)
                    
                    return (
                      <tr key={asset.label} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                        <td className="py-3 px-2">
                          <span className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-medium ${
                            riskLevel === 'critical' ? 'bg-red-500/20 text-red-400' :
                            riskLevel === 'high' ? 'bg-orange-500/20 text-orange-400' :
                            'bg-amber-500/20 text-amber-400'
                          }`}>
                            {idx + 1}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          <div className="text-white/90 font-medium">{asset.label}</div>
                          <div className="text-white/40 text-[10px]">{riskDriver}</div>
                        </td>
                        <td className="py-3 px-2">
                          <span className={`text-xs ${
                            riskLevel === 'critical' ? 'text-red-400' :
                            riskLevel === 'high' ? 'text-orange-400' :
                            'text-amber-400'
                          }`}>
                            {riskDriver}
                          </span>
                        </td>
                        <td className="py-3 px-2 text-right">
                          <span className="text-white/90">€{expectedLoss}M</span>
                        </td>
                        <td className="py-3 px-2">
                          <span className="inline-flex items-center px-2 py-1 rounded text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                            {action}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-xs">
              <div className="text-white/40">
                TOTAL COST: <span className="text-white/80">€221M</span> <span className="text-white/30">last 7 days</span>
              </div>
              <button className="px-3 py-1.5 bg-amber-500 text-black text-xs font-medium rounded hover:bg-amber-400 transition-colors">
                APPROVE
              </button>
            </div>
          </div>
        </div>
        
        {/* Scenario Comparison - Full Width */}
        <div className="glass rounded-2xl p-6 border border-white/5 mt-10">
          <ComparisonChart
            scenarios={scenarioComparisonData}
            title="Stress Test Scenario Comparison"
            showDelta={true}
          />
        </div>
      </motion.div>

      {/* Platform Layers - Real Data */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-8 glass rounded-2xl p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-display font-semibold">Platform Layers</h2>
          {isLoading && (
            <span className="text-xs text-white/40 flex items-center gap-2">
              <div className="w-3 h-3 border border-white/40 border-t-transparent rounded-full animate-spin" />
              Updating...
            </span>
          )}
          {error && (
            <span className="text-xs text-red-400">Using cached data</span>
          )}
          {platformData && (
            <span className="text-xs text-emerald-400 flex items-center gap-1">
              <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
              Live
            </span>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {layers.map((l) => (
            <div
              key={l.layer}
              className={`p-4 bg-dark-bg rounded-xl text-center cursor-pointer transition-all hover:bg-dark-bg/80 ${
                expandedLayer === l.layer ? 'ring-1 ring-primary-500/50' : ''
              }`}
              onClick={() => setExpandedLayer(expandedLayer === l.layer ? null : l.layer)}
            >
              <div className="flex items-center justify-center gap-1 text-xs text-dark-muted mb-1">
                {getLayerIcon(l.layer)}
                <span>Layer {l.layer}</span>
              </div>
              <div className="font-medium text-sm mb-2">{l.name}</div>
              <div className="text-2xl font-display font-bold gradient-text">{l.count}</div>
              <div className="flex items-center justify-center gap-1 mt-2">
                <span className={`inline-block text-xs px-2 py-1 rounded-full ${
                  l.status === 'active' ? 'bg-risk-low/20 text-risk-low' :
                  l.status === 'beta' ? 'bg-amber-500/20 text-amber-400' :
                  'bg-primary-500/20 text-primary-400'
                }`}>
                  {l.status}
                </span>
                <ChevronDownIcon className={`w-3 h-3 text-white/40 transition-transform ${
                  expandedLayer === l.layer ? 'rotate-180' : ''
                }`} />
              </div>
              
              {/* Expandable details */}
              <AnimatePresence>
                {expandedLayer === l.layer && (
                  <LayerDetailPanel 
                    layer={l as LayerMetrics} 
                    onClose={() => setExpandedLayer(null)} 
                  />
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
        
        {/* System health indicator */}
        {platformData && (
          <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2 text-white/40">
              <span>Total Records:</span>
              <span className="text-white/80">{platformData.total_records.toLocaleString()}</span>
            </div>
            <div className="flex items-center gap-2 text-white/40">
              <span>System Health:</span>
              <span className={`flex items-center gap-1 ${
                platformData.system_health === 'healthy' ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${
                  platformData.system_health === 'healthy' ? 'bg-emerald-400' : 'bg-amber-400'
                }`} />
                {platformData.system_health}
              </span>
            </div>
            <div className="text-white/40">
              Last sync: {new Date(platformData.last_sync).toLocaleTimeString()}
            </div>
          </div>
        )}
      </motion.div>
      
      {/* Recent Activity from Command Center */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
        className="mt-8"
      >
        <RecentActivityPanel events={recentEvents} maxItems={5} />
      </motion.div>
    </div>
  )
}
