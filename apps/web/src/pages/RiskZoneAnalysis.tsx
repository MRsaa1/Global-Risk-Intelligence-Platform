/**
 * Risk Zone Dependencies Analysis Page
 * 
 * Full analysis of dependencies, causal chains, and cascade effects
 * between critical risk zones.
 * 
 * Updated: All emojis replaced with SVG icons, corporate colors only,
 * risk threshold synchronized with CommandCenter (risk > 0.8 for critical)
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  LinkIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  XMarkIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  ShieldExclamationIcon,
  BuildingOfficeIcon,
  CurrencyDollarIcon,
  UserGroupIcon,
  GlobeAltIcon,
  MapIcon,
  BoltIcon,
} from '@heroicons/react/24/outline'
import { chartColors } from '../lib/chartColors'

const API_BASE = '/api/v1'

interface ZoneDependency {
  zone1_id: string
  zone1_name: string
  zone2_id: string
  zone2_name: string
  dependency_type: string
  criticality: number
  mechanism: string
  category: string
}

interface CausalChain {
  root_cause: string
  chain: Array<{ zone_id: string; zone_name: string; step: number; description: string }>
  final_effect: string
  criticality: number
}

interface DependenciesData {
  last_updated?: string
  revision?: number
  zones: Array<{ id: string; name: string; lat: number; lng: number; risk: number }>
  dependencies: ZoneDependency[]
  causal_chains: CausalChain[]
  clusters: Array<{ 
    root_cause: string
    description: string
    detailed_description?: string
    criticality: number
    affected_count?: number
    cascade_potential?: number
    zones: string[] 
  }>
}

async function fetchDependencies(): Promise<DependenciesData> {
  const res = await fetch(`${API_BASE}/risk-zones/dependencies`)
  if (!res.ok) throw new Error(`Failed to fetch dependencies: ${res.status}`)
  return res.json()
}

type RiskCategory = 'all' | 'critical' | 'high' | 'medium' | 'low'

export default function RiskZoneAnalysis() {
  const [expandedCluster, setExpandedCluster] = useState<string | null>(null)
  const [expandedChain, setExpandedChain] = useState<number | null>(null)
  const [selectedZone, setSelectedZone] = useState<string | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)
  const [activeTab, setActiveTab] = useState<RiskCategory>('all')
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [actionMessage, setActionMessage] = useState<{ kind: 'success' | 'error' | 'info'; text: string } | null>(null)
  const [dependenciesExpanded, setDependenciesExpanded] = useState(false)

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['risk-zones-dependencies'],
    queryFn: fetchDependencies,
    refetchInterval: 60_000, // Refresh every minute
  })

  // Update dependencies via ANALYST agent
  const handleUpdateDependencies = async () => {
    setIsUpdating(true)
    try {
      const res = await fetch('/api/v1/risk-zones/update-dependencies', { method: 'POST' })
      if (!res.ok) throw new Error(`Update failed: ${res.status}`)
      const payload = await res.json().catch(() => ({} as any))
      const result = await refetch() // Refresh data after update
      const lastUpdated = payload.last_updated || result.data?.last_updated
      const revision = payload.revision || result.data?.revision

      if (payload.analysis_error) {
        setActionMessage({
          kind: 'error',
          text: `Update executed, but ANALYST reported an error: ${payload.analysis_error}`,
        })
      } else {
        setActionMessage({
          kind: 'success',
          text: `Updated. Revision ${revision ?? '-'} · ${lastUpdated ? `Last updated ${new Date(lastUpdated).toLocaleString()}` : ''}`.trim(),
        })
      }
    } catch (e) {
      console.error('Failed to update dependencies:', e)
      setActionMessage({
        kind: 'error',
        text: `Update failed. Ensure API is running on :9002 and refresh the page.`,
      })
    } finally {
      setIsUpdating(false)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      const result = await refetch()
      const lastUpdated = result.data?.last_updated
      const revision = result.data?.revision
      setActionMessage({
        kind: 'info',
        text: `Refreshed. Revision ${revision ?? '-'} · ${lastUpdated ? `Last updated ${new Date(lastUpdated).toLocaleString()}` : ''}`.trim(),
      })
    } catch (e) {
      console.error('Refresh failed:', e)
      setActionMessage({
        kind: 'error',
        text: `Refresh failed. Ensure API is running on :9002.`,
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <ArrowPathIcon className="w-12 h-12 mx-auto mb-4 text-primary-400 animate-spin" />
          <p className="text-dark-muted">Loading dependencies analysis...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 mb-4">Error loading dependencies</p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-primary-500 hover:bg-primary-600 rounded-lg"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!data) return null

  // Filter zones and dependencies by risk category
  // Use same thresholds as CommandCenter (risk > 0.8 for critical)
  const getRiskCategory = (risk: number): RiskCategory => {
    if (risk > 0.8) return 'critical'  // Changed from >= to > to match CommandCenter
    if (risk > 0.6) return 'high'
    if (risk > 0.4) return 'medium'
    return 'low'
  }

  const filteredZones = data.zones.filter(zone => {
    if (activeTab === 'all') return true
    return getRiskCategory(zone.risk) === activeTab
  })

  const filteredDependencies = data.dependencies.filter(dep => {
    if (activeTab === 'all') return true
    const zone1 = data.zones.find(z => z.id === dep.zone1_id)
    const zone2 = data.zones.find(z => z.id === dep.zone2_id)
    if (!zone1 || !zone2) return false
    return getRiskCategory(zone1.risk) === activeTab || getRiskCategory(zone2.risk) === activeTab
  })

  const filteredCausalChains = data.causal_chains.filter(chain => {
    if (activeTab === 'all') return true
    return chain.chain.some(step => {
      const zone = data.zones.find(z => z.id === step.zone_id)
      return zone && getRiskCategory(zone.risk) === activeTab
    })
  })

  // Filter clusters - show only those containing zones from selected category
  const filteredClusters = data.clusters.filter(cluster => {
    if (activeTab === 'all') return true
    return cluster.zones.some(zoneId => {
      const zone = data.zones.find(z => z.id === zoneId)
      return zone && getRiskCategory(zone.risk) === activeTab
    })
  })

  const getDependencyColor = (type: string, criticality: number) => {
    // Use corporate colors from chartColors
    if (type === 'direct') {
      if (criticality > 0.9) return 'text-red-500 border-red-500/30 bg-red-500/10'
      if (criticality > 0.7) return 'text-orange-500 border-orange-500/30 bg-orange-500/10'
      return 'text-yellow-500 border-yellow-500/30 bg-yellow-500/10'
    }
    if (type === 'indirect') {
      return 'text-blue-500 border-blue-500/30 bg-blue-500/10'
    }
    return 'text-gray-400 border-gray-400/30 bg-gray-400/10'
  }

  const getCategoryIcon = (category: string) => {
    const iconClass = "w-4 h-4 inline-block"
    switch (category) {
      case 'systemic':
        return <BoltIcon className={iconClass} />
      case 'military':
        return <ShieldExclamationIcon className={iconClass} />
      case 'infrastructure':
        return <BuildingOfficeIcon className={iconClass} />
      case 'economic':
        return <CurrencyDollarIcon className={iconClass} />
      case 'migration':
        return <UserGroupIcon className={iconClass} />
      case 'global':
        return <GlobeAltIcon className={iconClass} />
      case 'geopolitical':
        return <MapIcon className={iconClass} />
      default:
        return <LinkIcon className={iconClass} />
    }
  }

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
              Risk Zones Dependencies Analysis
            </h1>
            <p className="text-dark-muted mt-2">
              Comprehensive analysis of dependencies, causal chains, and cascade effects between risk zones
            </p>
            <div className="mt-2 text-xs text-white/40">
              {data.revision !== undefined && (
                <span className="mr-3">Revision: {data.revision}</span>
              )}
              {data.last_updated && (
                <span>Last updated: {new Date(data.last_updated).toLocaleString()}</span>
              )}
            </div>
            {actionMessage && (
              <div
                className={`mt-2 text-xs ${
                  actionMessage.kind === 'success'
                    ? 'text-emerald-400'
                    : actionMessage.kind === 'error'
                      ? 'text-red-400'
                      : 'text-white/50'
                }`}
              >
                {actionMessage.text}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleUpdateDependencies}
              disabled={isUpdating}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Update dependencies via ANALYST agent (real-time analysis)"
            >
              <ArrowPathIcon className={`w-4 h-4 ${isUpdating ? 'animate-spin' : ''}`} />
              {isUpdating ? 'Updating...' : 'Update via ANALYST'}
            </button>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-2 px-4 py-2 bg-dark-card hover:bg-dark-border rounded-lg transition-colors"
            >
              <ArrowPathIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </motion.div>

      {/* Tabs for Risk Categories */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6"
      >
        <div className="flex items-center gap-2 border-b border-white/10">
          {(['all', 'critical', 'high', 'medium', 'low'] as RiskCategory[]).map((tab) => {
            const count = tab === 'all' 
              ? data.zones.length
              : data.zones.filter(z => getRiskCategory(z.risk) === tab).length
            return (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-400'
                    : 'border-transparent text-white/50 hover:text-white/80'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)} ({count})
              </button>
            )
          })}
        </div>
      </motion.div>

      {/* Summary Stats */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="grid grid-cols-4 gap-4 mb-8"
      >
        <div className="glass rounded-xl p-4 border border-white/5">
          <div className="text-2xl font-bold text-white/80">{filteredZones.length}</div>
          <div className="text-sm text-white/50">Zones ({activeTab})</div>
        </div>
        <div className="glass rounded-xl p-4 border border-white/5">
          <div className="text-2xl font-bold text-white/80">{filteredDependencies.length}</div>
          <div className="text-sm text-white/50">Dependencies</div>
        </div>
        <div className="glass rounded-xl p-4 border border-white/5">
          <div className="text-2xl font-bold text-white/80">{filteredCausalChains.length}</div>
          <div className="text-sm text-white/50">Causal Chains</div>
        </div>
        <div className="glass rounded-xl p-4 border border-white/5">
          <div className="text-2xl font-bold text-white/80">{filteredClusters.length}</div>
          <div className="text-sm text-white/50">Root Cause Clusters</div>
        </div>
      </motion.div>

      {/* Root Cause Clusters */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="mb-8"
      >
        <div className="mb-4">
          <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
            <InformationCircleIcon className="w-5 h-5 text-primary-400" />
            Root Cause Clusters
          </h2>
          <p className="text-sm text-white/50">
            Fundamental systemic causes that unite risk zones. Each cluster represents a root cause affecting multiple zones, 
            creating systemic risks that require comprehensive risk management approaches.
          </p>
        </div>
        <div className="space-y-3">
          {filteredClusters.length === 0 ? (
            <div className="text-center py-8 text-white/40">
              No root cause clusters found for {activeTab} risk zones
            </div>
          ) : (
            filteredClusters.map((cluster) => (
            <div
              key={cluster.root_cause}
              className="glass rounded-xl p-4 border border-white/5"
            >
              <button
                onClick={() => setExpandedCluster(
                  expandedCluster === cluster.root_cause ? null : cluster.root_cause
                )}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    cluster.criticality > 0.9 ? 'bg-red-500' :
                    cluster.criticality > 0.7 ? 'bg-orange-500' : 'bg-yellow-500'
                  }`} />
                  <div className="text-left">
                    <div className="font-medium text-white/80">{cluster.description}</div>
                    <div className="text-xs text-white/50">
                      Criticality: {(cluster.criticality * 100).toFixed(0)}% · {cluster.zones.length} zones
                      {cluster.detailed_description && (
                        <div className="mt-1 text-white/40 text-[10px] line-clamp-1">
                          {cluster.detailed_description}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                {expandedCluster === cluster.root_cause ? (
                  <ChevronUpIcon className="w-5 h-5 text-white/40" />
                ) : (
                  <ChevronDownIcon className="w-5 h-5 text-white/40" />
                )}
              </button>
              <AnimatePresence>
                {expandedCluster === cluster.root_cause && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 pt-4 border-t border-white/10 overflow-hidden"
                  >
                    <div className="mb-3">
                      {cluster.detailed_description && (
                        <p className="text-sm text-white/60 mb-3">{cluster.detailed_description}</p>
                      )}
                      <div className="flex items-center gap-4 text-xs text-white/50">
                        <span>Affected Zones: {cluster.affected_count || cluster.zones.length}</span>
                        {cluster.cascade_potential && (
                          <span>Cascade Potential: {(cluster.cascade_potential * 100).toFixed(0)}%</span>
                        )}
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      {cluster.zones
                        .map(zoneId => {
                          const zone = data.zones.find(z => z.id === zoneId)
                          return zone ? { zoneId, zone } : null
                        })
                        .filter((item): item is { zoneId: string; zone: typeof data.zones[0] } => {
                          if (!item) return false
                          if (activeTab === 'all') return true
                          return getRiskCategory(item.zone.risk) === activeTab
                        })
                        .map(({ zoneId, zone }) => (
                          <div
                            key={zoneId}
                            className="p-2 rounded-lg bg-black/30 border border-white/5 text-sm"
                          >
                            <div className="font-medium text-white/80">{zone.name}</div>
                            <div className="text-xs text-white/50">Risk: {(zone.risk * 100).toFixed(0)}%</div>
                          </div>
                        ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            ))
          )}
        </div>
      </motion.div>

      {/* Dependencies */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setDependenciesExpanded((v) => !v)}
            className="flex items-center gap-2 text-xl font-semibold text-white/90 hover:text-white transition-colors"
            title={dependenciesExpanded ? 'Collapse' : 'Expand'}
          >
            <LinkIcon className="w-5 h-5 text-primary-400" />
            Zone Dependencies
            {dependenciesExpanded ? (
              <ChevronUpIcon className="w-5 h-5 text-white/40" />
            ) : (
              <ChevronDownIcon className="w-5 h-5 text-white/40" />
            )}
          </button>
          <div className="text-xs text-white/40">
            {filteredDependencies.length} links
          </div>
        </div>
        <p className="text-sm text-white/50 mb-4">
          Dependencies are collapsed by default to keep the page readable. Expand to inspect individual links.
        </p>

        <AnimatePresence>
          {dependenciesExpanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="space-y-3">
                {filteredDependencies.length === 0 ? (
                  <div className="text-center py-8 text-white/40">
                    No dependencies found for {activeTab} risk zones
                  </div>
                ) : (
                  filteredDependencies.map((dep, idx) => (
                    <div
                      key={idx}
                      className={`glass rounded-xl p-4 border ${getDependencyColor(dep.dependency_type, dep.criticality)}`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="text-white/60">
                              {getCategoryIcon(dep.category)}
                            </div>
                            <div className="font-medium text-white/80">
                              {dep.zone1_name} ↔ {dep.zone2_name}
                            </div>
                            <span className={`px-2 py-0.5 rounded text-xs ${
                              dep.dependency_type === 'direct' ? 'bg-amber-500/20 text-amber-300' :
                              dep.dependency_type === 'indirect' ? 'bg-blue-500/20 text-blue-300' :
                              'bg-white/10 text-white/50'
                            }`}>
                              {dep.dependency_type}
                            </span>
                          </div>
                          <div className="text-sm text-white/60 mb-2">{dep.mechanism}</div>
                          <div className="flex items-center gap-4 text-xs text-white/50">
                            <span>Strength: {(dep.criticality * 100).toFixed(0)}%</span>
                            <span className="capitalize">Category: {dep.category}</span>
                          </div>
                          <div className="mt-2 pt-2 border-t border-white/5 text-xs text-white/40">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <span className="text-white/30">Zone 1 Risk:</span>{' '}
                                <span className="text-white/60">
                                  {data.zones.find(z => z.id === dep.zone1_id)?.risk
                                    ? `${(data.zones.find(z => z.id === dep.zone1_id)!.risk * 100).toFixed(0)}%`
                                    : 'N/A'}
                                </span>
                              </div>
                              <div>
                                <span className="text-white/30">Zone 2 Risk:</span>{' '}
                                <span className="text-white/60">
                                  {data.zones.find(z => z.id === dep.zone2_id)?.risk
                                    ? `${(data.zones.find(z => z.id === dep.zone2_id)!.risk * 100).toFixed(0)}%`
                                    : 'N/A'}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Causal Chains */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Causal Chains</h2>
          <div className="text-xs text-white/40">
            {filteredCausalChains.length} active chains
          </div>
        </div>
        <p className="text-sm text-white/50 mb-4">
          Cause-and-effect sequences showing how events in one zone trigger cascading effects across the network. 
          Each chain represents a potential risk propagation path that could affect multiple zones.
        </p>
        <div className="space-y-4">
          {filteredCausalChains.length === 0 ? (
            <div className="text-center py-8 text-white/40">
              No causal chains found for {activeTab} risk zones
            </div>
          ) : (
            filteredCausalChains.map((chain, idx) => (
            <div
              key={idx}
              className="glass rounded-xl p-4 border border-white/5"
            >
              <button
                onClick={() => setExpandedChain(expandedChain === idx ? null : idx)}
                className="w-full flex items-center justify-between mb-2"
              >
                <div>
                  <div className="font-medium text-white/80">{chain.root_cause}</div>
                  <div className="text-sm text-white/50">
                    → {chain.final_effect} · Criticality: {(chain.criticality * 100).toFixed(0)}%
                  </div>
                </div>
                {expandedChain === idx ? (
                  <ChevronUpIcon className="w-5 h-5 text-white/40" />
                ) : (
                  <ChevronDownIcon className="w-5 h-5 text-white/40" />
                )}
              </button>
              <AnimatePresence>
                {expandedChain === idx && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-4 pt-4 border-t border-white/10 overflow-hidden"
                  >
                    <div className="mb-3 text-xs text-white/50">
                      <div className="flex items-center gap-4">
                        <span>Chain Length: {chain.chain.length} steps</span>
                        <span>Criticality: {(chain.criticality * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {chain.chain.map((step, stepIdx) => {
                        const zone = data.zones.find(z => z.id === step.zone_id)
                        return (
                          <div
                            key={stepIdx}
                            className="flex items-center gap-3 p-2 rounded-lg bg-black/30"
                          >
                            <div className="w-8 h-8 rounded-full bg-primary-500/20 flex items-center justify-center text-xs font-medium text-primary-300">
                              {step.step}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2">
                                <div className="font-medium text-white/80">{step.zone_name}</div>
                                {zone && (
                                  <span className="text-xs text-white/40">
                                    (Risk: {(zone.risk * 100).toFixed(0)}%)
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-white/50">{step.description}</div>
                            </div>
                            {stepIdx < chain.chain.length - 1 && (
                              <div className="text-white/20 text-xs">→</div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/5 text-xs text-white/40">
                      <div className="font-medium text-white/60 mb-1">Final Effect:</div>
                      <div className="text-white/70">{chain.final_effect}</div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            ))
          )}
        </div>
      </motion.div>

      {/* Consequences Analysis */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mb-8"
      >
        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
          <ExclamationTriangleIcon className="w-5 h-5 text-red-400" />
          Consequences Analysis
        </h2>
        <p className="text-sm text-white/50 mb-4">
          Potential consequences of risk escalation in {activeTab === 'all' ? 'all zones' : activeTab} zones. 
          Analysis includes humanitarian, economic, infrastructure, geopolitical, and cascade effects.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredZones
            .filter(z => z.risk > 0.7) // Show consequences for high-risk zones
            .slice(0, 6)
            .map((zone) => (
              <div
                key={zone.id}
                className="glass rounded-xl p-4 border border-white/5"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="font-medium text-white/80">{zone.name}</div>
                  <div className={`text-xs px-2 py-1 rounded ${
                    zone.risk > 0.9 ? 'bg-red-500/20 text-red-400' :
                    zone.risk > 0.8 ? 'bg-orange-500/20 text-orange-400' :
                    'bg-yellow-500/20 text-yellow-400'
                  }`}>
                    Risk: {(zone.risk * 100).toFixed(0)}%
                  </div>
                </div>
                <div className="space-y-2 text-sm">
                  {zone.risk > 0.9 && (
                    <>
                      <div className="text-red-400/80">• Humanitarian: Mass displacement, refugee crisis</div>
                      <div className="text-orange-400/80">• Economic: Supply chain disruption, market volatility</div>
                    </>
                  )}
                  {zone.risk > 0.8 && (
                    <div className="text-yellow-400/80">• Infrastructure: Critical systems failure, energy grid disruption</div>
                  )}
                  <div className="text-blue-400/80">• Geopolitical: Regional instability, international tensions</div>
                  <div className="text-gray-400/80">• Cascade: Risk propagation to connected zones</div>
                </div>
              </div>
            ))}
        </div>
        {filteredZones.filter(z => z.risk >= 0.7).length === 0 && (
          <div className="text-center py-8 text-white/40">
            No high-risk zones in {activeTab} category
          </div>
        )}
      </motion.div>
    </div>
  )
}
