/**
 * SRS Module - Sovereign Risk Shield
 *
 * Sovereign funds, resource deposits, indicators, scenarios (pilot).
 */
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon,
  PlusIcon,
  XMarkIcon,
  ArrowPathIcon,
  BanknotesIcon,
  PlayIcon,
} from '@heroicons/react/24/outline'
import { getModuleById } from '../../lib/modules'
import AccessGate from '../../components/modules/AccessGate'
import AlertFeedPanel from '../../components/AlertFeedPanel'
import {
  listFunds,
  createFund,
  listDeposits,
  createDeposit,
  getIndicators,
  runScenario,
  getSRSStatus,
  seedSRS,
} from '../../services/srsApi'
import type { SovereignFund, ResourceDeposit, SRSIndicator, SRSStatus, ScenarioRunResult } from '../../services/srsApi'

export default function SRSModule() {
  const navigate = useNavigate()
  const module = getModuleById('srs')
  const [funds, setFunds] = useState<SovereignFund[]>([])
  const [deposits, setDeposits] = useState<ResourceDeposit[]>([])
  const [indicators, setIndicators] = useState<SRSIndicator[]>([])
  const [status, setStatus] = useState<SRSStatus | null>(null)
  const [scenarioResult, setScenarioResult] = useState<ScenarioRunResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [fundModalOpen, setFundModalOpen] = useState(false)
  const [depositModalOpen, setDepositModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'funds' | 'deposits' | 'indicators' | 'scenarios'>('funds')
  const [seeding, setSeeding] = useState(false)

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [fundsRes, depositsRes, indicatorsRes, statusRes] = await Promise.all([
        listFunds({ limit: 200 }),
        listDeposits({ limit: 200 }),
        getIndicators({ limit: 50 }),
        getSRSStatus(),
      ])
      setFunds(fundsRes)
      setDeposits(depositsRes)
      setIndicators(indicatorsRes)
      setStatus(statusRes)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load SRS data')
      setFunds([])
      setDeposits([])
      setIndicators([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const handleCreateFund = async (data: {
    name: string
    country_code: string
    description?: string
    total_assets_usd?: number
    currency?: string
    status?: string
    established_year?: number
    mandate?: string
  }) => {
    setSubmitting(true)
    setFormError(null)
    try {
      await createFund(data)
      setFundModalOpen(false)
      await loadAll()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create fund')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateDeposit = async (data: {
    name: string
    resource_type: string
    country_code: string
    sovereign_fund_id?: string
    estimated_value_usd?: number
    latitude?: number
    longitude?: number
    description?: string
    extraction_horizon_years?: number
  }) => {
    setSubmitting(true)
    setFormError(null)
    try {
      await createDeposit(data)
      setDepositModalOpen(false)
      await loadAll()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create deposit')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLoadDemoData = async () => {
    setSeeding(true)
    setError(null)
    try {
      await seedSRS()
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load demo data')
    } finally {
      setSeeding(false)
    }
  }

  const handleRunScenario = async () => {
    setScenarioResult(null)
    try {
      const res = await runScenario({
        scenario_type: 'sovereign_solvency_stress',
        country_code: funds[0]?.country_code || undefined,
        fund_id: funds[0]?.id || undefined,
      })
      setScenarioResult(res)
    } catch (e) {
      setScenarioResult({
        scenario_type: 'sovereign_solvency_stress',
        status: 'error',
        result: { message: e instanceof Error ? e.message : 'Scenario failed' },
        run_at: new Date().toISOString(),
      })
    }
  }

  if (!module) return null
  return (
    <AccessGate module={module}>
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        {/* Header */}
        <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900/95 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => navigate('/modules')}
                className="p-2 rounded-md hover:bg-zinc-800 transition-colors"
                title="Back to Strategic Modules"
              >
                <ArrowLeftIcon className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                  <BanknotesIcon className="w-6 h-6 text-zinc-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-semibold text-zinc-100">{module.fullName}</h1>
                    <span className="text-zinc-500 text-xs">Phase {module.phase}</span>
                    <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 text-[10px] rounded border border-zinc-700">{module.priority}</span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">{module.description}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleLoadDemoData}
                disabled={seeding || loading}
                className="flex items-center gap-2 px-3 py-2 rounded-md bg-zinc-700 text-zinc-200 border border-zinc-600 hover:bg-zinc-600 text-sm disabled:opacity-50"
                title="Load demo funds and deposits"
              >
                {seeding ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : null}
                {seeding ? 'Loading…' : 'Load demo data'}
              </button>
              <button
                onClick={() => loadAll()}
                disabled={loading}
                className="flex items-center gap-2 px-3 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm disabled:opacity-50"
              >
                <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              {status && (
                <span className="text-xs text-zinc-500">
                  {status.funds_count} funds · {status.deposits_count} deposits
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Tabs */}
        <div className="border-b border-zinc-800 px-6">
          <nav className="flex gap-1">
            {(['funds', 'deposits', 'indicators', 'scenarios'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium rounded-t-md transition-colors ${
                  activeTab === tab ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        <main className="p-6 w-full max-w-full">
          <AlertFeedPanel moduleFilter="srs" title="SRS Sentinel Alerts" compact />

          {error && (
            <div className="mb-4 p-4 rounded-md bg-red-500/10 border border-red-500/30 text-red-400/80 text-sm">
              {error}
            </div>
          )}

          {loading && (
            <div className="flex items-center justify-center py-12">
              <ArrowPathIcon className="w-8 h-8 text-zinc-500 animate-spin" />
            </div>
          )}

          {!loading && activeTab === 'funds' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-base font-semibold text-zinc-200">Sovereign Funds</h2>
                <button
                  onClick={() => setFundModalOpen(true)}
className="flex items-center gap-2 px-3 py-2 rounded-md bg-zinc-700 text-zinc-200 border border-zinc-600 hover:bg-zinc-600 text-sm"
                >
                <PlusIcon className="w-4 h-4" />
                Add fund
                </button>
              </div>
              {funds.length === 0 ? (
                <p className="text-zinc-500 text-sm py-8">No sovereign funds yet. Create one to get started.</p>
              ) : (
                <div className="rounded-md border border-zinc-800 overflow-x-auto">
                  <table className="w-full min-w-full text-sm">
                    <thead className="bg-zinc-800/50">
                      <tr>
                        <th className="text-left py-3 px-4">SRS ID</th>
                        <th className="text-left py-3 px-4">Name</th>
                        <th className="text-left py-3 px-4">Country</th>
                        <th className="text-left py-3 px-4">Assets (USD)</th>
                        <th className="text-left py-3 px-4">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {funds.map((f) => (
                        <tr key={f.id} className="border-t border-zinc-800 hover:bg-zinc-800/30">
                          <td className="py-3 px-4 font-mono text-zinc-400">{f.srs_id}</td>
                          <td className="py-3 px-4">{f.name}</td>
                          <td className="py-3 px-4">{f.country_code}</td>
                          <td className="py-3 px-4">
                            {f.total_assets_usd != null ? `$${(f.total_assets_usd / 1e9).toFixed(1)}B` : '—'}
                          </td>
                          <td className="py-3 px-4">{f.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {!loading && activeTab === 'deposits' && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center">
                <h2 className="text-base font-semibold text-zinc-200">Resource Deposits</h2>
                <button
                  onClick={() => setDepositModalOpen(true)}
                  className="flex items-center gap-2 px-3 py-2 rounded-md bg-zinc-700 text-zinc-200 border border-zinc-600 hover:bg-zinc-600 text-sm"
                >
                  <PlusIcon className="w-4 h-4" />
                  Add deposit
                </button>
              </div>
              {deposits.length === 0 ? (
                <p className="text-zinc-500 text-sm py-8">No resource deposits yet.</p>
              ) : (
                <div className="rounded-md border border-zinc-800 overflow-x-auto">
                  <table className="w-full min-w-full text-sm">
                    <thead className="bg-zinc-800/50">
                      <tr>
                        <th className="text-left py-3 px-4">SRS ID</th>
                        <th className="text-left py-3 px-4">Name</th>
                        <th className="text-left py-3 px-4">Type</th>
                        <th className="text-left py-3 px-4">Country</th>
                        <th className="text-left py-3 px-4">Est. value (USD)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {deposits.map((d) => (
                        <tr key={d.id} className="border-t border-zinc-800 hover:bg-zinc-800/30">
                          <td className="py-3 px-4 font-mono text-zinc-400">{d.srs_id}</td>
                          <td className="py-3 px-4">{d.name}</td>
                          <td className="py-3 px-4">{d.resource_type}</td>
                          <td className="py-3 px-4">{d.country_code}</td>
                          <td className="py-3 px-4">
                            {d.estimated_value_usd != null ? `$${(d.estimated_value_usd / 1e9).toFixed(2)}B` : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {!loading && activeTab === 'indicators' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <h2 className="text-base font-semibold text-zinc-200">Sovereign Risk Indicators</h2>
              {indicators.length === 0 ? (
                <p className="text-zinc-500 text-sm py-8">No indicators in database. Run scenarios or ingest data to populate.</p>
              ) : (
                <div className="rounded-md border border-zinc-800 overflow-x-auto">
                  <table className="w-full min-w-full text-sm">
                    <thead className="bg-zinc-800/50">
                      <tr>
                        <th className="text-left py-3 px-4">Country</th>
                        <th className="text-left py-3 px-4">Type</th>
                        <th className="text-left py-3 px-4">Value</th>
                        <th className="text-left py-3 px-4">Unit</th>
                        <th className="text-left py-3 px-4">Measured</th>
                      </tr>
                    </thead>
                    <tbody>
                      {indicators.map((i) => (
                        <tr key={i.id} className="border-t border-zinc-800">
                          <td className="py-3 px-4">{i.country_code}</td>
                          <td className="py-3 px-4">{i.indicator_type}</td>
                          <td className="py-3 px-4">{i.value}</td>
                          <td className="py-3 px-4">{i.unit ?? '—'}</td>
                          <td className="py-3 px-4 text-zinc-500">{i.measured_at ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {!loading && activeTab === 'scenarios' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="mb-3 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-xs">
                Pilot / placeholder — not for regulatory use.
              </div>
              <h2 className="text-base font-semibold text-zinc-200">Run scenario</h2>
              <p className="text-zinc-500 text-sm">
                Sovereign solvency stress: real funds/deposits, stress shock, solvency and regime indices (decision-support only).
              </p>
              <button
                onClick={handleRunScenario}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-700 text-zinc-200 border border-zinc-600 hover:bg-zinc-600"
              >
                <PlayIcon className="w-4 h-4" />
                Run sovereign_solvency_stress
              </button>
              {scenarioResult && (
                <div className="mt-4 p-4 rounded-md border border-zinc-700 bg-zinc-800/50 text-sm">
                  <p className="text-zinc-500 text-xs mb-2">Scenario uses real fund/deposit data and stress shock. Decision-support only, not for regulatory use.</p>
                  <pre className="whitespace-pre-wrap text-zinc-300">{JSON.stringify(scenarioResult, null, 2)}</pre>
                </div>
              )}
            </motion.div>
          )}
        </main>

        {/* Create Fund Modal */}
        {fundModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-zinc-900 border border-zinc-700 rounded-md shadow-xl w-full w-[90vw] max-w-6xl p-6 my-8 text-zinc-100"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-zinc-100">Add sovereign fund</h3>
                <button onClick={() => setFundModalOpen(false)} className="p-2 rounded-md hover:bg-zinc-800">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const form = e.target as HTMLFormElement
                  handleCreateFund({
                    name: (form.querySelector('[name=name]') as HTMLInputElement).value,
                    country_code: (form.querySelector('[name=country_code]') as HTMLInputElement).value.toUpperCase().slice(0, 2),
                    description: (form.querySelector('[name=description]') as HTMLInputElement).value || undefined,
                    total_assets_usd: parseFloat((form.querySelector('[name=total_assets_usd]') as HTMLInputElement).value) || undefined,
                    currency: (form.querySelector('[name=currency]') as HTMLInputElement).value || 'USD',
                    status: (form.querySelector('[name=status]') as HTMLSelectElement).value || 'active',
                  })
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Name *</label>
                  <input name="name" required className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100" placeholder="e.g. Norway GPFG" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Country code *</label>
                  <input name="country_code" required maxLength={2} className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100 uppercase" placeholder="NO" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Total assets (USD)</label>
                  <input name="total_assets_usd" type="number" step="1e9" className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100" placeholder="1500000000000" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Currency</label>
                  <input name="currency" defaultValue="USD" className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Status</label>
                  <select name="status" className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100">
                    <option value="active">active</option>
                    <option value="frozen">frozen</option>
                    <option value="planned">planned</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Description</label>
                  <textarea name="description" rows={2} className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100" />
                </div>
                {formError && <p className="text-red-400/80 text-sm">{formError}</p>}
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setFundModalOpen(false)} className="px-4 py-2 rounded-md bg-zinc-700 text-zinc-200 hover:bg-zinc-600">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 rounded-md bg-zinc-700 text-zinc-200 border border-zinc-600 hover:bg-zinc-600 disabled:opacity-50">
                    {submitting ? 'Creating…' : 'Create'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {/* Create Deposit Modal */}
        {depositModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-zinc-900 border border-zinc-700 rounded-md shadow-xl w-full w-[90vw] max-w-6xl p-6 my-8 text-zinc-100"
            >
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-zinc-100">Add resource deposit</h3>
                <button onClick={() => setDepositModalOpen(false)} className="p-2 rounded-md hover:bg-zinc-800">
                  <XMarkIcon className="w-5 h-5" />
                </button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const form = e.target as HTMLFormElement
                  handleCreateDeposit({
                    name: (form.querySelector('[name=name]') as HTMLInputElement).value,
                    resource_type: (form.querySelector('[name=resource_type]') as HTMLInputElement).value,
                    country_code: (form.querySelector('[name=country_code]') as HTMLInputElement).value.toUpperCase().slice(0, 2),
                    sovereign_fund_id: (form.querySelector('[name=sovereign_fund_id]') as HTMLSelectElement).value || undefined,
                    estimated_value_usd: parseFloat((form.querySelector('[name=estimated_value_usd]') as HTMLInputElement).value) || undefined,
                    description: (form.querySelector('[name=description]') as HTMLInputElement).value || undefined,
                  })
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Name *</label>
                  <input name="name" required className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100" placeholder="e.g. North Sea Oil" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Resource type *</label>
                  <input name="resource_type" required className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100" placeholder="oil, gas, minerals" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Country code *</label>
                  <input name="country_code" required maxLength={2} className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100 uppercase" placeholder="NO" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Sovereign fund</label>
                  <select name="sovereign_fund_id" className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100">
                    <option value="">— None —</option>
                    {funds.map((f) => (
                      <option key={f.id} value={f.id}>{f.name} ({f.srs_id})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Estimated value (USD)</label>
                  <input name="estimated_value_usd" type="number" step="1e9" className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100" placeholder="500000000000" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Description</label>
                  <input name="description" className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100" />
                </div>
                {formError && <p className="text-red-400/80 text-sm">{formError}</p>}
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setDepositModalOpen(false)} className="px-4 py-2 rounded-md bg-zinc-700 text-zinc-200 hover:bg-zinc-600">
                    Cancel
                  </button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 rounded-md bg-zinc-700 text-zinc-200 border border-zinc-600 hover:bg-zinc-600 disabled:opacity-50">
                    {submitting ? 'Creating…' : 'Create'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </AccessGate>
  )
}
