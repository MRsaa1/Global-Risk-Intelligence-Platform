/**
 * Unified Stress Report Page
 * Full assessment by location (country + city). Entry from Command Center "Full assessment" block.
 * Uses integrated lists: /data/countries.json and /data/cities-by-country.json (same as Command Center).
 * Sends all platform stress test scenario IDs to the API.
 */
import { useState, useEffect, useCallback, useMemo } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ArrowLeftIcon, PlayIcon, DocumentTextIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline'
import { getApiBase } from '../config/env'
import { CURRENT_EVENTS, FORECAST_SCENARIOS } from '../lib/riskEventCatalog'
import { exportUnifiedStressReportPdf } from '../lib/exportService'

const API_BASE = () => (getApiBase() ? getApiBase() + '/api/v1' : '/api/v1')

type CountryItem = { code: string; name: string; lat?: number; lng?: number; region?: string }
type CityItem = { id: string; name: string; lat: number; lng: number }

interface LocationState {
  country_code?: string
  country_name?: string
  city_id?: string
  city_name?: string
}

/** report_v2-like metrics from backend */
interface ReportV2Metrics {
  report_metadata?: { report_id?: string; generated_at?: string; methodology_version?: string }
  probabilistic_metrics?: { mean_loss?: number; median_loss?: number; var_95?: number; var_99?: number; cvar_99?: number; std_dev?: number; methodology?: string }
  temporal_dynamics?: { rto_hours?: number; rpo_hours?: number; recovery_time_months?: number[]; business_interruption_days?: number; methodology?: string }
  financial_contagion?: {
    banking?: { npl_increase_pct?: number; provisions_eur_m?: number; cet1_impact_bps?: number }
    insurance?: { claims_gross_eur_m?: number; net_retained_eur_m?: number; solvency_impact_pp?: number }
    real_estate?: { value_decline_pct?: number; vacancy_increase_pct?: number }
    total_economic_impact_eur_m?: number; economic_multiplier?: number; methodology?: string
  }
  predictive_indicators?: { status?: string; probability_event?: number; key_triggers?: string[]; recommended_actions?: string[]; early_warning_signal?: string }
  network_risk?: { critical_nodes?: { name?: string; id?: string }[]; cascade_path?: string; amplification_factor?: number }
  regulatory_relevance?: { entity_type?: string; jurisdiction?: string; disclosure_required?: boolean; regulation_labels?: Record<string, string>; regulations?: string[] }
  [key: string]: unknown
}

interface ScenarioDetail {
  event_id?: string
  name?: string
  severity?: number
  loss_eur_m?: number
  report_v2?: ReportV2Metrics
}

/** Single top-risk item from API (aligned to taxonomy) */
interface TopRiskItem {
  name: string
  score: number
  trend?: string
  category_id?: string
}

interface UnifiedReportStub {
  city_name: string
  country_code: string
  country_name?: string
  executive_summary?: string
  scenarios?: Array<{ type: string; event_id?: string; severity: number; loss_eur_m?: number; zones_count?: number; total_buildings_affected?: number; total_population_affected?: number; error?: string }>
  scenario_details?: ScenarioDetail[]
  primary_report_v2?: ReportV2Metrics
  historical?: Array<{ name: string; year?: number; similarity_reason?: string }>
  generated_at?: string
  category_scores?: Record<string, number>
  top_risks?: TopRiskItem[]
  risk_factors?: Array<{ name: string; score: number; trend?: string; category_id?: string; subcategory?: string }>
}

/** All stress test scenario/event IDs used in the platform (Current + Forecast). */
function getAllScenarioIds(): { id: string; name: string; category: string }[] {
  const list: { id: string; name: string; category: string }[] = []
  for (const cat of CURRENT_EVENTS) {
    for (const ev of cat.events) {
      list.push({ id: ev.id, name: ev.name, category: cat.name })
    }
  }
  for (const outlook of FORECAST_SCENARIOS) {
    for (const sc of outlook.scenarios) {
      list.push({ id: sc.id, name: sc.name, category: `${outlook.name} (${sc.type})` })
    }
  }
  return list
}

const ALL_SCENARIO_IDS = getAllScenarioIds()

/** Target report structure: Complete City Risk Taxonomy (280 risks). See docs/CITY_RISK_TAXONOMY_REPORT_STRUCTURE.md */
const CITY_RISK_CATEGORIES: { id: string; name: string; count: number; subcategories: string[] }[] = [
  { id: 'climate', name: 'Climate & Environmental', count: 42, subcategories: ['Sea Level & Coastal (8)', 'Temperature & Heat (7)', 'Air Quality (8)', 'Water Resources (6)', 'Extreme Weather (7)', 'Precipitation (6)'] },
  { id: 'infrastructure', name: 'Infrastructure & Utilities', count: 38, subcategories: ['Rail/Subway (8)', 'Roads/Bridges (10)', 'Water (8)', 'Wastewater (4)', 'Energy Grid (8)'] },
  { id: 'socioeconomic', name: 'Socio-Economic', count: 35, subcategories: ['Housing (9)', 'Income & Wealth (8)', 'Employment (6)', 'Education (7)', 'Population (5)'] },
  { id: 'health', name: 'Public Health & Safety', count: 32, subcategories: ['Healthcare Access (8)', 'Disease & Illness (10)', 'Mental Health (5)', 'Crime & Safety (9)'] },
  { id: 'financial', name: 'Financial & Economic', count: 28, subcategories: ['Municipal Finance (10)', 'Real Estate (8)', 'Business Climate (6)', 'Tourism & Convention (4)'] },
  { id: 'technology', name: 'Technology & Cyber', count: 25, subcategories: ['Cybersecurity (12)', 'Digital Infrastructure (8)', 'AI & Automation (5)'] },
  { id: 'political', name: 'Political & Regulatory', count: 18, subcategories: ['Governance (8)', 'Regulatory Compliance (6)', 'Political Stability (4)'] },
  { id: 'transport', name: 'Transportation & Mobility', count: 22, subcategories: ['Traffic & Congestion (8)', 'Transit (8)', 'Active Transportation (3)', 'Parking (3)'] },
  { id: 'energy', name: 'Energy & Resources', count: 25, subcategories: ['Natural Gas (5)', 'Water expanded (6)', 'Waste & Recycling (8)', 'Circular Economy (6)'] },
  { id: 'crosscutting', name: 'Cross-cutting', count: 15, subcategories: ['Cascading Failures (3)', 'Emerging Tech (3)', 'Social Cohesion (3)', 'Legal & Liability (3)', 'Resilience (3)'] },
]

export default function UnifiedStressReportPage() {
  const location = useLocation()
  const state = (location.state ?? {}) as LocationState
  const [countriesList, setCountriesList] = useState<CountryItem[]>([])
  const [citiesByCountry, setCitiesByCountry] = useState<Record<string, CityItem[]>>({})
  const [countryCode, setCountryCode] = useState(state.country_code ?? '')
  const [countryName, setCountryName] = useState(state.country_name ?? '')
  const [cityId, setCityId] = useState<string>(state.city_id ?? '')
  const [cityName, setCityName] = useState(state.city_name ?? '')
  const [countrySearchOpen, setCountrySearchOpen] = useState(false)
  const [countrySearchQuery, setCountrySearchQuery] = useState('')
  const [running, setRunning] = useState(false)
  const [report, setReport] = useState<UnifiedReportStub | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [exportingPdf, setExportingPdf] = useState(false)

  // Load integrated country list (same as Command Center)
  useEffect(() => {
    fetch('/data/countries.json')
      .then(res => res.json())
      .then((data: CountryItem[]) => setCountriesList(Array.isArray(data) ? data : []))
      .catch(() => setCountriesList([]))
  }, [])

  // Load cities by country (same as Command Center)
  useEffect(() => {
    fetch('/data/cities-by-country.json')
      .then(res => res.ok ? res.json() : null)
      .then((data: Record<string, CityItem[]>) => setCitiesByCountry(typeof data === 'object' && data !== null ? data : {}))
      .catch(() => setCitiesByCountry({}))
  }, [])

  // Pre-fill from URL params (e.g. when opened in new window from Command Center)
  useEffect(() => {
    const params = new URLSearchParams(location.search)
    const code = state.country_code ?? params.get('country') ?? ''
    const cName = state.country_name ?? params.get('country_name') ?? code
    const cId = state.city_id ?? params.get('city_id') ?? ''
    const cNameFromUrl = state.city_name ?? params.get('city') ?? ''
    if (code) {
      setCountryCode(code)
      setCountryName(cName)
    }
    if (cId) setCityId(cId)
    if (cNameFromUrl) setCityName(cNameFromUrl)
  }, [location.search, state.country_code, state.country_name, state.city_id, state.city_name])

  // When cities load and we have cityId from URL, set cityName from catalog
  useEffect(() => {
    if (!cityId || !countryCode) return
    const list = citiesByCountry[countryCode]
    if (!list) return
    const c = list.find(x => x.id === cityId)
    if (c) setCityName(c.name)
  }, [countryCode, cityId, citiesByCountry])

  const citiesForCountry = countryCode ? (citiesByCountry[countryCode] ?? []) : []
  const selectedCity = cityId ? citiesForCountry.find(c => c.id === cityId) : null
  const effectiveCityName = selectedCity?.name ?? cityName

  const countrySearchFiltered = useMemo(() => {
    if (!countrySearchQuery.trim()) return countriesList
    const q = countrySearchQuery.toLowerCase()
    return countriesList
      .filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
  }, [countriesList, countrySearchQuery])

  const runFullAssessment = useCallback(async () => {
    const city = effectiveCityName.trim() || countryName.trim() || 'Selected region'
    setRunning(true)
    setError(null)
    setReport(null)
    const scenarioIds = ALL_SCENARIO_IDS.map(s => s.id)
    try {
      const res = await fetch(`${API_BASE()}/unified-stress/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          country_code: countryCode || undefined,
          country_name: countryName || undefined,
          city_id: cityId || undefined,
          city_name: effectiveCityName.trim() || countryName.trim() || undefined,
          center_latitude: selectedCity?.lat,
          center_longitude: selectedCity?.lng,
          scenario_ids: scenarioIds,
          include_all_platform_scenarios: true,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setReport(data as UnifiedReportStub)
      } else {
        const text = await res.text()
        if (res.status === 404 || text.includes('Not Found')) {
          const byCategory = CURRENT_EVENTS.map(cat => ({ name: cat.name, count: cat.events.length }))
          const forecastCount = FORECAST_SCENARIOS.reduce((acc, f) => acc + f.scenarios.length, 0)
          setReport({
            city_name: city,
            country_code: countryCode || 'XX',
            country_name: countryName || undefined,
            executive_summary: `Unified stress API not yet deployed. Placeholder report for ${city}. When connected, this run will include all ${scenarioIds.length} platform stress scenarios (Current Events: ${byCategory.map(c => `${c.name} ${c.count}`).join('; ')}; Forecast: ${forecastCount} scenarios).`,
            scenarios: ALL_SCENARIO_IDS.slice(0, 25).map(s => ({ type: s.name, severity: 0.5, loss_eur_m: undefined })),
            historical: [
              { name: 'Historical calibration pending', year: new Date().getFullYear(), similarity_reason: 'Connect historical-events API' },
            ],
            generated_at: new Date().toISOString(),
          })
        } else {
          setError(text || `HTTP ${res.status}`)
        }
      }
    } catch (e) {
      const byCategory = CURRENT_EVENTS.map(cat => ({ name: cat.name, count: cat.events.length }))
      const forecastCount = FORECAST_SCENARIOS.reduce((acc, f) => acc + f.scenarios.length, 0)
      setReport({
        city_name: city,
        country_code: countryCode || 'XX',
        country_name: countryName || undefined,
        executive_summary: `Unified stress endpoint not available. Placeholder. Full assessment will include all ${ALL_SCENARIO_IDS.length} scenarios: Current (${byCategory.map(c => c.name).join(', ')}) and Forecast (${forecastCount} scenarios).`,
        scenarios: ALL_SCENARIO_IDS.slice(0, 25).map(s => ({ type: s.name, severity: 0.5, loss_eur_m: undefined })),
        historical: [],
        generated_at: new Date().toISOString(),
      })
    } finally {
      setRunning(false)
    }
  }, [countryCode, countryName, cityId, effectiveCityName, selectedCity])

  const displayLocation = [effectiveCityName.trim(), countryName || countryCode].filter(Boolean).join(', ') || 'Select location'
  const canRun = !!(countryCode && countryName)

  return (
    <div className="h-screen flex flex-col bg-zinc-950 text-zinc-100 overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto">
        <header className="border-b border-zinc-800 bg-zinc-900/95 px-6 py-4 shrink-0">
          <div className="w-full flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/command"
                className="p-2 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors"
                title="Back to Command Center"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-3">
                <DocumentTextIcon className="w-8 h-8 text-zinc-500" />
                <div>
                  <h1 className="text-lg font-semibold text-zinc-100">Unified Stress Report</h1>
                  <p className="text-xs text-zinc-400">Full assessment by location — all stress tests, cascades, historical comparison</p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="w-full min-w-0 px-6 py-8">
        {!report ? (
          <div className="space-y-6">
            <div className="p-4 rounded-md bg-zinc-800/50 border border-zinc-700">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Location</h2>
              <p className="text-xs text-zinc-500 mb-3">Same country and city lists as Command Center (integrated data).</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="block text-xs text-zinc-500 mb-1">Country</label>
                  <input
                    type="text"
                    value={countrySearchOpen ? countrySearchQuery : (countryName || countryCode)}
                    onChange={(e) => {
                      setCountrySearchQuery(e.target.value)
                      setCountrySearchOpen(true)
                      if (!countrySearchOpen) setCountrySearchOpen(true)
                    }}
                    onFocus={() => { if (countriesList.length) setCountrySearchOpen(true) }}
                    onBlur={() => setTimeout(() => setCountrySearchOpen(false), 180)}
                    placeholder="Search country…"
                    className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100 placeholder-zinc-500 text-sm"
                  />
                  {countrySearchOpen && (
                    <div className="absolute top-full left-0 right-0 mt-1 w-full min-w-[280px] max-h-[90vh] min-h-[360px] overflow-y-auto rounded-md bg-zinc-800 border border-zinc-600 shadow-xl z-20">
                      {countrySearchFiltered.length === 0 ? (
                        <div className="px-3 py-2 text-zinc-500 text-sm">No countries found</div>
                      ) : (
                        countrySearchFiltered.map(c => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => {
                              setCountryCode(c.code)
                              setCountryName(c.name)
                              setCountrySearchQuery('')
                              setCountrySearchOpen(false)
                              setCityId('')
                              setCityName('')
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-zinc-200 hover:bg-zinc-700"
                          >
                            {c.name} <span className="text-zinc-500 text-xs">({c.code})</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-zinc-500 mb-1">City (optional)</label>
                  <select
                    value={cityId || ''}
                    onChange={(e) => {
                      const v = e.target.value
                      setCityId(v)
                      const c = citiesForCountry.find(x => x.id === v)
                      setCityName(c ? c.name : '')
                    }}
                    className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100 text-sm"
                  >
                    <option value="">— Country only —</option>
                    {citiesForCountry.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                  {countryCode && citiesForCountry.length === 0 && (
                    <p className="text-xs text-zinc-500 mt-1">No city list for this country in catalog.</p>
                  )}
                </div>
              </div>
            </div>
            {error && (
              <div className="p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
                {error}
              </div>
            )}
            <button
              onClick={runFullAssessment}
              disabled={running || !canRun}
              className="flex items-center gap-2 px-5 py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-medium text-sm disabled:opacity-50 disabled:pointer-events-none"
            >
              <PlayIcon className="w-5 h-5" />
              {running ? 'Running…' : 'Run full assessment'}
            </button>
          </div>
        ) : (
          <div className="space-y-6 w-full">
            {/* Overview */}
            <section className="p-4 rounded-md bg-zinc-800/50 border border-zinc-700">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Overview</h2>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <p className="text-zinc-300 text-sm">
                  <span className="font-medium text-zinc-100">{report.city_name}</span>
                  {report.country_name && <span> · {report.country_name}</span>}
                </p>
                <div className="flex items-center gap-3">
                  {report.generated_at && (
                    <span className="text-zinc-500 text-xs">
                      Generated {new Date(report.generated_at).toLocaleString()}
                    </span>
                  )}
                  <button
                    onClick={async () => {
                      setExportingPdf(true)
                      try {
                        await exportUnifiedStressReportPdf({
                          country_code: countryCode || undefined,
                          country_name: countryName || undefined,
                          city_id: cityId || undefined,
                          city_name: effectiveCityName.trim() || countryName.trim() || undefined,
                          center_latitude: selectedCity?.lat,
                          center_longitude: selectedCity?.lng,
                          scenario_ids: ALL_SCENARIO_IDS.map(s => s.id),
                          include_all_platform_scenarios: true,
                        })
                      } catch (e) {
                        setError(e instanceof Error ? e.message : 'PDF export failed')
                      } finally {
                        setExportingPdf(false)
                      }
                    }}
                    disabled={exportingPdf}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                    {exportingPdf ? 'Exporting…' : 'Export PDF'}
                  </button>
                  <button
                    onClick={() => { setReport(null); setError(null) }}
                    className="text-zinc-400 hover:text-zinc-200 text-sm"
                  >
                    Run another
                  </button>
                </div>
              </div>
              <p className="text-zinc-500 text-xs mt-2">
                {report.generated_at
                  ? `Data as of ${new Date(report.generated_at).toLocaleString()} (last run). Full assessment aligned to Complete City Risk Taxonomy (280 risk factors).`
                  : 'Full assessment aligned to Complete City Risk Taxonomy (280 risk factors). Data freshness and scores will improve as APIs are connected.'}
              </p>
            </section>

            {/* KPI Summary Strip */}
            {(() => {
              const totalLoss = report.scenarios?.reduce((s, sc) => s + (sc.loss_eur_m ?? 0), 0) ?? 0
              const scenarioCount = report.scenarios?.length ?? 0
              const var99 = report.primary_report_v2?.probabilistic_metrics?.var_99
              const rto = report.primary_report_v2?.temporal_dynamics?.rto_hours
              const topCat = report.category_scores
                ? Object.entries(report.category_scores).sort((a, b) => b[1] - a[1])[0]
                : null
              const topCatLabel = topCat ? CITY_RISK_CATEGORIES.find(c => c.id === topCat[0])?.name ?? topCat[0] : null
              const multiplier = report.primary_report_v2?.financial_contagion?.economic_multiplier as number | undefined

              const kpiScoreColor = (v: number) =>
                v >= 0.8 ? 'text-red-400/80' : v >= 0.6 ? 'text-orange-400/80' : v >= 0.4 ? 'text-yellow-400/80' : 'text-emerald-400/80'

              return (
                <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                  <div className="p-3 rounded-md bg-zinc-800/50 border border-zinc-700 text-center">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Total Loss</p>
                    <p className="text-lg font-semibold text-zinc-100 font-mono">€{(totalLoss / 1000).toFixed(1)}B</p>
                  </div>
                  <div className="p-3 rounded-md bg-zinc-800/50 border border-zinc-700 text-center">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">VaR 99%</p>
                    <p className="text-lg font-semibold text-zinc-100 font-mono">{var99 != null ? `€${(var99 / 1000).toFixed(1)}B` : '—'}</p>
                  </div>
                  <div className="p-3 rounded-md bg-zinc-800/50 border border-zinc-700 text-center">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Scenarios</p>
                    <p className="text-lg font-semibold text-zinc-100 font-mono">{scenarioCount}</p>
                  </div>
                  <div className="p-3 rounded-md bg-zinc-800/50 border border-zinc-700 text-center">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Top Risk Category</p>
                    <p className={`text-sm font-semibold ${topCat ? kpiScoreColor(topCat[1]) : 'text-zinc-400'}`}>
                      {topCatLabel ? `${topCatLabel.split(' ')[0]} ${(topCat![1] * 100).toFixed(0)}%` : '—'}
                    </p>
                  </div>
                  <div className="p-3 rounded-md bg-zinc-800/50 border border-zinc-700 text-center">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">RTO</p>
                    <p className="text-lg font-semibold text-zinc-100 font-mono">{rto != null ? `${rto}h` : '—'}</p>
                  </div>
                  <div className="p-3 rounded-md bg-zinc-800/50 border border-zinc-700 text-center">
                    <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Contagion ×</p>
                    <p className="text-lg font-semibold text-amber-400/80 font-mono">{multiplier != null ? `×${multiplier.toFixed(2)}` : '—'}</p>
                  </div>
                </section>
              )
            })()}

            {/* Executive summary */}
            {report.executive_summary && (
              <section className="p-4 rounded-md bg-zinc-800/50 border border-zinc-700">
                <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Executive summary</h2>
                <p className="text-zinc-300 text-sm whitespace-pre-wrap">{report.executive_summary}</p>
              </section>
            )}

            {/* Risk by category — target structure (280 risks), expandable accordion */}
            {(() => {
              const scoreColor = (s: number) =>
                s >= 0.8 ? 'bg-red-500' : s >= 0.6 ? 'bg-orange-500' : s >= 0.4 ? 'bg-yellow-500' : 'bg-emerald-500'
              const scoreTextColor = (s: number) =>
                s >= 0.8 ? 'text-red-400/80' : s >= 0.6 ? 'text-orange-400/80' : s >= 0.4 ? 'text-yellow-400/80' : 'text-emerald-400/80'
              const trendIcon = (t?: string) =>
                t === 'rising' ? '▲' : t === 'declining' ? '▼' : '—'
              const trendColor = (t?: string) =>
                t === 'rising' ? 'text-red-400/80' : t === 'declining' ? 'text-emerald-400/80' : 'text-zinc-600'

              const sortedCats = [...CITY_RISK_CATEGORIES].sort((a, b) =>
                (report.category_scores?.[b.id] ?? 0) - (report.category_scores?.[a.id] ?? 0)
              )
              const top2Ids = new Set(sortedCats.slice(0, 2).map(c => c.id))

              return (
                <section className="p-4 rounded-md bg-zinc-800/50 border border-zinc-700">
                  <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Risk by category</h2>
                  <p className="text-xs text-zinc-500 mb-4">
                    Framework: 9 categories + cross-cutting. Expand a category to see subcategories, score, and top risks.
                  </p>

                  {/* Top risks table */}
                  {report.top_risks != null && report.top_risks.length > 0 && (
                    <div className="rounded-md bg-zinc-900/60 border border-zinc-700 p-3 mb-4">
                      <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Top 15 risk factors</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-zinc-500 border-b border-zinc-700">
                              <th className="text-left py-1.5 pr-2 w-6">#</th>
                              <th className="text-left py-1.5 pr-2">Risk Factor</th>
                              <th className="text-left py-1.5 px-2">Category</th>
                              <th className="text-right py-1.5 px-2 w-16">Score</th>
                              <th className="text-center py-1.5 pl-2 w-8">Trend</th>
                            </tr>
                          </thead>
                          <tbody>
                            {report.top_risks.map((r, i) => (
                              <tr key={i} className="border-b border-zinc-800 last:border-0">
                                <td className="py-1.5 pr-2 text-zinc-600 font-mono">{i + 1}</td>
                                <td className="py-1.5 pr-2 text-zinc-300">{r.name}</td>
                                <td className="py-1.5 px-2 text-zinc-500 text-[10px]">
                                  {CITY_RISK_CATEGORIES.find(c => c.id === r.category_id)?.name?.split(' ')[0] ?? '—'}
                                </td>
                                <td className="text-right py-1.5 px-2">
                                  <span className="flex items-center justify-end gap-1.5">
                                    <span className="w-10 h-1 rounded-full bg-zinc-700 overflow-hidden">
                                      <span className={`block h-full rounded-full ${scoreColor(r.score)}`} style={{ width: `${r.score * 100}%` }} />
                                    </span>
                                    <span className={`font-mono ${scoreTextColor(r.score)}`}>{(r.score * 100).toFixed(0)}%</span>
                                  </span>
                                </td>
                                <td className={`text-center py-1.5 pl-2 text-[10px] ${trendColor(r.trend)}`}>{trendIcon(r.trend)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Category score bar chart */}
                  {report.category_scores && (
                    <div className="rounded-md bg-zinc-900/60 border border-zinc-700 p-3 mb-4">
                      <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Category risk scores</h3>
                      <div className="space-y-2">
                        {sortedCats.map(cat => {
                          const s = report.category_scores?.[cat.id] ?? 0
                          return (
                            <div key={cat.id} className="flex items-center gap-2">
                              <span className="text-[10px] text-zinc-400 w-28 truncate shrink-0">{cat.name}</span>
                              <div className="flex-1 h-4 rounded bg-zinc-800 overflow-hidden relative">
                                <div
                                  className={`h-full rounded ${scoreColor(s)} transition-all duration-500`}
                                  style={{ width: `${s * 100}%` }}
                                />
                                <span className="absolute inset-0 flex items-center pl-1.5 text-[9px] font-mono text-white/80 mix-blend-difference">
                                  {(s * 100).toFixed(0)}%
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Expandable category accordions */}
                  <div className="space-y-2">
                    {CITY_RISK_CATEGORIES.map((cat) => {
                      const score = report.category_scores?.[cat.id]
                      const catFactors = report.risk_factors?.filter(r => r.category_id === cat.id) ?? []
                      const subcatGroups: Record<string, typeof catFactors> = {}
                      catFactors.forEach(rf => {
                        const sub = rf.subcategory ?? 'Other'
                        if (!subcatGroups[sub]) subcatGroups[sub] = []
                        subcatGroups[sub].push(rf)
                      })
                      const hasFactors = catFactors.length > 0

                      return (
                        <details key={cat.id} open={top2Ids.has(cat.id)} className="rounded-md bg-zinc-900/60 border border-zinc-700 overflow-hidden group">
                          <summary className="px-3 py-2.5 cursor-pointer text-zinc-200 text-sm font-medium list-none flex justify-between items-center hover:bg-zinc-800/50">
                            <span>{cat.name}</span>
                            <span className="flex items-center gap-2 text-zinc-500 text-xs">
                              {score != null && (
                                <span className="flex items-center gap-1.5">
                                  <span className={`${scoreTextColor(score)} font-mono`}>{(score * 100).toFixed(0)}%</span>
                                  <span className="w-12 h-1.5 rounded-full bg-zinc-700 overflow-hidden">
                                    <span className={`block h-full rounded-full ${scoreColor(score)}`} style={{ width: `${score * 100}%` }} />
                                  </span>
                                </span>
                              )}
                              <span>{cat.count} factors</span>
                            </span>
                          </summary>
                          <div className="px-3 pb-3 pt-0 border-t border-zinc-700">
                            {hasFactors ? (
                              Object.entries(subcatGroups).map(([subName, factors]) => (
                                <div key={subName} className="mt-2.5">
                                  <h4 className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider mb-1">{subName} ({factors.length})</h4>
                                  <div className="space-y-0.5">
                                    {factors.sort((a, b) => b.score - a.score).map((rf, i) => (
                                      <div key={i} className="flex items-center justify-between text-xs py-0.5">
                                        <span className="text-zinc-300 truncate mr-2">{rf.name}</span>
                                        <span className="flex items-center gap-1.5 shrink-0">
                                          <span className="w-10 h-1 rounded-full bg-zinc-700 overflow-hidden">
                                            <span className={`block h-full rounded-full ${scoreColor(rf.score)}`} style={{ width: `${rf.score * 100}%` }} />
                                          </span>
                                          <span className={`font-mono w-7 text-right ${scoreTextColor(rf.score)}`}>{(rf.score * 100).toFixed(0)}%</span>
                                          <span className={`${trendColor(rf.trend)} text-[9px] w-2`}>{trendIcon(rf.trend)}</span>
                                        </span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <>
                                <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-zinc-500 mt-2">
                                  {cat.subcategories.map((sub, i) => (
                                    <li key={i}>{sub}</li>
                                  ))}
                                </ul>
                                <p className="text-zinc-500 text-xs mt-2">Per-risk scores will populate when data and calculation pipelines are connected.</p>
                              </>
                            )}
                          </div>
                        </details>
                      )
                    })}
                  </div>
                  <p className="text-zinc-500 text-xs mt-3">Total: 280 distinct risk factors.</p>
                </section>
              )
            })()}

            {/* Scenario comparison table */}
            {report.scenario_details && report.scenario_details.length > 0 && (
              <section className="p-4 rounded-md bg-zinc-800/50 border border-zinc-700 w-full">
                <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Scenario comparison</h2>
                <p className="text-xs text-zinc-500 mb-3">Side-by-side comparison of all stress test scenarios. Sorted by estimated loss.</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-zinc-500 border-b border-zinc-700">
                        <th className="text-left py-2 pr-2">Scenario</th>
                        <th className="text-right py-2 px-2">Severity</th>
                        <th className="text-right py-2 px-2">Loss (€M)</th>
                        <th className="text-right py-2 px-2">VaR 99%</th>
                        <th className="text-right py-2 px-2">RTO</th>
                        <th className="text-right py-2 px-2">Econ. Impact</th>
                        <th className="text-center py-2 pl-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...report.scenario_details]
                        .sort((a, b) => (b.loss_eur_m ?? 0) - (a.loss_eur_m ?? 0))
                        .map((sd, i) => {
                          const pm = sd.report_v2?.probabilistic_metrics
                          const td = sd.report_v2?.temporal_dynamics
                          const fc = sd.report_v2?.financial_contagion
                          const pi = sd.report_v2?.predictive_indicators
                          const statusColor = pi?.status === 'RED' ? 'bg-red-500/20 text-red-300' : pi?.status === 'AMBER' ? 'bg-amber-500/20 text-amber-300' : 'bg-yellow-500/20 text-yellow-300'
                          return (
                            <tr key={i} className="border-b border-zinc-800 last:border-0 hover:bg-zinc-800/30">
                              <td className="py-1.5 pr-2 text-zinc-300 max-w-[180px] truncate">{sd.name ?? sd.event_id ?? `Scenario ${i + 1}`}</td>
                              <td className="text-right py-1.5 px-2 text-zinc-400 font-mono">{((sd.severity ?? 0) * 100).toFixed(0)}%</td>
                              <td className="text-right py-1.5 px-2 text-zinc-300 font-mono font-medium">{sd.loss_eur_m != null ? `€${sd.loss_eur_m.toLocaleString()}M` : '—'}</td>
                              <td className="text-right py-1.5 px-2 text-zinc-400 font-mono">{pm?.var_99 != null ? `€${pm.var_99.toLocaleString()}M` : '—'}</td>
                              <td className="text-right py-1.5 px-2 text-zinc-400 font-mono">{td?.rto_hours != null ? `${td.rto_hours}h` : '—'}</td>
                              <td className="text-right py-1.5 px-2 text-zinc-400 font-mono">{fc?.total_economic_impact_eur_m != null ? `€${fc.total_economic_impact_eur_m.toLocaleString()}M` : '—'}</td>
                              <td className="text-center py-1.5 pl-2">{pi?.status ? <span className={`px-1.5 py-0.5 rounded text-[10px] ${statusColor}`}>{pi.status}</span> : '—'}</td>
                            </tr>
                          )
                        })}
                    </tbody>
                  </table>
                </div>
              </section>
            )}

            {/* Metrics & outputs (from primary report_v2) */}
            {report.primary_report_v2 && (
              <section className="p-4 rounded-md bg-zinc-800/50 border border-zinc-700 w-full space-y-4">
                <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Metrics &amp; outputs</h2>
                {report.primary_report_v2.probabilistic_metrics && (
                  <div className="rounded-md bg-zinc-900/60 border border-zinc-700 p-3">
                    <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Probabilistic metrics</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs text-zinc-400">
                      {report.primary_report_v2.probabilistic_metrics.mean_loss != null && <span>Mean (μ): €{report.primary_report_v2.probabilistic_metrics.mean_loss}M</span>}
                      {report.primary_report_v2.probabilistic_metrics.var_95 != null && <span>VaR 95%: €{report.primary_report_v2.probabilistic_metrics.var_95}M</span>}
                      {report.primary_report_v2.probabilistic_metrics.var_99 != null && <span>VaR 99%: €{report.primary_report_v2.probabilistic_metrics.var_99}M</span>}
                      {report.primary_report_v2.probabilistic_metrics.cvar_99 != null && <span>CVaR 99%: €{report.primary_report_v2.probabilistic_metrics.cvar_99}M</span>}
                      {report.primary_report_v2.probabilistic_metrics.std_dev != null && <span>Std dev: €{report.primary_report_v2.probabilistic_metrics.std_dev}M</span>}
                    </div>
                    {report.primary_report_v2.probabilistic_metrics.methodology && <p className="text-zinc-500 text-[10px] mt-1">{report.primary_report_v2.probabilistic_metrics.methodology}</p>}
                  </div>
                )}
                {report.primary_report_v2.temporal_dynamics && (
                  <div className="rounded-md bg-zinc-900/60 border border-zinc-700 p-3">
                    <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Temporal dynamics</h3>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400">
                      {report.primary_report_v2.temporal_dynamics.rto_hours != null && <span>RTO: {report.primary_report_v2.temporal_dynamics.rto_hours}h</span>}
                      {report.primary_report_v2.temporal_dynamics.rpo_hours != null && <span>RPO: {report.primary_report_v2.temporal_dynamics.rpo_hours}h</span>}
                      {report.primary_report_v2.temporal_dynamics.recovery_time_months?.length ? <span>Recovery: {report.primary_report_v2.temporal_dynamics.recovery_time_months[0]}–{report.primary_report_v2.temporal_dynamics.recovery_time_months[1] || report.primary_report_v2.temporal_dynamics.recovery_time_months[0]} mo</span> : null}
                      {report.primary_report_v2.temporal_dynamics.business_interruption_days != null && <span>BI: {report.primary_report_v2.temporal_dynamics.business_interruption_days} days</span>}
                    </div>
                    {report.primary_report_v2.temporal_dynamics.methodology && <p className="text-zinc-500 text-[10px] mt-1">{report.primary_report_v2.temporal_dynamics.methodology}</p>}
                  </div>
                )}
                {report.primary_report_v2.financial_contagion && (
                  <div className="rounded-md bg-zinc-900/60 border border-zinc-700 p-3">
                    <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Financial contagion</h3>
                    <div className="space-y-1 text-xs text-zinc-400">
                      {report.primary_report_v2.financial_contagion.banking && <p>Banking: NPL +{report.primary_report_v2.financial_contagion.banking.npl_increase_pct}%, provisions €{report.primary_report_v2.financial_contagion.banking.provisions_eur_m}M, CET1 {report.primary_report_v2.financial_contagion.banking.cet1_impact_bps} bps</p>}
                      {report.primary_report_v2.financial_contagion.insurance && <p>Insurance: claims €{report.primary_report_v2.financial_contagion.insurance.claims_gross_eur_m}M, net €{report.primary_report_v2.financial_contagion.insurance.net_retained_eur_m}M, Solvency {report.primary_report_v2.financial_contagion.insurance.solvency_impact_pp} pp</p>}
                      {report.primary_report_v2.financial_contagion.real_estate && <p>Real estate: value −{report.primary_report_v2.financial_contagion.real_estate.value_decline_pct}%, vacancy +{report.primary_report_v2.financial_contagion.real_estate.vacancy_increase_pct}%</p>}
                      {report.primary_report_v2.financial_contagion.total_economic_impact_eur_m != null && <p>Total economic impact: €{report.primary_report_v2.financial_contagion.total_economic_impact_eur_m}M (×{report.primary_report_v2.financial_contagion.economic_multiplier})</p>}
                    </div>
                    {report.primary_report_v2.financial_contagion.methodology && <p className="text-zinc-500 text-[10px] mt-1">{report.primary_report_v2.financial_contagion.methodology}</p>}
                  </div>
                )}
                {report.primary_report_v2.predictive_indicators && (
                  <div className="rounded-md bg-zinc-900/60 border border-zinc-700 p-3">
                    <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Predictive indicators</h3>
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {report.primary_report_v2.predictive_indicators.status && <span className={`px-1.5 py-0.5 rounded ${report.primary_report_v2.predictive_indicators.status === 'RED' ? 'bg-red-500/20 text-red-300' : report.primary_report_v2.predictive_indicators.status === 'AMBER' ? 'bg-amber-500/20 text-amber-300' : 'bg-yellow-500/20 text-yellow-300'}`}>{report.primary_report_v2.predictive_indicators.status}</span>}
                      {report.primary_report_v2.predictive_indicators.probability_event != null && <span className="text-zinc-400">P(event): {(report.primary_report_v2.predictive_indicators.probability_event * 100).toFixed(0)}%</span>}
                      {report.primary_report_v2.predictive_indicators.early_warning_signal && <span className="text-zinc-400">Signal: {report.primary_report_v2.predictive_indicators.early_warning_signal}</span>}
                    </div>
                    {report.primary_report_v2.predictive_indicators.recommended_actions?.length ? (
                      <ul className="mt-2 text-xs text-zinc-400 list-disc list-inside">{report.primary_report_v2.predictive_indicators.recommended_actions.slice(0, 5).map((a, i) => <li key={i}>{a}</li>)}</ul>
                    ) : null}
                  </div>
                )}
                {report.primary_report_v2.network_risk && (report.primary_report_v2.network_risk.critical_nodes?.length || report.primary_report_v2.network_risk.cascade_path) && (
                  <div className="rounded-md bg-zinc-900/60 border border-zinc-700 p-3">
                    <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Network risk</h3>
                    <div className="text-xs text-zinc-400 mb-3">
                      {report.primary_report_v2.network_risk.critical_nodes?.length ? <p>Critical nodes: {report.primary_report_v2.network_risk.critical_nodes.slice(0, 5).map(n => n.name || n.id).filter(Boolean).join(', ') || '—'}</p> : null}
                      {report.primary_report_v2.network_risk.amplification_factor != null && <p>Amplification factor: {report.primary_report_v2.network_risk.amplification_factor}×</p>}
                    </div>
                    {/* Cascade chain visualization */}
                    {report.primary_report_v2.network_risk.cascade_path && (() => {
                      const pathStr = report.primary_report_v2!.network_risk!.cascade_path as string
                      const nodes = pathStr.split('→').map(s => s.trim()).filter(Boolean)
                      if (nodes.length < 2) return null
                      return (
                        <div className="mt-2">
                          <h4 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Cascade chain</h4>
                          <div className="flex items-center gap-0 overflow-x-auto pb-2">
                            {nodes.map((node, idx) => (
                              <div key={idx} className="flex items-center shrink-0">
                                <div className="flex flex-col items-center">
                                  <div className={`px-3 py-2 rounded-md border text-[11px] font-medium whitespace-nowrap ${
                                    idx === 0
                                      ? 'bg-red-500/15 border-red-500/40 text-red-300'
                                      : idx === nodes.length - 1
                                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                                        : 'bg-zinc-800 border-zinc-600 text-zinc-300'
                                  }`}>
                                    {node}
                                  </div>
                                  <span className="text-[8px] text-zinc-600 mt-0.5">
                                    {idx === 0 ? 'Origin' : idx === nodes.length - 1 ? 'Terminal' : `Hop ${idx}`}
                                  </span>
                                </div>
                                {idx < nodes.length - 1 && (
                                  <div className="flex items-center mx-1 text-zinc-600">
                                    <div className="w-6 h-px bg-zinc-600" />
                                    <span className="text-[10px]">→</span>
                                    <div className="w-2 h-px bg-zinc-600" />
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                          {report.primary_report_v2!.network_risk!.amplification_factor != null && (
                            <p className="text-[10px] text-zinc-500 mt-1">
                              End-to-end amplification: initial impact is multiplied ×{report.primary_report_v2!.network_risk!.amplification_factor} across {nodes.length - 1} cascade hops.
                            </p>
                          )}
                        </div>
                      )
                    })()}
                  </div>
                )}
                {report.primary_report_v2.regulatory_relevance && (
                  <div className="rounded-md bg-zinc-900/60 border border-zinc-700 p-3">
                    <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Regulatory relevance</h3>
                    <div className="text-xs text-zinc-400">
                      <p>Entity: {report.primary_report_v2.regulatory_relevance.entity_type || '—'} · Jurisdiction: {report.primary_report_v2.regulatory_relevance.jurisdiction || '—'} · Disclosure: {report.primary_report_v2.regulatory_relevance.disclosure_required ? 'Yes' : 'No'}</p>
                      {report.primary_report_v2.regulatory_relevance.regulation_labels && Object.keys(report.primary_report_v2.regulatory_relevance.regulation_labels).length > 0 && <p>Applicable: {Object.values(report.primary_report_v2.regulatory_relevance.regulation_labels).slice(0, 5).join(', ')}</p>}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Per-scenario details (expandable) */}
            {report.scenario_details && report.scenario_details.length > 0 && (
              <section className="p-4 rounded-md bg-zinc-800/50 border border-zinc-700 w-full">
                <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Per-scenario outputs</h2>
                <p className="text-xs text-zinc-500 mb-3">Full metrics for each stress test run.</p>
                <div className="space-y-2">
                  {report.scenario_details.map((sd, i) => (
                    <details key={i} className="rounded-md bg-zinc-900/60 border border-zinc-700 overflow-hidden">
                      <summary className="px-3 py-2 cursor-pointer text-zinc-300 text-sm font-medium list-none flex justify-between items-center">
                        <span>{sd.name ?? sd.event_id ?? `Scenario ${i + 1}`}</span>
                        <span className="text-zinc-500 text-xs">Severity {(sd.severity ?? 0) * 100}% · {sd.loss_eur_m != null ? `€${sd.loss_eur_m}M` : '—'}</span>
                      </summary>
                      <div className="px-3 pb-3 pt-0 text-xs text-zinc-400 border-t border-zinc-700">
                        {sd.report_v2?.probabilistic_metrics && <p className="mt-2">VaR 99%: €{sd.report_v2.probabilistic_metrics.var_99}M · CVaR 99%: €{sd.report_v2.probabilistic_metrics.cvar_99}M</p>}
                        {sd.report_v2?.temporal_dynamics && <p>RTO: {sd.report_v2.temporal_dynamics.rto_hours}h · Recovery: {sd.report_v2.temporal_dynamics.recovery_time_months?.join('–')} mo</p>}
                        {sd.report_v2?.financial_contagion?.total_economic_impact_eur_m != null && <p>Economic impact: €{sd.report_v2.financial_contagion.total_economic_impact_eur_m}M</p>}
                        {sd.report_v2?.predictive_indicators?.status && <p>Status: {sd.report_v2.predictive_indicators.status}</p>}
                      </div>
                    </details>
                  ))}
                </div>
              </section>
            )}

            <section className="p-4 rounded-md bg-zinc-800/50 border border-zinc-700">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Stress test coverage</h2>
              {(() => {
                const totalPlatform = ALL_SCENARIO_IDS.length
                const ranCount = report.scenarios?.length ?? 0
                const coveragePct = totalPlatform > 0 ? Math.round((ranCount / totalPlatform) * 100) : 0
                const ranIds = new Set(report.scenarios?.map(s => (s.event_id ?? s.type ?? '').toLowerCase()) ?? [])
                const missingCategories = CURRENT_EVENTS.filter(c =>
                  !c.events.some(ev => ranIds.has(ev.id.toLowerCase()))
                ).map(c => c.name)
                return (
                  <>
                    <div className="flex items-center gap-4 mb-3">
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-zinc-400">Executed:</span>
                        <span className="text-zinc-200 font-mono font-medium">{ranCount} / {totalPlatform}</span>
                      </div>
                      <div className="flex items-center gap-2 flex-1 max-w-xs">
                        <div className="flex-1 h-2 rounded-full bg-zinc-700 overflow-hidden">
                          <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${coveragePct}%` }} />
                        </div>
                        <span className="text-[10px] font-mono text-zinc-400">{coveragePct}%</span>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-400 mb-2">
                      <span>Current: {CURRENT_EVENTS.map(c => `${c.name} (${c.events.length})`).join(', ')}</span>
                      <span>Forecast: {FORECAST_SCENARIOS.map(f => `${f.name} (${f.scenarios.length})`).join(', ')}</span>
                    </div>
                    {missingCategories.length > 0 && (
                      <p className="text-[10px] text-amber-400/80 mt-1">
                        Not covered in this run: {missingCategories.join(', ')}. Include these categories for full spectrum coverage.
                      </p>
                    )}
                  </>
                )
              })()}
            </section>

            {/* Historical comparison */}
            {report.historical && report.historical.length > 0 && (
              <section className="p-4 rounded-md bg-zinc-800/50 border border-zinc-700">
                <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Historical comparison</h2>
                <ul className="space-y-2 text-sm text-zinc-400">
                  {report.historical.map((h, i) => (
                    <li key={i}>{h.name}{h.year != null ? ` (${h.year})` : ''}{h.similarity_reason ? ` — ${h.similarity_reason}` : ''}</li>
                  ))}
                </ul>
              </section>
            )}

            {/* Methodology */}
            <section className="p-4 rounded-md bg-zinc-800/50 border border-zinc-700">
              <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Methodology</h2>
              <div className="space-y-3 text-xs text-zinc-400">
                <div>
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Scoring formula</h3>
                  <p>Risk Score = P(occurrence) × Impact × Urgency × Confidence. Each factor is normalized to [0, 1]. Category scores aggregate individual factor scores with cross-category propagation weights reflecting cascading interdependencies.</p>
                </div>
                <div>
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Data sources</h3>
                  <p>Satellite imagery (Sentinel-2, Landsat), IoT sensor networks, NOAA weather APIs, FEMA NFHL flood maps, USGS earthquake feeds, CMIP6 climate projections, World Bank economic indicators, government census data, OpenStreetMap infrastructure layers, social media and crowdsource signals.</p>
                </div>
                <div>
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Probabilistic engine</h3>
                  <p>Monte Carlo simulation (100,000 iterations) with Gaussian copula for dependency modeling. VaR and CVaR computed at 95% and 99% confidence. Tail risk captured via Extreme Value Theory (GEV distribution).</p>
                </div>
                <div>
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Regulatory alignment</h3>
                  <p>TCFD (Task Force on Climate-related Financial Disclosures), Basel III stress testing framework, Solvency II (insurance capital requirements), EU Taxonomy for sustainable activities, NGFS climate scenarios (SSP1-2.6 through SSP5-8.5).</p>
                </div>
                <div>
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Limitations</h3>
                  <p>Model outputs are estimates based on available data and calibrated assumptions. Actual outcomes may differ from projections. Confidence intervals widen for low-frequency/high-severity events. Cross-category propagation uses fixed weight matrices; real-world cascades may exhibit non-linear behavior.</p>
                </div>
                <p className="text-zinc-500 text-[10px] pt-1 border-t border-zinc-800">
                  API: POST /api/v1/unified-stress/run — returns report_v2 metrics, per-scenario outputs, 280-factor taxonomy scores, and historical comparables.
                </p>
              </div>
            </section>
          </div>
        )}
        </main>
      </div>
    </div>
  )
}
