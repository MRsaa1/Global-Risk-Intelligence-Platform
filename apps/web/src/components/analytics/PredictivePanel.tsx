/**
 * Predictive Analytics Panel - Early Warning & Risk Forecasting
 * 
 * Features:
 * - Early Warning alerts with trend analysis
 * - Risk forecast visualization (24-168h)
 * - Anomaly detection indicators
 * - PhysicsNeMo-powered predictions
 */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  BoltIcon,
  ShieldExclamationIcon,
  SparklesIcon,
  ChartBarIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'

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
  normal: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  watch: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  warning: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
  critical: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
}

// Trend icons
function TrendIcon({ trend }: { trend: string }) {
  switch (trend) {
    case 'increasing':
      return <ArrowTrendingUpIcon className="w-4 h-4 text-red-400" />
    case 'decreasing':
      return <ArrowTrendingDownIcon className="w-4 h-4 text-emerald-400" />
    case 'volatile':
      return <BoltIcon className="w-4 h-4 text-amber-400" />
    default:
      return <div className="w-4 h-4 border-t-2 border-white/40" />
  }
}

// Forecast Chart Component
function ForecastChart({ forecasts, currentScore }: { forecasts: RiskForecast['forecasts'], currentScore: number }) {
  const maxScore = Math.max(100, ...forecasts.map(f => f.upper_bound))
  
  return (
    <div className="h-32 flex items-end gap-1 p-2">
      {/* Current bar */}
      <div className="flex-1 flex flex-col items-center">
        <div 
          className="w-full bg-primary-500 rounded-t"
          style={{ height: `${(currentScore / maxScore) * 100}%` }}
        />
        <span className="text-[10px] text-white/40 mt-1">Now</span>
      </div>
      
      {/* Forecast bars */}
      {forecasts.map((f, i) => (
        <div key={i} className="flex-1 flex flex-col items-center relative">
          {/* Confidence range */}
          <div 
            className="absolute w-full bg-white/10 rounded"
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
          <span className="text-[10px] text-white/40 mt-1">{f.hours}h</span>
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
      className={`p-4 rounded-xl border ${colors.border} ${colors.bg} cursor-pointer`}
      onClick={() => setExpanded(!expanded)}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${colors.bg}`}>
            <ShieldExclamationIcon className={`w-5 h-5 ${colors.text}`} />
          </div>
          <div>
            <h4 className="font-medium text-white">{warning.asset_id}</h4>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-xs px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}>
                {warning.alert_level.toUpperCase()}
              </span>
              <TrendIcon trend={warning.trend} />
              <span className="text-xs text-white/40">{warning.trend}</span>
            </div>
          </div>
        </div>
        
        {/* Scores */}
        <div className="text-right">
          <div className="text-2xl font-bold text-white">{warning.risk_score.toFixed(0)}</div>
          <div className="flex items-center gap-1 text-xs text-white/40">
            <ClockIcon className="w-3 h-3" />
            <span>{warning.forecast_hours}h: </span>
            <span className={warning.predicted_risk_score > warning.risk_score ? 'text-red-400' : 'text-emerald-400'}>
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
            className="mt-4 pt-4 border-t border-white/10"
          >
            {/* Contributing Factors */}
            <div className="mb-3">
              <h5 className="text-xs text-white/60 mb-2">Contributing Factors</h5>
              <div className="flex flex-wrap gap-2">
                {warning.contributing_factors.map((factor, i) => (
                  <span key={i} className="text-xs px-2 py-1 bg-white/5 rounded text-white/80">
                    {factor}
                  </span>
                ))}
              </div>
            </div>
            
            {/* Recommended Actions */}
            <div>
              <h5 className="text-xs text-white/60 mb-2">Recommended Actions</h5>
              <ul className="space-y-1">
                {warning.recommended_actions.map((action, i) => (
                  <li key={i} className="text-xs text-white/70 flex items-start gap-2">
                    <span className="text-primary-400 mt-0.5">•</span>
                    {action}
                  </li>
                ))}
              </ul>
            </div>
            
            {/* Confidence */}
            <div className="mt-3 flex items-center gap-2 text-xs text-white/40">
              <SparklesIcon className="w-3 h-3" />
              <span>Confidence: {(warning.confidence * 100).toFixed(0)}%</span>
              <span className="text-white/20">|</span>
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
  assetId?: string
  compact?: boolean
}

export default function PredictivePanel({ assetId = 'portfolio-main', compact = false }: PredictivePanelProps) {
  const [activeTab, setActiveTab] = useState<'warnings' | 'forecast' | 'anomalies'>('warnings')
  
  // Fetch Early Warning
  const earlyWarningMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/predictions/early-warning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: assetId,
          climate_risk: 65,
          physical_risk: 55,
          financial_risk: 45,
          network_risk: 35,
          operational_risk: 40,
          forecast_hours: 72,
        }),
      })
      if (!res.ok) throw new Error('Failed to fetch early warning')
      return res.json() as Promise<EarlyWarning>
    },
  })
  
  // Fetch Forecast
  const forecastMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/predictions/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: assetId,
          current_score: 52,
          historical_scores: [45, 48, 50, 49, 51, 52],
          forecast_periods: [24, 48, 72, 168],
        }),
      })
      if (!res.ok) throw new Error('Failed to fetch forecast')
      return res.json() as Promise<RiskForecast>
    },
  })
  
  // Fetch Anomalies
  const anomalyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/predictions/anomaly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: assetId,
          current_values: { risk_score: 52, volatility: 15, exposure: 1000000 },
        }),
      })
      if (!res.ok) throw new Error('Failed to fetch anomalies')
      return res.json() as Promise<AnomalyResult>
    },
  })
  
  // Load data on mount
  useEffect(() => {
    earlyWarningMutation.mutate()
    forecastMutation.mutate()
    anomalyMutation.mutate()
  }, [assetId])
  
  const warning = earlyWarningMutation.data
  const forecast = forecastMutation.data
  const anomaly = anomalyMutation.data
  
  return (
    <div className={`glass rounded-2xl ${compact ? 'p-4' : 'p-6'}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ChartBarIcon className="w-5 h-5 text-primary-400" />
          <h2 className="text-lg font-display font-semibold">Predictive Analytics</h2>
          <span className="text-[10px] px-2 py-0.5 bg-green-500/20 text-green-400 rounded-full">
            PhysicsNeMo
          </span>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          {(['warnings', 'forecast', 'anomalies'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                activeTab === tab
                  ? 'bg-primary-500/30 text-primary-400'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>
      
      {/* Content */}
      <AnimatePresence mode="wait">
        {activeTab === 'warnings' && warning && (
          <motion.div
            key="warnings"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <WarningCard warning={warning} />
          </motion.div>
        )}
        
        {activeTab === 'forecast' && forecast && (
          <motion.div
            key="forecast"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between text-sm">
              <span className="text-white/60">Current Score</span>
              <span className="text-xl font-bold text-white">{forecast.current_score}</span>
            </div>
            
            <ForecastChart forecasts={forecast.forecasts} currentScore={forecast.current_score} />
            
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div className="p-3 bg-white/5 rounded-lg">
                <div className="text-white/40 text-xs">Peak Risk</div>
                <div className="text-lg font-bold text-red-400">{forecast.peak_risk_score.toFixed(0)}</div>
                <div className="text-xs text-white/40">in {forecast.peak_risk_hours}h</div>
              </div>
              <div className="p-3 bg-white/5 rounded-lg">
                <div className="text-white/40 text-xs">Trend</div>
                <div className="flex items-center gap-2 mt-1">
                  <TrendIcon trend={forecast.trend} />
                  <span className="text-white">{forecast.trend}</span>
                </div>
              </div>
            </div>
          </motion.div>
        )}
        
        {activeTab === 'anomalies' && anomaly && (
          <motion.div
            key="anomalies"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="p-4 rounded-xl border border-white/10 bg-white/5"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <ExclamationTriangleIcon className={`w-5 h-5 ${
                  anomaly.is_anomaly ? 'text-red-400' : 'text-emerald-400'
                }`} />
                <span className="font-medium">
                  {anomaly.is_anomaly ? 'Anomaly Detected' : 'No Anomalies'}
                </span>
              </div>
              <span className={`text-xs px-2 py-1 rounded-full ${
                anomaly.is_anomaly 
                  ? 'bg-red-500/20 text-red-400'
                  : 'bg-emerald-500/20 text-emerald-400'
              }`}>
                Score: {(anomaly.anomaly_score * 100).toFixed(0)}%
              </span>
            </div>
            
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-white/40">Type</span>
                <span className="text-white/80">{anomaly.anomaly_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-white/40">Deviation</span>
                <span className="text-white/80">{anomaly.deviation_sigma.toFixed(1)}σ</span>
              </div>
              <p className="text-xs text-white/60 mt-2">{anomaly.historical_comparison}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Loading states */}
      {(earlyWarningMutation.isPending || forecastMutation.isPending) && (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
        </div>
      )}
    </div>
  )
}
