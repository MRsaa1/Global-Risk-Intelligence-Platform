/**
 * Stress Planner — Interactive stress testing tool
 *
 * Three-panel layout: config (left), results (center), action plan + cross-sector (right).
 * Calls POST /api/v1/stress-tests/universal and displays metrics, chart, timeline, zones, export.
 */
import { useState, useCallback, useEffect } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeftIcon, PlayIcon, DocumentArrowDownIcon, DocumentTextIcon } from '@heroicons/react/24/outline'
import { UNIVERSAL_ACTION_PLAN_TEMPLATE } from '../lib/universalActionPlanTemplate'
import { getSectorConfig, getScenarioConfig } from '../lib/stressPlannerConfig'
import { FORTUNE_500, formatLocation } from '../data/fortune500'
import { exportStressTestPdf } from '../lib/exportService'
import type { StressTestData, RiskZone, ActionPlan } from '../lib/exportService'

const API_BASE = '/api/v1'

// All sectors used in the project. API accepts: insurance, real_estate, financial, enterprise, defense.
// Extended sectors (6+) are mapped to the nearest API sector for real calculation.
const SECTOR_OPTIONS: { id: string; label: string; apiSector: string }[] = [
  { id: '1', label: 'Insurance', apiSector: 'insurance' },
  { id: '2', label: 'Real Estate', apiSector: 'real_estate' },
  { id: '3', label: 'Financial', apiSector: 'financial' },
  { id: '4', label: 'Enterprise', apiSector: 'enterprise' },
  { id: '5', label: 'Defense', apiSector: 'defense' },
  { id: '6', label: 'Infrastructure', apiSector: 'enterprise' },
  { id: '7', label: 'Government', apiSector: 'enterprise' },
  { id: '8', label: 'Healthcare', apiSector: 'insurance' },
  { id: '9', label: 'Energy', apiSector: 'enterprise' },
  { id: '10', label: 'Manufacturing', apiSector: 'enterprise' },
  { id: '11', label: 'Technology', apiSector: 'enterprise' },
  { id: '12', label: 'City / Region', apiSector: 'enterprise' },
]
const SECTOR_API_MAP: Record<string, string> = Object.fromEntries(
  SECTOR_OPTIONS.map((o) => [o.id, o.apiSector])
)
const SECTOR_LABELS: Record<string, string> = Object.fromEntries(
  SECTOR_OPTIONS.map((o) => [o.id, o.label])
)
// Template has only sectors 1–5; map extended sectors to template sector for action plan display
const SECTOR_TO_TEMPLATE_ID: Record<string, string> = {
  '1': '1', '2': '2', '3': '3', '4': '4', '5': '5',
  '6': '4', '7': '4', '8': '1', '9': '4', '10': '4', '11': '4', '12': '4',
}
// All scenario types supported by the project (API universal_stress_engine + StressTestType)
const SCENARIO_TYPES = [
  'flood',
  'seismic',
  'financial',
  'cyber',
  'pandemic',
  'supply_chain',
  'climate',
  'geopolitical',
  'regulatory',
  'energy',
  'fire',
  'political',
  'military',
  'social',
  'protest',
  'civil_unrest',
  'uprising',
]
const MONTE_CARLO_OPTIONS = [
  { value: 1000, label: '1k' },
  { value: 5000, label: '5k' },
  { value: 10000, label: '10k' },
  { value: 50000, label: '50k' },
]

const ESCALATION_LEVELS = [
  { max: 0.2, label: 'GREEN', sub: 'Normal', cls: 'bg-emerald-500/30 text-emerald-400 border-emerald-500/50' },
  { max: 0.4, label: 'YELLOW', sub: 'Elevated', cls: 'bg-amber-500/30 text-amber-400 border-amber-500/50' },
  { max: 0.6, label: 'ORANGE', sub: 'High', cls: 'bg-orange-500/30 text-orange-400 border-orange-500/50' },
  { max: 0.8, label: 'RED', sub: 'Critical', cls: 'bg-red-500/30 text-red-400 border-red-500/50' },
  { max: 1.01, label: 'BLACK', sub: 'Systemic', cls: 'bg-gray-800 text-gray-300 border-gray-600' },
]

function getEscalation(severity: number) {
  return ESCALATION_LEVELS.find((e) => severity < e.max) ?? ESCALATION_LEVELS[4]
}

export interface UniversalStressResult {
  test_id: string
  timestamp: string
  sector: string
  scenario_type: string
  severity: number
  executive_summary: Record<string, unknown>
  loss_distribution: {
    mean_loss: number
    median_loss: number
    std_dev: number
    var_95: number
    var_99: number
    cvar_99: number
    monte_carlo_runs: number
    percentiles?: Record<string, number>
  }
  timeline_analysis?: {
    rto_critical_hours: number
    rto_full_hours: number
    timeline_days: number
    phases?: Array<{ name: string; start_hours: number; end_hours: number; description?: string }>
  }
  cascade_analysis?: {
    amplification_factor: number
    direct_loss: number
    cascade_loss: number
    total_economic_impact: number
    cross_sector_transmission?: Record<string, number>
  }
  financial_contagion?: Record<string, unknown>
  report_v2?: Record<string, unknown>
  sector_metrics?: Record<string, unknown>
  model_metadata?: Record<string, unknown>
}

interface ConfigState {
  entityName: string
  location: string
  sectorId: string
  scenarioType: string
  severity: number
  totalExposureM: number
  numEntities: number
  monteCarlo: number
}

const defaultConfig: ConfigState = {
  entityName: '',
  location: '',
  sectorId: '1',
  scenarioType: 'flood',
  severity: 0.5,
  totalExposureM: 100,
  numEntities: 10,
  monteCarlo: 10000,
}

export default function StressPlannerPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const prefill = (location.state as { prefill?: { entityName?: string; location?: string; sectorId?: string; scenarioType?: string; severity?: number } })?.prefill

  const [config, setConfig] = useState<ConfigState>(defaultConfig)
  const [result, setResult] = useState<UniversalStressResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exportingPdf, setExportingPdf] = useState(false)

  useEffect(() => {
    if (!prefill) return
    setConfig((c) => ({
      ...c,
      ...(prefill.entityName != null && { entityName: prefill.entityName }),
      ...(prefill.location != null && { location: prefill.location }),
      ...(prefill.sectorId != null && { sectorId: prefill.sectorId }),
      ...(prefill.scenarioType != null && { scenarioType: prefill.scenarioType }),
      ...(prefill.severity != null && { severity: prefill.severity }),
    }))
  }, [prefill])

  const runStressTest = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const sectorApi = SECTOR_API_MAP[config.sectorId] ?? 'financial'
      const totalExposure = config.totalExposureM * 1_000_000
      const scenarioDesc = [config.entityName && `Entity: ${config.entityName}`, config.location && `Location: ${config.location}`].filter(Boolean).join('; ') || ''
      const res = await axios.post<UniversalStressResult>(`${API_BASE}/stress-tests/universal`, {
        sector: sectorApi,
        scenario_type: config.scenarioType,
        scenario_description: scenarioDesc,
        severity: config.severity,
        total_exposure: totalExposure,
        geographic_scope: config.location ? [config.location] : [],
        monte_carlo_simulations: config.monteCarlo,
        include_cascade: true,
        include_recovery: true,
      })
      const data = res?.data
      if (data?.loss_distribution) {
        setResult(data)
      } else {
        setError('API returned no loss distribution. Check that the API is running (e.g. port 9002).')
        setResult(null)
      }
    } catch (e) {
      const msg = axios.isAxiosError(e)
        ? (e.response?.data?.detail ?? (Array.isArray(e.response?.data?.detail) ? e.response?.data?.detail[0]?.msg : e.message))
        : 'Request failed'
      setError(typeof msg === 'string' ? msg : 'Stress test request failed. Is the API running on port 9002?')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }, [config])

  const handleExportPdf = async () => {
    if (!result) return
    setExportingPdf(true)
    try {
      const stressTestData: StressTestData = {
        name: `Stress Test ${result.scenario_type} (${result.sector})`,
        scenario_name: result.scenario_type,
        region_name: config.location || config.entityName || 'Universal',
        severity: result.severity,
        total_loss: result.loss_distribution.mean_loss,
        affected_assets_count: config.numEntities,
        nvidia_enhanced: true,
      }
      const zones: RiskZone[] = [
        {
          name: result.sector,
          zone_level: getEscalation(result.severity).label,
          zone_type: 'stress_planner',
          expected_loss: result.loss_distribution.mean_loss,
          risk_score: Math.round(result.severity * 100),
        },
      ]
      const sectorPlan = UNIVERSAL_ACTION_PLAN_TEMPLATE.sectors.find((s) => SECTOR_API_MAP[s.id] === result.sector)
      const actions: ActionPlan[] = sectorPlan
        ? sectorPlan.phases.flatMap((p) =>
            p.items.map((title) => ({
              title,
              priority: sectorPlan.criticality,
              timeline: p.name,
              risk_reduction: sectorPlan.riskReductionPercent,
            }))
          )
        : []
      await exportStressTestPdf(stressTestData, zones, actions)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'PDF export failed')
    } finally {
      setExportingPdf(false)
    }
  }

  const handleExportJson = () => {
    if (!result) return
    const payload = {
      config: { ...config, sectorLabel: SECTOR_LABELS[config.sectorId] },
      result,
      actionPlanSnippet: UNIVERSAL_ACTION_PLAN_TEMPLATE.sectors.find((s) => s.id === (SECTOR_TO_TEMPLATE_ID[config.sectorId] ?? config.sectorId)) ?? null,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `stress_planner_${result.test_id}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const sectorPlan = UNIVERSAL_ACTION_PLAN_TEMPLATE.sectors.find((s) => s.id === (SECTOR_TO_TEMPLATE_ID[config.sectorId] ?? config.sectorId))
  const escalation = getEscalation(config.severity)
  const crossSector = result?.cascade_analysis?.cross_sector_transmission ?? result?.report_v2?.financial_contagion
  const crossSectorData = crossSector
    ? [
        { label: 'Insurance', value: (crossSector as Record<string, number>).insurance ?? 0 },
        { label: 'Real Estate', value: (crossSector as Record<string, number>).real_estate ?? 0 },
        { label: 'Financial', value: (crossSector as Record<string, number>).financial ?? 0 },
        { label: 'Enterprise', value: (crossSector as Record<string, number>).enterprise ?? 0 },
        { label: 'Defense', value: (crossSector as Record<string, number>).defense ?? 0 },
      ]
    : []

  const maxCross = crossSectorData.length ? Math.max(...crossSectorData.map((d) => d.value), 1) : 1

  return (
    <div className="h-full flex flex-col bg-[#0a0e17] text-white">
      <header className="shrink-0 px-4 py-3 border-b border-white/10 bg-[#0a0f18] flex items-center gap-4">
        <Link to="/command" className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5" aria-label="Back">
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <h1 className="text-lg font-medium">Stress Planner</h1>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* Left: Config */}
        <div className="w-72 shrink-0 border-r border-white/10 bg-white/[0.02] p-4 flex flex-col gap-4 overflow-y-auto">
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/50 block mb-2">Entity name (Fortune 500)</label>
            <select
              value={
                FORTUNE_500.find(
                  (e) => e.name === config.entityName && formatLocation(e) === config.location
                )?.id ?? ''
              }
              onChange={(e) => {
                const id = e.target.value
                if (id) {
                  const entry = FORTUNE_500.find((x) => x.id === id)
                  if (entry) {
                    setConfig((c) => ({
                      ...c,
                      entityName: entry.name,
                      location: formatLocation(entry),
                    }))
                  }
                } else {
                  setConfig((c) => ({ ...c, entityName: '', location: '' }))
                }
              }}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50"
            >
              <option value="" className="bg-[#0a0f18] text-white">
                — Select entity —
              </option>
              {FORTUNE_500.map((entry) => (
                <option key={entry.id} value={entry.id} className="bg-[#0a0f18] text-white">
                  {entry.name} — {entry.city}, {entry.country}
                </option>
              ))}
            </select>
            {!FORTUNE_500.find((e) => e.name === config.entityName && formatLocation(e) === config.location) && (
              <input
                type="text"
                value={config.entityName}
                onChange={(e) => setConfig((c) => ({ ...c, entityName: e.target.value }))}
                placeholder="Or type custom entity name"
                className="mt-2 w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-amber-500/50"
              />
            )}
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/50 block mb-2">Location (city / country)</label>
            <input
              type="text"
              value={config.location}
              onChange={(e) => setConfig((c) => ({ ...c, location: e.target.value }))}
              placeholder="Auto from entity or e.g. Frankfurt, Germany"
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white placeholder-white/30 focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/50 block mb-2">Sector</label>
            <select
              value={config.sectorId}
              onChange={(e) => setConfig((c) => ({ ...c, sectorId: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50"
            >
              {SECTOR_OPTIONS.map((o) => (
                <option key={o.id} value={o.id} className="bg-[#0a0f18] text-white">
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/50 block mb-2">Scenario type</label>
            <select
              value={config.scenarioType}
              onChange={(e) => setConfig((c) => ({ ...c, scenarioType: e.target.value }))}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white focus:ring-1 focus:ring-amber-500/50 focus:border-amber-500/50"
            >
              {SCENARIO_TYPES.map((t) => (
                <option key={t} value={t} className="bg-[#0a0f18] text-white">
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/50 block mb-2">
              Severity {(config.severity * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={config.severity}
              onChange={(e) => setConfig((c) => ({ ...c, severity: Number(e.target.value) }))}
              className="w-full h-2 rounded-full bg-white/10 accent-amber-500"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/50 block mb-2">Total exposure (€M)</label>
            <input
              type="number"
              min={1}
              max={10000}
              value={config.totalExposureM}
              onChange={(e) => setConfig((c) => ({ ...c, totalExposureM: Number(e.target.value) || 1 }))}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/50 block mb-2">Number of entities</label>
            <input
              type="number"
              min={1}
              max={100}
              value={config.numEntities}
              onChange={(e) => setConfig((c) => ({ ...c, numEntities: Number(e.target.value) || 1 }))}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-wider text-white/50 block mb-2">Monte Carlo</label>
            <select
              value={config.monteCarlo}
              onChange={(e) => setConfig((c) => ({ ...c, monteCarlo: Number(e.target.value) }))}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white"
            >
              {MONTE_CARLO_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="bg-[#0a0f18]">
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={runStressTest}
            disabled={loading}
            className="mt-auto flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-400 font-medium disabled:opacity-50"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Running Monte Carlo…
              </>
            ) : (
              <>
                <PlayIcon className="w-4 h-4" />
                Run Stress Test
              </>
            )}
          </button>
        </div>

        {/* Center: Results */}
        <div className="flex-1 min-w-[480px] p-4 overflow-y-auto flex flex-col gap-4 relative">
          {loading && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded-lg">
              <div className="bg-[#0a0f18] border border-white/10 rounded-xl px-6 py-4 flex items-center gap-3">
                <svg className="w-6 h-6 animate-spin text-amber-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-white font-medium">Running Monte Carlo…</span>
              </div>
            </div>
          )}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}
          {result && (
            <>
              {(config.entityName || config.location) && (
                <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-2 flex flex-wrap items-center gap-3 text-sm">
                  <span className="text-white/50 uppercase tracking-wider text-[10px]">Run for</span>
                  {config.entityName && (
                    <span className="font-medium text-amber-300">{config.entityName}</span>
                  )}
                  {config.entityName && config.location && <span className="text-white/30">|</span>}
                  {config.location && (
                    <span className="text-white/80">{config.location}</span>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <MetricCard label="Severity" value={`${(result.severity * 100).toFixed(0)}%`} />
                <MetricCard label="Expected loss" value={`€${(result.loss_distribution.mean_loss / 1e6).toFixed(1)}M`} />
                <MetricCard label="VaR 99%" value={`€${(result.loss_distribution.var_99 / 1e6).toFixed(1)}M`} />
                <MetricCard
                  label="Cascade factor"
                  value={result.cascade_analysis ? `${result.cascade_analysis.amplification_factor.toFixed(2)}x` : '—'}
                />
                <MetricCard
                  label="Recovery time"
                  value={
                    result.timeline_analysis
                      ? `${result.timeline_analysis.rto_full_hours.toFixed(0)}h`
                      : '—'
                  }
                />
                <MetricCard
                  label="Model confidence"
                  value={result.model_metadata?.monte_carlo_simulations ? `${(result.model_metadata.monte_carlo_simulations / 1000).toFixed(0)}k runs` : '—'}
                />
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <h3 className="text-xs font-medium uppercase tracking-wider text-white/60 mb-3">Loss distribution</h3>
                <div className="flex items-end gap-2 h-24">
                  {(() => {
                    const pct = result.loss_distribution.percentiles;
                    const wanted = [50, 75, 90, 95, 99];
                    const getVal = (n: number) => pct?.[String(n)] ?? pct?.[`p${n}`];
                    const bars = wanted.map((n) => ({ n, v: getVal(n) })).filter((b) => b.v != null && b.v > 0);
                    if (bars.length === 0) {
                      return (
                        <div className="text-sm text-white/50 w-full text-center py-4">
                          Mean: €{(result.loss_distribution.mean_loss / 1e6).toFixed(1)}M • VaR99: €
                          {(result.loss_distribution.var_99 / 1e6).toFixed(1)}M
                        </div>
                      );
                    }
                    const scale = result.loss_distribution.var_99 || 1;
                    return bars.map(({ n, v }) => (
                      <div key={n} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full rounded-t bg-amber-500/40 min-h-[4px]"
                          style={{
                            height: `${Math.min(100, (v / scale) * 60)}%`,
                          }}
                        />
                        <span className="text-[10px] text-white/50">P{n}</span>
                      </div>
                    ));
                  })()}
                </div>
                <p className="text-[10px] text-white/40 mt-2">
                  Mean: €{(result.loss_distribution.mean_loss / 1e6).toFixed(1)}M • VaR99: €
                  {(result.loss_distribution.var_99 / 1e6).toFixed(1)}M
                </p>
              </div>
              {result.timeline_analysis?.phases && result.timeline_analysis.phases.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-white/60 mb-3">Impact timeline</h3>
                  <div className="space-y-2">
                    {result.timeline_analysis.phases.map((p, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <span className="text-white/50 w-20">T+{p.start_hours}h</span>
                        <span className="text-white/80">{p.name}</span>
                        {p.description && <span className="text-white/50 text-xs truncate">{p.description}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <h3 className="text-xs font-medium uppercase tracking-wider text-white/60 mb-3">Risk zones</h3>
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-b border-white/10">
                        <th className="text-left py-3 pr-4 text-white/50 font-medium whitespace-nowrap">Zone</th>
                        <th className="text-left py-3 pr-4 text-white/50 font-medium whitespace-nowrap">Risk level</th>
                        <th className="text-right py-3 pr-4 text-white/50 font-medium whitespace-nowrap">Entities</th>
                        <th className="text-right py-3 text-white/50 font-medium whitespace-nowrap">Expected loss</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-white/5">
                        <td className="py-3 pr-4 text-white/80">{result.sector}</td>
                        <td className="py-3 pr-4">{getEscalation(result.severity).label}</td>
                        <td className="py-3 pr-4 text-right text-white/70">{config.numEntities}</td>
                        <td className="py-3 text-right text-white/70 whitespace-nowrap">
                          €{(result.loss_distribution.mean_loss / 1e6).toFixed(1)}M
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* AI Executive Summary */}
              {result.executive_summary && Object.keys(result.executive_summary).length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-white/60 mb-3">AI Executive Summary</h3>
                  <div className="text-sm text-white/80 space-y-2">
                    {typeof result.executive_summary.headline === 'string' && (
                      <p className="font-medium text-white/90">{result.executive_summary.headline}</p>
                    )}
                    {Array.isArray(result.executive_summary.bullets) &&
                      result.executive_summary.bullets.map((b: string, i: number) => (
                        <p key={i} className="flex gap-2">
                          <span className="text-amber-400">•</span>
                          <span>{b}</span>
                        </p>
                      ))}
                    {!result.executive_summary.headline && !Array.isArray(result.executive_summary.bullets) && (
                      <pre className="text-xs text-white/70 whitespace-pre-wrap">
                        {JSON.stringify(result.executive_summary, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              {/* Sector-specific metrics (from config; values from API when available) */}
              {getSectorConfig(config.sectorId) && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-white/60 mb-3">
                    Sector metrics — {SECTOR_LABELS[config.sectorId]}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {getSectorConfig(config.sectorId)!.metrics.map((key) => {
                      const label = getSectorConfig(config.sectorId)!.metricsLabels[key] ?? key
                      const value = result.sector_metrics && typeof result.sector_metrics === 'object' && key in result.sector_metrics
                        ? String((result.sector_metrics as Record<string, unknown>)[key])
                        : '—'
                      return (
                        <div key={key} className="rounded-lg bg-white/5 px-3 py-2">
                          <div className="text-[10px] uppercase text-white/50">{label}</div>
                          <div className="text-sm font-medium text-white/90">{value}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Scenario-specific predictive indicators */}
              {getScenarioConfig(config.scenarioType) && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-white/60 mb-3">
                    Predictive indicators — {config.scenarioType}
                  </h3>
                  <ul className="text-sm text-white/70 space-y-1">
                    {getScenarioConfig(config.scenarioType)!.indicators.map((ind) => {
                      const label = getScenarioConfig(config.scenarioType)!.indicatorsLabels[ind] ?? ind
                      return <li key={ind}>{label}</li>
                    })}
                  </ul>
                  <div className="mt-2 pt-2 border-t border-white/10 text-[10px] text-white/50">
                    Thresholds: Amber &lt; {getScenarioConfig(config.scenarioType)!.thresholds.amber} → Red &lt; {getScenarioConfig(config.scenarioType)!.thresholds.red} → Black
                  </div>
                </div>
              )}

              {/* Regulatory compliance */}
              {getSectorConfig(config.sectorId)?.regulations && getSectorConfig(config.sectorId)!.regulations.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-white/60 mb-3">Regulatory compliance</h3>
                  <div className="flex flex-wrap gap-2">
                    {getSectorConfig(config.sectorId)!.regulations.map((r) => (
                      <span key={r} className="px-2 py-1 rounded bg-white/5 text-xs text-white/70 border border-white/10">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sensitivity analysis placeholder */}
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                <h3 className="text-xs font-medium uppercase tracking-wider text-white/60 mb-3">Sensitivity analysis</h3>
                <p className="text-sm text-white/70">
                  +20% severity → approx. +{(result.severity * 100 * 0.2).toFixed(0)}% stress factor; loss scale is non-linear (Monte Carlo). Re-run with different severity to compare.
                </p>
              </div>

              {/* Historical comparison */}
              {getScenarioConfig(config.scenarioType)?.historicalEvents && getScenarioConfig(config.scenarioType)!.historicalEvents.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
                  <h3 className="text-xs font-medium uppercase tracking-wider text-white/60 mb-3">Historical comparison</h3>
                  <p className="text-[10px] text-white/50 mb-2">Comparable past events for this scenario type:</p>
                  <div className="flex flex-wrap gap-2">
                    {getScenarioConfig(config.scenarioType)!.historicalEvents.map((ev) => (
                      <span key={ev} className="px-2 py-1 rounded bg-amber-500/10 text-xs text-amber-300/90 border border-amber-500/20">
                        {ev}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={exportingPdf}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm disabled:opacity-50"
                >
                  <DocumentArrowDownIcon className="w-4 h-4" />
                  {exportingPdf ? 'Exporting…' : 'Export PDF'}
                </button>
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-sm"
                >
                  <DocumentTextIcon className="w-4 h-4" />
                  Export JSON
                </button>
                <button
                  type="button"
                  onClick={() =>
                    navigate('/bcp-generator', {
                      state: {
                        prefill: {
                          entityName: config.entityName || undefined,
                          location: config.location || undefined,
                          sectorId: config.sectorId,
                          scenarioType: result.scenario_type,
                          severity: result.severity,
                        },
                      },
                    })
                  }
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-sm"
                >
                  <DocumentTextIcon className="w-4 h-4" />
                  Generate BCP from this scenario
                </button>
              </div>
            </>
          )}
          {!result && !loading && !error && (
            <div className="flex-1 flex items-center justify-center text-white/40 text-sm">
              Configure parameters and run a stress test to see results.
            </div>
          )}
        </div>

        {/* Right: Action plan + cross-sector */}
        <div className="w-80 shrink-0 border-l border-white/10 bg-white/[0.02] p-4 flex flex-col gap-4 overflow-y-auto">
          <div className={`rounded-lg border px-3 py-2 text-center ${escalation.cls}`}>
            <div className="text-xs font-bold uppercase">{escalation.label}</div>
            <div className="text-[10px] opacity-90">{escalation.sub}</div>
          </div>
          {sectorPlan && (
            <div className="space-y-3">
              <h3 className="text-[10px] uppercase tracking-wider text-white/50">Action plan — {sectorPlan.sector}</h3>
              {sectorPlan.phases.map((phase, pi) => (
                <div key={pi} className="rounded-lg border border-white/10 overflow-hidden">
                  <div className="px-3 py-2 bg-white/5 text-[11px] font-medium text-white/80 border-b border-white/5">
                    {phase.name}
                  </div>
                  <ul className="px-3 py-2 space-y-1">
                    {phase.items.slice(0, 4).map((item, ii) => (
                      <li key={ii} className="flex items-start gap-2 text-[11px] text-white/70">
                        <span className="text-white/40">├</span>
                        <span>{item}</span>
                      </li>
                    ))}
                    {phase.items.length > 4 && (
                      <li className="text-[10px] text-white/40">+{phase.items.length - 4} more</li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          )}
          {crossSectorData.length > 0 && (
            <div>
              <h3 className="text-[10px] uppercase tracking-wider text-white/50 mb-2">Cross-sector impact</h3>
              <div className="space-y-2">
                {crossSectorData.map((d) => (
                  <div key={d.label} className="flex items-center gap-2">
                    <span className="text-[11px] text-white/70 w-24 truncate">{d.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-amber-500/60"
                        style={{ width: `${(d.value / maxCross) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-white/50 w-14 text-right shrink-0">
                      {d.value >= 1e6 ? `€${(d.value / 1e6).toFixed(1)}M` : d.value.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-white/50">{label}</div>
      <div className="text-sm font-medium text-white mt-0.5">{value}</div>
    </div>
  )
}
