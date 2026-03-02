/**
 * Stress Test Selector
 * =====================
 *
 * Tabs: Regulatory Library (EBA, Fed, NGFS, BIS) and Extended scenarios.
 * Collapsible "About the stress testing database" at the bottom.
 */
import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { hasZoneEntities } from '../../lib/stressTestConstants'

// Fallback when API is unavailable (mirrors stress_scenario_registry.py, unified schema)
const STRESS_SCENARIO_LIBRARY_FALLBACK = [
  { id: 'EBA_Adverse', name: 'EBA Adverse Scenario', source: 'EBA', regulator: 'EBA/ECB', type: 'financial' as const, horizon: 5, severity_numeric: 0.85, probability: 0.05, applicable_regulations: ['EBA', 'Basel', 'TCFD'], parameters: {} },
  { id: 'FED_Severely_Adverse_CRE', name: 'Fed Severely Adverse (CRE shock)', source: 'Fed', regulator: 'Federal Reserve', type: 'financial' as const, horizon: 5, severity_numeric: 0.9, probability: 0.03, applicable_regulations: ['CCAR', 'DFAST'], parameters: {} },
  { id: 'NGFS_SSP5_2050', name: 'NGFS SSP5-8.5 (2050)', source: 'NGFS', type: 'climate' as const, horizon: 2050, severity_numeric: 0.88, probability: 0.15, applicable_regulations: ['NGFS', 'TCFD'], parameters: {} },
  { id: 'Flood_Extreme_100y', name: 'Flood Extreme (100y→10y)', source: 'NGFS', type: 'climate' as const, horizon: 2035, severity_numeric: 0.85, probability: 0.08, applicable_regulations: ['TCFD', 'NGFS'], parameters: {} },
  { id: 'IMF_Systemic', name: 'IMF-style Systemic Crisis', source: 'IMF', regulator: 'IMF', type: 'financial' as const, horizon: 5, severity_numeric: 0.92, probability: 0.02, applicable_regulations: ['BIS', 'Basel'], parameters: {} },
  { id: 'NGFS_SSP2_2040', name: 'NGFS SSP2-4.5 (Baseline)', source: 'NGFS', type: 'climate' as const, horizon: 2040, severity_numeric: 0.55, probability: 0.7, applicable_regulations: ['NGFS', 'TCFD'], parameters: {} },
]

// Professional SVG Icons
const Icons = {
  climate: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
    </svg>
  ),
  financial: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
    </svg>
  ),
  military: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  pandemic: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  ),
  political: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  regulatory: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  protest: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
}

// Extended: fallback when /scenarios/extended is unavailable (no Climate/Financial; Geopolitical, Pandemic, Political, Regulatory, Civil Unrest)
const STRESS_EXTENDED_FALLBACK = [
  { id: 'military', label: 'Geopolitical', icon: Icons.military, color: 'orange', scenarios: [{ id: 'Sanctions_Escalation', name: 'Sanctions Escalation', severity_numeric: 0.85, probability: 0.1 }, { id: 'Trade_War_Supply_Chain', name: 'Trade War / Supply Chain', severity_numeric: 0.78, probability: 0.12 }] },
  { id: 'pandemic', label: 'Pandemic', icon: Icons.pandemic, color: 'purple', scenarios: [{ id: 'COVID19_Replay', name: 'COVID-19 Replay', severity_numeric: 0.8, probability: 0.1 }, { id: 'Pandemic_X', name: 'Pandemic X', severity_numeric: 0.85, probability: 0.05 }] },
  { id: 'political', label: 'Political', icon: Icons.political, color: 'yellow', scenarios: [{ id: 'Sovereign_Debt_Crisis', name: 'Sovereign Debt Crisis', severity_numeric: 0.88, probability: 0.04 }, { id: 'Currency_Devaluation', name: 'Currency Devaluation', severity_numeric: 0.75, probability: 0.08 }] },
  { id: 'regulatory', label: 'Regulatory', icon: Icons.regulatory, color: 'blue', scenarios: [{ id: 'Sudden_Capital_Increase', name: 'Sudden Capital Requirement Increase', severity_numeric: 0.7, probability: 0.15 }] },
  { id: 'protest', label: 'Civil Unrest', icon: Icons.protest, color: 'amber', scenarios: [{ id: 'Urban_Riots_Asset_Damage', name: 'Urban Riots → Asset Damage', severity_numeric: 0.72, probability: 0.12 }, { id: 'Infrastructure_Sabotage', name: 'Infrastructure Sabotage', severity_numeric: 0.8, probability: 0.05 }] },
]

const CATEGORY_COLORS: Record<string, string> = {
  climate: 'cyan', financial: 'red', military: 'orange', pandemic: 'purple',
  political: 'yellow', regulatory: 'blue', protest: 'amber',
}

type RegulatoryItem = typeof STRESS_SCENARIO_LIBRARY_FALLBACK[0]

interface StressTestSelectorProps {
  onScenarioSelect: (scenario: {
    id: string
    name: string
    type: string
    severity: number
    probability: number
    source?: string
    regulator?: string
    parameters?: Record<string, unknown>
  } | null) => void
  selectedScenario: string | null
  isCollapsed?: boolean
  /**
   * If provided, the selector becomes "controlled" and only shows that tab.
   * Useful for embedding into a larger unified selector.
   */
  forcedTab?: 'regulatory' | 'extended'
  /**
   * Whether to render internal Regulatory/Extended tabs.
   * Default true; set false when embedding.
   */
  showTabs?: boolean
}

export default function StressTestSelector({
  onScenarioSelect,
  selectedScenario,
  isCollapsed = false,
  forcedTab,
  showTabs = true,
}: StressTestSelectorProps) {
  const [activeTabState, setActiveTabState] = useState<'regulatory' | 'extended'>(forcedTab ?? 'regulatory')
  const activeTab = forcedTab ?? activeTabState
  const setActiveTab = forcedTab ? (() => {}) : setActiveTabState
  const [regulatoryLibrary, setRegulatoryLibrary] = useState<RegulatoryItem[]>(STRESS_SCENARIO_LIBRARY_FALLBACK)
  const [regulatoryLoading, setRegulatoryLoading] = useState(true)
  const [extendedCategories, setExtendedCategories] = useState<Array<{ id: string; label: string; scenarios: Array<{ id: string; name: string; severity?: number; severity_numeric?: number; probability?: number }> }> | null>(null)
  const [extendedLoading, setExtendedLoading] = useState(true)
  const [expandedType, setExpandedType] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [collapseInfoOpen, setCollapseInfoOpen] = useState(false)

  useEffect(() => {
    fetch('/api/v1/stress-tests/scenarios/library')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Not ok'))))
      .then((data: RegulatoryItem[]) => setRegulatoryLibrary(Array.isArray(data) ? data : STRESS_SCENARIO_LIBRARY_FALLBACK))
      .catch(() => setRegulatoryLibrary(STRESS_SCENARIO_LIBRARY_FALLBACK))
      .finally(() => setRegulatoryLoading(false))
  }, [])

  useEffect(() => {
    fetch('/api/v1/stress-tests/scenarios/extended')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Not ok'))))
      .then((data: { categories?: Array<{ id: string; label: string; scenarios: Array<{ id: string; name: string; severity?: number; severity_numeric?: number; probability?: number }> }> }) => {
        if (data?.categories?.length) setExtendedCategories(data.categories)
      })
      .catch(() => {})
      .finally(() => setExtendedLoading(false))
  }, [])

  const colorClasses: Record<string, { text: string; bg: string; border: string; glow: string }> = {
    cyan: { text: 'text-zinc-400', bg: 'bg-zinc-500', border: 'border-zinc-600', glow: 'shadow-zinc-500/20' },
    red: { text: 'text-red-400', bg: 'bg-red-500', border: 'border-red-500/30', glow: 'shadow-red-500/20' },
    orange: { text: 'text-orange-400', bg: 'bg-orange-500', border: 'border-orange-500/30', glow: 'shadow-orange-500/20' },
    purple: { text: 'text-zinc-400', bg: 'bg-zinc-500', border: 'border-zinc-600', glow: 'shadow-zinc-500/20' },
    yellow: { text: 'text-yellow-400', bg: 'bg-yellow-500', border: 'border-yellow-500/30', glow: 'shadow-yellow-500/20' },
    blue: { text: 'text-zinc-400', bg: 'bg-zinc-500', border: 'border-zinc-600', glow: 'shadow-zinc-500/20' },
    amber: { text: 'text-zinc-400', bg: 'bg-zinc-500', border: 'border-zinc-600', glow: 'shadow-zinc-500/20' },
  }

  const getSeverityNum = (s: { severity_numeric?: number; severity?: number | string }) =>
    (s as { severity_numeric?: number }).severity_numeric ?? (typeof (s as { severity?: number }).severity === 'number' ? (s as { severity: number }).severity : 0.7)
  const getHorizonLabel = (s: { horizon?: number; horizon_years?: number }) => {
    const h = (s as { horizon?: number }).horizon ?? (s as { horizon_years?: number }).horizon_years
    return typeof h === 'number' ? (h >= 2000 ? `${h}` : `${h}y`) : ''
  }

  const handleRegulatoryClick = (s: RegulatoryItem) => {
    if (selectedScenario === s.id) {
      onScenarioSelect(null)
    } else {
      setIsLoading(true)
      setTimeout(() => {
        onScenarioSelect({
          id: s.id,
          name: s.name,
          type: s.type,
          severity: getSeverityNum(s as RegulatoryItem),
          probability: (s as { probability?: number }).probability ?? 0.1,
          source: s.source,
          regulator: (s as { regulator?: string }).regulator,
          parameters: (s as { parameters?: Record<string, unknown> }).parameters,
        })
        setIsLoading(false)
      }, 300)
    }
  }

  const extendedList = useMemo(
    () =>
      (extendedCategories?.length ? extendedCategories : STRESS_EXTENDED_FALLBACK).map((c) => ({
        ...c,
        icon: (c as { icon?: unknown }).icon ?? Icons[c.id as keyof typeof Icons],
        color: ((c as { color?: string }).color) ?? CATEGORY_COLORS[c.id] ?? 'cyan',
      })),
    [extendedCategories]
  )

  const handleScenarioClick = (
    category: { id: string; scenarios: Array<{ id: string; name: string; severity?: number; severity_numeric?: number; probability?: number }> },
    scenario: { id: string; name: string; severity?: number; severity_numeric?: number; probability?: number }
  ) => {
    if (selectedScenario === scenario.id) {
      onScenarioSelect(null)
    } else {
      setIsLoading(true)
      const sev = (scenario as { severity_numeric?: number }).severity_numeric ?? (typeof (scenario as { severity?: number }).severity === 'number' ? (scenario as { severity: number }).severity : 0.7)
      setTimeout(() => {
        onScenarioSelect({ id: scenario.id, name: scenario.name, type: category.id, severity: sev, probability: (scenario as { probability?: number }).probability ?? 0.1 })
        setIsLoading(false)
      }, 300)
    }
  }

  if (isCollapsed) {
    return (
      <div className="space-y-2">
        {extendedList.map((type) => {
          const colors = colorClasses[type.color]
          const hasActive = type.scenarios.some((s) => s.id === selectedScenario)
          return (
            <button
              key={type.id}
              onClick={() => setExpandedType(expandedType === type.id ? null : type.id)}
              className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all duration-300 ${hasActive ? `${colors.border} border-2 ${colors.glow} shadow-lg ${colors.text}` : 'border border-zinc-800 hover:border-zinc-700 text-zinc-500'}`}
              title={type.label}
            >
              {type.icon}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {/* Tabs */}
      {showTabs && (
        <div className="flex gap-1 p-0.5 rounded-lg bg-zinc-800 border border-zinc-800 mb-3">
          <button
            onClick={() => setActiveTab('regulatory')}
            className={`flex-1 text-[10px] uppercase tracking-wider py-1.5 px-2 rounded ${activeTab === 'regulatory' ? 'bg-zinc-700 text-zinc-300 border border-zinc-600' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Regulatory Library
          </button>
          <button
            onClick={() => setActiveTab('extended')}
            className={`flex-1 text-[10px] uppercase tracking-wider py-1.5 px-2 rounded ${activeTab === 'extended' ? 'bg-zinc-700 text-zinc-300 border border-zinc-600' : 'text-zinc-500 hover:text-zinc-300'}`}
          >
            Extended
          </button>
        </div>
      )}

      {/* Regulatory Library */}
      <AnimatePresence mode="wait">
        {activeTab === 'regulatory' && (
          <motion.div key="regulatory" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse" />
              <span className="text-zinc-600 text-[10px] uppercase tracking-[0.2em]">EBA, Fed, NGFS, BIS</span>
            </div>
            {regulatoryLoading ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
              </div>
            ) : (
              <div className="max-h-[280px] overflow-y-auto custom-scrollbar space-y-1 pr-1">
                {regulatoryLibrary.map((s) => {
                  const isActive = selectedScenario === s.id
                  return (
                    <button
                      key={s.id}
                      onClick={() => handleRegulatoryClick(s)}
                      disabled={isLoading}
                      className={`w-full text-left rounded-lg p-2 border transition-all ${isActive ? 'bg-zinc-700 border-zinc-600' : 'border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800'}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={`text-xs font-medium truncate ${isActive ? 'text-zinc-300' : 'text-zinc-100'}`}>{s.name}</span>
                        <span className={`text-[10px] font-mono shrink-0 ${getSeverityNum(s as RegulatoryItem) > 0.8 ? 'text-red-400' : getSeverityNum(s as RegulatoryItem) > 0.6 ? 'text-orange-400' : 'text-yellow-400'}`}>
                          {(getSeverityNum(s as RegulatoryItem) * 100).toFixed(0)}%
                        </span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-zinc-500">
                        <span
                          className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] ${
                            hasZoneEntities(s.type)
                              ? 'bg-zinc-700 text-zinc-400 border border-zinc-600'
                              : 'bg-zinc-700 text-zinc-500 border border-zinc-700'
                          }`}
                          title={hasZoneEntities(s.type) ? 'Shows zones and institutions on map' : 'Metrics only'}
                        >
                          {hasZoneEntities(s.type) ? 'Zone & entities' : 'Metrics only'}
                        </span>
                        {[s.source, (s as { regulator?: string }).regulator, getHorizonLabel(s as RegulatoryItem)].filter(Boolean).join(' · ')}
                      </div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(s as { applicable_regulations?: string[] }).applicable_regulations?.map((r) => (
                          <span key={r} className="px-1.5 py-0.5 rounded bg-zinc-700 text-[9px] text-zinc-400">
                            {r}
                          </span>
                        ))}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'extended' && (
          <motion.div key="extended" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse" />
              <span className="text-zinc-600 text-[10px] uppercase tracking-[0.2em]">Scenarios</span>
            </div>
            {extendedList.map((type) => {
              const colors = colorClasses[type.color]
              const isExpanded = expandedType === type.id
              const hasActive = type.scenarios.some((s) => s.id === selectedScenario)
              return (
                <div key={type.id} className="relative">
                  <button
                    onClick={() => setExpandedType(isExpanded ? null : type.id)}
                    className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all border ${isExpanded || hasActive ? `bg-zinc-800 ${colors.border}` : 'hover:bg-zinc-800 border-transparent'}`}
                  >
                    <span className={hasActive ? colors.text : 'text-zinc-500'}>{type.icon}</span>
                    <span className={`text-xs flex-1 text-left ${hasActive ? colors.text : 'text-zinc-400'}`}>{type.label}</span>
                    <span className="text-zinc-700 text-[10px]">{type.scenarios.length}</span>
                    <svg className={`w-3 h-3 text-zinc-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                        <div className={`mt-1 ml-4 border-l-2 ${colors.border} pl-2 max-h-[240px] overflow-y-auto custom-scrollbar pr-1`}>
                          {type.scenarios.map((sc) => {
                            const isActive = selectedScenario === sc.id
                            return (
                              <button
                                key={sc.id}
                                onClick={() => handleScenarioClick(type, sc)}
                                disabled={isLoading}
                                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-left group border transition-all ${isActive ? `bg-zinc-700 ${colors.border}` : 'border-transparent hover:bg-zinc-800'}`}
                              >
                                <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${isActive ? `${colors.bg} animate-pulse` : 'bg-zinc-600'}`} />
                                <span className={`text-xs flex-1 truncate ${isActive ? 'text-zinc-100' : 'text-zinc-500 group-hover:text-zinc-300'}`}>{sc.name}</span>
                                <span
                                  className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] ${
                                    hasZoneEntities(type.id)
                                      ? 'bg-zinc-700 text-zinc-400 border border-zinc-600'
                                      : 'bg-zinc-700 text-zinc-500 border border-zinc-700'
                                  }`}
                                  title={hasZoneEntities(type.id) ? 'Shows zones and institutions on map' : 'Metrics only'}
                                >
                                  {hasZoneEntities(type.id) ? 'Zone & entities' : 'Metrics only'}
                                </span>
                                <span className={`text-[10px] font-mono shrink-0 px-1 py-0.5 rounded ${getSeverityNum(sc) > 0.8 ? 'bg-red-500/20 text-red-400' : getSeverityNum(sc) > 0.6 ? 'bg-orange-500/20 text-orange-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                  {(getSeverityNum(sc) * 100).toFixed(0)}%
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      <AnimatePresence>
        {isLoading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex justify-center py-2">
            <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Collapsible: About the stress testing database */}
      <div className="mt-3 border-t border-zinc-800 pt-2">
        <button
          onClick={() => setCollapseInfoOpen((v) => !v)}
          className="w-full flex items-center justify-between text-zinc-500 hover:text-zinc-400 text-[10px] uppercase tracking-wider"
        >
          <span>About the stress testing database</span>
          <svg className={`w-3 h-3 transition-transform ${collapseInfoOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <AnimatePresence>
          {collapseInfoOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
              <div className="pt-2 space-y-2 text-[11px] text-zinc-500 leading-relaxed">
                <p>
                  The stress testing database is not a single dataset but four layers: (1) regulatory scenarios (EBA, Fed, NGFS, BIS), (2) macroeconomic time series, (3) climate scenarios, (4) financial proxies (PD, LGD, capital impact).
                </p>
                <p>
                  Sources: EBA/ECB — Adverse/Baseline; Federal Reserve — CCAR/DFAST, Severely Adverse; NGFS — SSP1-2.6, SSP2-4.5, SSP5-8.5; BIS/IMF — system-wide and contagion scenarios.
                </p>
                <p>
                  <span className="text-zinc-300">For this demo:</span> regulator-recognized scenarios from EBA, Federal Reserve, NGFS, and BIS, adapted to portfolios and jurisdictions.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
