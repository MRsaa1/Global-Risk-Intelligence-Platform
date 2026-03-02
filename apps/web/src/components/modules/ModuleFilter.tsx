/**
 * ModuleFilter — Filter component for Strategic Modules.
 * Unified Corporate Style: section labels font-mono text-[10px] uppercase tracking-widest text-zinc-500.
 */
import { useState } from 'react'
import { ModulePhase, ModuleAccessLevel, ModuleStatus } from '../../lib/modules'

interface ModuleFilterProps {
  onFilterChange: (filters: {
    phase: ModulePhase | null
    access: ModuleAccessLevel | null
    status: ModuleStatus | null
    search: string
  }) => void
}

export default function ModuleFilter({ onFilterChange }: ModuleFilterProps) {
  const [phase, setPhase] = useState<ModulePhase | null>(null)
  const [access, setAccess] = useState<ModuleAccessLevel | null>(null)
  const [status, setStatus] = useState<ModuleStatus | null>(null)
  const [search, setSearch] = useState('')

  const handlePhaseChange = (newPhase: ModulePhase | null) => {
    setPhase(newPhase)
    onFilterChange({ phase: newPhase, access, status, search })
  }

  const handleAccessChange = (newAccess: ModuleAccessLevel | null) => {
    setAccess(newAccess)
    onFilterChange({ phase, access: newAccess, status, search })
  }

  const handleStatusChange = (newStatus: ModuleStatus | null) => {
    setStatus(newStatus)
    onFilterChange({ phase, access, status: newStatus, search })
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    onFilterChange({ phase, access, status, search: value })
  }

  return (
    <div className="flex flex-wrap items-center gap-4 mb-6">
      {/* Search */}
      <div className="flex-1 min-w-[200px]">
        <input
          type="text"
          placeholder="Search modules..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 font-sans"
        />
      </div>

      {/* Phase Filter */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Phase:</span>
        <div className="flex gap-1">
          {([null, 1, 2, 3, 4] as (ModulePhase | null)[]).map((p) => (
            <button
              key={p ?? 'all'}
              onClick={() => handlePhaseChange(p)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all border ${
                phase === p
                  ? 'bg-zinc-700 text-zinc-100 border-zinc-600'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
              }`}
            >
              {p ? `Phase ${p}` : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Access Filter */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Access:</span>
        <div className="flex gap-1">
          {[null, 'public', 'commercial', 'classified', 'meta'].map((a) => (
            <button
              key={a ?? 'all'}
              onClick={() => handleAccessChange(a as ModuleAccessLevel | null)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all border ${
                access === a
                  ? 'bg-zinc-700 text-zinc-100 border-zinc-600'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
              }`}
            >
              {a ? a.charAt(0).toUpperCase() + a.slice(1) : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Status:</span>
        <div className="flex gap-1">
          {[null, 'active', 'planned', 'locked', 'coming-soon'].map((s) => (
            <button
              key={s ?? 'all'}
              onClick={() => handleStatusChange(s as ModuleStatus | null)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all border ${
                status === s
                  ? 'bg-zinc-700 text-zinc-100 border-zinc-600'
                  : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
              }`}
            >
              {s ? s.replace('-', ' ') : 'All'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
