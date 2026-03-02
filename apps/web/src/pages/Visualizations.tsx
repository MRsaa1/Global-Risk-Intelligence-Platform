/**
 * Risk Flow Analysis — Institutional-grade visualization page.
 * Terminal aesthetic, data-dense layout, muted corporate palette.
 */
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useState, useEffect, useCallback, useRef } from 'react'
import RiskFlowDiagram from '../components/RiskFlowDiagram'
import CrossModuleCascadeGraph from '../components/analytics/CrossModuleCascadeGraph'
import CascadeSankeyFlow from '../components/analytics/CascadeSankeyFlow'
import { ArrowPathIcon, ChevronDownIcon, PlayIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { useActiveScenario, useSelectedStressTestId, useRecentEvents, usePlatformStore } from '../store/platformStore'
import api from '../lib/api'

// ─── Constants ──────────────────────────────────────────────────────────────

const MODULE_INFO: Record<string, { label: string; full: string; desc: string; color: string }> = {
  cip:    { label: 'CIP',    full: 'Critical Infrastructure Protection', desc: 'Power grids, water systems, transport networks, telecommunications', color: '#3b82f6' },
  scss:   { label: 'SCSS',   full: 'Supply Chain Sovereignty & Security', desc: 'Global supply routes, trade dependencies, logistics networks', color: '#8b5cf6' },
  sro:    { label: 'SRO',    full: 'Systemic Risk Observatory', desc: 'Financial contagion, interbank exposure, market systemic risk', color: '#f59e0b' },
  biosec: { label: 'BIOSEC', full: 'Biosecurity & Pandemic', desc: 'Disease outbreaks, pandemic preparedness, biological threats', color: '#10b981' },
  erf:    { label: 'ERF',    full: 'Existential Risk Framework', desc: 'Civilization-scale threats, global catastrophic risk', color: '#ef4444' },
  asm:    { label: 'ASM',    full: 'Atomic Safety & Monitoring', desc: 'Nuclear facilities, radiation events, nuclear safety protocols', color: '#f97316' },
  asgi:   { label: 'ASGI',   full: 'AI Safety & Governance Initiative', desc: 'AI alignment, autonomous systems, algorithmic risk', color: '#06b6d4' },
  cadapt: { label: 'CADAPT', full: 'Climate Adaptation', desc: 'Sea level rise, extreme weather adaptation, climate resilience', color: '#84cc16' },
}

const MODULES = Object.keys(MODULE_INFO)

const CATEGORY_INFO: Record<string, string> = {
  infrastructure_failure: 'Infrastructure Failure',
  cyber_attack: 'Cyber Attack',
  climate_disaster: 'Climate Disaster',
  financial_contagion: 'Financial Contagion',
  supply_chain_disruption: 'Supply Chain Disruption',
  pandemic_outbreak: 'Pandemic Outbreak',
  geopolitical_crisis: 'Geopolitical Crisis',
  ai_safety_breach: 'AI Safety Breach',
  nuclear_incident: 'Nuclear Incident',
  existential_escalation: 'Existential Escalation',
}

const CATEGORIES = Object.keys(CATEGORY_INFO)

const sampleRiskZones = [
  { name: 'New York', risk: 0.85, exposure: 52.3 },
  { name: 'Tokyo', risk: 0.92, exposure: 45.2 },
  { name: 'London', risk: 0.68, exposure: 38.5 },
  { name: 'Frankfurt', risk: 0.58, exposure: 35.2 },
  { name: 'Shanghai', risk: 0.82, exposure: 55.8 },
  { name: 'Singapore', risk: 0.62, exposure: 38.9 },
  { name: 'Hong Kong', risk: 0.75, exposure: 42.5 },
  { name: 'Sydney', risk: 0.52, exposure: 38.7 },
]
const debtCrisisZones = [
  { name: 'Athens', risk: 0.95, exposure: 42 },
  { name: 'Madrid', risk: 0.88, exposure: 68 },
  { name: 'Rome', risk: 0.85, exposure: 55 },
  { name: 'Lisbon', risk: 0.82, exposure: 28 },
  { name: 'Dublin', risk: 0.72, exposure: 38 },
  { name: 'Brussels', risk: 0.68, exposure: 48 },
  { name: 'Berlin', risk: 0.58, exposure: 85 },
]
const financialCrisisZones = [
  { name: 'Wall Street', risk: 0.92, exposure: 85.3 },
  { name: 'City of London', risk: 0.88, exposure: 72.5 },
  { name: 'Frankfurt', risk: 0.78, exposure: 45.2 },
  { name: 'Zurich', risk: 0.65, exposure: 42.5 },
  { name: 'Singapore', risk: 0.72, exposure: 38.9 },
  { name: 'Hong Kong', risk: 0.82, exposure: 48.5 },
]

// ─── UTC Clock ──────────────────────────────────────────────────────────────

function useUtcClock(intervalMs = 30_000) {
  const [ts, setTs] = useState(() => new Date().toISOString().slice(11, 19))
  useEffect(() => {
    const t = setInterval(() => setTs(new Date().toISOString().slice(11, 19)), intervalMs)
    return () => clearInterval(t)
  }, [intervalMs])
  return ts
}

// ─── StressTestFlowPanel: fetches its own zones ─────────────────────────────

function StressTestFlowPanel({ testId, testName }: { testId: string; testName: string }) {
  const { data: zones, isLoading } = useQuery({
    queryKey: ['stress-test-zones-panel', testId],
    queryFn: async () => {
      const { data } = await api.get(`/stress-tests/${testId}/zones`)
      return data.map((zone: any) => ({
        name: zone.name || zone.zone_level,
        risk: zone.risk_score || 0.5,
        exposure: (zone.expected_loss || zone.total_exposure || 0) / 1_000_000_000,
        sector: zone.zone_level,
      }))
    },
    retry: 1,
    staleTime: 30_000,
  })

  const hasRealZones = zones && zones.length > 0

  return (
    <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-md overflow-hidden">
      <div className="px-3 py-2 border-b border-zinc-800/60 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">{testName}</span>
          {hasRealZones && (
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">LIVE</span>
          )}
        </div>
        <span className="text-[9px] font-mono text-zinc-600 tabular-nums">
          {hasRealZones ? `${zones.length} zones` : isLoading ? '...' : 'sample'}
        </span>
      </div>
      <RiskFlowDiagram
        stressTestName={testName}
        riskZones={hasRealZones ? zones : sampleRiskZones}
        height={320}
        showControls={false}
        showExport={false}
      />
    </div>
  )
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function Visualizations() {
  const queryClient = useQueryClient()
  const utc = useUtcClock()

  const activeScenario = useActiveScenario()
  const selectedStressTestId = useSelectedStressTestId()
  const setSelectedStressTestId = usePlatformStore((s) => s.setSelectedStressTestId)
  const recentEvents = useRecentEvents(10)

  useEffect(() => {
    const hasStressTestEvent = recentEvents.some(e =>
      e.event_type?.includes('STRESS_TEST') || e.event_type?.includes('stress_test')
    )
    if (hasStressTestEvent) {
      queryClient.invalidateQueries({ queryKey: ['stress-tests'] })
      if (selectedStressTestId) {
        queryClient.invalidateQueries({ queryKey: ['stress-test-zones', selectedStressTestId] })
      }
    }
  }, [recentEvents, queryClient, selectedStressTestId])

  const { data: stressTests } = useQuery({
    queryKey: ['stress-tests'],
    queryFn: async () => {
      const { data } = await api.get('/stress-tests', { params: { limit: 100 } })
      return data
    },
    refetchInterval: 30000,
    retry: false,
    placeholderData: [],
  })

  const { data: riskZones } = useQuery({
    queryKey: ['stress-test-zones', selectedStressTestId],
    queryFn: async () => {
      if (!selectedStressTestId) return []
      const { data } = await api.get(`/stress-tests/${selectedStressTestId}/zones`)
      return data.map((zone: any) => ({
        name: zone.name || zone.zone_level,
        risk: zone.risk_score || 0.5,
        exposure: (zone.expected_loss || zone.total_exposure || 0) / 1_000_000_000,
        sector: zone.zone_level,
      }))
    },
    enabled: !!selectedStressTestId && !String(selectedStressTestId).startsWith('sample-'),
    refetchInterval: 10000,
  })

  const completedTests = (() => {
    const all = stressTests?.filter((t: any) => t.status === 'completed') || []
    const seen = new Set<string>()
    const unique: any[] = []
    for (const t of all) {
      if (!seen.has(t.name)) { seen.add(t.name); unique.push(t) }
      if (unique.length >= 3) break
    }
    return unique
  })()

  // Deduplicated scenario list for dropdown: one option per unique name (prefer completed, then most recent)
  const scenarioOptions = (() => {
    const list = stressTests || []
    const byName = new Map<string, any>()
    for (const t of list) {
      const key = (t.name || t.id || '').trim() || String(t.id)
      const existing = byName.get(key)
      if (!existing) {
        byName.set(key, t)
      } else {
        // Prefer completed, then running, then by id (newer often has larger id or later sort)
        const order = { completed: 0, running: 1 }
        const existingOrder = order[existing.status as keyof typeof order] ?? 2
        const currentOrder = order[t.status as keyof typeof order] ?? 2
        if (currentOrder < existingOrder || (currentOrder === existingOrder && String(t.id) > String(existing.id))) {
          byName.set(key, t)
        }
      }
    }
    const options = Array.from(byName.values())
    options.sort((a, b) => {
      const nameA = (a.name || '').toLowerCase()
      const nameB = (b.name || '').toLowerCase()
      if (nameA !== nameB) return nameA.localeCompare(nameB)
      return String(b.id).localeCompare(String(a.id))
    })
    return options
  })()

  useEffect(() => {
    if (!selectedStressTestId && completedTests.length > 0) {
      setSelectedStressTestId(completedTests[0].id)
    }
  }, [completedTests, selectedStressTestId, setSelectedStressTestId])

  const activeRiskZones = riskZones && riskZones.length > 0 ? riskZones : null
  const useRealData = (!!activeRiskZones && !!activeScenario) || (!!selectedStressTestId && !!(riskZones?.length))
  const selectedTest = stressTests?.find((t: any) => t.id === selectedStressTestId)

  // ─── Cross-Module Cascade ──────────────────────────────────────────────
  const [cascadeGraph, setCascadeGraph] = useState<any>(null)
  const [cascadeSimResult, setCascadeSimResult] = useState<any>(null)
  const [cascadeSimLoading, setCascadeSimLoading] = useState(false)
  const [cascadeSimError, setCascadeSimError] = useState<string | null>(null)
  const [cascadeSource, setCascadeSource] = useState('cip')
  const [cascadeCategory, setCascadeCategory] = useState('infrastructure_failure')
  const [cascadeSeverity, setCascadeSeverity] = useState(0.7)
  const [showReference, setShowReference] = useState(false)
  const [showPropMatrix, setShowPropMatrix] = useState(false)
  const [refreshingPanels, setRefreshingPanels] = useState(false)
  const cascadeAutoRanRef = useRef(false)

  const loadCascadeGraph = useCallback(async () => {
    try {
      const res = await fetch('/api/v1/risk-engine/cascade/graph')
      if (res.ok) setCascadeGraph(await res.json())
    } catch {}
  }, [])

  useEffect(() => { loadCascadeGraph() }, [loadCascadeGraph])

  const runCascadeSimulation = useCallback(async (source?: string, category?: string, severity?: number) => {
    setCascadeSimLoading(true)
    setCascadeSimError(null)
    const s = source ?? cascadeSource
    const c = category ?? cascadeCategory
    const sv = severity ?? cascadeSeverity
    try {
      const res = await fetch('/api/v1/risk-engine/cascade/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_module: s, category: c, severity: sv }),
      })
      if (!res.ok) {
        setCascadeSimError(`API ${res.status}: ${await res.text()}`)
        return
      }
      setCascadeSimResult(await res.json())
    } catch (err: any) {
      setCascadeSimError(err?.message === 'Failed to fetch'
        ? 'Cannot reach API server — ensure backend is running on port 9002.'
        : `Network error: ${err?.message || String(err)}`)
    } finally {
      setCascadeSimLoading(false)
    }
  }, [cascadeSource, cascadeCategory, cascadeSeverity])

  useEffect(() => {
    if (!cascadeAutoRanRef.current) { cascadeAutoRanRef.current = true; runCascadeSimulation() }
  }, [runCascadeSimulation])

  const handleCascadeRefresh = useCallback(async () => {
    await loadCascadeGraph()
    await runCascadeSimulation()
  }, [loadCascadeGraph, runCascadeSimulation])

  const handlePanelsRefresh = useCallback(async () => {
    setRefreshingPanels(true)
    await queryClient.invalidateQueries({ queryKey: ['stress-tests'] })
    await queryClient.invalidateQueries({ queryKey: ['stress-test-zones-panel'] })
    if (selectedStressTestId) await queryClient.invalidateQueries({ queryKey: ['stress-test-zones', selectedStressTestId] })
    setTimeout(() => setRefreshingPanels(false), 800)
  }, [queryClient, selectedStressTestId])

  return (
    <div className="min-h-full bg-zinc-950 p-4 lg:p-6">
      <div className="w-full max-w-[1920px] mx-auto space-y-4">

        {/* ════════════════════════════════════════════════════════════════════
            HEADER — Intelligence Brief Style
            ════════════════════════════════════════════════════════════════════ */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
          <h1 className="text-sm font-mono uppercase tracking-widest text-zinc-400">
            Risk Flow Analysis
          </h1>
          <span className="text-zinc-800">|</span>
          <span className="text-[10px] font-mono text-zinc-600">Cross-module cascade propagation & exposure flow</span>
          <div className="ml-auto flex items-center gap-3">
            {/* Scenario selector */}
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] font-mono text-zinc-600 uppercase">Scenario:</span>
              <select
                value={selectedStressTestId || ''}
                onChange={(e) => setSelectedStressTestId(e.target.value || null)}
                className="px-2 py-1 bg-zinc-900 border border-zinc-800 rounded text-[10px] font-mono text-zinc-300 min-w-[180px]"
              >
                <option value="">Multi-Event Global (sample)</option>
                <option value="sample-climate">Climate Physical Shock</option>
                <option value="sample-debt">Sovereign Debt Crisis</option>
                <option value="sample-financial">Basel Full Financial Crisis</option>
                {scenarioOptions.map((t: any) => (
                  <option key={t.id} value={t.id}>
                    {t.name || t.id}{t.status === 'completed' ? ' ✓' : t.status === 'running' ? ' …' : ''}
                  </option>
                ))}
              </select>
            </div>
            {/* Status chip */}
            {useRealData ? (
              <span className="text-[8px] font-mono px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 uppercase tracking-wider">Live</span>
            ) : (
              <span className="text-[8px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-700/50 uppercase tracking-wider">Sample</span>
            )}
            {/* UTC timestamp */}
            <span className="text-[10px] font-mono text-zinc-600 tabular-nums">{utc} UTC</span>
          </div>
        </div>

        <div className="border-t border-zinc-800/60" />

        {/* ════════════════════════════════════════════════════════════════════
            MAIN SANKEY
            ════════════════════════════════════════════════════════════════════ */}
        {useRealData ? (
          <RiskFlowDiagram
            stressTestName={activeScenario?.type || selectedTest?.name || 'Stress Test'}
            riskZones={activeRiskZones || riskZones || []}
            height={420}
          />
        ) : selectedStressTestId === 'sample-climate' ? (
          <RiskFlowDiagram stressTestName="Climate Physical Shock" riskZones={sampleRiskZones} height={420} />
        ) : selectedStressTestId === 'sample-debt' ? (
          <RiskFlowDiagram stressTestName="Sovereign Debt Crisis" riskZones={debtCrisisZones} height={420} />
        ) : selectedStressTestId === 'sample-financial' ? (
          <RiskFlowDiagram stressTestName="Basel Full Financial Crisis" riskZones={financialCrisisZones} height={420} />
        ) : selectedStressTestId && selectedTest ? (
          <RiskFlowDiagram stressTestName={selectedTest.name} riskZones={sampleRiskZones} height={420} />
        ) : (
          <RiskFlowDiagram height={420} />
        )}

        {/* ════════════════════════════════════════════════════════════════════
            THREE DISTINCT ANALYSIS PANELS
            ════════════════════════════════════════════════════════════════════ */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
            STRESS TEST COMPARISON
          </span>
          <button
            onClick={handlePanelsRefresh}
            disabled={refreshingPanels}
            className="flex items-center gap-1 px-2 py-1 rounded bg-zinc-800/60 hover:bg-zinc-700 text-zinc-500 text-[10px] font-mono disabled:opacity-50 transition-colors border border-zinc-800/60"
          >
            <ArrowPathIcon className={`w-3 h-3 ${refreshingPanels ? 'animate-spin' : ''}`} />
            REFRESH
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {completedTests.length > 0 ? (
            <>
              {completedTests.map((test: any) => (
                <StressTestFlowPanel key={test.id} testId={test.id} testName={test.name} />
              ))}
              {completedTests.length < 2 && (
                <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-md overflow-hidden">
                  <div className="px-3 py-2 border-b border-zinc-800/60">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">GEOGRAPHIC RISK CONCENTRATION</span>
                  </div>
                  <RiskFlowDiagram stressTestName="Climate Physical Shock" riskZones={sampleRiskZones} height={320} showControls={false} showExport={false} />
                </div>
              )}
              {completedTests.length < 3 && (
                <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-md overflow-hidden">
                  <div className="px-3 py-2 border-b border-zinc-800/60">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">SEVERITY DISTRIBUTION — FINANCIAL SHOCK</span>
                  </div>
                  <RiskFlowDiagram stressTestName="Basel Full Financial Crisis" riskZones={financialCrisisZones} height={320} showControls={false} showExport={false} />
                </div>
              )}
            </>
          ) : (
            <>
              <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-md overflow-hidden">
                <div className="px-3 py-2 border-b border-zinc-800/60">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">MULTI-EVENT SECTOR CASCADE</span>
                </div>
                <RiskFlowDiagram height={320} showControls={false} showExport={false} />
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-md overflow-hidden">
                <div className="px-3 py-2 border-b border-zinc-800/60">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">GEOGRAPHIC RISK CONCENTRATION</span>
                </div>
                <RiskFlowDiagram stressTestName="Climate Physical Shock" riskZones={sampleRiskZones} height={320} showControls={false} showExport={false} />
              </div>
              <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-md overflow-hidden">
                <div className="px-3 py-2 border-b border-zinc-800/60">
                  <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">SEVERITY DISTRIBUTION — FINANCIAL SHOCK</span>
                </div>
                <RiskFlowDiagram stressTestName="Basel Full Financial Crisis" riskZones={financialCrisisZones} height={320} showControls={false} showExport={false} />
              </div>
            </>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            CROSS-MODULE CASCADE ENGINE
            ════════════════════════════════════════════════════════════════════ */}
        <div className="border-t border-zinc-800/60 pt-4">
          <div className="flex items-center gap-3 mb-1">
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">CROSS-MODULE CASCADE ENGINE</span>
            <span className="flex-1 border-t border-dotted border-zinc-800/60" />
            <button
              onClick={handleCascadeRefresh}
              disabled={cascadeSimLoading}
              className="p-1.5 rounded bg-zinc-800/60 hover:bg-zinc-700 text-zinc-500 disabled:opacity-50 transition-colors border border-zinc-800/60"
              title="Refresh"
            >
              <ArrowPathIcon className={`w-3.5 h-3.5 ${cascadeSimLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="text-[9px] font-mono text-zinc-600 mb-3">
            Weighted directed graph | {MODULES.length} modules | BFS propagation | 0.7x attenuation/hop | Threshold 5%
          </div>

          {/* D3 Graph */}
          {cascadeGraph && (
            <div className="mb-3 rounded-md bg-zinc-900/50 border border-zinc-800/60 overflow-hidden">
              <div className="px-3 py-1.5 border-b border-zinc-800/60 flex items-center justify-between">
                <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-600">
                  MODULE DEPENDENCY GRAPH — {CATEGORY_INFO[cascadeCategory]}
                </span>
                <span className="text-[9px] font-mono text-zinc-700 tabular-nums">
                  {(cascadeGraph.edges || []).filter((e: any) => !cascadeCategory || e.categories?.includes(cascadeCategory)).length} edges
                </span>
              </div>
              <CrossModuleCascadeGraph
                nodes={(cascadeGraph.nodes || []).map((n: any) => ({
                  id: n.id,
                  label: MODULE_INFO[n.id]?.label || n.label || n.id.toUpperCase(),
                  full_name: MODULE_INFO[n.id]?.full || n.full_name || '',
                  description: MODULE_INFO[n.id]?.desc || n.description || '',
                  color: MODULE_INFO[n.id]?.color || n.color || '#888',
                }))}
                edges={cascadeGraph.edges || []}
                simulationResult={cascadeSimResult}
                cascadeSource={cascadeSource}
                cascadeCategory={cascadeCategory}
                height={440}
              />
              {/* Inline legend */}
              <div className="px-3 py-1.5 border-t border-zinc-800/60 flex items-center gap-4 text-[8px] font-mono text-zinc-600">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full border border-red-500/60" /> Trigger/Critical</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full border border-amber-500/60" /> High impact</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full border border-emerald-500/50" /> Low impact</span>
                <span className="flex items-center gap-1"><span className="w-4 border-t border-dashed border-zinc-500" /> Flow</span>
                <span className="flex items-center gap-1"><span className="w-4 border-t-2 border-red-500/60" /> Critical path</span>
              </div>
            </div>
          )}

          {/* Simulation Controls — single line */}
          <div className="flex flex-wrap items-center gap-2 mb-3 px-3 py-2 rounded-md bg-zinc-900/50 border border-zinc-800/60 text-[10px] font-mono">
            <span className="text-zinc-600 uppercase">Module:</span>
            <select
              value={cascadeSource}
              onChange={e => setCascadeSource(e.target.value)}
              className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700/60 text-zinc-300 text-[10px] font-mono min-w-[200px]"
            >
              {MODULES.map(m => <option key={m} value={m}>{MODULE_INFO[m].label} — {MODULE_INFO[m].full}</option>)}
            </select>
            <span className="text-zinc-600 uppercase ml-1">Event:</span>
            <select
              value={cascadeCategory}
              onChange={e => setCascadeCategory(e.target.value)}
              className="px-2 py-1 rounded bg-zinc-800 border border-zinc-700/60 text-zinc-300 text-[10px] font-mono min-w-[180px]"
            >
              {CATEGORIES.map(c => <option key={c} value={c}>{CATEGORY_INFO[c]}</option>)}
            </select>
            <span className="text-zinc-600 uppercase ml-1">Severity:</span>
            <input
              type="range" min={0.1} max={1.0} step={0.05}
              value={cascadeSeverity}
              onChange={e => setCascadeSeverity(parseFloat(e.target.value))}
              className="w-20 accent-zinc-500"
            />
            <span className={`tabular-nums w-8 text-right ${cascadeSeverity > 0.7 ? 'text-red-400/80' : cascadeSeverity > 0.4 ? 'text-amber-400/80' : 'text-emerald-400/80'}`}>
              {(cascadeSeverity * 100).toFixed(0)}%
            </span>
            <button
              onClick={() => runCascadeSimulation()}
              disabled={cascadeSimLoading}
              className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700/60 text-[10px] font-mono disabled:opacity-50 transition-colors"
            >
              {cascadeSimLoading ? (
                <ArrowPathIcon className="w-3 h-3 animate-spin" />
              ) : (
                <PlayIcon className="w-3 h-3" />
              )}
              {cascadeSimLoading ? 'RUNNING...' : 'SIMULATE'}
            </button>
          </div>

          {/* Error */}
          {cascadeSimError && (
            <div className="mb-3 px-3 py-2 rounded-md bg-red-500/5 border border-red-500/20 flex items-center gap-2 text-[10px] font-mono">
              <ExclamationTriangleIcon className="w-3.5 h-3.5 text-red-400/70 flex-shrink-0" />
              <span className="text-red-400/80 flex-1">{cascadeSimError}</span>
              <button onClick={() => runCascadeSimulation()} className="text-red-400/70 hover:text-red-300 underline flex-shrink-0">RETRY</button>
            </div>
          )}

          {/* Cascade Results */}
          {cascadeSimResult && (() => {
            const impactsObj = cascadeSimResult.module_impacts || {}
            const impactsList = Object.values(impactsObj) as any[]
            const sortedImpacts = [...impactsList].sort((a: any, b: any) => (b.impact_severity || 0) - (a.impact_severity || 0))
            const amplification = cascadeSimResult.total_amplification_factor ?? 1
            const lossPct = cascadeSimResult.total_estimated_loss_pct ?? 0
            const criticalPath = cascadeSimResult.critical_path || []
            const depth = cascadeSimResult.cascade_depth ?? 0
            const simTime = cascadeSimResult.simulation_time_ms ?? 0
            const propMatrix = cascadeSimResult.propagation_matrix || null

            return (
              <div className="space-y-3">
                {/* KPI Strip — single line */}
                <div className="flex flex-wrap items-center gap-1 px-3 py-2 rounded-md bg-zinc-900/50 border border-zinc-800/60 text-[10px] font-mono">
                  <span className="text-zinc-600">Source:</span>
                  <span style={{ color: MODULE_INFO[cascadeSource]?.color }}>{MODULE_INFO[cascadeSource]?.label}</span>
                  <span className="text-zinc-800 mx-1">|</span>
                  <span className="text-zinc-600">Affected:</span>
                  <span className="text-zinc-200 tabular-nums">{sortedImpacts.length}/{MODULES.length}</span>
                  <span className="text-zinc-800 mx-1">|</span>
                  <span className="text-zinc-600">Amplification:</span>
                  <span className={`tabular-nums ${amplification > 2 ? 'text-red-400/80' : amplification > 1.5 ? 'text-amber-400/80' : 'text-emerald-400/80'}`}>{amplification.toFixed(2)}x</span>
                  <span className="text-zinc-800 mx-1">|</span>
                  <span className="text-zinc-600">Est. Loss:</span>
                  <span className={`tabular-nums ${lossPct > 30 ? 'text-red-400/80' : lossPct > 15 ? 'text-amber-400/80' : 'text-emerald-400/80'}`}>{lossPct.toFixed(1)}%</span>
                  <span className="text-zinc-800 mx-1">|</span>
                  <span className="text-zinc-600">Depth:</span>
                  <span className="text-zinc-200 tabular-nums">{depth} hops</span>
                  <span className="text-zinc-800 mx-1">|</span>
                  <span className="text-zinc-600">Time:</span>
                  <span className="text-zinc-400 tabular-nums">{simTime.toFixed(1)}ms</span>
                </div>

                {sortedImpacts.length === 0 && (
                  <div className="px-3 py-1.5 rounded-md bg-zinc-800/30 border border-zinc-800/60 text-[10px] font-mono text-zinc-500">
                    No propagation for <span className="text-zinc-400">{MODULE_INFO[cascadeSource]?.label}</span> + <span className="text-zinc-400">{CATEGORY_INFO[cascadeCategory]}</span>. Try another Event (e.g. CIP: Infrastructure Failure, Cyber Attack, Climate Disaster; BIOSEC: Pandemic Outbreak).
                  </div>
                )}

                {/* Critical Path — compact inline */}
                {criticalPath.length > 0 && (
                  <div className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-zinc-900/50 border border-zinc-800/60 text-[10px] font-mono overflow-x-auto">
                    <span className="text-zinc-600 uppercase tracking-wider mr-1 flex-shrink-0">CRITICAL PATH:</span>
                    {criticalPath.map((mod: string, i: number) => {
                      const info = MODULE_INFO[mod]
                      const impact = impactsObj[mod]
                      const sev = i === 0 ? cascadeSeverity : (impact?.impact_severity || 0)
                      return (
                        <span key={i} className="flex items-center gap-1 flex-shrink-0">
                          <span style={{ color: info?.color || '#888' }}>{info?.label || mod.toUpperCase()}</span>
                          <span className={`tabular-nums ${sev > 0.6 ? 'text-red-400/70' : sev > 0.3 ? 'text-amber-400/70' : 'text-emerald-400/70'}`}>
                            ({(sev * 100).toFixed(0)}%)
                          </span>
                          {i < criticalPath.length - 1 && <span className="text-zinc-700 mx-0.5">{'\u2192'}</span>}
                        </span>
                      )
                    })}
                  </div>
                )}

                {/* Module Impact Table */}
                {sortedImpacts.length > 0 && (
                  <div className="rounded-md bg-zinc-900/50 border border-zinc-800/60 overflow-hidden">
                    <div className="px-3 py-1.5 border-b border-zinc-800/60">
                      <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-600">MODULE IMPACT ANALYSIS</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-[10px] font-mono">
                        <thead>
                          <tr className="border-b border-zinc-800/60 text-zinc-600">
                            <th className="text-left px-3 py-1.5 font-medium">MODULE</th>
                            <th className="text-left px-3 py-1.5 font-medium">FULL NAME</th>
                            <th className="text-right px-3 py-1.5 font-medium">SEVERITY</th>
                            <th className="text-right px-3 py-1.5 font-medium">LOSS x</th>
                            <th className="text-right px-3 py-1.5 font-medium">WEIGHT</th>
                            <th className="text-left px-3 py-1.5 font-medium">PATH</th>
                            <th className="text-center px-3 py-1.5 font-medium">STATUS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedImpacts.map((m: any, i: number) => {
                            const sev = m.impact_severity || 0
                            const info = MODULE_INFO[m.module] || { label: m.module?.toUpperCase(), full: m.module, desc: '', color: '#888' }
                            const path = (m.propagation_path || []).map((p: string) => MODULE_INFO[p]?.label || p.toUpperCase()).join(' \u2192 ')
                            return (
                              <tr key={i} className="border-b border-zinc-800/30 hover:bg-zinc-800/20 transition-colors">
                                <td className="px-3 py-1.5 font-semibold" style={{ color: info.color }}>{info.label}</td>
                                <td className="px-3 py-1.5 text-zinc-400">{info.full}</td>
                                <td className={`px-3 py-1.5 text-right tabular-nums ${sev > 0.6 ? 'text-red-400/80' : sev > 0.3 ? 'text-amber-400/80' : 'text-emerald-400/80'}`}>
                                  {(sev * 100).toFixed(1)}%
                                </td>
                                <td className="px-3 py-1.5 text-right tabular-nums text-zinc-300">
                                  x{(m.estimated_loss_multiplier || 1).toFixed(2)}
                                </td>
                                <td className="px-3 py-1.5 text-right tabular-nums text-zinc-500">
                                  {(m.propagation_weight || 0).toFixed(3)}
                                </td>
                                <td className="px-3 py-1.5 text-zinc-500 max-w-[200px] truncate">{path}</td>
                                <td className="px-3 py-1.5 text-center">
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                                    m.recalculation_needed
                                      ? 'bg-amber-500/10 text-amber-400/80 border border-amber-500/20'
                                      : 'bg-zinc-800/60 text-zinc-500 border border-zinc-700/30'
                                  }`}>
                                    {m.recalculation_needed ? 'RECALC' : 'OK'}
                                  </span>
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Cascade Sankey Flow */}
                <div className="rounded-md bg-zinc-900/50 border border-zinc-800/60 overflow-hidden">
                  <CascadeSankeyFlow
                    simulationResult={cascadeSimResult}
                    moduleInfo={MODULE_INFO}
                    categoryLabel={CATEGORY_INFO[cascadeCategory] || cascadeCategory}
                    height={340}
                  />
                </div>

                {/* Propagation Matrix (collapsible) */}
                {propMatrix && (
                  <div className="rounded-md bg-zinc-900/50 border border-zinc-800/60 overflow-hidden">
                    <button
                      onClick={() => setShowPropMatrix(!showPropMatrix)}
                      className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-zinc-800/20 transition-colors"
                    >
                      <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-600">
                        PROPAGATION WEIGHT MATRIX — {CATEGORY_INFO[cascadeCategory]}
                      </span>
                      <ChevronDownIcon className={`w-3.5 h-3.5 text-zinc-600 transition-transform ${showPropMatrix ? 'rotate-180' : ''}`} />
                    </button>
                    {showPropMatrix && (
                      <div className="px-3 pb-3 overflow-x-auto">
                        <table className="text-[9px] font-mono border-collapse w-full min-w-[500px]">
                          <thead>
                            <tr>
                              <th className="p-1 text-zinc-600 text-left border border-zinc-800/40">From\To</th>
                              {MODULES.map(m => (
                                <th key={m} className="p-1 text-center border border-zinc-800/40" style={{ color: MODULE_INFO[m]?.color }}>
                                  {MODULE_INFO[m]?.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {MODULES.map(src => (
                              <tr key={src}>
                                <td className="p-1 font-semibold border border-zinc-800/40" style={{ color: MODULE_INFO[src]?.color }}>{MODULE_INFO[src]?.label}</td>
                                {MODULES.map(tgt => {
                                  const w = propMatrix[src]?.[tgt] || 0
                                  return (
                                    <td
                                      key={tgt}
                                      className="p-1 text-center border border-zinc-800/40 tabular-nums"
                                      style={{
                                        backgroundColor: w > 0 ? `rgba(161,161,170,${Math.min(0.15, w * 0.2)})` : 'transparent',
                                        color: w > 0 ? '#a1a1aa' : '#3f3f46',
                                      }}
                                    >
                                      {w > 0 ? w.toFixed(2) : '-'}
                                    </td>
                                  )
                                })}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* Containment Recommendations */}
                {(cascadeSimResult.containment_recommendations || []).length > 0 && (
                  <div className="rounded-md bg-zinc-900/50 border border-zinc-800/60 overflow-hidden">
                    <div className="px-3 py-1.5 border-b border-zinc-800/60">
                      <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-600">CONTAINMENT RECOMMENDATIONS</span>
                    </div>
                    <div className="px-3 py-2 space-y-1">
                      {cascadeSimResult.containment_recommendations.map((r: string, i: number) => {
                        const isCritical = r.startsWith('CRITICAL')
                        const isCross = r.startsWith('CROSS-MODULE')
                        return (
                          <div key={i} className={`flex items-start gap-2 py-1 text-[10px] font-mono ${isCritical || isCross ? 'border-l-2 pl-2' : 'pl-4'}`}
                            style={{ borderLeftColor: isCritical ? 'rgba(185,80,80,0.5)' : isCross ? 'rgba(217,176,82,0.5)' : 'transparent' }}
                          >
                            <span className={isCritical ? 'text-red-400/80' : isCross ? 'text-amber-400/80' : 'text-zinc-400'}>{r}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>
            )
          })()}

          {!cascadeSimResult && !cascadeSimLoading && !cascadeSimError && (
            <div className="rounded-md bg-zinc-900/50 border border-zinc-800/60 overflow-hidden">
              <CascadeSankeyFlow
                simulationResult={null}
                moduleInfo={MODULE_INFO}
                categoryLabel={CATEGORY_INFO[cascadeCategory] || cascadeCategory}
                height={340}
              />
            </div>
          )}
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            METHODOLOGY & REFERENCE — single compact collapsible
            ════════════════════════════════════════════════════════════════════ */}
        <div className="rounded-md bg-zinc-900/50 border border-zinc-800/60 overflow-hidden">
          <button
            onClick={() => setShowReference(!showReference)}
            className="w-full px-3 py-2 flex items-center justify-between hover:bg-zinc-800/20 transition-colors"
          >
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">METHODOLOGY & REFERENCE</span>
            <ChevronDownIcon className={`w-3.5 h-3.5 text-zinc-600 transition-transform ${showReference ? 'rotate-180' : ''}`} />
          </button>
          {showReference && (
            <div className="px-3 pb-3 space-y-3 border-t border-zinc-800/60">
              {/* Module table */}
              <div className="pt-2">
                <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-1 block">STRATEGIC RISK MODULES</span>
                <table className="w-full text-[10px] font-mono">
                  <tbody>
                    {MODULES.map(m => {
                      const info = MODULE_INFO[m]
                      return (
                        <tr key={m} className="border-b border-zinc-800/30">
                          <td className="py-1 pr-3 font-semibold w-16" style={{ color: info.color }}>{info.label}</td>
                          <td className="py-1 pr-3 text-zinc-300 w-64">{info.full}</td>
                          <td className="py-1 text-zinc-500">{info.desc}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* Methodology — compact */}
              <div>
                <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-1 block">CASCADE METHODOLOGY</span>
                <div className="text-[10px] font-mono text-zinc-500 space-y-1">
                  <p><span className="text-zinc-400">Algorithm:</span> BFS from source through category-filtered adjacency. Severity × edge_weight × 0.7 per hop. Stops below 5% or depth 5.</p>
                  <p><span className="text-zinc-400">Amplification:</span> 1 + Σ(downstream severities). Total system risk multiplier beyond initial event.</p>
                  <p><span className="text-zinc-400">Loss %:</span> severity × amplification × 10, capped 100%. First-order portfolio exposure estimate.</p>
                  <p><span className="text-zinc-400">Sankey:</span> Band width = financial exposure (EUR B). Left → Center → Right = Events → Sectors → Impact severity.</p>
                </div>
              </div>

              {/* Event categories — inline */}
              <div>
                <span className="text-[9px] font-mono uppercase tracking-widest text-zinc-600 mb-1 block">EVENT CATEGORIES</span>
                <div className="flex flex-wrap gap-1">
                  {CATEGORIES.map(c => (
                    <span key={c} className="px-2 py-0.5 rounded bg-zinc-800/40 border border-zinc-800/40 text-[9px] font-mono text-zinc-500">{CATEGORY_INFO[c]}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
