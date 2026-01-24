import { useState, useMemo, useRef, useEffect } from 'react'
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
} from '@heroicons/react/24/outline'
import AlertPanel from '../components/AlertPanel'
import ClimateWidget from '../components/ClimateWidget'
import RecentActivityPanel from '../components/dashboard/RecentActivityPanel'
// New chart components
import TimeSeriesChart from '../components/charts/TimeSeriesChart'
import PieChart from '../components/charts/PieChart'
import BarChart3D from '../components/charts/BarChart3D'
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

// Stats are now derived from platform store (synced with Command Center)
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
  const stats = useStats()
  const activeStressTest = useActiveStressTest()
  const recentEvents = useRecentEvents(5)
  const { wsStatus } = usePlatformStore()
  
  // Platform WebSocket - receives events from Command Center
  usePlatformWebSocket(['dashboard', 'stress_tests', 'alerts'])
  
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
  
  // Sample annotations for the risk trend chart
  const riskTrendAnnotations = useMemo(() => {
    const now = new Date()
    const days = getDaysFromTimeRange(riskTrendTimeRange)
    
    // Generate sample annotations based on time range
    const annotations: Array<{ date: Date; label: string; type: 'stress-test' | 'alert' | 'event' }> = []
    
    if (days >= 7) {
      // Add a stress test from 5 days ago
      const stressTestDate = new Date(now)
      stressTestDate.setDate(stressTestDate.getDate() - 5)
      annotations.push({
        date: stressTestDate,
        label: 'Climate Stress Test',
        type: 'stress-test',
      })
    }
    
    if (days >= 14) {
      // Add an alert from 12 days ago
      const alertDate = new Date(now)
      alertDate.setDate(alertDate.getDate() - 12)
      annotations.push({
        date: alertDate,
        label: 'High Risk Alert: Frankfurt Tower',
        type: 'alert',
      })
    }
    
    if (days >= 21) {
      // Add a system event from 18 days ago
      const eventDate = new Date(now)
      eventDate.setDate(eventDate.getDate() - 18)
      annotations.push({
        date: eventDate,
        label: 'Model Update Deployed',
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
    if (!topRiskAssetsResponse?.assets) {
      return getTopRiskAssetsData() // Fallback
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
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold gradient-text">
              Physical-Financial Risk Platform
            </h1>
            <p className="text-dark-muted mt-2">
              The Operating System for the Physical Economy
            </p>
          </div>
          
          {/* Live sync indicator */}
          <div className="flex items-center gap-4">
            {/* Active Stress Test indicator */}
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
                    <span className="ml-2 text-amber-400/70">
                      {activeStressTest.progress}%
                    </span>
                  )}
                </span>
              </motion.div>
            )}
            
            {/* WebSocket status */}
            <div className="flex items-center gap-1.5 text-xs">
              <SignalIcon className={`w-4 h-4 ${
                wsStatus === 'connected' ? 'text-emerald-400' : 
                wsStatus === 'connecting' ? 'text-amber-400 animate-pulse' : 
                'text-white/30'
              }`} />
              <span className={`${
                wsStatus === 'connected' ? 'text-emerald-400' : 
                wsStatus === 'connecting' ? 'text-amber-400' : 
                'text-white/30'
              }`}>
                {wsStatus === 'connected' ? 'Live' : 
                 wsStatus === 'connecting' ? 'Connecting...' : 
                 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
      >
        {stats.map((stat) => (
          <motion.div
            key={stat.name}
            variants={item}
            className="glass rounded-2xl p-6 border border-white/5"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/50 text-xs">{stat.name}</p>
                <p className="text-2xl font-display font-bold mt-2 text-white/90">{stat.value}</p>
                <p className={`text-xs mt-2 ${stat.change.startsWith('+') ? 'text-white/50' : 'text-white/40'}`}>
                  {stat.change} from last month
                </p>
              </div>
              <div className={`p-2.5 rounded-xl ${stat.color === 'primary' ? 'bg-primary-500/10 border border-primary-500/20' : stat.color === 'accent' ? 'bg-accent-500/10 border border-accent-500/20' : 'bg-white/5 border border-white/10'}`}>
                <stat.icon className={`w-5 h-5 ${stat.color === 'primary' ? 'text-primary-400' : stat.color === 'accent' ? 'text-accent-400' : 'text-white/60'}`} />
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* SENTINEL Real-time Alerts */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <AlertPanel maxAlerts={5} compact={true} />
        </motion.div>

        {/* Climate Risk Monitor - LIVE DATA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
        >
          <ClimateWidget />
        </motion.div>

        {/* Risk Distribution - Enhanced with PieChart */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
          className="glass rounded-2xl p-6 border border-white/5"
        >
          <h2 className="text-sm font-display font-semibold mb-4 text-white/80">Asset Risk Distribution</h2>
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
                  Risk Trends ({riskTrendTimeRange === '1D' ? '24 Hours' : 
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
              valueFormat="number"
              thresholds={[
                { value: 60, label: 'WARNING', color: '#f59e0b', style: 'dashed' },
                { value: 80, label: 'CRITICAL', color: '#ef4444', style: 'dashed' },
              ]}
              annotations={riskTrendAnnotations}
            />
          </div>
          
          {/* Top Risk Assets - 3D Bar Chart */}
          <div className="glass rounded-2xl p-6 border border-white/5 pb-4">
            <BarChart3D
              data={topRiskAssetsData}
              height={400}
              showGrid={true}
              showLabels={true}
              showValues={true}
              title="Top Risk Assets"
              valueFormat="number"
              colorByRisk={true}
            />
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
