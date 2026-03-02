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
import { getSectorConfig, getScenarioConfig, SECTOR_ID_TO_KEY, SECTOR_METRICS_API_KEY_MAP } from '../lib/stressPlannerConfig'
import { FORTUNE_500, formatLocation } from '../data/fortune500'
import { exportStressTestPdf } from '../lib/exportService'
import type { StressTestData, RiskZone, ActionPlan } from '../lib/exportService'
import SendToARINButton from '../components/SendToARINButton'
import ARINVerdictBadge from '../components/ARINVerdictBadge'
import { getApiV1Base } from '../config/env'

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
  { value: 100000, label: '100k' },
]

const ESCALATION_LEVELS = [
  { max: 0.2, label: 'GREEN', sub: 'Normal', cls: 'bg-emerald-500/30 text-emerald-400/80 border-emerald-500/50' },
  { max: 0.4, label: 'YELLOW', sub: 'Elevated', cls: 'bg-amber-500/30 text-amber-400/80 border-amber-500/50' },
  { max: 0.6, label: 'ORANGE', sub: 'High', cls: 'bg-orange-500/30 text-orange-400/80 border-orange-500/50' },
  { max: 0.8, label: 'RED', sub: 'Critical', cls: 'bg-red-500/30 text-red-400/80 border-red-500/50' },
  { max: 1.01, label: 'BLACK', sub: 'Systemic', cls: 'bg-zinc-800 text-zinc-300 border-zinc-600' },
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
  regime_used?: string
  regime_parameters?: Record<string, unknown>
  historical_scenario_id?: string
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
    methodology?: string
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
  predictive_indicators?: Record<string, unknown>
}

const REGIME_OPTIONS = [
  { value: 'auto', label: 'Auto-Detect' },
  { value: 'bull', label: 'Bull Expansion' },
  { value: 'late_cycle', label: 'Late Cycle' },
  { value: 'crisis', label: 'Crisis' },
  { value: 'stagflation', label: 'Stagflation' },
]

interface ConfigState {
  entityName: string
  location: string
  sectorId: string
  scenarioType: string
  severity: number
  totalExposureM: number
  numEntities: number
  monteCarlo: number
  marketRegime: string
  distribution: string
  degreesOfFreedom: number
  historicalScenarioId: string
}

const defaultConfig: ConfigState = {
  entityName: '',
  location: '',
  sectorId: '1',
  scenarioType: 'flood',
  severity: 0.5,
  totalExposureM: 100,
  numEntities: 10,
  monteCarlo: 100000,
  marketRegime: 'auto',
  distribution: 'gaussian',
  degreesOfFreedom: 5,
  historicalScenarioId: '',
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
      const apiBase = getApiV1Base()
      const res = await axios.post<UniversalStressResult>(`${apiBase}/stress-tests/universal`, {
        sector: sectorApi,
        scenario_type: config.scenarioType,
        scenario_description: scenarioDesc,
        severity: config.severity,
        total_exposure: totalExposure,
        geographic_scope: config.location ? [config.location] : [],
        monte_carlo_simulations: config.monteCarlo,
        include_cascade: true,
        include_recovery: true,
        market_regime: config.marketRegime || 'auto',
        distribution: config.distribution,
        degrees_of_freedom: config.degreesOfFreedom,
        ...(config.historicalScenarioId ? { historical_scenario_id: config.historicalScenarioId } : {}),
      })
      const data = res?.data
      if (data?.loss_distribution) {
        setResult(data)
      } else {
        setError('The API responded but did not include loss distribution. If using a tunnel (e.g. frontend on 15180), ensure the API URL is set (e.g. ?api=http://127.0.0.1:19002) and the API is running on port 9002.')
        setResult(null)
      }
    } catch (e) {
      const msg = axios.isAxiosError(e)
        ? (e.response?.data?.detail ?? (Array.isArray(e.response?.data?.detail) ? e.response?.data?.detail[0]?.msg : e.message))
        : 'Request failed'
      setError(typeof msg === 'string' ? msg : 'Stress test request failed. If using a tunnel, ensure ?api= points to the API (e.g. port 19002) and the API is running on port 9002.')
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
  const crossSectorTransmission = result?.cascade_analysis?.cross_sector_transmission
  const crossSectorData = crossSectorTransmission
    ? [
        { label: 'Insurance', value: (crossSectorTransmission as Record<string, number>).insurance ?? 0 },
        { label: 'Real Estate', value: (crossSectorTransmission as Record<string, number>).real_estate ?? 0 },
        { label: 'Financial', value: (crossSectorTransmission as Record<string, number>).financial ?? 0 },
        { label: 'Enterprise', value: (crossSectorTransmission as Record<string, number>).enterprise ?? 0 },
        { label: 'Defense', value: (crossSectorTransmission as Record<string, number>).defense ?? 0 },
      ]
    : []

  const maxCross = crossSectorData.length ? Math.max(...crossSectorData.map((d) => d.value), 1) : 1

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-100">
      <header className="shrink-0 px-4 py-3 border-b border-zinc-800/60 bg-zinc-950 flex items-center gap-4">
        <Link to="/command" className="p-2 rounded-md border border-transparent text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800/80 hover:border-zinc-700" aria-label="Back">
          <ArrowLeftIcon className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-lg font-display font-semibold text-zinc-100 tracking-tight">Stress Planner</h1>
          <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-0.5">Configure and run stress tests</p>
        </div>
      </header>

      {/* Historical Scenario Replay bar */}
      <div className="shrink-0 px-4 py-2 border-b border-zinc-800 bg-zinc-900/50 flex items-center gap-2 overflow-x-auto">
        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 whitespace-nowrap mr-1">Replay Crisis:</span>
        {[
          { id: 'gfc_2008', label: '2008 GFC', severity: 0.90, regime: 'crisis', scenario: 'financial' },
          { id: 'covid_2020', label: 'COVID-19', severity: 0.85, regime: 'crisis', scenario: 'pandemic' },
          { id: 'euro_crisis_2010', label: 'Euro Crisis', severity: 0.70, regime: 'crisis', scenario: 'financial' },
          { id: 'rate_shock_2022', label: 'Rate Shock', severity: 0.65, regime: 'late_cycle', scenario: 'financial' },
          { id: 'energy_crisis_2022', label: 'Energy Crisis', severity: 0.70, regime: 'stagflation', scenario: 'energy' },
          { id: 'china_shock_2015', label: 'China Shock', severity: 0.55, regime: 'late_cycle', scenario: 'financial' },
          { id: 'gfc_extreme', label: 'GFC x1.5', severity: 0.98, regime: 'crisis', scenario: 'financial' },
        ].map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => {
              setConfig((c) => ({
                ...c,
                severity: s.severity,
                marketRegime: s.regime,
                scenarioType: s.scenario,
                historicalScenarioId: s.id,
              }))
            }}
            className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
              config.historicalScenarioId === s.id
                ? 'bg-indigo-500/20 text-indigo-400/80 border-indigo-500/30'
                : 'bg-zinc-900/80 text-zinc-400 border-zinc-800/60 hover:bg-zinc-800 hover:text-zinc-200'
            }`}
          >
            {s.label}
          </button>
        ))}
        {config.historicalScenarioId && (
          <button
            type="button"
            onClick={() => setConfig((c) => ({ ...c, historicalScenarioId: '' }))}
            className="shrink-0 px-2 py-1.5 rounded-md text-xs text-zinc-500 hover:text-zinc-300"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Left: Config */}
        <div className="w-72 shrink-0 border-r border-zinc-800/60 bg-zinc-900/50 p-4 flex flex-col gap-4 overflow-y-auto">
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-2">Entity name (Fortune 500)</label>
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
              className="w-full px-3 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-sm text-zinc-100 font-sans focus:ring-1 focus:ring-zinc-500 focus:border-zinc-500"
            >
              <option value="" className="bg-zinc-950 text-zinc-100">
                — Select entity —
              </option>
              {FORTUNE_500.map((entry) => (
                <option key={entry.id} value={entry.id} className="bg-zinc-950 text-zinc-100">
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
                className="mt-2 w-full px-3 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-sm text-zinc-100 placeholder-zinc-500 font-sans focus:ring-1 focus:ring-zinc-500"
              />
            )}
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-2">Location (city / country)</label>
            <input
              type="text"
              value={config.location}
              onChange={(e) => setConfig((c) => ({ ...c, location: e.target.value }))}
              placeholder="Auto from entity or e.g. Frankfurt, Germany"
              className="w-full px-3 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-sm text-zinc-100 placeholder-zinc-500 font-sans focus:ring-1 focus:ring-zinc-500 focus:border-zinc-500"
            />
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-2">Sector</label>
            <select
              value={config.sectorId}
              onChange={(e) => setConfig((c) => ({ ...c, sectorId: e.target.value }))}
              className="w-full px-3 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-sm text-zinc-100 font-sans focus:ring-1 focus:ring-zinc-500 focus:border-zinc-500"
            >
              {SECTOR_OPTIONS.map((o) => (
                <option key={o.id} value={o.id} className="bg-zinc-950 text-zinc-100">
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-2">Scenario type</label>
            <select
              value={config.scenarioType}
              onChange={(e) => setConfig((c) => ({ ...c, scenarioType: e.target.value }))}
              className="w-full px-3 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-sm text-zinc-100 font-sans focus:ring-1 focus:ring-zinc-500 focus:border-zinc-500"
            >
              {SCENARIO_TYPES.map((t) => (
                <option key={t} value={t} className="bg-zinc-950 text-zinc-100">
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-2">
              Severity {(config.severity * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={config.severity}
              onChange={(e) => setConfig((c) => ({ ...c, severity: Number(e.target.value) }))}
              className="w-full h-2 rounded-full bg-zinc-800 accent-zinc-500"
            />
          </div>
          {/* Regime selector */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-2">Market Regime</label>
            <select
              value={config.marketRegime}
              onChange={(e) => setConfig((c) => ({ ...c, marketRegime: e.target.value }))}
              className="w-full px-3 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-sm text-zinc-100 font-sans focus:ring-1 focus:ring-zinc-500 focus:border-zinc-500"
            >
              {REGIME_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="bg-zinc-950 text-zinc-100">
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          {/* Distribution toggle + DoF */}
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-2 flex items-center gap-2">
              <span>Fat Tails (Student-t)</span>
              <input
                type="checkbox"
                checked={config.distribution === 'student_t'}
                onChange={(e) =>
                  setConfig((c) => ({ ...c, distribution: e.target.checked ? 'student_t' : 'gaussian' }))
                }
                className="accent-zinc-500"
              />
            </label>
            {config.distribution === 'student_t' && (
              <div className="mt-1">
                <label className="text-[10px] uppercase tracking-wider text-zinc-600 block mb-1">
                  Degrees of freedom: {config.degreesOfFreedom} {config.degreesOfFreedom <= 4 ? '(very fat)' : config.degreesOfFreedom <= 8 ? '(moderate)' : '(near-Gaussian)'}
                </label>
                <input
                  type="range"
                  min={2}
                  max={30}
                  step={1}
                  value={config.degreesOfFreedom}
                  onChange={(e) => setConfig((c) => ({ ...c, degreesOfFreedom: Number(e.target.value) }))}
                  className="w-full h-2 rounded-full bg-zinc-800 accent-zinc-500"
                />
              </div>
            )}
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-2">Total exposure (€M)</label>
            <input
              type="number"
              min={1}
              max={10000}
              value={config.totalExposureM}
              onChange={(e) => setConfig((c) => ({ ...c, totalExposureM: Number(e.target.value) || 1 }))}
              className="w-full px-3 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-sm text-zinc-100 font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-2">Number of entities</label>
            <input
              type="number"
              min={1}
              max={100}
              value={config.numEntities}
              onChange={(e) => setConfig((c) => ({ ...c, numEntities: Number(e.target.value) || 1 }))}
              className="w-full px-3 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-sm text-zinc-100 font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-2">Monte Carlo</label>
            <select
              value={config.monteCarlo}
              onChange={(e) => setConfig((c) => ({ ...c, monteCarlo: Number(e.target.value) }))}
              className="w-full px-3 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-sm text-zinc-100 font-sans"
            >
              {MONTE_CARLO_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} className="bg-zinc-950">
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={runStressTest}
            disabled={loading}
            className="mt-auto flex items-center justify-center gap-2 px-4 py-3 rounded-md bg-zinc-800 border border-zinc-800/60 text-zinc-100 font-medium hover:bg-zinc-700 disabled:opacity-50"
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
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center z-10 rounded-md">
              <div className="bg-zinc-950 border border-zinc-800/60 rounded-md px-6 py-4 flex items-center gap-3">
                <svg className="w-6 h-6 animate-spin text-zinc-400" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <span className="text-zinc-100 font-medium">Running Monte Carlo…</span>
              </div>
            </div>
          )}
          {error && (
            <div className="rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400/80">
              {error}
            </div>
          )}
          {result && (
            <>
              {(config.entityName || config.location) && (
                <div className="rounded-md border border-zinc-800/60 bg-zinc-900/80 px-4 py-2 flex flex-wrap items-center gap-3 text-sm">
                  <span className="font-mono text-zinc-500 uppercase tracking-widest text-[10px]">Run for</span>
                  {config.entityName && (
                    <span className="font-medium text-zinc-300">{config.entityName}</span>
                  )}
                  {config.entityName && config.location && <span className="text-zinc-600">|</span>}
                  {config.location && (
                    <span className="text-zinc-200">{config.location}</span>
                  )}
                </div>
              )}
              {/* Regime & distribution badges */}
              <div className="flex flex-wrap items-center gap-2">
                {result.regime_used && (
                  <span className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium border ${
                    result.regime_used === 'crisis'
                      ? 'bg-red-500/20 text-red-400/80 border-red-500/40'
                      : result.regime_used === 'stagflation'
                        ? 'bg-orange-500/20 text-orange-400/80 border-orange-500/40'
                        : result.regime_used === 'late_cycle'
                          ? 'bg-amber-500/20 text-amber-400/80 border-amber-500/40'
                          : 'bg-emerald-500/20 text-emerald-400/80 border-emerald-500/40'
                  }`}>
                    Regime: {(result.regime_parameters as Record<string, string>)?.label || result.regime_used}
                  </span>
                )}
                {result.loss_distribution.methodology && (
                  <span className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium border bg-zinc-900/80 text-zinc-300 border-zinc-800/60">
                    {result.loss_distribution.methodology}
                  </span>
                )}
                {result.historical_scenario_id && (
                  <span className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium border bg-indigo-500/20 text-indigo-400 border-indigo-500/40">
                    Historical: {result.historical_scenario_id}
                  </span>
                )}
              </div>
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
                  value={
                    (typeof result.model_metadata?.monte_carlo_simulations === 'number' && result.model_metadata.monte_carlo_simulations > 0)
                      ? `${(result.model_metadata.monte_carlo_simulations / 1000).toFixed(0)}k runs`
                      : (typeof result.loss_distribution?.monte_carlo_runs === 'number' && result.loss_distribution.monte_carlo_runs > 0)
                        ? `${(result.loss_distribution.monte_carlo_runs / 1000).toFixed(0)}k runs`
                        : (typeof config.monteCarlo === 'number' && config.monteCarlo > 0)
                          ? `${(config.monteCarlo / 1000).toFixed(0)}k runs`
                          : '—'
                  }
                />
              </div>
              <div className="rounded-md border border-zinc-800/60 bg-zinc-900/50 p-4">
                <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Loss distribution</h3>
                <div className="flex items-end gap-2 h-24">
                  {(() => {
                    const pct = result.loss_distribution.percentiles;
                    const wanted = [50, 75, 95];
                    const getVal = (n: number) => pct?.[String(n)] ?? pct?.[`p${n}`];
                    const bars = wanted.map((n) => ({ n, v: getVal(n) })).filter((b) => b.v != null && b.v > 0);
                    if (bars.length === 0) {
                      return (
                        <div className="text-sm text-zinc-500 w-full text-center py-4">
                          Mean: €{(result.loss_distribution.mean_loss / 1e6).toFixed(1)}M • VaR99: €
                          {(result.loss_distribution.var_99 / 1e6).toFixed(1)}M
                        </div>
                      );
                    }
                    const scale = result.loss_distribution.var_99 || 1;
                    return bars.map(({ n, v }) => (
                      <div key={n} className="flex-1 flex flex-col items-center gap-1">
                        <div
                          className="w-full rounded-t bg-zinc-600 min-h-[4px]"
                          style={{
                            height: `${Math.min(100, ((v ?? 0) / scale) * 60)}%`,
                          }}
                        />
                        <span className="text-[10px] text-zinc-500">P{n}</span>
                      </div>
                    ));
                  })()}
                </div>
                <p className="text-[10px] text-zinc-500 mt-2">
                  Mean: €{(result.loss_distribution.mean_loss / 1e6).toFixed(1)}M • VaR99: €
                  {(result.loss_distribution.var_99 / 1e6).toFixed(1)}M
                </p>
              </div>
              {result.timeline_analysis?.phases && result.timeline_analysis.phases.length > 0 && (
                <div className="rounded-md border border-zinc-800/60 bg-zinc-900/50 p-4">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Impact timeline</h3>
                  <div className="space-y-2">
                    {result.timeline_analysis.phases.map((p, i) => (
                      <div key={i} className="flex items-center gap-3 text-sm">
                        <span className="text-zinc-500 w-20">T+{p.start_hours}h</span>
                        <span className="text-zinc-200">{p.name}</span>
                        {p.description && <span className="text-zinc-500 text-xs truncate">{p.description}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="rounded-md border border-zinc-800/60 bg-zinc-900/50 p-4">
                <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Risk zones</h3>
                <div className="overflow-x-auto -mx-1">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800/60">
                        <th className="text-left py-3 pr-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500 whitespace-nowrap">Zone</th>
                        <th className="text-left py-3 pr-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500 whitespace-nowrap">Risk level</th>
                        <th className="text-right py-3 pr-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500 whitespace-nowrap">Entities</th>
                        <th className="text-right py-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500 whitespace-nowrap">Expected loss</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr className="border-b border-zinc-800">
                        <td className="py-3 pr-4 text-zinc-200">{result.sector}</td>
                        <td className="py-3 pr-4">{getEscalation(result.severity).label}</td>
                        <td className="py-3 pr-4 text-right text-zinc-300">{config.numEntities}</td>
                        <td className="py-3 text-right text-zinc-300 whitespace-nowrap">
                          €{(result.loss_distribution.mean_loss / 1e6).toFixed(1)}M
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* AI Executive Summary */}
              {result.executive_summary && Object.keys(result.executive_summary).length > 0 && (
                <div className="rounded-md border border-zinc-800/60 bg-zinc-900/50 p-4">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">AI Executive Summary</h3>
                  <div className="text-sm text-zinc-200 space-y-2">
                    {typeof result.executive_summary.headline === 'string' && (
                      <p className="font-medium text-zinc-100">{result.executive_summary.headline}</p>
                    )}
                    {Array.isArray(result.executive_summary.bullets) &&
                      result.executive_summary.bullets.map((b: string, i: number) => (
                        <p key={i} className="flex gap-2">
                          <span className="text-zinc-400">•</span>
                          <span>{b}</span>
                        </p>
                      ))}
                    {!result.executive_summary.headline && !Array.isArray(result.executive_summary.bullets) && (
                      <pre className="text-xs text-zinc-300 whitespace-pre-wrap">
                        {JSON.stringify(result.executive_summary, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              {/* Sector-specific metrics (from config; values from API when available) */}
              {getSectorConfig(config.sectorId) && (
                <div className="rounded-md border border-zinc-800/60 bg-zinc-900/50 p-4">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">
                    Sector metrics — {SECTOR_LABELS[config.sectorId]}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {getSectorConfig(config.sectorId)!.metrics.map((key) => {
                      const sectorKey = SECTOR_ID_TO_KEY[config.sectorId]
                      const apiKey = (sectorKey && SECTOR_METRICS_API_KEY_MAP[sectorKey]?.[key]) ?? key
                      const label = getSectorConfig(config.sectorId)!.metricsLabels[key] ?? key
                      const raw = result.sector_metrics && typeof result.sector_metrics === 'object' && apiKey in result.sector_metrics
                        ? (result.sector_metrics as Record<string, unknown>)[apiKey]
                        : null
                      let value: string
                      if (raw == null) value = '—'
                      else if (typeof raw === 'number') {
                        if (Math.abs(raw) >= 1e6) value = `€${(raw / 1e6).toFixed(2)}M`
                        else if (Math.abs(raw) >= 1e3) value = `€${(raw / 1e3).toFixed(1)}k`
                        else if (Number.isInteger(raw)) value = String(raw)
                        else value = (raw as number).toFixed(4)
                      } else value = String(raw)
                      return (
                        <div key={key} className="rounded-md bg-zinc-900/80 border border-zinc-800/60 px-3 py-2">
                          <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
                          <div className="text-sm font-medium text-zinc-100">{value}</div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Scenario-specific predictive indicators */}
              {getScenarioConfig(config.scenarioType) && (
                <div className="rounded-md border border-zinc-800/60 bg-zinc-900/50 p-4">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">
                    Predictive indicators — {config.scenarioType}
                  </h3>
                  {result.predictive_indicators && typeof result.predictive_indicators === 'object' && Object.keys(result.predictive_indicators).length > 0 ? (
                    <div className="space-y-2">
                      {Object.entries(result.predictive_indicators).map(([k, v]) => {
                        let display: string
                        if (Array.isArray(v)) {
                          display = v.every((x) => typeof x !== 'object' || x === null)
                            ? (v as unknown[]).map((x) => String(x)).join(', ')
                            : v.map((x) => (typeof x === 'object' && x !== null ? JSON.stringify(x) : String(x))).join(' · ')
                        } else if (typeof v === 'object' && v !== null) {
                          display = JSON.stringify(v)
                        } else {
                          display = String(v ?? '')
                        }
                        return (
                          <div key={k} className="flex justify-between gap-2 text-sm">
                            <span className="text-zinc-500 capitalize shrink-0">{k.replace(/_/g, ' ')}</span>
                            <span className="text-zinc-200 font-medium text-right break-words max-w-[70%]">{display}</span>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <ul className="text-sm text-zinc-300 space-y-1">
                      {getScenarioConfig(config.scenarioType)!.indicators.map((ind) => {
                        const label = getScenarioConfig(config.scenarioType)!.indicatorsLabels[ind] ?? ind
                        return <li key={ind}>{label}</li>
                      })}
                    </ul>
                  )}
                  <div className="mt-2 pt-2 border-t border-zinc-800/60 font-mono text-[10px] text-zinc-500">
                    Thresholds: Amber &lt; {getScenarioConfig(config.scenarioType)!.thresholds.amber} → Red &lt; {getScenarioConfig(config.scenarioType)!.thresholds.red} → Black
                  </div>
                </div>
              )}

              {/* Regulatory compliance */}
              {getSectorConfig(config.sectorId)?.regulations && getSectorConfig(config.sectorId)!.regulations.length > 0 && (
                <div className="rounded-md border border-zinc-800/60 bg-zinc-900/50 p-4">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Regulatory compliance</h3>
                  <div className="flex flex-wrap gap-2">
                    {getSectorConfig(config.sectorId)!.regulations.map((r) => (
                      <span key={r} className="px-2 py-1 rounded bg-zinc-900/80 text-xs text-zinc-300 border border-zinc-800/60">
                        {r}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Sensitivity analysis — illustrative */}
              <div className="rounded-md border border-zinc-800/60 bg-zinc-900/50 p-4">
                <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Sensitivity analysis</h3>
                <p className="text-sm text-zinc-300">
                  Illustrative: +20% severity would increase stress factor roughly proportionally. Loss scale is non-linear (Monte Carlo). Re-run with different severity to compare.
                </p>
              </div>

              {/* Historical comparison */}
              {getScenarioConfig(config.scenarioType)?.historicalEvents && getScenarioConfig(config.scenarioType)!.historicalEvents.length > 0 && (
                <div className="rounded-md border border-zinc-800/60 bg-zinc-900/50 p-4">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Historical comparison</h3>
                  <p className="font-mono text-[10px] text-zinc-500 mb-2">Comparable past events for this scenario type:</p>
                  <div className="flex flex-wrap gap-2">
                    {getScenarioConfig(config.scenarioType)!.historicalEvents.map((ev) => (
                      <span key={ev} className="px-2 py-1 rounded bg-zinc-900/80 text-xs text-zinc-300/90 border border-zinc-800/60">
                        {ev}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap gap-2">
                <SendToARINButton
                  sourceModule="stress_test"
                  objectType="scenario"
                  objectId={result.test_id ?? `stress-planner-${config.sectorId}-${config.scenarioType}`}
                  inputData={{
                    sector: result.sector,
                    scenario_type: result.scenario_type,
                    severity: result.severity,
                    mean_loss: result.loss_distribution?.mean_loss,
                    executive_summary: result.executive_summary,
                  }}
                  exportEntityId="portfolio_global"
                  exportEntityType="portfolio"
                  exportAnalysisType="stress_test"
                  exportData={{
                    risk_score: (result.severity ?? 0.5) * 100,
                    risk_level: (result.severity ?? 0.5) >= 0.7 ? 'HIGH' : (result.severity ?? 0.5) >= 0.5 ? 'MEDIUM' : 'LOW',
                    summary: (typeof result.executive_summary?.headline === 'string' ? result.executive_summary.headline : null) ?? `Stress: ${result.sector} / ${result.scenario_type}`,
                    recommendations: ['Review exposure', 'Update risk limits'],
                    indicators: {
                      sector: result.sector,
                      scenario_type: result.scenario_type,
                      severity: result.severity,
                      mean_loss: result.loss_distribution?.mean_loss,
                    },
                  }}
                  size="sm"
                />
                <ARINVerdictBadge entityId="portfolio_global" compact />
                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={exportingPdf}
                  className="flex items-center gap-2 px-4 py-2 rounded-md border border-zinc-800/60 bg-zinc-900/50 hover:bg-zinc-800 text-sm disabled:opacity-50 font-sans"
                >
                  <DocumentArrowDownIcon className="w-4 h-4" />
                  {exportingPdf ? 'Exporting…' : 'Export PDF'}
                </button>
                <button
                  type="button"
                  onClick={handleExportJson}
                  className="flex items-center gap-2 px-4 py-2 rounded-md border border-zinc-800/60 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-200 text-sm font-sans"
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
                  className="flex items-center gap-2 px-4 py-2 rounded-md border border-zinc-800/60 bg-zinc-900/50 hover:bg-zinc-800 text-zinc-400 text-sm font-sans"
                >
                  <DocumentTextIcon className="w-4 h-4" />
                  Generate BCP from this scenario
                </button>
              </div>
            </>
          )}
          {!result && !loading && !error && (
            <div className="flex-1 flex items-center justify-center font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              Configure parameters and run a stress test to see results.
            </div>
          )}
        </div>

        {/* Right: Action plan + cross-sector */}
        <div className="w-80 shrink-0 border-l border-zinc-800/60 bg-zinc-900/50 p-4 flex flex-col gap-4 overflow-y-auto">
          <div className={`rounded-md border border-zinc-800/60 px-3 py-2 text-center ${escalation.cls}`}>
            <div className="font-mono text-[10px] font-bold uppercase tracking-widest">{escalation.label}</div>
            <div className="font-mono text-[10px] uppercase tracking-wider opacity-90">{escalation.sub}</div>
          </div>
          {sectorPlan && (
            <div className="space-y-3">
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Action plan — {sectorPlan.sector}</h3>
              {sectorPlan.phases.map((phase, pi) => (
                <div key={pi} className="rounded-md border border-zinc-800/60 overflow-hidden bg-zinc-900/30">
                  <div className="px-3 py-2 bg-zinc-900/80 border-b border-zinc-800/60 font-mono text-[10px] uppercase tracking-widest text-zinc-300">
                    {phase.name}
                  </div>
                  <ul className="px-3 py-2 space-y-1">
                    {phase.items.slice(0, 4).map((item, ii) => (
                      <li key={ii} className="flex items-start gap-2 text-[11px] text-zinc-300">
                        <span className="text-zinc-500">├</span>
                        <span>{item}</span>
                      </li>
                    ))}
                    {phase.items.length > 4 && (
                      <li className="text-[10px] text-zinc-500">+{phase.items.length - 4} more</li>
                    )}
                  </ul>
                </div>
              ))}
            </div>
          )}
          {crossSectorData.length > 0 ? (
            <div>
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Cross-sector impact</h3>
              <div className="space-y-2">
                {crossSectorData.map((d) => (
                  <div key={d.label} className="flex items-center gap-2">
                    <span className="text-[11px] text-zinc-300 w-24 truncate">{d.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-zinc-500"
                        style={{ width: `${(d.value / maxCross) * 100}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-zinc-500 w-14 text-right shrink-0">
                      {d.value >= 1e6 ? `€${(d.value / 1e6).toFixed(1)}M` : d.value.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : result && (
            <div>
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Cross-sector impact</h3>
              <p className="text-[10px] text-zinc-500">Cross-sector impact available when cascade is included.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-zinc-800/60 bg-zinc-900/50 px-3 py-2">
      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="text-sm font-medium font-mono tabular-nums text-zinc-100 mt-0.5">{value}</div>
    </div>
  )
}
