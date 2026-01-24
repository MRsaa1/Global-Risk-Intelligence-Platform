/**
 * Strategic Modules - Main page for all 10 strategic modules
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
    <div className="h-full overflow-auto p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-white/5 rounded-xl border border-white/10">
              <Square3Stack3DIcon className="w-8 h-8 text-white/70" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-bold text-white/90">
                Strategic Modules
              </h1>
              <p className="text-white/50 text-sm mt-1">
                Civilization-Scale Risk Management Operating System
              </p>
            </div>
          </div>
          <p className="text-white/60 text-sm max-w-3xl">
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
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                  <div className="flex items-center gap-2">
                    <span className="text-white/50 text-xs uppercase tracking-wider">
                      Phase {phase}
                    </span>
                    <span className="px-2 py-1 bg-white/5 text-white/60 text-xs rounded">
                      {phaseModules.length} module{phaseModules.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="h-px flex-1 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
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
            <Square3Stack3DIcon className="w-16 h-16 mx-auto text-white/20 mb-4" />
            <p className="text-white/60 text-lg mb-2">No modules found</p>
            <p className="text-white/40 text-sm">
              Try adjusting your filters to see more modules
            </p>
          </motion.div>
        )}

        {/* Info Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 p-6 bg-white/5 rounded-2xl border border-white/10"
        >
          <h3 className="text-white/90 font-semibold mb-3">About Strategic Modules</h3>
          <p className="text-white/70 text-sm mb-4">
            Strategic Modules are specialized applications built on top of the existing 5-Layer Architecture. 
            They extend the platform's capabilities without replacing existing functionality, ensuring 
            backward compatibility while enabling new use cases.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-white/50 mb-2">Integration Points:</p>
              <ul className="text-white/60 space-y-1 list-disc list-inside">
                <li>Knowledge Graph (Layer 2)</li>
                <li>Simulation Engine (Layer 3)</li>
                <li>Autonomous Agents (Layer 4)</li>
                <li>Digital Twins (Layer 1)</li>
              </ul>
            </div>
            <div>
              <p className="text-white/50 mb-2">Access Levels:</p>
              <ul className="text-white/60 space-y-1">
                <li><span className="text-white/70">Public</span> - Available to all users</li>
                <li><span className="text-white/70">Commercial</span> - Requires authentication</li>
                <li><span className="text-white/70">Classified</span> - Requires security clearance</li>
                <li><span className="text-white/70">Meta</span> - Requires meta-level access</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
