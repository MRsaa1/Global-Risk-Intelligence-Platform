import { useState } from 'react'
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
} from '@heroicons/react/24/outline'
import AlertPanel from '../components/AlertPanel'

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

const stats = [
  { name: 'Total Assets', value: '1,284', icon: BuildingOffice2Icon, change: '+12%', color: 'primary' },
  { name: 'At Risk', value: '23', icon: ExclamationTriangleIcon, change: '-5%', color: 'risk-high' },
  { name: 'Digital Twins', value: '1,156', icon: CubeTransparentIcon, change: '+8%', color: 'accent' },
  { name: 'Portfolio Value', value: '€4.2B', icon: ArrowTrendingUpIcon, change: '+3.2%', color: 'primary' },
]


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
            <span className="text-cyan-400">{(details.external_sources || 0).toLocaleString()}</span>
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
            <span className="text-cyan-400">{details.edges || 0}</span>
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
  
  // Fetch platform layers from API
  const { data: platformData, isLoading, error } = useQuery({
    queryKey: ['platformLayers'],
    queryFn: fetchPlatformLayers,
    refetchInterval: 30000, // Refresh every 30 seconds
    staleTime: 10000,
  })
  
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
        <h1 className="text-3xl font-display font-bold gradient-text">
          Physical-Financial Risk Platform
        </h1>
        <p className="text-dark-muted mt-2">
          The Operating System for the Physical Economy
        </p>
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
            className="glass rounded-2xl p-6 hover:glow-primary transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-dark-muted text-sm">{stat.name}</p>
                <p className="text-3xl font-display font-bold mt-2">{stat.value}</p>
                <p className={`text-sm mt-2 ${stat.change.startsWith('+') ? 'text-risk-low' : 'text-risk-high'}`}>
                  {stat.change} from last month
                </p>
              </div>
              <div className={`p-3 rounded-xl ${stat.color === 'primary' ? 'bg-primary-500/20' : stat.color === 'accent' ? 'bg-accent-500/20' : 'bg-red-500/20'}`}>
                <stat.icon className={`w-6 h-6 ${stat.color === 'primary' ? 'text-primary-400' : stat.color === 'accent' ? 'text-accent-400' : 'text-red-400'}`} />
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SENTINEL Real-time Alerts */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
        >
          <AlertPanel maxAlerts={5} compact={true} />
        </motion.div>

        {/* Risk Distribution */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="glass rounded-2xl p-6"
        >
          <h2 className="text-xl font-display font-semibold mb-4">Risk Distribution</h2>
          <div className="space-y-4">
            {[
              { label: 'Climate Risk', value: 45, color: 'primary' },
              { label: 'Physical Risk', value: 28, color: 'accent' },
              { label: 'Network Risk', value: 62, color: 'risk-medium' },
              { label: 'Financial Risk', value: 35, color: 'primary' },
            ].map((risk) => (
              <div key={risk.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{risk.label}</span>
                  <span className={
                    risk.value > 60 ? 'text-risk-high' :
                    risk.value > 40 ? 'text-risk-medium' : 'text-risk-low'
                  }>{risk.value}%</span>
                </div>
                <div className="h-2 bg-dark-bg rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${risk.value}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className={`h-full rounded-full ${
                      risk.color === 'primary' ? 'bg-primary-500' :
                      risk.color === 'accent' ? 'bg-accent-500' :
                      'bg-amber-500'
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

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
    </div>
  )
}
