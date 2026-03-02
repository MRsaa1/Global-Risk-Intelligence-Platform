/**
 * CIP Module - Critical Infrastructure Protection
 *
 * Dashboard, list/map/graph views, dependencies, cascade risk,
 * vulnerability assessment. CIP_SENTINEL alerts in platform stream.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon,
  PlusIcon,
  XMarkIcon,
  ArrowPathIcon,
  MapIcon,
  TableCellsIcon,
  BellAlertIcon,
} from '@heroicons/react/24/outline'
import { getModuleById } from '../../lib/modules'
import AccessGate from '../../components/modules/AccessGate'
import SendToARINButton from '../../components/SendToARINButton'
import ARINVerdictBadge from '../../components/ARINVerdictBadge'
import {
  listInfrastructure,
  registerInfrastructure,
  getInfrastructureDependencies,
  calculateCascadeRisk,
  getVulnerabilityAssessment,
  getInfrastructureTypes,
  getCriticalityLevels,
  getCIPStatus,
  getDependenciesGraph,
  runCascadeSimulation,
} from '../../services/cipApi'
import type {
  Infrastructure,
  CascadeRiskResult,
  VulnerabilityAssessment,
  Dependency,
  RegisterInfrastructureRequest,
} from '../../services/cipApi'
import CIPMapCesium from '../../components/CIPMapCesium'

export default function CIPModule() {
  const navigate = useNavigate()
  const module = getModuleById('cip')
  const [infrastructure, setInfrastructure] = useState<Infrastructure[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [registerModalOpen, setRegisterModalOpen] = useState(false)
  const [selectedInfra, setSelectedInfra] = useState<Infrastructure | null>(null)
  const [dependenciesData, setDependenciesData] = useState<{
    upstream: Dependency[]
    downstream: Dependency[]
  } | null>(null)
  const [cascadeResult, setCascadeResult] = useState<CascadeRiskResult | null>(null)
  const [vulnerabilityResult, setVulnerabilityResult] = useState<VulnerabilityAssessment | null>(null)
  const [typeOptions, setTypeOptions] = useState<Array<{ value: string; name: string }>>([])
  const [criticalityOptions, setCriticalityOptions] = useState<
    Array<{ value: string; name: string; description?: string }>
  >([])
  const [stats, setStats] = useState<{ total_infrastructure: number; total_dependencies: number } | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'table' | 'map'>('table')
  const [dependencyEdges, setDependencyEdges] = useState<Array<{ source_id: string; target_id: string }>>([])
  const [cipMapHeightMeters, setCipMapHeightMeters] = useState(75)
  const [cascadeSimResult, setCascadeSimResult] = useState<{
    timeline: Array<{ step: number; hour: number; affected_ids: string[]; impact_score: number }>
    total_affected: number
    impact_score: number
  } | null>(null)
  const [runningCascadeSim, setRunningCascadeSim] = useState(false)

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listInfrastructure({ limit: 200 })
      setInfrastructure(res.infrastructure)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load infrastructure')
      setInfrastructure([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadOptionsAndStats = useCallback(async () => {
    try {
      const [typesRes, levelsRes, statusRes] = await Promise.all([
        getInfrastructureTypes(),
        getCriticalityLevels(),
        getCIPStatus(),
      ])
      setTypeOptions(typesRes.types || [])
      setCriticalityOptions(levelsRes.levels || [])
      setStats(statusRes.statistics || null)
    } catch {
      // non-blocking
    }
  }, [])

  useEffect(() => {
    loadList()
    loadOptionsAndStats()
  }, [loadList, loadOptionsAndStats])

  const loadDependencyEdges = useCallback(async () => {
    try {
      const res = await getDependenciesGraph(500)
      setDependencyEdges(res.edges.map((e) => ({ source_id: e.source_id, target_id: e.target_id })))
    } catch {
      setDependencyEdges([])
    }
  }, [])

  useEffect(() => {
    if (viewMode === 'map') loadDependencyEdges()
  }, [viewMode, loadDependencyEdges])

  const mapAssets = useMemo(
    () =>
      infrastructure
        .filter((i) => i.latitude != null && i.longitude != null)
        .map((i) => ({
          id: i.id,
          name: i.name,
          latitude: i.latitude!,
          longitude: i.longitude!,
          climate_risk_score: i.cascade_risk_score ?? i.vulnerability_score ?? 0,
          valuation: (i.population_served ?? 0) * 1000,
        })),
    [infrastructure]
  )

  const handleRegisterSubmit = async (data: RegisterInfrastructureRequest) => {
    setSubmitting(true)
    setFormError(null)
    try {
      await registerInfrastructure(data)
      setRegisterModalOpen(false)
      await loadList()
      loadOptionsAndStats()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to register')
    } finally {
      setSubmitting(false)
    }
  }


  const handleViewDependencies = async (infra: Infrastructure) => {
    setSelectedInfra(infra)
    setCascadeResult(null)
    setVulnerabilityResult(null)
    try {
      const res = await getInfrastructureDependencies(infra.id, 'both')
      setDependenciesData({ upstream: res.upstream || [], downstream: res.downstream || [] })
    } catch {
      setDependenciesData({ upstream: [], downstream: [] })
    }
  }

  const handleRunCascade = async (infra: Infrastructure) => {
    setCascadeResult(null)
    setCascadeSimResult(null)
    setVulnerabilityResult(null)
    setSelectedInfra(infra)
    try {
      const res = await calculateCascadeRisk(infra.id, 5)
      setCascadeResult(res)
    } catch {
      setCascadeResult(null)
    }
  }

  const handleRunFullCascadeSim = async () => {
    const ids = selectedInfra ? [selectedInfra.id] : infrastructure.slice(0, 3).map((i) => i.id)
    if (!ids.length) return
    setRunningCascadeSim(true)
    setCascadeSimResult(null)
    try {
      const res = await runCascadeSimulation({
        initial_failure_ids: ids,
        time_horizon_hours: 72,
        name: `Cascade ${new Date().toISOString().slice(0, 16)}`,
      })
      setCascadeSimResult({
        timeline: res.timeline || [],
        total_affected: res.total_affected || 0,
        impact_score: res.impact_score || 0,
      })
    } catch {
      setCascadeSimResult(null)
    } finally {
      setRunningCascadeSim(false)
    }
  }

  const handleAnalyzeVulnerability = async (infra: Infrastructure) => {
    setVulnerabilityResult(null)
    setCascadeResult(null)
    setSelectedInfra(infra)
    try {
      const res = await getVulnerabilityAssessment(infra.id)
      setVulnerabilityResult(res)
    } catch {
      setVulnerabilityResult(null)
    }
  }

  const closePanels = () => {
    setSelectedInfra(null)
    setDependenciesData(null)
    setCascadeResult(null)
    setVulnerabilityResult(null)
    setCascadeSimResult(null)
  }

  if (!module) {
    return <div className="p-8 text-zinc-200">Module not found</div>
  }

  return (
    <AccessGate accessLevel={module.accessLevel}>
      <div className="min-h-full p-6 bg-zinc-950">
        <div className="w-full max-w-[1920px] mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <button
              onClick={() => navigate('/modules')}
              className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 mb-4 transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              <span className="text-sm">Back to Modules</span>
            </button>
            <div className="flex items-center justify-between gap-4 mb-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                  <module.icon className="w-8 h-8 text-zinc-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-lg font-semibold text-zinc-100">{module.fullName}</h1>
                    <span className="text-zinc-500 text-xs">Phase {module.phase}</span>
                    <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 text-[10px] rounded border border-zinc-700">{module.priority}</span>
                    <span className="px-2 py-1 bg-zinc-700 text-zinc-200 text-xs rounded border border-zinc-600">Active</span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">{module.description}</p>
                </div>
              </div>
              {stats && (
                <div className="flex gap-4 text-sm text-zinc-400">
                  <span>{stats.total_infrastructure} infrastructure</span>
                  <span>{stats.total_dependencies} dependencies</span>
                </div>
              )}
            </div>
          </motion.div>

          {/* CIP Dashboard strip: KPIs + link to alerts */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="mb-6 p-4 rounded-md bg-zinc-800 border border-zinc-700 flex flex-wrap items-center justify-between gap-4"
          >
            <div className="flex flex-wrap gap-6">
              <div>
                <p className="text-zinc-500 text-xs">Infrastructure</p>
                <p className="text-zinc-100 font-semibold">{stats?.total_infrastructure ?? 0}</p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs">Dependencies</p>
                <p className="text-zinc-100 font-semibold">{stats?.total_dependencies ?? 0}</p>
              </div>
              <div>
                <p className="text-zinc-500 text-xs">Critical (tier_1)</p>
                <p className="text-zinc-100 font-semibold">
                  {infrastructure.filter((i) => i.criticality_level === 'tier_1').length}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/command')}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm border border-zinc-600 transition-colors"
            >
              <BellAlertIcon className="w-4 h-4" />
              Alerts & Command Center
            </button>
          </motion.div>

          {/* Actions + View toggle (Table / Map / Graph) */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6 flex flex-wrap items-center gap-3"
          >
            <button
              onClick={() => setRegisterModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-md border border-zinc-700 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Register Infrastructure
            </button>
            <button
              onClick={loadList}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md border border-zinc-700 transition-colors disabled:opacity-50"
            >
              <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <span className="text-zinc-500 text-sm mx-2">|</span>
            <div className="flex rounded-md border border-zinc-700 overflow-hidden">
              <button
                onClick={() => setViewMode('table')}
                className={`inline-flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  viewMode === 'table' ? 'bg-zinc-600 text-zinc-100' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                <TableCellsIcon className="w-4 h-4" />
                Table
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`inline-flex items-center gap-2 px-3 py-2 text-sm transition-colors ${
                  viewMode === 'map' ? 'bg-zinc-600 text-zinc-100' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                }`}
              >
                <MapIcon className="w-4 h-4" />
                Map
              </button>
            </div>
          </motion.div>

          {error && (
            <div className="mb-4 p-4 rounded-md bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              {error}
            </div>
          )}

          {viewMode === 'map' && (
            <div className="rounded-md border border-zinc-700 overflow-hidden bg-zinc-800 mb-6 w-full">
              <div className="flex items-center justify-between gap-2 p-2 border-b border-zinc-700 flex-wrap">
                <span className="text-zinc-500 text-xs">Click an object to fly to the selected camera height</span>
                <div className="flex items-center gap-2">
                  <span className="text-zinc-500 text-xs">Camera height:</span>
                  {[50, 75, 100].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => setCipMapHeightMeters(h)}
                      className={`px-2 py-1 rounded text-xs ${cipMapHeightMeters === h ? 'bg-zinc-700 text-zinc-300' : 'text-zinc-400 hover:bg-zinc-700'}`}
                    >
                      {h} m
                    </button>
                  ))}
                </div>
              </div>
              <div
                className="w-full"
                style={{
                  height: typeof window !== 'undefined' ? Math.min(640, Math.max(420, Math.floor(window.innerHeight * 0.55))) : 520,
                }}
              >
                {mapAssets.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-zinc-500 text-sm">
                    {loading ? 'Loading…' : 'No infrastructure with coordinates. Add lat/lon when registering or switch to Table view.'}
                  </div>
                ) : (
                  <CIPMapCesium
                    points={mapAssets.map((a) => ({
                      id: a.id,
                      name: a.name,
                      latitude: a.latitude,
                      longitude: a.longitude,
                      climate_risk_score: a.climate_risk_score,
                    }))}
                    links={dependencyEdges}
                    onPointClick={(id) => {
                      const infra = infrastructure.find((i) => i.id === id)
                      if (infra) handleViewDependencies(infra)
                    }}
                    focusHeightMeters={cipMapHeightMeters}
                  />
                )}
              </div>
            </div>
          )}

          {viewMode === 'table' && (
            <>
              {loading ? (
                <div className="p-8 text-center text-zinc-400">Loading infrastructure…</div>
              ) : infrastructure.length === 0 ? (
                <div className="p-8 rounded-md bg-zinc-800 border border-zinc-700 text-center text-zinc-400">
                  No infrastructure registered yet. Click “Register Infrastructure” to add assets.
                </div>
              ) : (
                <div className="rounded-md border border-zinc-700 overflow-hidden bg-zinc-800">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-zinc-700">
                        <th className="p-3 text-zinc-300 font-medium">Name</th>
                        <th className="p-3 text-zinc-300 font-medium">CIP ID</th>
                        <th className="p-3 text-zinc-300 font-medium">Type</th>
                        <th className="p-3 text-zinc-300 font-medium">Criticality</th>
                        <th className="p-3 text-zinc-300 font-medium">Status</th>
                        <th className="p-3 text-zinc-300 font-medium">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {infrastructure.map((infra) => (
                        <tr key={infra.id} className="border-b border-zinc-800 hover:bg-zinc-800">
                          <td className="p-3 text-zinc-100">{infra.name}</td>
                          <td className="p-3 text-zinc-400 font-mono text-xs">{infra.cip_id}</td>
                          <td className="p-3 text-zinc-300">{infra.infrastructure_type?.replace(/_/g, ' ') || '—'}</td>
                          <td className="p-3 text-zinc-300">{infra.criticality_level || '—'}</td>
                          <td className="p-3 text-zinc-300">{infra.operational_status || '—'}</td>
                          <td className="p-3">
                            <div className="flex flex-wrap gap-2">
                              <button
                                onClick={() => handleViewDependencies(infra)}
                                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs border border-zinc-700"
                              >
                                Dependencies
                              </button>
                              <button
                                onClick={() => handleRunCascade(infra)}
                                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs border border-zinc-700"
                              >
                                Cascade
                              </button>
                              <button
                                onClick={() => handleAnalyzeVulnerability(infra)}
                                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs border border-zinc-700"
                              >
                                Vulnerability
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* Detail panels: Dependencies / Cascade / Vulnerability / Cascade Sim Timeline */}
          {(dependenciesData !== null || cascadeResult !== null || vulnerabilityResult !== null || cascadeSimResult !== null) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-8 p-6 rounded-md bg-zinc-800 border border-zinc-700"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-zinc-100 font-display font-semibold">
                  {cascadeSimResult !== null ? 'Cascade Simulation — Timeline' :
                   cascadeResult !== null ? 'Cascade Risk' :
                   vulnerabilityResult !== null ? 'Vulnerability Assessment' :
                   dependenciesData !== null ? 'Dependencies' : ''}
                </h2>
                <button
                  onClick={closePanels}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-100"
                  aria-label="Close"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {dependenciesData !== null && selectedInfra && !cascadeSimResult && (
                <div className="space-y-4">
                  <p className="text-zinc-100 text-sm font-medium">
                    Selected object: <span className="text-zinc-100">{selectedInfra.name}</span>{' '}
                    <span className="font-mono text-zinc-300 text-xs">({selectedInfra.cip_id})</span>
                  </p>
                  <p className="text-zinc-400 text-xs max-w-xl">
                    Dependencies show how this asset is connected to others. Lines on the map (and below) indicate who supplies or uses whom. If one asset fails, dependent ones can be affected.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-md bg-zinc-800 border border-zinc-700 p-3">
                      <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Upstream ({dependenciesData.upstream.length})</h3>
                      <p className="text-zinc-500 text-xs mb-2">
                        Assets this object depends on. If an upstream asset fails, this one can be affected.
                      </p>
                      <ul className="space-y-2 text-sm">
                        {dependenciesData.upstream.length === 0
                          ? <li className="text-zinc-500">None</li>
                          : dependenciesData.upstream.map((d) => {
                              const srcName = infrastructure.find((i) => i.id === d.source_id)?.name ?? d.source_id
                              const tgtName = infrastructure.find((i) => i.id === d.target_id)?.name ?? d.target_id
                              const strengthLabel = d.strength >= 0.9 ? 'Critical' : d.strength >= 0.6 ? 'High' : d.strength >= 0.3 ? 'Medium' : 'Low'
                              return (
                                <li key={d.id} className="text-zinc-200 border-l-2 border-zinc-500 pl-2 py-1">
                                  <span className="text-zinc-300">{srcName}</span>
                                  <span className="text-zinc-500 text-xs"> → </span>
                                  <span className="text-zinc-100">{tgtName}</span>
                                  <span className="text-zinc-500 text-xs"> (this object)</span>
                                  <div className="text-zinc-500 text-xs mt-0.5">
                                    Type: {d.dependency_type} • Strength: {strengthLabel} ({(d.strength * 100).toFixed(0)}%)
                                    {d.propagation_delay_minutes != null && ` • Delay: ${d.propagation_delay_minutes} min`}
                                  </div>
                                  {d.description && <p className="text-zinc-400 text-xs mt-1 italic">{d.description}</p>}
                                </li>
                              )
                            })}
                      </ul>
                    </div>
                    <div className="rounded-md bg-zinc-800 border border-zinc-700 p-3">
                      <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Downstream ({dependenciesData.downstream.length})</h3>
                      <p className="text-zinc-500 text-xs mb-2">
                        Assets that depend on this object. If this asset fails, downstream ones can be affected.
                      </p>
                      <ul className="space-y-2 text-sm">
                        {dependenciesData.downstream.length === 0
                          ? <li className="text-zinc-500">None</li>
                          : dependenciesData.downstream.map((d) => {
                              const srcName = infrastructure.find((i) => i.id === d.source_id)?.name ?? d.source_id
                              const tgtName = infrastructure.find((i) => i.id === d.target_id)?.name ?? d.target_id
                              const strengthLabel = d.strength >= 0.9 ? 'Critical' : d.strength >= 0.6 ? 'High' : d.strength >= 0.3 ? 'Medium' : 'Low'
                              return (
                                <li key={d.id} className="text-zinc-200 border-l-2 border-zinc-500 pl-2 py-1">
                                  <span className="text-zinc-100">{srcName}</span>
                                  <span className="text-zinc-500 text-xs"> (this object) </span>
                                  <span className="text-zinc-500 text-xs">→</span>
                                  <span className="text-zinc-300"> {tgtName}</span>
                                  <div className="text-zinc-500 text-xs mt-0.5">
                                    Type: {d.dependency_type} • Strength: {strengthLabel} ({(d.strength * 100).toFixed(0)}%)
                                    {d.propagation_delay_minutes != null && ` • Delay: ${d.propagation_delay_minutes} min`}
                                  </div>
                                  {d.description && <p className="text-zinc-400 text-xs mt-1 italic">{d.description}</p>}
                                </li>
                              )
                            })}
                      </ul>
                    </div>
                  </div>
                  <p className="text-zinc-500 text-xs">
                    Dependency type: operational (day-to-day supply), informational (data/control), physical (shared site/corridor), logical (contracts/backup). Strength 0–100%: how critical the link is.
                  </p>
                  {selectedInfra && !cascadeSimResult && (
                    <button
                      type="button"
                      onClick={handleRunFullCascadeSim}
                      disabled={runningCascadeSim}
                      className="mt-4 px-4 py-2 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm border border-zinc-600 disabled:opacity-50 flex items-center gap-2"
                    >
                      {runningCascadeSim ? (
                        <>
                          <ArrowPathIcon className="w-4 h-4 animate-spin" />
                          Running…
                        </>
                      ) : (
                        <>Run cascade simulation from {selectedInfra.name}</>
                      )}
                    </button>
                  )}
                </div>
              )}

              {cascadeResult !== null && !cascadeSimResult && (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-zinc-200">
                      <span className="font-medium">{cascadeResult.name}</span> ({cascadeResult.cip_id})
                    </p>
                    <SendToARINButton
                      sourceModule="cip"
                      objectType="infrastructure"
                      objectId={cascadeResult.cip_id}
                      inputData={{
                        cascade_depth: cascadeResult.cascade_depth_analyzed,
                        affected_count: cascadeResult.affected_count,
                        cascade_risk_score: cascadeResult.cascade_risk_score,
                        total_population_at_risk: cascadeResult.total_population_at_risk,
                      }}
                      exportEntityId={cascadeResult.cip_id}
                      exportEntityType="portfolio"
                      exportAnalysisType="compliance_check"
                      exportData={{
                        risk_score: Math.min(100, ((cascadeResult.cascade_risk_score ?? 0.5) as number) * 100),
                        risk_level: (cascadeResult.cascade_risk_score ?? 0) >= 0.7 ? 'HIGH' : (cascadeResult.cascade_risk_score ?? 0) >= 0.5 ? 'MEDIUM' : 'LOW',
                        summary: `CIP cascade: ${cascadeResult.name}, depth ${cascadeResult.cascade_depth_analyzed}, ${cascadeResult.affected_count} affected.`,
                        recommendations: ['Review dependencies', 'Strengthen critical nodes'],
                        indicators: {
                          cascade_depth: cascadeResult.cascade_depth_analyzed,
                          affected_count: cascadeResult.affected_count,
                          cascade_risk_score: cascadeResult.cascade_risk_score,
                          population_at_risk: cascadeResult.total_population_at_risk,
                        },
                      }}
                      size="sm"
                    />
                    <ARINVerdictBadge entityId={cascadeResult.cip_id || 'portfolio_global'} compact />
                  </div>
                  <p className="text-zinc-300">
                    Cascade depth analyzed: {cascadeResult.cascade_depth_analyzed} • Affected count:{' '}
                    {cascadeResult.affected_count} • Population at risk: {cascadeResult.total_population_at_risk}
                  </p>
                  <p className="text-zinc-200">Cascade risk score: {cascadeResult.cascade_risk_score?.toFixed(1) ?? '—'}</p>
                  {cascadeResult.affected_infrastructure?.length > 0 && (
                    <ul className="mt-2 space-y-1 text-zinc-400 text-xs">
                      {cascadeResult.affected_infrastructure.slice(0, 10).map((a, i) => (
                        <li key={i}>
                          depth {a.depth}: {a.infrastructure_id} (strength: {a.dependency_strength})
                        </li>
                      ))}
                      {cascadeResult.affected_infrastructure.length > 10 && (
                        <li>… and {cascadeResult.affected_infrastructure.length - 10} more</li>
                      )}
                    </ul>
                  )}
                  <button
                    type="button"
                    onClick={handleRunFullCascadeSim}
                    disabled={runningCascadeSim}
                    className="mt-4 px-4 py-2 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-sm border border-zinc-600 disabled:opacity-50 flex items-center gap-2"
                  >
                    {runningCascadeSim ? (
                      <>
                        <ArrowPathIcon className="w-4 h-4 animate-spin" />
                        Running simulation…
                      </>
                    ) : (
                      <>Run full cascade simulation (72h)</>
                    )}
                  </button>
                </div>
              )}

              {cascadeSimResult !== null && (
                <div className="space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex flex-wrap gap-4 text-sm">
                    <div className="px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700">
                      <span className="text-zinc-500 text-xs">Total affected</span>
                      <p className="text-zinc-100 font-semibold">{cascadeSimResult.total_affected}</p>
                    </div>
                    <div className="px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700">
                      <span className="text-zinc-500 text-xs">Impact score</span>
                      <p className="text-zinc-100 font-semibold">{cascadeSimResult.impact_score?.toFixed(1) ?? '—'}</p>
                    </div>
                    </div>
                    <SendToARINButton
                      sourceModule="cip"
                      objectType="infrastructure"
                      objectId={selectedInfra?.id ?? 'cascade-sim'}
                      inputData={{
                        total_affected: cascadeSimResult.total_affected,
                        impact_score: cascadeSimResult.impact_score,
                        timeline_steps: cascadeSimResult.timeline?.length ?? 0,
                      }}
                      exportEntityId={selectedInfra?.id ?? 'cascade-sim'}
                      exportEntityType="portfolio"
                      exportAnalysisType="stress_test"
                      exportData={{
                        risk_score: Math.min(100, (cascadeSimResult.impact_score ?? 0.5) * 100),
                        risk_level: (cascadeSimResult.impact_score ?? 0) >= 0.7 ? 'HIGH' : (cascadeSimResult.impact_score ?? 0) >= 0.5 ? 'MEDIUM' : 'LOW',
                        summary: `CIP cascade sim: ${cascadeSimResult.total_affected} affected, impact ${cascadeSimResult.impact_score?.toFixed(1)}.`,
                        recommendations: ['Contain propagation', 'Isolate critical nodes'],
                        indicators: {
                          total_affected: cascadeSimResult.total_affected,
                          impact_score: cascadeSimResult.impact_score,
                          timeline_steps: cascadeSimResult.timeline?.length ?? 0,
                        },
                      }}
                      size="sm"
                    />
                  </div>
                  {cascadeSimResult.timeline?.length > 0 ? (
                    <div>
                      <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Timeline (propagation by hour)</h3>
                      <div className="space-y-2">
                        {cascadeSimResult.timeline.map((step, idx) => {
                          const maxImpact = Math.max(...cascadeSimResult!.timeline.map((s) => s.impact_score || 0), 1)
                          const w = ((step.impact_score ?? 0) / maxImpact) * 100
                          const infraNames = (step.affected_ids || [])
                            .map((id) => infrastructure.find((i) => i.id === id)?.name ?? id)
                            .slice(0, 5)
                          return (
                            <div key={idx} className="flex items-center gap-3 text-sm">
                              <span className="text-zinc-500 w-12">h {step.hour ?? step.step}</span>
                              <div className="flex-1 h-6 rounded bg-zinc-800 overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${w}%` }}
                                  transition={{ duration: 0.5, delay: idx * 0.08 }}
                                  className="h-full bg-zinc-500 rounded"
                                />
                              </div>
                              <span className="text-zinc-300 w-20">{(step.impact_score ?? 0).toFixed(1)}</span>
                              {infraNames.length > 0 && (
                                <span className="text-zinc-500 text-xs truncate max-w-[200px]" title={infraNames.join(', ')}>
                                  {infraNames.join(', ')}
                                </span>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-zinc-500 text-sm">No timeline steps recorded.</p>
                  )}
                  <button
                    type="button"
                    onClick={() => setCascadeSimResult(null)}
                    className="text-zinc-500 hover:text-zinc-100 text-xs"
                  >
                    Close timeline
                  </button>
                </div>
              )}

              {vulnerabilityResult !== null && (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <p className="text-zinc-200">
                      <span className="font-medium">{vulnerabilityResult.name}</span> ({vulnerabilityResult.cip_id})
                    </p>
                    <SendToARINButton
                      sourceModule="cip"
                      objectType="infrastructure"
                      objectId={vulnerabilityResult.cip_id}
                      inputData={{
                        criticality: vulnerabilityResult.criticality_level,
                        operational_status: vulnerabilityResult.operational_status,
                        scores: vulnerabilityResult.scores,
                        dependencies: vulnerabilityResult.dependencies,
                      }}
                      exportEntityId={vulnerabilityResult.cip_id}
                      exportEntityType="portfolio"
                      exportAnalysisType="compliance_check"
                      exportData={{
                        risk_score: vulnerabilityResult.scores?.vulnerability ?? 50,
                        risk_level: (vulnerabilityResult.scores?.vulnerability ?? 0) >= 70 ? 'HIGH' : (vulnerabilityResult.scores?.vulnerability ?? 0) >= 50 ? 'MEDIUM' : 'LOW',
                        summary: `CIP vulnerability: ${vulnerabilityResult.name}, ${vulnerabilityResult.criticality_level}, ${vulnerabilityResult.operational_status}.`,
                        recommendations: ['Address vulnerabilities', 'Update dependencies'],
                        indicators: {
                          criticality: vulnerabilityResult.criticality_level,
                          operational_status: vulnerabilityResult.operational_status,
                          scores: vulnerabilityResult.scores,
                        },
                      }}
                      size="sm"
                    />
                  </div>
                  <p className="text-zinc-300">
                    Criticality: {vulnerabilityResult.criticality_level} • Status: {vulnerabilityResult.operational_status}
                  </p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                    <div className="p-2 rounded bg-zinc-800">
                      <span className="text-zinc-500 text-xs">Vulnerability</span>
                      <p className="text-zinc-100">{vulnerabilityResult.scores.vulnerability?.toFixed(0) ?? '—'}</p>
                    </div>
                    <div className="p-2 rounded bg-zinc-800">
                      <span className="text-zinc-500 text-xs">Exposure</span>
                      <p className="text-zinc-100">{vulnerabilityResult.scores.exposure?.toFixed(0) ?? '—'}</p>
                    </div>
                    <div className="p-2 rounded bg-zinc-800">
                      <span className="text-zinc-500 text-xs">Resilience</span>
                      <p className="text-zinc-100">{vulnerabilityResult.scores.resilience?.toFixed(0) ?? '—'}</p>
                    </div>
                    <div className="p-2 rounded bg-zinc-800">
                      <span className="text-zinc-500 text-xs">Cascade risk</span>
                      <p className="text-zinc-100">{vulnerabilityResult.scores.cascade_risk?.toFixed(0) ?? '—'}</p>
                    </div>
                  </div>
                  <p className="text-zinc-400 text-xs mt-2">
                    Dependencies: upstream {vulnerabilityResult.dependencies.upstream_count}, downstream{' '}
                    {vulnerabilityResult.dependencies.downstream_count}
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {/* Register modal */}
          {registerModalOpen && (
            <RegisterModal
              typeOptions={typeOptions}
              criticalityOptions={criticalityOptions}
              onClose={() => {
                setRegisterModalOpen(false)
                setFormError(null)
              }}
              onSubmit={handleRegisterSubmit}
              submitting={submitting}
              formError={formError}
            />
          )}

          {/* API docs footer */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8 p-6 bg-zinc-800 rounded-md border border-zinc-700"
          >
            <h3 className="text-zinc-100 font-display font-semibold mb-4">API Endpoints</h3>
            <div className="space-y-3 font-mono text-sm text-zinc-300">
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded text-xs">POST</span>
                <span>{module.apiPrefix}/infrastructure</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded text-xs">GET</span>
                <span>{module.apiPrefix}/infrastructure/&#123;id&#125;/dependencies</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded text-xs">GET</span>
                <span>{module.apiPrefix}/infrastructure/&#123;id&#125;/cascade-risk</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded text-xs">GET</span>
                <span>{module.apiPrefix}/infrastructure/&#123;id&#125;/vulnerability</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AccessGate>
  )
}

function RegisterModal({
  typeOptions,
  criticalityOptions,
  onClose,
  onSubmit,
  submitting,
  formError,
}: {
  typeOptions: Array<{ value: string; name: string }>
  criticalityOptions: Array<{ value: string; name: string }>
  onClose: () => void
  onSubmit: (data: RegisterInfrastructureRequest) => Promise<void>
  submitting: boolean
  formError: string | null
}) {
  const [name, setName] = useState('')
  const [infrastructure_type, setInfrastructureType] = useState('other')
  const [latitude, setLatitude] = useState(52.52)
  const [longitude, setLongitude] = useState(13.405)
  const [criticality_level, setCriticalityLevel] = useState('tier_3')
  const [country_code, setCountryCode] = useState('DE')
  const [region, setRegion] = useState('')
  const [city, setCity] = useState('')
  const [description, setDescription] = useState('')
  const [capacity_value, setCapacityValue] = useState<number | ''>('')
  const [population_served, setPopulationServed] = useState<number | ''>('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      name: name.trim() || 'Unnamed',
      infrastructure_type,
      latitude: Number(latitude),
      longitude: Number(longitude),
      criticality_level,
      country_code: country_code || 'DE',
      region: region || undefined,
      city: city || undefined,
      description: description || undefined,
      capacity_value: capacity_value === '' ? undefined : Number(capacity_value),
      population_served: population_served === '' ? undefined : Number(population_served),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-md shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 flex items-center justify-between border-b border-zinc-700">
          <h3 className="text-zinc-100 font-display font-semibold">Register Infrastructure</h3>
          <button onClick={onClose} className="p-1 rounded text-zinc-400 hover:text-zinc-100" aria-label="Close">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {formError && (
            <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              {formError}
            </div>
          )}
          <div>
            <label className="block text-zinc-300 text-sm mb-1">Name *</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500"
              placeholder="e.g. Main Power Plant"
              required
            />
          </div>
          <div>
            <label className="block text-zinc-300 text-sm mb-1">Type</label>
            <select
              value={infrastructure_type}
              onChange={(e) => setInfrastructureType(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100"
            >
              {typeOptions.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-300 text-sm mb-1">Latitude</label>
              <input
                type="number"
                step="any"
                value={latitude}
                onChange={(e) => setLatitude(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-zinc-300 text-sm mb-1">Longitude</label>
              <input
                type="number"
                step="any"
                value={longitude}
                onChange={(e) => setLongitude(Number(e.target.value))}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100"
              />
            </div>
          </div>
          <div>
            <label className="block text-zinc-300 text-sm mb-1">Criticality</label>
            <select
              value={criticality_level}
              onChange={(e) => setCriticalityLevel(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100"
            >
              {criticalityOptions.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-300 text-sm mb-1">Country</label>
              <input
                type="text"
                maxLength={2}
                value={country_code}
                onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-zinc-300 text-sm mb-1">Region</label>
              <input
                type="text"
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100"
              />
            </div>
          </div>
          <div>
            <label className="block text-zinc-300 text-sm mb-1">City</label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100"
            />
          </div>
          <div>
            <label className="block text-zinc-300 text-sm mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-300 text-sm mb-1">Capacity value</label>
              <input
                type="number"
                step="any"
                value={capacity_value}
                onChange={(e) => setCapacityValue(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100"
              />
            </div>
            <div>
              <label className="block text-zinc-300 text-sm mb-1">Population served</label>
              <input
                type="number"
                min={0}
                value={population_served}
                onChange={(e) => setPopulationServed(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-4">
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-md bg-zinc-600 hover:bg-zinc-600 text-zinc-100 font-medium disabled:opacity-50"
            >
              {submitting ? 'Registering…' : 'Register'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
