/**
 * Analytics API Service
 * 
 * Provides typed functions to fetch analytics data from the backend API.
 * Uses getApiV1Base() so requests work on server (same origin or VITE_API_URL) and with tunnel (?api=).
 */

import { getApiV1Base } from '../config/env'

function getAnalyticsBase(): string {
  const v1 = getApiV1Base()
  return v1 ? `${v1}/analytics` : '/api/v1/analytics'
}

// ==================== TYPES ====================

export interface RiskTrendPoint {
  date: string
  value: number
}

export interface RiskTrendSeries {
  id: string
  name: string
  color: string
  data: RiskTrendPoint[]
}

export interface RiskTrendsResponse {
  time_range: string
  series: RiskTrendSeries[]
  last_updated: string
}

export interface RiskDistributionItem {
  id: string
  label: string
  value: number
  color: string
  risk: number
}

export interface RiskDistributionResponse {
  distribution: RiskDistributionItem[]
  total_assets: number
}

export interface TopRiskAsset {
  id: string
  label: string
  value: number  // exposure in millions
  risk: number
  expected_loss?: number | null  // in millions
  risk_driver?: string | null    // climate | physical | network
  city?: string
  asset_type?: string
}

export interface TopRiskAssetsResponse {
  assets: TopRiskAsset[]
  limit: number
}

export interface ScenarioMetric {
  id: string
  label: string
  before: number
  after: number
  format: 'currency' | 'percent' | 'number'
  higherIsBetter: boolean
}

export interface ScenarioComparison {
  id: string
  name: string
  description: string
  metrics: ScenarioMetric[]
}

export interface ScenarioComparisonResponse {
  scenarios: ScenarioComparison[]
}

export interface PortfolioSummary {
  total_assets: number
  total_value: number
  total_value_formatted: string
  weighted_risk: number
  critical_count: number
  high_count: number
  at_risk_count: number
  avg_climate_risk: number
  avg_physical_risk: number
  avg_network_risk: number
}

export interface SectorImpact {
  name: string
  direction: 'positive' | 'negative' | 'neutral'
  impact_bps: number
  confidence: 'low' | 'medium' | 'high'
}

export interface HistoricalParallel {
  event: string
  date: string
  actual_impact: string
}

export interface MarketContext {
  current_vix: number | null
  spx: number | null
  expected_vol_delta: 'up' | 'down' | 'unchanged'
}

export interface HeadlineImpactResponse {
  headline: string
  sectors: string[]
  sector_impacts: SectorImpact[]
  direction: 'positive' | 'negative' | 'neutral'
  volatility_estimate: 'low' | 'medium' | 'high'
  market_context: MarketContext | null
  portfolio_impact_pct: number | null
  historical_parallel: HistoricalParallel | null
  confidence: 'low' | 'medium' | 'high'
  summary: string
}

// ==================== API FUNCTIONS ====================

/**
 * Fetch risk trends over time
 */
export async function getRiskTrends(timeRange: string = '1M'): Promise<RiskTrendsResponse> {
  const response = await fetch(`${getAnalyticsBase()}/risk-trends?time_range=${timeRange}`)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch risk trends: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Fetch risk distribution across assets
 */
export async function getRiskDistribution(): Promise<RiskDistributionResponse> {
  const response = await fetch(`${getAnalyticsBase()}/risk-distribution`)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch risk distribution: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Fetch top risk assets
 */
export async function getTopRiskAssets(limit: number = 10): Promise<TopRiskAssetsResponse> {
  const response = await fetch(`${getAnalyticsBase()}/top-risk-assets?limit=${limit}`)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch top risk assets: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Fetch scenario comparison data
 */
export async function getScenarioComparison(): Promise<ScenarioComparisonResponse> {
  const response = await fetch(`${getAnalyticsBase()}/scenario-comparison`)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch scenario comparison: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Fetch portfolio summary
 */
export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  const response = await fetch(`${getAnalyticsBase()}/portfolio-summary`)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch portfolio summary: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Headline to PnL: assess impact of a headline on sectors and volatility
 */
export async function postHeadlineImpact(headline: string): Promise<HeadlineImpactResponse> {
  const response = await fetch(`${getAnalyticsBase()}/headline-impact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ headline }),
  })
  if (!response.ok) {
    let detail = 'Failed to get headline impact'
    try {
      const body = await response.json()
      if (body?.detail) detail = typeof body.detail === 'string' ? body.detail : JSON.stringify(body.detail)
    } catch {
      // ignore
    }
    throw new Error(detail)
  }
  return response.json()
}

/**
 * Stress Duel: compare two scenarios and get a verdict
 */
export interface StressDuelRequest {
  scenario_id_a: string
  scenario_id_b: string
}

export interface StressDuelResponse {
  scenario_a: ScenarioComparison
  scenario_b: ScenarioComparison
  verdict: string
  more_dangerous: string
  hedge_first: string
  confidence: string
}

export async function postStressDuel(
  scenarioIdA: string,
  scenarioIdB: string,
): Promise<StressDuelResponse> {
  const response = await fetch(`${getAnalyticsBase()}/stress-duel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scenario_id_a: scenarioIdA, scenario_id_b: scenarioIdB }),
  })
  if (!response.ok) throw new Error('Failed to run stress duel')
  return response.json()
}

// ==================== CONVENIENCE OBJECT ====================

export const analyticsApi = {
  getRiskTrends,
  getRiskDistribution,
  getTopRiskAssets,
  getScenarioComparison,
  getPortfolioSummary,
  postHeadlineImpact,
  postStressDuel,
}

export default analyticsApi
