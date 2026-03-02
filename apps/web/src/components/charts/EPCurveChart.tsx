/**
 * EP Curve Chart (Exceedance Probability) — P2b
 *
 * Displays the Exceedance Probability curve from Monte Carlo simulation.
 * Shows the probability that losses will exceed a given threshold.
 *
 * Uses Plotly for interactive charts with VaR/CVaR annotations.
 */
import { useState, useEffect, useMemo } from 'react'

interface EPCurvePoint {
  percentile: number
  exceedance_probability: number
  loss_m: number
}

interface EPCurveData {
  ep_curve: EPCurvePoint[]
  var_95_m: number
  var_99_m: number
  cvar_99_m: number
  mean_loss_m: number
  max_loss_m: number
  monte_carlo_runs: number
  methodology: string
  inputs?: { total_exposure_m: number; n_assets: number; sector: string; scenario_type: string; severity: number }
}

interface EPCurveChartProps {
  totalExposure?: number
  scenario?: string
  severity?: number
  className?: string
}

export default function EPCurveChart({
  totalExposure = 500,
  scenario = 'climate',
  severity = 0.5,
  className = '',
}: EPCurveChartProps) {
  const [data, setData] = useState<EPCurveData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(
      `/api/v1/risk-engine/ep-curve?total_exposure_m=${totalExposure}&scenario_type=${scenario}&severity=${severity}&n_simulations=100000`
    )
      .then((r) => (r.ok ? r.json() : Promise.reject('Failed to fetch EP curve')))
      .then((d) => {
        setData(d)
        setLoading(false)
      })
      .catch((e) => {
        setError(String(e))
        setLoading(false)
      })
  }, [totalExposure, scenario, severity])

  const chartContent = useMemo(() => {
    if (!data?.ep_curve?.length) return null
    const points = data.ep_curve
    const maxLoss = Math.max(...points.map((p) => p.loss_m), data.var_99_m || 0)
    const chartWidth = 100

    return (
      <div className="relative w-full h-48">
        <svg viewBox="0 0 100 60" className="w-full h-full" preserveAspectRatio="none">
          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((y) => (
            <line
              key={y}
              x1="0"
              y1={y * 60}
              x2="100"
              y2={y * 60}
              stroke="rgba(255,255,255,0.05)"
              strokeDasharray="2,2"
            />
          ))}
          {/* EP curve */}
          <polyline
            fill="none"
            stroke="#f59e0b"
            strokeWidth="0.8"
            points={points
              .map(
                (p) =>
                  `${(p.loss_m / Math.max(maxLoss, 1)) * chartWidth},${(1 - p.exceedance_probability) * 60}`
              )
              .join(' ')}
          />
          {/* Filled area under curve */}
          <polygon
            fill="rgba(245,158,11,0.15)"
            points={`0,60 ${points
              .map(
                (p) =>
                  `${(p.loss_m / Math.max(maxLoss, 1)) * chartWidth},${(1 - p.exceedance_probability) * 60}`
              )
              .join(' ')} ${chartWidth},60`}
          />
          {/* VaR 95 line */}
          {data.var_95_m > 0 && (
            <line
              x1={(data.var_95_m / Math.max(maxLoss, 1)) * chartWidth}
              y1="0"
              x2={(data.var_95_m / Math.max(maxLoss, 1)) * chartWidth}
              y2="60"
              stroke="#ef4444"
              strokeWidth="0.5"
              strokeDasharray="2,1"
            />
          )}
          {/* VaR 99 line */}
          {data.var_99_m > 0 && (
            <line
              x1={(data.var_99_m / Math.max(maxLoss, 1)) * chartWidth}
              y1="0"
              x2={(data.var_99_m / Math.max(maxLoss, 1)) * chartWidth}
              y2="60"
              stroke="#dc2626"
              strokeWidth="0.5"
              strokeDasharray="2,1"
            />
          )}
        </svg>
      </div>
    )
  }, [data])

  if (loading) {
    return (
      <div className={`bg-zinc-900/60 rounded-md p-4 ${className}`}>
        <div className="text-zinc-400 text-sm mb-2">Exceedance Probability Curve</div>
        <div className="h-48 flex items-center justify-center text-zinc-500 animate-pulse">
          Running Monte Carlo (100,000 simulations)...
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className={`bg-zinc-900/60 rounded-md p-4 ${className}`}>
        <div className="text-zinc-400 text-sm mb-2">Exceedance Probability Curve</div>
        <div className="h-48 flex items-center justify-center text-zinc-500">
          {error || 'No data available'}
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-zinc-900/60 rounded-md p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div>
          <div className="text-zinc-300 text-sm font-medium">Exceedance Probability Curve</div>
          <div className="text-zinc-500 text-xs">
            {data.monte_carlo_runs.toLocaleString()} Monte Carlo simulations · {data.methodology}
            {data.inputs ? (
              <span className="block text-zinc-600 mt-0.5">
                Synthetic portfolio: {data.inputs.n_assets} assets, €{Math.round(data.inputs.total_exposure_m)}M total, {data.inputs.scenario_type} severity {data.inputs.severity}
              </span>
            ) : (
              <span className="block text-zinc-600 mt-0.5">Synthetic portfolio for simulation (differs from real asset count in Asset Risk Distribution).</span>
            )}
          </div>
        </div>
        <div className="flex gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            VaR 95: €{Math.round(data.var_95_m)}M
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-700" />
            VaR 99: €{Math.round(data.var_99_m)}M
          </span>
        </div>
      </div>

      {chartContent}

      <div className="grid grid-cols-4 gap-2 mt-3 text-center">
        <div className="bg-zinc-800/50 rounded-md p-2">
          <div className="text-zinc-500 text-[10px] uppercase">Mean Loss</div>
          <div className="text-zinc-200 text-sm font-medium">€{Math.round(data.mean_loss_m)}M</div>
        </div>
        <div className="bg-zinc-800/50 rounded-md p-2">
          <div className="text-zinc-500 text-[10px] uppercase">VaR 95%</div>
          <div className="text-amber-400/80 text-sm font-medium">€{Math.round(data.var_95_m)}M</div>
        </div>
        <div className="bg-zinc-800/50 rounded-md p-2">
          <div className="text-zinc-500 text-[10px] uppercase">CVaR 99%</div>
          <div className="text-red-400/80 text-sm font-medium">€{Math.round(data.cvar_99_m)}M</div>
        </div>
        <div className="bg-zinc-800/50 rounded-md p-2">
          <div className="text-zinc-500 text-[10px] uppercase">Max Loss</div>
          <div className="text-red-500/80 text-sm font-medium">€{Math.round(data.max_loss_m)}M</div>
        </div>
      </div>
    </div>
  )
}
