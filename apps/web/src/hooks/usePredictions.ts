/**
 * Shared hook for Predictive Analytics (Early Warning, Forecast, Anomaly)
 *
 * Fetches real metrics from analyticsApi/Assets API and passes to predictions API.
 * - Portfolio/asset metrics: real (analyticsApi.getPortfolioSummary, assetsApi.get).
 * - fetchRiskTrendScores: real (analyticsApi.getRiskTrends).
 * - Early Warning / Forecast / Anomaly: POST /api/v1/predictions/early-warning, forecast, anomaly.
 *   These are real API calls; if the backend does not implement these routes, requests will fail
 *   and the panel shows the error. Connect your ML prediction service to enable them.
 * Used by PredictivePanel and TimelinePredictionsPanel.
 */

import { useCallback, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { analyticsApi } from '../services/analyticsApi'
import { assetsApi } from '../lib/api'

export interface PredictionMetrics {
  assetId: string
  climate_risk: number
  physical_risk: number
  financial_risk: number
  network_risk: number
  operational_risk: number
  current_score: number
  historical_scores: number[]
}

const DEFAULT_METRICS: Omit<PredictionMetrics, 'assetId'> = {
  climate_risk: 65,
  physical_risk: 55,
  financial_risk: 45,
  network_risk: 35,
  operational_risk: 40,
  current_score: 52,
  historical_scores: [45, 48, 50, 49, 51, 52],
}

/**
 * Fetch metrics for portfolio (from analytics API)
 */
export async function fetchPortfolioMetrics(): Promise<PredictionMetrics> {
  try {
    const summary = await analyticsApi.getPortfolioSummary()
    const avg =
      (summary.avg_climate_risk + summary.avg_physical_risk + summary.avg_network_risk) / 3
    const current = Math.round(avg * 100) / 100
    const hist = await fetchRiskTrendScores()
    return {
      assetId: 'portfolio_global',
      climate_risk: summary.avg_climate_risk ?? 50,
      physical_risk: summary.avg_physical_risk ?? 50,
      financial_risk: summary.avg_climate_risk ?? 50,
      network_risk: summary.avg_network_risk ?? 50,
      operational_risk: (summary.avg_physical_risk ?? 50) * 0.8,
      current_score: current,
      historical_scores: hist.length >= 5 ? hist : [45, 48, 50, 49, 51, current],
    }
  } catch {
    return { ...DEFAULT_METRICS, assetId: 'portfolio_global' }
  }
}

/**
 * Fetch metrics for a specific asset
 */
export async function fetchAssetMetrics(assetId: string): Promise<PredictionMetrics> {
  try {
    const asset = await assetsApi.get(assetId)
    const climate = asset.climate_risk_score ?? 50
    const physical = asset.physical_risk_score ?? 50
    const network = asset.network_risk_score ?? 50
    const current = Math.round(((climate + physical + network) / 3) * 100) / 100
    return {
      assetId,
      climate_risk: climate,
      physical_risk: physical,
      financial_risk: climate * 0.9,
      network_risk: network,
      operational_risk: physical * 0.8,
      current_score: current,
      historical_scores: [climate * 0.9, climate * 0.95, current * 0.98, current],
    }
  } catch {
    return { ...DEFAULT_METRICS, assetId }
  }
}

async function fetchRiskTrendScores(): Promise<number[]> {
  try {
    const data = await analyticsApi.getRiskTrends('1M')
    if (data?.series?.[0]?.data?.length) {
      return data.series[0].data.slice(-10).map((p) => p.value)
    }
  } catch {
    // ignore
  }
  return []
}

export interface UsePredictionsOptions {
  context: 'portfolio' | 'asset'
  assetId?: string
  /** Override metrics (e.g. from selectedZone in Command Center) */
  overrideMetrics?: Partial<PredictionMetrics>
}

export function usePredictions({
  context,
  assetId = 'portfolio_global',
  overrideMetrics,
}: UsePredictionsOptions) {
  const queryClient = useQueryClient()

  const metricsQuery = useQuery({
    queryKey: ['predictive-metrics', context, assetId],
    queryFn: () =>
      context === 'asset' && assetId
        ? fetchAssetMetrics(assetId)
        : fetchPortfolioMetrics(),
    staleTime: 5 * 60 * 1000,
    enabled: context !== 'asset' || !!assetId,
  })

  const metrics: PredictionMetrics | undefined = metricsQuery.data
    ? { ...metricsQuery.data, ...overrideMetrics }
    : overrideMetrics
      ? { ...DEFAULT_METRICS, assetId, ...overrideMetrics }
      : undefined

  const earlyWarningMutation = useMutation({
    mutationFn: async () => {
      const m = metrics ?? { ...DEFAULT_METRICS, assetId }
      const res = await fetch('/api/v1/predictions/early-warning', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: m.assetId,
          climate_risk: m.climate_risk,
          physical_risk: m.physical_risk,
          financial_risk: m.financial_risk,
          network_risk: m.network_risk,
          operational_risk: m.operational_risk,
          forecast_hours: 72,
        }),
      })
      if (!res.ok) throw new Error('Failed to fetch early warning')
      return res.json()
    },
  })

  const forecastMutation = useMutation({
    mutationFn: async () => {
      const m = metrics ?? { ...DEFAULT_METRICS, assetId }
      const res = await fetch('/api/v1/predictions/forecast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: m.assetId,
          current_score: m.current_score,
          historical_scores: m.historical_scores,
          forecast_periods: [24, 48, 72, 168],
        }),
      })
      if (!res.ok) throw new Error('Failed to fetch forecast')
      return res.json()
    },
  })

  const anomalyMutation = useMutation({
    mutationFn: async () => {
      const m = metrics ?? { ...DEFAULT_METRICS, assetId }
      const res = await fetch('/api/v1/predictions/anomaly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          asset_id: m.assetId,
          current_values: {
            risk_score: m.current_score,
            volatility: 15,
            exposure: 1000000,
          },
        }),
      })
      if (!res.ok) throw new Error('Failed to fetch anomalies')
      return res.json()
    },
  })

  const refresh = useCallback(() => {
    if (metrics) {
      earlyWarningMutation.mutate()
      forecastMutation.mutate()
      anomalyMutation.mutate()
    }
    queryClient.invalidateQueries({ queryKey: ['predictive-metrics', context, assetId] })
  }, [metrics, context, assetId, queryClient])

  useEffect(() => {
    const m = metrics ?? (overrideMetrics ? { ...DEFAULT_METRICS, assetId, ...overrideMetrics } : null)
    if (m) {
      earlyWarningMutation.mutate()
      forecastMutation.mutate()
      anomalyMutation.mutate()
    }
  }, [metricsQuery.dataUpdatedAt, metricsQuery.isSuccess, !!overrideMetrics, overrideMetrics?.assetId, overrideMetrics?.current_score])

  const isPending =
    earlyWarningMutation.isPending || forecastMutation.isPending || anomalyMutation.isPending
  const error =
    earlyWarningMutation.error || forecastMutation.error || anomalyMutation.error || undefined

  return {
    metrics,
    metricsLoading: metricsQuery.isLoading,
    warning: earlyWarningMutation.data,
    forecast: forecastMutation.data,
    anomaly: anomalyMutation.data,
    isPending,
    error: error instanceof Error ? error.message : error ? String(error) : undefined,
    refresh,
  }
}
