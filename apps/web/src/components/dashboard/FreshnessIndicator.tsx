/**
 * Shows data freshness: "Updated X min ago" and optional "Stale" when older than TTL.
 * Use next to section headers so investors can see which data is current.
 */
interface FreshnessIndicatorProps {
  /** ISO timestamp or Date of last update */
  timestamp: string | Date | null | undefined
  /** Consider data stale after this many minutes */
  ttlMinutes?: number
  /** Optional label prefix, e.g. "Data" */
  label?: string
  className?: string
}

function minutesAgo(ts: string | Date): number {
  const t = typeof ts === 'string' ? new Date(ts).getTime() : ts.getTime()
  return Math.floor((Date.now() - t) / 60_000)
}

export default function FreshnessIndicator({
  timestamp,
  ttlMinutes = 30,
  label = 'Updated',
  className = '',
}: FreshnessIndicatorProps) {
  if (!timestamp) return null
  const mins = minutesAgo(timestamp)
  const isStale = mins > ttlMinutes
  return (
    <span
      className={`text-[10px] text-zinc-500 ${className}`}
      title={typeof timestamp === 'string' ? timestamp : timestamp.toISOString()}
    >
      {label} {mins < 1 ? 'just now' : mins === 1 ? '1 min ago' : `${mins} min ago`}
      {isStale && (
        <span className="ml-1.5 px-1 py-0.5 rounded bg-amber-500/20 text-amber-400/80">Stale</span>
      )}
    </span>
  )
}
