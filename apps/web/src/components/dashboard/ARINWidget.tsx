/**
 * ARIN Widget (Risk & Intelligence OS)
 * Displays ARIN/audit layer status for Command Center.
 * Checks GET /api/v1/audit/actions as lightweight health for Decision Object / audit layer.
 * compact: minimal one-line strip for Command Center.
 */
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { ShieldCheckIcon } from '@heroicons/react/24/outline'

const ARIN_STATUS_KEY = ['arin', 'status']

async function fetchARINStatus() {
  const res = await fetch('/api/v1/audit/actions')
  if (!res.ok) throw new Error(`audit actions ${res.status}`)
  return res.json()
}

interface ARINWidgetProps {
  compact?: boolean
}

export default function ARINWidget({ compact = false }: ARINWidgetProps) {
  const { isLoading, error } = useQuery({
    queryKey: ARIN_STATUS_KEY,
    queryFn: fetchARINStatus,
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  })

  if (compact) {
    return (
      <Link
        to="/arin"
        className="group flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-black/25 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 transition-colors"
        title="Risk & Intelligence OS (ARIN)"
      >
        <div
          className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
            isLoading ? 'bg-zinc-600' : error ? 'bg-red-500/60 animate-pulse' : 'bg-zinc-500'
          }`}
        />
        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">ARIN</span>
        <span className="text-zinc-700">·</span>
        {isLoading && <span className="text-zinc-700 text-[10px]">—</span>}
        {error && <span className="text-red-500/70 text-[10px]">Error</span>}
        {!isLoading && !error && (
          <span className="text-zinc-400 text-[10px]">Ready</span>
        )}
      </Link>
    )
  }

  return (
    <Link
      to="/arin"
      className="flex items-center gap-3 px-4 py-3 rounded-md bg-black/25 border border-zinc-800 hover:border-zinc-700 hover:bg-zinc-800 transition-colors"
      title="Risk & Intelligence OS (ARIN)"
    >
      <ShieldCheckIcon className="w-5 h-5 text-zinc-400" />
      <div>
        <div className="text-sm font-medium text-zinc-300">ARIN</div>
        <div className="text-[10px] text-zinc-400">
          {isLoading ? 'Checking…' : error ? 'Unavailable' : 'Risk & Intelligence OS'}
        </div>
      </div>
      <div
        className={`w-2 h-2 rounded-full flex-shrink-0 ${
          isLoading ? 'bg-zinc-600' : error ? 'bg-red-500/60' : 'bg-zinc-500'
        } ${!isLoading && !error ? 'animate-pulse' : ''}`}
      />
    </Link>
  )
}
