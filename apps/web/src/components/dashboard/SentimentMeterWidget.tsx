/**
 * Sentiment Meter — Panic/Neutral/Hype gauge (0–100) + one main reason.
 * Minimalist widget for Dashboard.
 */
import { useQuery } from '@tanstack/react-query'
import { getSentimentMeter, type SentimentMeterResponse } from '../../services/dashboardApi'

function Gauge({ value, label }: { value: number; label: string }) {
  const deg = (value / 100) * 180 - 90 // -90..90 for semicircle
  const color =
    label === 'panic' ? '#ef4444' : label === 'hype' ? '#22c55e' : '#eab308'
  return (
    <div className="relative w-24 h-14 flex items-end justify-center">
      <svg viewBox="0 0 100 60" className="w-full h-full">
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          stroke="currentColor"
          strokeWidth="6"
          className="text-zinc-700"
        />
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${(value / 100) * 125} 125`}
          transform="rotate(-90 50 50)"
          style={{ filter: `drop-shadow(0 0 6px ${color}40)` }}
        />
      </svg>
      <span
        className="absolute bottom-0 text-lg font-bold tabular-nums"
        style={{ color }}
      >
        {value}
      </span>
    </div>
  )
}

export default function SentimentMeterWidget() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', 'sentiment-meter'],
    queryFn: ({ signal }) => getSentimentMeter(signal),
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  return (
    <div className="rounded-md bg-zinc-900 border border-zinc-800 p-4 h-full flex flex-col">
      <h3 className="text-sm font-display font-semibold text-zinc-300 mb-0.5">
        Sentiment
      </h3>
      <p className="text-[10px] text-zinc-500 mb-2">Market & risk mood (0 = panic, 100 = hype)</p>
      {isLoading && (
        <div className="flex items-center gap-2 text-zinc-500 text-xs">
          <span className="w-4 h-4 border border-zinc-600 border-t-amber-500 rounded-full animate-spin" />
          Loading…
        </div>
      )}
      {error && (
        <p className="text-xs text-red-400/80">Unable to load meter.</p>
      )}
      {data && !isLoading && (
        <>
          <div className="flex items-center gap-3">
            <Gauge value={data.value} label={data.label} />
            <span
              className={`text-xs font-medium uppercase ${
                data.label === 'panic'
                  ? 'text-red-400/80'
                  : data.label === 'hype'
                    ? 'text-emerald-400/80'
                    : 'text-amber-400/80'
              }`}
            >
              {data.label}
            </span>
          </div>
          <p
            className="text-[11px] text-zinc-500 mt-2 line-clamp-4"
            title={data.main_reason}
          >
            {data.main_reason}
          </p>
        </>
      )}
    </div>
  )
}
