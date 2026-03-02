/**
 * RiskMirror — Today Card Widget
 *
 * Enhanced "start of day" card with:
 * - Focus / Top Risk / Don't Touch
 * - Source badges (News, Climate, Market, Alert)
 * - Morning Brief (LLM-synthesized)
 * - Signal feed
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ClipboardDocumentListIcon,
  ExclamationTriangleIcon,
  NoSymbolIcon,
  NewspaperIcon,
  SunIcon,
  CurrencyDollarIcon,
  BellAlertIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'
import { getTodayCard, type TodayCardResponse, type SignalSource } from '../../services/dashboardApi'

const SOURCE_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  news: { icon: NewspaperIcon, label: 'News', color: 'text-blue-400/80 bg-blue-500/10 border-blue-500/20' },
  climate: { icon: SunIcon, label: 'Climate', color: 'text-amber-400/80 bg-amber-500/10 border-amber-500/20' },
  market: { icon: CurrencyDollarIcon, label: 'Market', color: 'text-emerald-400/80 bg-emerald-500/10 border-emerald-500/20' },
  alert: { icon: BellAlertIcon, label: 'Alert', color: 'text-red-400/80 bg-red-500/10 border-red-500/20' },
}

const SEVERITY_COLOR: Record<string, string> = {
  critical: 'text-red-400/80',
  high: 'text-orange-400/80',
  medium: 'text-amber-400/80',
  low: 'text-zinc-500',
}

function SourceBadge({ source }: { source: string }) {
  const config = SOURCE_CONFIG[source]
  if (!config) return null
  const Icon = config.icon
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] font-medium ${config.color}`}>
      <Icon className="w-3 h-3" />
      {config.label}
    </span>
  )
}

function SignalItem({ signal }: { signal: SignalSource }) {
  const config = SOURCE_CONFIG[signal.type]
  const Icon = config?.icon || BellAlertIcon
  return (
    <div className="flex items-start gap-2 py-1">
      <Icon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${SEVERITY_COLOR[signal.severity] || 'text-zinc-500'}`} />
      <span className="text-[11px] text-zinc-400 leading-tight line-clamp-2">{signal.headline}</span>
    </div>
  )
}

function TodayCardContent({ data }: { data: TodayCardResponse }) {
  const [signalsOpen, setSignalsOpen] = useState(false)
  const hasSignals = data.signals && data.signals.length > 0

  return (
    <div className="space-y-3">
      {/* Source badges */}
      {data.sources && data.sources.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.sources.map((src) => (
            <SourceBadge key={src} source={src} />
          ))}
        </div>
      )}

      {/* Focus / Top Risk / Don't Touch */}
      <div className="flex items-start gap-2">
        <ClipboardDocumentListIcon className="w-4 h-4 text-amber-400/80 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Focus</span>
          <p className="text-sm font-medium text-zinc-200">{data.focus}</p>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <ExclamationTriangleIcon className="w-4 h-4 text-red-400/80 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Top risk</span>
          <p className="text-sm font-medium text-zinc-200">{data.top_risk}</p>
        </div>
      </div>
      <div className="flex items-start gap-2">
        <NoSymbolIcon className="w-4 h-4 text-emerald-400/80 flex-shrink-0 mt-0.5" />
        <div>
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Don't touch</span>
          <p className="text-sm font-medium text-zinc-200">{data.dont_touch}</p>
        </div>
      </div>

      {/* Morning Brief */}
      {data.morning_brief && (
        <div className="border-t border-zinc-800 pt-2 mt-2">
          <div className="flex items-center gap-1.5 mb-1">
            <SparklesIcon className="w-3.5 h-3.5 text-violet-400" />
            <span className="font-mono text-[10px] text-violet-400 uppercase tracking-widest font-medium">Morning Brief</span>
          </div>
          <p className="text-xs text-zinc-300 leading-relaxed">{data.morning_brief}</p>
        </div>
      )}

      {/* Main reason */}
      {data.main_reason && !data.morning_brief && (
        <p
          className="text-xs text-zinc-500 border-t border-zinc-800 pt-2 mt-2 line-clamp-4"
          title={data.main_reason}
        >
          {data.main_reason}
        </p>
      )}

      {/* Signal feed (collapsible) */}
      {hasSignals && (
        <div className="border-t border-zinc-800 pt-2 mt-1">
          <button
            type="button"
            onClick={() => setSignalsOpen((o) => !o)}
            className="flex items-center gap-1 text-[10px] text-zinc-500 hover:text-zinc-400 transition-colors w-full"
          >
            {signalsOpen ? (
              <ChevronUpIcon className="w-3 h-3" />
            ) : (
              <ChevronDownIcon className="w-3 h-3" />
            )}
            {data.signals.length} signal{data.signals.length !== 1 ? 's' : ''} detected
          </button>
          {signalsOpen && (
            <div className="mt-1.5 space-y-0.5 max-h-32 overflow-y-auto">
              {data.signals.map((signal, i) => (
                <SignalItem key={i} signal={signal} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function TodayCardWidget() {
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['dashboard', 'today-card'],
    queryFn: ({ signal }) => getTodayCard(signal),
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  })

  return (
    <div className="rounded-md bg-zinc-900 border border-zinc-800 p-4 h-full relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-0.5 bg-zinc-700" />
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-sm font-display font-semibold text-zinc-300">RiskMirror</h3>
        <span className="text-[9px] px-1.5 py-0.5 bg-zinc-800 text-zinc-500 rounded-full">Today</span>
      </div>
      {isLoading && (
        <div className="flex items-center gap-2 text-zinc-500 text-xs">
          <span className="w-4 h-4 border border-zinc-600 border-t-amber-500 rounded-full animate-spin" />
          Loading…
        </div>
      )}
      {error && (
        <div className="text-xs text-amber-400/90">
          <p>{error instanceof Error && error.name === 'AbortError' ? 'Request timed out.' : 'Unable to load today card.'}</p>
          <button type="button" onClick={() => refetch()} disabled={isRefetching} className="mt-1 underline hover:no-underline disabled:opacity-50">
            {isRefetching ? 'Retrying…' : 'Retry'}
          </button>
        </div>
      )}
      {data && !isLoading && <TodayCardContent data={data} />}
    </div>
  )
}
