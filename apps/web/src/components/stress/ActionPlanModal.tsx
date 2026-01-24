/**
 * Action Plan Modal
 * ==================
 * 
 * Full-screen modal showing action plans for each organization type.
 * Includes priority levels, timelines, and ROI metrics.
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { exportStressTestPdf } from '../../lib/exportService'

interface ActionPlan {
  id: string
  organizationType: string
  organizationName?: string
  actions: string[]
  priority: 'critical' | 'high' | 'medium' | 'low'
  timeline: string
  estimatedCost?: number
  riskReduction?: number
  roiPercentage?: number
}

interface ActionPlanModalProps {
  isOpen: boolean
  onClose: () => void
  stressTestName: string
  zoneName?: string
  actionPlans: ActionPlan[]
}

// Professional SVG Icons for organization types
const OrgIcons: Record<string, JSX.Element> = {
  developer: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  insurer: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  bank: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
    </svg>
  ),
  enterprise: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  military: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 21h18M9 8h1m4 0h1M9 12h1m4 0h1M9 16h1m4 0h1M5 21V5a2 2 0 012-2h10a2 2 0 012 2v16" />
    </svg>
  ),
  government: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
    </svg>
  ),
  infrastructure: (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
}

// Organization config
const ORG_CONFIG: Record<string, { icon: JSX.Element; label: string; color: string }> = {
  developer: { icon: OrgIcons.developer, label: 'Real Estate Developers', color: 'blue' },
  insurer: { icon: OrgIcons.insurer, label: 'Insurance Companies', color: 'purple' },
  bank: { icon: OrgIcons.bank, label: 'Financial Institutions', color: 'emerald' },
  enterprise: { icon: OrgIcons.enterprise, label: 'Enterprises', color: 'cyan' },
  military: { icon: OrgIcons.military, label: 'Defense & Security', color: 'orange' },
  government: { icon: OrgIcons.government, label: 'Government Agencies', color: 'yellow' },
  infrastructure: { icon: OrgIcons.infrastructure, label: 'Critical Infrastructure', color: 'red' },
}

// Priority config
const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  critical: { label: 'CRITICAL', color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/30' },
  high: { label: 'HIGH', color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/30' },
  medium: { label: 'MEDIUM', color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/30' },
  low: { label: 'LOW', color: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500/30' },
}

// Color classes
const COLOR_CLASSES: Record<string, { text: string; bg: string; border: string }> = {
  blue: { text: 'text-blue-400', bg: 'bg-blue-500', border: 'border-blue-500/30' },
  purple: { text: 'text-purple-400', bg: 'bg-purple-500', border: 'border-purple-500/30' },
  emerald: { text: 'text-emerald-400', bg: 'bg-emerald-500', border: 'border-emerald-500/30' },
  cyan: { text: 'text-amber-400', bg: 'bg-amber-500', border: 'border-amber-500/30' },
  orange: { text: 'text-orange-400', bg: 'bg-orange-500', border: 'border-orange-500/30' },
  yellow: { text: 'text-yellow-400', bg: 'bg-yellow-500', border: 'border-yellow-500/30' },
  red: { text: 'text-red-400', bg: 'bg-red-500', border: 'border-red-500/30' },
}

function formatCurrency(value: number): string {
  if (value >= 1000000) return `€${(value / 1000000).toFixed(1)}M`
  if (value >= 1000) return `€${(value / 1000).toFixed(0)}K`
  return `€${value.toFixed(0)}`
}

export default function ActionPlanModal({ 
  isOpen, 
  onClose, 
  stressTestName,
  zoneName,
  actionPlans 
}: ActionPlanModalProps) {
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'critical' | 'high'>('all')
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  // Handle PDF export
  const handleExportPdf = async () => {
    setIsExporting(true)
    setExportError(null)

    try {
      // Prepare stress test data
      const stressTestData = {
        name: stressTestName,
        type: 'climate',
        scenario_name: stressTestName,
        region_name: zoneName || 'Global',
        severity: 0.7,
        nvidia_enhanced: true,
      }

      // Convert action plans to zones format for PDF
      const zones = actionPlans.map(plan => ({
        name: plan.organizationName || plan.organizationType,
        zone_level: plan.priority,
        zone_type: 'action_plan',
        affected_assets_count: plan.actions.length,
        expected_loss: plan.estimatedCost || 0,
        population_affected: 0,
        risk_score: plan.riskReduction ? (1 - plan.riskReduction) * 100 : 50,
      }))

      // Convert action plans to actions format for PDF
      const actions = actionPlans.flatMap(plan => 
        plan.actions.map((action, idx) => ({
          title: action,
          priority: plan.priority === 'critical' ? 'Critical' : plan.priority === 'high' ? 'High' : 'Medium',
          timeline: plan.timeline,
          estimated_cost: plan.estimatedCost ? plan.estimatedCost / plan.actions.length : 0,
          risk_reduction: plan.riskReduction ? Math.round(plan.riskReduction * 100 / plan.actions.length) : 10,
        }))
      )

      await exportStressTestPdf(stressTestData, zones, actions)
      
      console.log('✅ PDF exported successfully')
    } catch (error) {
      console.error('❌ PDF export failed:', error)
      setExportError(error instanceof Error ? error.message : 'Failed to export PDF')
    } finally {
      setIsExporting(false)
    }
  }

  // Filter plans
  const filteredPlans = actionPlans.filter(plan => {
    if (filter === 'all') return true
    if (filter === 'critical') return plan.priority === 'critical'
    if (filter === 'high') return plan.priority === 'critical' || plan.priority === 'high'
    return true
  })

  // Sort by priority
  const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 }
  const sortedPlans = [...filteredPlans].sort((a, b) => 
    priorityOrder[a.priority] - priorityOrder[b.priority]
  )

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-8"
      >
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />

        {/* Modal Content */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3 }}
          className="relative w-full max-w-4xl max-h-[85vh] bg-[#0a0f18] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-amber-500/10 to-transparent">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <h2 className="text-white text-xl font-light">Action Plans</h2>
                </div>
                <p className="text-white/40 text-sm">
                  {stressTestName}
                  {zoneName && <span className="text-white/20"> • {zoneName}</span>}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-white/40 hover:text-white transition-colors rounded-lg hover:bg-white/5"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2 mt-4">
              {[
                { id: 'all', label: 'All Plans' },
                { id: 'critical', label: 'Critical Only' },
                { id: 'high', label: 'High Priority' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setFilter(tab.id as typeof filter)}
                  className={`px-3 py-1.5 rounded-lg text-xs transition-all ${
                    filter === tab.id
                      ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      : 'text-white/40 hover:text-white/60 hover:bg-white/5'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Plans Grid */}
          <div className="p-6 max-h-[calc(85vh-180px)] overflow-y-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sortedPlans.map((plan) => {
                const orgConfig = ORG_CONFIG[plan.organizationType] || {
                  icon: OrgIcons.enterprise,
                  label: plan.organizationType,
                  color: 'cyan',
                }
                const priorityConfig = PRIORITY_CONFIG[plan.priority]
                const colorClasses = COLOR_CLASSES[orgConfig.color]
                const isExpanded = expandedPlan === plan.id

                return (
                  <motion.div
                    key={plan.id}
                    layout
                    className={`
                      border rounded-xl overflow-hidden transition-all
                      ${isExpanded ? colorClasses.border : 'border-white/10 hover:border-white/20'}
                    `}
                  >
                    {/* Plan Header */}
                    <button
                      onClick={() => setExpandedPlan(isExpanded ? null : plan.id)}
                      className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/5 transition-all"
                    >
                      <span className={colorClasses.text}>{orgConfig.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={`text-sm ${colorClasses.text}`}>
                            {orgConfig.label}
                          </span>
                          <span className={`
                            px-1.5 py-0.5 rounded text-[10px] font-medium uppercase tracking-wider
                            ${priorityConfig.bg} ${priorityConfig.color} ${priorityConfig.border} border
                          `}>
                            {priorityConfig.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-white/40 text-xs">
                            Timeline: {plan.timeline}
                          </span>
                          {plan.riskReduction && (
                            <span className="text-emerald-400 text-xs">
                              -{(plan.riskReduction * 100).toFixed(0)}% risk
                            </span>
                          )}
                        </div>
                      </div>
                      <svg 
                        className={`w-4 h-4 text-white/30 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none" 
                        stroke="currentColor" 
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {/* Expanded Content */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 pt-0 border-t border-white/5">
                            {/* Actions List */}
                            <div className="space-y-2 mt-3">
                              {plan.actions.map((action, idx) => (
                                <div 
                                  key={idx}
                                  className="flex items-start gap-2"
                                >
                                  <div className={`
                                    w-4 h-4 rounded flex items-center justify-center flex-shrink-0 mt-0.5
                                    ${colorClasses.border} border
                                  `}>
                                    <svg className={`w-2.5 h-2.5 ${colorClasses.text}`} fill="currentColor" viewBox="0 0 20 20">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </div>
                                  <span className="text-white/70 text-sm">
                                    {action}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* Metrics */}
                            {(plan.estimatedCost || plan.roiPercentage) && (
                              <div className="flex gap-4 mt-4 pt-3 border-t border-white/5">
                                {plan.estimatedCost && (
                                  <div>
                                    <div className="text-white/30 text-[10px] uppercase tracking-wider">
                                      Est. Cost
                                    </div>
                                    <div className="text-white text-sm font-mono">
                                      {formatCurrency(plan.estimatedCost)}
                                    </div>
                                  </div>
                                )}
                                {plan.roiPercentage && (
                                  <div>
                                    <div className="text-white/30 text-[10px] uppercase tracking-wider">
                                      ROI
                                    </div>
                                    <div className="text-emerald-400 text-sm font-mono">
                                      +{plan.roiPercentage.toFixed(0)}%
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                )
              })}
            </div>

            {sortedPlans.length === 0 && (
              <div className="text-center py-12 text-white/30">
                <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                <p>No action plans match the current filter</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/10 bg-white/5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-white/40 text-xs">
                {sortedPlans.length} action plans • {sortedPlans.filter(p => p.priority === 'critical').length} critical
              </div>
              {exportError && (
                <div className="text-red-400 text-xs flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {exportError}
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleExportPdf}
                disabled={isExporting}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border transition-all text-sm ${
                  isExporting 
                    ? 'bg-white/5 border-white/10 text-white/40 cursor-not-allowed' 
                    : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70 hover:text-white'
                }`}
              >
                {isExporting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Generating...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Export PDF
                  </>
                )}
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 transition-all text-sm text-amber-400"
              >
                Close
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
