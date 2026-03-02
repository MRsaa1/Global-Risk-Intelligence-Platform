import { useMemo, useState } from 'react'
import StressTestSelector from './StressTestSelector'
import { CURRENT_EVENTS, FORECAST_SCENARIOS, CITY_REGION } from '../../lib/riskEventCatalog'
import { hasZoneEntities } from '../../lib/stressTestConstants'

type UnifiedTab = 'current' | 'forecast' | 'regulatory' | 'extended'

export type UnifiedSelectedScenario = {
  id: string
  name: string
  type: string
  severity: number
  probability: number
  source?: string
  regulator?: string
  parameters?: Record<string, unknown>
}

// Map ISO country codes to region names used in risk event catalog
const COUNTRY_CODE_TO_REGION: Record<string, string> = {
  US: 'Americas', CA: 'Americas', MX: 'Americas', BR: 'Americas', AR: 'Americas',
  CL: 'Americas', CO: 'Americas', PE: 'Americas', VE: 'Americas', EC: 'Americas',
  BO: 'Americas', PY: 'Americas', UY: 'Americas', PA: 'Americas', CR: 'Americas',
  GT: 'Americas', HN: 'Americas', SV: 'Americas', NI: 'Americas', CU: 'Americas',
  DO: 'Americas', JM: 'Americas', TT: 'Americas', HT: 'Americas', BZ: 'Americas',
  GB: 'Europe', FR: 'Europe', DE: 'Europe', IT: 'Europe', ES: 'Europe',
  PT: 'Europe', NL: 'Europe', BE: 'Europe', CH: 'Europe', AT: 'Europe',
  SE: 'Europe', NO: 'Europe', DK: 'Europe', FI: 'Europe', PL: 'Europe',
  CZ: 'Europe', GR: 'Europe', RO: 'Europe', HU: 'Europe', SK: 'Europe',
  SI: 'Europe', HR: 'Europe', RS: 'Europe', BG: 'Europe', IE: 'Europe',
  LT: 'Europe', LV: 'Europe', EE: 'Europe', LU: 'Europe', ME: 'Europe',
  MK: 'Europe', BA: 'Europe', AL: 'Europe', IS: 'Europe', RU: 'Europe',
  UA: 'Europe', BY: 'Europe', MD: 'Europe', GE: 'Europe',
  JP: 'Asia', CN: 'Asia', KR: 'Asia', TW: 'Asia', IN: 'Asia',
  ID: 'Asia', TH: 'Asia', VN: 'Asia', PH: 'Asia', MY: 'Asia',
  SG: 'Asia', BD: 'Asia', PK: 'Asia', IR: 'Asia', IQ: 'Asia',
  IL: 'Asia', SA: 'Asia', AE: 'Asia', TR: 'Asia', KZ: 'Asia',
  UZ: 'Asia', KG: 'Asia', TJ: 'Asia', TM: 'Asia', MM: 'Asia',
  KH: 'Asia', LA: 'Asia', NP: 'Asia', LK: 'Asia', AF: 'Asia',
  MN: 'Asia', KP: 'Asia', LB: 'Asia', JO: 'Asia', SY: 'Asia',
  YE: 'Asia', OM: 'Asia', QA: 'Asia', BH: 'Asia', KW: 'Asia',
  AU: 'Oceania', NZ: 'Oceania', PG: 'Oceania',
  EG: 'Africa', ZA: 'Africa', NG: 'Africa', KE: 'Africa', MA: 'Africa',
  DZ: 'Africa', TN: 'Africa', LY: 'Africa', ET: 'Africa', TZ: 'Africa',
  GH: 'Africa', CI: 'Africa', SN: 'Africa', CM: 'Africa', CD: 'Africa',
  AO: 'Africa', MZ: 'Africa', MG: 'Africa', SD: 'Africa', SS: 'Africa',
  UG: 'Africa', RW: 'Africa', ZM: 'Africa', ZW: 'Africa', BW: 'Africa',
  NA: 'Africa', MW: 'Africa', ML: 'Africa', NE: 'Africa', BF: 'Africa',
  TD: 'Africa', CF: 'Africa', CG: 'Africa', SO: 'Africa', ER: 'Africa',
  DJ: 'Africa', LS: 'Africa', SZ: 'Africa', GM: 'Africa', GW: 'Africa',
  GQ: 'Africa', GA: 'Africa', MR: 'Africa', TG: 'Africa', BJ: 'Africa',
  SL: 'Africa', LR: 'Africa', BI: 'Africa',
}

interface UnifiedStressTestSelectorProps {
  selectedScenarioId: string | null
  onSelect: (scenario: UnifiedSelectedScenario) => void
  onClear?: () => void
  /** When opened from climate zone double-click: only show climatic events relevant to this city */
  filterClimaticOnly?: boolean
  filterByCityId?: string | null
  /** Filter events by country (ISO 3166-1 alpha-2 code) - used in Country Mode */
  filterByCountryCode?: string | null
  /** Municipal/local view: only climatic, bio (pandemic), and local (energy/infra) scenarios */
  filterMunicipalLocalOnly?: boolean
}

const MUNICIPAL_CATEGORY_IDS = ['climate', 'pandemic', 'energy'] as const

export default function UnifiedStressTestSelector({
  selectedScenarioId,
  onSelect,
  onClear,
  filterClimaticOnly = false,
  filterByCityId = null,
  filterByCountryCode = null,
  filterMunicipalLocalOnly = false,
}: UnifiedStressTestSelectorProps) {
  const [tab, setTab] = useState<UnifiedTab>(filterClimaticOnly || filterMunicipalLocalOnly ? 'current' : 'current')
  const cityRegion = filterByCityId ? CITY_REGION[filterByCityId.toLowerCase()] : null
  const countryRegion = filterByCountryCode ? COUNTRY_CODE_TO_REGION[filterByCountryCode.toUpperCase()] : null
  const activeRegion = cityRegion || countryRegion
  const filteredCurrentEvents = useMemo(() => {
    let events = CURRENT_EVENTS
    if (filterMunicipalLocalOnly) {
      events = events.filter((c) => MUNICIPAL_CATEGORY_IDS.includes(c.id as typeof MUNICIPAL_CATEGORY_IDS[number]))
    } else if (filterClimaticOnly) {
      events = events.filter((c) => c.id === 'climate')
    }
    if (!filterClimaticOnly && !filterByCountryCode && !filterMunicipalLocalOnly) return events
    if (activeRegion) {
      events = events.map((cat) => ({
        ...cat,
        events: cat.events.filter((ev) => {
          const regions = ev.regions
          if (!regions || regions.length === 0) return true
          return regions.includes(activeRegion) || regions.includes('global')
        }),
      })).filter((cat) => cat.events.length > 0)
    }
    return events
  }, [filterClimaticOnly, filterByCountryCode, filterMunicipalLocalOnly, activeRegion])
  const filteredForecastScenarios = useMemo(() => {
    if (filterMunicipalLocalOnly) {
      return FORECAST_SCENARIOS.map((f) => ({
        ...f,
        scenarios: f.scenarios.filter((s) => MUNICIPAL_CATEGORY_IDS.includes(s.type as typeof MUNICIPAL_CATEGORY_IDS[number])),
      })).filter((f) => f.scenarios.length > 0)
    }
    if (!filterClimaticOnly && !filterByCountryCode) return FORECAST_SCENARIOS
    return FORECAST_SCENARIOS.map((f) => ({
      ...f,
      scenarios: f.scenarios.filter((s) => {
        if (filterClimaticOnly && s.type !== 'climate') return false
        return true
      }),
    })).filter((f) => f.scenarios.length > 0)
  }, [filterClimaticOnly, filterByCountryCode, filterMunicipalLocalOnly])
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [horizon, setHorizon] = useState<number | null>(null)

  const forecastHorizonLabel = useMemo(() => {
    if (horizon == null) return ''
    return FORECAST_SCENARIOS.find((f) => f.horizon === horizon)?.name || `${horizon}yr Scenarios`
  }, [horizon])

  return (
    <div className="space-y-2">
      {/* Top-level tabs - hide Regulatory/Extended when filtering by climate zone */}
      <div className="flex gap-1 p-0.5 rounded-lg bg-zinc-800 border border-zinc-800">
        <button
          onClick={() => {
            setTab('current')
            setCategoryId(null)
            setHorizon(null)
          }}
          className={`flex-1 text-[10px] uppercase tracking-wider py-1.5 px-2 rounded ${
            tab === 'current'
              ? 'bg-zinc-700 text-zinc-300 border border-zinc-600'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Current
        </button>
        <button
          onClick={() => {
            setTab('forecast')
            setCategoryId(null)
            setHorizon(null)
          }}
          className={`flex-1 text-[10px] uppercase tracking-wider py-1.5 px-2 rounded ${
            tab === 'forecast'
              ? 'bg-zinc-700 text-zinc-300 border border-zinc-600'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Forecast
        </button>
        {!filterClimaticOnly && !filterMunicipalLocalOnly && (
        <button
          onClick={() => {
            setTab('regulatory')
            setCategoryId(null)
            setHorizon(null)
          }}
          className={`flex-1 text-[10px] uppercase tracking-wider py-1.5 px-2 rounded ${
            tab === 'regulatory'
              ? 'bg-zinc-700 text-zinc-300 border border-zinc-600'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Regulatory Library
        </button>
        )}
        {!filterClimaticOnly && !filterMunicipalLocalOnly && (
        <button
          onClick={() => {
            setTab('extended')
            setCategoryId(null)
            setHorizon(null)
          }}
          className={`flex-1 text-[10px] uppercase tracking-wider py-1.5 px-2 rounded ${
            tab === 'extended'
              ? 'bg-zinc-700 text-zinc-300 border border-zinc-600'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          Extended
        </button>
        )}
      </div>

      {/* Current */}
      {tab === 'current' && (
        <div className="max-h-[320px] overflow-y-auto custom-scrollbar pr-1 space-y-1">
          {filterClimaticOnly && (
            <div className="text-zinc-400 text-[10px] px-2 py-1">
              Climatic events for this region
            </div>
          )}
          {!categoryId ? (
            <>
              <div className="text-zinc-600 text-[10px] px-2 py-1 uppercase tracking-wider">
                Current Event Categories
              </div>
              {(filterClimaticOnly ? filteredCurrentEvents : CURRENT_EVENTS).map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryId(cat.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 transition-all text-left group"
                >
                  <span className="text-zinc-300 text-xs group-hover:text-zinc-100 flex-1">
                    {cat.name}
                  </span>
                  <span className="text-zinc-600 text-[10px]">{cat.events.length}</span>
                </button>
              ))}
            </>
          ) : (
            <>
              <button
                onClick={() => setCategoryId(null)}
                className="w-full flex items-center gap-1 px-2 py-1 text-zinc-500 text-[10px] hover:text-zinc-400"
              >
                ← Back to categories
              </button>
              <div className="text-zinc-600 text-[10px] px-2 py-1 uppercase tracking-wider">
                {(filterClimaticOnly ? filteredCurrentEvents : CURRENT_EVENTS).find((c) => c.id === categoryId)?.name || 'Events'}
              </div>
              {((filterClimaticOnly ? filteredCurrentEvents : CURRENT_EVENTS).find((c) => c.id === categoryId)?.events ?? []).map((ev) => (
                <button
                  key={ev.id}
                  onClick={() => {
                    if (selectedScenarioId === ev.id) {
                      onClear?.()
                      return
                    }
                    onSelect({
                      id: ev.id,
                      name: ev.name,
                      type: categoryId,
                      severity: ev.risk,
                      probability: 0.1,
                    })
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 transition-all text-left group ${
                    selectedScenarioId === ev.id ? 'bg-zinc-700' : ''
                  }`}
                >
                  <span className="text-zinc-300 text-xs group-hover:text-zinc-100 flex-1">{ev.name}</span>
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] ${
                      hasZoneEntities(categoryId)
                        ? 'bg-zinc-700 text-zinc-400 border border-zinc-600'
                        : 'bg-zinc-700 text-zinc-500 border border-zinc-700'
                    }`}
                    title={hasZoneEntities(categoryId) ? 'Shows zones and institutions on map' : 'Metrics only'}
                  >
                    {hasZoneEntities(categoryId) ? 'Zone & entities' : 'Metrics only'}
                  </span>
                  <span
                    className={`text-[10px] font-mono ${
                      ev.risk > 0.7 ? 'text-red-300' : ev.risk > 0.5 ? 'text-orange-300' : 'text-amber-300'
                    }`}
                  >
                    {(ev.risk * 100).toFixed(0)}%
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Forecast */}
      {tab === 'forecast' && (
        <div className="max-h-[320px] overflow-y-auto custom-scrollbar pr-1 space-y-1">
          {!horizon ? (
            <>
              <div className="text-zinc-600 text-[10px] px-2 py-1 uppercase tracking-wider">
                Forecast Horizons
              </div>
              {(filterClimaticOnly ? filteredForecastScenarios : FORECAST_SCENARIOS).map((period) => (
                <button
                  key={period.horizon}
                  onClick={() => setHorizon(period.horizon)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 transition-all text-left group"
                >
                  <span className="text-zinc-300 text-xs group-hover:text-zinc-100 flex-1">
                    {period.name}
                  </span>
                  <span className="text-zinc-600 text-[10px]">{period.scenarios.length}</span>
                </button>
              ))}
            </>
          ) : (
            <>
              <button
                onClick={() => setHorizon(null)}
                className="w-full flex items-center gap-1 px-2 py-1 text-zinc-500 text-[10px] hover:text-zinc-400"
              >
                ← Back to horizons
              </button>
              <div className="text-zinc-600 text-[10px] px-2 py-1 uppercase tracking-wider">
                {forecastHorizonLabel}
              </div>
              {((filterClimaticOnly ? filteredForecastScenarios : FORECAST_SCENARIOS).find((f) => f.horizon === horizon)?.scenarios ?? []).map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => {
                    if (selectedScenarioId === sc.id) {
                      onClear?.()
                      return
                    }
                    onSelect({
                      id: sc.id,
                      name: sc.name,
                      type: sc.type,
                      severity: sc.risk,
                      probability: 0.1,
                    })
                  }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 transition-all text-left group ${
                    selectedScenarioId === sc.id ? 'bg-zinc-700' : ''
                  }`}
                >
                  <span className="text-zinc-300 text-xs group-hover:text-zinc-100 flex-1">{sc.name}</span>
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] ${
                      hasZoneEntities(sc.type)
                        ? 'bg-zinc-700 text-zinc-400 border border-zinc-600'
                        : 'bg-zinc-700 text-zinc-500 border border-zinc-700'
                    }`}
                    title={hasZoneEntities(sc.type) ? 'Shows zones and institutions on map' : 'Metrics only'}
                  >
                    {hasZoneEntities(sc.type) ? 'Zone & entities' : 'Metrics only'}
                  </span>
                  <span
                    className={`text-[10px] font-mono ${
                      sc.risk > 0.7 ? 'text-red-300' : sc.risk > 0.5 ? 'text-orange-300' : 'text-amber-300'
                    }`}
                  >
                    {(sc.risk * 100).toFixed(0)}%
                  </span>
                </button>
              ))}
            </>
          )}
        </div>
      )}

      {/* Regulatory / Extended: reuse StressTestSelector */}
      {tab === 'regulatory' && (
        <StressTestSelector
          forcedTab="regulatory"
          showTabs={false}
          selectedScenario={selectedScenarioId}
          onScenarioSelect={(s) => {
            if (!s) {
              onClear?.()
              return
            }
            onSelect({
              id: s.id,
              name: s.name,
              type: s.type,
              severity: s.severity,
              probability: s.probability,
              source: s.source,
              regulator: s.regulator,
              parameters: s.parameters,
            })
          }}
        />
      )}
      {tab === 'extended' && (
        <StressTestSelector
          forcedTab="extended"
          showTabs={false}
          selectedScenario={selectedScenarioId}
          onScenarioSelect={(s) => {
            if (!s) {
              onClear?.()
              return
            }
            onSelect({
              id: s.id,
              name: s.name,
              type: s.type,
              severity: s.severity,
              probability: s.probability,
              source: s.source,
              regulator: s.regulator,
              parameters: s.parameters,
            })
          }}
        />
      )}
    </div>
  )
}

