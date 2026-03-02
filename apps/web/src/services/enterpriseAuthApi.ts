/**
 * Enterprise Auth API — /api/v1/auth/enterprise
 */

const API_BASE = '/api/v1/auth/enterprise'

export interface UserSession {
  id: string
  user_id: string
  ip_address?: string
  user_agent?: string
  created_at: string
  last_active?: string
  is_current?: boolean
}

export interface LoginHistoryEntry {
  id: string
  email: string
  ip_address?: string
  method: string
  success: boolean
  timestamp: string
  user_agent?: string
}

export interface APIKeyInfo {
  id: string
  name: string
  prefix: string
  scopes: string[]
  created_at: string
  last_used?: string
  expires_at?: string
  is_active: boolean
}

export interface PermissionsMatrix {
  roles: string[]
  permissions: string[]
  matrix: Record<string, string[]>
}

export interface TwoFASetupResult {
  secret: string
  uri: string
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

// 2FA
export async function setup2FA(): Promise<TwoFASetupResult> {
  return request<TwoFASetupResult>('/2fa/setup', { method: 'POST' })
}
export async function verify2FA(code: string): Promise<{ verified: boolean }> {
  return request<{ verified: boolean }>('/2fa/verify', {
    method: 'POST',
    body: JSON.stringify({ code }),
  })
}

// Sessions
export async function listSessions(): Promise<{ sessions: UserSession[] }> {
  return request<{ sessions: UserSession[] }>('/sessions')
}
export async function revokeSession(sessionId: string): Promise<{ status: string }> {
  return request<{ status: string }>(`/sessions/${sessionId}/revoke`, { method: 'POST' })
}
export async function revokeAllSessions(): Promise<{ status: string }> {
  return request<{ status: string }>('/sessions/revoke-all', { method: 'POST' })
}

// Login History
export async function getLoginHistory(limit?: number): Promise<{ history: LoginHistoryEntry[] }> {
  const q = limit ? `?limit=${limit}` : ''
  return request<{ history: LoginHistoryEntry[] }>(`/login-history${q}`)
}

// API Keys
export async function createAPIKey(body: {
  name: string
  scopes?: string[]
  expires_days?: number
}): Promise<{ key: string; info: APIKeyInfo }> {
  return request<{ key: string; info: APIKeyInfo }>('/api-keys', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}
export async function listAPIKeys(): Promise<{ keys: APIKeyInfo[] }> {
  return request<{ keys: APIKeyInfo[] }>('/api-keys')
}
export async function revokeAPIKey(keyId: string): Promise<{ status: string }> {
  return request<{ status: string }>(`/api-keys/${keyId}/revoke`, { method: 'POST' })
}

// Permissions
export async function getPermissionsMatrix(): Promise<PermissionsMatrix> {
  return request<PermissionsMatrix>('/permissions/matrix')
}

// SSO
export async function listOAuth2Providers(): Promise<{
  providers: string[]
  sso_enabled: boolean
}> {
  return request<{ providers: string[]; sso_enabled: boolean }>('/oauth2/providers')
}
