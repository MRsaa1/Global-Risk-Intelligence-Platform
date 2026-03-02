/**
 * Active Incidents Panel
 *
 * Table of live incidents (earthquakes, fires, weather alerts) from
 * GET /api/v1/climate/active-incidents. Refreshes every 60s (same as globe LIVE layer).
 */
import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowPathIcon, ChevronDownIcon, ChevronUpIcon, FireIcon, MapPinIcon, CloudIcon } from '@heroicons/react/24/outline'

const API_BASE = '/api/v1'
const POLL_INTERVAL_MS = 60_000

export type ActiveIncidentFeature = {
  type: 'Feature'
  geometry: { type: string; coordinates: number[] | number[][] | number[][][] }
  properties: {
    type: 'earthquake' | 'fire' | 'weather_alert'
    severity: string
    title: string
    updated_at?: string
    magnitude?: number
    confidence?: number
    /** e.g. "3 city(ies), 12.5 B USD exposure" or "—" */
    infrastructure_impact?: string
    /** Probable damage in USD (by severity) for infrastructure in zone */
    estimated_damage_usd?: number | null
    exposure_b?: number
    cities_in_zone?: number
    /** Region/cities the impact and damage refer to, e.g. "Japan: Tokyo, Yokohama" */
    affected_region?: string
    affected_city_names?: string[]
  }
}

export type ActiveIncidentsResponse = {
  type: 'FeatureCollection'
  features: ActiveIncidentFeature[]
  metadata?: { cached?: boolean; updated_at?: string; count?: number }
}

function typeLabel(type: string): string {
  if (type === 'earthquake') return 'Earthquake'
  if (type === 'fire') return 'Fire'
  if (type === 'weather_alert') return 'Weather'
  return type
}

function typeIcon(type: string) {
  if (type === 'earthquake') return <MapPinIcon className="w-3.5 h-3.5 text-amber-400/80" />
  if (type === 'fire') return <FireIcon className="w-3.5 h-3.5 text-red-400/80" />
  if (type === 'weather_alert') return <CloudIcon className="w-3.5 h-3.5 text-yellow-400/80" />
  return null
}

function severityColor(severity: string): string {
  switch (severity) {
    case 'extreme': return 'text-red-400/80'
    case 'severe': return 'text-orange-400/80'
    case 'moderate': return 'text-amber-400/80'
    case 'minor': return 'text-zinc-400'
    default: return 'text-zinc-300'
  }
}

function formatUpdated(updated_at?: string): string {
  if (!updated_at) return '—'
  try {
    const d = new Date(updated_at)
    if (isNaN(d.getTime())) return updated_at
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMin = Math.floor(diffMs / 60_000)
    if (diffMin < 1) return 'Just now'
    if (diffMin < 60) return `${diffMin}m ago`
    const diffH = Math.floor(diffMin / 60)
    if (diffH < 24) return `${diffH}h ago`
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return updated_at
  }
}

const SEVERITY_ORDER: Record<string, number> = { extreme: 0, severe: 1, moderate: 2, minor: 3 }
const TYPE_ORDER: Record<string, number> = { earthquake: 0, fire: 1, weather_alert: 2 }

function sortBySeverityAndType(features: ActiveIncidentFeature[]): ActiveIncidentFeature[] {
  return [...features].sort((a, b) => {
    const sa = SEVERITY_ORDER[a.properties?.severity ?? ''] ?? 4
    const sb = SEVERITY_ORDER[b.properties?.severity ?? ''] ?? 4
    if (sa !== sb) return sa - sb
    const ta = TYPE_ORDER[a.properties?.type ?? ''] ?? 3
    const tb = TYPE_ORDER[b.properties?.type ?? ''] ?? 3
    return ta - tb
  })
}

function formatDamageUsd(usd: number | null | undefined): string {
  if (usd == null || usd === 0) return '—'
  if (usd >= 1e9) return `$${(usd / 1e9).toFixed(2)}B`
  if (usd >= 1e6) return `$${(usd / 1e6).toFixed(1)}M`
  if (usd >= 1e3) return `$${(usd / 1e3).toFixed(1)}K`
  return `$${Math.round(usd)}`
}

interface ActiveIncidentsPanelProps {
  /** When false, panel is not rendered (e.g. when LIVE layer is off) */
  visible?: boolean
  /** Collapsible: start collapsed */
  defaultCollapsed?: boolean
  /** Max height of table body (scroll) */
  maxHeight?: string
  className?: string
}

export default function ActiveIncidentsPanel({
  visible = true,
  defaultCollapsed = false,
  maxHeight = '240px',
  className = '',
}: ActiveIncidentsPanelProps) {
  const [data, setData] = useState<ActiveIncidentsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  const fetchIncidents = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/climate/active-incidents`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json: ActiveIncidentsResponse = await res.json()
      setData(json)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!visible) return
    fetchIncidents()
    const interval = setInterval(fetchIncidents, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [visible, fetchIncidents])

  if (!visible) return null

  const rawFeatures = data?.features ?? []
  const features = sortBySeverityAndType(rawFeatures as ActiveIncidentFeature[])
  const meta = data?.metadata

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-md bg-zinc-900 border border-zinc-800 overflow-hidden ${className}`}
    >
      <button
        type="button"
        onClick={() => setCollapsed((c) => !c)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 text-left hover:bg-zinc-800 transition-colors"
      >
        <span className="flex items-center gap-2 text-zinc-100 text-xs font-medium">
          <span className="text-red-400/80 font-semibold">LIVE</span>
          <span>Active Incidents</span>
          {meta?.updated_at && (
            <span className="text-zinc-500 text-[10px] font-normal">
              Updated {formatUpdated(meta.updated_at)}
            </span>
          )}
        </span>
        <span className="flex items-center gap-1">
          {loading && (
            <ArrowPathIcon className="w-3.5 h-3.5 text-zinc-500 animate-spin" />
          )}
          {collapsed ? (
            <ChevronDownIcon className="w-4 h-4 text-zinc-500" />
          ) : (
            <ChevronUpIcon className="w-4 h-4 text-zinc-500" />
          )}
        </span>
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="border-t border-zinc-700"
          >
            {error && (
              <div className="px-3 py-2 text-red-400/90 text-[11px]">
                {error}
              </div>
            )}
            {!error && features.length === 0 && !loading && (
              <div className="px-3 py-4 text-zinc-500 text-[11px] text-center">
                No active incidents in the last 24h
              </div>
            )}
            {!error && features.length > 0 && (
              <div
                className="overflow-y-auto overflow-x-auto"
                style={{ maxHeight }}
              >
                <table className="w-full text-[11px] border-collapse">
                  <thead className="sticky top-0 bg-zinc-900/95 z-10">
                    <tr className="text-zinc-500 font-medium uppercase tracking-wider">
                      <th className="text-left py-1.5 pl-3 pr-2 w-8" aria-label="Type" />
                      <th className="text-left py-1.5 pl-2 pr-2">Type</th>
                      <th className="text-left py-1.5 pl-2 pr-2">Severity</th>
                      <th className="text-left py-1.5 pl-2 pr-2 min-w-[100px]">Title</th>
                      <th className="text-left py-1.5 pl-2 pr-2 min-w-[100px]">Region</th>
                      <th className="text-left py-1.5 pl-2 pr-2 min-w-[90px]">Impact</th>
                      <th className="text-right py-1.5 pl-2 pr-2 whitespace-nowrap">Est. damage</th>
                      <th className="text-right py-1.5 pl-2 pr-3 whitespace-nowrap">Updated</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-200">
                    {features.map((f, i) => (
                      <tr
                        key={`${f.properties?.type}-${i}-${f.properties?.title?.slice(0, 20)}`}
                        className="border-t border-zinc-800 hover:bg-zinc-800"
                      >
                        <td className="py-1.5 pl-3 pr-2">
                          {typeIcon(f.properties?.type ?? '')}
                        </td>
                        <td className="py-1.5 pl-2 pr-2 text-zinc-300">
                          {typeLabel(f.properties?.type ?? '')}
                        </td>
                        <td className={`py-1.5 pl-2 pr-2 capitalize ${severityColor(f.properties?.severity ?? '')}`}>
                          {f.properties?.severity ?? '—'}
                        </td>
                        <td className="py-1.5 pl-2 pr-2 truncate max-w-[120px]" title={f.properties?.title}>
                          {f.properties?.title ?? '—'}
                        </td>
                        <td className="py-1.5 pl-2 pr-2 text-zinc-300 text-[10px] truncate max-w-[130px]" title={f.properties?.affected_region ?? (f.properties?.affected_city_names?.length ? f.properties.affected_city_names.join(', ') : '—')}>
                          {f.properties?.affected_region ?? '—'}
                        </td>
                        <td className="py-1.5 pl-2 pr-2 text-zinc-400 text-[10px]" title={f.properties?.infrastructure_impact}>
                          {f.properties?.infrastructure_impact ?? '0 cities in zone'}
                        </td>
                        <td className="py-1.5 pl-2 pr-2 text-right text-amber-400/90 font-medium whitespace-nowrap">
                          {formatDamageUsd(f.properties?.estimated_damage_usd ?? 0)}
                        </td>
                        <td className="py-1.5 pl-2 pr-3 text-right text-zinc-500 whitespace-nowrap">
                          {formatUpdated(f.properties?.updated_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
