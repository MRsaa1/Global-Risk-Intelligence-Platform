/**
 * FST Module - Financial System Stress Test Engine
 *
 * Banking/derivatives scenarios, run scenario, regulatory report (Basel/Fed/ECB).
 */
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ChartBarIcon,
  PlayIcon,
  DocumentTextIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline'
import { getModuleById } from '../../lib/modules'
import AccessGate from '../../components/modules/AccessGate'
import { listScenarios, runScenario, listRuns, getFSTStatus } from '../../services/fstApi'
import type { FSTScenario, FSTRunSummary, FSTStatus } from '../../services/fstApi'

export default function FSTModule() {
  const navigate = useNavigate()
  const module = getModuleById('fst')
  const [scenarios, setScenarios] = useState<FSTScenario[]>([])
  const [runs, setRuns] = useState<FSTRunSummary[]>([])
  const [status, setStatus] = useState<FSTStatus | null>(null)
  const [runResult, setRunResult] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [running, setRunning] = useState(false)
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>('')
  const [regulatoryFormat, setRegulatoryFormat] = useState<string>('basel')

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [scenariosRes, runsRes, statusRes] = await Promise.all([
        listScenarios(),
        listRuns({ limit: 50 }),
        getFSTStatus(),
      ])
      setScenarios(scenariosRes)
      setRuns(runsRes)
      setStatus(statusRes)
      if (scenariosRes.length && !selectedScenarioId) setSelectedScenarioId(scenariosRes[0].id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load FST data')
      setScenarios([])
      setRuns([])
    } finally {
      setLoading(false)
    }
  }, [selectedScenarioId])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const handleRunScenario = async () => {
    if (!selectedScenarioId) return
    setRunning(true)
    setRunResult(null)
    try {
      const res = await runScenario({ scenario_id: selectedScenarioId, regulatory_format: regulatoryFormat })
      setRunResult(res as unknown as Record<string, unknown>)
    } catch (e) {
      setRunResult({ error: e instanceof Error ? e.message : 'Run failed' })
    } finally {
      setRunning(false)
      loadAll()
    }
  }

  const handleDownloadRegulatoryPackage = () => {
    if (!runResult) return
    const pkg = runResult.regulatory_package ?? runResult
    const disclaimer = {
      _disclaimer: 'For internal review only; not for regulatory submission without sign-off.',
      _exported_at: new Date().toISOString(),
      _module: 'FST',
    }
    const blob = new Blob([JSON.stringify({ ...disclaimer, regulatory_package: pkg, report: runResult.report }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `fst-regulatory-package-${runResult.fst_run_id ?? runResult.scenario_id ?? 'run'}-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (!module) return null
  return (
    <AccessGate module={module}>
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900/95 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/modules')} className="p-2 rounded-md hover:bg-zinc-800 transition-colors" title="Back to Strategic Modules">
                <ArrowLeftIcon className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                  <ChartBarIcon className="w-6 h-6 text-zinc-300" />
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
              <button onClick={() => loadAll()} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm disabled:opacity-50">
                <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              {status && <span className="text-xs text-zinc-500">{status.scenarios_count} scenarios</span>}
            </div>
          </div>
        </header>

        <main className="p-6 w-full max-w-full">
          {error && (
            <div className="mb-4 p-4 rounded-md bg-red-500/10 border border-red-500/30 text-red-400/80 text-sm">{error}</div>
          )}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <ArrowPathIcon className="w-8 h-8 text-zinc-500 animate-spin" />
            </div>
          )}

          {!loading && (
            <>
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                <div className="mb-3 px-3 py-2 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-200/90 text-xs">
                  Draft / pilot — not for regulatory submission without internal review.
                </div>
                <h2 className="text-base font-semibold text-zinc-200">Scenarios (banking + derivatives + physical shock)</h2>
                <div className="rounded-md border border-zinc-800 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-zinc-800/50">
                      <tr>
                        <th className="text-left py-3 px-4">ID</th>
                        <th className="text-left py-3 px-4">Name</th>
                        <th className="text-left py-3 px-4">Description</th>
                        <th className="text-left py-3 px-4">Physical shock</th>
                        <th className="text-left py-3 px-4">Regulatory format</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scenarios.map((s) => (
                        <tr key={s.id} className="border-t border-zinc-800 hover:bg-zinc-800/30">
                          <td className="py-3 px-4 font-mono text-zinc-400">{s.id}</td>
                          <td className="py-3 px-4">{s.name}</td>
                          <td className="py-3 px-4 text-zinc-400">{s.description}</td>
                          <td className="py-3 px-4">{s.physical_shock ?? '—'}</td>
                          <td className="py-3 px-4">{s.regulatory_format ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex items-center gap-4 pt-4 flex-wrap">
                  <label className="text-sm text-zinc-400">Run scenario:</label>
                  <select
                    value={selectedScenarioId}
                    onChange={(e) => setSelectedScenarioId(e.target.value)}
                    className="px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100"
                  >
                    {scenarios.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </select>
                  <label className="text-sm text-zinc-400">Regulatory format:</label>
                  <select
                    value={regulatoryFormat}
                    onChange={(e) => setRegulatoryFormat(e.target.value)}
                    className="px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100"
                  >
                    <option value="basel">Basel III/IV</option>
                    <option value="ecb_srep">ECB SREP</option>
                    <option value="fed_ccar">Fed CCAR / FR Y-14A</option>
                    <option value="solvency_ii">Solvency II</option>
                    <option value="tcfd">TCFD</option>
                    <option value="issb">ISSB</option>
                  </select>
                  <button
                    onClick={handleRunScenario}
                    disabled={running || !selectedScenarioId}
                    className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-700 text-zinc-200 border border-zinc-600 hover:bg-zinc-600 disabled:opacity-50"
                  >
                    <PlayIcon className="w-4 h-4" />
                    {running ? 'Running…' : 'Run'}
                  </button>
                </div>

                {runResult && (
                  <div className="mt-4 p-4 rounded-md border border-zinc-700 bg-zinc-800/50 text-sm">
                    <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                      <h3 className="flex items-center gap-2 text-zinc-200">
                        <DocumentTextIcon className="w-4 h-4" />
                        Report / result
                      </h3>
                      <p className="text-amber-200/80 text-xs w-full sm:w-auto order-last sm:order-none">Draft / pilot — not for regulatory submission without internal review.</p>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          type="button"
                          onClick={handleDownloadRegulatoryPackage}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-700 text-zinc-200 border border-zinc-600 hover:bg-zinc-600 text-xs"
                          title="Download JSON regulatory package"
                        >
                          <ArrowDownTrayIcon className="w-4 h-4" />
                          JSON
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const text = JSON.stringify(runResult, null, 2)
                            const blob = new Blob([`REGULATORY REPORT\n${'='.repeat(60)}\nFormat: ${regulatoryFormat.toUpperCase()}\nGenerated: ${new Date().toISOString()}\nDISCLAIMER: For internal review only.\n${'='.repeat(60)}\n\n${text}`], { type: 'text/plain' })
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `fst-report-${regulatoryFormat}-${Date.now()}.txt`
                            a.click()
                            URL.revokeObjectURL(url)
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-700 text-zinc-200 border border-zinc-600 hover:bg-zinc-600 text-xs"
                        >
                          <DocumentTextIcon className="w-4 h-4" />
                          TXT Report
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const rows = Object.entries(runResult?.report as Record<string, unknown> ?? runResult ?? {})
                            const csv = 'Field,Value\n' + rows.map(([k, v]) => `"${k}","${JSON.stringify(v).replace(/"/g, '""')}"`).join('\n')
                            const blob = new Blob([csv], { type: 'text/csv' })
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement('a')
                            a.href = url
                            a.download = `fst-report-${regulatoryFormat}-${Date.now()}.csv`
                            a.click()
                            URL.revokeObjectURL(url)
                          }}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-700 text-zinc-200 border border-zinc-600 hover:bg-zinc-600 text-xs"
                        >
                          <ArrowDownTrayIcon className="w-4 h-4" />
                          CSV
                        </button>
                      </div>
                    </div>
                    <p className="text-zinc-500 text-xs mb-2">Format: <strong className="text-zinc-400">{regulatoryFormat.toUpperCase()}</strong> — For internal review only; not for regulatory submission without sign-off.</p>
                    <pre className="whitespace-pre-wrap text-zinc-300">{JSON.stringify(runResult, null, 2)}</pre>
                  </div>
                )}
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mt-8 space-y-4">
                <h2 className="text-base font-semibold text-zinc-200">Recent runs</h2>
                {runs.length === 0 ? (
                  <p className="text-zinc-500 text-sm">No runs yet. Run a scenario above.</p>
                ) : (
                  <div className="rounded-md border border-zinc-800 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-zinc-800/50">
                        <tr>
                          <th className="text-left py-3 px-4">FST ID</th>
                          <th className="text-left py-3 px-4">Scenario</th>
                          <th className="text-left py-3 px-4">Format</th>
                          <th className="text-left py-3 px-4">Run at</th>
                        </tr>
                      </thead>
                      <tbody>
                        {runs.map((r) => (
                          <tr key={r.id} className="border-t border-zinc-800">
                            <td className="py-3 px-4 font-mono text-zinc-400">{r.fst_id}</td>
                            <td className="py-3 px-4">{r.scenario_name ?? r.scenario_type}</td>
                            <td className="py-3 px-4">{r.regulatory_format ?? '—'}</td>
                            <td className="py-3 px-4 text-zinc-500">{r.run_at ?? '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </motion.div>
            </>
          )}
        </main>
      </div>
    </AccessGate>
  )
}
