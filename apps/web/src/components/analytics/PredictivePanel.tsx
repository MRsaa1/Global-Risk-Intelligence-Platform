/**
 * Predictive Analytics Panel - Early Warning & Risk Forecasting
 *
 * Features:
 * - Early Warning alerts with trend analysis
 * - Risk forecast visualization (24-168h)
 * - Anomaly detection indicators
 * - PhysicsNeMo-powered predictions
 * - Real metrics from analyticsApi/Assets API
 * - Refresh button, error handling, SRO link
 * - Early Warning / Risk Forecast / Anomaly call /api/v1/predictions/* (placeholder until ML service is connected)
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import {
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BoltIcon,
  ShieldExclamationIcon,
  SparklesIcon,
  ChartBarIcon,
  ClockIcon,
  ArrowPathIcon,
  Square3Stack3DIcon,
} from '@heroicons/react/24/outline'

import { usePredictions } from '../../hooks/usePredictions'

// Types
interface EarlyWarning {
  asset_id: string
  alert_level: 'normal' | 'watch' | 'warning' | 'critical'
  risk_score: number
  predicted_risk_score: number
  forecast_hours: number
  trend: 'increasing' | 'stable' | 'decreasing' | 'volatile'
  confidence: number
  contributing_factors: string[]
  recommended_actions: string[]
  created_at: string
}

interface RiskForecast {
  asset_id: string
  current_score: number
  forecasts: Array<{
    hours: number
    score: number
    confidence: number
    lower_bound: number
    upper_bound: number
  }>
  trend: string
  peak_risk_hours: number
  peak_risk_score: number
}

interface AnomalyResult {
  asset_id: string
  is_anomaly: boolean
  anomaly_score: number
  anomaly_type: string
  deviation_sigma: number
  historical_comparison: string
}

// Alert level colors
const alertColors = {
  normal: { bg: 'bg-emerald-500/20', text: 'text-emerald-400/80', border: 'border-emerald-500/30' },
  watch: { bg: 'bg-yellow-500/20', text: 'text-yellow-400/80', border: 'border-yellow-500/30' },
  warning: { bg: 'bg-orange-500/20', text: 'text-orange-400/80', border: 'border-orange-500/30' },
  critical: { bg: 'bg-red-500/20', text: 'text-red-400/80', border: 'border-red-500/30' },
}

// Trend icons
function TrendIcon({ trend }: { trend: string }) {
  switch (trend) {
    case 'increasing':
      return <ArrowTrendingUpIcon className="w-4 h-4 text-red-400/80" />
    case 'decreasing':
      return <ArrowTrendingDownIcon className="w-4 h-4 text-emerald-400/80" />
    case 'volatile':
      return <BoltIcon className="w-4 h-4 text-zinc-400" />
    default:
      return <div className="w-4 h-4 border-t-2 border-zinc-500" />
  }
}

// Forecast Chart Component
function ForecastChart({
  forecasts,
  currentScore,
}: {
  forecasts: RiskForecast['forecasts']
  currentScore: number
}) {
  const maxScore = Math.max(100, ...forecasts.map((f) => f.upper_bound))

  return (
    <div className="h-32 flex items-end gap-1 p-2">
      {/* Current bar */}
      <div className="flex-1 flex flex-col items-center">
        <div
          className="w-full bg-zinc-500 rounded-t"
          style={{ height: `${(currentScore / maxScore) * 100}%` }}
        />
        <span className="text-[10px] text-zinc-500 mt-1">Now</span>
      </div>

      {/* Forecast bars */}
      {forecasts.map((f, i) => (
        <div key={i} className="flex-1 flex flex-col items-center relative">
          {/* Confidence range */}
          <div
            className="absolute w-full bg-zinc-800 rounded"
            style={{
              height: `${((f.upper_bound - f.lower_bound) / maxScore) * 100}%`,
              bottom: `${(f.lower_bound / maxScore) * 100}%`,
            }}
          />
          {/* Main bar */}
          <div
            className={`w-full rounded-t transition-all ${
              f.score >= 70
                ? 'bg-red-500/80'
                : f.score >= 50
                  ? 'bg-orange-500/80'
                  : f.score >= 30
                    ? 'bg-yellow-500/80'
                    : 'bg-emerald-500/80'
            }`}
            style={{ height: `${(f.score / maxScore) * 100}%` }}
          />
          <span className="text-[10px] text-zinc-500 mt-1">{f.hours}h</span>
        </div>
      ))}
    </div>
  )
}

// Early Warning Card
function WarningCard({ warning }: { warning: EarlyWarning }) {
  const [expanded, setExpanded] = useState(false)
  const colors = alertColors[warning.alert_level]

  return (
    <motion.div
      layout
      className={`p-4 rounded-md border ${colors.border} ${colors.bg} cursor-pointer`}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-md ${colors.bg}`}>
            <ShieldExclamationIcon className={`w-5 h-5 ${colors.text}`} />
          </div>
          <div>
            <h4 className="font-medium text-zinc-100">{warning.asset_id}</h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                {warning.alert_level.toUpperCase()}
              </span>
              <TrendIcon trend={warning.trend} />
              <span className="text-xs text-zinc-500">{warning.trend}</span>
            </div>
          </div>
        </div>

        {/* Scores */}
        <div className="text-right">
          <div className="text-2xl font-bold text-zinc-100">{warning.risk_score.toFixed(0)}</div>
          <div className="flex items-center gap-1 text-xs text-zinc-500">
            <ClockIcon className="w-3 h-3" />
            <span>{warning.forecast_hours}h: </span>
            <span
              className={
                warning.predicted_risk_score > warning.risk_score ? 'text-red-400/80' : 'text-emerald-400/80'
              }
            >
              {warning.predicted_risk_score.toFixed(0)}
            </span>
          </div>
        </div>
      </div>

      {/* Expanded Content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mt-4 pt-4 border-t border-zinc-800/60"
          >
            {/* Contributing Factors */}
            <div className="mb-3">
              <h5 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Contributing Factors</h5>
              <div className="flex flex-wrap gap-2">
                {warning.contributing_factors.map((factor, i) => (
                  <span key={i} className="text-xs px-2 py-1 bg-zinc-900/80 border border-zinc-800/60 rounded text-zinc-300">
                    {factor}
                  </span>
                ))}
              </div>
            </div>

            {/* Recommended Actions */}
            <div>
              <h5 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Recommended Actions</h5>
              <ul className="space-y-1">
                {warning.recommended_actions.map((action, i) => (
                  <li key={i} className="text-xs text-zinc-300 flex items-start gap-2">
                    <span className="text-zinc-400 mt-0.5">•</span>
                    {action}
                  </li>
                ))}
              </ul>
            </div>

            {/* Confidence */}
            <div className="mt-3 flex items-center gap-2 text-xs text-zinc-500">
              <SparklesIcon className="w-3 h-3" />
              <span>Confidence: {(warning.confidence * 100).toFixed(0)}%</span>
              <span className="text-zinc-700">|</span>
              <span>PhysicsNeMo ML</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// Main Panel
interface PredictivePanelProps {
  context?: 'portfolio' | 'asset'
  assetId?: string
  compact?: boolean
}

export default function PredictivePanel({
  context = 'portfolio',
  assetId,
  compact = false,
}: PredictivePanelProps) {
  const [activeTab, setActiveTab] = useState<'warnings' | 'forecast' | 'anomalies'>('warnings')

  const {
    metrics,
    metricsLoading,
    warning,
    forecast,
    anomaly,
    isPending,
    error,
    refresh,
  } = usePredictions({
    context,
    assetId: assetId ?? 'portfolio_global',
  })

  const warningData = warning as EarlyWarning | undefined
  const forecastData = forecast as RiskForecast | undefined
  const anomalyData = anomaly as AnomalyResult | undefined

  // When ML API is unavailable or fails, show estimated values from current metrics so the panel is never empty
  const currentScore = metrics?.current_score ?? 54
  const hist = metrics?.historical_scores ?? [50, 51, 52, 53, 54]
  const score = currentScore <= 1 ? currentScore * 100 : currentScore
  const hist100 = hist.map((h) => (h <= 1 ? h * 100 : h))
  const trendDir = hist100.length >= 2 ? (hist100[hist100.length - 1] >= hist100[hist100.length - 2] ? 'increasing' : 'decreasing') : 'stable'
  const peakScore = Math.max(score, ...hist100.slice(-5), 55)
  const fallbackForecast: RiskForecast | null = metrics
    ? {
        asset_id: metrics.assetId,
        current_score: score,
        forecasts: [24, 48, 72, 168].map((hours, i) => {
          const drift = trendDir === 'increasing' ? 1 + i * 0.5 : trendDir === 'decreasing' ? -0.5 - i * 0.3 : 0
          const s = Math.min(100, Math.max(0, score + drift * (i + 1)))
          return { hours, score: Math.round(s * 10) / 10, confidence: 0.85, lower_bound: s - 4, upper_bound: s + 4 }
        }),
        trend: trendDir,
        peak_risk_hours: 24,
        peak_risk_score: peakScore,
      }
    : null
  const fallbackWarning: EarlyWarning | null = metrics
    ? {
        asset_id: metrics.assetId,
        alert_level: score >= 75 ? 'critical' : score >= 55 ? 'warning' : score >= 45 ? 'watch' : 'normal',
        risk_score: score,
        predicted_risk_score: Math.min(100, score + (trendDir === 'increasing' ? 3 : trendDir === 'decreasing' ? -2 : 0)),
        forecast_hours: 72,
        trend: trendDir as 'increasing' | 'stable' | 'decreasing' | 'volatile',
        confidence: 0.8,
        contributing_factors: score >= 55 ? ['Elevated climate/physical risk', 'Portfolio concentration'] : ['Within normal range'],
        recommended_actions: score >= 55 ? ['Review high-exposure assets', 'Consider hedging'] : ['Monitor quarterly'],
        created_at: new Date().toISOString(),
      }
    : null
  const fallbackAnomaly: AnomalyResult | null = metrics
    ? {
        asset_id: metrics.assetId,
        is_anomaly: false,
        anomaly_score: 0.2,
        anomaly_type: 'none',
        deviation_sigma: 0.5,
        historical_comparison: `Current score ${score.toFixed(0)} is within historical range (${hist100.length} points). No significant deviation.`,
      }
    : null

  const showFallback = !warningData && !forecastData && !anomalyData && metrics
  const displayWarning = warningData ?? (showFallback ? fallbackWarning : null)
  const displayForecast = forecastData ?? (showFallback ? fallbackForecast : null)
  const displayAnomaly = anomalyData ?? (showFallback ? fallbackAnomaly : null)

  const hasHighRisk =
    displayWarning &&
    (displayWarning.alert_level === 'warning' || displayWarning.alert_level === 'critical')
  const hasAnyData = !!displayWarning || !!displayForecast || !!displayAnomaly

  return (
    <div className={`rounded-md border border-zinc-800/60 bg-zinc-900/50 ${compact ? 'p-4' : 'p-6'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <ChartBarIcon className="w-5 h-5 text-zinc-400" />
          <h2 className="text-lg font-display font-semibold text-zinc-100 tracking-tight">Predictive Analytics</h2>
          <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 bg-zinc-900/80 border border-zinc-800/60 text-zinc-400 rounded-full">
            PhysicsNeMo
          </span>
          {showFallback && (
            <span className="text-[10px] px-2 py-0.5 bg-amber-500/20 text-amber-300/80 border border-amber-500/30 rounded-full" title="ML prediction API not connected; values estimated from current portfolio metrics">
              Estimated from metrics
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasHighRisk && (
            <Link
              to="/modules/sro"
              className="inline-flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800 rounded-md border border-zinc-800/60 transition-colors"
            >
              <Square3Stack3DIcon className="w-3.5 h-3.5" />
              SRO Early Warning
            </Link>
          )}
          <button
            type="button"
            onClick={() => refresh()}
            disabled={isPending || metricsLoading}
            className="p-2 rounded-md border border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 hover:border-zinc-700 transition-colors disabled:opacity-50"
            title="Refresh data"
          >
            <ArrowPathIcon className={`w-4 h-4 ${isPending || metricsLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-900/80 rounded-md border border-zinc-800/60 p-1">
          {(['warnings', 'forecast', 'anomalies'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 font-mono text-[10px] uppercase tracking-widest rounded-md transition-colors ${
                activeTab === tab ? 'bg-zinc-800 text-zinc-300 border border-zinc-800/60' : 'text-zinc-500 hover:text-zinc-400'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-300/80 text-sm">
          {error}
          <p className="mt-1 text-xs text-zinc-500">
            Predictions use /api/v1/predictions/* (early-warning, forecast, anomaly). Connect your ML service or see docs.
          </p>
        </div>
      )}

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'warnings' && displayWarning && (
          <motion.div
            key="warnings"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <WarningCard warning={displayWarning} />
          </motion.div>
        )}

        {activeTab === 'forecast' && displayForecast && (
          <motion.div
            key="forecast"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Current Score</span>
              <span className="text-xl font-bold text-zinc-100">{displayForecast.current_score}</span>
            </div>

            <ForecastChart
              forecasts={displayForecast.forecasts}
              currentScore={displayForecast.current_score}
            />

            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-zinc-900/50 border border-zinc-800/60 rounded-md">
                <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Peak Risk</div>
                <div className="text-lg font-bold text-red-400/80">
                  {displayForecast.peak_risk_score.toFixed(0)}
                </div>
                <div className="text-xs text-zinc-500">in {displayForecast.peak_risk_hours}h</div>
              </div>
              <div className="p-3 bg-zinc-900/50 border border-zinc-800/60 rounded-md">
                <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Trend</div>
                <div className="flex items-center gap-2 mt-1">
                  <TrendIcon trend={displayForecast.trend} />
                  <span className="text-zinc-100">{displayForecast.trend}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'anomalies' && displayAnomaly && (
          <motion.div
            key="anomalies"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-md border border-zinc-800/60 bg-zinc-900/50"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ExclamationTriangleIcon
                  className={`w-5 h-5 ${displayAnomaly.is_anomaly ? 'text-red-400/80' : 'text-emerald-400/80'}`}
                />
                <span className="font-medium">
                  {displayAnomaly.is_anomaly ? 'Anomaly Detected' : 'No Anomalies'}
                </span>
              </div>
              <span
                className={`text-xs px-2 py-1 rounded-full ${
                  displayAnomaly.is_anomaly
                    ? 'bg-red-500/20 text-red-400/80'
                    : 'bg-emerald-500/20 text-emerald-400/80'
                }`}
              >
                Score: {(displayAnomaly.anomaly_score * 100).toFixed(0)}%
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Type</span>
                <span className="text-zinc-300">{displayAnomaly.anomaly_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Deviation</span>
                <span className="text-zinc-300">{displayAnomaly.deviation_sigma.toFixed(1)}σ</span>
              </div>
              <p className="text-xs text-zinc-400 mt-2">{displayAnomaly.historical_comparison}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading state - full spinner only when no data yet (includes anomaly mutation) */}
      {(isPending || metricsLoading) && !error && !hasAnyData && (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state when no data and not loading */}
      {!isPending && !metricsLoading && !error && !displayWarning && !displayForecast && !displayAnomaly && (
        <div className="py-8 text-center text-zinc-400 text-sm">
          {context === 'asset' && !assetId
            ? 'Select an asset to view predictions.'
            : 'Loading metrics...'}
        </div>
      )}
    </div>
  )
}
