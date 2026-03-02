/**
 * SRO Regulator Dashboard - Phase 1.3
 *
 * Global systemic heatmap, scenario library & war gaming,
 * intervention simulator, time-to-impact counters.
 */
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon,
  PlayIcon,
  ChartBarIcon,
  ClockIcon,
  MapIcon,
  AdjustmentsHorizontalIcon,
} from '@heroicons/react/24/outline'
import { getModuleById } from '../../lib/modules'
import AccessGate from '../../components/modules/AccessGate'
import { sroApi } from '../../lib/api'

const bandColors: Record<string, string> = {
  critical: 'bg-red-500/80',
  fragile: 'bg-orange-500/80',
  elevated: 'bg-yellow-500/80',
  resilient: 'bg-emerald-500/80',
}

export default function SRORegulatorDashboard() {
  const navigate = useNavigate()
  const [heatmap, setHeatmap] = useState<Record<string, { sfi: number; band: string }>>({})
  const [scenarios, setScenarios] = useState<Array<{ id: string; name: string; description?: string }>>([])
  const [timelines, setTimelines] = useState<{
    immediate_threats: Array<{ name: string; days?: number; status: string }>
    elevated_threats: Array<{ name: string; days?: number; status: string }>
    medium_term_threats: Array<{ name: string; days?: number; status: string }>
  }>({ immediate_threats: [], elevated_threats: [], medium_term_threats: [] })
  const [crossBorder, setCrossBorder] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [runningScenario, setRunningScenario] = useState<string | null>(null)
  const [runResult, setRunResult] = useState<Record<string, unknown> | null>(null)
  const [levers, setLevers] = useState<Array<{ category: string; name: string; unit: string; default_value: number; effectiveness: number }>>([])
  const [optimizeResult, setOptimizeResult] = useState<Record<string, unknown> | null>(null)
  const [optimizing, setOptimizing] = useState(false)
  const [selectedScenarioForOptimize, setSelectedScenarioForOptimize] = useState<string | null>(null)
  const [selectedInterventions, setSelectedInterventions] = useState<Set<string>>(new Set())

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [hm, sc, tl, cb, lv] = await Promise.all([
        sroApi.getDashboardHeatmap(),
        sroApi.getDashboardScenarios(),
        sroApi.getDashboardTimelines(),
        sroApi.getDashboardCrossBorder(),
        sroApi.getInterventionLevers(),
      ])
      setHeatmap(hm?.heatmap ?? {})
      setLevers(lv)
      setScenarios(sc ?? [])
      setTimelines(tl ?? { immediate_threats: [], elevated_threats: [], medium_term_threats: [] })
      setCrossBorder(cb ?? {})
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const handleRunScenario = async (
    scenarioId: string,
    interventions?: Array<{ day: number; type: string; amount_usd?: number }>
  ) => {
    setRunningScenario(scenarioId)
    setRunResult(null)
    try {
      const result = await sroApi.runScenario(scenarioId, {
        n_monte_carlo: 100,
        time_horizon_days: 90,
        interventions,
      })
      setRunResult(result)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail
        ?? (e instanceof Error ? e.message : 'Run failed')
      setRunResult({ error: msg })
    } finally {
      setRunningScenario(null)
    }
  }

  const handleOptimize = async () => {
    setOptimizing(true)
    setOptimizeResult(null)
    try {
      const result = await sroApi.optimizeInterventions({
        scenario_id: selectedScenarioForOptimize || undefined,
        objective: 'minimize_collapse_probability',
        max_firepower_usd: 3e12,
      })
      setOptimizeResult(result)
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } }; message?: string })?.response?.data?.detail
        ?? (e instanceof Error ? e.message : 'Optimize failed')
      setOptimizeResult({ error: msg })
    } finally {
      setOptimizing(false)
    }
  }

  const toggleIntervention = (name: string) => {
    setSelectedInterventions((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const module = getModuleById('sro')

  if (loading) {
    return (
      <div className="min-h-full p-6 text-zinc-300">Loading regulator dashboard...</div>
    )
  }

  if (!module) {
    return <div className="p-8 text-zinc-200">Module not found</div>
  }

  return (
    <AccessGate accessLevel={module.accessLevel}>
      <div className="min-h-full p-6">
        <div className="w-full max-w-[1920px] mx-auto">
          {/* Header - same as SROModule */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <button
              onClick={() => navigate('/modules/sro')}
              className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 mb-4 transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              <span className="text-sm">Back to SRO</span>
            </button>
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                  <module.icon className="w-8 h-8 text-zinc-300" />
                </div>
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <h1 className="text-3xl font-display font-bold text-zinc-100">
                      {module.fullName} — Regulator Dashboard
                    </h1>
                    <span className="px-2 py-1 bg-zinc-700 text-zinc-200 text-xs rounded border border-zinc-600">
                      Active
                    </span>
                  </div>
                  <p className="text-zinc-400 text-sm">{module.description}</p>
                </div>
              </div>
            </div>
          </motion.div>

          {error && (
            <div className="mb-4 p-4 rounded-md bg-red-500/10 border border-red-500/20 text-red-300/80 text-sm">{error}</div>
          )}

          <div className="space-y-6">
        {/* Module A: Global Systemic Heatmap */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-md bg-zinc-800 border border-zinc-700 p-6"
        >
          <h2 className="flex items-center gap-2 text-lg font-medium text-zinc-100 mb-4">
            <MapIcon className="w-5 h-5" />
            Global Systemic Heatmap
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-4">
            {Object.entries(heatmap).map(([region, data]) => (
              <div
                key={region}
                className={`p-4 rounded-md ${bandColors[data.band] ?? 'bg-zinc-800'} border border-zinc-700 text-zinc-100`}
              >
                <div className="font-medium">{region}</div>
                <div className="text-sm opacity-90">SFI: {data.sfi?.toFixed(2) ?? '—'}</div>
                <div className="text-xs uppercase mt-1">{data.band}</div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Module B: Scenario Library & War Gaming */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-md bg-zinc-800 border border-zinc-700 p-6"
        >
          <h2 className="flex items-center gap-2 text-lg font-medium text-zinc-100 mb-4">
            <PlayIcon className="w-5 h-5" />
            Scenario Library & War Gaming
          </h2>
          <div className="mb-4">
            <div className="text-sm text-zinc-300 mb-2">Policy options (select interventions to apply):</div>
            <div className="flex flex-wrap gap-3">
              {levers.slice(0, 6).map((l) => (
                <label key={l.name} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedInterventions.has(l.name)}
                    onChange={() => toggleIntervention(l.name)}
                    className="rounded border-zinc-600"
                  />
                  <span className="text-sm text-zinc-200">{l.name}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="space-y-3">
            {scenarios.length === 0 ? (
              <div className="p-4 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-400 text-sm">
                No scenarios available. Check that config/sro_scenarios/*.yaml files exist.
              </div>
            ) : (
              scenarios.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between p-4 rounded-md bg-zinc-800 border border-zinc-700"
                >
                  <div>
                    <div className="font-medium text-zinc-100">{s.name}</div>
                    {s.description && (
                      <div className="text-sm text-zinc-400">{s.description}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      handleRunScenario(s.id, selectedInterventions.size
                        ? Array.from(selectedInterventions).map((name, i) => ({
                            day: 5 + i * 2,
                            type: name.toLowerCase().replace(/\s+/g, '_'),
                            amount_usd: name.includes('Lending') ? 500e9 : undefined,
                          }))
                        : undefined)
                    }
                    disabled={runningScenario !== null}
                    className="px-4 py-2 rounded-md bg-zinc-600 hover:bg-zinc-500 text-zinc-100 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors"
                  >
                    {runningScenario === s.id ? 'Running...' : 'Run Simulation'}
                  </button>
                </div>
              ))
            )}
          </div>
          {runResult && (
            <div className="mt-4 p-4 rounded-md bg-zinc-800 border border-zinc-700 text-sm">
              <div className="font-medium text-zinc-100 mb-2">Simulation Result</div>
              {runResult.error ? (
                <div className="text-red-400/80">{String(runResult.error)}</div>
              ) : (
                <div className="space-y-3">
                  {(runResult.percentiles as Record<string, number>) && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-zinc-200">
                      <div>P50 Failed: {(runResult.percentiles as Record<string, number>)?.institutions_failed_p50 ?? '—'}</div>
                      <div>P95 Failed: {(runResult.percentiles as Record<string, number>)?.institutions_failed_p95 ?? '—'}</div>
                      <div>Collapse Prob: {((runResult.probability_systemic_collapse as number) * 100)?.toFixed(1) ?? '—'}%</div>
                      <div>Runs: {runResult.monte_carlo_runs ?? '—'}</div>
                    </div>
                  )}
                  {(runResult.critical_path as string[])?.length > 0 && (
                    <div>
                      <div className="text-zinc-300 mb-1">Timeline</div>
                      <ol className="list-decimal list-inside space-y-1 text-zinc-200 max-h-32 overflow-auto">
                        {(runResult.critical_path as string[]).map((step, i) => (
                          <li key={i}>{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}
                  {(runResult.intervention_recommendations as Array<{ action: string }>)?.length > 0 && (
                    <div>
                      <div className="text-zinc-300 mb-1">Intervention Recommendations</div>
                      <ul className="list-disc list-inside text-zinc-200">
                        {(runResult.intervention_recommendations as Array<{ action: string }>).map((r, i) => (
                          <li key={i}>{r.action}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </motion.section>

        {/* Module C: Intervention Simulator */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-md bg-zinc-800 border border-zinc-700 p-6"
        >
          <h2 className="flex items-center gap-2 text-lg font-medium text-zinc-100 mb-4">
            <AdjustmentsHorizontalIcon className="w-5 h-5" />
            Intervention Simulator
          </h2>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-zinc-300 mb-2">Scenario for optimization</label>
              <select
                value={selectedScenarioForOptimize ?? ''}
                onChange={(e) => setSelectedScenarioForOptimize(e.target.value || null)}
                className="w-full max-w-xs rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 text-zinc-100"
              >
                <option value="">— Select —</option>
                {scenarios.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
            <div>
              <div className="text-sm text-zinc-300 mb-2">Policy levers (monetary, macroprudential, market, coordination)</div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {levers.map((l) => (
                  <div key={l.name} className="flex justify-between items-center p-2 rounded bg-zinc-800 border border-zinc-700">
                    <span className="text-zinc-200 text-sm">{l.name}</span>
                    <span className="text-zinc-500 text-xs">{l.category} · eff. {(l.effectiveness * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
            <button
              type="button"
              onClick={handleOptimize}
              disabled={optimizing}
              className="px-4 py-2 rounded-md bg-zinc-600 hover:bg-zinc-500 text-zinc-100 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed transition-colors"
            >
              {optimizing ? 'Optimizing...' : 'Optimize Policy Mix'}
            </button>
            {optimizeResult && (
              <div className="p-4 rounded-md bg-zinc-800 border border-zinc-700">
                <div className="font-medium text-zinc-100 mb-2">Recommended Mix</div>
                {optimizeResult.error ? (
                  <div className="text-red-400/80">{String(optimizeResult.error)}</div>
                ) : (
                  <div className="space-y-2">
                    {(optimizeResult.recommended_mix as Array<{ day: number; action: string; effect: string }>)?.map((r, i) => (
                      <div key={i} className="text-sm text-zinc-200">
                        Day {r.day}: {r.action} — {r.effect}
                      </div>
                    ))}
                    {(optimizeResult.expected_outcome as Record<string, unknown>) && (
                      <div className="mt-3 pt-3 border-t border-zinc-700 text-zinc-300 text-sm">
                        Collapse prob: {(optimizeResult.expected_outcome as Record<string, number>)?.systemic_collapse_probability_before ?? 0} → {(optimizeResult.expected_outcome as Record<string, number>)?.systemic_collapse_probability_after ?? 0}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.section>

        {/* Cross-Border Pathways */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-md bg-zinc-800 border border-zinc-700 p-6"
        >
          <h2 className="flex items-center gap-2 text-lg font-medium text-zinc-100 mb-4">
            <ChartBarIcon className="w-5 h-5" />
            Cross-Border Contagion Pathways
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {Object.entries(crossBorder).map(([path, prob]) => (
              <div key={path} className="p-4 rounded-md bg-zinc-800 border border-zinc-700">
                <div className="text-zinc-200 text-sm">{path.replace(/_/g, ' → ')}</div>
                <div className="text-xl font-semibold text-zinc-100 mt-1">
                  {(prob * 100).toFixed(0)}%
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* Module D: Time-to-Impact Counters */}
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-md bg-zinc-800 border border-zinc-700 p-6"
        >
          <h2 className="flex items-center gap-2 text-lg font-medium text-zinc-100 mb-4">
            <ClockIcon className="w-5 h-5" />
            Time-to-Impact Counters
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-md bg-red-500/20 border border-red-500/30">
              <div className="text-red-300/80 font-medium">Immediate (&lt;7 days)</div>
              <ul className="mt-2 text-sm text-zinc-200">
                {timelines.immediate_threats.length === 0 && (
                  <li>No immediate threats</li>
                )}
                {timelines.immediate_threats.map((t, i) => (
                  <li key={i}>{t.name} — {t.days ?? '—'} days</li>
                ))}
              </ul>
            </div>
            <div className="p-4 rounded-md bg-orange-500/20 border border-orange-500/30">
              <div className="text-orange-300/80 font-medium">Elevated (7–30 days)</div>
              <ul className="mt-2 text-sm text-zinc-200">
                {timelines.elevated_threats.map((t, i) => (
                  <li key={i}>{t.name} — {t.days ?? '—'} days</li>
                ))}
              </ul>
            </div>
            <div className="p-4 rounded-md bg-yellow-500/20 border border-yellow-500/30">
              <div className="text-yellow-300/80 font-medium">Medium-term (30–90 days)</div>
              <ul className="mt-2 text-sm text-zinc-200">
                {timelines.medium_term_threats.map((t, i) => (
                  <li key={i}>{t.name}</li>
                ))}
                {timelines.medium_term_threats.length === 0 && <li>None</li>}
              </ul>
            </div>
          </div>
        </motion.section>
          </div>
        </div>
      </div>
    </AccessGate>
  )
}
