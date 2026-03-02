/**
 * Threat Intel Feed — Real-time threat signals from social/GDELT.
 * Uses getApiV1Base() so Sync works on server and with tunnel (?api=).
 */
import { useState, useMemo } from 'react'
import { ShieldExclamationIcon, FunnelIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import type { ThreatSignal } from '../../types/events'
import { usePlatformStore } from '../../store/platformStore'
import { getApiV1Base } from '../../config/env'

const RISK_TYPES = ['geopolitical', 'financial', 'cyber', 'biosecurity', 'infrastructure', ''] as const
const SOURCES = ['twitter', 'reddit', 'telegram', 'gdelt', ''] as const

function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function threatLevelColor(level?: number): string {
  if (level == null) return 'text-zinc-400'
  if (level >= 0.8) return 'text-red-400/80'
  if (level >= 0.5) return 'text-amber-400/80'
  return 'text-zinc-400'
}

export default function ThreatIntelFeed() {
  const threatFeed = usePlatformStore((s) => s.threatFeed)
  const setLastRefresh = usePlatformStore((s) => s.setLastRefresh)
  const [riskTypeFilter, setRiskTypeFilter] = useState<string>('')
  const [sourceFilter, setSourceFilter] = useState<string>('')
  const [sentimentMin, setSentimentMin] = useState<string>('')
  const [signalFirst, setSignalFirst] = useState<boolean>(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)

  const runSync = async () => {
    setSyncing(true)
    setSyncMessage(null)
    try {
      const base = getApiV1Base()
      const refreshUrl = base ? `${base}/ingestion/refresh-all` : '/api/v1/ingestion/refresh-all'
      const res = await fetch(refreshUrl, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data?.success) {
        const finishedAt = data.finished_at
        const results = data.results
        if (typeof setLastRefresh === 'function' && typeof finishedAt === 'string' && results && typeof results === 'object') {
          const sourceIds = Object.keys(results)
          for (const sid of sourceIds) {
            const r = results[sid]
            const ts = (r && (r as { summary?: { updated_at?: string } })?.summary?.updated_at) ?? finishedAt
            setLastRefresh(sid, ts)
          }
        }
        setSyncMessage(`Sync started. ${data.ok_sources ?? 0}/${data.total_sources ?? 0} sources ran. Signals and timestamps will update via WebSocket.`)
      } else {
        setSyncMessage('Sync request sent. Check connection and API logs if nothing appears.')
      }
    } catch {
      setSyncMessage('Sync failed. Is the API running on port 9002?')
    } finally {
      setSyncing(false)
    }
  }

  const filtered = useMemo(() => {
    let list = threatFeed
    if (riskTypeFilter) list = list.filter((s) => s.risk_type === riskTypeFilter)
    if (sourceFilter) list = list.filter((s) => s.source === sourceFilter)
    if (sentimentMin !== '') {
      const v = parseFloat(sentimentMin)
      if (!isNaN(v)) list = list.filter((s) => (s.sentiment_score ?? 0) >= v)
    }
    if (signalFirst) {
      list = [...list].sort((a, b) => (b.signal_score ?? 0) - (a.signal_score ?? 0))
    }
    return list.slice(0, 50)
  }, [threatFeed, riskTypeFilter, sourceFilter, sentimentMin, signalFirst])

  return (
    <div className="rounded-md bg-zinc-900 border border-zinc-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-display font-semibold text-zinc-300 flex items-center gap-2">
          <ShieldExclamationIcon className="w-4 h-4 text-amber-400/80" />
          Real-Time Threat Feed
        </h3>
        <span className="text-xs text-zinc-500">{filtered.length} signals</span>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-3">
        <div className="flex items-center gap-1 text-zinc-500">
          <FunnelIcon className="w-3.5 h-3.5" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Filters</span>
        </div>
        <select
          value={riskTypeFilter}
          onChange={(e) => setRiskTypeFilter(e.target.value)}
          className="bg-zinc-800/80 border border-zinc-700 rounded-md text-xs text-zinc-300 px-2 py-1 focus:ring-1 focus:ring-amber-500/50"
        >
          <option value="">All risk types</option>
          {RISK_TYPES.filter(Boolean).map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
        <select
          value={sourceFilter}
          onChange={(e) => setSourceFilter(e.target.value)}
          className="bg-zinc-800/80 border border-zinc-700 rounded-md text-xs text-zinc-300 px-2 py-1 focus:ring-1 focus:ring-amber-500/50"
        >
          <option value="">All sources</option>
          {SOURCES.filter(Boolean).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <input
          type="number"
          placeholder="Min sentiment"
          value={sentimentMin}
          onChange={(e) => setSentimentMin(e.target.value)}
          step={0.1}
          min={-1}
          max={1}
          className="w-24 bg-zinc-800/80 border border-zinc-700 rounded-md text-xs text-zinc-300 px-2 py-1 focus:ring-1 focus:ring-amber-500/50"
        />
        <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={signalFirst}
            onChange={(e) => setSignalFirst(e.target.checked)}
            className="rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500/50"
          />
          Signal first
        </label>
      </div>

      {/* Signal list */}
      <div className="max-h-64 overflow-y-auto space-y-2">
        {filtered.length === 0 ? (
          <div className="text-center py-6">
            <ShieldExclamationIcon className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
            <p className="text-xs text-zinc-500">Feed active — no signals in range</p>
            <p className="text-[10px] text-zinc-600 mt-1 max-w-xs mx-auto">
              Signals from GDELT, Reddit, USGS and other sources appear here after ingestion runs. Run sync to fetch now.
            </p>
            <button
              type="button"
              onClick={runSync}
              disabled={syncing}
              className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs transition-colors disabled:opacity-50"
            >
              <ArrowPathIcon className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing…' : 'Sync now'}
            </button>
            {syncMessage && (
              <p className="mt-2 text-[10px] text-zinc-500 max-w-xs mx-auto">{syncMessage}</p>
            )}
          </div>
        ) : (
          filtered.map((signal) => (
            <div
              key={signal.id ?? `${signal.timestamp}-${signal.source}`}
              className="p-2 rounded-md bg-zinc-800/50 border border-zinc-800 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{signal.source}</span>
                <span className="text-[10px] text-zinc-600">{formatTimeAgo(signal.timestamp)}</span>
              </div>
              <p className="text-xs text-zinc-300 mt-0.5 line-clamp-2">{signal.text}</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {signal.risk_type && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-700 text-zinc-400">{signal.risk_type}</span>
                )}
                {signal.sentiment_score != null && (
                  <span className="text-[10px] text-zinc-500">Sentiment: {signal.sentiment_score.toFixed(2)}</span>
                )}
                {signal.threat_level != null && (
                  <span className={`text-[10px] ${threatLevelColor(signal.threat_level)}`}>
                    Threat: {(signal.threat_level * 100).toFixed(0)}%
                  </span>
                )}
                {signal.signal_score != null && (
                  <span className="text-[10px] text-emerald-400/80">Signal: {(signal.signal_score * 100).toFixed(0)}%</span>
                )}
              </div>
              {signal.url && (
                <a
                  href={signal.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[10px] text-amber-400/90 hover:underline mt-1 inline-block truncate max-w-full"
                >
                  {signal.url}
                </a>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  )
}
