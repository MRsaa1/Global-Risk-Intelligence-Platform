/**
 * Analytics API Service
 * 
 * Provides typed functions to fetch analytics data from the backend API.
 * Used by Dashboard and other components for real data instead of mocks.
 */

const API_BASE = '/api/v1/analytics'

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
  value: number
  risk: number
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

// ==================== API FUNCTIONS ====================

/**
 * Fetch risk trends over time
 */
export async function getRiskTrends(timeRange: string = '1M'): Promise<RiskTrendsResponse> {
  const response = await fetch(`${API_BASE}/risk-trends?time_range=${timeRange}`)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch risk trends: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Fetch risk distribution across assets
 */
export async function getRiskDistribution(): Promise<RiskDistributionResponse> {
  const response = await fetch(`${API_BASE}/risk-distribution`)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch risk distribution: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Fetch top risk assets
 */
export async function getTopRiskAssets(limit: number = 10): Promise<TopRiskAssetsResponse> {
  const response = await fetch(`${API_BASE}/top-risk-assets?limit=${limit}`)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch top risk assets: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Fetch scenario comparison data
 */
export async function getScenarioComparison(): Promise<ScenarioComparisonResponse> {
  const response = await fetch(`${API_BASE}/scenario-comparison`)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch scenario comparison: ${response.statusText}`)
  }
  
  return response.json()
}

/**
 * Fetch portfolio summary
 */
export async function getPortfolioSummary(): Promise<PortfolioSummary> {
  const response = await fetch(`${API_BASE}/portfolio-summary`)
  
  if (!response.ok) {
    throw new Error(`Failed to fetch portfolio summary: ${response.statusText}`)
  }
  
  return response.json()
}

// ==================== CONVENIENCE OBJECT ====================

export const analyticsApi = {
  getRiskTrends,
  getRiskDistribution,
  getTopRiskAssets,
  getScenarioComparison,
  getPortfolioSummary,
}

export default analyticsApi
