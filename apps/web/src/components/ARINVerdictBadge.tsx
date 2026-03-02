/**
 * ARINVerdictBadge — compact badge displaying the ARIN unified verdict
 * (BUY / SELL / HOLD / AVOID) with risk_score and confidence.
 *
 * Fetches from GET /api/v1/arin/verdict/{entityId}.
 * Handles loading, error, and "not configured" states gracefully.
 */
import { useQuery } from '@tanstack/react-query'
import { ShieldCheckIcon } from '@heroicons/react/24/solid'
import { arinApi } from '../lib/api'
import type { ARINVerdictResponse } from '../lib/api'

const VERDICT_STYLE: Record<string, { bg: string; text: string; ring: string }> = {
  BUY:   { bg: 'bg-emerald-500/15', text: 'text-emerald-400/80', ring: 'ring-emerald-500/30' },
  SELL:  { bg: 'bg-red-500/15',     text: 'text-red-400/80',     ring: 'ring-red-500/30' },
  HOLD:  { bg: 'bg-amber-500/15',   text: 'text-amber-400/80',   ring: 'ring-amber-500/30' },
  AVOID: { bg: 'bg-rose-600/15',    text: 'text-rose-400/80',    ring: 'ring-rose-600/30' },
}

const DEFAULT_STYLE = { bg: 'bg-zinc-500/15', text: 'text-zinc-400', ring: 'ring-zinc-500/30' }

export interface ARINVerdictBadgeProps {
  /** Entity ID to fetch verdict for (zone_*, asset_*, portfolio_*, scenario_*) */
  entityId: string
  /** Compact variant hides risk_score and confidence */
  compact?: boolean
  /** Additional CSS classes */
  className?: string
}

export default function ARINVerdictBadge({ entityId, compact = false, className = '' }: ARINVerdictBadgeProps) {
  const { data, isLoading, isError } = useQuery<ARINVerdictResponse>({
    queryKey: ['arin-verdict', entityId],
    queryFn: () => arinApi.getVerdict(entityId),
    enabled: !!entityId,
    staleTime: 60_000,           // cache for 1 min
    retry: 1,
    refetchOnWindowFocus: false,
  })

  // Loading
  if (isLoading) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-zinc-700/40 text-zinc-500 animate-pulse ${className}`}>
        <ShieldCheckIcon className="h-3.5 w-3.5" />
        ARIN…
      </span>
    )
  }

  // Error or not configured
  if (isError || !data || !data.configured) {
    return (
      <span
        className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium bg-zinc-700/30 text-zinc-500 ring-1 ring-inset ring-zinc-600/20 ${className}`}
        title={!data?.configured ? 'ARIN not configured' : 'ARIN verdict unavailable'}
      >
        <ShieldCheckIcon className="h-3.5 w-3.5" />
        ARIN
      </span>
    )
  }

  const style = VERDICT_STYLE[data.verdict] ?? DEFAULT_STYLE

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${style.bg} ${style.text} ${style.ring} ${className}`}
      title={`ARIN verdict: ${data.verdict} | Risk: ${data.risk_score} | Confidence: ${(data.confidence * 100).toFixed(0)}%`}
    >
      <ShieldCheckIcon className="h-3.5 w-3.5" />
      {data.verdict}
      {!compact && (
        <>
          <span className="opacity-50">|</span>
          <span className="font-mono tabular-nums">{data.risk_score.toFixed(0)}</span>
          <span className="opacity-40 text-[10px]">{(data.confidence * 100).toFixed(0)}%</span>
        </>
      )}
    </span>
  )
}
