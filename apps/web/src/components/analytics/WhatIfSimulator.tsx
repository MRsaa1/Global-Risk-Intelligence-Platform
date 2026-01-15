/**
 * What-If Simulator - Scenario Analysis & Comparison
 * 
 * Features:
 * - Monte Carlo scenario simulation
 * - Parameter sensitivity sliders
 * - Scenario comparison charts
 * - VaR/CVaR metrics display
 * - Mitigation optimization
 */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMutation } from '@tanstack/react-query'
import {
  BeakerIcon,
  AdjustmentsHorizontalIcon,
  ChartBarSquareIcon,
  PlayIcon,
  ArrowPathIcon,
  CheckCircleIcon,
  SparklesIcon,
  CurrencyDollarIcon,
} from '@heroicons/react/24/outline'

// Types
interface Parameter {
  name: string
  type: string
  base_value: number
  current_value: number
  min_value: number
  max_value: number
  unit: string
  description: string
}

interface ScenarioResult {
  scenario_id: string
  scenario_name: string
  expected_loss: number
  var_95: number
  var_99: number
  cvar: number
  probability_of_loss: number
  recovery_time_months: number
  risk_score: number
  key_metrics: Record<string, any>
}

interface ComparisonResult {
  best_scenario: string
  worst_scenario: string
  baseline_scenario: string
  loss_range: [number, number]
  key_differences: Array<{ scenario_1: string; scenario_2: string; loss_difference: number }>
  recommendations: string[]
  scenarios: ScenarioResult[]
}

interface SensitivityResult {
  parameter_name: string
  values_tested: number[]
  output_values: number[]
  elasticity: number
  is_critical: boolean
}

// Format currency
function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

// Scenario color based on risk
function getScenarioColor(name: string): string {
  if (name.toLowerCase().includes('stress')) return 'text-red-400'
  if (name.toLowerCase().includes('pessimistic')) return 'text-orange-400'
  if (name.toLowerCase().includes('optimistic')) return 'text-emerald-400'
  return 'text-blue-400'
}

// Parameter Slider
function ParameterSlider({ 
  param, 
  value, 
  onChange 
}: { 
  param: Parameter
  value: number
  onChange: (val: number) => void 
}) {
  const percent = ((value - param.min_value) / (param.max_value - param.min_value)) * 100
  
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/60">{param.name.replace(/_/g, ' ')}</span>
        <span className="text-white font-medium">
          {value.toFixed(2)} {param.unit}
        </span>
      </div>
      <div className="relative h-2 bg-white/10 rounded-full">
        <div 
          className="absolute h-full bg-primary-500 rounded-full"
          style={{ width: `${percent}%` }}
        />
        <input
          type="range"
          min={param.min_value}
          max={param.max_value}
          step={(param.max_value - param.min_value) / 100}
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </div>
      <div className="flex justify-between text-[10px] text-white/30">
        <span>{param.min_value}</span>
        <span>{param.max_value}</span>
      </div>
    </div>
  )
}

// Scenario Comparison Chart
function ComparisonChart({ scenarios }: { scenarios: ScenarioResult[] }) {
  const maxLoss = Math.max(...scenarios.map(s => s.var_99))
  
  return (
    <div className="space-y-3">
      {scenarios.map((scenario, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className={getScenarioColor(scenario.scenario_name)}>
              {scenario.scenario_name}
            </span>
            <span className="text-white/60 text-xs">
              EL: {formatCurrency(scenario.expected_loss)}
            </span>
          </div>
          
          {/* Loss bar with VaR markers */}
          <div className="relative h-6 bg-white/5 rounded">
            {/* Expected Loss bar */}
            <div 
              className="absolute h-full bg-primary-500/50 rounded-l"
              style={{ width: `${(scenario.expected_loss / maxLoss) * 100}%` }}
            />
            
            {/* VaR 95 marker */}
            <div 
              className="absolute top-0 h-full w-0.5 bg-amber-500"
              style={{ left: `${(scenario.var_95 / maxLoss) * 100}%` }}
              title={`VaR 95: ${formatCurrency(scenario.var_95)}`}
            />
            
            {/* VaR 99 marker */}
            <div 
              className="absolute top-0 h-full w-0.5 bg-red-500"
              style={{ left: `${(scenario.var_99 / maxLoss) * 100}%` }}
              title={`VaR 99: ${formatCurrency(scenario.var_99)}`}
            />
            
            {/* Labels */}
            <div className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] text-white/60">
              VaR99: {formatCurrency(scenario.var_99)}
            </div>
          </div>
        </div>
      ))}
      
      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-white/40 pt-2 border-t border-white/10">
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 bg-primary-500/50 rounded" />
          <span>Expected Loss</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-0.5 h-3 bg-amber-500" />
          <span>VaR 95%</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-0.5 h-3 bg-red-500" />
          <span>VaR 99%</span>
        </div>
      </div>
    </div>
  )
}

// Sensitivity Chart
function SensitivityChart({ data }: { data: SensitivityResult }) {
  const maxVal = Math.max(...data.output_values)
  const minVal = Math.min(...data.output_values)
  
  return (
    <div className="h-24 flex items-end gap-0.5">
      {data.output_values.map((val, i) => (
        <div 
          key={i}
          className={`flex-1 rounded-t transition-all ${
            data.is_critical ? 'bg-red-500' : 'bg-primary-500'
          }`}
          style={{ 
            height: `${((val - minVal) / (maxVal - minVal || 1)) * 100 + 10}%`,
            opacity: 0.3 + (i / data.output_values.length) * 0.7
          }}
        />
      ))}
    </div>
  )
}

// Main Component
interface WhatIfSimulatorProps {
  baseExposure?: number
}

export default function WhatIfSimulator({ baseExposure = 100_000_000 }: WhatIfSimulatorProps) {
  const [activeTab, setActiveTab] = useState<'scenarios' | 'sensitivity' | 'optimize'>('scenarios')
  const [parameters, setParameters] = useState<Record<string, number>>({
    event_severity: 0.5,
    event_probability: 0.1,
    portfolio_exposure: 1.0,
    recovery_speed: 1.0,
    mitigation_level: 0.0,
    asset_correlation: 0.3,
  })
  const [scenariosCreated, setScenariosCreated] = useState(false)
  
  // Create predefined scenarios
  const createScenariosMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/whatif/scenarios/predefined', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to create scenarios')
      return res.json()
    },
    onSuccess: () => setScenariosCreated(true),
  })
  
  // Run comparison
  const comparisonMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/whatif/compare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario_ids: ['scenario_1', 'scenario_2', 'scenario_3', 'scenario_4'],
          base_exposure: baseExposure,
        }),
      })
      if (!res.ok) throw new Error('Failed to compare scenarios')
      return res.json() as Promise<ComparisonResult>
    },
  })
  
  // Run sensitivity
  const sensitivityMutation = useMutation({
    mutationFn: async (paramName: string) => {
      const res = await fetch('/api/v1/whatif/sensitivity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parameter_name: paramName,
          num_points: 11,
          base_exposure: baseExposure,
        }),
      })
      if (!res.ok) throw new Error('Failed to run sensitivity')
      return res.json() as Promise<SensitivityResult>
    },
  })
  
  // Optimize mitigation
  const optimizeMutation = useMutation({
    mutationFn: async (budget: number) => {
      const res = await fetch('/api/v1/whatif/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          budget,
          base_exposure: baseExposure,
        }),
      })
      if (!res.ok) throw new Error('Failed to optimize')
      return res.json()
    },
  })
  
  // Auto-load scenarios
  useEffect(() => {
    if (!scenariosCreated) {
      createScenariosMutation.mutate()
    }
  }, [])
  
  // Auto-run comparison when scenarios are created
  useEffect(() => {
    if (scenariosCreated && !comparisonMutation.data) {
      comparisonMutation.mutate()
    }
  }, [scenariosCreated])
  
  return (
    <div className="glass rounded-2xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BeakerIcon className="w-5 h-5 text-accent-400" />
          <h2 className="text-lg font-display font-semibold">What-If Simulator</h2>
          <span className="text-[10px] px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full">
            Monte Carlo
          </span>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-1 bg-white/5 rounded-lg p-1">
          {(['scenarios', 'sensitivity', 'optimize'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 text-xs rounded-md transition-colors ${
                activeTab === tab
                  ? 'bg-accent-500/30 text-accent-400'
                  : 'text-white/40 hover:text-white/60'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>
      
      {/* Content */}
      <AnimatePresence mode="wait">
        {/* Scenarios Tab */}
        {activeTab === 'scenarios' && (
          <motion.div
            key="scenarios"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Run Button */}
            <button
              onClick={() => comparisonMutation.mutate()}
              disabled={comparisonMutation.isPending}
              className="w-full py-2 bg-accent-500/20 hover:bg-accent-500/30 text-accent-400 rounded-lg text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {comparisonMutation.isPending ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : (
                <PlayIcon className="w-4 h-4" />
              )}
              {comparisonMutation.isPending ? 'Simulating...' : 'Run Comparison'}
            </button>
            
            {/* Results */}
            {comparisonMutation.data && (
              <div className="space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                    <div className="text-xs text-white/40">Best Case</div>
                    <div className="text-sm font-medium text-emerald-400">
                      {comparisonMutation.data.best_scenario}
                    </div>
                  </div>
                  <div className="p-3 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <div className="text-xs text-white/40">Baseline</div>
                    <div className="text-sm font-medium text-blue-400">
                      {comparisonMutation.data.baseline_scenario}
                    </div>
                  </div>
                  <div className="p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                    <div className="text-xs text-white/40">Worst Case</div>
                    <div className="text-sm font-medium text-red-400">
                      {comparisonMutation.data.worst_scenario}
                    </div>
                  </div>
                </div>
                
                {/* Comparison Chart */}
                <ComparisonChart scenarios={comparisonMutation.data.scenarios} />
                
                {/* Loss Range */}
                <div className="p-3 bg-white/5 rounded-lg">
                  <div className="text-xs text-white/40 mb-1">Loss Range</div>
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-400 font-medium">
                      {formatCurrency(comparisonMutation.data.loss_range[0])}
                    </span>
                    <div className="flex-1 mx-3 h-1 bg-gradient-to-r from-emerald-500 to-red-500 rounded" />
                    <span className="text-red-400 font-medium">
                      {formatCurrency(comparisonMutation.data.loss_range[1])}
                    </span>
                  </div>
                </div>
                
                {/* Recommendations */}
                {comparisonMutation.data.recommendations.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-xs text-white/40">Recommendations</div>
                    {comparisonMutation.data.recommendations.map((rec, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-white/70">
                        <CheckCircleIcon className="w-4 h-4 text-accent-400 flex-shrink-0" />
                        {rec}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
        
        {/* Sensitivity Tab */}
        {activeTab === 'sensitivity' && (
          <motion.div
            key="sensitivity"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {/* Parameter Selection */}
            <div className="grid grid-cols-2 gap-2">
              {['event_severity', 'event_probability', 'mitigation_level', 'asset_correlation'].map(param => (
                <button
                  key={param}
                  onClick={() => sensitivityMutation.mutate(param)}
                  disabled={sensitivityMutation.isPending}
                  className={`p-2 text-xs rounded-lg border transition-colors ${
                    sensitivityMutation.variables === param
                      ? 'bg-accent-500/20 border-accent-500/40 text-accent-400'
                      : 'bg-white/5 border-white/10 text-white/60 hover:border-white/20'
                  }`}
                >
                  <AdjustmentsHorizontalIcon className="w-4 h-4 inline mr-1" />
                  {param.replace(/_/g, ' ')}
                </button>
              ))}
            </div>
            
            {/* Results */}
            {sensitivityMutation.data && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-white">
                    {sensitivityMutation.data.parameter_name.replace(/_/g, ' ')}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    sensitivityMutation.data.is_critical
                      ? 'bg-red-500/20 text-red-400'
                      : 'bg-emerald-500/20 text-emerald-400'
                  }`}>
                    {sensitivityMutation.data.is_critical ? 'Critical' : 'Normal'}
                  </span>
                </div>
                
                <SensitivityChart data={sensitivityMutation.data} />
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-white/5 rounded-lg">
                    <div className="text-white/40 text-xs">Elasticity</div>
                    <div className="font-medium">
                      {sensitivityMutation.data.elasticity.toFixed(2)}
                    </div>
                  </div>
                  <div className="p-3 bg-white/5 rounded-lg">
                    <div className="text-white/40 text-xs">Impact Range</div>
                    <div className="font-medium">
                      {formatCurrency(Math.min(...sensitivityMutation.data.output_values))} - {formatCurrency(Math.max(...sensitivityMutation.data.output_values))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {sensitivityMutation.isPending && (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </motion.div>
        )}
        
        {/* Optimize Tab */}
        {activeTab === 'optimize' && (
          <motion.div
            key="optimize"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="text-sm text-white/60">
              Optimize mitigation strategy within budget constraints
            </div>
            
            {/* Budget Selection */}
            <div className="grid grid-cols-3 gap-2">
              {[1_000_000, 5_000_000, 10_000_000].map(budget => (
                <button
                  key={budget}
                  onClick={() => optimizeMutation.mutate(budget)}
                  disabled={optimizeMutation.isPending}
                  className="p-3 bg-white/5 hover:bg-white/10 rounded-lg text-center transition-colors"
                >
                  <CurrencyDollarIcon className="w-5 h-5 mx-auto text-accent-400 mb-1" />
                  <div className="text-sm font-medium">{formatCurrency(budget)}</div>
                  <div className="text-[10px] text-white/40">Budget</div>
                </button>
              ))}
            </div>
            
            {/* Results */}
            {optimizeMutation.data && (
              <div className="space-y-3 p-4 bg-gradient-to-r from-accent-500/10 to-purple-500/10 rounded-xl border border-accent-500/20">
                <div className="flex items-center gap-2">
                  <SparklesIcon className="w-5 h-5 text-accent-400" />
                  <span className="font-medium">Optimization Result</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-white/40">Expected Improvement</div>
                    <div className="text-lg font-bold text-emerald-400">
                      +{optimizeMutation.data.expected_improvement_pct.toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-white/40">ROI</div>
                    <div className="text-lg font-bold text-accent-400">
                      {optimizeMutation.data.roi_pct.toFixed(0)}%
                    </div>
                  </div>
                </div>
                
                <div>
                  <div className="text-xs text-white/40 mb-2">Implementation Priority</div>
                  <ol className="space-y-1">
                    {optimizeMutation.data.implementation_priority.map((item: string, i: number) => (
                      <li key={i} className="text-xs text-white/70 flex items-center gap-2">
                        <span className="w-4 h-4 bg-accent-500/20 rounded-full text-accent-400 text-[10px] flex items-center justify-center">
                          {i + 1}
                        </span>
                        {item}
                      </li>
                    ))}
                  </ol>
                </div>
              </div>
            )}
            
            {optimizeMutation.isPending && (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
