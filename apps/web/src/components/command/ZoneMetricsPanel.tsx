/**
 * ZoneMetricsPanel - Selected Zone Metrics and Entity List
 * 
 * Tabs:
 * - Metrics: exposure, affected assets, recovery time, risk score
 * - Entities: list of affected organizations grouped by type
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  MapPinIcon, 
  BuildingOffice2Icon,
  ClockIcon,
  ExclamationTriangleIcon,
  BanknotesIcon,
  UserGroupIcon,
  BuildingLibraryIcon,
  ShieldCheckIcon,
  WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline'
import { RiskZone } from '../CesiumGlobe'

interface ZoneMetricsPanelProps {
  selectedZone: RiskZone | null
}

// Organization types with icons
const orgTypes = [
  { id: 'enterprise', label: 'Enterprise', icon: BuildingOffice2Icon, color: 'text-blue-400' },
  { id: 'bank', label: 'Banks', icon: BuildingLibraryIcon, color: 'text-emerald-400' },
  { id: 'insurer', label: 'Insurers', icon: ShieldCheckIcon, color: 'text-purple-400' },
  { id: 'infrastructure', label: 'Infrastructure', icon: WrenchScrewdriverIcon, color: 'text-orange-400' },
  { id: 'government', label: 'Government', icon: BuildingLibraryIcon, color: 'text-amber-400' },
]

// Mock entity data (in real app, this would come from API)
function generateMockEntities(zone: RiskZone) {
  const count = zone.affected_assets_count || 12
  const entities: Array<{
    id: string
    name: string
    type: string
    exposure: number
    risk: number
  }> = []
  
  const names: Record<string, string[]> = {
    enterprise: ['Tech Corp', 'Global Logistics', 'Energy Partners', 'Manufacturing Co'],
    bank: ['National Bank', 'Commerce Bank', 'Credit Union'],
    insurer: ['SafeGuard Insurance', 'Risk Partners'],
    infrastructure: ['Power Grid', 'Water Authority', 'Telecom Networks'],
    government: ['City Admin', 'Port Authority'],
  }
  
  for (let i = 0; i < Math.min(count, 15); i++) {
    const typeKey = orgTypes[i % orgTypes.length].id
    const typeNames = names[typeKey] || ['Entity']
    entities.push({
      id: `entity-${i}`,
      name: typeNames[i % typeNames.length] + (i > 4 ? ` ${Math.floor(i / 5) + 1}` : ''),
      type: typeKey,
      exposure: (zone.total_exposure || 10) * (Math.random() * 0.2 + 0.05),
      risk: Math.random() * 0.4 + 0.5,
    })
  }
  
  return entities
}

function formatBillions(value: number): string {
  if (value >= 1) return `$${value.toFixed(1)}B`
  return `$${(value * 1000).toFixed(0)}M`
}

function getRiskColor(risk: number): string {
  if (risk >= 0.8) return 'text-red-400'
  if (risk >= 0.6) return 'text-orange-400'
  if (risk >= 0.4) return 'text-amber-400'
  return 'text-emerald-400'
}

export default function ZoneMetricsPanel({ selectedZone }: ZoneMetricsPanelProps) {
  const [activeTab, setActiveTab] = useState<'metrics' | 'entities'>('metrics')
  
  // Generate mock entities for the zone
  const entities = selectedZone ? generateMockEntities(selectedZone) : []
  
  // Group entities by type
  const groupedEntities = entities.reduce((acc, entity) => {
    if (!acc[entity.type]) acc[entity.type] = []
    acc[entity.type].push(entity)
    return acc
  }, {} as Record<string, typeof entities>)

  return (
    <div className="h-full bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl p-4 flex flex-col">
      {/* Header with Tabs */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <MapPinIcon className="w-5 h-5 text-orange-400" />
          <h3 className="text-sm font-medium text-white">Zone Details</h3>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 rounded-lg p-0.5">
          {(['metrics', 'entities'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2.5 py-1 text-[10px] rounded-md transition-colors ${
                activeTab === tab
                  ? 'bg-orange-500/30 text-orange-400'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* No Zone Selected State */}
      {!selectedZone && (
        <div className="flex-1 flex items-center justify-center text-center">
          <div className="text-white/40">
            <MapPinIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No zone selected</p>
            <p className="text-xs mt-1">Click a zone on the globe</p>
          </div>
        </div>
      )}

      {/* Content */}
      {selectedZone && (
        <AnimatePresence mode="wait">
          {activeTab === 'metrics' && (
            <motion.div
              key="metrics"
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className="flex-1 flex flex-col gap-3 overflow-auto custom-scrollbar"
            >
              {/* Zone Name */}
              <div className="p-3 bg-white/5 rounded-lg border border-white/5">
                <div className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Zone</div>
                <div className="text-sm font-medium text-white">{selectedZone.name}</div>
                <div className="text-xs text-white/50 mt-0.5">Level: {selectedZone.zone_level}</div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-2 gap-2">
                {/* Risk Score */}
                <div className="p-3 bg-gradient-to-br from-red-500/10 to-transparent rounded-lg border border-red-500/20">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ExclamationTriangleIcon className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-[10px] text-white/50 uppercase">Risk Score</span>
                  </div>
                  <div className={`text-xl font-bold ${getRiskColor(selectedZone.risk_score)}`}>
                    {(selectedZone.risk_score * 100).toFixed(0)}%
                  </div>
                </div>

                {/* Exposure */}
                <div className="p-3 bg-gradient-to-br from-amber-500/10 to-transparent rounded-lg border border-amber-500/20">
                  <div className="flex items-center gap-1.5 mb-1">
                    <BanknotesIcon className="w-3.5 h-3.5 text-amber-400" />
                    <span className="text-[10px] text-white/50 uppercase">Exposure</span>
                  </div>
                  <div className="text-xl font-bold text-amber-400">
                    {formatBillions(selectedZone.total_exposure || 0)}
                  </div>
                </div>

                {/* Affected Assets */}
                <div className="p-3 bg-gradient-to-br from-purple-500/10 to-transparent rounded-lg border border-purple-500/20">
                  <div className="flex items-center gap-1.5 mb-1">
                    <BuildingOffice2Icon className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-[10px] text-white/50 uppercase">Assets</span>
                  </div>
                  <div className="text-xl font-bold text-purple-400">
                    {selectedZone.affected_assets_count || 0}
                  </div>
                </div>

                {/* Recovery Time */}
                <div className="p-3 bg-gradient-to-br from-blue-500/10 to-transparent rounded-lg border border-blue-500/20">
                  <div className="flex items-center gap-1.5 mb-1">
                    <ClockIcon className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-[10px] text-white/50 uppercase">Recovery</span>
                  </div>
                  <div className="text-xl font-bold text-blue-400">
                    {Math.round(12 + selectedZone.risk_score * 24)}d
                  </div>
                </div>
              </div>

              {/* Radius Info */}
              <div className="p-2 bg-white/5 rounded-lg text-xs text-white/50 flex items-center justify-between">
                <span>Radius: {(selectedZone.radius / 1000).toFixed(0)} km</span>
                <span>Lat: {selectedZone.center[1].toFixed(2)}, Lon: {selectedZone.center[0].toFixed(2)}</span>
              </div>
            </motion.div>
          )}

          {activeTab === 'entities' && (
            <motion.div
              key="entities"
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="flex-1 overflow-auto custom-scrollbar space-y-3"
            >
              {/* Entity count */}
              <div className="flex items-center gap-2 text-xs text-white/50">
                <UserGroupIcon className="w-4 h-4" />
                <span>{entities.length} affected entities</span>
              </div>

              {/* Grouped entities */}
              {orgTypes.map(orgType => {
                const typeEntities = groupedEntities[orgType.id]
                if (!typeEntities || typeEntities.length === 0) return null
                
                const Icon = orgType.icon
                
                return (
                  <div key={orgType.id} className="bg-white/5 rounded-lg border border-white/5 overflow-hidden">
                    {/* Group header */}
                    <div className="px-3 py-2 border-b border-white/5 flex items-center gap-2">
                      <Icon className={`w-4 h-4 ${orgType.color}`} />
                      <span className="text-xs font-medium text-white">{orgType.label}</span>
                      <span className="text-[10px] text-white/40 ml-auto">{typeEntities.length}</span>
                    </div>
                    
                    {/* Entity list */}
                    <div className="max-h-28 overflow-y-auto">
                      {typeEntities.map(entity => (
                        <div 
                          key={entity.id}
                          className="px-3 py-2 flex items-center justify-between border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors"
                        >
                          <span className="text-xs text-white/80 truncate flex-1">{entity.name}</span>
                          <div className="flex items-center gap-3 text-[10px]">
                            <span className="text-white/50">{formatBillions(entity.exposure)}</span>
                            <span className={getRiskColor(entity.risk)}>{(entity.risk * 100).toFixed(0)}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}
