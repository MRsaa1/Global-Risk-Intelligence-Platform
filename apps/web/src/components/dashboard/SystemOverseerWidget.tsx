/**
 * System Overseer Widget
 * Displays OVERSEER status: executive summary, health, system alerts.
 * Fetches GET /api/v1/oversee/status; Refresh runs POST /api/v1/oversee/run.
 * compact: minimal one-line strip for Command Center (corporate, low-profile).
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
} from '@heroicons/react/24/outline'

const OVERSEER_STATUS_KEY = ['oversee', 'status']

async function fetchOverseerStatus() {
  const res = await fetch('/api/v1/oversee/status')
  if (!res.ok) throw new Error(`oversee status ${res.status}`)
  return res.json()
}

async function runOverseerCycle() {
  const res = await fetch('/api/v1/oversee/run', { method: 'POST' })
  if (!res.ok) throw new Error(`oversee run ${res.status}`)
  return res.json()
}

const statusConfigCompact = {
  healthy: { color: 'text-emerald-500/70', bg: 'bg-emerald-500/60', label: 'OK' },
  degraded: { color: 'text-amber-500/70', bg: 'bg-amber-500/60', label: 'Degraded' },
  critical: { color: 'text-red-500/70', bg: 'bg-red-500/60', label: 'Critical' },
}
const statusConfigFull = {
  healthy: { color: 'text-emerald-400', bg: 'bg-emerald-400', label: 'Healthy' },
  degraded: { color: 'text-amber-400', bg: 'bg-amber-400', label: 'Degraded' },
  critical: { color: 'text-red-400', bg: 'bg-red-400', label: 'Critical' },
}

interface SystemOverseerWidgetProps {
  compact?: boolean
}

export default function SystemOverseerWidget({ compact = false }: SystemOverseerWidgetProps) {
  const [detailsOpen, setDetailsOpen] = useState(true)
  const [summaryExpanded, setSummaryExpanded] = useState(false)
  const [askOpen, setAskOpen] = useState(false)
  const [askInput, setAskInput] = useState('')
  const [askAnswer, setAskAnswer] = useState<string | null>(null)
  const [askSources, setAskSources] = useState<Array<{ id?: string; kind?: string; title?: string; url?: string; snippet?: string }>>([])
  const [askError, setAskError] = useState<string | null>(null)
  const [askLoading, setAskLoading] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: OVERSEER_STATUS_KEY,
    queryFn: fetchOverseerStatus,
    refetchInterval: 60_000,
    staleTime: 30_000,
  })

  const runMutation = useMutation({
    mutationFn: runOverseerCycle,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: OVERSEER_STATUS_KEY })
    },
  })

  const status = data?.status || 'healthy'
  const summary = data?.executive_summary || 'No data yet. Run a cycle or wait for the next one.'
  const alerts = data?.system_alerts || []
  const timestamp = data?.timestamp
  const sources = data?.executive_summary_sources || []
  const llm = data?.nvidia?.llm
  const hasLongSummary = typeof summary === 'string' && (summary.length > 220 || summary.includes('\n'))

  const cfgCompact = statusConfigCompact[status as keyof typeof statusConfigCompact] || statusConfigCompact.healthy
  const cfgFull = statusConfigFull[status as keyof typeof statusConfigFull] || statusConfigFull.healthy

  // Compact: one-line corporate strip for Command Center
  if (compact) {
    return (
      <div className="group flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-black/25 border border-white/5">
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${cfgCompact.bg} ${status !== 'healthy' ? 'animate-pulse' : ''}`} />
        <span className="text-white/25 text-[10px] uppercase tracking-widest">Overseer</span>
        <span className="text-white/20">·</span>
        {isLoading && <span className="text-white/20 text-[10px]">—</span>}
        {error && <span className="text-white/30 text-[10px]">Error</span>}
        {!isLoading && !error && (
          <span className={`text-[10px] ${cfgCompact.color}`}>{cfgCompact.label}</span>
        )}
        {alerts.length > 0 && (
          <>
            <span className="text-white/20">·</span>
            <span className="text-amber-500/50 text-[10px]">{alerts.length}</span>
          </>
        )}
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); runMutation.mutate() }}
          disabled={runMutation.isPending}
          className="ml-0.5 opacity-0 group-hover:opacity-40 hover:!opacity-70 transition-opacity disabled:opacity-30"
          title="Run cycle"
        >
          <ArrowPathIcon className={`w-3 h-3 text-white/60 ${runMutation.isPending ? 'animate-spin' : ''}`} />
        </button>
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl p-6 border border-white/5"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <CpuChipIcon className="w-5 h-5 text-white/50" />
            <h2 className="text-sm font-display font-semibold text-white/80">System Overseer</h2>
            <div className={`flex items-center gap-1.5 ${cfgFull.color}`}>
              <div className={`w-2 h-2 rounded-full ${cfgFull.bg} ${status === 'degraded' || status === 'critical' ? 'animate-pulse' : ''}`} />
              <span className="text-xs font-medium">{cfgFull.label}</span>
            </div>
          </div>

          {isLoading && (
            <p className="text-sm text-white/40">Loading…</p>
          )}
          {error && (
            <p className="text-sm text-amber-400">Unable to load. <button type="button" onClick={() => refetch()} className="underline">Retry</button></p>
          )}
          {!isLoading && !error && (
            <div className="text-sm text-white/60">
              <p className={`${summaryExpanded ? 'whitespace-pre-wrap' : 'line-clamp-4'}`}>{summary}</p>
              {hasLongSummary && (
                <button
                  type="button"
                  onClick={() => setSummaryExpanded((v) => !v)}
                  className="mt-1 text-[11px] text-white/35 hover:text-white/55 underline underline-offset-2"
                >
                  {summaryExpanded ? 'Show less' : 'Show more'}
                </button>
              )}
            </div>
          )}

          {!isLoading && !error && llm && (
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[10px]">
              <span className="px-2 py-0.5 rounded bg-white/5 text-white/40 border border-white/5">
                LLM: {llm.mode || 'cloud'} · {llm.available ? 'configured' : 'not configured'}
              </span>
              {!llm.available && (
                <span className="text-amber-400/80">Set NVIDIA_API_KEY (or NVIDIA_LLM_API_KEY) to enable AI summary</span>
              )}
            </div>
          )}

          {timestamp && !isLoading && !error && (
            <p className="text-[10px] text-white/30 mt-2">Updated {new Date(timestamp).toLocaleString()}</p>
          )}
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {alerts.length > 0 && (
            <div className="flex items-center gap-1.5 text-amber-400">
              <ExclamationTriangleIcon className="w-4 h-4" />
              <span className="text-xs font-medium">{alerts.length} system alert{alerts.length !== 1 ? 's' : ''}</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setAskOpen(true); setAskError(null); setAskAnswer(null) }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white/90 text-xs transition-colors"
              title="Ask / Explain with sources"
            >
              Explain
            </button>
            <button
              type="button"
              onClick={() => runMutation.mutate()}
              disabled={runMutation.isPending}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white/90 text-xs transition-colors disabled:opacity-50"
              title="Run Overseer cycle now"
            >
              <ArrowPathIcon className={`w-4 h-4 ${runMutation.isPending ? 'animate-spin' : ''}`} />
              {runMutation.isPending ? 'Running…' : 'Refresh'}
            </button>
          </div>
        </div>
      </div>

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
              className="w-full max-w-2xl rounded-2xl bg-zinc-950/90 border border-white/10 p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-white/80">Ask Overseer</div>
                  <div className="text-[11px] text-white/40">Answers include citations and sources.</div>
                </div>
                <button
                  type="button"
                  className="text-white/40 hover:text-white/70 text-xs"
                  onClick={() => setAskOpen(false)}
                >
                  Close
                </button>
              </div>

              <textarea
                value={askInput}
                onChange={(e) => setAskInput(e.target.value)}
                placeholder="e.g. Why is the system healthy? What should I do next?"
                className="mt-3 w-full min-h-[90px] rounded-lg bg-black/40 border border-white/10 p-3 text-sm text-white/80 placeholder:text-white/30 focus:outline-none focus:ring-2 focus:ring-white/10"
              />

              <div className="mt-3 flex items-center justify-between gap-3">
                <div className="text-[11px] text-white/30">
                  {llm?.available ? `LLM: ${llm.mode || 'cloud'}` : 'LLM not configured'}
                </div>
                <button
                  type="button"
                  disabled={askLoading || askInput.trim().length < 2}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-white/80 text-xs disabled:opacity-50"
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

              {askError && <div className="mt-3 text-xs text-amber-400">{askError}</div>}

              {askAnswer != null && (
                <div className="mt-3 rounded-lg bg-black/30 border border-white/10 p-3">
                  <div className="text-[11px] text-white/40 mb-1">Answer</div>
                  <pre className="whitespace-pre-wrap break-words text-sm text-white/75">{askAnswer}</pre>

                  {askSources.length > 0 && (
                    <>
                      <div className="text-[11px] text-white/40 mt-3 mb-1">Sources</div>
                      <ul className="space-y-1">
                        {askSources.slice(0, 10).map((s, i) => (
                          <li key={s.id || i} className="text-[11px] text-white/45">
                            <span className="text-white/30">[{i + 1}]</span>{' '}
                            <span className="text-white/70">{s.title || s.id}</span>
                            {s.kind && <span className="text-white/25"> · {s.kind}</span>}
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
            className="mt-3 flex items-center gap-1 text-xs text-white/40 hover:text-white/60"
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
                <li className="p-2 rounded-lg bg-black/25 border border-white/5 text-xs">
                  <div className="text-white/60 font-medium mb-1">Executive summary</div>
                  <pre className="whitespace-pre-wrap break-words text-[11px] text-white/55">{summary}</pre>
                </li>

                {sources.length > 0 && (
                  <li className="p-2 rounded-lg bg-black/25 border border-white/5 text-xs">
                    <div className="text-white/60 font-medium mb-1">Sources</div>
                    <ul className="space-y-1">
                      {sources.slice(0, 8).map((s: { id?: string; kind?: string; title?: string; url?: string }, i: number) => (
                        <li key={s.id || i} className="text-[11px] text-white/45">
                          <span className="text-white/30">[{i + 1}]</span>{' '}
                          <span className="text-white/70">{s.title || s.id}</span>
                          {s.kind && <span className="text-white/25"> · {s.kind}</span>}
                        </li>
                      ))}
                    </ul>
                  </li>
                )}

                {alerts.map((a: { code?: string; severity?: string; title?: string; message?: string; source?: string }, i: number) => (
                  <li
                    key={a.code || i}
                    className="p-2 rounded-lg bg-black/30 border border-white/5 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <span className={`px-1.5 py-0.5 rounded ${
                        a.severity === 'critical' ? 'bg-red-500/20 text-red-400' :
                        a.severity === 'high' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-white/10 text-white/60'
                      }`}>
                        {a.severity || 'info'}
                      </span>
                      <span className="text-white/80 font-medium">{a.title || a.code}</span>
                      {a.source && <span className="text-white/30">· {a.source}</span>}
                    </div>
                    {a.message && <p className="mt-1 text-white/50">{a.message}</p>}
                  </li>
                ))}
              </motion.ul>
            )}
          </AnimatePresence>
        </>
      )}
    </motion.div>
  )
}
