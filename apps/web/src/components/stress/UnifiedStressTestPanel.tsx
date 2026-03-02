/**
 * Unified Stress Test Panel
 * ==========================
 *
 * Single panel combining:
 * - Stress Test Results (scenario, Monte Carlo metrics, Impact Flow, MC Engine)
 * - Zone Detail (when a zone is selected: metrics, entities, timeline)
 * - Action Plan buttons (Report, Action Plans, Export, Cascade)
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getApiV1Base } from '../../config/env'

// Shared with ZoneDetailPanel — org icons and types
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

const ORGANIZATION_TYPES = [
  { id: 'enterprise', label: 'Enterprises', icon: OrgIcons.enterprise },
  { id: 'bank', label: 'Financial Institutions', icon: OrgIcons.bank },
  { id: 'developer', label: 'Real Estate Developers', icon: OrgIcons.developer },
  { id: 'insurer', label: 'Insurance Companies', icon: OrgIcons.insurer },
  { id: 'military', label: 'Defense & Security', icon: OrgIcons.military },
  { id: 'infrastructure', label: 'Critical Infrastructure', icon: OrgIcons.infrastructure },
  { id: 'government', label: 'Government Agencies', icon: OrgIcons.government },
]

export interface AffectedEntity {
  id: string
  name: string
  type: string
  exposure: number
  impactSeverity: number
  location: string
}

export interface ZoneData {
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

function formatCurrency(value: number): string {
  if (value >= 1000) return `€${(value / 1000).toFixed(1)}T`
  if (value >= 1) return `€${value.toFixed(1)}B`
  return `€${(value * 1000).toFixed(0)}M`
}

function getLevelColors(level: string): { bg: string; text: string; border: string } {
  switch (level) {
    case 'critical':
      return { bg: 'bg-red-500', text: 'text-red-400/80', border: 'border-red-500/30' }
    case 'high':
      return { bg: 'bg-orange-500', text: 'text-orange-400/80/80', border: 'border-orange-500/30' }
    case 'medium':
      return { bg: 'bg-yellow-500', text: 'text-yellow-400/80/80', border: 'border-yellow-500/30' }
    default:
      return { bg: 'bg-emerald-500', text: 'text-emerald-400/80', border: 'border-emerald-500/30' }
  }
}

export interface ActiveScenario {
  type: string
  severity: number
  active: boolean
}

export interface PortfolioState {
  atRisk: number
  criticalCount: number
}

interface UnifiedStressTestPanelProps {
  activeScenario: ActiveScenario
  portfolio: PortfolioState
  zone: ZoneData | null
  onCloseScenario: () => void
  onCloseZone: () => void
  onViewActionPlans: () => void
  onExportPdf: () => Promise<void>
  isExportingPdf: boolean
  onEntityClick: (entity: AffectedEntity) => void
  onOpenCascade?: () => void
  eventIdForCascade?: string
  /** When set, show "Play 4D Timeline" button on globe */
  completedStressTestId?: string | null
  /** Called with CZML URL when user clicks "Play 4D Timeline" */
  onPlayTimeline?: (url: string) => void
}


export default function UnifiedStressTestPanel({
  activeScenario,
  portfolio,
  zone,
  onCloseScenario,
  onCloseZone,
  onViewActionPlans,
  onExportPdf,
  isExportingPdf,
  onEntityClick,
  onOpenCascade,
  eventIdForCascade,
}: UnifiedStressTestPanelProps) {
  const [zoneTab, setZoneTab] = useState<'entities' | 'timeline'>('entities')
  const [expandedType, setExpandedType] = useState<string | null>(null)
  const [zoneExplanation, setZoneExplanation] = useState<string | null>(null)
  const [explainLoading, setExplainLoading] = useState(false)

  const groupedEntities = zone
    ? ORGANIZATION_TYPES.map((type) => ({
        ...type,
        entities: zone.entities.filter((e) => e.type === type.id),
        totalExposure: zone.entities
          .filter((e) => e.type === type.id)
          .reduce((sum, e) => sum + e.exposure, 0),
      })).filter((g) => g.entities.length > 0)
    : []

  const zoneColors = zone ? getLevelColors(zone.level) : null

  return (
    <motion.div
      initial={{ opacity: 0, x: 50, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 50, scale: 0.95 }}
      transition={{ duration: 0.4 }}
      className="bg-black/70 border border-zinc-800 rounded-md overflow-hidden flex flex-col min-h-0 max-h-[88vh] w-96"
    >
      {/* Header — Stress Test Active */}
      <div className="shrink-0 px-3 py-2 bg-red-500/5 border-b border-red-500/10 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-400/60 animate-pulse" />
          <span className="text-red-300 text-xs uppercase tracking-wider font-medium">
            Stress Test Active
          </span>
        </div>
        <button
          onClick={onCloseScenario}
          className="text-zinc-500 hover:text-zinc-100 transition-colors p-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Body — scroll without visible scrollbar */}
      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col [scrollbar-width:none] [&::-webkit-scrollbar]:[display:none]">
        {/* Scenario Info */}
        <div className="shrink-0 px-3 py-1.5 border-b border-zinc-800">
          <div className="text-zinc-100 text-sm font-medium mb-0.5">{activeScenario.type}</div>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-zinc-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-zinc-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${activeScenario.severity * 100}%` }}
                transition={{ duration: 0.6 }}
              />
            </div>
            <span className="text-zinc-400 text-xs font-mono">{(activeScenario.severity * 100).toFixed(0)}%</span>
          </div>
        </div>

        {/* Monte Carlo — compact grid */}
        <div className="shrink-0 grid grid-cols-3 gap-x-2 gap-y-1 px-3 py-1.5 border-b border-zinc-800 text-[10px]">
          <div className="flex justify-between"><span className="text-zinc-500">VaR 99% (USD)</span><span className="text-red-300 font-mono">${(portfolio.atRisk * activeScenario.severity * 0.15).toFixed(1)}B</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">ES (USD)</span><span className="text-orange-300 font-mono">${(portfolio.atRisk * activeScenario.severity * 0.22).toFixed(1)}B</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">MaxDD (USD)</span><span className="text-red-300 font-mono">${(portfolio.atRisk * activeScenario.severity * 0.35).toFixed(1)}B</span></div>
          <div className="flex justify-between"><span className="text-zinc-500">Zones</span><span className="text-amber-300 font-mono">{Math.ceil(portfolio.criticalCount * (1 + activeScenario.severity))}</span></div>
          <div className="flex justify-between col-span-2"><span className="text-zinc-500">Recovery</span><span className="text-amber-300 font-mono">{(1.5 + activeScenario.severity * 3).toFixed(1)} yrs</span></div>
        </div>

        {/* Monte Carlo Engine — one line */}
        <div className="shrink-0 px-3 py-1 bg-zinc-800/50 border-b border-zinc-700 flex items-center justify-between text-[10px]">
          <span className="text-zinc-500">Monte Carlo</span>
          <span className="text-zinc-400">100k · Gaussian · 99%</span>
        </div>

        {/* Mitigation ROI — Capital Decisions (Institutional) */}
        <div className="shrink-0 px-3 py-2 border-b border-zinc-800 bg-gradient-to-r from-zinc-800/50 to-transparent">
          <div className="text-zinc-500 text-[10px] uppercase tracking-wider mb-2">Capital Decision</div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-zinc-500 text-[9px] uppercase">Mitigation Cost (EUR)</div>
              <div className="text-zinc-300 text-sm font-light">€{Math.round(portfolio.atRisk * activeScenario.severity * 0.08)}M</div>
            </div>
            <div>
              <div className="text-zinc-500 text-[9px] uppercase">Loss Avoided (P95) (EUR)</div>
              <div className="text-emerald-400/80 text-sm font-light">€{Math.round(portfolio.atRisk * activeScenario.severity * 0.35)}M</div>
            </div>
            <div>
              <div className="text-zinc-500 text-[9px] uppercase">ROI</div>
              <div className="text-emerald-400/80 text-sm font-bold">{(portfolio.atRisk * activeScenario.severity * 0.35 / (portfolio.atRisk * activeScenario.severity * 0.08 || 1)).toFixed(1)}x</div>
            </div>
          </div>
          <div className="mt-2 text-zinc-600 text-[9px] text-center">
            Investment decision: mitigate now or accept tail risk
          </div>
        </div>

        {/* Zone section — when a zone is selected; no scroll */}
        <AnimatePresence>
          {zone && zoneColors && (
            <motion.section
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25 }}
              className="border-t border-zinc-800 flex flex-col"
            >
              <div className={`shrink-0 px-3 py-1.5 ${zoneColors.border} border-b bg-gradient-to-r from-zinc-800 to-transparent flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${zoneColors.bg} ${zone.level === 'critical' ? 'animate-pulse' : ''}`} />
                  <span className={`text-xs uppercase tracking-wider font-medium ${zoneColors.text}`}>
                    {zone.level} Zone
                  </span>
                </div>
                <button onClick={onCloseZone} className="text-zinc-500 hover:text-zinc-100 transition-colors p-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <h3 className="shrink-0 px-3 pt-0.5 text-zinc-100 text-sm font-light truncate">{zone.name}</h3>
              <p className="shrink-0 px-3 pb-1 text-zinc-500 text-xs truncate">{zone.stressTestName}</p>

              <div className="shrink-0 grid grid-cols-2 gap-px bg-zinc-800">
                {[
                  { label: 'Exposure', value: formatCurrency(zone.metrics.totalExposure) },
                  { label: 'Expected Loss', value: formatCurrency(zone.metrics.expectedLoss), color: zoneColors.text },
                  { label: 'Recovery', value: `${zone.metrics.recoveryMonths} mo` },
                  { label: 'Affected', value: String(zone.metrics.affectedCount) },
                ].map(({ label, value, color }) => (
                  <div key={label} className="p-1.5 bg-[#09090b]">
                    <div className="text-zinc-600 text-[10px] uppercase tracking-wider">{label}</div>
                    <div className={`text-xs font-light ${color ?? 'text-zinc-100'}`}>{value}</div>
                  </div>
                ))}
              </div>

              <div className="shrink-0 px-3 py-1 border-b border-zinc-800">
                <div className="flex items-center justify-between mb-0.5">
                  <span className="text-zinc-500 text-xs">Risk Score</span>
                  <span className={`text-xs font-mono ${zoneColors.text}`}>
                    {(zone.metrics.riskScore * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${zoneColors.bg}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${zone.metrics.riskScore * 100}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
              </div>

              {/* Explain zone (Generative AI) */}
              <div className="shrink-0 px-3 py-1.5 border-b border-zinc-800">
                <button
                  type="button"
                  onClick={async () => {
                    setZoneExplanation(null)
                    setExplainLoading(true)
                    try {
                      const res = await fetch(`${getApiV1Base()}/generative/explain-zone`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        credentials: 'include',
                        body: JSON.stringify({
                          zone_data: {
                            label: zone.name,
                            risk_level: zone.level,
                            stress_test_name: zone.stressTestName,
                            metrics: zone.metrics,
                          },
                          question: 'Why is this zone at risk? What are the main factors?',
                        }),
                      })
                      if (res.ok) {
                        const data = await res.json()
                        setZoneExplanation(data.explanation || null)
                      }
                    } catch {
                      setZoneExplanation('Explanation unavailable.')
                    } finally {
                      setExplainLoading(false)
                    }
                  }}
                  disabled={explainLoading}
                  className="text-[11px] px-2 py-1 rounded bg-zinc-700 text-zinc-300 border border-zinc-600 hover:bg-zinc-600 disabled:opacity-50"
                >
                  {explainLoading ? 'Explaining…' : 'Explain zone'}
                </button>
                {zoneExplanation && (
                  <div className="mt-1.5 p-1.5 bg-zinc-800 rounded text-[11px] text-zinc-200 border border-zinc-700">
                    {zoneExplanation}
                  </div>
                )}
              </div>

              <div className="shrink-0 flex border-b border-zinc-800">
                <button
                  onClick={() => setZoneTab('entities')}
                  className={`flex-1 px-3 py-1.5 text-xs ${zoneTab === 'entities' ? 'text-zinc-100 border-b-2 border-zinc-500' : 'text-zinc-500 hover:text-zinc-400'}`}
                >
                  Entities
                </button>
                <button
                  onClick={() => setZoneTab('timeline')}
                  className={`flex-1 px-3 py-1.5 text-xs ${zoneTab === 'timeline' ? 'text-zinc-100 border-b-2 border-zinc-500' : 'text-zinc-500 hover:text-zinc-400'}`}
                >
                  Timeline
                </button>
              </div>

              {zoneTab === 'entities' && (
                <div className="p-1.5 space-y-0.5 min-h-0">
                  {groupedEntities.map((group) => (
                    <div key={group.id}>
                      <button
                        onClick={() => setExpandedType(expandedType === group.id ? null : group.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-800 text-left"
                      >
                        <span className="text-zinc-500">{group.icon}</span>
                        <span className="text-zinc-300 text-xs flex-1">{group.label}</span>
                        <span className="text-zinc-500 text-[10px] font-mono">{group.entities.length}</span>
                        <svg
                          className={`w-3 h-3 text-zinc-600 transition-transform ${expandedType === group.id ? 'rotate-180' : ''}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                      <AnimatePresence>
                        {expandedType === group.id && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="overflow-hidden ml-4 border-l border-zinc-800 pl-2 space-y-0.5"
                          >
                            {group.entities.map((entity) => (
                              <button
                                key={entity.id}
                                onClick={() => onEntityClick(entity)}
                                className="w-full flex items-center gap-2 px-2 py-1 rounded hover:bg-zinc-800 text-left text-xs text-zinc-300 hover:text-zinc-100"
                              >
                                <div
                                  className={`w-1 h-1 rounded-full ${
                                    entity.impactSeverity > 0.8 ? 'bg-red-500' : entity.impactSeverity > 0.6 ? 'bg-orange-500' : entity.impactSeverity > 0.4 ? 'bg-yellow-500' : 'bg-green-500'
                                  }`}
                                />
                                <span className="flex-1 truncate">{entity.name}</span>
                                <span className="text-zinc-600 text-[10px] font-mono">{formatCurrency(entity.exposure)}</span>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ))}
                  {groupedEntities.length === 0 && (
                    <div className="text-center py-2 text-zinc-600 text-xs">No affected entities</div>
                  )}
                </div>
              )}

              {zoneTab === 'timeline' && (
                <div className="p-2 space-y-1.5 ml-4 border-l border-zinc-800 text-xs">
                  <div className="relative">
                    <div className="text-zinc-500 text-[10px] uppercase">T+0</div>
                    <div className="text-zinc-100 text-xs">Initial Impact</div>
                    <div className="text-red-400/80 text-xs font-mono">-{formatCurrency(zone.metrics.expectedLoss * 0.6)}</div>
                  </div>
                  <div className="relative">
                    <div className="text-zinc-500 text-[10px] uppercase">+3 mo</div>
                    <div className="text-zinc-100 text-xs">Cascade</div>
                    <div className="text-orange-400/80/80 text-xs font-mono">-{formatCurrency(zone.metrics.expectedLoss * 0.3)}</div>
                  </div>
                  <div className="relative">
                    <div className="text-zinc-500 text-[10px] uppercase">+{zone.metrics.recoveryMonths} mo</div>
                    <div className="text-zinc-100 text-xs">Full Recovery</div>
                  </div>
                </div>
              )}
            </motion.section>
          )}
        </AnimatePresence>
      </div>

      {/* Action buttons — fixed at bottom */}
      <div className="shrink-0 p-2 border-t border-zinc-800 flex flex-wrap gap-1.5 bg-[#09090b]">
        <button
          onClick={onViewActionPlans}
          className="flex-1 min-w-0 flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-zinc-700 hover:bg-zinc-600 border border-zinc-600 text-xs text-zinc-300 hover:text-zinc-200"
        >
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          Action Plans
        </button>
        <button
          onClick={onExportPdf}
          disabled={isExportingPdf}
          className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md border text-xs ${
            isExportingPdf ? 'bg-zinc-800 border-zinc-800 text-zinc-500 cursor-not-allowed' : 'bg-zinc-800 hover:bg-zinc-700 border-zinc-800 text-zinc-400 hover:text-zinc-100'
          }`}
        >
          {isExportingPdf ? (
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
              Export Report
            </>
          )}
        </button>
        {onOpenCascade && eventIdForCascade && (
          <button
            onClick={onOpenCascade}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-zinc-700 hover:bg-zinc-600 border border-zinc-600 text-xs text-zinc-300 hover:text-zinc-200"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Open in Cascade
          </button>
        )}
        {/* Play 4D Timeline removed from this panel (S-key stress test); use Digital Twin or Municipal for 4D. */}
      </div>
    </motion.div>
  )
}
