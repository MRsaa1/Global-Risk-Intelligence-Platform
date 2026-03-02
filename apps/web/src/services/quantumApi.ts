const API_BASE = '/api/v1/quantum'

async function request(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`)
  return res.json()
}

export interface InterferenceZone {
  asset_id: string
  time_step: number
  converging_chains: string[]
  amplification_ratio: number
  combined_loss: number
  resonance_type: string
}

export interface PathIntegralResult {
  simulation_id: string
  trajectories_count: number
  risk_chains_used: string[]
  computation_time_ms: number
  interference_zones: InterferenceZone[]
}

export interface TunnelingScenario {
  scenario_id: string
  trigger_combination: { event: string; severity: number }[]
  bypassed_states: string[]
  probability: number
  impact: number
  barrier_energy: number
  explanation: string
}

export interface ConvergencePoint {
  asset_id: string
  time_step: number
  convergence_ratio: number
  mean_severity: number
  num_converged: number
}

export interface SwarmResult {
  swarm_id: string
  num_particles: number
  computation_time_ms: number
  convergence_points: ConvergencePoint[]
  top_principal_components: any[]
  black_swans: any[]
  explained_variance: number
}

export interface UncertaintyResult {
  central_estimate: number
  lower_bound: number
  upper_bound: number
  confidence_level: number
  degradation_factor: number
  projection_years: number
  score_type: string
}

export interface EntanglementMatrix {
  domains: string[]
  matrix: number[][]
}

export async function runPathIntegral(
  timeHorizon = 120,
  trajectoriesPerChain = 200,
): Promise<PathIntegralResult> {
  return request(`${API_BASE}/path-integral`, {
    method: 'POST',
    body: JSON.stringify({
      time_horizon: timeHorizon,
      num_trajectories_per_chain: trajectoriesPerChain,
    }),
  })
}

export async function scanTunneling(
  assetIds: string[] = [],
  topN = 10,
): Promise<{ scenarios: TunnelingScenario[]; total_found: number }> {
  return request(`${API_BASE}/tunneling/scan`, {
    method: 'POST',
    body: JSON.stringify({ portfolio_asset_ids: assetIds, top_n: topN }),
  })
}

export async function getAssetBarrier(assetId: string) {
  return request(`${API_BASE}/tunneling/${assetId}`)
}

export async function propagateEntanglement(domain: string, delta: number) {
  return request(`${API_BASE}/entanglement/propagate`, {
    method: 'POST',
    body: JSON.stringify({ changed_domain: domain, delta }),
  })
}

export async function getEntanglementMatrix(): Promise<EntanglementMatrix> {
  return request(`${API_BASE}/entanglement/matrix`)
}

export async function deploySwarm(
  numParticles = 50,
  timeHorizon = 120,
): Promise<SwarmResult> {
  return request(`${API_BASE}/swarm/deploy`, {
    method: 'POST',
    body: JSON.stringify({
      num_particles: numParticles,
      time_horizon: timeHorizon,
    }),
  })
}

export async function degradeRiskScore(
  currentScore: number,
  projectionYears = 30,
  scoreType = 'climate',
  dataQuality = 0.8,
): Promise<UncertaintyResult> {
  return request(`${API_BASE}/uncertainty/degrade`, {
    method: 'POST',
    body: JSON.stringify({
      current_score: currentScore,
      projection_years: projectionYears,
      score_type: scoreType,
      data_quality: dataQuality,
    }),
  })
}
