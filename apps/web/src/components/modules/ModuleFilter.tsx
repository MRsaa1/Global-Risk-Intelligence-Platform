/**
 * ModuleFilter - Filter component for strategic modules
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
          className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-white/30 focus:outline-none focus:border-amber-500/30"
        />
      </div>

      {/* Phase Filter */}
      <div className="flex items-center gap-2">
        <span className="text-white/50 text-sm">Phase:</span>
        <div className="flex gap-1">
          {[null, 1, 2, 3, 4].map((p) => (
            <button
              key={p ?? 'all'}
              onClick={() => handlePhaseChange(p)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                phase === p
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
              }`}
            >
              {p ? `Phase ${p}` : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Access Filter */}
      <div className="flex items-center gap-2">
        <span className="text-white/50 text-sm">Access:</span>
        <div className="flex gap-1">
          {[null, 'public', 'commercial', 'classified', 'meta'].map((a) => (
            <button
              key={a ?? 'all'}
              onClick={() => handleAccessChange(a as ModuleAccessLevel | null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                access === a
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
              }`}
            >
              {a ? a.charAt(0).toUpperCase() + a.slice(1) : 'All'}
            </button>
          ))}
        </div>
      </div>

      {/* Status Filter */}
      <div className="flex items-center gap-2">
        <span className="text-white/50 text-sm">Status:</span>
        <div className="flex gap-1">
          {[null, 'active', 'planned', 'locked', 'coming-soon'].map((s) => (
            <button
              key={s ?? 'all'}
              onClick={() => handleStatusChange(s as ModuleStatus | null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                status === s
                  ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  : 'bg-white/5 text-white/60 border border-white/10 hover:bg-white/10'
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
