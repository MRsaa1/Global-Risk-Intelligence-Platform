/**
 * Zone Detail Panel
 * ==================
 * 
 * Shows detailed information about a risk zone including:
 * - Zone metrics (exposure, expected loss, recovery time)
 * - List of affected entities by organization type
 * - Quick access to action plans and reports
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Professional SVG Icons
const OrgIcons: Record<string, JSX.Element> = {
  enterprise: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  bank: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
    </svg>
  ),
  developer: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  insurer: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  military: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21h18M9 8h1m4 0h1M9 12h1m4 0h1M9 16h1m4 0h1M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" />
    </svg>
  ),
  infrastructure: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  government: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
    </svg>
  ),
}

// Organization types with icons
const ORGANIZATION_TYPES = [
  { id: 'enterprise', label: 'Enterprises', icon: OrgIcons.enterprise },
  { id: 'bank', label: 'Financial Institutions', icon: OrgIcons.bank },
  { id: 'developer', label: 'Real Estate Developers', icon: OrgIcons.developer },
  { id: 'insurer', label: 'Insurance Companies', icon: OrgIcons.insurer },
  { id: 'military', label: 'Defense & Security', icon: OrgIcons.military },
  { id: 'infrastructure', label: 'Critical Infrastructure', icon: OrgIcons.infrastructure },
  { id: 'government', label: 'Government Agencies', icon: OrgIcons.government },
]

interface AffectedEntity {
  id: string
  name: string
  type: string
  exposure: number
  impactSeverity: number
  location: string
}

interface ZoneData {
  id: string
  name: string
  level: 'critical' | 'high' | 'medium' | 'low'
  stressTestName: string
  metrics: {
    totalExposure: number
    expectedLoss: number
    recoveryMonths: number
    affectedCount: number
    riskScore: number
  }
  entities: AffectedEntity[]
}

interface ZoneDetailPanelProps {
  zone: ZoneData | null
  onClose: () => void
  onViewReport: () => void
  onViewActionPlans: () => void
  onEntityClick: (entity: AffectedEntity) => void
}

// Helper to format currency
function formatCurrency(value: number): string {
  if (value >= 1000) return `€${(value / 1000).toFixed(1)}T`
  if (value >= 1) return `€${value.toFixed(1)}B`
  return `€${(value * 1000).toFixed(0)}M`
}

// Get level colors
function getLevelColors(level: string): { bg: string; text: string; border: string; glow: string } {
  switch (level) {
    case 'critical':
      return { bg: 'bg-red-500', text: 'text-red-400', border: 'border-red-500/30', glow: 'shadow-red-500/20' }
    case 'high':
      return { bg: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500/30', glow: 'shadow-orange-500/20' }
    case 'medium':
      return { bg: 'bg-yellow-500', text: 'text-yellow-400', border: 'border-yellow-500/30', glow: 'shadow-yellow-500/20' }
    default:
      return { bg: 'bg-emerald-500', text: 'text-emerald-400', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/20' }
  }
}

export default function ZoneDetailPanel({ 
  zone, 
  onClose, 
  onViewReport, 
  onViewActionPlans,
  onEntityClick 
}: ZoneDetailPanelProps) {
  const [expandedType, setExpandedType] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'entities' | 'timeline'>('entities')

  if (!zone) return null

  const colors = getLevelColors(zone.level)

  // Group entities by type
  const groupedEntities = ORGANIZATION_TYPES.map(type => ({
    ...type,
    entities: zone.entities.filter(e => e.type === type.id),
    totalExposure: zone.entities
      .filter(e => e.type === type.id)
      .reduce((sum, e) => sum + e.exposure, 0),
  })).filter(group => group.entities.length > 0)

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 50, scale: 0.95 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={{ opacity: 0, x: 50, scale: 0.95 }}
        transition={{ duration: 0.3 }}
        className="w-80 bg-black/80 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className={`px-4 py-3 ${colors.border} border-b bg-gradient-to-r from-white/5 to-transparent`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${colors.bg} ${zone.level === 'critical' ? 'animate-pulse' : ''}`} />
              <span className={`text-xs uppercase tracking-wider font-medium ${colors.text}`}>
                {zone.level} Zone
              </span>
            </div>
            <button
              onClick={onClose}
              className="text-white/40 hover:text-white transition-colors p-1"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          
          <h3 className="text-white text-lg font-light">{zone.name}</h3>
          <p className="text-white/40 text-xs mt-0.5">{zone.stressTestName}</p>
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-px bg-white/5">
          <div className="p-3 bg-[#030810]">
            <div className="text-white/30 text-[10px] uppercase tracking-wider mb-1">
              Exposure
            </div>
            <div className="text-white text-lg font-light">
              {formatCurrency(zone.metrics.totalExposure)}
            </div>
          </div>
          <div className="p-3 bg-[#030810]">
            <div className="text-white/30 text-[10px] uppercase tracking-wider mb-1">
              Expected Loss
            </div>
            <div className={`text-lg font-light ${colors.text}`}>
              {formatCurrency(zone.metrics.expectedLoss)}
            </div>
          </div>
          <div className="p-3 bg-[#030810]">
            <div className="text-white/30 text-[10px] uppercase tracking-wider mb-1">
              Recovery
            </div>
            <div className="text-white text-lg font-light">
              {zone.metrics.recoveryMonths} <span className="text-xs text-white/40">months</span>
            </div>
          </div>
          <div className="p-3 bg-[#030810]">
            <div className="text-white/30 text-[10px] uppercase tracking-wider mb-1">
              Affected
            </div>
            <div className="text-white text-lg font-light">
              {zone.metrics.affectedCount}
            </div>
          </div>
        </div>

        {/* Risk Score Bar */}
        <div className="px-4 py-3 border-b border-white/5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-white/40 text-xs">Risk Score</span>
            <span className={`text-sm font-mono ${colors.text}`}>
              {(zone.metrics.riskScore * 100).toFixed(0)}%
            </span>
          </div>
          <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${colors.bg}`}
              initial={{ width: 0 }}
              animate={{ width: `${zone.metrics.riskScore * 100}%` }}
              transition={{ duration: 0.6, delay: 0.2 }}
            />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-white/5">
          <button
            onClick={() => setActiveTab('entities')}
            className={`flex-1 px-4 py-2 text-xs transition-all ${
              activeTab === 'entities' 
                ? 'text-white border-b-2 border-cyan-500' 
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            Affected Entities
          </button>
          <button
            onClick={() => setActiveTab('timeline')}
            className={`flex-1 px-4 py-2 text-xs transition-all ${
              activeTab === 'timeline' 
                ? 'text-white border-b-2 border-cyan-500' 
                : 'text-white/40 hover:text-white/60'
            }`}
          >
            Impact Timeline
          </button>
        </div>

        {/* Content */}
        <div className="max-h-64 overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
          {activeTab === 'entities' && (
            <div className="p-3 space-y-1">
              {groupedEntities.map((group) => (
                <div key={group.id}>
                  {/* Group Header */}
                  <button
                    onClick={() => setExpandedType(expandedType === group.id ? null : group.id)}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-white/5 transition-all"
                  >
                    <span className="text-white/50">{group.icon}</span>
                    <span className="text-white/70 text-xs flex-1 text-left">
                      {group.label}
                    </span>
                    <span className="text-white/40 text-[10px] font-mono">
                      {group.entities.length}
                    </span>
                    <span className="text-white/20 text-[10px]">
                      {formatCurrency(group.totalExposure)}
                    </span>
                    <svg 
                      className={`w-3 h-3 text-white/30 transition-transform ${expandedType === group.id ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Entities List */}
                  <AnimatePresence>
                    {expandedType === group.id && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="ml-6 mt-1 space-y-0.5 border-l border-white/10 pl-2">
                          {group.entities.map((entity) => (
                            <button
                              key={entity.id}
                              onClick={() => onEntityClick(entity)}
                              className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 transition-all text-left group"
                            >
                              <div className={`
                                w-1 h-1 rounded-full
                                ${entity.impactSeverity > 0.8 ? 'bg-red-500' : 
                                  entity.impactSeverity > 0.6 ? 'bg-orange-500' : 
                                  entity.impactSeverity > 0.4 ? 'bg-yellow-500' : 'bg-green-500'}
                              `} />
                              <span className="text-white/60 text-xs group-hover:text-white flex-1 truncate">
                                {entity.name}
                              </span>
                              <span className="text-white/30 text-[10px] font-mono">
                                {formatCurrency(entity.exposure)}
                              </span>
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}

              {groupedEntities.length === 0 && (
                <div className="text-center py-6 text-white/30 text-xs">
                  No affected entities in this zone
                </div>
              )}
            </div>
          )}

          {activeTab === 'timeline' && (
            <div className="p-4">
              {/* Simple timeline visualization */}
              <div className="relative">
                {/* Timeline line */}
                <div className="absolute left-2 top-0 bottom-0 w-px bg-white/10" />
                
                {/* Timeline items */}
                <div className="space-y-4 ml-6">
                  <div className="relative">
                    <div className="absolute -left-[18px] w-2 h-2 rounded-full bg-red-500" />
                    <div className="text-white/40 text-[10px] uppercase tracking-wider">T+0</div>
                    <div className="text-white text-xs">Initial Impact</div>
                    <div className="text-red-400 text-xs font-mono">
                      -{formatCurrency(zone.metrics.expectedLoss * 0.6)}
                    </div>
                  </div>
                  
                  <div className="relative">
                    <div className="absolute -left-[18px] w-2 h-2 rounded-full bg-orange-500" />
                    <div className="text-white/40 text-[10px] uppercase tracking-wider">+3 months</div>
                    <div className="text-white text-xs">Cascade Effects</div>
                    <div className="text-orange-400 text-xs font-mono">
                      -{formatCurrency(zone.metrics.expectedLoss * 0.3)}
                    </div>
                  </div>
                  
                  <div className="relative">
                    <div className="absolute -left-[18px] w-2 h-2 rounded-full bg-yellow-500" />
                    <div className="text-white/40 text-[10px] uppercase tracking-wider">+{Math.floor(zone.metrics.recoveryMonths / 2)} months</div>
                    <div className="text-white text-xs">Recovery Begins</div>
                    <div className="text-yellow-400 text-xs font-mono">Stabilizing</div>
                  </div>
                  
                  <div className="relative">
                    <div className="absolute -left-[18px] w-2 h-2 rounded-full bg-emerald-500" />
                    <div className="text-white/40 text-[10px] uppercase tracking-wider">+{zone.metrics.recoveryMonths} months</div>
                    <div className="text-white text-xs">Full Recovery</div>
                    <div className="text-emerald-400 text-xs font-mono">Normal operations</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-3 border-t border-white/5 flex gap-2">
          <button
            onClick={onViewReport}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 transition-all text-xs text-white/70 hover:text-white"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            Report
          </button>
          <button
            onClick={onViewActionPlans}
            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 transition-all text-xs text-cyan-400 hover:text-cyan-300"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            Action Plans
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
