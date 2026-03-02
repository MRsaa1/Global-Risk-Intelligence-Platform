/**
 * Live Data Indicator Bar (Phase 7.2).
 * Thin bar showing freshness per source; staleness colors (green < 5min, yellow < 15min, red > 15min).
 * Uses lastRefreshBySource from WebSocket DATA_REFRESH_COMPLETED and marketData['VIX'].
 */
import { useMemo } from 'react'
import { usePlatformStore } from '../../store/platformStore'

const SOURCES: { id: string; label: string; sourceKey: string }[] = [
  { id: 'gdelt', label: 'GDELT', sourceKey: 'threat_intelligence' },
  { id: 'usgs', label: 'USGS', sourceKey: 'natural_hazards' },
  { id: 'vix', label: 'VIX', sourceKey: 'market_data' },
  { id: 'nws', label: 'NWS', sourceKey: 'natural_hazards' },
]

function stalenessColor(minutesAgo: number | null): string {
  if (minutesAgo == null) return 'text-zinc-500'
  if (minutesAgo < 5) return 'text-emerald-400/80'
  if (minutesAgo < 15) return 'text-amber-400/80'
  return 'text-red-400/80'
}

function formatAgo(minutesAgo: number | null): string {
  if (minutesAgo == null) return '—'
  if (minutesAgo < 1) return 'just now'
  if (minutesAgo < 60) return `${Math.round(minutesAgo)}m ago`
  return `${Math.round(minutesAgo / 60)}h ago`
}

function minutesAgo(isoTimestamp: string | undefined): number | null {
  if (!isoTimestamp) return null
  const t = new Date(isoTimestamp).getTime()
  if (Number.isNaN(t)) return null
  return (Date.now() - t) / (60 * 1000)
}

export default function LiveDataIndicatorBar() {
  const marketData = usePlatformStore((s) => s.marketData)
  const lastRefreshBySource = usePlatformStore((s) => s.lastRefreshBySource)
  const vix = marketData['VIX'] ?? marketData['^VIX']

  const sourceMinutes = useMemo(() => {
    const out: Record<string, number | null> = {}
    for (const { id, sourceKey } of SOURCES) {
      out[id] = minutesAgo(lastRefreshBySource[sourceKey]) ?? null
    }
    return out
  }, [lastRefreshBySource])

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-1.5 rounded-md bg-zinc-900/80 border border-zinc-800 text-xs">
      {SOURCES.map(({ id, label }) => (
        <span key={id} className="flex items-center gap-1.5">
          <span className="text-zinc-500">{label}:</span>
          {id === 'vix' && vix != null ? (
            <span className="text-zinc-300 font-mono">{Number(vix).toFixed(1)}</span>
          ) : (
            <span className={stalenessColor(sourceMinutes[id] ?? null)}>
              {formatAgo(sourceMinutes[id] ?? null)}
            </span>
          )}
        </span>
      ))}
    </div>
  )
}
