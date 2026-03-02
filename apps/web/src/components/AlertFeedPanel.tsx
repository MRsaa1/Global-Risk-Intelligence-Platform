/**
 * AlertFeedPanel — reusable agent alert feed.
 * Shows live alerts from SENTINEL agents, with severity badges and actions.
 * Can be filtered by module (srs, cityos, etc.) or show all.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BellAlertIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ShieldExclamationIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline'
import { listAlerts, acknowledgeAlert, resolveAlert, type Alert } from '../services/alertsApi'

const SEVERITY_CONFIG = {
  critical: { color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/30', icon: XCircleIcon, label: 'CRITICAL' },
  high: { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: ShieldExclamationIcon, label: 'HIGH' },
  medium: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/30', icon: ExclamationTriangleIcon, label: 'MEDIUM' },
  low: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/30', icon: BellAlertIcon, label: 'LOW' },
} as const

interface AlertFeedPanelProps {
  moduleFilter?: string
  limit?: number
  compact?: boolean
  title?: string
}

export default function AlertFeedPanel({ moduleFilter, limit = 20, compact = false, title = 'Agent Alerts' }: AlertFeedPanelProps) {
  const [expanded, setExpanded] = useState(!compact)
  const [error, setError] = useState<string | null>(null)
  const [pendingAckId, setPendingAckId] = useState<string | null>(null)
  const [pendingResolveId, setPendingResolveId] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ['alerts', moduleFilter, limit],
    queryFn: () => listAlerts({ unresolved_only: true, limit }),
    refetchInterval: 15_000,
  })

  const filtered = moduleFilter
    ? alerts.filter((a) => a.source?.toLowerCase().includes(moduleFilter) || a.module?.toLowerCase() === moduleFilter)
    : alerts

  const ackMutation = useMutation({
    mutationFn: (id: string) => acknowledgeAlert(id),
    onMutate: (id) => setPendingAckId(id),
    onSuccess: () => {
      setError(null)
      setPendingAckId(null)
      qc.invalidateQueries({ queryKey: ['alerts'] })
    },
    onError: (err: Error) => {
      setPendingAckId(null)
      setError(err?.message || 'Failed to acknowledge')
    },
  })

  const resolveMutation = useMutation({
    mutationFn: (id: string) => resolveAlert(id),
    onMutate: async (id) => {
      setPendingResolveId(id)
      setError(null)
      await qc.cancelQueries({ queryKey: ['alerts'] })
      // Update every alerts query (any key starting with ['alerts']) so the row disappears for all panels
      qc.setQueriesData<Alert[]>(
        { queryKey: ['alerts'] },
        (old) => (Array.isArray(old) ? old.filter((a) => a.id !== id) : old),
      )
      return { prevId: id }
    },
    onSuccess: (_data, _id) => {
      setPendingResolveId(null)
      // Do NOT refetch on success — cache already updated optimistically; refetch can bring back the alert if multiple API workers
    },
    onError: (err: unknown) => {
      setPendingResolveId(null)
      const msg = err instanceof Error ? err.message : String(err)
      setError(msg || 'Failed to resolve')
      qc.invalidateQueries({ queryKey: ['alerts'] })
    },
  })

  const critCount = filtered.filter((a) => a.severity === 'critical').length
  const highCount = filtered.filter((a) => a.severity === 'high').length

  if (compact) {
    return (
      <div className="rounded-md border border-zinc-800 bg-zinc-900 px-4 py-3">
        <button onClick={() => setExpanded((v) => !v)} className="w-full flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BellAlertIcon className="w-4 h-4 text-zinc-500" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{title}</span>
            {critCount > 0 && <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-red-500/20 text-red-400">{critCount} crit</span>}
            {highCount > 0 && <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-orange-500/20 text-orange-400">{highCount} high</span>}
            {filtered.length === 0 && <span className="text-zinc-600 text-[10px]">No active alerts</span>}
          </div>
          {expanded ? <ChevronUpIcon className="w-4 h-4 text-zinc-500" /> : <ChevronDownIcon className="w-4 h-4 text-zinc-500" />}
        </button>
        <AnimatePresence>
          {expanded && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="pt-3 space-y-2 max-h-64 overflow-y-auto">
                {renderAlertList(filtered, ackMutation, resolveMutation, isLoading, pendingAckId, pendingResolveId, error, setError)}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BellAlertIcon className="w-5 h-5 text-zinc-500" />
          <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{title}</h3>
        </div>
        <div className="flex items-center gap-2">
          {critCount > 0 && <span className="px-2 py-1 rounded text-xs font-mono bg-red-500/20 text-red-400 border border-red-500/30">{critCount} critical</span>}
          {highCount > 0 && <span className="px-2 py-1 rounded text-xs font-mono bg-orange-500/20 text-orange-400 border border-orange-500/30">{highCount} high</span>}
          <span className="text-zinc-600 text-xs">{filtered.length} active</span>
        </div>
      </div>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {renderAlertList(filtered, ackMutation, resolveMutation, isLoading, pendingAckId, pendingResolveId, error, setError)}
      </div>
    </div>
  )
}

function renderAlertList(
  alerts: Alert[],
  ackMutation: { mutate: (id: string) => void; isPending: boolean },
  resolveMutation: { mutate: (id: string) => void; isPending: boolean },
  isLoading: boolean,
  pendingAckId: string | null,
  pendingResolveId: string | null,
  error: string | null,
  setError: (v: string | null) => void,
) {
  if (isLoading) {
    return <p className="text-zinc-600 text-sm py-2">Loading alerts...</p>
  }
  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 py-4 justify-center">
        <CheckCircleIcon className="w-5 h-5 text-emerald-500/60" />
        <span className="text-zinc-500 text-sm">All clear — no active alerts</span>
      </div>
    )
  }
  return (
    <>
      {error && (
        <div className="flex items-center justify-between gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-red-400 text-xs">
          <span>{error}</span>
          <button type="button" onClick={() => setError(null)} className="text-red-400 hover:text-red-300 font-medium">
            Dismiss
          </button>
        </div>
      )}
      {alerts.map((alert) => {
    const cfg = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.low
    const Icon = cfg.icon
    return (
      <motion.div
        key={alert.id}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        className={`rounded-md border ${cfg.border} ${cfg.bg} p-3`}
      >
        <div className="flex items-start gap-3">
          <Icon className={`w-4 h-4 mt-0.5 flex-shrink-0 ${cfg.color}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`font-mono text-[10px] font-bold ${cfg.color}`}>{cfg.label}</span>
              <span className="font-mono text-[10px] text-zinc-500">{alert.source}</span>
              <span className="text-zinc-600 text-[10px]">{new Date(alert.timestamp).toLocaleTimeString()}</span>
            </div>
            <p className="text-zinc-200 text-sm mt-1">{alert.title}</p>
            {alert.description && <p className="text-zinc-500 text-xs mt-1 line-clamp-2">{alert.description}</p>}
            {alert.exposure != null && alert.exposure > 0 && (
              <span className="inline-block mt-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-zinc-800 text-zinc-400">€{alert.exposure >= 1000 ? `${(alert.exposure / 1000).toFixed(1)}K` : alert.exposure.toFixed(0)}</span>
            )}
          </div>
          <div className="flex gap-1 flex-shrink-0">
            {!alert.acknowledged && (
              <button
                onClick={() => ackMutation.mutate(alert.id)}
                disabled={pendingAckId !== null || pendingResolveId !== null}
                className="px-2 py-1 rounded text-[10px] font-mono bg-zinc-800 border border-zinc-700 text-zinc-400 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                title="Acknowledge"
              >
                {pendingAckId === alert.id ? '…' : 'ACK'}
              </button>
            )}
            <button
              onClick={() => resolveMutation.mutate(alert.id)}
              disabled={pendingAckId !== null || pendingResolveId !== null}
              className="px-2 py-1 rounded text-[10px] font-mono bg-zinc-800 border border-zinc-700 text-emerald-400 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Resolve"
            >
              {pendingResolveId === alert.id ? '…' : 'Resolve'}
            </button>
          </div>
        </div>
      </motion.div>
    )
  })}
    </>
  )
}
