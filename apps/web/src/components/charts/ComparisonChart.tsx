/**
 * Comparison Chart Component
 * ===========================
 * 
 * Side-by-side scenario comparison visualization
 * - Before/After stress test comparison
 * - Delta indicators
 * - Interactive scenario selection
 */
import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { chartColors } from '../../lib/chartColors'

export interface ComparisonMetric {
  id: string
  label: string
  before: number
  after: number
  format?: 'number' | 'currency' | 'percent'
  higherIsBetter?: boolean
}

export interface ComparisonScenario {
  id: string
  name: string
  description?: string
  metrics: ComparisonMetric[]
}

interface ComparisonChartProps {
  scenarios: ComparisonScenario[]
  selectedScenario?: string
  onScenarioSelect?: (scenarioId: string) => void
  title?: string
  showDelta?: boolean
  animationDuration?: number
}

// Format value based on type
function formatValue(value: number, format?: string): string {
  switch (format) {
    case 'currency':
      if (value >= 1_000_000_000) return `€${(value / 1_000_000_000).toFixed(1)}B`
      if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
      if (value >= 1_000) return `€${(value / 1_000).toFixed(0)}K`
      return `€${value.toFixed(0)}`
    case 'percent':
      return `${(value * 100).toFixed(1)}%`
    default:
      return value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toFixed(1)
  }
}

// Calculate delta percentage
function calculateDelta(before: number, after: number): number {
  if (before === 0) return after > 0 ? 100 : 0
  return ((after - before) / before) * 100
}

export default function ComparisonChart({
  scenarios,
  selectedScenario,
  onScenarioSelect,
  title,
  showDelta = true,
  animationDuration = 500,
}: ComparisonChartProps) {
  const [internalSelected, setInternalSelected] = useState(scenarios[0]?.id)
  const activeScenarioId = selectedScenario || internalSelected
  
  const activeScenario = useMemo(() => {
    return scenarios.find(s => s.id === activeScenarioId) || scenarios[0]
  }, [scenarios, activeScenarioId])
  
  const handleSelect = (id: string) => {
    setInternalSelected(id)
    onScenarioSelect?.(id)
  }
  
  if (!activeScenario) return null
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="space-y-4"
    >
      {title && (
        <h3 className="gradient-text-shimmer text-sm font-medium">{title}</h3>
      )}
      
      {/* Scenario Selector */}
      {scenarios.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-2 border-b border-zinc-800">
          {scenarios.map(scenario => (
            <button
              key={scenario.id}
              onClick={() => handleSelect(scenario.id)}
              className={`relative px-3 py-1.5 rounded-lg text-xs whitespace-nowrap transition-all ${
                activeScenarioId === scenario.id
                  ? 'bg-zinc-700 text-zinc-300 border border-zinc-600'
                  : 'bg-zinc-800 text-zinc-400 border border-transparent hover:bg-zinc-700'
              }`}
            >
              {scenario.name}
              {activeScenarioId === scenario.id && (
                <span
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-b-lg"
                  style={{ background: 'linear-gradient(90deg, #71717a, #a1a1aa)' }}
                />
              )}
            </button>
          ))}
        </div>
      )}
      
      {/* Scenario Description */}
      {activeScenario.description && (
        <p className="text-zinc-500 text-xs">{activeScenario.description}</p>
      )}
      
      {/* Comparison Grid */}
      <div className="space-y-3">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeScenario.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="space-y-2"
          >
            {/* Header */}
            <div className="grid grid-cols-4 gap-2 px-3 py-2 text-xs text-zinc-500">
              <div>Metric</div>
              <div className="text-center">Before</div>
              <div className="text-center">After</div>
              {showDelta && <div className="text-right">Change</div>}
            </div>
            
            {/* Metrics */}
            {activeScenario.metrics.map((metric, i) => {
              const delta = calculateDelta(metric.before, metric.after)
              const isPositive = metric.higherIsBetter 
                ? delta > 0 
                : delta < 0
              const isNegative = metric.higherIsBetter
                ? delta < 0
                : delta > 0
              
              // Calculate bar widths
              const maxValue = Math.max(metric.before, metric.after)
              const beforeWidth = (metric.before / maxValue) * 100
              const afterWidth = (metric.after / maxValue) * 100
              
              return (
                <motion.div
                  key={metric.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ 
                    duration: animationDuration / 1000,
                    delay: i * 0.05 
                  }}
                  className="grid grid-cols-4 gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-white/8 transition-colors"
                >
                  {/* Label */}
                  <div className="text-xs text-zinc-300 self-center">
                    {metric.label}
                  </div>
                  
                  {/* Before Value with Bar */}
                  <div className="space-y-1">
                    <div className="text-xs text-zinc-400 text-center font-mono">
                      {formatValue(metric.before, metric.format)}
                    </div>
                    <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: 'linear-gradient(90deg, #52525b, #3f3f46)' }}
                        initial={{ width: 0 }}
                        animate={{ width: `${beforeWidth}%` }}
                        transition={{ duration: 0.5, delay: 0.2 }}
                      />
                    </div>
                  </div>
                  
                  {/* After Value with Bar */}
                  <div className="space-y-1">
                    <div className="text-xs text-zinc-100 text-center font-mono font-medium">
                      {formatValue(metric.after, metric.format)}
                    </div>
                    <div className="h-1.5 bg-zinc-700 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          background: isPositive
                            ? chartColors.gradients.riskLow
                            : isNegative
                            ? chartColors.gradients.riskHigh
                            : chartColors.gradients.primary
                        }}
                        initial={{ width: 0 }}
                        animate={{ width: `${afterWidth}%` }}
                        transition={{ duration: 0.5, delay: 0.3 }}
                      />
                    </div>
                  </div>
                  
                  {/* Delta */}
                  {showDelta && (
                    <div className="flex items-center justify-end gap-1">
                      <motion.span
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 }}
                        className={`px-1.5 py-0.5 rounded text-xs font-mono font-medium ${
                          isPositive
                            ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white'
                            : isNegative
                            ? 'bg-gradient-to-r from-red-600 to-red-500 text-white'
                            : 'text-zinc-500'
                        }`}
                        style={
                          Math.abs(delta) > 20
                            ? {
                                boxShadow: isPositive
                                  ? '0 0 8px rgba(34,197,94,0.3)'
                                  : isNegative
                                  ? '0 0 8px rgba(239,68,68,0.3)'
                                  : undefined,
                              }
                            : undefined
                        }
                      >
                        {delta > 0 ? '+' : ''}{delta.toFixed(1)}%
                      </motion.span>
                      {delta !== 0 && (
                        <motion.svg
                          initial={{ opacity: 0, y: delta > 0 ? 5 : -5 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.5 }}
                          className={`w-3 h-3 ${
                            isPositive 
                              ? 'text-emerald-400' 
                              : isNegative 
                              ? 'text-red-400' 
                              : 'text-zinc-500'
                          }`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          {delta > 0 ? (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                          ) : (
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          )}
                        </motion.svg>
                      )}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </motion.div>
        </AnimatePresence>
      </div>
      
      {/* Summary */}
      <div className="flex justify-between items-center pt-2 border-t border-zinc-700">
        <span className="text-xs text-zinc-500">
          {activeScenario.metrics.length} metrics compared
        </span>
        <div className="flex gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <span className="text-xs text-zinc-500">Improvement</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-red-400" />
            <span className="text-xs text-zinc-500">Deterioration</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Preset: Stress Test Comparison
export function StressTestComparison({
  beforeTest,
  afterTest,
}: {
  beforeTest: { name: string; portfolioValue: number; atRisk: number; avgRisk: number }
  afterTest: { name: string; portfolioValue: number; atRisk: number; avgRisk: number }
}) {
  const scenario: ComparisonScenario = {
    id: 'stress-test',
    name: 'Stress Test Impact',
    description: `Comparing portfolio before and after ${afterTest.name}`,
    metrics: [
      {
        id: 'portfolio-value',
        label: 'Portfolio Value',
        before: beforeTest.portfolioValue,
        after: afterTest.portfolioValue,
        format: 'currency',
        higherIsBetter: true,
      },
      {
        id: 'at-risk',
        label: 'Value at Risk',
        before: beforeTest.atRisk,
        after: afterTest.atRisk,
        format: 'currency',
        higherIsBetter: false,
      },
      {
        id: 'avg-risk',
        label: 'Average Risk',
        before: beforeTest.avgRisk,
        after: afterTest.avgRisk,
        format: 'percent',
        higherIsBetter: false,
      },
    ],
  }
  
  return (
    <ComparisonChart
      scenarios={[scenario]}
      title="Before vs After Stress Test"
    />
  )
}
