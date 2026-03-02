/**
 * SRO Module - Systemic Risk Observatory
 *
 * List institutions, register new, view correlations, indicators,
 * systemic risk score, and contagion analysis.
 */
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon,
  PlusIcon,
  XMarkIcon,
  ArrowPathIcon,
  ChartBarIcon,
  LinkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { getModuleById } from '../../lib/modules'
import { sroApi } from '../../lib/api'
import type { SROInstitution, SROCorrelation, SROIndicator } from '../../lib/api'
import AccessGate from '../../components/modules/AccessGate'
import SendToARINButton from '../../components/SendToARINButton'
import ARINVerdictBadge from '../../components/ARINVerdictBadge'

type CorrelationsData = {
  institution_id: string
  sro_id: string
  correlations: SROCorrelation[]
}

type SystemicRiskData = {
  institution_id?: string
  sro_id?: string
  name?: string
  systemic_risk_score?: number
  systemic_importance?: string
  components?: Record<string, number>
  correlations_count?: number
  under_stress?: boolean
  risk_level?: string
  error?: string
}

type ContagionData = {
  source_institution?: { id: string; name: string; sro_id?: string }
  name?: string
  sro_id?: string
  affected_institutions?: Array<{ institution_id: string; name: string; sro_id?: string; depth: number; exposure?: number }>
  total_exposure_at_risk?: number
  error?: string
}

export default function SROModule() {
  const navigate = useNavigate()
  const module = getModuleById('sro')
  const [institutions, setInstitutions] = useState<SROInstitution[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [registerModalOpen, setRegisterModalOpen] = useState(false)
  const [selectedInstitution, setSelectedInstitution] = useState<SROInstitution | null>(null)
  const [correlationsData, setCorrelationsData] = useState<CorrelationsData | null>(null)
  const [systemicRiskData, setSystemicRiskData] = useState<SystemicRiskData | null>(null)
  const [contagionData, setContagionData] = useState<ContagionData | null>(null)
  const [indicators, setIndicators] = useState<SROIndicator[]>([])
  const [breachedIndicators, setBreachedIndicators] = useState<SROIndicator[]>([])
  const [showIndicators, setShowIndicators] = useState(false)
  const [typeOptions, setTypeOptions] = useState<Array<{ value: string; name: string }>>([])
  const [importanceOptions, setImportanceOptions] = useState<
    Array<{ value: string; name: string; description?: string }>
  >([])
  const [stats, setStats] = useState<Record<string, number> | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await sroApi.listInstitutions({ limit: 200 })
      setInstitutions(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load institutions')
      setInstitutions([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadOptionsAndStats = useCallback(async () => {
    try {
      const [types, levels, status] = await Promise.all([
        sroApi.getTypes(),
        sroApi.getSystemicImportanceLevels(),
        sroApi.getStatus(),
      ])
      setTypeOptions(types)
      setImportanceOptions(levels)
      setStats((status?.statistics as Record<string, number>) ?? null)
    } catch {
      // non-blocking
    }
  }, [])

  useEffect(() => {
    loadList()
    loadOptionsAndStats()
  }, [loadList, loadOptionsAndStats])

  const handleRegisterSubmit = async (data: {
    name: string
    institution_type?: string
    systemic_importance?: string
    country_code?: string
    headquarters_city?: string
    description?: string
    total_assets?: number
    market_cap?: number
    regulator?: string
    lei_code?: string
  }) => {
    setSubmitting(true)
    setFormError(null)
    try {
      await sroApi.registerInstitution(data)
      setRegisterModalOpen(false)
      await loadList()
      loadOptionsAndStats()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to register')
    } finally {
      setSubmitting(false)
    }
  }

  const handleViewCorrelations = async (inst: SROInstitution) => {
    setSelectedInstitution(inst)
    setSystemicRiskData(null)
    setContagionData(null)
    try {
      const res = await sroApi.getCorrelations(inst.id)
      setCorrelationsData(res)
    } catch {
      setCorrelationsData(null)
    }
  }

  const handleViewSystemicRisk = async (inst: SROInstitution) => {
    setSelectedInstitution(inst)
    setCorrelationsData(null)
    setContagionData(null)
    try {
      const res = await sroApi.getSystemicRisk(inst.id)
      setSystemicRiskData(res as SystemicRiskData)
    } catch {
      setSystemicRiskData({ error: 'Failed to load systemic risk' })
    }
  }

  const handleViewContagion = async (inst: SROInstitution) => {
    setSelectedInstitution(inst)
    setCorrelationsData(null)
    setSystemicRiskData(null)
    try {
      const res = await sroApi.getContagionAnalysis(inst.id, 3)
      setContagionData(res as ContagionData)
    } catch {
      setContagionData({ error: 'Failed to load contagion analysis' })
    }
  }

  const loadIndicators = useCallback(async () => {
    try {
      const [latest, breached] = await Promise.all([
        sroApi.listIndicators({ limit: 30 }),
        sroApi.getBreachedIndicators(),
      ])
      setIndicators(latest)
      setBreachedIndicators(breached)
    } catch {
      setIndicators([])
      setBreachedIndicators([])
    }
  }, [])

  const openIndicators = () => {
    setShowIndicators(true)
    loadIndicators()
  }

  const closePanels = () => {
    setSelectedInstitution(null)
    setCorrelationsData(null)
    setSystemicRiskData(null)
    setContagionData(null)
    setShowIndicators(false)
  }

  const hasDetailPanel =
    correlationsData !== null ||
    systemicRiskData !== null ||
    contagionData !== null ||
    showIndicators

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
                    <h1 className="text-lg font-semibold text-zinc-100">
                      {module.fullName}
                    </h1>
                    <span className="text-zinc-500 text-xs">Phase {module.phase}</span>
                    <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 text-[10px] rounded border border-zinc-700">{module.priority}</span>
                    <span className="px-2 py-1 bg-zinc-700 text-zinc-200 text-xs rounded border border-zinc-600">Active</span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">{module.description}</p>
                </div>
              </div>
              {stats && (
                <div className="flex gap-4 text-sm text-zinc-400">
                  <span>{stats.total_institutions ?? 0} institutions</span>
                  <span>{stats.total_correlations ?? 0} correlations</span>
                  <span>{stats.breached_indicators ?? 0} breached</span>
                </div>
              )}
            </div>
          </motion.div>

          {/* Actions */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-6 flex flex-wrap gap-3"
          >
            <button
              onClick={() => setRegisterModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-100 rounded-md border border-zinc-700 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              Register Institution
            </button>
            <button
              onClick={loadList}
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-md border border-zinc-700 transition-colors disabled:opacity-50"
            >
              <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={openIndicators}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-md border border-zinc-600 transition-colors"
            >
              <ChartBarIcon className="w-4 h-4" />
              Indicators {stats?.breached_indicators ? `(${stats.breached_indicators} breached)` : ''}
            </button>
            <button
              onClick={() => navigate('/modules/sro/regulator')}
              className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 rounded-md border border-zinc-600 transition-colors"
            >
              <ChartBarIcon className="w-4 h-4" />
              Regulator Dashboard
            </button>
            <SendToARINButton
              sourceModule="sro"
              objectType="institution"
              objectId="sro-dashboard"
              inputData={{
                total_institutions: stats?.total_institutions ?? 0,
                breached_indicators: stats?.breached_indicators ?? 0,
                total_correlations: stats?.total_correlations ?? 0,
              }}
              exportEntityId="portfolio_global"
              exportEntityType="portfolio"
              exportAnalysisType="compliance_check"
              exportData={{
                risk_score: (stats?.breached_indicators ?? 0) > 0 ? 65 : 40,
                risk_level: (stats?.breached_indicators ?? 0) > 2 ? 'HIGH' : (stats?.breached_indicators ?? 0) > 0 ? 'MEDIUM' : 'LOW',
                summary: `SRO: ${stats?.total_institutions ?? 0} institutions, ${stats?.breached_indicators ?? 0} breached indicators.`,
                recommendations: ['Monitor breached indicators', 'Review cross-border exposure'],
                indicators: {
                  total_institutions: stats?.total_institutions ?? 0,
                  breached_indicators: stats?.breached_indicators ?? 0,
                  total_correlations: stats?.total_correlations ?? 0,
                },
              }}
              size="md"
            />
            <ARINVerdictBadge entityId="portfolio_global" compact />
          </motion.div>

          {error && (
            <div className="mb-4 p-4 rounded-md bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="p-8 text-center text-zinc-400">Loading institutions…</div>
          ) : institutions.length === 0 ? (
            <div className="p-8 rounded-md bg-zinc-800 border border-zinc-700 text-center text-zinc-400">
              No institutions registered yet. Click “Register Institution” to add one.
            </div>
          ) : (
            <div className="rounded-md border border-zinc-700 overflow-hidden bg-zinc-800">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-700">
                    <th className="p-3 text-zinc-300 font-medium">Name</th>
                    <th className="p-3 text-zinc-300 font-medium">SRO ID</th>
                    <th className="p-3 text-zinc-300 font-medium">Type</th>
                    <th className="p-3 text-zinc-300 font-medium">Importance</th>
                    <th className="p-3 text-zinc-300 font-medium">Country</th>
                    <th className="p-3 text-zinc-300 font-medium">Stress</th>
                    <th className="p-3 text-zinc-300 font-medium">Systemic</th>
                    <th className="p-3 text-zinc-300 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {institutions.map((inst) => (
                    <tr key={inst.id} className="border-b border-zinc-800 hover:bg-zinc-800">
                      <td className="p-3 text-zinc-100">{inst.name}</td>
                      <td className="p-3 text-zinc-400 font-mono text-xs">{inst.sro_id}</td>
                      <td className="p-3 text-zinc-300">{inst.institution_type?.replace(/_/g, ' ') || '—'}</td>
                      <td className="p-3 text-zinc-300">{inst.systemic_importance || '—'}</td>
                      <td className="p-3 text-zinc-300">{inst.country_code || '—'}</td>
                      <td className="p-3 text-zinc-300">{inst.under_stress ? 'Yes' : 'No'}</td>
                      <td className="p-3 text-zinc-300">
                        {inst.systemic_risk_score != null ? inst.systemic_risk_score.toFixed(0) : '—'}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-2">
                          <button
                            onClick={() => handleViewCorrelations(inst)}
                            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs border border-zinc-700"
                          >
                            Correlations
                          </button>
                          <button
                            onClick={() => handleViewSystemicRisk(inst)}
                            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs border border-zinc-700"
                          >
                            Systemic Risk
                          </button>
                          <button
                            onClick={() => handleViewContagion(inst)}
                            className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs border border-zinc-700"
                          >
                            Contagion
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Detail panels */}
          {hasDetailPanel && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-8 p-6 rounded-md bg-zinc-800 border border-zinc-700"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-zinc-100 font-display font-semibold">
                  {correlationsData !== null && 'Correlations'}
                  {systemicRiskData !== null && !systemicRiskData.error && 'Systemic Risk'}
                  {systemicRiskData?.error && 'Systemic Risk Error'}
                  {contagionData !== null && !contagionData.error && 'Contagion Analysis'}
                  {contagionData?.error && 'Contagion Error'}
                  {showIndicators && 'Indicators'}
                </h2>
                <button
                  onClick={closePanels}
                  className="p-1 rounded text-zinc-400 hover:text-zinc-100"
                  aria-label="Close"
                >
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>

              {correlationsData !== null && selectedInstitution && (
                <div className="space-y-4">
                  <p className="text-zinc-300 text-sm">
                    Institution: <span className="font-mono text-zinc-100">{selectedInstitution.sro_id}</span> — {selectedInstitution.name}
                  </p>
                  {correlationsData.correlations.length === 0 ? (
                    <p className="text-zinc-400 text-sm">No correlations registered.</p>
                  ) : (
                    <ul className="space-y-2 text-sm">
                      {correlationsData.correlations.map((c) => (
                        <li key={c.id} className="flex items-center gap-2 font-mono text-xs text-zinc-300">
                          <LinkIcon className="w-3 h-3 flex-shrink-0" />
                          {c.institution_a_id === selectedInstitution.id ? c.institution_b_id : c.institution_a_id} — corr: {c.correlation_coefficient?.toFixed(2)} type: {c.relationship_type}
                          {c.exposure_amount != null && ` exposure: ${c.exposure_amount}`}
                          {c.contagion_probability != null && ` contagion: ${(c.contagion_probability * 100).toFixed(0)}%`}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {systemicRiskData !== null && !systemicRiskData.error && (
                <div className="space-y-2 text-sm">
                  <p className="text-zinc-200">
                    <span className="font-medium">{systemicRiskData.name}</span>
                    {systemicRiskData.sro_id && (
                      <span className="text-zinc-400 font-mono ml-2">({systemicRiskData.sro_id})</span>
                    )}
                  </p>
                  <p className="text-zinc-300">
                    Systemic risk score: <strong className="text-zinc-100">{systemicRiskData.systemic_risk_score?.toFixed(1) ?? '—'}</strong>
                    {systemicRiskData.risk_level && (
                      <span className={`ml-2 px-2 py-0.5 rounded text-xs ${
                        systemicRiskData.risk_level === 'critical' ? 'bg-red-500/20 text-red-300' :
                        systemicRiskData.risk_level === 'high' ? 'bg-amber-500/20 text-amber-300' :
                        'bg-zinc-700 text-zinc-300'
                      }`}>
                        {systemicRiskData.risk_level}
                      </span>
                    )}
                  </p>
                  {systemicRiskData.components && Object.keys(systemicRiskData.components).length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                      {Object.entries(systemicRiskData.components).map(([k, v]) => (
                        <div key={k} className="p-2 rounded bg-zinc-800">
                          <span className="text-zinc-500 text-xs">{k.replace(/_/g, ' ')}</span>
                          <p className="text-zinc-100">{typeof v === 'number' ? v.toFixed(1) : String(v)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-zinc-500 text-xs mt-2">
                    Correlations: {systemicRiskData.correlations_count ?? 0} • Under stress: {systemicRiskData.under_stress ? 'Yes' : 'No'}
                  </p>
                </div>
              )}

              {systemicRiskData?.error && (
                <p className="text-amber-400/80 text-sm">{systemicRiskData.error}</p>
              )}

              {contagionData !== null && !contagionData.error && (
                <div className="space-y-4">
                  <p className="text-zinc-200">
                    <span className="font-medium">{contagionData.source_institution?.name ?? contagionData.name}</span>
                    <span className="text-zinc-400 font-mono ml-2">({contagionData.source_institution?.sro_id ?? contagionData.sro_id ?? '—'})</span>
                  </p>
                  <p className="text-zinc-300">
                    Total exposure at risk: {contagionData.total_exposure_at_risk != null ? contagionData.total_exposure_at_risk.toLocaleString() : '—'}
                  </p>
                  {contagionData.affected_institutions && contagionData.affected_institutions.length > 0 ? (
                    <ul className="space-y-1 text-sm text-zinc-400">
                      {contagionData.affected_institutions.slice(0, 15).map((a, i) => (
                        <li key={`affected-${a.institution_id ?? 'unknown'}-${i}`} className="font-mono text-xs">
                          depth {a.depth}: {a.name ?? a.institution_id} {a.sro_id ? `(${a.sro_id})` : ''} {a.exposure != null ? ` exposure: ${a.exposure}` : ''}
                        </li>
                      ))}
                      {contagionData.affected_institutions.length > 15 && (
                        <li>… and {contagionData.affected_institutions.length - 15} more</li>
                      )}
                    </ul>
                  ) : (
                    <p className="text-zinc-400 text-sm">No affected institutions in contagion path.</p>
                  )}
                </div>
              )}

              {contagionData?.error && (
                <p className="text-amber-400/80 text-sm">{contagionData.error}</p>
              )}

              {showIndicators && (
                <div className="space-y-4">
                  {breachedIndicators.length > 0 && (
                    <div>
                      <h3 className="text-amber-400/80 text-sm font-medium mb-2 flex items-center gap-2">
                        <ExclamationTriangleIcon className="w-4 h-4" /> Breached ({breachedIndicators.length})
                      </h3>
                      <ul className="space-y-1 text-sm">
                        {breachedIndicators.map((i) => (
                          <li key={i.id} className="text-amber-200/90">
                            {i.indicator_name}: {i.value} {i.scope ? `(${i.scope})` : ''} — {i.observation_date ? new Date(i.observation_date).toLocaleDateString() : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <div>
                    <h3 className="text-zinc-200 text-sm font-medium mb-2">Latest indicators</h3>
                    {indicators.length === 0 ? (
                      <p className="text-zinc-400 text-sm">No indicators recorded.</p>
                    ) : (
                      <ul className="space-y-1 text-sm text-zinc-400">
                        {indicators.slice(0, 20).map((i) => (
                          <li key={i.id}>
                            {i.indicator_name}: {i.value} {i.change_pct != null ? `(${i.change_pct >= 0 ? '+' : ''}${i.change_pct.toFixed(1)}%)` : ''} — {i.scope} {i.is_breached && <span className="text-amber-400/80">breached</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {registerModalOpen && (
            <RegisterInstitutionModal
              typeOptions={typeOptions}
              importanceOptions={importanceOptions}
              onClose={() => {
                setRegisterModalOpen(false)
                setFormError(null)
              }}
              onSubmit={handleRegisterSubmit}
              submitting={submitting}
              formError={formError}
            />
          )}

          {/* API docs */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="mt-8 p-6 bg-zinc-800 rounded-md border border-zinc-700"
          >
            <h3 className="text-zinc-100 font-display font-semibold mb-4">API Endpoints</h3>
            <div className="space-y-3 font-mono text-sm text-zinc-300">
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-zinc-700 text-zinc-400 rounded text-xs">POST</span>
                <span>{module.apiPrefix}/institutions</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded text-xs">GET</span>
                <span>{module.apiPrefix}/institutions</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded text-xs">GET</span>
                <span>{module.apiPrefix}/institutions/&#123;id&#125;/correlations</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded text-xs">GET</span>
                <span>{module.apiPrefix}/institutions/&#123;id&#125;/systemic-risk</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded text-xs">GET</span>
                <span>{module.apiPrefix}/institutions/&#123;id&#125;/contagion</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-zinc-700 text-zinc-400 rounded text-xs">POST</span>
                <span>{module.apiPrefix}/correlations</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded text-xs">GET</span>
                <span>{module.apiPrefix}/indicators</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded text-xs">GET</span>
                <span>{module.apiPrefix}/indicators/breached</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AccessGate>
  )
}

function RegisterInstitutionModal({
  typeOptions,
  importanceOptions,
  onClose,
  onSubmit,
  submitting,
  formError,
}: {
  typeOptions: Array<{ value: string; name: string }>
  importanceOptions: Array<{ value: string; name: string; description?: string }>
  onClose: () => void
  onSubmit: (data: {
    name: string
    institution_type?: string
    systemic_importance?: string
    country_code?: string
    headquarters_city?: string
    description?: string
    total_assets?: number
    market_cap?: number
    regulator?: string
    lei_code?: string
  }) => Promise<void>
  submitting: boolean
  formError: string | null
}) {
  const [name, setName] = useState('')
  const [institution_type, setInstitutionType] = useState('other')
  const [systemic_importance, setSystemicImportance] = useState('low')
  const [country_code, setCountryCode] = useState('DE')
  const [headquarters_city, setHeadquartersCity] = useState('')
  const [description, setDescription] = useState('')
  const [total_assets, setTotalAssets] = useState<number | ''>('')
  const [market_cap, setMarketCap] = useState<number | ''>('')
  const [regulator, setRegulator] = useState('')
  const [lei_code, setLeiCode] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      name: name.trim() || 'Unnamed',
      institution_type,
      systemic_importance,
      country_code: country_code || 'DE',
      headquarters_city: headquarters_city || undefined,
      description: description || undefined,
      total_assets: total_assets === '' ? undefined : Number(total_assets),
      market_cap: market_cap === '' ? undefined : Number(market_cap),
      regulator: regulator || undefined,
      lei_code: lei_code || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-md shadow-xl max-w-lg w-full max-h-[90vh] overflow-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 flex items-center justify-between border-b border-zinc-700">
          <h3 className="text-zinc-100 font-display font-semibold">Register Institution</h3>
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
              placeholder="e.g. Deutsche Bank AG"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-300 text-sm mb-1">Type</label>
              <select
                value={institution_type}
                onChange={(e) => setInstitutionType(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100"
              >
                {typeOptions.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.name}
                  </option>
                ))}
                {typeOptions.length === 0 && (
                  <>
                    <option value="bank">Bank</option>
                    <option value="investment_bank">Investment Bank</option>
                    <option value="insurance">Insurance</option>
                    <option value="hedge_fund">Hedge Fund</option>
                    <option value="other">Other</option>
                  </>
                )}
              </select>
            </div>
            <div>
              <label className="block text-zinc-300 text-sm mb-1">Systemic importance</label>
              <select
                value={systemic_importance}
                onChange={(e) => setSystemicImportance(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100"
              >
                {importanceOptions.map((l) => (
                  <option key={l.value} value={l.value}>
                    {l.name}
                  </option>
                ))}
                {importanceOptions.length === 0 && (
                  <>
                    <option value="gsib">GSIB</option>
                    <option value="dsib">DSIB</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                  </>
                )}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-zinc-300 text-sm mb-1">Country code</label>
            <input
              type="text"
              value={country_code}
              onChange={(e) => setCountryCode(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500"
              placeholder="DE"
              maxLength={2}
            />
          </div>
          <div>
            <label className="block text-zinc-300 text-sm mb-1">Headquarters city</label>
            <input
              type="text"
              value={headquarters_city}
              onChange={(e) => setHeadquartersCity(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500"
              placeholder="Optional"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-300 text-sm mb-1">Total assets</label>
              <input
                type="number"
                step="any"
                value={total_assets}
                onChange={(e) => setTotalAssets(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-zinc-300 text-sm mb-1">Market cap</label>
              <input
                type="number"
                step="any"
                value={market_cap}
                onChange={(e) => setMarketCap(e.target.value === '' ? '' : Number(e.target.value))}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500"
                placeholder="Optional"
              />
            </div>
          </div>
          <div>
            <label className="block text-zinc-300 text-sm mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 resize-none"
              placeholder="Optional"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-zinc-300 text-sm mb-1">Regulator</label>
              <input
                type="text"
                value={regulator}
                onChange={(e) => setRegulator(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-zinc-300 text-sm mb-1">LEI code</label>
              <input
                type="text"
                value={lei_code}
                onChange={(e) => setLeiCode(e.target.value)}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500"
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 rounded-md border border-zinc-700 text-zinc-300 hover:bg-zinc-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 rounded-md bg-zinc-700 hover:bg-zinc-600 text-zinc-100 disabled:opacity-50"
            >
              {submitting ? 'Registering…' : 'Register'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
