/**
 * Stress Test Selector
 * =====================
 * 
 * Left panel component for selecting and configuring stress test scenarios.
 * Follows the HUD-style design of Command Center.
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// Professional SVG Icons
const Icons = {
  climate: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
    </svg>
  ),
  financial: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
    </svg>
  ),
  military: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
    </svg>
  ),
  pandemic: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  ),
  political: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  regulatory: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  protest: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
}

// Stress test types with icons and colors
const STRESS_TEST_TYPES = [
  { 
    id: 'climate', 
    label: 'Climate',
    icon: Icons.climate,
    color: 'cyan',
    scenarios: [
      { id: 'flood-rhine', name: 'Rhine Valley Flood', severity: 0.85, probability: 0.05 },
      { id: 'sea-level', name: 'Sea Level Rise +0.5m', severity: 0.60, probability: 0.70 },
      { id: 'heatwave-eu', name: 'European Heatwave', severity: 0.55, probability: 0.30 },
    ]
  },
  { 
    id: 'financial', 
    label: 'Financial',
    icon: Icons.financial,
    color: 'red',
    scenarios: [
      { id: 'liquidity-eu', name: 'Eurozone Liquidity Crisis', severity: 0.90, probability: 0.03 },
      { id: 'credit-crunch', name: 'Credit Crunch', severity: 0.75, probability: 0.08 },
    ]
  },
  { 
    id: 'military', 
    label: 'Geopolitical',
    icon: Icons.military,
    color: 'orange',
    scenarios: [
      { id: 'conflict-east', name: 'Eastern Europe Escalation', severity: 0.95, probability: 0.15 },
      { id: 'blockade', name: 'Trade Route Blockade', severity: 0.70, probability: 0.10 },
    ]
  },
  { 
    id: 'pandemic', 
    label: 'Pandemic',
    icon: Icons.pandemic,
    color: 'purple',
    scenarios: [
      { id: 'pandemic-x', name: 'Pandemic Variant X', severity: 0.80, probability: 0.10 },
    ]
  },
  { 
    id: 'political', 
    label: 'Political',
    icon: Icons.political,
    color: 'yellow',
    scenarios: [
      { id: 'sanctions', name: 'Sanctions Package', severity: 0.65, probability: 0.25 },
      { id: 'regime-change', name: 'Regime Transition', severity: 0.75, probability: 0.05 },
    ]
  },
  { 
    id: 'regulatory', 
    label: 'Regulatory',
    icon: Icons.regulatory,
    color: 'blue',
    scenarios: [
      { id: 'basel-full', name: 'Basel IV Implementation', severity: 0.50, probability: 0.95 },
    ]
  },
  { 
    id: 'protest', 
    label: 'Civil Unrest',
    icon: Icons.protest,
    color: 'amber',
    scenarios: [
      { id: 'mass-protest', name: 'Mass Civil Unrest', severity: 0.60, probability: 0.20 },
      { id: 'general-strike', name: 'General Strike', severity: 0.55, probability: 0.15 },
    ]
  },
]

interface StressTestSelectorProps {
  onScenarioSelect: (scenario: {
    id: string
    name: string
    type: string
    severity: number
    probability: number
  } | null) => void
  selectedScenario: string | null
  isCollapsed?: boolean
}

export default function StressTestSelector({ 
  onScenarioSelect, 
  selectedScenario,
  isCollapsed = false 
}: StressTestSelectorProps) {
  const [expandedType, setExpandedType] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  // Color classes by type
  const colorClasses: Record<string, { text: string; bg: string; border: string; glow: string }> = {
    cyan: { text: 'text-cyan-400', bg: 'bg-cyan-500', border: 'border-cyan-500/30', glow: 'shadow-cyan-500/20' },
    red: { text: 'text-red-400', bg: 'bg-red-500', border: 'border-red-500/30', glow: 'shadow-red-500/20' },
    orange: { text: 'text-orange-400', bg: 'bg-orange-500', border: 'border-orange-500/30', glow: 'shadow-orange-500/20' },
    purple: { text: 'text-purple-400', bg: 'bg-purple-500', border: 'border-purple-500/30', glow: 'shadow-purple-500/20' },
    yellow: { text: 'text-yellow-400', bg: 'bg-yellow-500', border: 'border-yellow-500/30', glow: 'shadow-yellow-500/20' },
    blue: { text: 'text-blue-400', bg: 'bg-blue-500', border: 'border-blue-500/30', glow: 'shadow-blue-500/20' },
    amber: { text: 'text-amber-400', bg: 'bg-amber-500', border: 'border-amber-500/30', glow: 'shadow-amber-500/20' },
  }

  const handleScenarioClick = (type: typeof STRESS_TEST_TYPES[0], scenario: typeof STRESS_TEST_TYPES[0]['scenarios'][0]) => {
    if (selectedScenario === scenario.id) {
      onScenarioSelect(null)
    } else {
      setIsLoading(true)
      setTimeout(() => {
        onScenarioSelect({
          id: scenario.id,
          name: scenario.name,
          type: type.id,
          severity: scenario.severity,
          probability: scenario.probability,
        })
        setIsLoading(false)
      }, 300)
    }
  }

  if (isCollapsed) {
    return (
      <div className="space-y-2">
        {STRESS_TEST_TYPES.map((type) => {
          const colors = colorClasses[type.color]
          const hasActiveScenario = type.scenarios.some(s => s.id === selectedScenario)
          
          return (
            <button
              key={type.id}
              onClick={() => setExpandedType(expandedType === type.id ? null : type.id)}
              className={`
                w-10 h-10 rounded-lg flex items-center justify-center
                transition-all duration-300
                ${hasActiveScenario 
                  ? `${colors.border} border-2 ${colors.glow} shadow-lg ${colors.text}` 
                  : 'border border-white/10 hover:border-white/30 text-white/50'
                }
              `}
              title={type.label}
            >
              {type.icon}
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
        <span className="text-white/30 text-[10px] uppercase tracking-[0.2em]">
          Scenarios
        </span>
      </div>

      {/* Scenario Types */}
      {STRESS_TEST_TYPES.map((type) => {
        const colors = colorClasses[type.color]
        const isExpanded = expandedType === type.id
        const hasActiveScenario = type.scenarios.some(s => s.id === selectedScenario)

        return (
          <div key={type.id} className="relative">
            {/* Type Header */}
            <button
              onClick={() => setExpandedType(isExpanded ? null : type.id)}
              className={`
                w-full flex items-center gap-2 px-2 py-1.5 rounded-lg
                transition-all duration-200
                ${isExpanded || hasActiveScenario 
                  ? `bg-white/5 ${colors.border} border` 
                  : 'hover:bg-white/5 border border-transparent'
                }
              `}
            >
              <span className={hasActiveScenario ? colors.text : 'text-white/50'}>
                {type.icon}
              </span>
              <span className={`text-xs flex-1 text-left ${hasActiveScenario ? colors.text : 'text-white/60'}`}>
                {type.label}
              </span>
              <span className="text-white/20 text-[10px]">
                {type.scenarios.length}
              </span>
              <svg 
                className={`w-3 h-3 text-white/30 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            {/* Scenarios Dropdown */}
            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className={`mt-1 ml-4 border-l-2 ${colors.border} pl-2 space-y-0.5`}>
                    {type.scenarios.map((scenario) => {
                      const isActive = selectedScenario === scenario.id

                      return (
                        <button
                          key={scenario.id}
                          onClick={() => handleScenarioClick(type, scenario)}
                          disabled={isLoading}
                          className={`
                            w-full flex items-center gap-2 px-2 py-1.5 rounded
                            transition-all duration-200 text-left group
                            ${isActive 
                              ? `bg-white/10 ${colors.border} border` 
                              : 'hover:bg-white/5 border border-transparent'
                            }
                          `}
                        >
                          {/* Active Indicator */}
                          <div className={`
                            w-1.5 h-1.5 rounded-full transition-all
                            ${isActive ? `${colors.bg} animate-pulse` : 'bg-white/20'}
                          `} />
                          
                          {/* Name */}
                          <span className={`
                            text-xs flex-1 truncate
                            ${isActive ? 'text-white' : 'text-white/50 group-hover:text-white/70'}
                          `}>
                            {scenario.name}
                          </span>
                          
                          {/* Severity Badge */}
                          <span className={`
                            text-[10px] font-mono px-1 py-0.5 rounded
                            ${scenario.severity > 0.8 
                              ? 'bg-red-500/20 text-red-400' 
                              : scenario.severity > 0.6 
                                ? 'bg-orange-500/20 text-orange-400'
                                : 'bg-yellow-500/20 text-yellow-400'
                            }
                          `}>
                            {(scenario.severity * 100).toFixed(0)}%
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}

      {/* Loading Indicator */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex items-center justify-center py-2"
          >
            <div className="w-4 h-4 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
