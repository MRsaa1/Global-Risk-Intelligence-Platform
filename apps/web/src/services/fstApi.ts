/**
 * FST (Financial System Stress Test Engine) Module API Service
 */

const API_BASE = '/api/v1/fst'

export interface FSTScenario {
  id: string
  name: string
  description: string
  physical_shock?: string
  regulatory_format?: string
}

export interface FSTRunSummary {
  id: string
  fst_id: string
  scenario_type: string
  scenario_name?: string
  status: string
  regulatory_format?: string
  run_at?: string
}

export interface FSTStatus {
  module: string
  enabled: boolean
  scenarios_count: number
  pilots_ready: boolean
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

export async function listScenarios(): Promise<FSTScenario[]> {
  return request<FSTScenario[]>('/scenarios')
}

export async function runScenario(body: {
  scenario_id: string
  regulatory_format?: string
  params?: Record<string, unknown>
}): Promise<{ fst_run_id: string; report: Record<string, unknown>; sro_summary?: unknown }> {
  return request('/scenarios/run', { method: 'POST', body: JSON.stringify(body) })
}

export async function listRuns(params?: { limit?: number; offset?: number }): Promise<FSTRunSummary[]> {
  const sp = new URLSearchParams()
  if (params?.limit != null) sp.set('limit', String(params.limit))
  if (params?.offset != null) sp.set('offset', String(params.offset))
  const q = sp.toString() ? `?${sp}` : ''
  return request<FSTRunSummary[]>(`/runs${q}`)
}

export async function getFSTStatus(): Promise<FSTStatus> {
  return request<FSTStatus>('/status')
}
