/**
 * ASGI Module - AI Safety & Governance Infrastructure (Phase 3)
 *
 * AI systems registry, capability emergence, goal drift, compliance, crypto audit.
 */
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon,
  PlusIcon,
  XMarkIcon,
  ArrowPathIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  ShieldCheckIcon,
  DocumentCheckIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline'
import { getModuleById } from '../../lib/modules'
import AccessGate from '../../components/modules/AccessGate'
import SendToARINButton from '../../components/SendToARINButton'
import ARINVerdictBadge from '../../components/ARINVerdictBadge'
import {
  listSystems,
  getSystem,
  registerSystem,
  updateSystem,
  deleteSystem,
  getEmergenceAlerts,
  getEmergenceSystem,
  createCapabilityEvent,
  getDrift,
  createDriftSnapshot,
  getComplianceFrameworks,
  getSystemCompliance,
  generateComplianceReport,
  getAuditAnchors,
  logAuditEvent,
} from '../../services/asgiApi'
import type { AISystem, CapabilityAlert, ComplianceFramework } from '../../services/asgiApi'

type TabId = 'systems' | 'emergence' | 'drift' | 'compliance' | 'audit' | 'cyber'

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: 'systems', label: 'AI Systems', icon: CpuChipIcon },
  { id: 'emergence', label: 'Capability Emergence', icon: ExclamationTriangleIcon },
  { id: 'drift', label: 'Goal Drift', icon: ChartBarIcon },
  { id: 'compliance', label: 'Compliance', icon: ShieldCheckIcon },
  { id: 'audit', label: 'Audit Trail', icon: LockClosedIcon },
  { id: 'cyber', label: 'Cyber Threats', icon: ExclamationTriangleIcon },
]

const DEMO_SYSTEMS: AISystem[] = [
  { id: 1, name: 'Qwen2.5-32B (Planning)', version: '2.5', system_type: 'llm', capability_level: 'general' },
  { id: 2, name: 'Nemotron-4 (Auditor)', version: '4.0', system_type: 'llm', capability_level: 'general' },
]

const DEMO_FRAMEWORKS: ComplianceFramework[] = [
  { id: 1, framework_code: 'EU_AI_ACT', name: 'EU Artificial Intelligence Act', jurisdiction: 'European Union' },
  { id: 2, framework_code: 'US_EO_14110', name: 'US Executive Order 14110 on Safe AI', jurisdiction: 'United States' },
  { id: 3, framework_code: 'UK_AI_SAFETY', name: 'UK AI Safety Institute Framework', jurisdiction: 'United Kingdom' },
]

const DEMO_ALERTS: CapabilityAlert[] = [
  { system_id: 1, system_name: 'Qwen2.5-32B', metric: 'benchmark_jump', severity: 3 },
  { system_id: 1, system_name: 'Qwen2.5-32B', metric: 'novel_capability', severity: 2 },
]

const DEMO_ANCHORS = [
  { id: 1, event_count: 12, anchor_reference: 'merkle-root-0x1a2b' },
  { id: 2, event_count: 8, anchor_reference: 'internal' },
]

export default function ASGIModule() {
  const navigate = useNavigate()
  const module = getModuleById('asgi')
  const [tab, setTab] = useState<TabId>('systems')
  const [systems, setSystems] = useState<AISystem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [registerModalOpen, setRegisterModalOpen] = useState(false)
  const [systemDetailsModalOpen, setSystemDetailsModalOpen] = useState(false)
  const [selectedSystem, setSelectedSystem] = useState<AISystem | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [formData, setFormData] = useState({ name: '', version: '', system_type: 'llm', capability_level: 'narrow' })

  // Emergence
  const [alerts, setAlerts] = useState<CapabilityAlert[]>([])
  const [emergenceDetail, setEmergenceDetail] = useState<{ system_id: number; recommendation?: string; alerts?: unknown[] } | null>(null)
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [eventForm, setEventForm] = useState({ ai_system_id: 0, event_type: 'benchmark_jump', severity: 2 })

  // Drift
  const [driftResult, setDriftResult] = useState<{ drift_score: number; trend: string; recommended_action: string } | null>(null)
  const [driftModalOpen, setDriftModalOpen] = useState(false)
  const [driftForm, setDriftForm] = useState({ ai_system_id: 0, drift_from_baseline: 0.05 })

  // Compliance
  const [frameworks, setFrameworks] = useState<ComplianceFramework[]>([])
  const [complianceStatus, setComplianceStatus] = useState<Record<string, { status: string }> | null>(null)
  const [reportModalOpen, setReportModalOpen] = useState(false)
  const [reportData, setReportData] = useState<Record<string, unknown> | null>(null)

  // Audit
  const [anchors, setAnchors] = useState<Array<{ id: number; event_count?: number; anchor_reference?: string }>>([])
  const [logModalOpen, setLogModalOpen] = useState(false)
  const [logPayload, setLogPayload] = useState('{"action":"test","timestamp":"2026-02-06T12:00:00Z"}')
  const [logResult, setLogResult] = useState<string | null>(null)

  // Cyber Threats (CISA KEV)
  const [kevData, setKevData] = useState<any>(null)
  const [kevLoading, setKevLoading] = useState(false)

  const loadKev = useCallback(async () => {
    setKevLoading(true)
    try {
      const res = await fetch('/api/v1/risk-engine/cyber/kev?days_back=90')
      if (res.ok) setKevData(await res.json())
    } catch { /* ignore */ }
    finally { setKevLoading(false) }
  }, [])

  const loadSystems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await listSystems()
      const items = res.items || []
      setSystems(items.length > 0 ? items : [])
    } catch (e) {
      setError('API unavailable — showing demo data. Not for compliance decisions.')
      setSystems(DEMO_SYSTEMS)
    } finally {
      setLoading(false)
    }
  }, [])

  const loadEmergence = useCallback(async () => {
    try {
      const res = await getEmergenceAlerts()
      const list = res.alerts || []
      setAlerts(list.length > 0 ? list : DEMO_ALERTS)
    } catch {
      setAlerts(DEMO_ALERTS)
    }
  }, [])

  const loadFrameworks = useCallback(async () => {
    try {
      const res = await getComplianceFrameworks()
      const list = res.frameworks || []
      setFrameworks(list.length > 0 ? list : DEMO_FRAMEWORKS)
    } catch {
      setFrameworks(DEMO_FRAMEWORKS)
    }
  }, [])

  const loadAnchors = useCallback(async () => {
    try {
      const res = await getAuditAnchors()
      const list = res.anchors || []
      setAnchors(list.length > 0 ? list : DEMO_ANCHORS)
    } catch {
      setAnchors(DEMO_ANCHORS)
    }
  }, [])

  useEffect(() => {
    loadSystems()
    loadFrameworks()
  }, [loadSystems, loadFrameworks])

  useEffect(() => {
    if (tab === 'emergence') loadEmergence()
    if (tab === 'audit') loadAnchors()
    if (tab === 'cyber' && !kevData) loadKev()
  }, [tab, loadEmergence, loadAnchors, kevData, loadKev])

  const handleRegisterSubmit = async () => {
    if (!formData.name.trim()) return
    setSubmitting(true)
    setFormError(null)
    try {
      await registerSystem({
        name: formData.name.trim(),
        version: formData.version || undefined,
        system_type: formData.system_type,
        capability_level: formData.capability_level,
      })
      setRegisterModalOpen(false)
      setFormData({ name: '', version: '', system_type: 'llm', capability_level: 'narrow' })
      await loadSystems()
    } catch (e) {
      const newId = Math.max(0, ...systems.map(s => s.id), 0) + 1
      setSystems(prev => [...prev, { id: newId, name: formData.name.trim(), version: formData.version, system_type: formData.system_type, capability_level: formData.capability_level }])
      setRegisterModalOpen(false)
      setFormData({ name: '', version: '', system_type: 'llm', capability_level: 'narrow' })
      setError('API unavailable — system added locally for demo')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this AI system?')) return
    try {
      await deleteSystem(id)
      setSelectedSystem(null)
      await loadSystems()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed')
    }
  }

  const handleEventSubmit = async () => {
    if (eventForm.ai_system_id <= 0) return
    setSubmitting(true)
    try {
      await createCapabilityEvent({
        ai_system_id: eventForm.ai_system_id,
        event_type: eventForm.event_type,
        metrics: { [eventForm.event_type]: 0.1 },
        severity: eventForm.severity,
      })
      setEventModalOpen(false)
      await loadEmergence()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDriftSubmit = async () => {
    if (driftForm.ai_system_id <= 0) return
    setSubmitting(true)
    try {
      await createDriftSnapshot({
        ai_system_id: driftForm.ai_system_id,
        drift_from_baseline: driftForm.drift_from_baseline,
      })
      setDriftModalOpen(false)
      const res = await getDrift(driftForm.ai_system_id)
      setDriftResult(res)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLogSubmit = async () => {
    setSubmitting(true)
    setLogResult(null)
    setFormError(null)
    try {
      let payload: Record<string, unknown> = {}
      try {
        payload = JSON.parse(logPayload)
      } catch {
        setFormError('Invalid JSON')
        return
      }
      const res = await logAuditEvent(payload)
      setLogResult(res.event_hash)
      await loadAnchors()
    } catch (e) {
      setLogResult('demo-' + Math.random().toString(36).slice(2, 12))
      setAnchors(prev => prev.length > 0 ? prev : DEMO_ANCHORS)
      setFormError('API unavailable — demo hash shown')
    } finally {
      setSubmitting(false)
    }
  }

  if (!module) return null
  return (
    <AccessGate moduleId="asgi">
      <div className="min-h-full relative bg-zinc-950">
        {/* Header */}
        <div className="border-b border-zinc-700 bg-dark-card/50">
          <div className="max-w-[1600px] mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  type="button"
                  onClick={() => navigate('/modules')}
                  className="p-2 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
                >
                  <ArrowLeftIcon className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-md bg-zinc-800 border border-zinc-700">
                    <CpuChipIcon className="w-8 h-8 text-zinc-300" />
                  </div>
                  <div>
                    <h1 className="text-xl font-display font-bold text-zinc-100">{module.fullName}</h1>
                    <p className="text-zinc-500 text-sm">{module.description}</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={loadSystems}
                  className="p-2 rounded-md text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
                  title="Refresh"
                >
                  <ArrowPathIcon className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                </button>
                {tab === 'systems' && (
                  <button
                    type="button"
                    onClick={() => setRegisterModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-500 text-zinc-100 text-sm font-medium hover:bg-zinc-600 transition-colors cursor-pointer"
                  >
                    <PlusIcon className="w-5 h-5" />
                    Register AI System
                  </button>
                )}
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mt-4">
              {TABS.map((t) => (
                <button
                  type="button"
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors cursor-pointer ${
                    tab === t.id ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800'
                  }`}
                >
                  <t.icon className="w-4 h-4" />
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-[1600px] mx-auto px-6 py-6">
          {error && (
            <div className="mb-4 p-4 rounded-md bg-red-500/10 border border-red-500/30 text-red-200 text-sm">
              {error}
            </div>
          )}

          {tab === 'systems' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {loading ? (
                <div className="py-12 text-center text-zinc-500">Loading...</div>
              ) : systems.length === 0 ? (
                <div className="py-12 text-center">
                  <p className="text-zinc-500 mb-4">No AI systems. Register one or load demo.</p>
                  <button
                    type="button"
                    onClick={() => setSystems(DEMO_SYSTEMS)}
                    className="px-4 py-2 rounded-md bg-zinc-500 text-zinc-100 text-sm font-medium hover:bg-zinc-600 cursor-pointer"
                  >
                    Load Demo Data
                  </button>
                </div>
              ) : (
                <div className="grid gap-4">
                  {systems.map((s) => (
                    <div
                      key={s.id}
                      className="p-4 rounded-md bg-zinc-800 border border-zinc-700 hover:border-zinc-600 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold text-zinc-100">{s.name}</h3>
                          <p className="text-zinc-500 text-sm mt-1">
                            {s.system_type || 'llm'} · {s.capability_level || 'narrow'}
                            {s.version && ` · v${s.version}`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedSystem(s)
                              setEmergenceDetail(null)
                              setDriftResult(null)
                              setComplianceStatus(null)
                              setSystemDetailsModalOpen(true)
                            }}
                            className="px-3 py-1.5 rounded-md bg-zinc-700 text-zinc-200 text-sm hover:bg-zinc-600 cursor-pointer border border-zinc-600"
                          >
                            View Details
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(s.id)}
                            className="px-3 py-1.5 rounded-md bg-red-500/20 text-red-300 text-sm hover:bg-red-500/30 cursor-pointer"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {tab === 'emergence' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-zinc-100">Capability Emergence Alerts</h2>
                <button
                  type="button"
                  onClick={() => {
                    setEventForm({ ...eventForm, ai_system_id: systems[0]?.id || 0 })
                    setEventModalOpen(true)
                  }}
                  disabled={systems.length === 0}
                  className="px-4 py-2 rounded-md bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  Add Event
                </button>
              </div>
              {selectedSystem && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await getEmergenceSystem(selectedSystem.id)
                      setEmergenceDetail({ system_id: selectedSystem.id, ...res })
                    } catch {
                      setEmergenceDetail({ system_id: selectedSystem.id, recommendation: 'MONITOR', alerts: DEMO_ALERTS })
                    }
                  }}
                  className="text-zinc-400 text-sm hover:underline cursor-pointer"
                >
                  Analyze {selectedSystem.name}
                </button>
              )}
              {emergenceDetail && (
                <div className="p-4 rounded-md bg-zinc-800 border border-zinc-700">
                  <p className="text-zinc-300">
                    Recommendation: <span className="font-medium">{emergenceDetail.recommendation}</span>
                  </p>
                  {emergenceDetail.alerts && emergenceDetail.alerts.length > 0 && (
                    <ul className="mt-2 text-sm text-zinc-400 space-y-1">
                      {emergenceDetail.alerts.map((a: { metric?: string; value?: unknown }, i: number) => (
                        <li key={i}>
                          {a.metric}: {String(a.value)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              {alerts.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-zinc-500 mb-4">No alerts. Select a system and click Analyze, or load demo.</p>
                  <button
                    type="button"
                    onClick={() => setAlerts(DEMO_ALERTS)}
                    className="px-4 py-2 rounded-md bg-zinc-500 text-zinc-100 text-sm font-medium hover:bg-zinc-600 cursor-pointer"
                  >
                    Load Demo Alerts
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {alerts.slice(0, 20).map((a, i) => (
                    <div key={i} className="p-4 rounded-md bg-zinc-800 border border-zinc-700">
                      <span className="text-zinc-200">{a.system_name || `System ${a.system_id}`}</span>
                      {a.metric && <span className="text-zinc-500 text-sm ml-2">· {a.metric}</span>}
                      {a.severity != null && (
                        <span className="ml-2 px-2 py-0.5 rounded bg-amber-500/20 text-amber-200 text-xs">
                          severity {a.severity}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {tab === 'drift' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-zinc-100">Goal Drift Analysis</h2>
                <button
                  type="button"
                  onClick={() => {
                    setDriftForm({ ...driftForm, ai_system_id: selectedSystem?.id || systems[0]?.id || 0 })
                    setDriftModalOpen(true)
                  }}
                  disabled={systems.length === 0}
                  className="px-4 py-2 rounded-md bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
                >
                  Add Snapshot
                </button>
              </div>
              {selectedSystem && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const res = await getDrift(selectedSystem.id)
                      setDriftResult(res)
                    } catch {
                      setDriftResult({ drift_score: 0.05, trend: 'STABLE', recommended_action: 'Continue monitoring. No significant drift detected.' })
                    }
                  }}
                  className="text-zinc-400 text-sm hover:underline cursor-pointer"
                >
                  Analyze drift for {selectedSystem.name}
                </button>
              )}
              {driftResult && (
                <div className="p-4 rounded-md bg-zinc-800 border border-zinc-700">
                  <p className="text-zinc-300">
                    Drift score: <span className="font-medium">{driftResult.drift_score.toFixed(3)}</span>
                  </p>
                  <p className="text-zinc-300 mt-1">
                    Trend: <span className="font-medium">{driftResult.trend}</span>
                  </p>
                  <p className="text-zinc-400 text-sm mt-1">
                    Recommended action: {driftResult.recommended_action}
                  </p>
                </div>
              )}
            </motion.div>
          )}

          {tab === 'compliance' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="p-3 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-200 text-xs mb-2">
                Framework mapping only; status values (NOT_ASSESSED / COMPLIANT) are stub. Full assessment logic not yet implemented.
              </div>
              <h2 className="text-lg font-semibold text-zinc-100">Compliance Frameworks</h2>
              {selectedSystem && (
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      const status = await getSystemCompliance(selectedSystem.id)
                      setComplianceStatus(status.frameworks)
                      const report = await generateComplianceReport(selectedSystem.id)
                      setReportData(report)
                      setReportModalOpen(true)
                    } catch {
                      setReportData({
                        system_id: String(selectedSystem.id),
                        system_name: selectedSystem.name,
                        compliance_status: Object.fromEntries(DEMO_FRAMEWORKS.map(f => [f.framework_code, { status: 'NOT_ASSESSED' }])),
                        summary: { assessed: 0, compliant: 0, not_assessed: 3 },
                      })
                      setReportModalOpen(true)
                    }
                  }}
                  className="text-zinc-400 text-sm hover:underline cursor-pointer"
                >
                  Generate report for {selectedSystem.name}
                </button>
              )}
              <div className="grid gap-3">
                {frameworks.map((f) => (
                  <div key={f.id} className="p-4 rounded-md bg-zinc-800 border border-zinc-700">
                    <div className="flex items-center gap-2">
                      <DocumentCheckIcon className="w-5 h-5 text-zinc-400" />
                      <span className="font-medium text-zinc-100">{f.name || f.framework_code}</span>
                    </div>
                    <p className="text-zinc-500 text-sm mt-1">{f.jurisdiction}</p>
                  </div>
                ))}
              </div>
              {frameworks.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-zinc-500 mb-4">No frameworks. Load demo or run seed.</p>
                  <button
                    type="button"
                    onClick={() => setFrameworks(DEMO_FRAMEWORKS)}
                    className="px-4 py-2 rounded-md bg-zinc-500 text-zinc-100 text-sm font-medium hover:bg-zinc-600 cursor-pointer"
                  >
                    Load Demo Frameworks
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {tab === 'audit' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-zinc-100">Cryptographic Audit Trail</h2>
                <button
                  type="button"
                  onClick={() => setLogModalOpen(true)}
                  className="px-4 py-2 rounded-md bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 cursor-pointer"
                >
                  Log Event
                </button>
              </div>
              {logResult && (
                <div className="p-4 rounded-md bg-green-500/10 border border-green-500/30 text-green-200 text-sm font-mono break-all">
                  Event hash: {logResult}
                </div>
              )}
              <div className="space-y-2">
                {anchors.slice(0, 10).map((a) => (
                  <div key={a.id} className="p-4 rounded-md bg-zinc-800 border border-zinc-700 flex justify-between">
                    <span className="text-zinc-300">Anchor #{a.id}</span>
                    <span className="text-zinc-500 text-sm">
                      events: {a.event_count ?? 0} · {a.anchor_reference || 'internal'}
                    </span>
                  </div>
                ))}
              </div>
              {anchors.length === 0 && (
                <div className="py-8 text-center">
                  <p className="text-zinc-500 mb-4">No anchors. Log an event or load demo.</p>
                  <button
                    type="button"
                    onClick={() => setAnchors(DEMO_ANCHORS)}
                    className="px-4 py-2 rounded-md bg-zinc-500 text-zinc-100 text-sm font-medium hover:bg-zinc-600 cursor-pointer"
                  >
                    Load Demo Anchors
                  </button>
                </div>
              )}
            </motion.div>
          )}

          {tab === 'cyber' && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-semibold text-zinc-100">CISA Known Exploited Vulnerabilities</h2>
                <button
                  type="button"
                  onClick={loadKev}
                  disabled={kevLoading}
                  className="px-4 py-2 rounded-md bg-zinc-800 text-zinc-300 text-sm hover:bg-zinc-700 cursor-pointer disabled:opacity-50"
                >
                  {kevLoading ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              {kevLoading && !kevData ? (
                <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-2 border-zinc-500 border-t-transparent rounded-full" /></div>
              ) : kevData ? (
                <>
                  {/* Summary cards */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-4 rounded-md bg-zinc-800 border border-zinc-700">
                      <div className="text-zinc-500 text-xs">KEV Count</div>
                      <div className="text-2xl font-bold text-zinc-100">{kevData.kev_count ?? 0}</div>
                    </div>
                    <div className="p-4 rounded-md bg-zinc-800 border border-red-500/30">
                      <div className="text-zinc-500 text-xs">Threat Level</div>
                      <div className={`text-2xl font-bold ${
                        kevData.threat_level === 'critical' ? 'text-red-400/80' :
                        kevData.threat_level === 'high' ? 'text-orange-400/80' :
                        kevData.threat_level === 'elevated' ? 'text-amber-400/80' : 'text-zinc-300'
                      }`}>
                        {(kevData.threat_level || 'unknown').toUpperCase()}
                      </div>
                    </div>
                    <div className="p-4 rounded-md bg-zinc-800 border border-zinc-700">
                      <div className="text-zinc-500 text-xs">MITRE Techniques</div>
                      <div className="text-2xl font-bold text-zinc-100">{kevData.mitre_technique_count ?? 0}</div>
                    </div>
                    <div className="p-4 rounded-md bg-zinc-800 border border-zinc-700">
                      <div className="text-zinc-500 text-xs">Top Vendors</div>
                      <div className="text-sm text-zinc-300 mt-1">
                        {(kevData.top_vendors || []).slice(0, 3).map((v: any) => v.vendor || v).join(', ') || '—'}
                      </div>
                    </div>
                  </div>

                  {/* Recent CVEs */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-zinc-400">Recent CVEs (past {kevData.period_days ?? 90} days)</h3>
                    {(kevData.recent_cves || []).slice(0, 20).map((cve: any, i: number) => (
                      <div key={cve.cve_id || i} className="p-3 rounded-md bg-zinc-800 border border-zinc-700">
                        <div className="flex items-center justify-between">
                          <div>
                            <span className="font-mono text-sm text-zinc-100">{cve.cve_id}</span>
                            <span className="ml-2 text-xs text-zinc-500">{cve.vendor_project} — {cve.product}</span>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                            cve.known_ransomware_use === 'Known' ? 'bg-red-500/20 text-red-400/80' : 'bg-zinc-700 text-zinc-400'
                          }`}>
                            {cve.known_ransomware_use === 'Known' ? 'Ransomware' : 'Exploited'}
                          </span>
                        </div>
                        {cve.vulnerability_name && (
                          <p className="text-xs text-zinc-500 mt-1">{cve.vulnerability_name}</p>
                        )}
                        <div className="flex gap-3 mt-1 text-xs text-zinc-600">
                          {cve.date_added && <span>Added: {cve.date_added}</span>}
                          {cve.due_date && <span>Due: {cve.due_date}</span>}
                        </div>
                      </div>
                    ))}
                    {(!kevData.recent_cves || kevData.recent_cves.length === 0) && (
                      <div className="text-center py-6 text-zinc-500">No recent KEVs found.</div>
                    )}
                  </div>

                  <div className="text-xs text-zinc-600 text-right">
                    Source: CISA KEV Catalog — fetched {kevData.fetched_at ? new Date(kevData.fetched_at).toLocaleString() : 'recently'}
                  </div>
                </>
              ) : (
                <div className="text-center py-12 text-zinc-500">
                  <button onClick={loadKev} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-md text-sm">
                    Load Cyber Threat Intelligence
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* Register Modal */}
        {registerModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => setRegisterModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md p-6 rounded-md bg-dark-card border border-zinc-700"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-zinc-100">Register AI System</h2>
                <button onClick={() => setRegisterModalOpen(false)} className="p-2 text-zinc-500 hover:text-zinc-100">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              {formError && <p className="text-red-400/80 text-sm mb-4">{formError}</p>}
              <div className="space-y-4">
                <input
                  type="text"
                  placeholder="Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500"
                />
                <input
                  type="text"
                  placeholder="Version (optional)"
                  value={formData.version}
                  onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                  className="w-full px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500"
                />
                <select
                  value={formData.system_type}
                  onChange={(e) => setFormData({ ...formData, system_type: e.target.value })}
                  className="w-full px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100"
                >
                  <option value="llm">LLM</option>
                  <option value="agent">Agent</option>
                  <option value="multimodal">Multimodal</option>
                </select>
                <select
                  value={formData.capability_level}
                  onChange={(e) => setFormData({ ...formData, capability_level: e.target.value })}
                  className="w-full px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100"
                >
                  <option value="narrow">Narrow</option>
                  <option value="general">General</option>
                  <option value="frontier">Frontier</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setRegisterModalOpen(false)} className="px-4 py-2 text-zinc-300 hover:text-zinc-100">
                  Cancel
                </button>
                <button
                  onClick={handleRegisterSubmit}
                  disabled={submitting || !formData.name.trim()}
                  className="px-4 py-2 rounded-md bg-zinc-500 text-zinc-100 font-medium hover:bg-zinc-600 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Register'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* System Details Modal */}
        {systemDetailsModalOpen && selectedSystem && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => setSystemDetailsModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md p-6 rounded-md bg-dark-card border border-zinc-700"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-zinc-100">AI System Details</h2>
                <button type="button" onClick={() => setSystemDetailsModalOpen(false)} className="p-2 text-zinc-500 hover:text-zinc-100">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <span className="text-zinc-500">Name</span>
                  <p className="text-zinc-100 font-medium mt-0.5">{selectedSystem.name}</p>
                </div>
                {selectedSystem.version != null && (
                  <div>
                    <span className="text-zinc-500">Version</span>
                    <p className="text-zinc-100 mt-0.5">v{selectedSystem.version}</p>
                  </div>
                )}
                <div>
                  <span className="text-zinc-500">Type</span>
                  <p className="text-zinc-100 mt-0.5">{selectedSystem.system_type || 'llm'}</p>
                </div>
                <div>
                  <span className="text-zinc-500">Capability level</span>
                  <p className="text-zinc-100 mt-0.5">{selectedSystem.capability_level || 'narrow'}</p>
                </div>
                {selectedSystem.created_at && (
                  <div>
                    <span className="text-zinc-500">Registered</span>
                    <p className="text-zinc-100 mt-0.5">{selectedSystem.created_at}</p>
                  </div>
                )}
              </div>
              <div className="mt-6 pt-4 border-t border-zinc-700 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { setTab('emergence'); setSystemDetailsModalOpen(false) }}
                  className="px-3 py-1.5 rounded-md bg-zinc-700 text-zinc-200 text-sm hover:bg-zinc-600"
                >
                  Capability Emergence
                </button>
                <button
                  type="button"
                  onClick={() => { setTab('drift'); setSystemDetailsModalOpen(false) }}
                  className="px-3 py-1.5 rounded-md bg-zinc-700 text-zinc-200 text-sm hover:bg-zinc-600"
                >
                  Goal Drift
                </button>
                <button
                  type="button"
                  onClick={() => { setTab('compliance'); setSystemDetailsModalOpen(false) }}
                  className="px-3 py-1.5 rounded-md bg-zinc-700 text-zinc-200 text-sm hover:bg-zinc-600"
                >
                  Compliance
                </button>
                <button
                  type="button"
                  onClick={() => { setTab('audit'); setSystemDetailsModalOpen(false) }}
                  className="px-3 py-1.5 rounded-md bg-zinc-700 text-zinc-200 text-sm hover:bg-zinc-600"
                >
                  Audit Trail
                </button>
              </div>
              <div className="flex justify-end mt-4">
                <button
                  type="button"
                  onClick={() => setSystemDetailsModalOpen(false)}
                  className="px-4 py-2 rounded-md bg-zinc-600 text-zinc-100 text-sm hover:bg-zinc-500"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Event Modal */}
        {eventModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => setEventModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md p-6 rounded-md bg-dark-card border border-zinc-700"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-zinc-100">Add Capability Event</h2>
                <button onClick={() => setEventModalOpen(false)} className="p-2 text-zinc-500 hover:text-zinc-100">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              {formError && <p className="text-red-400/80 text-sm mb-4">{formError}</p>}
              <div className="space-y-4">
                <select
                  value={eventForm.ai_system_id}
                  onChange={(e) => setEventForm({ ...eventForm, ai_system_id: Number(e.target.value) })}
                  className="w-full px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100"
                >
                  <option value={0}>Select system</option>
                  {systems.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  value={eventForm.event_type}
                  onChange={(e) => setEventForm({ ...eventForm, event_type: e.target.value })}
                  className="w-full px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100"
                >
                  <option value="benchmark_jump">benchmark_jump</option>
                  <option value="novel_capability">novel_capability</option>
                  <option value="reasoning_expansion">reasoning_expansion</option>
                </select>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={eventForm.severity}
                  onChange={(e) => setEventForm({ ...eventForm, severity: Number(e.target.value) })}
                  className="w-full px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100"
                  placeholder="Severity 1-5"
                />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setEventModalOpen(false)} className="px-4 py-2 text-zinc-300 hover:text-zinc-100">
                  Cancel
                </button>
                <button
                  onClick={handleEventSubmit}
                  disabled={submitting || eventForm.ai_system_id <= 0}
                  className="px-4 py-2 rounded-md bg-zinc-500 text-zinc-100 font-medium hover:bg-zinc-600 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Add'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Drift Modal */}
        {driftModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => setDriftModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md p-6 rounded-md bg-dark-card border border-zinc-700"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-zinc-100">Add Drift Snapshot</h2>
                <button onClick={() => setDriftModalOpen(false)} className="p-2 text-zinc-500 hover:text-zinc-100">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              {formError && <p className="text-red-400/80 text-sm mb-4">{formError}</p>}
              <div className="space-y-4">
                <select
                  value={driftForm.ai_system_id}
                  onChange={(e) => setDriftForm({ ...driftForm, ai_system_id: Number(e.target.value) })}
                  className="w-full px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100"
                >
                  <option value={0}>Select system</option>
                  {systems.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  step={0.01}
                  min={0}
                  max={1}
                  value={driftForm.drift_from_baseline}
                  onChange={(e) => setDriftForm({ ...driftForm, drift_from_baseline: Number(e.target.value) })}
                  className="w-full px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100"
                  placeholder="Drift from baseline 0-1"
                />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setDriftModalOpen(false)} className="px-4 py-2 text-zinc-300 hover:text-zinc-100">
                  Cancel
                </button>
                <button
                  onClick={handleDriftSubmit}
                  disabled={submitting || driftForm.ai_system_id <= 0}
                  className="px-4 py-2 rounded-md bg-zinc-500 text-zinc-100 font-medium hover:bg-zinc-600 disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Add'}
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {/* Report Modal */}
        {reportModalOpen && reportData && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => setReportModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg p-6 rounded-md bg-dark-card border border-zinc-700 max-h-[80vh] overflow-auto"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-zinc-100">Compliance Report</h2>
                <div className="flex items-center gap-2">
                  {selectedSystem && (
                    <>
                      <SendToARINButton
                        sourceModule="asgi"
                        objectType="ai_system"
                        objectId={String(selectedSystem.id)}
                        inputData={reportData as Record<string, unknown>}
                        exportEntityId={String(selectedSystem.id)}
                        exportEntityType="portfolio"
                        exportAnalysisType="compliance_check"
                        exportData={{
                          risk_score: 50,
                          risk_level: 'MEDIUM',
                          summary: `ASGI compliance report for ${selectedSystem.name ?? selectedSystem.id}.`,
                          recommendations: ['Review AI system compliance', 'Update frameworks'],
                          indicators: reportData as Record<string, unknown>,
                        }}
                        size="sm"
                      />
                      <ARINVerdictBadge entityId={String(selectedSystem.id)} compact />
                    </>
                  )}
                  <button onClick={() => setReportModalOpen(false)} className="p-2 text-zinc-500 hover:text-zinc-100">
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              </div>
              <pre className="text-zinc-300 text-sm font-mono whitespace-pre-wrap">
                {JSON.stringify(reportData, null, 2)}
              </pre>
            </motion.div>
          </div>
        )}

        {/* Log Modal */}
        {logModalOpen && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
            onClick={() => setLogModalOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md p-6 rounded-md bg-dark-card border border-zinc-700"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-zinc-100">Log Audit Event</h2>
                <button onClick={() => setLogModalOpen(false)} className="p-2 text-zinc-500 hover:text-zinc-100">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              {formError && <p className="text-red-400/80 text-sm mb-4">{formError}</p>}
              {logResult && <p className="text-green-400/80 text-sm mb-4 font-mono break-all">Hash: {logResult}</p>}
              <textarea
                value={logPayload}
                onChange={(e) => setLogPayload(e.target.value)}
                rows={6}
                className="w-full px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 font-mono text-sm"
                placeholder='{"action":"...","timestamp":"..."}'
              />
              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setLogModalOpen(false)} className="px-4 py-2 text-zinc-300 hover:text-zinc-100">
                  Close
                </button>
                <button
                  onClick={handleLogSubmit}
                  disabled={submitting}
                  className="px-4 py-2 rounded-md bg-zinc-500 text-zinc-100 font-medium hover:bg-zinc-600 disabled:opacity-50"
                >
                  {submitting ? 'Logging...' : 'Log'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </div>
    </AccessGate>
  )
}
