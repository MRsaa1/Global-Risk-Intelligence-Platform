/**
 * Strategic Modules — Main page for strategic modules (CIP, SCSS, SRO, etc.).
 * Unified Corporate Style 100%: design tokens (zinc), section labels font-mono text-[10px]
 * uppercase tracking-widest text-zinc-500, rounded-md only, no slate/blur. See Implementation Audit.
 */
import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Square3Stack3DIcon } from '@heroicons/react/24/outline'
import { STRATEGIC_MODULES, StrategicModule, ModulePhase, ModuleAccessLevel, ModuleStatus } from '../lib/modules'
import ModuleCard from '../components/modules/ModuleCard'
import ModuleFilter from '../components/modules/ModuleFilter'

export default function StrategicModules() {
  const [filters, setFilters] = useState<{
    phase: ModulePhase | null
    access: ModuleAccessLevel | null
    status: ModuleStatus | null
    search: string
  }>({
    phase: null,
    access: null,
    status: null,
    search: '',
  })

  const filteredModules = useMemo(() => {
    return STRATEGIC_MODULES.filter((module) => {
      if (filters.phase && module.phase !== filters.phase) return false
      if (filters.access && module.accessLevel !== filters.access) return false
      if (filters.status && module.status !== filters.status) return false
      if (filters.search) {
        const searchLower = filters.search.toLowerCase()
        return (
          module.name.toLowerCase().includes(searchLower) ||
          module.fullName.toLowerCase().includes(searchLower) ||
          module.description.toLowerCase().includes(searchLower)
        )
      }
      return true
    })
  }, [filters])

  // Group modules by phase
  const modulesByPhase = useMemo(() => {
    const grouped: Record<ModulePhase, StrategicModule[]> = {
      1: [],
      2: [],
      3: [],
      4: [],
    }
    filteredModules.forEach((module) => {
      grouped[module.phase].push(module)
    })
    return grouped
  }, [filteredModules])

  return (
    <div className="min-h-full p-6 bg-zinc-950">
      <div className="w-full max-w-[1920px] mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-zinc-800 rounded-md border border-zinc-700">
              <Square3Stack3DIcon className="w-8 h-8 text-zinc-400" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-semibold text-zinc-100">
                Strategic Modules
              </h1>
              <p className="text-zinc-500 text-sm mt-1 font-sans">
                Civilization-Scale Risk Management Operating System
              </p>
            </div>
          </div>
          <p className="text-zinc-500/90 text-sm max-w-3xl font-sans">
            Transform the Physical-Financial Risk Platform into a comprehensive Operating System 
            for managing civilization-scale risks over a 30-year horizon. Each module leverages 
            the existing 5-Layer Architecture to provide specialized capabilities.
          </p>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <ModuleFilter onFilterChange={setFilters} />
        </motion.div>

        {/* Modules Grid - Grouped by Phase */}
        <div className="space-y-12">
          {([1, 2, 3, 4] as ModulePhase[]).map((phase) => {
            const phaseModules = modulesByPhase[phase]
            if (phaseModules.length === 0) return null

            return (
              <motion.div
                key={phase}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + phase * 0.1 }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
                      Phase {phase}
                    </span>
                    <span className="px-2 py-1 bg-zinc-800 text-zinc-400 text-xs rounded-md border border-zinc-700">
                      {phaseModules.length} module{phaseModules.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {phaseModules.map((module) => (
                    <ModuleCard key={module.id} module={module} />
                  ))}
                </div>
              </motion.div>
            )
          })}
        </div>

        {/* Empty State */}
        {filteredModules.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-16"
          >
            <Square3Stack3DIcon className="w-16 h-16 mx-auto text-zinc-600 mb-4" />
            <p className="text-zinc-400/80 text-lg mb-2 font-sans">No modules found</p>
            <p className="text-zinc-500/90 text-sm font-sans">
              Try adjusting your filters to see more modules
            </p>
          </motion.div>
        )}

        {/* Info Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 p-6 bg-zinc-900 rounded-md border border-zinc-800"
        >
          <h3 className="text-zinc-100 font-semibold mb-3 font-display">About Strategic Modules</h3>
          <p className="text-zinc-400/80 text-sm mb-4 font-sans">
            Strategic Modules are specialized applications built on top of the existing 5-Layer Architecture. 
            They extend the platform's capabilities without replacing existing functionality, ensuring 
            backward compatibility while enabling new use cases.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-sans">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Integration Points</p>
              <ul className="text-zinc-400/80 space-y-1 list-disc list-inside">
                <li>Knowledge Graph (Layer 2)</li>
                <li>Simulation Engine (Layer 3)</li>
                <li>Autonomous Agents (Layer 4)</li>
                <li>Digital Twins (Layer 1)</li>
              </ul>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Access Levels</p>
              <ul className="text-zinc-400/80 space-y-1">
                <li><span className="text-zinc-300">Public</span> — Available to all users</li>
                <li><span className="text-zinc-300">Commercial</span> — Requires authentication</li>
                <li><span className="text-zinc-300">Classified</span> — Requires security clearance</li>
                <li><span className="text-zinc-300">Meta</span> — Requires meta-level access</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
