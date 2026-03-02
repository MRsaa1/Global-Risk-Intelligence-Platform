/**
 * System Overseer Widget
 * Displays OVERSEER status: executive summary, health, system alerts.
 * Uses getApiV1Base() so requests work on server and with tunnel (?api=).
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CpuChipIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import FreshnessIndicator from './FreshnessIndicator'
import { getApiV1Base } from '../../config/env'

type ActionVariant = 'success' | 'warning' | 'perf' | 'neutral'
function stripLeadingEmoji(s: string): string {
  return s
    .replace(/^\u2705\s*/, '')   // ✅
    .replace(/^⚠️?\s*/, '')
    .replace(/^📊\s*/, '')
    .trim()
}
function parseActionIcon(text: string): { variant: ActionVariant; label: string } {
  const s = (text || '').trim()
  if (/^\u2705|^✅/.test(s)) return { variant: 'success', label: stripLeadingEmoji(s) || s }
  if (/^\u26A0|^⚠/.test(s)) return { variant: 'warning', label: stripLeadingEmoji(s) || s }
  if (/^\uD83D\uDCCA|^📊|Slow endpoint|Performance issue logged/i.test(s)) return { variant: 'perf', label: stripLeadingEmoji(s) || s }
  return { variant: 'neutral', label: s }
}
function ActionIcon({ variant, className }: { variant: ActionVariant; className?: string }) {
  const c = className ?? 'w-3.5 h-3.5 flex-shrink-0'
  if (variant === 'success') return <CheckCircleIcon className={`${c} text-emerald-500`} />
  if (variant === 'warning') return <ExclamationTriangleIcon className={`${c} text-amber-500`} />
  if (variant === 'perf') return <ChartBarIcon className={`${c} text-sky-500`} />
  return null
}

const OVERSEER_STATUS_KEY = ['oversee', 'status']

async function fetchOverseerStatus() {
  const base = getApiV1Base()
  const url = base ? `${base}/oversee/status` : '/api/v1/oversee/status'
  const res = await fetch(url)
  if (!res.ok) throw new Error(`oversee status ${res.status}`)
  return res.json()
}

async function runOverseerCycle() {
  const base = getApiV1Base()
  const url = base ? `${base}/oversee/run` : '/api/v1/oversee/run'
  const res = await fetch(url, { method: 'POST' })
  if (!res.ok) throw new Error(`oversee run ${res.status}`)
  return res.json()
}

const statusConfigCompact = {
  healthy: { color: 'text-emerald-500/70', bg: 'bg-emerald-500/60', label: 'OK' },
  degraded: { color: 'text-amber-500/70', bg: 'bg-amber-500/60', label: 'Degraded' },
  critical: { color: 'text-red-500/70', bg: 'bg-red-500/60', label: 'Critical' },
  no_data: { color: 'text-zinc-500', bg: 'bg-zinc-700', label: '—' },
}
const statusConfigFull = {
  healthy: { color: 'text-emerald-400/80', bg: 'bg-emerald-400', label: 'Healthy' },
  degraded: { color: 'text-amber-400/80', bg: 'bg-amber-400', label: 'Degraded' },
  critical: { color: 'text-red-400/80', bg: 'bg-red-400', label: 'Critical' },
  no_data: { color: 'text-zinc-400', bg: 'bg-zinc-600', label: 'No data' },
}

interface SystemOverseerWidgetProps {
  compact?: boolean
}

export default function SystemOverseerWidget({ compact = false }: SystemOverseerWidgetProps) {
  const [detailsOpen, setDetailsOpen] = useState(true)
  const [summaryExpanded, setSummaryExpanded] = useState(false)
  const [explainTermsOpen, setExplainTermsOpen] = useState(false)
  const [askOpen, setAskOpen] = useState(false)
  const [askInput, setAskInput] = useState('')
  const [askAnswer, setAskAnswer] = useState<string | null>(null)
  const [askSources, setAskSources] = useState<Array<{ id?: string; kind?: string; title?: string; url?: string; snippet?: string }>>([])
  const [askError, setAskError] = useState<string | null>(null)
  const [askLoading, setAskLoading] = useState(false)
  const [auditOpen, setAuditOpen] = useState(false)
  const [auditEntries, setAuditEntries] = useState<Array<{ source: string; agent_id: string; action_type: string; result_summary: string; timestamp: string }>>([])
  const [auditLoading, setAuditLoading] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: OVERSEER_STATUS_KEY,
    queryFn: fetchOverseerStatus,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const runMutation = useMutation({
    mutationFn: runOverseerCycle,
    onSuccess: (_data: { auto_resolution_actions?: string[] }) => {
      queryClient.invalidateQueries({ queryKey: OVERSEER_STATUS_KEY })
    },
  })

  const NO_DATA_SUMMARY = 'No data yet. Run a cycle or wait for the next one.'
  const rawSummary = data?.executive_summary
  const summary = rawSummary || NO_DATA_SUMMARY
  const hasNoData = !isLoading && !error && !rawSummary
  const status = hasNoData ? 'no_data' : (data?.status || 'healthy')
  const alerts = data?.system_alerts || []
  const timestamp = data?.timestamp
  const sources = data?.executive_summary_sources || []
  const autoResolutionActions = data?.auto_resolution_actions || []
  const agentMetrics = data?.agent_metrics as { oversee_cycles_count_24h?: number; auto_resolution_count_24h?: number; aiq_tool_calls_count_24h?: number } | undefined
  const llm = data?.nvidia?.llm
  const hasLongSummary = typeof summary === 'string' && (summary.length > 220 || summary.includes('\n'))

  const cfgCompact = statusConfigCompact[status as keyof typeof statusConfigCompact] || statusConfigCompact.healthy
  const cfgFull = statusConfigFull[status as keyof typeof statusConfigFull] || statusConfigFull.healthy

  // Compact: one-line corporate strip for Command Center; show "Agent fixed: …" when degraded/critical and agent took actions
  if (compact) {
    const showAgentFixed = !isLoading && !error && (status === 'degraded' || status === 'critical') && autoResolutionActions.length > 0
    return (
      <div className="group flex flex-wrap items-center gap-2 px-2.5 py-1.5 rounded-md bg-black/25 border border-zinc-800">
        <div className="flex items-center gap-2">
          <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfgCompact.bg} ${status !== 'healthy' ? 'animate-pulse' : ''}`} />
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Overseer</span>
          <span className="text-zinc-700">·</span>
          {isLoading && <span className="text-zinc-700 text-[10px]">—</span>}
          {error && <span className="text-zinc-600 text-[10px]">Error</span>}
          {!isLoading && !error && (
            <span className={`text-[10px] ${cfgCompact.color}`}>{cfgCompact.label}</span>
          )}
          {alerts.length > 0 && (
            <>
              <span className="text-zinc-700">·</span>
              <span className="text-amber-500/50 text-[10px]">{alerts.length}</span>
            </>
          )}
        </div>
        {showAgentFixed && (
          <span className="text-emerald-400/80 text-[10px]" title={autoResolutionActions.join('\n')}>
            Agent fixed: {autoResolutionActions.length} action{autoResolutionActions.length !== 1 ? 's' : ''}
          </span>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); runMutation.mutate() }}
          disabled={runMutation.isPending}
          className="ml-0.5 opacity-0 group-hover:opacity-40 hover:!opacity-70 transition-opacity disabled:opacity-30"
          title="Run cycle"
        >
          <ArrowPathIcon className={`w-3 h-3 text-zinc-400 ${runMutation.isPending ? 'animate-spin' : ''}`} />
        </button>
      </div>
    )
  }

  const statusGlow = status === 'healthy' ? '0 0 12px rgba(34,197,94,0.3)' : status === 'degraded' ? '0 0 12px rgba(245,158,11,0.3)' : status === 'critical' ? '0 0 12px rgba(239,68,68,0.3)' : 'none'
  const statusTextShadow = status === 'healthy' ? '0 0 8px rgba(34,197,94,0.4)' : status === 'degraded' ? '0 0 8px rgba(245,158,11,0.4)' : status === 'critical' ? '0 0 8px rgba(239,68,68,0.4)' : 'none'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-md bg-zinc-900 border border-zinc-800"
      >
      <div className="rounded-md p-6">
      {/* Header: title + status + alert count */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <CpuChipIcon className="w-5 h-5 text-zinc-400" />
        <h2 className="text-sm font-display font-semibold text-zinc-300">System Overseer</h2>
        <div className={`flex items-center gap-1.5 ${cfgFull.color}`}>
          <div
            className={`w-2 h-2 rounded-full ${cfgFull.bg} ${status === 'degraded' || status === 'critical' ? 'animate-pulse' : ''}`}
            style={{ boxShadow: statusGlow }}
          />
          <span className="text-xs font-medium" style={{ textShadow: statusTextShadow }}>{cfgFull.label}</span>
        </div>
        {alerts.length > 0 && (
          <span className="flex items-center gap-1.5 text-amber-400/80 text-xs font-medium">
            <ExclamationTriangleIcon className="w-4 h-4" />
            {alerts.length} system alert{alerts.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {isLoading && (
        <p className="text-sm text-zinc-500">Loading…</p>
      )}
      {error && (
        <p className="text-sm text-amber-400/80">Unable to load. <button type="button" onClick={() => refetch()} className="underline">Retry</button></p>
      )}
      {!isLoading && !error && (
        <div className="text-sm text-zinc-400 min-w-0 border-l-2 border-zinc-600 pl-3 leading-relaxed">
          <p className={`${summaryExpanded ? 'whitespace-pre-wrap' : 'line-clamp-4'}`}>{summary}</p>
          {hasLongSummary && (
            <button
              type="button"
              onClick={() => setSummaryExpanded((v) => !v)}
              className="mt-1.5 inline-block text-[11px] text-zinc-500 hover:text-zinc-400 underline underline-offset-2"
            >
              {summaryExpanded ? 'Show less' : 'Show more'}
            </button>
          )}
        </div>
      )}

      {!isLoading && !error && alerts.length > 0 && (
        <ul className="mt-3 space-y-2 max-w-full">
          {alerts.slice(0, 5).map((a: { code?: string; severity?: string; title?: string; message?: string; source?: string }, i: number) => {
            const isRedis = (a.source === 'database' || a.source === 'circuit_breaker') && (a.message?.toLowerCase().includes('redis') ?? a.title?.toLowerCase().includes('redis'))
            const isNeo4j = a.code === 'database_neo4j' || a.code === 'service_kg' || (a.code?.startsWith('circuit_breaker_') && a.code.includes('neo4j'))
            return (
              <li key={a.code || i} className="p-2 rounded-md bg-amber-500/5 border border-amber-500/20 text-[11px] text-zinc-300">
                <span className="text-zinc-200 font-medium">{a.title || a.code || 'Alert'}</span>
                {a.source && <span className="text-zinc-500"> · {a.source}</span>}
                {a.message && <p className="text-zinc-400 mt-0.5">{a.message}</p>}
                {isRedis && (
                  <p className="text-amber-400/90 text-[10px] mt-1">
                    Fix: start Redis and set REDIS_URL; the app will retry automatically after the timeout.
                  </p>
                )}
                {isNeo4j && (
                  <p className="text-amber-400/90 text-[10px] mt-1">
                    Optional: set ENABLE_NEO4J=false if you are not using the graph.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}

      {!isLoading && !error && llm && (
        <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
          <span className="px-2 py-0.5 rounded bg-zinc-800 text-zinc-500 border border-zinc-800">
            LLM: {llm.mode || 'cloud'} · {llm.available ? 'configured' : 'not configured'}
          </span>
          {!llm.available && (
            <span className="text-amber-400/80">Set NVIDIA_API_KEY (or NVIDIA_LLM_API_KEY) to enable AI summary</span>
          )}
        </div>
      )}

      {timestamp && !isLoading && !error && (
        <p className="text-[10px] text-zinc-600 mt-2">
          <FreshnessIndicator timestamp={timestamp} ttlMinutes={10} label="Updated" />
        </p>
      )}

      {!isLoading && !error && autoResolutionActions.length > 0 && (
        <div className="mt-3 p-2 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-xs">
          <div className="text-emerald-400/90 font-medium mb-1">Actions taken by Overseer</div>
          <ul className="space-y-1 text-zinc-300">
            {autoResolutionActions.map((action: string, i: number) => {
              const { variant, label } = parseActionIcon(action)
              return (
                <li key={i} className="flex items-start gap-2">
                  <ActionIcon variant={variant} />
                  <span>{label || action}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {!isLoading && !error && agentMetrics && (agentMetrics.oversee_cycles_count_24h != null || agentMetrics.auto_resolution_count_24h != null || agentMetrics.aiq_tool_calls_count_24h != null) && (
        <div className="mt-2 flex flex-wrap items-center gap-3 text-[10px] text-zinc-500">
          <span title="Overseer cycles in last 24h">Cycles 24h: {agentMetrics.oversee_cycles_count_24h ?? 0}</span>
          <span title="Auto-resolutions in last 24h">Auto-fix 24h: {agentMetrics.auto_resolution_count_24h ?? 0}</span>
          <span title="AI-Q tool calls (orchestrator) in last 24h">AI-Q tools 24h: {agentMetrics.aiq_tool_calls_count_24h ?? 0}</span>
        </div>
      )}

      {!isLoading && !error && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => {
              const willOpen = !auditOpen
              setAuditOpen(willOpen)
              if (willOpen) {
                setAuditLoading(true)
                fetch('/api/v1/oversee/agent-actions?source=all&limit=10')
                  .then((r) => r.json())
                  .then((d) => { setAuditEntries(Array.isArray(d?.entries) ? d.entries : []); setAuditLoading(false) })
                  .catch(() => setAuditLoading(false))
              }
            }}
            className="text-[10px] text-zinc-500 hover:text-zinc-400 flex items-center gap-1"
          >
            {auditOpen ? <ChevronUpIcon className="w-3 h-3" /> : <ChevronDownIcon className="w-3 h-3" />}
            {auditOpen ? 'Hide' : 'Show'} last agent actions (audit)
            {auditLoading && ' …'}
          </button>
          {auditOpen && auditEntries.length > 0 && (
            <ul className="mt-1.5 space-y-1.5 max-h-40 overflow-y-auto text-[10px] text-zinc-500 border border-zinc-800 rounded-md p-2 bg-black/20">
              {auditEntries.map((e, i) => {
                const { variant, label } = parseActionIcon(e.result_summary || '')
                return (
                  <li key={i} className="flex items-start gap-1.5 flex-wrap">
                    <ActionIcon variant={variant} className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    <span className="text-zinc-600 shrink-0">{e.source}</span>
                    <span className="text-zinc-500 shrink-0">{e.action_type}</span>
                    <span className="text-zinc-400 truncate min-w-0 flex-1" title={e.result_summary}>{label || e.result_summary || '—'}</span>
                  </li>
                )
              })}
            </ul>
          )}
          {auditOpen && !auditLoading && auditEntries.length === 0 && (
            <p className="mt-1 text-[10px] text-zinc-600">No agent actions recorded yet. Run Overseer or use AI-Q tools.</p>
          )}
        </div>
      )}

      {!isLoading && !error && explainTermsOpen && (
        <div className="mt-4 p-4 rounded-md bg-black/30 border border-zinc-700 text-xs space-y-3">
          <div className="text-zinc-300 font-medium">What this means</div>
          <ul className="space-y-2 text-zinc-400">
            <li>
              <span className="text-zinc-300">Status (Healthy / Degraded / Critical):</span> Overall system health. Healthy = all core services OK. Degraded = some optional services are off or in fallback (e.g. Redis, Neo4j). Critical = core APIs or DB are down.
            </li>
            <li>
              <span className="text-zinc-300">Redis in fallback:</span> Redis is used as a cache and task queue. “Fallback” means the app is using in-memory storage instead, so data is lost on restart. To fix: start Redis and set <code className="text-zinc-500">REDIS_URL</code> in the API environment.
            </li>
            <li>
              <span className="text-zinc-300">Sentinel monitoring stopped:</span> Sentinel agents would push real-time alerts (e.g. CIP, SCSS, SRO). They are currently off; enable if you want live alerting on the dashboard.
            </li>
            <li>
              <span className="text-zinc-300">Neo4j disabled:</span> Neo4j is the knowledge graph (infrastructure nodes and dependencies). It is off by config; enable if you need graph features (e.g. dependency analysis).
            </li>
            <li>
              <span className="text-zinc-300">NVIDIA NIM disabled:</span> NVIDIA NIM is the local AI inference server. Disabled means the app uses cloud LLM (if configured) or no AI. Enable NIM if you want local AI summaries and “Ask Overseer”.
            </li>
            <li>
              <span className="text-zinc-300">Next actions:</span> Suggested steps to improve status (e.g. fix Redis, enable Sentinel, seed PARS assets). Optional; the platform works without them, but with reduced features.
            </li>
            <li>
              <span className="text-zinc-300">System alerts:</span> List of issues detected (Redis, Neo4j, NIM, etc.). Expand “Show details” below to see each alert and its severity.
            </li>
          </ul>
        </div>
      )}

      {/* Action buttons: own row below content so they never overlap "Show more" */}
      {!isLoading && !error && (
        <div className="mt-4 pt-3 border-t border-zinc-800 flex flex-wrap items-center gap-2">
          {alerts.length > 0 && (
            <button
              type="button"
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending}
              className="hover-glow flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs transition-colors disabled:opacity-50"
              title="Run Overseer cycle: the agent will try to auto-fix issues (e.g. reset Redis circuit breaker, reconnect services)"
            >
              <ArrowPathIcon className={`w-4 h-4 ${runMutation.isPending ? 'animate-spin' : ''}`} />
              {runMutation.isPending ? 'Fixing…' : 'Try to fix'}
            </button>
          )}
          <button
            type="button"
            onClick={() => setExplainTermsOpen((v) => !v)}
            className={`hover-glow flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs transition-colors ${explainTermsOpen ? 'bg-zinc-700 text-zinc-200' : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-200'}`}
            title="Show plain-language explanation of status and terms"
          >
            Explain
          </button>
          <button
            type="button"
            onClick={() => { setAskOpen(true); setAskError(null); setAskAnswer(null) }}
            className="hover-glow flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-200 text-xs transition-colors"
            title="Ask Overseer (LLM with sources)"
          >
            Ask
          </button>
          <button
            type="button"
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
            className="hover-glow flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-zinc-200 text-xs transition-colors disabled:opacity-50"
            title="Run Overseer cycle and refresh status"
          >
            <ArrowPathIcon className={`w-4 h-4 ${runMutation.isPending ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      )}

      <AnimatePresence>
        {askOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => { setAskOpen(false); setAskLoading(false) }}
          >
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className="w-full max-w-2xl rounded-md bg-zinc-950/90 border border-zinc-700 p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-display font-semibold text-zinc-300">Ask Overseer</div>
                  <div className="text-[11px] text-zinc-500">Answers include citations and sources.</div>
                </div>
                <button
                  type="button"
                  className="text-zinc-500 hover:text-zinc-300 text-xs"
                  onClick={() => setAskOpen(false)}
                >
                  Close
                </button>
              </div>

              <textarea
                value={askInput}
                onChange={(e) => setAskInput(e.target.value)}
                placeholder="e.g. Why is the system healthy? What should I do next?"
                className="mt-3 w-full min-h-[90px] rounded-md bg-black/40 border border-zinc-700 p-3 text-sm text-zinc-300 placeholder:text-zinc-600 focus:outline-none focus:ring-2 focus:ring-zinc-700"
              />

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-[11px] text-zinc-600">
                  {llm?.available ? `LLM: ${llm.mode || 'cloud'}` : 'LLM not configured'}
                </div>
                <button
                  type="button"
                  disabled={askLoading || askInput.trim().length < 2}
                  className="px-3 py-1.5 rounded-md bg-zinc-700 hover:bg-zinc-700 text-zinc-300 text-xs disabled:opacity-50"
                  onClick={async () => {
                    setAskLoading(true)
                    setAskError(null)
                    setAskAnswer(null)
                    setAskSources([])
                    try {
                      const res = await fetch('/api/v1/aiq/ask', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          question: askInput.trim(),
                          include_overseer_status: true,
                        }),
                      })
                      if (!res.ok) throw new Error(`aiq ask ${res.status}`)
                      const json = await res.json()
                      setAskAnswer(json?.answer ?? '')
                      setAskSources(Array.isArray(json?.sources) ? json.sources : [])
                    } catch (e: any) {
                      setAskError(e?.message ?? 'Failed to ask')
                    } finally {
                      setAskLoading(false)
                    }
                  }}
                >
                  {askLoading ? 'Asking…' : 'Ask'}
                </button>
              </div>

              {askError && <div className="mt-3 text-xs text-amber-400/80">{askError}</div>}

              {askAnswer != null && (
                <div className="mt-3 rounded-md bg-black/30 border border-zinc-700 p-3">
                  <div className="text-[11px] text-zinc-500 mb-1">Answer</div>
                  <pre className="whitespace-pre-wrap break-words text-sm text-zinc-300">{askAnswer}</pre>

                  {askSources.length > 0 && (
                    <>
                      <div className="text-[11px] text-zinc-500 mt-3 mb-1">Sources</div>
                      <ul className="space-y-1">
                        {askSources.slice(0, 10).map((s, i) => (
                          <li key={s.id || i} className="text-[11px] text-zinc-500">
                            <span className="text-zinc-600">[{i + 1}]</span>{' '}
                            <span className="text-zinc-300">{s.title || s.id}</span>
                            {s.kind && <span className="text-zinc-600"> · {s.kind}</span>}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {(alerts.length > 0 || sources.length > 0) && (
        <>
          <button
            type="button"
            onClick={() => setDetailsOpen((o) => !o)}
            className="mt-3 flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-400"
          >
            {detailsOpen ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
            {detailsOpen ? 'Hide' : 'Show'} details
          </button>
          <AnimatePresence>
            {detailsOpen && (
              <motion.ul
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 space-y-1.5 overflow-hidden"
              >
                <li className="p-2 rounded-md bg-black/25 border border-zinc-800 text-xs">
                  <div className="text-zinc-400 font-medium mb-1">Executive summary</div>
                  <pre className="whitespace-pre-wrap break-words text-[11px] text-zinc-400">{summary}</pre>
                </li>

                {sources.length > 0 && (
                  <li className="p-2 rounded-md bg-black/25 border border-zinc-800 text-xs">
                    <div className="text-zinc-400 font-medium mb-1">Sources</div>
                    <ul className="space-y-1">
                      {sources.slice(0, 8).map((s: { id?: string; kind?: string; title?: string; url?: string }, i: number) => (
                        <li key={s.id || i} className="text-[11px] text-zinc-500">
                          <span className="text-zinc-600">[{i + 1}]</span>{' '}
                          <span className="text-zinc-300">{s.title || s.id}</span>
                          {s.kind && <span className="text-zinc-600"> · {s.kind}</span>}
                        </li>
                      ))}
                    </ul>
                  </li>
                )}

                {alerts.map((a: { code?: string; severity?: string; title?: string; message?: string; source?: string }, i: number) => (
                  <li
                    key={a.code || i}
                    className="p-2 rounded-md bg-black/30 border border-zinc-800 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded ${
                        a.severity === 'critical' ? 'bg-red-500/20 text-red-400/80' :
                        a.severity === 'high' ? 'bg-amber-500/20 text-amber-400/80' :
                        'bg-zinc-700 text-zinc-400'
                      }`}>
                        {a.severity || 'info'}
                      </span>
                      <span className="text-zinc-300 font-medium">{a.title || a.code}</span>
                      {a.source && <span className="text-zinc-600">· {a.source}</span>}
                    </div>
                    {a.message && <p className="mt-1 text-zinc-400">{a.message}</p>}
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </>
      )}
      </div>
    </motion.div>
  )
}
