/**
 * ASGI Module API Service
 * AI Safety & Governance Infrastructure - Phase 3
 */

const API_BASE = '/api/v1/asgi'

export interface AISystem {
  id: number
  name: string
  version?: string
  system_type?: string
  capability_level?: string
  created_at?: string
}

export interface CapabilityAlert {
  system_id?: number
  system_name?: string
  metric?: string
  value?: unknown
  threshold?: number
  severity?: number
  alert_id?: number
  event_type?: string
  created_at?: string
}

export interface EmergenceResult {
  system_id: string
  alerts: Array<{ metric: string; value: unknown; threshold: unknown; severity: number }>
  metrics?: Record<string, unknown>
  recommendation: 'PAUSE' | 'MONITOR'
}

export interface DriftResult {
  system_id: string
  drift_score: number
  snapshot_count?: number
  constraint_relaxations?: Array<{ snapshot_date?: string; constraint_count?: number }>
  trend: 'STABLE' | 'CONCERNING'
  recommended_action: string
}

export interface ComplianceFramework {
  id: number
  framework_code: string
  name?: string
  jurisdiction?: string
  effective_date?: string
}

export interface AuditAnchor {
  id: number
  event_count?: number
  anchor_type?: string
  anchor_reference?: string
  created_at?: string
}

async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...opts,
    headers: { 'Content-Type': 'application/json', ...opts?.headers },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text || `HTTP ${res.status}`)
  }
  return res.json()
}

// Systems
export async function listSystems(): Promise<{ items: AISystem[]; total: number }> {
  return fetchJson(`${API_BASE}/systems`)
}

export async function getSystem(id: number): Promise<AISystem> {
  return fetchJson(`${API_BASE}/systems/${id}`)
}

export async function registerSystem(data: {
  name: string
  version?: string
  system_type?: string
  capability_level?: string
}): Promise<AISystem> {
  return fetchJson(`${API_BASE}/systems`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

export async function updateSystem(
  id: number,
  data: { name?: string; version?: string; system_type?: string; capability_level?: string }
): Promise<AISystem> {
  return fetchJson(`${API_BASE}/systems/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
}

export async function deleteSystem(id: number): Promise<{ status: string }> {
  return fetchJson(`${API_BASE}/systems/${id}`, { method: 'DELETE' })
}

// Capability Emergence
export async function getEmergenceAlerts(): Promise<{ alerts: CapabilityAlert[]; count: number }> {
  return fetchJson(`${API_BASE}/emergence/alerts`)
}

export async function getEmergenceSystem(
  systemId: number,
  windowHours?: number
): Promise<EmergenceResult> {
  const q = windowHours != null ? `?window_hours=${windowHours}` : ''
  return fetchJson(`${API_BASE}/emergence/${systemId}${q}`)
}

export async function acknowledgeAlert(alertId: number, respondedBy: string): Promise<unknown> {
  return fetchJson(`${API_BASE}/emergence/acknowledge`, {
    method: 'POST',
    body: JSON.stringify({ alert_id: alertId, responded_by: respondedBy }),
  })
}

export async function createCapabilityEvent(data: {
  ai_system_id: number
  event_type: string
  metrics?: Record<string, unknown>
  severity?: number
}): Promise<{ id: number; ai_system_id: number; event_type: string; severity?: number }> {
  return fetchJson(`${API_BASE}/emergence/events`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// Goal Drift
export async function getDrift(systemId: number, days?: number): Promise<DriftResult> {
  const q = days != null ? `?days=${days}` : ''
  return fetchJson(`${API_BASE}/drift/${systemId}${q}`)
}

export async function getDriftCompare(systemIds: number[]): Promise<{
  comparisons: DriftResult[]
}> {
  const q = systemIds.join(',')
  return fetchJson(`${API_BASE}/drift/compare?system_ids=${q}`)
}

export async function createDriftSnapshot(data: {
  ai_system_id: number
  plan_embedding?: number[]
  constraint_set?: Record<string, unknown>
  drift_from_baseline?: number
}): Promise<{ id: number; ai_system_id: number; drift_from_baseline?: number }> {
  return fetchJson(`${API_BASE}/drift/snapshots`, {
    method: 'POST',
    body: JSON.stringify(data),
  })
}

// Compliance
export async function getComplianceFrameworks(): Promise<{ frameworks: ComplianceFramework[] }> {
  return fetchJson(`${API_BASE}/compliance/frameworks`)
}

export async function getSystemCompliance(systemId: number): Promise<{
  system_id: string
  frameworks: Record<string, { status: string; framework_name?: string; jurisdiction?: string }>
}> {
  return fetchJson(`${API_BASE}/compliance/${systemId}`)
}

export async function generateComplianceReport(systemId: number): Promise<{
  system_id: string
  system_name?: string
  compliance_status: Record<string, unknown>
  summary?: { assessed: number; compliant: number; not_assessed: number }
}> {
  return fetchJson(`${API_BASE}/compliance/report`, {
    method: 'POST',
    body: JSON.stringify({ system_id: systemId }),
  })
}

// Audit
export async function getAuditAnchors(): Promise<{ anchors: AuditAnchor[] }> {
  return fetchJson(`${API_BASE}/audit/anchors`)
}

export async function verifyAuditEvent(eventId: string): Promise<{ event_id: string; verified: boolean }> {
  return fetchJson(`${API_BASE}/audit/verify/${eventId}`)
}

export async function logAuditEvent(event: Record<string, unknown>): Promise<{ event_hash: string; status: string }> {
  return fetchJson(`${API_BASE}/audit/log`, {
    method: 'POST',
    body: JSON.stringify({ event }),
  })
}
