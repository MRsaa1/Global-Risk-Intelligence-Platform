/**
 * TimelinePredictionsPanel - Time Chart and Predictions
 *
 * Tabs:
 * - Timeline: Real-time risk score changes
 * - Predictions: Early warning alerts, forecasts
 *
 * Uses usePredictions hook with overrideMetrics from selectedZone.
 */
import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ChartBarIcon, 
  SparklesIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  BoltIcon,
  Square3Stack3DIcon,
} from '@heroicons/react/24/outline'
import { Link } from 'react-router-dom'
import { RiskZone } from '../CesiumGlobe'
import { StressTestState } from '../../store/platformStore'
import { usePredictions } from '../../hooks/usePredictions'

interface TimelinePredictionsPanelProps {
  selectedZone: RiskZone | null
  stressTest: StressTestState | null
}

interface RiskForecast {
  hours: number
  score: number
  confidence: number
  lower_bound: number
  upper_bound: number
}

interface EarlyWarning {
  alert_level: 'normal' | 'watch' | 'warning' | 'critical'
  risk_score: number
  predicted_risk_score: number
  trend: 'increasing' | 'stable' | 'decreasing' | 'volatile'
  confidence: number
  contributing_factors: string[]
}

// Alert level colors
const alertColors = {
  normal: { bg: 'bg-emerald-500/20', text: 'text-emerald-400/80', border: 'border-emerald-500/30' },
  watch: { bg: 'bg-yellow-500/20', text: 'text-yellow-400/80', border: 'border-yellow-500/30' },
  warning: { bg: 'bg-orange-500/20', text: 'text-orange-400/80', border: 'border-orange-500/30' },
  critical: { bg: 'bg-red-500/20', text: 'text-red-400/80', border: 'border-red-500/30' },
}

// Trend icon component
function TrendIcon({ trend }: { trend: string }) {
  switch (trend) {
    case 'increasing':
      return <ArrowTrendingUpIcon className="w-4 h-4 text-red-400/80" />
    case 'decreasing':
      return <ArrowTrendingDownIcon className="w-4 h-4 text-emerald-400/80" />
    case 'volatile':
      return <BoltIcon className="w-4 h-4 text-amber-400/80" />
    default:
      return <div className="w-4 h-1 border-t-2 border-zinc-500" />
  }
}

// Mini forecast chart
function MiniChart({ forecasts, currentScore }: { forecasts: RiskForecast[], currentScore: number }) {
  const maxScore = Math.max(100, ...forecasts.map(f => f.upper_bound))
  
  return (
    <div className="h-20 flex items-end gap-0.5 px-1">
      {/* Current bar */}
      <div className="flex-1 flex flex-col items-center">
        <div 
          className="w-full bg-zinc-500 rounded-t"
          style={{ height: `${(currentScore / maxScore) * 100}%` }}
        />
        <span className="text-[8px] text-zinc-500 mt-0.5">Now</span>
      </div>
      
      {/* Forecast bars */}
      {forecasts.map((f, i) => (
        <div key={i} className="flex-1 flex flex-col items-center relative">
          {/* Confidence range */}
          <div 
            className="absolute w-full bg-zinc-700 rounded"
            style={{ 
              height: `${((f.upper_bound - f.lower_bound) / maxScore) * 100}%`,
              bottom: `${(f.lower_bound / maxScore) * 100}%`
            }}
          />
          {/* Main bar */}
          <div 
            className={`w-full rounded-t transition-all ${
              f.score >= 70 ? 'bg-red-500' :
              f.score >= 50 ? 'bg-orange-500' :
              f.score >= 30 ? 'bg-yellow-500' : 'bg-emerald-500'
            }`}
            style={{ height: `${(f.score / maxScore) * 100}%` }}
          />
          <span className="text-[8px] text-zinc-500 mt-0.5">{f.hours}h</span>
        </div>
      ))}
    </div>
  )
}

// Real-time risk timeline (simulated)
function RiskTimeline({ riskScore }: { riskScore: number }) {
  const [history, setHistory] = useState<number[]>([])
  
  useEffect(() => {
    // Generate initial history
    const initial = Array.from({ length: 20 }, (_, i) => 
      riskScore * (0.85 + Math.random() * 0.3) * (0.9 + i * 0.005)
    )
    setHistory(initial)
    
    // Update periodically
    const interval = setInterval(() => {
      setHistory(prev => {
        const last = prev[prev.length - 1] || riskScore
        const next = Math.max(0, Math.min(100, last + (Math.random() - 0.48) * 5))
        return [...prev.slice(-19), next]
      })
    }, 2000)
    
    return () => clearInterval(interval)
  }, [riskScore])
  
  const maxVal = Math.max(...history, 100)
  const minVal = Math.min(...history, 0)
  const range = maxVal - minVal || 1
  
  // Create SVG path
  const points = history.map((val, i) => {
    const x = (i / (history.length - 1)) * 100
    const y = 100 - ((val - minVal) / range) * 100
    return `${x},${y}`
  }).join(' ')
  
  return (
    <div className="h-24 bg-zinc-800 rounded-md p-2 relative overflow-hidden">
      {/* Y-axis labels */}
      <div className="absolute left-1 top-1 text-[8px] text-zinc-500">{maxVal.toFixed(0)}%</div>
      <div className="absolute left-1 bottom-1 text-[8px] text-zinc-500">{minVal.toFixed(0)}%</div>
      
      {/* Chart */}
      <svg 
        viewBox="0 0 100 100" 
        preserveAspectRatio="none"
        className="w-full h-full"
      >
        {/* Grid lines */}
        <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.1)" strokeDasharray="2" />
        
        {/* Area under line */}
        <polygon
          points={`0,100 ${points} 100,100`}
          fill="url(#riskGradient)"
        />
        
        {/* Line */}
        <polyline
          points={points}
          fill="none"
          stroke="#f97316"
          strokeWidth="1.5"
        />
        
        {/* Gradient definition */}
        <defs>
          <linearGradient id="riskGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </linearGradient>
        </defs>
      </svg>
      
      {/* Current value indicator */}
      <div className="absolute right-2 top-1/2 -translate-y-1/2 bg-orange-500/20 px-2 py-0.5 rounded text-xs text-orange-400/80 font-medium">
        {history[history.length - 1]?.toFixed(1)}%
      </div>
    </div>
  )
}

export default function TimelinePredictionsPanel({ selectedZone, stressTest }: TimelinePredictionsPanelProps) {
  const [activeTab, setActiveTab] = useState<'timeline' | 'predictions'>('timeline')

  const currentRiskScore = selectedZone?.risk_score ? selectedZone.risk_score * 100 : 52

  const overrideMetrics = useMemo(
    () =>
      selectedZone
        ? {
            assetId: selectedZone.id || 'portfolio_global',
            current_score: currentRiskScore,
            historical_scores: [45, 48, 50, 49, 51, currentRiskScore],
            climate_risk: currentRiskScore * 0.6,
            physical_risk: currentRiskScore * 0.7,
            financial_risk: currentRiskScore * 0.5,
            network_risk: currentRiskScore * 0.4,
            operational_risk: currentRiskScore * 0.5,
          }
        : undefined,
    [selectedZone?.id, currentRiskScore]
  )

  const {
    warning,
    forecast,
    metrics,
  } = usePredictions({
    context: selectedZone ? 'asset' : 'portfolio',
    assetId: selectedZone?.id || 'portfolio_global',
    overrideMetrics,
  })

  const warningTyped = warning as EarlyWarning | undefined
  
  const forecastTyped = forecast as { forecasts?: RiskForecast[]; trend?: string } | undefined

  const forecasts: RiskForecast[] = forecastTyped?.forecasts || [
    { hours: 24, score: currentRiskScore + 3, confidence: 0.85, lower_bound: currentRiskScore - 2, upper_bound: currentRiskScore + 8 },
    { hours: 48, score: currentRiskScore + 5, confidence: 0.75, lower_bound: currentRiskScore - 5, upper_bound: currentRiskScore + 15 },
    { hours: 72, score: currentRiskScore + 8, confidence: 0.65, lower_bound: currentRiskScore - 8, upper_bound: currentRiskScore + 20 },
    { hours: 168, score: currentRiskScore + 12, confidence: 0.50, lower_bound: currentRiskScore - 10, upper_bound: currentRiskScore + 30 },
  ]
  
  const alertLevel =
    warningTyped?.alert_level ||
    (currentRiskScore > 70 ? 'critical' : currentRiskScore > 50 ? 'warning' : 'watch')
  const colors = alertColors[alertLevel]
  const hasHighRisk = alertLevel === 'warning' || alertLevel === 'critical'

  return (
    <div className="h-full bg-black/80 border border-zinc-800 rounded-md p-4 flex flex-col">
      {/* Header with Tabs */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ChartBarIcon className="w-5 h-5 text-zinc-400" />
          <h3 className="text-sm font-medium text-zinc-100">Timeline</h3>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-800 rounded-md p-0.5">
          {(['timeline', 'predictions'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2.5 py-1 text-[10px] rounded-md transition-colors ${
                activeTab === tab
                  ? 'bg-zinc-700 text-zinc-300'
                  : 'text-zinc-500 hover:text-zinc-400'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'timeline' && (
          <motion.div
            key="timeline"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            className="flex-1 flex flex-col gap-3"
          >
            {/* Current Score */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-400">Current Risk Score</span>
              <span className="text-xl font-bold text-zinc-100">{currentRiskScore.toFixed(0)}</span>
            </div>
            
            {/* Real-time chart */}
            <RiskTimeline riskScore={currentRiskScore} />
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="p-2 bg-zinc-800 rounded-md">
                <div className="text-xs text-zinc-500">24h Avg</div>
                <div className="text-sm font-medium text-zinc-100">{(currentRiskScore * 0.95).toFixed(0)}</div>
              </div>
              <div className="p-2 bg-zinc-800 rounded-md">
                <div className="text-xs text-zinc-500">Peak</div>
                <div className="text-sm font-medium text-red-400/80">{(currentRiskScore * 1.15).toFixed(0)}</div>
              </div>
              <div className="p-2 bg-zinc-800 rounded-md">
                <div className="text-xs text-zinc-500">Trend</div>
                <div className="flex items-center justify-center gap-1 text-sm">
                  <TrendIcon trend={forecastTyped?.trend || 'increasing'} />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'predictions' && (
          <motion.div
            key="predictions"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            className="flex-1 flex flex-col gap-3 overflow-auto custom-scrollbar"
          >
            {/* Alert Level */}
            <div className={`p-3 rounded-md border ${colors.border} ${colors.bg}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <ExclamationTriangleIcon className={`w-4 h-4 ${colors.text}`} />
                  <span className={`text-xs font-medium ${colors.text} uppercase`}>
                    {alertLevel}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-zinc-500">
                  <ClockIcon className="w-3 h-3" />
                  <span>72h forecast</span>
                </div>
              </div>
              
              {/* Predicted change */}
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-zinc-100">{currentRiskScore.toFixed(0)}</span>
                <ArrowTrendingUpIcon className="w-4 h-4 text-red-400/80" />
                <span className="text-lg font-bold text-red-400/80">
                  {(warningTyped?.predicted_risk_score || currentRiskScore + 8).toFixed(0)}
                </span>
              </div>
            </div>
            
            {/* Forecast Chart */}
            <div className="p-2 bg-zinc-800 rounded-md">
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Risk Forecast</div>
              <MiniChart forecasts={forecasts} currentScore={currentRiskScore} />
            </div>
            
            {/* Contributing Factors */}
            {warningTyped?.contributing_factors && (
              <div className="p-2 bg-zinc-800 rounded-md">
                <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">Key Factors</div>
                <div className="flex flex-wrap gap-1">
                  {warningTyped.contributing_factors.slice(0, 4).map((factor, i) => (
                    <span key={i} className="text-[10px] px-1.5 py-0.5 bg-zinc-700 rounded text-zinc-300">
                      {factor}
                    </span>
                  ))}
                </div>
              </div>
            )}
            
            {/* SRO link when high risk */}
            {hasHighRisk && (
              <Link
                to="/modules/sro"
                className="inline-flex items-center gap-1.5 px-2 py-1 text-[10px] text-zinc-400 hover:text-zinc-300 hover:bg-zinc-800 rounded-md border border-zinc-600 transition-colors"
              >
                <Square3Stack3DIcon className="w-3 h-3" />
                SRO Early Warning
              </Link>
            )}

            {/* PhysicsNeMo badge */}
            <div className="flex items-center justify-center gap-1.5 text-[10px] text-zinc-600">
              <SparklesIcon className="w-3 h-3" />
              <span>PhysicsNeMo ML Predictions</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
