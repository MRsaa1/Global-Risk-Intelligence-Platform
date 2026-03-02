/**
 * CityOS (City Operating System) Module API Service
 */

const API_BASE = '/api/v1/cityos'

export interface CityTwin {
  id: string
  cityos_id: string
  name: string
  country_code: string
  region?: string
  latitude?: number
  longitude?: number
  population?: number
  description?: string
  capacity_notes?: string
  created_at?: string
}

export interface MigrationRoute {
  id: string
  cityos_id: string
  name: string
  origin_city_id?: string
  destination_city_id?: string
  estimated_flow_per_year?: number
  driver_type?: string
  description?: string
  created_at?: string
}

export interface CityOSStatus {
  module: string
  enabled: boolean
  cities_count: number
  migration_routes_count: number
  pilots_ready: boolean
}

export interface ForecastResult {
  city_id?: string
  scenario: string
  status: string
  forecast: Record<string, unknown>
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

export async function listCities(params?: { country_code?: string; limit?: number; offset?: number }): Promise<CityTwin[]> {
  const sp = new URLSearchParams()
  if (params?.country_code) sp.set('country_code', params.country_code)
  if (params?.limit != null) sp.set('limit', String(params.limit))
  if (params?.offset != null) sp.set('offset', String(params.offset))
  const q = sp.toString() ? `?${sp}` : ''
  return request<CityTwin[]>(`/cities${q}`)
}

export async function createCity(body: {
  name: string
  country_code: string
  region?: string
  latitude?: number
  longitude?: number
  population?: number
  description?: string
  capacity_notes?: string
}): Promise<CityTwin> {
  return request<CityTwin>('/cities', { method: 'POST', body: JSON.stringify(body) })
}

export async function getCity(cityId: string): Promise<CityTwin> {
  return request<CityTwin>(`/cities/${encodeURIComponent(cityId)}`)
}

export async function listMigrationRoutes(params?: {
  origin_city_id?: string
  destination_city_id?: string
  limit?: number
  offset?: number
}): Promise<MigrationRoute[]> {
  const sp = new URLSearchParams()
  if (params?.origin_city_id) sp.set('origin_city_id', params.origin_city_id)
  if (params?.destination_city_id) sp.set('destination_city_id', params.destination_city_id)
  if (params?.limit != null) sp.set('limit', String(params.limit))
  if (params?.offset != null) sp.set('offset', String(params.offset))
  const q = sp.toString() ? `?${sp}` : ''
  return request<MigrationRoute[]>(`/migration-routes${q}`)
}

export async function createMigrationRoute(body: {
  name: string
  origin_city_id?: string
  destination_city_id?: string
  estimated_flow_per_year?: number
  driver_type?: string
  description?: string
}): Promise<MigrationRoute> {
  return request<MigrationRoute>('/migration-routes', { method: 'POST', body: JSON.stringify(body) })
}

export async function getForecast(cityId?: string, scenario?: string): Promise<ForecastResult> {
  const sp = new URLSearchParams()
  if (cityId) sp.set('city_id', cityId)
  if (scenario) sp.set('scenario', scenario)
  const q = sp.toString() ? `?${sp}` : ''
  return request<ForecastResult>(`/forecast${q}`)
}

export async function getCityOSStatus(): Promise<CityOSStatus> {
  return request<CityOSStatus>('/status')
}

/** Seed CityOS with demo cities and routes (calls POST /api/v1/seed/cityos). */
export async function seedCityOS(): Promise<{ status: string; message?: string; added?: number }> {
  const res = await fetch('/api/v1/seed/cityos', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error((err as { detail?: string }).detail || res.statusText)
  }
  return res.json()
}
