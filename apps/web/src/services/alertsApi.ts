/**
 * Alerts API — fetches agent-generated alerts from /api/v1/alerts
 */

const API_BASE = '/api/v1/alerts'

export interface AlertRaw {
  id: string
  source: string | null
  alert_type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  message?: string
  asset_ids?: string[]
  exposure?: number
  recommended_actions?: string[]
  created_at: string
  resolved?: boolean
  acknowledged?: boolean
}

export interface Alert {
  id: string
  source: string
  type: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  title: string
  description?: string
  asset_id?: string
  module?: string
  timestamp: string
  resolved?: boolean
  resolved_at?: string
  acknowledged?: boolean
  recommended_actions?: string[]
  exposure?: number
}

function normalizeAlert(raw: AlertRaw): Alert {
  return {
    id: raw.id,
    source: raw.source || 'SYSTEM',
    type: raw.alert_type,
    severity: raw.severity,
    title: raw.title,
    description: raw.message,
    asset_id: raw.asset_ids?.[0],
    module: raw.source?.split('_')[0]?.toLowerCase(),
    timestamp: raw.created_at,
    resolved: raw.resolved,
    acknowledged: raw.acknowledged,
    recommended_actions: raw.recommended_actions,
    exposure: raw.exposure,
  }
}

export interface AlertSummary {
  total: number
  critical: number
  high: number
  medium: number
  low: number
  unresolved: number
  total_exposure_eur: number
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

export async function listAlerts(params?: {
  severity?: string
  unresolved_only?: boolean
  limit?: number
}): Promise<Alert[]> {
  const sp = new URLSearchParams()
  if (params?.severity) sp.set('severity', params.severity)
  if (params?.unresolved_only) sp.set('unresolved_only', 'true')
  if (params?.limit != null) sp.set('limit', String(params.limit))
  const q = sp.toString() ? `?${sp}` : ''
  const raw = await request<AlertRaw[]>(`/${q}`)
  return raw.map(normalizeAlert)
}

export async function getAlertSummary(): Promise<AlertSummary> {
  return request<AlertSummary>('/summary')
}

export async function acknowledgeAlert(alertId: string): Promise<{ status: string }> {
  return request<{ status: string }>('/acknowledge', {
    method: 'POST',
    body: JSON.stringify({ alert_id: alertId }),
  })
}

export async function resolveAlert(alertId: string, notes?: string): Promise<{ status: string }> {
  return request<{ status: string }>('/resolve', {
    method: 'POST',
    body: JSON.stringify({ alert_id: alertId, resolution_notes: notes }),
  })
}

export async function startMonitoring(): Promise<{ status: string }> {
  return request<{ status: string }>('/monitoring/start', { method: 'POST' })
}

export async function getMonitoringStatus(): Promise<{ monitoring_active: boolean; agents_count: number }> {
  return request<{ monitoring_active: boolean; agents_count: number }>('/monitoring/status')
}
