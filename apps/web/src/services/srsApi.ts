/**
 * SRS (Sovereign Risk Shield) Module API Service
 */

const API_BASE = '/api/v1/srs'

export interface SovereignFund {
  id: string
  srs_id: string
  name: string
  country_code: string
  description?: string
  total_assets_usd?: number
  currency: string
  status: string
  established_year?: number
  mandate?: string
  created_at?: string
}

export interface ResourceDeposit {
  id: string
  srs_id: string
  name: string
  resource_type: string
  country_code: string
  sovereign_fund_id?: string
  estimated_value_usd?: number
  latitude?: number
  longitude?: number
  description?: string
  extraction_horizon_years?: number
  created_at?: string
}

export interface SRSIndicator {
  id: string
  country_code: string
  indicator_type: string
  value: number
  unit?: string
  source?: string
  measured_at?: string
}

export interface SRSStatus {
  module: string
  enabled: boolean
  funds_count: number
  deposits_count: number
  pilots_ready: boolean
}

export interface ScenarioRunResult {
  scenario_type: string
  country_code?: string
  fund_id?: string
  status: string
  result: Record<string, unknown>
  run_at: string
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error((err as { detail?: string }).detail || res.statusText)
  }
  return res.json()
}

export async function listFunds(params?: {
  country_code?: string
  status?: string
  limit?: number
  offset?: number
}): Promise<SovereignFund[]> {
  const sp = new URLSearchParams()
  if (params?.country_code) sp.set('country_code', params.country_code)
  if (params?.status) sp.set('status', params.status)
  if (params?.limit != null) sp.set('limit', String(params.limit))
  if (params?.offset != null) sp.set('offset', String(params.offset))
  const q = sp.toString() ? `?${sp}` : ''
  return request<SovereignFund[]>(`/funds${q}`)
}

export async function createFund(body: {
  name: string
  country_code: string
  description?: string
  total_assets_usd?: number
  currency?: string
  status?: string
  established_year?: number
  mandate?: string
  extra_data?: Record<string, unknown>
}): Promise<SovereignFund> {
  return request<SovereignFund>('/funds', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getFund(fundId: string): Promise<SovereignFund> {
  return request<SovereignFund>(`/funds/${encodeURIComponent(fundId)}`)
}

export async function listDeposits(params?: {
  country_code?: string
  sovereign_fund_id?: string
  resource_type?: string
  limit?: number
  offset?: number
}): Promise<ResourceDeposit[]> {
  const sp = new URLSearchParams()
  if (params?.country_code) sp.set('country_code', params.country_code)
  if (params?.sovereign_fund_id) sp.set('sovereign_fund_id', params.sovereign_fund_id)
  if (params?.resource_type) sp.set('resource_type', params.resource_type)
  if (params?.limit != null) sp.set('limit', String(params.limit))
  if (params?.offset != null) sp.set('offset', String(params.offset))
  const q = sp.toString() ? `?${sp}` : ''
  return request<ResourceDeposit[]>(`/deposits${q}`)
}

export async function createDeposit(body: {
  name: string
  resource_type: string
  country_code: string
  sovereign_fund_id?: string
  estimated_value_usd?: number
  latitude?: number
  longitude?: number
  description?: string
  extraction_horizon_years?: number
}): Promise<ResourceDeposit> {
  return request<ResourceDeposit>('/deposits', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getDeposit(depositId: string): Promise<ResourceDeposit> {
  return request<ResourceDeposit>(`/deposits/${encodeURIComponent(depositId)}`)
}

export async function getIndicators(params?: {
  country_code?: string
  indicator_type?: string
  limit?: number
}): Promise<SRSIndicator[]> {
  const sp = new URLSearchParams()
  if (params?.country_code) sp.set('country_code', params.country_code)
  if (params?.indicator_type) sp.set('indicator_type', params.indicator_type)
  if (params?.limit != null) sp.set('limit', String(params.limit))
  const q = sp.toString() ? `?${sp}` : ''
  return request<SRSIndicator[]>(`/indicators${q}`)
}

export async function runScenario(body: {
  scenario_type: string
  country_code?: string
  fund_id?: string
  params?: Record<string, unknown>
}): Promise<ScenarioRunResult> {
  return request<ScenarioRunResult>('/scenarios/run', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export async function getSRSStatus(): Promise<SRSStatus> {
  return request<SRSStatus>('/status')
}

export interface ScenarioType {
  id: string
  name: string
  description: string
}

export async function listScenarioTypes(): Promise<{ scenario_types: ScenarioType[] }> {
  return request<{ scenario_types: ScenarioType[] }>('/scenarios/types')
}

export async function runBatchScenarios(body: {
  scenario_types: string[]
  country_code?: string
  fund_id?: string
  params?: Record<string, unknown>
}): Promise<{ scenarios: ScenarioRunResult[]; count: number }> {
  return request<{ scenarios: ScenarioRunResult[]; count: number }>('/scenarios/batch', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

export interface CountrySummary {
  country_code: string
  funds_count: number
  deposits_count: number
  total_fund_assets_usd: number
  total_deposit_value_usd: number
  total_wealth_usd: number
  resource_mix: Record<string, number>
  active_funds: number
  frozen_funds: number
}

export async function getCountrySummary(countryCode: string): Promise<CountrySummary> {
  return request<CountrySummary>(`/countries/${encodeURIComponent(countryCode)}/summary`)
}

export interface HeatmapEntry {
  country_code: string
  total_wealth_usd: number
  fund_assets: number
  deposit_value: number
  fund_count: number
  deposit_count: number
}

export async function getHeatmapData(): Promise<HeatmapEntry[]> {
  return request<HeatmapEntry[]>('/heatmap')
}

export async function updateFund(fundId: string, body: Partial<{
  name: string
  description: string
  total_assets_usd: number
  currency: string
  status: string
  mandate: string
}>): Promise<SovereignFund> {
  return request<SovereignFund>(`/funds/${encodeURIComponent(fundId)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  })
}

export async function deleteFund(fundId: string): Promise<{ status: string; id: string }> {
  return request<{ status: string; id: string }>(`/funds/${encodeURIComponent(fundId)}`, {
    method: 'DELETE',
  })
}

/** Seed SRS with demo sovereign funds and deposits (calls POST /api/v1/seed/srs). */
export async function seedSRS(): Promise<{ status: string; message?: string; srs_funds?: number; srs_deposits?: number }> {
  const res = await fetch('/api/v1/seed/srs', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error((err as { detail?: string }).detail || res.statusText)
  }
  return res.json()
}
