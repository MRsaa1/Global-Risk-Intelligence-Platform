/**
 * Compact panel for a real-time data source: last refresh time and status.
 * Used for natural_hazards, weather, biosecurity, cyber_threats, economic in Real-Time Intelligence.
 * When no refresh yet (—), shows "Sync" to trigger ingestion so this source gets a timestamp.
 * Shows last events (or demo events when empty) so the card is not blank.
 */
import { useState } from 'react'
import { ArrowPathIcon } from '@heroicons/react/24/outline'
import { usePlatformStore } from '../../store/platformStore'
import { getApiV1Base } from '../../config/env'

const INGESTION_REFRESH_PATH = '/ingestion/refresh-all'

// Demo events per source when no live data — so each card shows content
const DEMO_EVENTS: Record<string, Record<string, unknown>[]> = {
  natural_hazards: [
    { type: 'earthquake', magnitude: 4.2, region: 'Pacific', source: 'USGS' },
    { type: 'wildfire', severity: 'moderate', region: 'Western US', source: 'NASA FIRMS' },
  ],
  weather: [
    { type: 'forecast', temp_min: 12, temp_max: 22, conditions: 'Partly cloudy', source: 'Open-Meteo' },
  ],
  biosecurity: [
    { type: 'outbreak', pathogen: 'Influenza', cases_7d: 120, region: 'Global', source: 'WHO' },
  ],
  cyber_threats: [
    { type: 'kev', cve: 'CVE-2024-XXXX', vendor: 'Example', source: 'CISA KEV' },
  ],
  economic: [
    { type: 'sanctions', source: 'OFAC', count: 0 },
    { type: 'indicator', indicator: 'GDP growth', value: 2.1, source: 'World Bank' },
  ],
}

function minutesAgo(isoTimestamp: string | undefined): number | null {
  if (!isoTimestamp) return null
  const t = new Date(isoTimestamp).getTime()
  if (Number.isNaN(t)) return null
  return (Date.now() - t) / (60 * 1000)
}

function formatAgo(minutesAgo: number | null): string {
  if (minutesAgo == null) return '—'
  if (minutesAgo < 1) return 'just now'
  if (minutesAgo < 60) return `${Math.round(minutesAgo)}m ago`
  return `${Math.round(minutesAgo / 60)}h ago`
}

function stalenessColor(minutesAgo: number | null): string {
  if (minutesAgo == null) return 'text-zinc-500'
  if (minutesAgo < 5) return 'text-emerald-400/80'
  if (minutesAgo < 15) return 'text-amber-400/80'
  return 'text-red-400/80'
}

export interface DataSourcePanelProps {
  sourceId: string
  title: string
  description: string
  icon?: React.ReactNode
}

export default function DataSourcePanel({ sourceId, title, description, icon }: DataSourcePanelProps) {
  const lastRefreshBySource = usePlatformStore((s) => s.lastRefreshBySource)
  const lastSnapshotBySource = usePlatformStore((s) => s.lastSnapshotBySource)
  const setLastRefresh = usePlatformStore((s) => s.setLastRefresh)
  const ts = lastRefreshBySource[sourceId]
  const mins = minutesAgo(ts)
  const noDataYet = mins == null
  const [syncing, setSyncing] = useState(false)

  const snapshot = lastSnapshotBySource[sourceId]
  const events = (snapshot?.last_events ?? []) as Record<string, unknown>[]
  const demoEvents = DEMO_EVENTS[sourceId] ?? []
  const displayEvents = events.length > 0 ? events.slice(0, 2) : demoEvents.slice(0, 2)
  const isDemo = events.length === 0 && displayEvents.length > 0

  const runSync = async () => {
    setSyncing(true)
    try {
      const base = getApiV1Base()
      const url = base ? `${base}${INGESTION_REFRESH_PATH}` : `/api/v1${INGESTION_REFRESH_PATH}`
      const res = await fetch(url, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      const finishedAt = data?.finished_at
      const results = data?.results
      if (res.ok && typeof finishedAt === 'string' && typeof setLastRefresh === 'function') {
        const sourceIds = results && typeof results === 'object' ? Object.keys(results) : [sourceId]
        for (const sid of sourceIds) {
          const r = results?.[sid]
          const ts = (r && r.success !== false && r?.summary?.updated_at) ? r.summary.updated_at : finishedAt
          setLastRefresh(sid, ts)
        }
      }
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="rounded-md bg-zinc-900 border border-zinc-800 p-4">
      <div className="flex items-center justify-between gap-2 mb-1">
        <h3 className="text-sm font-display font-semibold text-zinc-300 flex items-center gap-2">
          {icon}
          {title}
        </h3>
        <span className={`text-xs font-mono ${stalenessColor(mins)}`}>
          {formatAgo(mins)}
        </span>
      </div>
      <p className="text-[11px] text-zinc-500">{description}</p>
      <div className="mt-2 flex items-center gap-2">
        {(noDataYet || mins != null) && (
          <button
            type="button"
            onClick={runSync}
            disabled={syncing}
            className="inline-flex items-center gap-1 text-[10px] text-amber-400/90 hover:text-amber-400/80 disabled:opacity-50"
          >
            <ArrowPathIcon className={`w-3 h-3 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Syncing…' : noDataYet ? 'Sync' : 'Refresh'}
          </button>
        )}
      </div>
      {displayEvents.length > 0 && (
        <div className="mt-3 pt-2 border-t border-zinc-800 space-y-1.5">
          {isDemo && (
            <p className="text-[10px] text-zinc-500 mb-1">Demo — run Sync for live data</p>
          )}
          {displayEvents.map((evt, i) => {
            const type = (evt.type as string) || 'event'
            const keys = Object.keys(evt).filter((k) => k !== 'type' && evt[k] != null)
            return (
              <div
                key={`${sourceId}-${i}`}
                className="p-1.5 rounded bg-zinc-800/50 border border-zinc-800 text-[10px] text-zinc-400"
              >
                <span className="font-mono text-zinc-500 uppercase">{type}</span>
                {keys.length > 0 && (
                  <span className="ml-1">
                    {keys.slice(0, 3).map((k, idx, arr) => (
                      <span key={k}>
                        {k}: {typeof evt[k] === 'object' ? JSON.stringify(evt[k]).slice(0, 24) : String(evt[k])}
                        {idx < arr.length - 1 ? ' · ' : ''}
                      </span>
                    ))}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
