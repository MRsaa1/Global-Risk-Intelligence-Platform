import { useMemo, useState } from 'react'
import StressTestSelector from './StressTestSelector'
import { CURRENT_EVENTS, FORECAST_SCENARIOS } from '../../lib/riskEventCatalog'
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

interface UnifiedStressTestSelectorProps {
  selectedScenarioId: string | null
  onSelect: (scenario: UnifiedSelectedScenario) => void
  onClear?: () => void
}

export default function UnifiedStressTestSelector({
  selectedScenarioId,
  onSelect,
  onClear,
}: UnifiedStressTestSelectorProps) {
  const [tab, setTab] = useState<UnifiedTab>('current')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [horizon, setHorizon] = useState<number | null>(null)

  const forecastHorizonLabel = useMemo(() => {
    if (horizon == null) return ''
    return FORECAST_SCENARIOS.find((f) => f.horizon === horizon)?.name || `${horizon}yr Scenarios`
  }, [horizon])

  return (
    <div className="space-y-2">
      {/* Top-level tabs */}
      <div className="flex gap-1 p-0.5 rounded-lg bg-white/5 border border-white/10">
        <button
          onClick={() => {
            setTab('current')
            setCategoryId(null)
            setHorizon(null)
          }}
          className={`flex-1 text-[10px] uppercase tracking-wider py-1.5 px-2 rounded ${
            tab === 'current'
              ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
              : 'text-white/50 hover:text-white/70'
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
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
              : 'text-white/50 hover:text-white/70'
          }`}
        >
          Forecast
        </button>
        <button
          onClick={() => {
            setTab('regulatory')
            setCategoryId(null)
            setHorizon(null)
          }}
          className={`flex-1 text-[10px] uppercase tracking-wider py-1.5 px-2 rounded ${
            tab === 'regulatory'
              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/35'
              : 'text-white/50 hover:text-white/70'
          }`}
        >
          Regulatory Library
        </button>
        <button
          onClick={() => {
            setTab('extended')
            setCategoryId(null)
            setHorizon(null)
          }}
          className={`flex-1 text-[10px] uppercase tracking-wider py-1.5 px-2 rounded ${
            tab === 'extended'
              ? 'bg-sky-500/15 text-sky-300 border border-sky-500/35'
              : 'text-white/50 hover:text-white/70'
          }`}
        >
          Extended
        </button>
      </div>

      {/* Current */}
      {tab === 'current' && (
        <div className="max-h-[320px] overflow-y-auto custom-scrollbar pr-1 space-y-1">
          {!categoryId ? (
            <>
              <div className="text-white/30 text-[10px] px-2 py-1 uppercase tracking-wider">
                Current Event Categories
              </div>
              {CURRENT_EVENTS.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryId(cat.id)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 transition-all text-left group"
                >
                  <span className="text-white/70 text-xs group-hover:text-white flex-1">
                    {cat.name}
                  </span>
                  <span className="text-white/30 text-[10px]">{cat.events.length}</span>
                </button>
              ))}
            </>
          ) : (
            <>
              <button
                onClick={() => setCategoryId(null)}
                className="w-full flex items-center gap-1 px-2 py-1 text-white/40 text-[10px] hover:text-white/60"
              >
                ← Back to categories
              </button>
              <div className="text-white/30 text-[10px] px-2 py-1 uppercase tracking-wider">
                {CURRENT_EVENTS.find((c) => c.id === categoryId)?.name || 'Events'}
              </div>
              {(CURRENT_EVENTS.find((c) => c.id === categoryId)?.events ?? []).map((ev) => (
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
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 transition-all text-left group ${
                    selectedScenarioId === ev.id ? 'bg-white/10' : ''
                  }`}
                >
                  <span className="text-white/70 text-xs group-hover:text-white flex-1">{ev.name}</span>
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] ${
                      hasZoneEntities(categoryId)
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-white/10 text-white/50 border border-white/10'
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
              <div className="text-white/30 text-[10px] px-2 py-1 uppercase tracking-wider">
                Forecast Horizons
              </div>
              {FORECAST_SCENARIOS.map((period) => (
                <button
                  key={period.horizon}
                  onClick={() => setHorizon(period.horizon)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 transition-all text-left group"
                >
                  <span className="text-white/70 text-xs group-hover:text-white flex-1">
                    {period.name}
                  </span>
                  <span className="text-white/30 text-[10px]">{period.scenarios.length}</span>
                </button>
              ))}
            </>
          ) : (
            <>
              <button
                onClick={() => setHorizon(null)}
                className="w-full flex items-center gap-1 px-2 py-1 text-white/40 text-[10px] hover:text-white/60"
              >
                ← Back to horizons
              </button>
              <div className="text-white/30 text-[10px] px-2 py-1 uppercase tracking-wider">
                {forecastHorizonLabel}
              </div>
              {(FORECAST_SCENARIOS.find((f) => f.horizon === horizon)?.scenarios ?? []).map((sc) => (
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
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/5 transition-all text-left group ${
                    selectedScenarioId === sc.id ? 'bg-white/10' : ''
                  }`}
                >
                  <span className="text-white/70 text-xs group-hover:text-white flex-1">{sc.name}</span>
                  <span
                    className={`shrink-0 px-1.5 py-0.5 rounded text-[9px] ${
                      hasZoneEntities(sc.type)
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-white/10 text-white/50 border border-white/10'
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

