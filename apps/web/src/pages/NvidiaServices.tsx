/**
 * NVIDIA Services — status of all NVIDIA products used by the platform.
 * Includes: LLM (Cloud API), AI Orchestration, NIM (FourCastNet, CorrDiff, FLUX), Earth-2, PhysicsNeMo, NeMo, Riva.
 * Data: GET /api/v1/health/nvidia. Each card shows Source (config/env) and Call (API/invocation).
 * API keys (env): listed in "Keys used" section — set in apps/api/.env.
 */
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowPathIcon,
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon,
  CpuChipIcon,
  ServerStackIcon,
} from '@heroicons/react/24/outline'

const API_NVIDIA = '/api/v1/health/nvidia'

async function fetchNvidiaStatus() {
  const res = await fetch(API_NVIDIA)
  if (!res.ok) throw new Error(`NVIDIA status ${res.status}`)
  return res.json()
}

interface NvidiaServiceItem {
  product?: string
  used_for?: string
  configured?: boolean
  status?: string
  mode?: string
  url?: string
  ready?: boolean
  models?: Record<string, string>
  source?: string
  call?: string
}

function StatusBadge({ status, ready }: { status?: string; ready?: boolean }) {
  const s = (status || '').toLowerCase()
  const ok = s === 'available' || s === 'enabled' || ready === true
  const warn = s === 'disabled' || s === 'not_configured'
  if (ok) return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-500/20 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-emerald-400/80"><CheckCircleIcon className="w-3.5 h-3.5" /> OK</span>
  if (warn) return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-500/20 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-amber-400/80"><ExclamationTriangleIcon className="w-3.5 h-3.5" /> {status || '—'}</span>
  return <span className="inline-flex items-center gap-1 rounded-full bg-zinc-500/20 border border-zinc-500/20 px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-zinc-400"><XCircleIcon className="w-3.5 h-3.5" /> {status || '—'}</span>
}

export default function NvidiaServices() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['nvidia', 'health'],
    queryFn: fetchNvidiaStatus,
    refetchInterval: 60_000,
  })

  const services = (data?.nvidia_services || data) as Record<string, NvidiaServiceItem>
  const isError = typeof services?.error === 'string'

  return (
    <div className="min-h-full bg-zinc-950 p-6 text-zinc-100">
      <div className="w-full max-w-[1920px] mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-zinc-900/80 border border-zinc-800/60 p-2.5">
              <CpuChipIcon className="w-8 h-8 text-zinc-400/80" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-semibold text-zinc-100 tracking-tight">NVIDIA Services</h1>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-1">
                Live status from API. Source &amp; Call per service below (LLM, AI Orchestration, NIM, Earth-2, PhysicsNeMo, NeMo). Page data: GET {API_NVIDIA}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/command"
              className="flex items-center gap-2 rounded-md bg-zinc-800 border border-zinc-700 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-700 transition-colors"
            >
              <ServerStackIcon className="w-4 h-4" />
              Command Center
            </Link>
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-md bg-zinc-800 border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-100 hover:bg-zinc-700 transition-colors disabled:opacity-50"
            >
              <ArrowPathIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="rounded-md border border-zinc-800/60 bg-zinc-900/50 p-8 text-center font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            Loading...
          </div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-md border border-red-500/30 bg-red-500/10 p-6 text-red-400/80 font-sans text-sm"
          >
            Load error: {(error as Error).message}. Ensure API is running on port 9002.
          </motion.div>
        )}

        {isError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-md border border-amber-500/30 bg-amber-500/10 p-6 text-amber-400/80 font-sans text-sm"
          >
            {String((services as { error?: unknown }).error ?? '')}
          </motion.div>
        )}

        {/* API keys used — env vars (no values); set in apps/api/.env */}
        <section className="mb-8 rounded-md border border-zinc-800/60 bg-zinc-900/50 p-5">
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3 flex items-center gap-2">
            <CpuChipIcon className="w-4 h-4 text-zinc-500" />
            API keys used (env)
          </h2>
          <p className="text-xs text-zinc-500/90 font-sans mb-4">Set these in <code className="bg-zinc-800/80 px-1 rounded font-mono text-zinc-400">apps/api/.env</code>. Values are never shown.</p>
          <ul className="space-y-2 text-sm font-sans">
            <li className="flex flex-wrap gap-x-4 gap-y-1">
              <code className="text-emerald-400/80 font-mono">NVIDIA_API_KEY</code>
              <span className="text-zinc-500">or</span>
              <code className="text-emerald-400/80 font-mono">NVIDIA_LLM_API_KEY</code>
              <span className="text-zinc-400">— LLM (Cloud), NeMo Retriever, Data Designer, Earth-2 fallback, PhysicsNeMo, AI Orchestration, Overseer, Riva (cloud)</span>
            </li>
            <li className="flex flex-wrap gap-x-2 gap-y-1">
              <code className="text-zinc-400 font-mono">NVIDIA_CORRDIFF_API_KEY</code>
              <span className="text-zinc-500">— CorrDiff NIM (optional)</span>
            </li>
            <li className="flex flex-wrap gap-x-2 gap-y-1">
              <code className="text-zinc-400 font-mono">NVIDIA_FOURCASTNET_API_KEY</code>
              <span className="text-zinc-500">— FourCastNet / Earth-2 (optional)</span>
            </li>
            <li className="flex flex-wrap gap-x-2 gap-y-1">
              <code className="text-zinc-400 font-mono">NVIDIA_FLUX_API_KEY</code>
              <span className="text-zinc-500">— FLUX NIM (optional)</span>
            </li>
            <li className="flex flex-wrap gap-x-2 gap-y-1">
              <code className="text-zinc-400 font-mono">NGC_API_KEY</code>
              <span className="text-zinc-500">— NGC catalog / containers (optional)</span>
            </li>
          </ul>
        </section>

        {!isLoading && !error && !isError && services && typeof services === 'object' && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-4"
          >
            {Object.entries(services).map(([key, item]) => {
              if (key === 'error' || !item || typeof item !== 'object') return null
              const product = item.product || key
              const usedFor = item.used_for || ''
              const status = item.status
              const url = item.url
              const ready = item.ready
              const models = item.models
              const mode = item.mode
              const source = item.source
              const call = item.call

              return (
                <div
                  key={key}
                  className="rounded-md border border-zinc-800/60 bg-zinc-900/50 p-5 hover:border-zinc-700/60 transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <ServerStackIcon className="w-6 h-6 text-zinc-500 shrink-0" />
                      <div>
                        <h2 className="text-sm font-semibold text-zinc-100">{product}</h2>
                        {usedFor && <p className="text-xs text-zinc-500/90 font-sans mt-0.5">{usedFor}</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {mode && <span className="text-xs text-zinc-500">mode: {mode}</span>}
                      <StatusBadge status={status} ready={ready} />
                    </div>
                  </div>
                  {url && url !== '(not set)' && (
                    <p className="mt-3 text-xs text-zinc-500 font-mono tabular-nums">{url}</p>
                  )}
                  {source != null && source !== '' && (
                    <div className="mt-3 pt-3 border-t border-zinc-800/60">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Source</p>
                      <p className="text-sm text-zinc-300/90 font-mono">{source}</p>
                    </div>
                  )}
                  {call != null && call !== '' && call !== '—' && (
                    <div className="mt-2">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Call</p>
                      <p className="text-sm text-zinc-300/90 font-mono break-all">{call}</p>
                    </div>
                  )}
                  {models && Object.keys(models).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-zinc-800/60">
                      <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Models</p>
                      <ul className="text-sm text-zinc-300 space-y-1">
                        {Object.entries(models).map(([name, model]) => (
                          <li key={name} className="font-mono">
                            <span className="text-zinc-500">{name}:</span> {model}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )
            })}
          </motion.div>
        )}
      </div>
    </div>
  )
}
