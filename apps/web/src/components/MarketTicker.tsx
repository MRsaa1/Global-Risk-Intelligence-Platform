/**
 * MarketTicker — Live market data bar (VIX, S&P 500, HYG, LQD, 10Y, EUR/USD).
 * Reads store.marketData populated by the WebSocket market_data channel.
 */
import { usePlatformStore } from '../store/platformStore'
import { ArrowTrendingUpIcon, ArrowTrendingDownIcon } from '@heroicons/react/24/solid'

interface TickerItem {
  key: string
  label: string
  prefix?: string
  suffix?: string
  decimals?: number
  invertColor?: boolean
}

const TICKERS: TickerItem[] = [
  { key: 'VIX', label: 'VIX', decimals: 1, invertColor: true },
  { key: 'SPX', label: 'S&P 500', decimals: 0 },
  { key: 'HYG', label: 'HYG', prefix: '$', decimals: 2 },
  { key: 'LQD', label: 'LQD', prefix: '$', decimals: 2 },
  { key: '10Y', label: '10Y Yield', suffix: '%', decimals: 3 },
  { key: 'EURUSD', label: 'EUR/USD', decimals: 4 },
]

function formatValue(value: number, item: TickerItem): string {
  const num = value.toFixed(item.decimals ?? 2)
  return `${item.prefix ?? ''}${num}${item.suffix ?? ''}`
}

export default function MarketTicker() {
  const marketData = usePlatformStore((s) => s.marketData)
  const keys = Object.keys(marketData)

  if (keys.length === 0) {
    return (
      <div className="rounded-md bg-zinc-900 border border-zinc-800 px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-xs text-zinc-500 font-display">Market data connecting...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-md bg-zinc-900 border border-zinc-800 px-4 py-3">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
        <span className="text-[10px] text-zinc-500 uppercase tracking-wide font-display">Market Data</span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2">
        {TICKERS.map((item) => {
          const val = marketData[item.key]
          if (val == null) return null
          const isPositive = item.invertColor ? val < 20 : val >= 0
          return (
            <div key={item.key} className="flex items-center gap-1.5">
              {isPositive ? (
                <ArrowTrendingUpIcon className="w-3 h-3 text-emerald-400/80 flex-shrink-0" />
              ) : (
                <ArrowTrendingDownIcon className="w-3 h-3 text-red-400/80 flex-shrink-0" />
              )}
              <div className="min-w-0">
                <span className="text-[10px] text-zinc-500 block">{item.label}</span>
                <span className={`text-xs font-mono ${isPositive ? 'text-emerald-300/80' : 'text-red-300/80'}`}>
                  {formatValue(val, item)}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
