/**
 * BCP Generator — generate Business Continuity Plans via AI.
 *
 * Form: entity (name, sector, location, size, employees, ...), scenario (type, severity, duration),
 * jurisdiction, existing capabilities. Calls POST /api/v1/bcp/generate.
 * Supports prefill from Stress Planner (location.state.prefill) and link to Stress Planner.
 */
import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import axios from 'axios'
import { ArrowLeftIcon, PlayIcon, DocumentTextIcon, ClipboardDocumentListIcon } from '@heroicons/react/24/outline'
import { FORTUNE_500, formatLocation } from '../data/fortune500'

const API_BASE = '/api/v1'

// Sectors: same 12 as Stress Planner; backend keys match bcp_config (insurance, healthcare, financial, ...)
const SECTOR_OPTIONS: { id: string; label: string; apiKey: string }[] = [
  { id: '1', label: 'Insurance', apiKey: 'insurance' },
  { id: '2', label: 'Real Estate', apiKey: 'real_estate' },
  { id: '3', label: 'Financial', apiKey: 'financial' },
  { id: '4', label: 'Enterprise', apiKey: 'enterprise' },
  { id: '5', label: 'Defense', apiKey: 'defense' },
  { id: '6', label: 'Infrastructure', apiKey: 'infrastructure' },
  { id: '7', label: 'Government', apiKey: 'government' },
  { id: '8', label: 'Healthcare', apiKey: 'healthcare' },
  { id: '9', label: 'Energy', apiKey: 'energy' },
  { id: '10', label: 'Manufacturing', apiKey: 'manufacturing' },
  { id: '11', label: 'Technology', apiKey: 'technology' },
  { id: '12', label: 'City / Region', apiKey: 'city_region' },
]

const SCENARIO_TYPES = [
  'flood', 'seismic', 'financial', 'cyber', 'pandemic', 'supply_chain', 'climate',
  'geopolitical', 'regulatory', 'energy', 'fire', 'political', 'military', 'social',
  'protest', 'civil_unrest', 'uprising',
]

const JURISDICTION_OPTIONS = [
  { value: 'EU', label: 'European Union' },
  { value: 'Germany', label: 'Germany' },
  { value: 'USA', label: 'United States' },
  { value: 'UK', label: 'United Kingdom' },
  { value: 'Japan', label: 'Japan' },
]

export interface BCPPrefill {
  entityName?: string
  location?: string
  sectorId?: string
  scenarioType?: string
  severity?: number
}

const defaultEntityName = ''
const defaultLocation = ''
const defaultSectorId = '4'
const defaultScenarioType = 'flood'
const defaultSeverity = 0.5

const MONTH_NAMES_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function parseLastTestDate(iso: string): { day: number; month: number; year: number } | null {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return null
  const [y, m, d] = iso.split('-').map(Number)
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  return { day: d, month: m, year: y }
}

function buildIsoDate(day: number, month: number, year: number): string {
  if (!day || !month || !year) return ''
  const m = String(month).padStart(2, '0')
  const d = String(Math.min(day, 31)).padStart(2, '0')
  return `${year}-${m}-${d}`
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

function BCPExportButtons({ content }: { content: string }) {
  const [exportingPdf, setExportingPdf] = useState(false)
  const [exportingWord, setExportingWord] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const handleExportPdf = async () => {
    setExportingPdf(true)
    setExportError(null)
    try {
      const res = await axios.post(
        `${API_BASE}/bcp/export/pdf`,
        { content },
        { responseType: 'blob' }
      )
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      downloadBlob(res.data, `bcp_${ts}.pdf`)
    } catch (e) {
      setExportError(axios.isAxiosError(e) ? (e.response?.data?.detail ?? e.message) : 'PDF export failed')
    } finally {
      setExportingPdf(false)
    }
  }

  const handleExportWord = async () => {
    setExportingWord(true)
    setExportError(null)
    try {
      const res = await axios.post(
        `${API_BASE}/bcp/export/word`,
        { content },
        { responseType: 'blob' }
      )
      const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      downloadBlob(res.data, `bcp_${ts}.docx`)
    } catch (e) {
      setExportError(axios.isAxiosError(e) ? (e.response?.data?.detail ?? e.message) : 'Word export failed')
    } finally {
      setExportingWord(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleExportPdf}
        disabled={exportingPdf}
        className="px-3 py-1.5 rounded-lg border border-white/20 text-white/80 text-sm hover:bg-white/5 disabled:opacity-50"
      >
        {exportingPdf ? 'Exporting…' : 'Export to PDF'}
      </button>
      <button
        type="button"
        onClick={handleExportWord}
        disabled={exportingWord}
        className="px-3 py-1.5 rounded-lg border border-white/20 text-white/80 text-sm hover:bg-white/5 disabled:opacity-50"
      >
        {exportingWord ? 'Exporting…' : 'Export to Word'}
      </button>
      {exportError && <span className="text-xs text-red-400">{exportError}</span>}
    </div>
  )
}

export default function BCPGeneratorPage() {
  const location = useLocation()
  const navigate = useNavigate()
  const prefill = (location.state as { prefill?: BCPPrefill })?.prefill

  const [entityName, setEntityName] = useState(defaultEntityName)
  const [entityCustom, setEntityCustom] = useState('')
  const [fortuneId, setFortuneId] = useState('')
  const [sectorId, setSectorId] = useState(defaultSectorId)
  const [locationStr, setLocationStr] = useState(defaultLocation)
  const [size, setSize] = useState<'large' | 'medium' | 'small'>('medium')
  const [employees, setEmployees] = useState<number | ''>('')
  const [subtype, setSubtype] = useState('')
  const [criticalFunctions, setCriticalFunctions] = useState('')
  const [dependencies, setDependencies] = useState('')
  const [scenarioType, setScenarioType] = useState(defaultScenarioType)
  const [severity, setSeverity] = useState(defaultSeverity)
  const [durationEstimate, setDurationEstimate] = useState('')
  const [specificThreat, setSpecificThreat] = useState('')
  const [jurisdictionPrimary, setJurisdictionPrimary] = useState('EU')
  const [jurisdictionSecondary, setJurisdictionSecondary] = useState('')
  const [hasBcp, setHasBcp] = useState(false)
  const [lastTestDate, setLastTestDate] = useState('')
  const [backupSite, setBackupSite] = useState(false)
  const [remoteWorkReady, setRemoteWorkReady] = useState(false)

  const [content, setContent] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!prefill) return
    if (prefill.entityName != null) {
      setEntityName(prefill.entityName)
      setEntityCustom(prefill.entityName)
      setFortuneId('')
    }
    if (prefill.location != null) setLocationStr(prefill.location)
    if (prefill.sectorId != null) setSectorId(prefill.sectorId)
    if (prefill.scenarioType != null) setScenarioType(prefill.scenarioType)
    if (prefill.severity != null) setSeverity(prefill.severity)
  }, [prefill])

  useEffect(() => {
    if (fortuneId && FORTUNE_500) {
      const entry = FORTUNE_500.find((e) => e.id === fortuneId)
      if (entry) {
        setEntityName(entry.name)
        setLocationStr(formatLocation(entry))
      }
    }
  }, [fortuneId])

  const resolvedEntityName = fortuneId
    ? (FORTUNE_500.find((e) => e.id === fortuneId)?.name ?? entityName)
    : (entityCustom || entityName)

  const buildLocationParts = () => {
    const s = (locationStr || '').trim()
    if (!s) return { city: undefined, country: undefined, region: undefined }
    const parts = s.split(',').map((p) => p.trim()).filter(Boolean)
    if (parts.length >= 2) return { city: parts[0], country: parts[1], region: parts[2] }
    if (parts.length === 1) return { city: parts[0], country: undefined, region: undefined }
    return {}
  }

  const handleGenerate = async () => {
    if (!resolvedEntityName.trim()) {
      setError('Organization name is required')
      return
    }
    setLoading(true)
    setError(null)
    setContent(null)
    try {
      const sectorOption = SECTOR_OPTIONS.find((o) => o.id === sectorId)
      const sectorKey = sectorOption?.apiKey ?? 'enterprise'
      const loc = buildLocationParts()
      const res = await axios.post<{ content: string; model?: string; tokens_used?: number }>(
        `${API_BASE}/bcp/generate`,
        {
          entity: {
            name: resolvedEntityName.trim(),
            type: sectorKey,
            subtype: subtype.trim() || undefined,
            location: (loc.city || loc.country) ? loc : undefined,
            size,
            employees: employees === '' ? undefined : Number(employees),
            critical_functions: criticalFunctions.trim()
              ? criticalFunctions.trim().split(/\n/).map((s) => s.trim()).filter(Boolean)
              : undefined,
            dependencies: dependencies.trim()
              ? dependencies.trim().split(/\n/).map((s) => s.trim()).filter(Boolean)
              : undefined,
          },
          scenario: {
            type: scenarioType,
            severity,
            duration_estimate: durationEstimate.trim() || undefined,
            specific_threat: specificThreat.trim() || undefined,
          },
          jurisdiction: {
            primary: jurisdictionPrimary,
            secondary: jurisdictionSecondary.trim()
              ? jurisdictionSecondary.split(',').map((s) => s.trim()).filter(Boolean)
              : undefined,
          },
          existing_capabilities: {
            has_bcp: hasBcp,
            last_test_date: lastTestDate.trim() || undefined,
            backup_site: backupSite,
            remote_work_ready: remoteWorkReady,
          },
        }
      )
      setContent(res.data?.content ?? '')
    } catch (e) {
      const msg = axios.isAxiosError(e)
        ? (e.response?.data?.detail ?? (Array.isArray(e.response?.data?.detail) ? e.response?.data?.detail[0]?.msg : e.message))
        : 'Request failed'
      setError(typeof msg === 'string' ? msg : 'BCP generation failed. Check API and auth.')
    } finally {
      setLoading(false)
    }
  }

  const handleOpenStressPlanner = () => {
    navigate('/stress-planner', {
      state: {
        prefill: {
          entityName: resolvedEntityName || undefined,
          location: locationStr || undefined,
          sectorId,
          scenarioType,
          severity,
        },
      },
    })
  }

  return (
    <div className="min-h-screen bg-[#0a0e17] text-white p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center gap-4 mb-6">
          <Link
            to="/command"
            className="p-2 rounded-lg border border-white/10 text-white/70 hover:bg-white/5 hover:text-white"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <ClipboardDocumentListIcon className="w-8 h-8 text-amber-400" />
            <h1 className="text-xl font-semibold text-white">BCP Generator</h1>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Form */}
          <div className="space-y-6">
            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h2 className="text-sm font-medium uppercase tracking-wider text-white/60 mb-3">1. Organization</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-white/50 mb-1">Entity (Fortune 500 or custom)</label>
                  <select
                    value={fortuneId}
                    onChange={(e) => setFortuneId(e.target.value)}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50"
                  >
                    <option value="">— Select entity —</option>
                    {FORTUNE_500.slice(0, 30).map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </select>
                </div>
                {!fortuneId && (
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Or type custom entity name</label>
                    <input
                      type="text"
                      value={entityCustom}
                      onChange={(e) => setEntityCustom(e.target.value)}
                      placeholder="Organization name"
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-amber-500/50"
                    />
                  </div>
                )}
                <div>
                  <label className="block text-xs text-white/50 mb-1">Sector</label>
                  <select
                    value={sectorId}
                    onChange={(e) => setSectorId(e.target.value)}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:border-amber-500/50"
                  >
                    {SECTOR_OPTIONS.map((o) => (
                      <option key={o.id} value={o.id}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Location (city, country)</label>
                  <input
                    type="text"
                    value={locationStr}
                    onChange={(e) => setLocationStr(e.target.value)}
                    placeholder="e.g. Frankfurt, Germany"
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 focus:border-amber-500/50"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Size</label>
                    <select
                      value={size}
                      onChange={(e) => setSize(e.target.value as 'large' | 'medium' | 'small')}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
                    >
                      <option value="small">Small (&lt;100)</option>
                      <option value="medium">Medium (100–999)</option>
                      <option value="large">Large (1000+)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1">Employees</label>
                    <input
                      type="number"
                      value={employees}
                      onChange={(e) => setEmployees(e.target.value === '' ? '' : Number(e.target.value))}
                      placeholder="Optional"
                      min={0}
                      className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Subtype (e.g. hospital, bank)</label>
                  <input
                    type="text"
                    value={subtype}
                    onChange={(e) => setSubtype(e.target.value)}
                    placeholder="Optional"
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Critical functions (one per line, optional)</label>
                  <textarea
                    value={criticalFunctions}
                    onChange={(e) => setCriticalFunctions(e.target.value)}
                    placeholder="Claims processing&#10;Policy administration"
                    rows={2}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 resize-y"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Dependencies (one per line, optional)</label>
                  <textarea
                    value={dependencies}
                    onChange={(e) => setDependencies(e.target.value)}
                    placeholder="IT provider&#10;Reinsurance"
                    rows={2}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 resize-y"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h2 className="text-sm font-medium uppercase tracking-wider text-white/60 mb-3">2. Threat scenario</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-white/50 mb-1">Scenario type</label>
                  <select
                    value={scenarioType}
                    onChange={(e) => setScenarioType(e.target.value)}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
                  >
                    {SCENARIO_TYPES.map((t) => (
                      <option key={t} value={t}>{t.replace('_', ' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Severity: {(severity * 100).toFixed(0)}%</label>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={severity * 100}
                    onChange={(e) => setSeverity(Number(e.target.value) / 100)}
                    className="w-full h-2 rounded-lg appearance-none bg-white/10 accent-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Duration estimate</label>
                  <input
                    type="text"
                    value={durationEstimate}
                    onChange={(e) => setDurationEstimate(e.target.value)}
                    placeholder="e.g. 2 weeks"
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30"
                  />
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Specific threat (optional)</label>
                  <textarea
                    value={specificThreat}
                    onChange={(e) => setSpecificThreat(e.target.value)}
                    placeholder="Brief description of the threat"
                    rows={2}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30 resize-y"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h2 className="text-sm font-medium uppercase tracking-wider text-white/60 mb-3">3. Jurisdiction</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-white/50 mb-1">Primary</label>
                  <select
                    value={jurisdictionPrimary}
                    onChange={(e) => setJurisdictionPrimary(e.target.value)}
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white"
                  >
                    {JURISDICTION_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-white/50 mb-1">Secondary (comma-separated, optional)</label>
                  <input
                    type="text"
                    value={jurisdictionSecondary}
                    onChange={(e) => setJurisdictionSecondary(e.target.value)}
                    placeholder="e.g. UK, Switzerland"
                    className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2 text-sm text-white placeholder-white/30"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4">
              <h2 className="text-sm font-medium uppercase tracking-wider text-white/60 mb-3">4. Existing capabilities</h2>
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hasBcp}
                    onChange={(e) => setHasBcp(e.target.checked)}
                    className="rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-500/50"
                  />
                  <span className="text-sm text-white/80">Has BCP</span>
                </label>
                <div lang="en" className="grid grid-cols-3 gap-2">
                  <label className="col-span-3 block text-xs text-white/50 mb-1">Last test date (DD.MM.YYYY)</label>
                  <select
                    value={parseLastTestDate(lastTestDate)?.day ?? ''}
                    onChange={(e) => {
                      const v = e.target.value ? Number(e.target.value) : 0
                      if (!v) { setLastTestDate(''); return }
                      const p = parseLastTestDate(lastTestDate)
                      const year = p?.year ?? new Date().getFullYear()
                      const month = p?.month ?? 1
                      setLastTestDate(buildIsoDate(v, month, year))
                    }}
                    className="rounded-lg bg-white/5 border border-white/10 px-2 py-2 text-sm text-white"
                    title="Day"
                  >
                    <option value="">Day</option>
                    {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <select
                    value={parseLastTestDate(lastTestDate)?.month ?? ''}
                    onChange={(e) => {
                      const v = e.target.value ? Number(e.target.value) : 0
                      if (!v) { setLastTestDate(''); return }
                      const p = parseLastTestDate(lastTestDate)
                      const year = p?.year ?? new Date().getFullYear()
                      const day = p?.day ?? 1
                      setLastTestDate(buildIsoDate(day, v, year))
                    }}
                    className="rounded-lg bg-white/5 border border-white/10 px-2 py-2 text-sm text-white"
                    title="Month"
                  >
                    <option value="">Month</option>
                    {MONTH_NAMES_EN.map((name, i) => (
                      <option key={name} value={i + 1}>{name}</option>
                    ))}
                  </select>
                  <select
                    value={parseLastTestDate(lastTestDate)?.year ?? ''}
                    onChange={(e) => {
                      const v = e.target.value ? Number(e.target.value) : 0
                      if (!v) { setLastTestDate(''); return }
                      const p = parseLastTestDate(lastTestDate)
                      const month = p?.month ?? 1
                      const day = p?.day ?? 1
                      setLastTestDate(buildIsoDate(day, month, v))
                    }}
                    className="rounded-lg bg-white/5 border border-white/10 px-2 py-2 text-sm text-white"
                    title="Year"
                  >
                    <option value="">Year</option>
                    {Array.from({ length: 15 }, (_, i) => new Date().getFullYear() - 5 + i).map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={backupSite}
                    onChange={(e) => setBackupSite(e.target.checked)}
                    className="rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-500/50"
                  />
                  <span className="text-sm text-white/80">Backup site</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={remoteWorkReady}
                    onChange={(e) => setRemoteWorkReady(e.target.checked)}
                    className="rounded border-white/20 bg-white/5 text-amber-500 focus:ring-amber-500/50"
                  />
                  <span className="text-sm text-white/80">Remote work ready</span>
                </label>
              </div>
            </section>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleGenerate}
                disabled={loading || !resolvedEntityName.trim()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-black font-medium hover:bg-amber-400 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <PlayIcon className="w-5 h-5" />
                {loading ? 'Generating…' : 'Generate BCP'}
              </button>
              <button
                type="button"
                onClick={handleOpenStressPlanner}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-white/20 text-white/80 hover:bg-white/5"
              >
                <DocumentTextIcon className="w-5 h-5" />
                Run Stress Test for this setup
              </button>
            </div>
          </div>

          {/* Right: Output */}
          <div className="space-y-4">
            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
                {error}
              </div>
            )}
            <section className="rounded-xl border border-white/10 bg-white/[0.02] p-4 min-h-[400px]">
              <h2 className="text-sm font-medium uppercase tracking-wider text-white/60 mb-3">Generated BCP</h2>
              {content == null ? (
                <div className="text-white/40 text-sm py-8 text-center">
                  Fill the form and click Generate BCP. The plan will appear here.
                </div>
              ) : (
                <div className="prose prose-invert prose-sm max-w-none">
                  <pre className="whitespace-pre-wrap font-sans text-sm text-white/90 bg-transparent p-0 overflow-x-auto">
                    {content}
                  </pre>
                </div>
              )}
            </section>
            {content != null && (
              <div className="flex flex-wrap gap-2">
                <BCPExportButtons content={content} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
