/**
 * Regulatory Export & Audit panel — Disclosure Export, OSFI B-15 Readiness, GHG Inventory.
 * Embedded in Municipal Dashboard (Climate Adaptation & Local Resilience).
 */
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  DocumentArrowDownIcon,
  ShieldCheckIcon,
  ListBulletIcon,
  CheckCircleIcon,
  ClipboardDocumentListIcon,
  CloudIcon,
} from '@heroicons/react/24/outline'
import { auditExtApi } from '../lib/api'

interface Framework {
  id: string
  name: string
  sections: number
}

interface DisclosureSection {
  section_id: string
  section_name: string
  description: string
  evidence_count: number
  status: string
  auto_generated_content?: string
}

interface DisclosurePackage {
  framework: string
  framework_name: string
  organization: string
  reporting_period: string
  sections: DisclosureSection[]
  total_audit_evidence: number
  compliance_score: number
  chain_integrity?: { valid: boolean }
  export_format?: string
}

interface ReadinessQuestion {
  id: string
  category: string
  question: string
  weight: number
  reference?: string
  official_url?: string
}

interface ReadinessResult {
  score_pct: number
  total_questions: number
  gaps: Array<{ question_id: string; category: string; question: string; response: string; score: number }>
  ready: boolean
}

type RegulatorySubTab = 'disclosure' | 'readiness' | 'ghg'

export interface RegulatoryExportPanelProps {
  defaultOrganization?: string
  defaultReportingPeriod?: string
}

export default function RegulatoryExportPanel({ defaultOrganization = 'Organization', defaultReportingPeriod = '2025-01-01 to 2025-12-31' }: RegulatoryExportPanelProps) {
  const [tab, setTab] = useState<RegulatorySubTab>('disclosure')
  const [frameworks, setFrameworks] = useState<Framework[]>([])
  const [stats, setStats] = useState<Record<string, unknown> | null>(null)
  const [chainVerify, setChainVerify] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedFramework, setSelectedFramework] = useState('TCFD')
  const [organization, setOrganization] = useState(defaultOrganization)
  const [reportingPeriod, setReportingPeriod] = useState(defaultReportingPeriod)
  const [disclosure, setDisclosure] = useState<DisclosurePackage | null>(null)
  const [exporting, setExporting] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [readinessQuestions, setReadinessQuestions] = useState<ReadinessQuestion[]>([])
  const [readinessAnswers, setReadinessAnswers] = useState<Record<string, string>>({})
  const [readinessResult, setReadinessResult] = useState<ReadinessResult | null>(null)
  const [readinessSubmitting, setReadinessSubmitting] = useState(false)
  const [ghgOrg, setGhgOrg] = useState(defaultOrganization)
  const [ghgPeriod, setGhgPeriod] = useState(defaultReportingPeriod)
  const [ghgScope1, setGhgScope1] = useState(0)
  const [ghgScope2, setGhgScope2] = useState(0)
  const [ghgScope3, setGhgScope3] = useState<number | ''>('')
  const [ghgUnit, setGhgUnit] = useState('tCO2e')
  const [ghgSource, setGhgSource] = useState('')
  const [ghgList, setGhgList] = useState<Array<{ organization: string; reporting_period: string }>>([])
  const [ghgSaving, setGhgSaving] = useState(false)
  const [ghgMessage, setGhgMessage] = useState<string | null>(null)

  useEffect(() => {
    setOrganization(defaultOrganization)
    setReportingPeriod(defaultReportingPeriod)
    setGhgOrg(defaultOrganization)
    setGhgPeriod(defaultReportingPeriod)
  }, [defaultOrganization, defaultReportingPeriod])

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [fw, st, chain] = await Promise.all([
        auditExtApi.getFrameworks(),
        auditExtApi.getStats(),
        auditExtApi.verifyChain(),
      ])
      setFrameworks(Array.isArray(fw) ? fw : [])
      setStats(st as Record<string, unknown>)
      setChainVerify(chain as Record<string, unknown>)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const generateDisclosure = async () => {
    setExporting(true)
    setError(null)
    setDisclosure(null)
    try {
      const result = await auditExtApi.generateDisclosure(selectedFramework, organization, reportingPeriod)
      if ((result as { error?: string }).error) {
        setError((result as { error: string }).error)
      } else {
        setDisclosure(result as DisclosurePackage)
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  const downloadJson = () => {
    if (!disclosure) return
    const blob = new Blob([JSON.stringify(disclosure, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `disclosure-${disclosure.framework}-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const exportDisclosureAsPdf = async () => {
    setExportingPdf(true)
    setError(null)
    try {
      const blob = await auditExtApi.exportDisclosurePdf(selectedFramework, organization, reportingPeriod)
      const url = URL.createObjectURL(blob as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `disclosure_${selectedFramework}_${(reportingPeriod || 'report').replace(/\s+/g, '_').replace(/\//g, '-')}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'PDF export failed')
    } finally {
      setExportingPdf(false)
    }
  }

  const loadReadinessQuestions = async () => {
    try {
      const q = await auditExtApi.getReadinessQuestions()
      setReadinessQuestions(Array.isArray(q) ? q : [])
      if (!readinessResult) setReadinessAnswers({})
    } catch {
      setReadinessQuestions([])
    }
  }

  useEffect(() => {
    if (tab === 'readiness' && readinessQuestions.length === 0) loadReadinessQuestions()
  }, [tab])

  const loadGhgList = async () => {
    try {
      const list = await auditExtApi.listGhgInventory()
      setGhgList(Array.isArray(list) ? list : [])
    } catch {
      setGhgList([])
    }
  }

  useEffect(() => {
    if (tab === 'ghg') {
      setGhgOrg(organization)
      setGhgPeriod(reportingPeriod)
      loadGhgList()
    }
  }, [tab, organization, reportingPeriod])

  const loadGhgForCurrent = async (overrideOrg?: string, overridePeriod?: string) => {
    const org = overrideOrg ?? ghgOrg
    const period = overridePeriod ?? ghgPeriod
    setGhgMessage(null)
    setError(null)
    if (overrideOrg != null) setGhgOrg(overrideOrg)
    if (overridePeriod != null) setGhgPeriod(overridePeriod)
    try {
      const data = await auditExtApi.getGhgInventory(org, period)
      if ((data as { stored?: boolean }).stored) {
        const d = data as { scope_1_tonnes_co2e?: number; scope_2_tonnes_co2e?: number; scope_3_tonnes_co2e?: number; unit?: string; source?: string }
        setGhgScope1(d.scope_1_tonnes_co2e ?? 0)
        setGhgScope2(d.scope_2_tonnes_co2e ?? 0)
        setGhgScope3(d.scope_3_tonnes_co2e ?? '')
        setGhgUnit(d.unit ?? 'tCO2e')
        setGhgSource(d.source ?? '')
        setGhgMessage('Loaded.')
      } else {
        setGhgMessage('No stored inventory for this org/period.')
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Load failed')
    }
  }

  const saveGhg = async () => {
    setGhgSaving(true)
    setError(null)
    setGhgMessage(null)
    try {
      await auditExtApi.putGhgInventory({
        organization: ghgOrg,
        reporting_period: ghgPeriod,
        scope_1_tonnes_co2e: ghgScope1,
        scope_2_tonnes_co2e: ghgScope2,
        scope_3_tonnes_co2e: ghgScope3 === '' ? undefined : Number(ghgScope3),
        unit: ghgUnit,
        source: ghgSource || undefined,
      })
      setGhgMessage('Saved. Disclosure export will use this data for the same organization and period.')
      loadGhgList()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed')
    } finally {
      setGhgSaving(false)
    }
  }

  const submitReadiness = async () => {
    setReadinessSubmitting(true)
    setError(null)
    setReadinessResult(null)
    try {
      const result = await auditExtApi.submitReadiness(readinessAnswers)
      setReadinessResult(result as ReadinessResult)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Submit failed')
    } finally {
      setReadinessSubmitting(false)
    }
  }

  if (loading && frameworks.length === 0) {
    return <div className="p-6 text-zinc-500 text-sm">Loading Regulatory Export…</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm text-zinc-500">Disclosure packages (TCFD, OSFI B-15, EBA).</span>
        <button type="button" onClick={() => setTab('disclosure')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${tab === 'disclosure' ? 'bg-zinc-600 text-zinc-100' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>Disclosure Export</button>
        <button type="button" onClick={() => setTab('readiness')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${tab === 'readiness' ? 'bg-zinc-600 text-zinc-100' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>OSFI B-15 Readiness</button>
        <button type="button" onClick={() => setTab('ghg')} className={`px-3 py-1.5 rounded-md text-sm font-medium ${tab === 'ghg' ? 'bg-zinc-600 text-zinc-100' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}>GHG Inventory</button>
      </div>

      {error && <div className="p-4 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-200 text-sm">{error}</div>}

      {tab === 'disclosure' && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-md bg-zinc-800 border border-zinc-700 flex items-center gap-3">
              <ShieldCheckIcon className="w-6 h-6 text-emerald-500/80" />
              <div>
                <div className="text-zinc-500 text-xs">Chain Integrity</div>
                <div className="font-bold text-zinc-100">{(chainVerify as { valid?: boolean })?.valid ? 'Valid' : 'Unknown'}</div>
              </div>
            </div>
            <div className="p-4 rounded-md bg-zinc-800 border border-zinc-700">
              <div className="text-zinc-500 text-xs">Audit Entries</div>
              <div className="text-xl font-bold text-zinc-100">{(stats as { total_entries?: number })?.total_entries ?? 0}</div>
            </div>
            <div className="p-4 rounded-md bg-zinc-800 border border-zinc-700">
              <div className="text-zinc-500 text-xs">Frameworks</div>
              <div className="text-xl font-bold text-zinc-100">{frameworks.length}</div>
            </div>
          </div>
          <div className="p-5 rounded-md bg-zinc-800 border border-zinc-700">
            <h3 className="text-sm font-semibold text-zinc-100 mb-3 flex items-center gap-2"><ListBulletIcon className="w-4 h-4" />Generate Disclosure Package</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div>
                <label className="block text-zinc-500 text-xs mb-1">Framework</label>
                <select value={selectedFramework} onChange={(e) => setSelectedFramework(e.target.value)} className="w-full px-3 py-2 rounded-md bg-black/30 border border-zinc-700 text-zinc-100 text-sm">
                  {frameworks.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                  {frameworks.length === 0 && <option value="TCFD">TCFD</option>}
                </select>
              </div>
              <div>
                <label className="block text-zinc-500 text-xs mb-1">Organization</label>
                <input type="text" value={organization} onChange={(e) => setOrganization(e.target.value)} className="w-full px-3 py-2 rounded-md bg-black/30 border border-zinc-700 text-zinc-100 text-sm" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-zinc-500 text-xs mb-1">Reporting Period</label>
                <input type="text" value={reportingPeriod} onChange={(e) => setReportingPeriod(e.target.value)} placeholder="2025-01-01 to 2025-12-31" className="w-full px-3 py-2 rounded-md bg-black/30 border border-zinc-700 text-zinc-100 text-sm placeholder-zinc-600" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button onClick={generateDisclosure} disabled={exporting} className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-600 text-zinc-200 text-sm hover:bg-zinc-500 disabled:opacity-50">
                <DocumentArrowDownIcon className="w-4 h-4" />{exporting ? 'Generating…' : 'Generate & Export'}
              </button>
              <button onClick={exportDisclosureAsPdf} disabled={exportingPdf} className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-700 text-zinc-200 text-sm border border-zinc-600 hover:bg-zinc-600 disabled:opacity-50" title="Export disclosure as PDF (sections in regulatory order)">
                <DocumentArrowDownIcon className="w-4 h-4" />{exportingPdf ? 'Exporting PDF…' : 'Export disclosure as PDF'}
              </button>
            </div>
          </div>
          {disclosure && (
            <div className="p-5 rounded-md bg-zinc-800 border border-zinc-700">
              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2"><CheckCircleIcon className="w-4 h-4 text-emerald-500" />{disclosure.framework_name}</h3>
                <div className="flex gap-2">
                  <button onClick={downloadJson} className="px-3 py-1.5 rounded-md bg-zinc-700 text-zinc-400 text-sm border border-zinc-600 hover:bg-zinc-600">Download JSON</button>
                  <button onClick={exportDisclosureAsPdf} disabled={exportingPdf} className="px-3 py-1.5 rounded-md bg-zinc-700 text-zinc-400 text-sm border border-zinc-600 hover:bg-zinc-600 disabled:opacity-50">{exportingPdf ? 'Exporting…' : 'Export disclosure as PDF'}</button>
                </div>
              </div>
              <div className="text-zinc-400 text-xs mb-3">Compliance: {(disclosure.compliance_score * 100).toFixed(0)}% · Evidence: {disclosure.total_audit_evidence}</div>
              <div className="space-y-3">
                {disclosure.sections?.map((s) => (
                  <div key={s.section_id} className="p-3 rounded-md bg-black/20 border border-zinc-800">
                    <div className="flex justify-between items-center mb-1">
                      <span className="font-medium text-zinc-100 text-sm">{s.section_name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${s.status === 'populated' ? 'bg-emerald-500/20 text-emerald-400/80' : 'bg-amber-500/20 text-amber-400/80'}`}>{s.status}</span>
                    </div>
                    <p className="text-zinc-500 text-xs mb-1">{s.description}</p>
                    {s.auto_generated_content && <p className="text-zinc-300 text-xs">{s.auto_generated_content}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {tab === 'readiness' && (
        <div className="space-y-4">
          <div className="p-5 rounded-md bg-zinc-800 border border-zinc-700">
            <h3 className="text-sm font-semibold text-zinc-100 mb-2 flex items-center gap-2"><ClipboardDocumentListIcon className="w-4 h-4" />OSFI B-15 Readiness</h3>
            <p className="text-zinc-500 text-xs mb-2">Answer Yes / Partial / No. Submit for score and gaps.</p>
            <p className="text-zinc-500 text-xs mb-3">Official: <a href="https://www.osfi-bsif.gc.ca/en/guidance/guidance-library/climate-risk-management" target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-zinc-200 underline">OSFI Guideline B-15</a></p>
            {readinessQuestions.length === 0 ? <p className="text-zinc-500 text-sm">Loading questions…</p> : (
              <>
                <div className="space-y-3">
                  {readinessQuestions.map((q) => (
                    <div key={q.id} className="p-3 rounded-md bg-black/20 border border-zinc-700">
                      <div className="flex justify-between gap-2 mb-1">
                        <span className="text-xs text-zinc-500 uppercase">{q.category}</span>
                        {(q.reference || q.official_url) && <a href={q.official_url || '#'} target="_blank" rel="noopener noreferrer" className="text-xs text-zinc-400 hover:text-zinc-200 underline">{q.reference || 'OSFI B-15'}</a>}
                      </div>
                      <p className="text-zinc-200 text-sm mb-2">{q.question}</p>
                      <select value={readinessAnswers[q.id] ?? ''} onChange={(e) => setReadinessAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))} className="bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-sm text-zinc-100">
                        <option value="">— Select —</option>
                        <option value="yes">Yes</option>
                        <option value="partial">Partial</option>
                        <option value="no">No</option>
                      </select>
                    </div>
                  ))}
                  <button type="button" onClick={submitReadiness} disabled={readinessSubmitting} className="px-4 py-2 rounded-md bg-zinc-600 hover:bg-zinc-500 text-zinc-100 text-sm font-medium disabled:opacity-50">{readinessSubmitting ? 'Submitting…' : 'Submit & Get Score'}</button>
                </div>
                {readinessResult && (
                  <div className="mt-4 p-4 rounded-md bg-zinc-800 border border-zinc-700">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`text-2xl font-bold ${readinessResult.ready ? 'text-emerald-400/80' : 'text-amber-400/80'}`}>{readinessResult.score_pct}%</span>
                      <span className={`px-2 py-0.5 rounded text-sm ${readinessResult.ready ? 'bg-emerald-500/20 text-emerald-400/80' : 'bg-amber-500/20 text-amber-400/80'}`}>{readinessResult.ready ? 'Ready' : 'Gaps'}</span>
                    </div>
                    {readinessResult.gaps.length > 0 && (
                      <ul className="space-y-1 text-xs text-zinc-400">
                        {readinessResult.gaps.map((g) => <li key={g.question_id}>[{g.category}] {g.question} — {g.response}</li>)}
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'ghg' && (
        <div className="space-y-4">
          <div className="p-5 rounded-md bg-zinc-800 border border-zinc-700">
            <h3 className="text-sm font-semibold text-zinc-100 mb-2 flex items-center gap-2"><CloudIcon className="w-4 h-4" />GHG Inventory</h3>
            <p className="text-zinc-500 text-xs mb-3">Scope 1, 2, (optional) 3 for the same org/period as Disclosure.</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
              <div><label className="block text-zinc-500 text-xs mb-1">Organization</label><input type="text" value={ghgOrg} onChange={(e) => setGhgOrg(e.target.value)} className="w-full px-3 py-2 rounded-md bg-black/30 border border-zinc-700 text-zinc-100 text-sm" /></div>
              <div><label className="block text-zinc-500 text-xs mb-1">Reporting period</label><input type="text" value={ghgPeriod} onChange={(e) => setGhgPeriod(e.target.value)} placeholder="2025-01-01 to 2025-12-31" className="w-full px-3 py-2 rounded-md bg-black/30 border border-zinc-700 text-zinc-100 text-sm placeholder-zinc-600" /></div>
              <div><label className="block text-zinc-500 text-xs mb-1">Scope 1 (tCO2e)</label><input type="number" min={0} step={0.01} value={ghgScope1} onChange={(e) => setGhgScope1(Number(e.target.value))} className="w-full px-3 py-2 rounded-md bg-black/30 border border-zinc-700 text-zinc-100 text-sm" /></div>
              <div><label className="block text-zinc-500 text-xs mb-1">Scope 2 (tCO2e)</label><input type="number" min={0} step={0.01} value={ghgScope2} onChange={(e) => setGhgScope2(Number(e.target.value))} className="w-full px-3 py-2 rounded-md bg-black/30 border border-zinc-700 text-zinc-100 text-sm" /></div>
              <div><label className="block text-zinc-500 text-xs mb-1">Scope 3 (optional)</label><input type="number" min={0} step={0.01} value={ghgScope3} onChange={(e) => setGhgScope3(e.target.value === '' ? '' : Number(e.target.value))} placeholder="Optional" className="w-full px-3 py-2 rounded-md bg-black/30 border border-zinc-700 text-zinc-100 text-sm placeholder-zinc-600" /></div>
              <div><label className="block text-zinc-500 text-xs mb-1">Unit</label><input type="text" value={ghgUnit} onChange={(e) => setGhgUnit(e.target.value)} className="w-full px-3 py-2 rounded-md bg-black/30 border border-zinc-700 text-zinc-100 text-sm" /></div>
              <div className="md:col-span-2"><label className="block text-zinc-500 text-xs mb-1">Source (optional)</label><input type="text" value={ghgSource} onChange={(e) => setGhgSource(e.target.value)} placeholder="e.g. Internal inventory, CDP" className="w-full px-3 py-2 rounded-md bg-black/30 border border-zinc-700 text-zinc-100 text-sm placeholder-zinc-600" /></div>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => loadGhgForCurrent()} className="px-3 py-1.5 rounded-md bg-zinc-700 text-zinc-300 text-sm hover:bg-zinc-600">Load</button>
              <button type="button" onClick={saveGhg} disabled={ghgSaving} className="px-3 py-1.5 rounded-md bg-zinc-600 text-zinc-100 text-sm hover:bg-zinc-500 disabled:opacity-50">{ghgSaving ? 'Saving…' : 'Save'}</button>
            </div>
            {ghgMessage && <p className="mt-2 text-xs text-zinc-400">{ghgMessage}</p>}
          </div>
          {ghgList.length > 0 && (
            <div className="p-3 rounded-md bg-zinc-800 border border-zinc-700">
              <h4 className="text-xs font-medium text-zinc-400 mb-2">Stored inventories</h4>
              <ul className="space-y-1 text-xs text-zinc-500">
                {ghgList.map((item, i) => (
                  <li key={i}>{item.organization} — {item.reporting_period} <button type="button" onClick={() => loadGhgForCurrent(item.organization, item.reporting_period)} className="ml-2 text-zinc-400 hover:text-zinc-200">Load</button></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
