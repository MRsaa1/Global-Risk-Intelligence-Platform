/**
 * NVIDIA Services — status of all NVIDIA products used by the platform.
 * Includes: LLM (Cloud API), AI Orchestration (multi-model consensus for stress tests), NIM (FourCastNet, CorrDiff, FLUX), Earth-2, PhysicsNeMo, NeMo stack.
 * Data: GET /api/v1/health/nvidia. Each card shows Source (config/env) and Call (API/invocation).
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
  if (ok) return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-400"><CheckCircleIcon className="w-3.5 h-3.5" /> OK</span>
  if (warn) return <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400"><ExclamationTriangleIcon className="w-3.5 h-3.5" /> {status || '—'}</span>
  return <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/20 px-2 py-0.5 text-xs text-slate-400"><XCircleIcon className="w-3.5 h-3.5" /> {status || '—'}</span>
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
    <div className="min-h-screen bg-[#0a0e17] text-white p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-gradient-to-br from-green-600 to-green-800 p-2.5">
              <CpuChipIcon className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">NVIDIA Services</h1>
              <p className="text-sm text-slate-400">
                Live status from API. Source &amp; Call per service below (LLM, AI Orchestration, NIM, Earth-2, PhysicsNeMo, NeMo). Page data: <code className="text-amber-400/80">GET {API_NVIDIA}</code>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/command"
              className="flex items-center gap-2 rounded-xl bg-slate-700/80 px-3 py-2 text-sm text-white hover:bg-slate-600 transition-colors"
            >
              <ServerStackIcon className="w-4 h-4" />
              Command Center
            </Link>
            <button
              onClick={() => refetch()}
              disabled={isLoading}
              className="flex items-center gap-2 rounded-xl bg-slate-700/80 px-4 py-2 text-sm font-medium text-white hover:bg-slate-600 transition-colors disabled:opacity-50"
            >
              <ArrowPathIcon className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {isLoading && (
          <div className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-8 text-center text-slate-400">
            Loading...
          </div>
        )}

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-red-500/40 bg-red-500/10 p-6 text-red-400"
          >
            Load error: {(error as Error).message}. Ensure API is running on port 9002.
          </motion.div>
        )}

        {isError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-6 text-amber-400"
          >
            {services.error}
          </motion.div>
        )}

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
                  className="rounded-2xl border border-slate-700/60 bg-slate-800/40 p-5 hover:border-slate-600 transition-colors"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <ServerStackIcon className="w-6 h-6 text-slate-500 shrink-0" />
                      <div>
                        <h2 className="font-semibold text-white">{product}</h2>
                        {usedFor && <p className="text-sm text-slate-400 mt-0.5">{usedFor}</p>}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {mode && <span className="text-xs text-slate-500">mode: {mode}</span>}
                      <StatusBadge status={status} ready={ready} />
                    </div>
                  </div>
                  {url && url !== '(not set)' && (
                    <p className="mt-3 text-xs text-slate-500 font-mono">{url}</p>
                  )}
                  {source != null && source !== '' && (
                    <div className="mt-3 pt-3 border-t border-slate-700/50">
                      <p className="text-xs text-slate-500 mb-1">Source</p>
                      <p className="text-sm text-slate-300 font-mono">{source}</p>
                    </div>
                  )}
                  {call != null && call !== '' && call !== '—' && (
                    <div className="mt-2">
                      <p className="text-xs text-slate-500 mb-1">Call</p>
                      <p className="text-sm text-slate-300 font-mono break-all">{call}</p>
                    </div>
                  )}
                  {models && Object.keys(models).length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-700/50">
                      <p className="text-xs text-slate-500 mb-1">Models</p>
                      <ul className="text-sm text-slate-300 space-y-1">
                        {Object.entries(models).map(([name, model]) => (
                          <li key={name} className="font-mono">
                            <span className="text-slate-500">{name}:</span> {model}
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
