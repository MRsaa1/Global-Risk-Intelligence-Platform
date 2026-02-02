/**
 * Action Plan Modal — Universal Stress Test Template
 *
 * Full-screen modal showing the universal action plan: 5 sectors with focus areas
 * and phased actions, plus general principles and cross-sector dependencies.
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { exportStressTestPdf } from '../../lib/exportService'
import type { UniversalActionPlanTemplate, SectorActionPlan } from '../../lib/universalActionPlanTemplate'

interface ActionPlanModalProps {
  isOpen: boolean
  onClose: () => void
  stressTestName?: string
  zoneName?: string
  template: UniversalActionPlanTemplate
  /** Close modal and open /action-plans page */
  onOpenDetailedPlans?: () => void
  /** Close modal and open /stress-planner page */
  onOpenStressPlanner?: () => void
}

const SECTOR_ICONS: Record<string, JSX.Element> = {
  '1': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  '2': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  '3': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 14v3m4-3v3m4-3v3M3 21h18M3 10h18M3 7l9-4 9 4M4 10h16v11H4V10z" />
    </svg>
  ),
  '4': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  '5': (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
}

const SECTOR_COLORS: Record<string, string> = {
  '1': 'purple',
  '2': 'blue',
  '3': 'emerald',
  '4': 'cyan',
  '5': 'orange',
}

const CRITICALITY_STYLES: Record<string, string> = {
  CRITICAL: 'text-red-400 bg-red-500/20 border-red-500/30',
  HIGH: 'text-orange-400 bg-orange-500/20 border-orange-500/30',
  MEDIUM: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
  LOW: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
}

const COLOR_CLASSES: Record<string, { text: string; border: string }> = {
  purple: { text: 'text-purple-400', border: 'border-purple-500/30' },
  blue: { text: 'text-blue-400', border: 'border-blue-500/30' },
  emerald: { text: 'text-emerald-400', border: 'border-emerald-500/30' },
  cyan: { text: 'text-amber-400', border: 'border-amber-500/30' },
  orange: { text: 'text-orange-400', border: 'border-orange-500/30' },
}

export default function ActionPlanModal({
  isOpen,
  onClose,
  stressTestName,
  zoneName,
  template,
  onOpenDetailedPlans,
  onOpenStressPlanner,
}: ActionPlanModalProps) {
  const [expandedSector, setExpandedSector] = useState<string | null>(template.sectors[0]?.id ?? null)
  const [isExporting, setIsExporting] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const handleExportPdf = async () => {
    setIsExporting(true)
    setExportError(null)
    try {
      const stressTestData = {
        name: stressTestName || template.title,
        type: 'stress_test',
        scenario_name: stressTestName || template.title,
        region_name: zoneName || 'Global',
        severity: 0.7,
        nvidia_enhanced: true,
      }
      const zones = template.sectors.map((s) => ({
        name: s.sector,
        zone_level: s.criticality.toLowerCase(),
        zone_type: 'action_plan',
        affected_assets_count: s.phases.reduce((n, p) => n + p.items.length, 0),
        expected_loss: 0,
        population_affected: 0,
        risk_score: 100 - s.riskReductionPercent,
      }))
      const actions = template.sectors.flatMap((s) =>
        s.phases.flatMap((p) =>
          p.items.map((title) => ({
            title,
            priority: s.criticality === 'CRITICAL' ? 'Critical' : 'High',
            timeline: s.responseTime,
            estimated_cost: 0,
            risk_reduction: s.riskReductionPercent,
          }))
        )
      )
      await exportStressTestPdf(stressTestData, zones, actions)
    } catch (error) {
      setExportError(error instanceof Error ? error.message : 'Failed to export PDF')
    } finally {
      setIsExporting(false)
    }
  }

  if (!isOpen) return null

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.98, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.98, y: 10 }}
          transition={{ duration: 0.25 }}
          className="relative w-full max-w-4xl max-h-[90vh] bg-[#0a0f18] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/10 bg-gradient-to-r from-amber-500/10 to-transparent shrink-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  <h2 className="text-white text-lg font-medium tracking-wide">{template.title}</h2>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-0.5 text-[11px] text-white/50 mt-2">
                  <span>DATE CREATED: {template.dateCreated}</span>
                  <span>OWNER: {template.owner}</span>
                  {(stressTestName || zoneName) && (
                    <span className="col-span-2 sm:col-span-1">
                      {stressTestName}
                      {zoneName && ` • ${zoneName}`}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2 text-white/40 hover:text-white rounded-lg hover:bg-white/5"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-white/10">
            {template.sectors.map((sector) => (
              <SectorCard
                key={sector.id}
                sector={sector}
                isExpanded={expandedSector === sector.id}
                onToggle={() => setExpandedSector((id) => (id === sector.id ? null : sector.id))}
              />
            ))}

            {/* General principles */}
            <section className="border border-white/10 rounded-xl p-4 bg-white/[0.02]">
              <h3 className="text-amber-400/90 text-sm font-medium uppercase tracking-wider mb-3">
                General principles for action plans
              </h3>
              <div className="space-y-4">
                <div>
                  <h4 className="text-white/70 text-xs font-medium mb-2">1. Priority hierarchy</h4>
                  <div className="border border-white/10 rounded-lg overflow-hidden">
                    {template.priorityHierarchy.map((p) => (
                      <div
                        key={p.level}
                        className="flex items-center gap-3 px-3 py-2 border-b border-white/5 last:border-0"
                      >
                        <span className="text-white/40 text-xs w-6">{p.level}.</span>
                        <span className="text-white/80 text-xs">{p.label}</span>
                        <span className="text-white/40 text-[10px]">← {p.note}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <h4 className="text-white/70 text-xs font-medium mb-2">2. Key monitoring metrics</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] border border-white/10 rounded-lg overflow-hidden">
                      <thead>
                        <tr className="bg-white/5">
                          <th className="text-left px-3 py-2 text-white/60 font-medium">Type</th>
                          <th className="text-left px-3 py-2 text-white/60 font-medium">Examples</th>
                          <th className="text-left px-3 py-2 text-white/60 font-medium">Frequency</th>
                        </tr>
                      </thead>
                      <tbody>
                        {template.monitoringMetrics.map((m, i) => (
                          <tr key={i} className="border-t border-white/5">
                            <td className="px-3 py-2 text-white/80">{m.type}</td>
                            <td className="px-3 py-2 text-white/60">{m.examples}</td>
                            <td className="px-3 py-2 text-white/50">{m.frequency}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <h4 className="text-white/70 text-xs font-medium mb-2">3. Escalation matrix</h4>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[11px] border border-white/10 rounded-lg overflow-hidden">
                      <thead>
                        <tr className="bg-white/5">
                          <th className="text-left px-3 py-2 text-white/60 font-medium">Trigger level</th>
                          <th className="text-left px-3 py-2 text-white/60 font-medium">Authority</th>
                          <th className="text-left px-3 py-2 text-white/60 font-medium">Response time</th>
                          <th className="text-left px-3 py-2 text-white/60 font-medium">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {template.escalationMatrix.map((e, i) => (
                          <tr key={i} className="border-t border-white/5">
                            <td className="px-3 py-2 text-white/80">{e.trigger}</td>
                            <td className="px-3 py-2 text-white/60">{e.authority}</td>
                            <td className="px-3 py-2 text-white/60">{e.responseTime}</td>
                            <td className="px-3 py-2 text-white/60">{e.actions}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <h4 className="text-white/70 text-xs font-medium mb-2">4. Mandatory elements of each plan</h4>
                  <ul className="list-disc list-inside text-[11px] text-white/60 space-y-0.5">
                    {template.mandatoryElements.map((el, i) => (
                      <li key={i}>{el}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </section>

            {/* Cross-sector dependencies */}
            <section className="border border-amber-500/20 rounded-xl p-4 bg-amber-500/5">
              <h3 className="text-amber-400/90 text-sm font-medium uppercase tracking-wider mb-2">
                Cross-sector dependencies
              </h3>
              <p className="text-white/60 text-xs leading-relaxed mb-3">{template.crossSectorDependenciesNote}</p>
              <div className="text-[11px] text-white/40 font-mono bg-black/20 rounded-lg p-3 overflow-x-auto">
                Financial → Real Estate (credit) | Financial → Insurance (policies) | Financial → Enterprises (working capital) |
                Real Estate → Financial (collateral) | Insurance → Financial (investment) | Insurance → Real Estate & Enterprises (coverage) |
                Defense & Security → Financial (stability) | Defense & Security → Enterprises (contracts)
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-white/10 bg-white/5 flex items-center justify-between shrink-0">
            <div className="text-white/40 text-xs">
              {template.sectors.length} sectors • {template.sectors.filter((s) => s.criticality === 'CRITICAL').length} critical
              {exportError && (
                <span className="ml-2 text-red-400 flex items-center gap-1">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  {exportError}
                </span>
              )}
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <button
                onClick={handleExportPdf}
                disabled={isExporting}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 text-sm transition-all ${
                  isExporting ? 'text-white/40 cursor-not-allowed' : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                {isExporting ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Generating…
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
                className="px-4 py-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-sm text-amber-400"
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

function SectorCard({
  sector,
  isExpanded,
  onToggle,
}: {
  sector: SectorActionPlan
  isExpanded: boolean
  onToggle: () => void
}) {
  const color = SECTOR_COLORS[sector.id] ?? 'cyan'
  const styles = COLOR_CLASSES[color]
  const critStyle = CRITICALITY_STYLES[sector.criticality] ?? CRITICALITY_STYLES.HIGH
  const icon = SECTOR_ICONS[sector.id]

  return (
    <div className={`border rounded-xl overflow-hidden transition-colors ${isExpanded ? styles.border : 'border-white/10'}`}>
      <button
        type="button"
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center gap-3 text-left hover:bg-white/5 transition-colors"
      >
        <span className={styles.text}>{icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-sm font-medium ${styles.text}`}>
              {sector.id}. {sector.sector}
            </span>
            <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium uppercase border ${critStyle}`}>
              {sector.criticality}
            </span>
            <span className="text-white/50 text-xs">
              ({sector.responseTime}, -{sector.riskReductionPercent}% risk)
            </span>
          </div>
        </div>
        <svg
          className={`w-4 h-4 text-white/30 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0 border-t border-white/5 space-y-4">
              <div>
                <h4 className="text-white/60 text-[10px] uppercase tracking-wider mb-2">Key focus areas</h4>
                <div className="overflow-x-auto rounded-lg border border-white/10">
                  <table className="w-full text-[11px] min-w-[400px]">
                    <thead>
                      <tr className="bg-white/5">
                        <th className="text-left px-3 py-2 text-white/50 font-medium">Category</th>
                        <th className="text-left px-3 py-2 text-white/50 font-medium">Stress scenarios</th>
                        <th className="text-left px-3 py-2 text-white/50 font-medium">Actions</th>
                        <th className="text-left px-3 py-2 text-white/50 font-medium">Success metrics</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sector.focusAreas.map((fa, i) => (
                        <tr key={i} className="border-t border-white/5">
                          <td className="px-3 py-2 text-white/80">{fa.category}</td>
                          <td className="px-3 py-2 text-white/60">{fa.stressScenarios}</td>
                          <td className="px-3 py-2 text-white/60">{fa.actions}</td>
                          <td className="px-3 py-2 text-white/50">{fa.successMetrics}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div>
                <h4 className="text-white/60 text-[10px] uppercase tracking-wider mb-2">Action plan structure</h4>
                <div className="space-y-3">
                  {sector.phases.map((phase, pi) => (
                    <div key={pi} className="border border-white/10 rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-white/5 text-[11px] font-medium text-white/80 border-b border-white/5">
                        {phase.name}
                      </div>
                      <ul className="px-3 py-2 space-y-1">
                        {phase.items.map((item, ii) => (
                          <li key={ii} className="flex items-start gap-2 text-[11px] text-white/70">
                            <span className="text-white/40 mt-0.5">├</span>
                            <span>{item}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
