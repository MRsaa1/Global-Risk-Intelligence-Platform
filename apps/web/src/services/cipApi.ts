/**
 * CIP Module API Service
 * 
 * Client for Critical Infrastructure Protection API endpoints.
 */

const API_BASE = '/api/v1/cip'

// Types
export interface InfrastructureType {
  id: string
  value: string
  label: string
}

export interface CriticalityLevel {
  id: string
  value: string
  label: string
}

export interface Infrastructure {
  id: string
  cip_id: string
  name: string
  description?: string
  infrastructure_type: string
  criticality_level: string
  operational_status: string
  latitude?: number
  longitude?: number
  country_code: string
  region?: string
  city?: string
  capacity_value?: number
  capacity_unit?: string
  population_served?: number
  owner_organization?: string
  operator_organization?: string
  vulnerability_score?: number
  cascade_risk_score?: number
}

export interface Dependency {
  id: string
  source_id: string
  target_id: string
  dependency_type: string
  strength: number
  propagation_delay_minutes?: number
  description?: string
}

export interface CascadeRiskResult {
  infrastructure_id: string
  cip_id: string
  name: string
  cascade_depth_analyzed: number
  affected_count: number
  affected_infrastructure: Array<{
    infrastructure_id: string
    depth: number
    dependency_strength: number
    propagation_delay?: number
  }>
  total_population_at_risk: number
  cascade_risk_score: number
}

export interface VulnerabilityAssessment {
  infrastructure_id: string
  cip_id: string
  name: string
  criticality_level: string
  operational_status: string
  scores: {
    vulnerability: number
    exposure: number
    resilience: number
    cascade_risk: number
  }
  dependencies: {
    upstream_count: number
    downstream_count: number
  }
  recovery: {
    estimated_hours?: number
    has_backup: boolean
  }
  population_served?: number
}

export interface CIPStatistics {
  total_infrastructure: number
  total_dependencies: number
  by_type: Record<string, number>
  by_criticality: Record<string, number>
  by_status: Record<string, number>
}

export interface RegisterInfrastructureRequest {
  name: string
  infrastructure_type: string
  latitude: number
  longitude: number
  criticality_level?: string
  country_code?: string
  region?: string
  city?: string
  description?: string
  capacity_value?: number
  capacity_unit?: string
  population_served?: number
  owner_organization?: string
  operator_organization?: string
  asset_id?: string
  extra_data?: Record<string, any>
}

// API Functions

/**
 * Get CIP module status and statistics
 */
export async function getCIPStatus(): Promise<{
  module: string
  status: string
  version: string
  statistics: CIPStatistics
}> {
  const response = await fetch(`${API_BASE}`)
  if (!response.ok) throw new Error('Failed to fetch CIP status')
  return response.json()
}

/**
 * Get available infrastructure types (for register form dropdown)
 */
export async function getInfrastructureTypes(): Promise<{
  types: Array<{ value: string; name: string }>
}> {
  const response = await fetch(`${API_BASE}/types`)
  if (!response.ok) throw new Error('Failed to fetch infrastructure types')
  return response.json()
}

/**
 * Get criticality levels (for register form dropdown)
 */
export async function getCriticalityLevels(): Promise<{
  levels: Array<{ value: string; name: string; description?: string }>
}> {
  const response = await fetch(`${API_BASE}/criticality-levels`)
  if (!response.ok) throw new Error('Failed to fetch criticality levels')
  return response.json()
}

/**
 * Register new infrastructure
 */
export async function registerInfrastructure(
  data: RegisterInfrastructureRequest
): Promise<Infrastructure> {
  const response = await fetch(`${API_BASE}/infrastructure`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || 'Failed to register infrastructure')
  }
  return response.json()
}

/**
 * List infrastructure with optional filters
 */
export async function listInfrastructure(filters?: {
  infrastructure_type?: string
  criticality_level?: string
  country_code?: string
  region?: string
  limit?: number
  offset?: number
}): Promise<{
  count: number
  limit: number
  offset: number
  infrastructure: Infrastructure[]
}> {
  const params = new URLSearchParams()
  if (filters?.infrastructure_type) params.set('infrastructure_type', filters.infrastructure_type)
  if (filters?.criticality_level) params.set('criticality_level', filters.criticality_level)
  if (filters?.country_code) params.set('country_code', filters.country_code)
  if (filters?.region) params.set('region', filters.region)
  if (filters?.limit) params.set('limit', filters.limit.toString())
  if (filters?.offset) params.set('offset', filters.offset.toString())
  
  const url = params.toString()
    ? `${API_BASE}/infrastructure?${params}`
    : `${API_BASE}/infrastructure`
  const response = await fetch(url)
  if (!response.ok) throw new Error('Failed to list infrastructure')
  const data = await response.json()
  const list = Array.isArray(data) ? data : (data.infrastructure || [])
  return {
    infrastructure: list,
    count: list.length,
    limit: filters?.limit ?? 100,
    offset: filters?.offset ?? 0,
  }
}

/**
 * Get single infrastructure by ID
 */
export async function getInfrastructure(id: string): Promise<Infrastructure> {
  const response = await fetch(`${API_BASE}/infrastructure/${id}`)
  if (!response.ok) throw new Error('Infrastructure not found')
  return response.json()
}

/**
 * Get dependencies for infrastructure
 */
export async function getInfrastructureDependencies(
  id: string,
  direction: 'upstream' | 'downstream' | 'both' = 'both'
): Promise<{
  infrastructure_id: string
  cip_id: string
  upstream: Dependency[]
  downstream: Dependency[]
}> {
  const response = await fetch(
    `${API_BASE}/infrastructure/${id}/dependencies?direction=${direction}`
  )
  if (!response.ok) throw new Error('Failed to get dependencies')
  return response.json()
}

/**
 * Run cascade simulation (FR-CIP-006)
 */
export async function runCascadeSimulation(data: {
  initial_failure_ids: string[]
  time_horizon_hours?: number
  name?: string
}): Promise<{
  id: string
  name: string
  timeline: Array<{ step: number; hour: number; affected_ids: string[]; impact_score: number }>
  affected_assets: Array<{ infrastructure_id: string; depth: number }>
  impact_score: number
  recovery_time_hours: number
  total_affected: number
  population_affected: number
}> {
  const response = await fetch(`${API_BASE}/simulations/cascade`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.detail || 'Failed to run cascade simulation')
  }
  return response.json()
}

/**
 * List cascade simulations
 */
export async function listCascadeSimulations(limit = 20): Promise<
  Array<{ id: string; name: string; total_affected: number; impact_score: number; created_at: string }>
> {
  const response = await fetch(`${API_BASE}/simulations?limit=${limit}`)
  if (!response.ok) throw new Error('Failed to list simulations')
  return response.json()
}

/**
 * Get cascade simulation by ID
 */
export async function getCascadeSimulation(id: string): Promise<{
  id: string
  name: string
  timeline: Array<{ step: number; hour: number; affected_ids: string[]; impact_score: number }>
  affected_assets: Array<{ infrastructure_id: string; depth: number }>
  impact_score: number
  recovery_time_hours: number
}> {
  const response = await fetch(`${API_BASE}/simulations/${id}`)
  if (!response.ok) throw new Error('Simulation not found')
  return response.json()
}

/**
 * Get full dependency graph (nodes + edges) for map/graph visualization
 */
export async function getDependenciesGraph(limit: number = 500): Promise<{
  nodes: Array<{
    id: string
    cip_id: string
    name: string
    infrastructure_type: string
    criticality_level: string
    operational_status: string
    latitude?: number
    longitude?: number
    country_code?: string
    region?: string
    city?: string
    cascade_risk_score?: number | null
    vulnerability_score?: number | null
  }>
  edges: Array<{
    id: string
    source_id: string
    target_id: string
    strength: number
    dependency_type: string
  }>
}> {
  const response = await fetch(`${API_BASE}/dependencies/graph?limit=${limit}`)
  if (!response.ok) throw new Error('Failed to get dependency graph')
  return response.json()
}

/**
 * Add dependency between infrastructure
 */
export async function addDependency(data: {
  source_id: string
  target_id: string
  dependency_type?: string
  strength?: number
  propagation_delay_minutes?: number
  description?: string
}): Promise<Dependency> {
  const response = await fetch(`${API_BASE}/dependencies`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.detail || 'Failed to add dependency')
  }
  return response.json()
}

/**
 * Calculate cascade risk for infrastructure
 */
export async function calculateCascadeRisk(
  id: string,
  depth: number = 3
): Promise<CascadeRiskResult> {
  const response = await fetch(
    `${API_BASE}/infrastructure/${id}/cascade-risk?depth=${depth}`
  )
  if (!response.ok) throw new Error('Failed to calculate cascade risk')
  return response.json()
}

/**
 * Get vulnerability assessment for infrastructure
 */
export async function getVulnerabilityAssessment(id: string): Promise<VulnerabilityAssessment> {
  const response = await fetch(`${API_BASE}/infrastructure/${id}/vulnerability`)
  if (!response.ok) throw new Error('Failed to get vulnerability assessment')
  return response.json()
}

/**
 * Run cascade failure scenario (legacy: single source, /scenarios/cascade)
 */
export async function runCascadeScenarioSimulation(params: {
  source_infrastructure_id: string
  failure_severity?: number
  max_depth?: number
}): Promise<{
  simulation_type: string
  source_infrastructure: string
  initial_severity: number
  max_depth: number
  total_affected: number
  effects: Array<{
    infrastructure_id: string
    depth: number
    dependency_strength: number
    propagation_delay?: number
    propagated_severity: number
    status: string
  }>
  summary: {
    critical_failures: number
    degraded_services: number
    minor_impact: number
  }
}> {
  const urlParams = new URLSearchParams({
    source_infrastructure_id: params.source_infrastructure_id,
  })
  if (params.failure_severity !== undefined) {
    urlParams.set('failure_severity', params.failure_severity.toString())
  }
  if (params.max_depth !== undefined) {
    urlParams.set('max_depth', params.max_depth.toString())
  }
  
  const response = await fetch(`${API_BASE}/scenarios/cascade?${urlParams}`, {
    method: 'POST',
  })
  if (!response.ok) throw new Error('Failed to run cascade simulation')
  return response.json()
}
