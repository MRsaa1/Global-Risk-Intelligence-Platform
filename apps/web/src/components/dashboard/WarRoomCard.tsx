/**
 * War Room Card — Board-ready executive decision card.
 *
 * 3 risks, 3 actions, 1 priority for today.
 * Dark executive design. Export-friendly.
 */
import { useQuery } from '@tanstack/react-query'
import {
  ShieldExclamationIcon,
  BoltIcon,
  StarIcon,
  DocumentArrowDownIcon,
} from '@heroicons/react/24/outline'
import { getWarRoomCard, type WarRoomCardResponse } from '../../services/dashboardApi'

const SEVERITY_STYLE: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-300 border-red-500/30',
  high: 'bg-orange-500/15 text-orange-300 border-orange-500/25',
  medium: 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  low: 'bg-zinc-700/50 text-zinc-400 border-zinc-600',
}

const PRIORITY_STYLE: Record<string, string> = {
  immediate: 'bg-red-500/15 text-red-300 border-red-500/25',
  'short-term': 'bg-amber-500/15 text-amber-300 border-amber-500/25',
  'medium-term': 'bg-zinc-700/50 text-zinc-400 border-zinc-600',
}

function WarRoomContent({ data }: { data: WarRoomCardResponse }) {
  return (
    <div className="space-y-4">
      {/* Today's Priority */}
      <div className="p-3 rounded-md bg-zinc-800 border border-zinc-700">
        <div className="flex items-center gap-1.5 mb-1.5">
          <StarIcon className="w-4 h-4 text-zinc-400" />
          <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
            Today's Priority
          </span>
        </div>
        <p className="text-sm font-semibold text-zinc-100 leading-snug">
          {data.today_priority.title}
        </p>
        {data.today_priority.reason && (
          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">
            {data.today_priority.reason}
          </p>
        )}
      </div>

      {/* 3 Risks */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <ShieldExclamationIcon className="w-3.5 h-3.5 text-red-400/80" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-medium">
            Top Risks
          </span>
        </div>
        <div className="space-y-1.5">
          {data.top_risks.map((risk, i) => (
            <div key={i} className="flex items-center gap-2">
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded border font-medium whitespace-nowrap ${
                  SEVERITY_STYLE[risk.severity] || SEVERITY_STYLE.medium
                }`}
              >
                {risk.severity.toUpperCase()}
              </span>
              <span className="text-xs text-zinc-300 truncate">{risk.name}</span>
            </div>
          ))}
          {data.top_risks.length === 0 && (
            <p className="text-xs text-zinc-600">No critical risks detected.</p>
          )}
        </div>
      </div>

      {/* 3 Actions */}
      <div>
        <div className="flex items-center gap-1.5 mb-2">
          <BoltIcon className="w-3.5 h-3.5 text-emerald-400/80" />
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 font-medium">
            Actions
          </span>
        </div>
        <div className="space-y-1.5">
          {data.actions.map((action, i) => (
            <div key={i} className="flex items-start gap-2">
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded border font-medium whitespace-nowrap mt-0.5 ${
                  PRIORITY_STYLE[action.priority] || PRIORITY_STYLE['medium-term']
                }`}
              >
                {action.priority.toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="text-xs text-zinc-300">{action.action}</p>
                {action.impact && (
                  <p className="text-[10px] text-zinc-600 mt-0.5">{action.impact}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer: data sources + timestamp */}
      <div className="flex items-center justify-between border-t border-zinc-800 pt-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          {data.data_sources.map((src) => (
            <span
              key={src}
              className="text-[9px] px-1 py-0.5 bg-zinc-800 text-zinc-500 rounded"
            >
              {src}
            </span>
          ))}
        </div>
        <span className="text-[9px] text-zinc-600">
          {new Date(data.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
    </div>
  )
}

interface WarRoomCardProps {
  /** If true, show compact version for dashboard grid */
  compact?: boolean
}

export default function WarRoomCard({ compact }: WarRoomCardProps) {
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard', 'war-room-card'],
    queryFn: ({ signal }) => getWarRoomCard(signal),
    refetchInterval: 120_000,
    staleTime: 60_000,
    retry: 1,
  })

  return (
    <div
      className={`rounded-md bg-zinc-900 border border-zinc-800 p-4 relative overflow-hidden ${
        compact ? 'h-full' : ''
      }`}
    >
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-zinc-700" />

      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-display font-semibold text-zinc-300">War Room</h3>
          <span className="text-[9px] px-1.5 py-0.5 bg-zinc-800 text-zinc-500 rounded-full">
            Board-ready
          </span>
        </div>
        {data && (
          <button
            type="button"
            className="text-zinc-600 hover:text-zinc-400 transition-colors"
            title="Export to PDF"
            onClick={() => {
              // Future: wire to /api/v1/exports/pdf endpoint
              window.print()
            }}
          >
            <DocumentArrowDownIcon className="w-4 h-4" />
          </button>
        )}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-zinc-500 text-xs">
          <span className="w-4 h-4 border border-zinc-600 border-t-red-500 rounded-full animate-spin" />
          Generating…
        </div>
      )}
      {error && (
        <div className="text-xs text-amber-400/90">
          <p>{error instanceof Error && error.name === 'AbortError' ? 'Request timed out.' : 'Unable to generate war room card.'}</p>
          <button type="button" onClick={() => refetch()} disabled={isRefetching} className="mt-1 underline hover:no-underline disabled:opacity-50">
            {isRefetching ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      )}
      {data && !isLoading && <WarRoomContent data={data} />}
    </div>
  )
}
