/**
 * Unified Compliance Dashboard (Gap X7)
 *
 * Single view of regulatory compliance status across:
 * Basel III/IV, Solvency II, TCFD, ISSB, DORA, NIS2, EU AI Act, GDPR.
 * Clicking a framework card opens a detail modal with regulatory requirements,
 * compliance status per requirement, and key article references.
 *
 * Styling: Unified Corporate Style — Phase 0–2 (design tokens, zinc only,
 * section labels font-mono text-[10px] uppercase tracking-widest text-zinc-500,
 * rounded-md cap, no slate, no backdrop-blur). See Implementation Audit.
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowTopRightOnSquareIcon,
  ScaleIcon,
  XMarkIcon,
  DocumentTextIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'
import { getApiV1Base } from '../config/env'
import SupervisoryClimateRiskView from '../components/compliance/SupervisoryClimateRiskView'

/* ---------- Types ---------- */

type Requirement = {
  id: string
  name: string
  description: string
  status: 'met' | 'partial' | 'gap'
  reference: string
}

type Article = {
  ref: string
  title: string
  description: string
}

type Framework = {
  id: string
  name: string
  domain: string
  status: 'compliant' | 'partial' | 'gap'
  compliance_score?: number
  summary: string
  implemented: string[]
  gaps: string[]
  requirements?: Requirement[]
  articles?: Article[]
  route: string | null
  last_updated: string | null
  last_verified_at?: string | null
  last_verified_by_agent?: string | null
  verification_status?: string | null
  verification_id?: string | null
}

type DashboardResponse = {
  generated_at: string
  frameworks: Framework[]
  jurisdiction?: string
  summary: {
    by_status: Record<string, number>
    by_domain: Record<string, number>
    total: number
  }
}

/* ---------- Config ---------- */

const domainLabels: Record<string, string> = {
  financial: 'Financial',
  climate: 'Climate',
  cyber: 'Cyber',
  ai: 'AI Governance',
  privacy: 'Data Privacy',
}

/* Corporate palette: zinc base + status accents (aligned with index.css / platform) */
const statusConfig = {
  compliant: {
    label: 'Compliant',
    icon: CheckCircleIcon,
    bg: 'bg-zinc-900/50 border border-zinc-800/60',
    text: 'text-emerald-400/80',
  },
  partial: {
    label: 'Partial',
    icon: ExclamationTriangleIcon,
    bg: 'bg-zinc-900/50 border border-zinc-800/60',
    text: 'text-amber-400/80',
  },
  gap: {
    label: 'Gaps',
    icon: XCircleIcon,
    bg: 'bg-zinc-900/50 border border-zinc-800/60',
    text: 'text-red-400/80',
  },
}

const reqStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
  met: { label: 'Met', color: 'text-emerald-400/80', bg: 'bg-emerald-500/10 border-emerald-500/20' },
  partial: { label: 'Partial', color: 'text-amber-400/80', bg: 'bg-amber-500/10 border-amber-500/20' },
  gap: { label: 'Gap', color: 'text-red-400/80', bg: 'bg-red-500/10 border-red-500/20' },
}

/* ---------- Detail Modal ---------- */

function FrameworkDetailModal({
  fw,
  onClose,
}: {
  fw: Framework
  onClose: () => void
}) {
  const config = statusConfig[fw.status]
  const Icon = config.icon
  const score = fw.compliance_score ?? 0

  const reqsMet = fw.requirements?.filter((r) => r.status === 'met').length ?? 0
  const reqsPartial = fw.requirements?.filter((r) => r.status === 'partial').length ?? 0
  const reqsGap = fw.requirements?.filter((r) => r.status === 'gap').length ?? 0
  const reqsTotal = fw.requirements?.length ?? 0

  const lastVerified = fw.last_verified_at && fw.last_verified_by_agent
    ? `Verified ${new Date(fw.last_verified_at).toLocaleString()} by ${fw.last_verified_by_agent}${fw.verification_status ? ` (${fw.verification_status})` : ''}`
    : null

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60" onClick={onClose} />

      {/* Modal — wide so content fits without horizontal scroll, 2-column layout to avoid vertical scroll */}
      <motion.div
        className="relative z-10 w-full max-w-6xl max-h-[90vh] rounded-md border border-zinc-800/60 bg-zinc-900/50 shadow-2xl flex flex-col overflow-hidden"
        initial={{ scale: 0.96, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.96, opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Header — sticky */}
        <div className="flex items-start justify-between gap-4 p-6 border-b border-zinc-800/60 shrink-0">
          <div className="flex items-start gap-4 min-w-0">
            <div className="w-12 h-12 rounded-md border border-zinc-800/60 bg-zinc-900/80 flex items-center justify-center shrink-0">
              <Icon className={`w-7 h-7 ${config.text}`} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="font-display text-xl font-semibold text-zinc-100">{fw.name}</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                  fw.status === 'compliant' ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400/80'
                    : fw.status === 'partial' ? 'bg-amber-500/10 border-amber-500/30 text-amber-400/80'
                    : 'bg-red-500/10 border-red-500/30 text-red-400/80'
                }`}>
                  {config.label}
                </span>
                <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
                  {domainLabels[fw.domain] ?? fw.domain}
                </span>
              </div>
              <p className="mt-1.5 text-sm text-zinc-400 leading-relaxed">{fw.summary}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md border border-transparent hover:bg-zinc-800 hover:border-zinc-700 text-zinc-500 hover:text-zinc-300 shrink-0"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body — 2 columns on large screens so content fits without scroll */}
        <div className="overflow-y-auto min-h-0 flex-1">
          {/* Score bar — full width, compact */}
          {fw.compliance_score != null && (
            <div className="px-6 py-3 border-b border-zinc-800/60 flex flex-wrap items-center gap-4">
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Compliance Score</span>
              <span className={`text-sm font-semibold ${
                score >= 70 ? 'text-emerald-400/80' : score >= 40 ? 'text-amber-400/80' : 'text-red-400/80'
              }`}>
                {score}%
              </span>
              <div className="w-24 h-1.5 rounded-full bg-zinc-800/80 overflow-hidden flex-1 min-w-[80px] max-w-[120px]">
                <div
                  className={`h-full rounded-full ${
                    score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min(score, 100)}%` }}
                />
              </div>
              <span className="font-mono text-[10px] text-zinc-500">Met: {reqsMet} · Partial: {reqsPartial} · Gap: {reqsGap} · Total: {reqsTotal}</span>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            {/* Left column: Requirements in 2-column grid */}
            {fw.requirements && fw.requirements.length > 0 && (
              <div className="px-6 py-4 border-b border-zinc-800/60 lg:border-b-0 lg:border-r border-zinc-800/60">
                <h3 className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">
                  <ShieldCheckIcon className="w-3.5 h-3.5" />
                  Regulatory Requirements
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {fw.requirements.map((req) => {
                    const rc = reqStatusConfig[req.status] ?? reqStatusConfig.gap
                    return (
                      <div
                        key={req.id}
                        className={`rounded-md border p-2.5 ${rc.bg}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="text-xs font-medium text-zinc-200">{req.name}</span>
                              <span className={`px-1 py-0.5 rounded text-[10px] font-medium uppercase ${rc.color} bg-zinc-900/80 border border-zinc-800/60`}>
                                {rc.label}
                              </span>
                            </div>
                            <p className="mt-0.5 text-[11px] text-zinc-400 leading-snug">{req.description}</p>
                          </div>
                          <span className="text-[10px] text-zinc-500 font-mono shrink-0 max-w-[100px] text-right leading-tight">
                            {req.reference}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Right column: Articles + Implemented/Gaps */}
            <div className="px-6 py-4 flex flex-col gap-4">
              {lastVerified && (
                <p className="text-xs text-emerald-500/90 flex items-center gap-1.5">
                  <ShieldCheckIcon className="w-4 h-4 shrink-0" />
                  {lastVerified}
                </p>
              )}
              {fw.articles && fw.articles.length > 0 && (
                <div>
                  <h3 className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">
                    <DocumentTextIcon className="w-3.5 h-3.5" />
                    Key Articles / References
                  </h3>
                  <div className="space-y-1.5">
                    {fw.articles.map((art, i) => (
                      <div key={i} className="flex items-start gap-2 text-[11px]">
                        <span className="font-mono text-zinc-500 shrink-0 w-[90px]">{art.ref}</span>
                        <div className="min-w-0">
                          <span className="text-zinc-300 font-medium">{art.title}</span>
                          <span className="text-zinc-500 ml-1">{art.description}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {fw.implemented.length > 0 && (
                  <div>
                    <h4 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1.5">Implemented</h4>
                    <ul className="space-y-1">
                      {fw.implemented.map((x, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[11px] text-zinc-400">
                          <CheckCircleIcon className="w-3 h-3 text-emerald-500/70 mt-0.5 shrink-0" />
                          {x}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {fw.gaps.length > 0 && (
                  <div>
                    <h4 className="font-mono text-[10px] uppercase tracking-widest text-amber-500/90 mb-1.5">Gaps / Pending</h4>
                    <ul className="space-y-1">
                      {fw.gaps.map((x, i) => (
                        <li key={i} className="flex items-start gap-1.5 text-[11px] text-zinc-400">
                          <ExclamationTriangleIcon className="w-3 h-3 text-amber-500/70 mt-0.5 shrink-0" />
                          {x}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {/* Footer actions — sticky at bottom of modal */}
        <div className="px-6 py-4 flex items-center justify-between gap-4 border-t border-zinc-800/60 shrink-0 bg-zinc-900/80">
          {fw.route && (
            <Link
              to={fw.route}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-800 border border-zinc-800/60 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
            >
              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
              Open Related Module
            </Link>
          )}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-sm text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300 transition-colors"
          >
            Close
          </button>
        </div>
      </motion.div>
    </motion.div>
  )
}

/* ---------- Main ---------- */

export default function ComplianceDashboard() {
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedFw, setSelectedFw] = useState<Framework | null>(null)
  const [jurisdiction, setJurisdiction] = useState<string>('EU')
  const [verifying, setVerifying] = useState(false)
  const [verificationError, setVerificationError] = useState<string | null>(null)
  const [mainTab, setMainTab] = useState<'frameworks' | 'supervisory'>('frameworks')
  const [searchQuery, setSearchQuery] = useState('')

  const fetchDashboard = (extraParams?: Record<string, string>) => {
    const params = new URLSearchParams({ jurisdiction, ...extraParams })
    const apiBase = getApiV1Base()
    return fetch(`${apiBase}/compliance/dashboard?${params}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then((d) => {
        setData(d)
        setError(null)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    setLoading(true)
    setVerificationError(null)
    fetchDashboard()
  }, [jurisdiction])

  const runVerification = async () => {
    setVerifying(true)
    setVerificationError(null)
    try {
      const params = new URLSearchParams({ jurisdiction })
      const apiBase = getApiV1Base()
      const r = await fetch(`${apiBase}/compliance/run-verification?${params}`, { method: 'POST' })
      if (!r.ok) {
        const text = await r.text()
        throw new Error(`Verification failed: ${r.status} ${text || ''}`)
      }
      setLoading(true)
      await fetchDashboard({ _t: String(Date.now()) })
    } catch (e) {
      setVerificationError(e instanceof Error ? e.message : 'Run verification failed')
    } finally {
      setVerifying(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-full flex items-center justify-center bg-zinc-950 text-zinc-300 font-display">
        <div className="animate-pulse font-mono text-[10px] uppercase tracking-widest text-zinc-500">Loading compliance status...</div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-full flex items-center justify-center bg-zinc-950 text-zinc-300 font-display">
        <div className="text-red-400/80">Failed to load dashboard: {error ?? 'No data'}</div>
      </div>
    )
  }

  const { frameworks, summary, generated_at } = data

  return (
    <div className="min-h-full w-full bg-zinc-950 text-zinc-100 font-sans">
      <div className="w-full max-w-[1920px] mx-auto p-6">
        {/* Header — Strategic Modules style (100%) */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-zinc-800 rounded-md border border-zinc-700">
              <ScaleIcon className="w-8 h-8 text-zinc-400" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-semibold text-zinc-100">
                Compliance Dashboard
              </h1>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-1">
                Regulatory alignment: Basel, Solvency II, TCFD, ISSB, DORA, NIS2, EU AI Act, GDPR
              </p>
            </div>
          </div>
          <p className="text-zinc-500/90 text-sm max-w-3xl font-sans">
            Single view of regulatory compliance status across financial, climate, cyber, AI and privacy domains.
            Click a framework card for requirements, compliance status and article references.
          </p>
        </motion.div>

        {/* Filters — 100% ModuleFilter layout (Search + Section + Jurisdiction + Status) */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="flex flex-wrap items-center gap-4 mb-6"
        >
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search frameworks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Section:</span>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setMainTab('frameworks')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all border ${
                  mainTab === 'frameworks'
                    ? 'bg-zinc-700 text-zinc-100 border-zinc-600'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
                }`}
              >
                Frameworks
              </button>
              <button
                type="button"
                onClick={() => setMainTab('supervisory')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all border ${
                  mainTab === 'supervisory'
                    ? 'bg-zinc-700 text-zinc-100 border-zinc-600'
                    : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
                }`}
              >
                Supervisory Climate Risk View
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Jurisdiction:</span>
            <select
              value={jurisdiction}
              onChange={(e) => setJurisdiction(e.target.value)}
              className="px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-800 text-zinc-100 border border-zinc-700 focus:outline-none focus:border-zinc-600"
            >
              <option value="EU">EU</option>
              <option value="US">US</option>
              <option value="UK">UK</option>
            </select>
            <span className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs rounded border border-zinc-700">
              {jurisdiction}
            </span>
          </div>
          <button
            type="button"
            onClick={runVerification}
            disabled={verifying}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium bg-zinc-800 text-zinc-100 border border-zinc-700 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {verifying ? (
              <>
                <span className="inline-block w-3.5 h-3.5 border-2 border-zinc-400 border-t-transparent rounded-full animate-spin" />
                Verifying…
              </>
            ) : (
              <>
                <ShieldCheckIcon className="w-4 h-4" />
                Run verification
              </>
            )}
          </button>
          {verificationError && (
            <span className="text-red-400/80 text-xs" role="alert">{verificationError}</span>
          )}
          <span className="ml-auto font-mono text-[10px] uppercase tracking-wider text-zinc-500">
            Last updated: {new Date(generated_at).toLocaleString()}
            {data?.jurisdiction != null && ` · ${data.jurisdiction}`}
          </span>
        </motion.div>

      <main className="w-full pb-16">
        {mainTab === 'supervisory' ? (
          <SupervisoryClimateRiskView />
        ) : (
          <>
        {/* Disclaimer — Strategic Modules info block style */}
        <div className="mb-6 p-4 rounded-md border border-zinc-800 bg-zinc-900 text-zinc-400/80 text-sm font-sans">
          Compliance status as of {new Date(generated_at).toLocaleDateString()} for jurisdiction <strong className="text-zinc-300">{jurisdiction}</strong> — reflects implementation state. For internal use.
        </div>
        {/* Summary strip — card row like Strategic Modules */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8 w-full">
          <div className="p-4 rounded-md border border-zinc-700 bg-zinc-900 min-w-0">
            <div className="text-2xl font-semibold font-mono tabular-nums text-zinc-100">{summary.total}</div>
            <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-0.5">Frameworks</div>
          </div>
          {(['compliant', 'partial', 'gap'] as const).map((s) => (
            <div key={s} className={`p-4 rounded-md border border-zinc-700 bg-zinc-900 min-w-0 ${statusConfig[s].text}`}>
              <div className="text-2xl font-semibold font-mono tabular-nums">
                {summary.by_status[s] ?? 0}
              </div>
              <div className="font-mono text-[10px] uppercase tracking-widest mt-0.5 text-zinc-500">{statusConfig[s].label}</div>
            </div>
          ))}
        </div>

        {/* By domain — full-width grid (auto-fit), section dividers */}
        <div className="space-y-12 w-full">
          {['financial', 'climate', 'cyber', 'ai', 'privacy'].map((domain) => {
            let items = frameworks.filter((f) => f.domain === domain)
            if (searchQuery.trim()) {
              const q = searchQuery.toLowerCase().trim()
              items = items.filter((f) =>
                f.name.toLowerCase().includes(q) ||
                f.summary.toLowerCase().includes(q) ||
                (domainLabels[domain] ?? domain).toLowerCase().includes(q)
              )
            }
            if (items.length === 0) return null
            return (
              <motion.section
                key={domain}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="w-full"
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
                      {domainLabels[domain] ?? domain}
                    </span>
                    <span className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs rounded border border-zinc-700">
                      {items.length} framework{items.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
                </div>
                <div
                  className="grid gap-6 w-full"
                  style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}
                >
                  {items.map((fw) => {
                    const config = statusConfig[fw.status]
                    const FwIcon = config.icon
                    const score = fw.compliance_score
                    return (
                      <motion.div
                        key={fw.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative p-6 rounded-md border border-zinc-700 bg-zinc-900 flex flex-col min-h-0 cursor-pointer hover:border-zinc-600 transition-all group"
                        onClick={() => setSelectedFw(fw)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedFw(fw) }}
                      >
                        {/* Status badge — 100% ModuleCard (top-right) */}
                        <div className="absolute top-4 right-4">
                          <span className={`px-2 py-1 rounded-md text-[10px] font-medium border border-zinc-600 bg-zinc-800/80 ${config.text}`}>
                            {config.label}
                          </span>
                        </div>
                        <div className="flex items-start justify-between gap-2 pr-20">
                          <div className="flex items-center gap-2 min-w-0">
                            <FwIcon className={`w-5 h-5 flex-shrink-0 ${config.text}`} />
                            <h3 className="font-display font-medium text-zinc-100 truncate">{fw.name}</h3>
                          </div>
                          {fw.route && (
                            <Link
                              to={fw.route}
                              className="p-1.5 rounded-md border border-transparent hover:bg-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              title="Open related module"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                            </Link>
                          )}
                        </div>
                        <p className="text-sm text-zinc-500 mt-2 line-clamp-2">{fw.summary}</p>

                        {/* Domain — 100% ModuleCard Access row */}
                        <div className="flex items-center gap-2 mt-3">
                          <span className="text-zinc-500 text-xs">Domain:</span>
                          <span className="text-xs px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-700">
                            {domainLabels[domain] ?? domain}
                          </span>
                        </div>

                        {/* Mini score bar */}
                        {score != null && (
                          <div className="mt-3">
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Score</span>
                              <span className={`text-[10px] font-semibold ${
                                score >= 70 ? 'text-emerald-400/80' : score >= 40 ? 'text-amber-400/80' : 'text-red-400/80'
                              }`}>{score}%</span>
                            </div>
                            <div className="w-full h-1 rounded-full bg-zinc-800 overflow-hidden">
                              <div
                                className={`h-full rounded-full ${
                                  score >= 70 ? 'bg-emerald-500' : score >= 40 ? 'bg-amber-500' : 'bg-red-500'
                                }`}
                                style={{ width: `${Math.min(score, 100)}%` }}
                              />
                            </div>
                          </div>
                        )}

                        {/* Last verified (per jurisdiction) — updates when Run verification or jurisdiction change */}
                        {fw.last_verified_at && (
                          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-emerald-500/90">
                            <ShieldCheckIcon className="w-3.5 h-3.5 shrink-0" />
                            <span>Verified {new Date(fw.last_verified_at).toLocaleDateString()}{fw.last_verified_by_agent ? ` · ${fw.last_verified_by_agent}` : ''}</span>
                          </div>
                        )}

                        {/* Requirements count */}
                        {fw.requirements && fw.requirements.length > 0 && (
                          <div className="mt-2 flex items-center gap-2 text-[10px] text-zinc-500">
                            <span>{fw.requirements.filter((r) => r.status === 'met').length} met</span>
                            <span className="text-zinc-600">/</span>
                            <span>{fw.requirements.filter((r) => r.status === 'partial').length} partial</span>
                            <span className="text-zinc-600">/</span>
                            <span>{fw.requirements.filter((r) => r.status === 'gap').length} gap</span>
                          </div>
                        )}

                        {fw.implemented.length > 0 && (
                          <ul className="mt-3 text-xs text-zinc-500 space-y-1">
                            <li className="font-medium text-emerald-500/90">Implemented</li>
                            {fw.implemented.slice(0, 2).map((x, i) => (
                              <li key={i}>&#8226; {x}</li>
                            ))}
                            {fw.implemented.length > 2 && (
                              <li className="text-zinc-500">+{fw.implemented.length - 2} more</li>
                            )}
                          </ul>
                        )}
                        {fw.gaps.length > 0 && (
                          <ul className="mt-2 text-xs text-zinc-500 space-y-1">
                            <li className="font-medium text-amber-500/90">Gaps</li>
                            {fw.gaps.slice(0, 2).map((x, i) => (
                              <li key={i}>&#8226; {x}</li>
                            ))}
                            {fw.gaps.length > 2 && (
                              <li className="text-zinc-500">+{fw.gaps.length - 2} more</li>
                            )}
                          </ul>
                        )}

                        {/* Action row — 100% ModuleCard footer */}
                        <div className="mt-auto pt-4 border-t border-zinc-800 font-mono text-[10px] uppercase tracking-wider text-zinc-500 group-hover:text-zinc-400 transition-colors">
                          Click for regulatory details
                        </div>
                      </motion.div>
                    )
                  })}
                </div>
              </motion.section>
            )
          })}
        </div>

        {/* Empty state — 100% Strategic */}
        {mainTab === 'frameworks' && searchQuery.trim() && frameworks.filter((f) => {
          const q = searchQuery.toLowerCase().trim()
          return f.name.toLowerCase().includes(q) || f.summary.toLowerCase().includes(q)
        }).length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <ScaleIcon className="w-16 h-16 mx-auto text-zinc-600 mb-4" />
            <p className="text-zinc-400 text-lg mb-2">No frameworks found</p>
            <p className="text-zinc-500 text-sm">
              Try adjusting your search or filters
            </p>
          </motion.div>
        )}

        {/* About Compliance Dashboard — 100% Strategic footer */}
        {mainTab === 'frameworks' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-12 p-6 bg-zinc-900 rounded-md border border-zinc-800"
          >
            <h3 className="text-zinc-100 font-semibold mb-3 font-display">About Compliance Dashboard</h3>
            <p className="text-zinc-400/80 text-sm mb-4 font-sans">
              Single view of regulatory compliance status across financial, climate, cyber, AI and privacy domains.
              Framework cards open a detail modal with requirements, compliance status per requirement, and key article references.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-sans">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Frameworks covered</p>
                <ul className="text-zinc-400/80 space-y-1 list-disc list-inside">
                  <li>Basel III/IV, Solvency II (Financial)</li>
                  <li>TCFD, ISSB (Climate)</li>
                  <li>DORA, NIS2 (Cyber)</li>
                  <li>EU AI Act (AI Governance)</li>
                  <li>GDPR (Data Privacy)</li>
                </ul>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Jurisdictions</p>
                <ul className="text-zinc-400/80 space-y-1">
                  <li><span className="text-zinc-300">EU</span> — EBA/ESMA/ECB expectations</li>
                  <li><span className="text-zinc-300">US</span> — Fed/SEC/state regimes</li>
                  <li><span className="text-zinc-300">UK</span> — PRA/FCA post-Brexit</li>
                </ul>
              </div>
            </div>
          </motion.div>
        )}
          </>
        )}
      </main>

      </div>
      {/* Detail modal */}
      <AnimatePresence>
        {selectedFw && (
          <FrameworkDetailModal fw={selectedFw} onClose={() => setSelectedFw(null)} />
        )}
      </AnimatePresence>
    </div>
  )
}
