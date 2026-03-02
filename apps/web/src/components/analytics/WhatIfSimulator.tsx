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
  ScaleIcon,
  ShieldExclamationIcon,
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
  if (name.toLowerCase().includes('stress')) return 'text-red-400/80'
  if (name.toLowerCase().includes('pessimistic')) return 'text-orange-400/80'
  if (name.toLowerCase().includes('optimistic')) return 'text-emerald-400/80'
  return 'text-zinc-400'
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
        <span className="text-zinc-400">{param.name.replace(/_/g, ' ')}</span>
        <span className="text-zinc-100 font-medium">
          {value.toFixed(2)} {param.unit}
        </span>
      </div>
      <div className="relative h-2 bg-zinc-800 rounded-full">
        <div 
          className="absolute h-full bg-zinc-500 rounded-full"
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
      <div className="flex justify-between text-[10px] text-zinc-600">
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
            <span className="text-zinc-400 text-xs">
              EL: {formatCurrency(scenario.expected_loss)}
            </span>
          </div>
          
          {/* Loss bar with VaR markers */}
          <div className="relative h-6 bg-zinc-900/80 rounded border border-zinc-800/60">
            {/* Expected Loss bar */}
            <div 
              className="absolute h-full bg-zinc-600 rounded-l"
              style={{ width: `${(scenario.expected_loss / maxLoss) * 100}%` }}
            />
            
            {/* VaR 95 marker */}
            <div 
              className="absolute top-0 h-full w-0.5 bg-zinc-500"
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
            <div className="absolute inset-0 flex items-center justify-end pr-2 text-[10px] text-zinc-400">
              VaR99: {formatCurrency(scenario.var_99)}
            </div>
          </div>
        </div>
      ))}
      
      {/* Legend */}
      <div className="flex items-center gap-4 font-mono text-[10px] text-zinc-500 pt-2 border-t border-zinc-800/60">
        <div className="flex items-center gap-1">
          <div className="w-3 h-2 bg-zinc-600 rounded" />
          <span>Expected Loss</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-0.5 h-3 bg-zinc-500" />
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
            data.is_critical ? 'bg-red-500' : 'bg-zinc-500'
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

type AiqSourceLike =
  | string
  | null
  | undefined
  | { id?: string; kind?: string; title?: string; url?: string; snippet?: string }

function normalizeAiqSources(input: unknown): Array<{ id?: string; kind?: string; title?: string; url?: string; snippet?: string }> {
  if (!Array.isArray(input)) return []
  return input
    .filter(Boolean)
    .map((s: AiqSourceLike) => {
      if (typeof s === 'string') return { id: s, title: s }
      if (!s || typeof s !== 'object') return { id: String(s), title: String(s) }
      const src = s as { id?: string; kind?: string; title?: string; url?: string; snippet?: string }
      return {
        id: src.id,
        kind: src.kind,
        title: src.title || src.id,
        url: src.url,
        snippet: src.snippet,
      }
    })
    .filter((s) => Boolean(s.id || s.title))
}

// Stress Duel types
interface StressDuelResult {
  scenario_a: { id: string; name: string; description: string; metrics: Array<{ id: string; label: string; before: number; after: number; format: string; higherIsBetter: boolean }> }
  scenario_b: { id: string; name: string; description: string; metrics: Array<{ id: string; label: string; before: number; after: number; format: string; higherIsBetter: boolean }> }
  verdict: string
  more_dangerous: string
  hedge_first: string
  confidence: string
}

interface ScenarioOption {
  id: string
  name: string
}

export default function WhatIfSimulator({ baseExposure = 100_000_000 }: WhatIfSimulatorProps) {
  const [activeTab, setActiveTab] = useState<'scenarios' | 'sensitivity' | 'optimize' | 'duel'>('scenarios')
  const [parameters, setParameters] = useState<Record<string, number>>({
    event_severity: 0.5,
    event_probability: 0.1,
    portfolio_exposure: 1.0,
    recovery_speed: 1.0,
    mitigation_level: 0.0,
    asset_correlation: 0.3,
  })
  const [scenariosCreated, setScenariosCreated] = useState(false)
  const [aiOpen, setAiOpen] = useState(false)
  const [aiQuestion, setAiQuestion] = useState('')
  const [aiAnswer, setAiAnswer] = useState<string | null>(null)
  const [aiSources, setAiSources] = useState<Array<{ id?: string; kind?: string; title?: string; url?: string; snippet?: string }>>([])
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiLoading, setAiLoading] = useState(false)

  // Stress Duel state
  const [duelScenarios, setDuelScenarios] = useState<ScenarioOption[]>([])
  const [duelA, setDuelA] = useState('')
  const [duelB, setDuelB] = useState('')

  // Fetch available scenarios for duel
  const duelScenariosMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/analytics/scenario-comparison')
      if (!res.ok) throw new Error('Failed to fetch scenarios')
      const data = await res.json()
      return (data.scenarios || []).map((s: any) => ({ id: s.id, name: s.name })) as ScenarioOption[]
    },
    onSuccess: (data) => {
      setDuelScenarios(data)
      if (data.length >= 2) {
        setDuelA(data[0].id)
        setDuelB(data[1].id)
      }
    },
  })

  // Run duel
  const duelMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/analytics/stress-duel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario_id_a: duelA, scenario_id_b: duelB }),
      })
      if (!res.ok) throw new Error('Failed to run stress duel')
      return res.json() as Promise<StressDuelResult>
    },
  })

  // Load scenarios when switching to duel tab
  useEffect(() => {
    if (activeTab === 'duel' && duelScenarios.length === 0) {
      duelScenariosMutation.mutate()
    }
  }, [activeTab])
  
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
          parameters: {
            event_severity: parameters.event_severity,
            event_probability: parameters.event_probability,
            portfolio_exposure: parameters.portfolio_exposure,
            mitigation_level: parameters.mitigation_level,
            recovery_speed: parameters.recovery_speed,
            asset_correlation: parameters.asset_correlation,
          },
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
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        const msg = (body?.detail ?? body?.message ?? res.statusText) || 'Failed to run sensitivity'
        throw new Error(typeof msg === 'string' ? msg : 'Failed to run sensitivity')
      }
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

  const openAiExplain = () => {
    setAiError(null)
    setAiAnswer(null)
    setAiSources([])
    setAiOpen(true)
    setAiQuestion(
      'Explain the scenario comparison results and recommendations. Which parameters are driving the loss range? Provide 3 concrete next actions.'
    )
  }

  const whatifError =
    duelScenariosMutation.error ||
    duelMutation.error ||
    createScenariosMutation.error ||
    comparisonMutation.error ||
    sensitivityMutation.error ||
    optimizeMutation.error
  const whatifErrorMessage =
    whatifError instanceof Error ? whatifError.message : whatifError ? String(whatifError) : null
  
  return (
    <div className="rounded-md border border-zinc-800/60 bg-zinc-900/50 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BeakerIcon className="w-5 h-5 text-zinc-400" />
          <h2 className="text-lg font-display font-semibold text-zinc-100 tracking-tight">What-If Simulator</h2>
          <span className="font-mono text-[10px] uppercase tracking-widest px-2 py-0.5 bg-zinc-900/80 border border-zinc-800/60 text-zinc-400 rounded-full">
            Monte Carlo
          </span>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-1 bg-zinc-900/80 rounded-md border border-zinc-800/60 p-1">
          {(['scenarios', 'duel', 'sensitivity', 'optimize'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-3 py-1 font-mono text-[10px] uppercase tracking-widest rounded-md transition-colors ${
                activeTab === tab
                  ? 'bg-zinc-800 text-zinc-300 border border-zinc-800/60'
                  : 'text-zinc-500 hover:text-zinc-400'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {whatifErrorMessage && (
        <div className="mb-4 p-3 rounded-md bg-red-500/10 border border-red-500/30 text-red-300 text-sm" role="alert">
          {whatifErrorMessage}
        </div>
      )}
      
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
            {/* Conditions: editable parameters */}
            <div className="p-3 bg-zinc-900/50 rounded-md border border-zinc-800/60">
              <h4 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Conditions</h4>
              <div className="grid grid-cols-2 gap-4">
                {(['event_severity', 'event_probability', 'portfolio_exposure', 'mitigation_level', 'recovery_speed'] as const).map((k) => {
                  const config = { event_severity: { min: 0, max: 1, unit: '' }, event_probability: { min: 0, max: 1, unit: '' }, portfolio_exposure: { min: 0.1, max: 2, unit: 'x' }, mitigation_level: { min: 0, max: 1, unit: '' }, recovery_speed: { min: 0.5, max: 2, unit: 'x' } }[k]
                  const param: Parameter = { name: k, type: 'number', base_value: config.min, current_value: parameters[k], min_value: config.min, max_value: config.max, unit: config.unit, description: '' }
                  return (
                    <ParameterSlider
                      key={k}
                      param={param}
                      value={parameters[k]}
                      onChange={(v) => setParameters((p) => ({ ...p, [k]: v }))}
                    />
                  )
                })}
              </div>
            </div>
            {/* Run Button */}
            <button
              onClick={() => comparisonMutation.mutate()}
              disabled={comparisonMutation.isPending}
              className="w-full py-2 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-300 rounded-md text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
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
                  <div className="p-3 bg-emerald-500/10 rounded-md border border-emerald-500/20">
                    <div className="text-xs text-zinc-500">Best Case</div>
                    <div className="text-sm font-medium text-emerald-400/80">
                      {comparisonMutation.data.best_scenario}
                    </div>
                  </div>
                  <div className="p-3 bg-zinc-900/50 rounded-md border border-zinc-800/60">
                    <div className="text-xs text-zinc-500">Baseline</div>
                    <div className="text-sm font-medium text-zinc-400">
                      {comparisonMutation.data.baseline_scenario}
                    </div>
                  </div>
                  <div className="p-3 bg-red-500/10 rounded-md border border-red-500/20">
                    <div className="text-xs text-zinc-500">Worst Case</div>
                    <div className="text-sm font-medium text-red-400/80">
                      {comparisonMutation.data.worst_scenario}
                    </div>
                  </div>
                </div>
                
                {/* Comparison Chart */}
                <ComparisonChart scenarios={comparisonMutation.data.scenarios} />
                
                {/* Loss Range */}
                <div className="p-3 bg-zinc-900/80 rounded-md border border-zinc-800/60">
                  <div className="text-xs text-zinc-500 mb-1">Loss Range</div>
                  <div className="flex items-center justify-between">
                    <span className="text-emerald-400/80 font-medium">
                      {formatCurrency(comparisonMutation.data.loss_range[0])}
                    </span>
                    <div className="flex-1 mx-3 h-1 bg-gradient-to-r from-emerald-500 to-red-500 rounded" />
                    <span className="text-red-400/80 font-medium">
                      {formatCurrency(comparisonMutation.data.loss_range[1])}
                    </span>
                  </div>
                </div>
                
                {/* Recommendations */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-zinc-500">Recommendations</div>
                    <button
                      type="button"
                      onClick={openAiExplain}
                      className="text-[11px] px-2 py-1 rounded bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800/60 text-zinc-400 hover:text-zinc-300 transition-colors"
                      title="Explain results with AI (citations)"
                    >
                      Explain (AI)
                    </button>
                  </div>
                  {comparisonMutation.data.recommendations.length > 0 ? (
                    comparisonMutation.data.recommendations.map((rec, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-zinc-300">
                        <CheckCircleIcon className="w-4 h-4 text-zinc-400 flex-shrink-0" />
                        {rec}
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-zinc-500">
                      No recommendations returned by the service. You can still use <span className="text-zinc-400">Explain (AI)</span> to interpret the results.
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
        
        {/* Stress Duel Tab */}
        {activeTab === 'duel' && (
          <motion.div
            key="duel"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            <div className="flex items-center gap-2 text-sm text-zinc-400">
              <ScaleIcon className="w-4 h-4" />
              Compare two stress scenarios head-to-head
            </div>

            {/* Scenario selectors */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1 block">Scenario A</label>
                <select
                  value={duelA}
                  onChange={(e) => setDuelA(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900/80 border border-zinc-800/60 rounded-md text-sm text-zinc-300 font-sans focus:ring-1 focus:ring-red-500/50"
                >
                  {duelScenarios.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1 block">Scenario B</label>
                <select
                  value={duelB}
                  onChange={(e) => setDuelB(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-900/80 border border-zinc-800/60 rounded-md text-sm text-zinc-300 font-sans focus:ring-1 focus:ring-blue-500/50"
                >
                  {duelScenarios.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Run Duel */}
            <button
              onClick={() => duelMutation.mutate()}
              disabled={duelMutation.isPending || !duelA || !duelB || duelA === duelB}
              className="w-full py-2 bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-300 rounded-md text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
            >
              {duelMutation.isPending ? (
                <ArrowPathIcon className="w-4 h-4 animate-spin" />
              ) : (
                <ScaleIcon className="w-4 h-4" />
              )}
              {duelMutation.isPending ? 'Comparing...' : 'Run Stress Duel'}
            </button>

            {duelA === duelB && duelA && (
              <p className="text-xs text-amber-400/80">Select two different scenarios to compare.</p>
            )}

            {/* Duel Results */}
            {duelMutation.data && (
              <div className="space-y-4">
                {/* Side by side metrics */}
                <div className="grid grid-cols-2 gap-3">
                  {/* Scenario A */}
                  <div className={`p-3 rounded-md border ${duelMutation.data.more_dangerous === duelMutation.data.scenario_a.id ? 'bg-red-500/10 border-red-500/20' : 'bg-zinc-900/50 border-zinc-800/60'}`}>
                    <div className="flex items-center gap-1.5 mb-2">
                      {duelMutation.data.more_dangerous === duelMutation.data.scenario_a.id && (
                        <ShieldExclamationIcon className="w-3.5 h-3.5 text-red-400/80" />
                      )}
                      <span className={`text-xs font-medium ${duelMutation.data.more_dangerous === duelMutation.data.scenario_a.id ? 'text-red-300' : 'text-zinc-300'}`}>
                        {duelMutation.data.scenario_a.name}
                      </span>
                    </div>
                    {duelMutation.data.scenario_a.metrics.map((m) => (
                      <div key={m.id} className="flex justify-between text-[11px] py-0.5">
                        <span className="text-zinc-500">{m.label}</span>
                        <span className={`font-mono ${
                          m.higherIsBetter
                            ? (m.after < m.before ? 'text-red-400/80' : 'text-emerald-400/80')
                            : (m.after > m.before ? 'text-red-400/80' : 'text-emerald-400/80')
                        }`}>
                          {m.format === 'currency' ? formatCurrency(m.after) : m.format === 'percent' ? `${(m.after * 100).toFixed(1)}%` : m.after}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Scenario B */}
                  <div className={`p-3 rounded-md border ${duelMutation.data.more_dangerous === duelMutation.data.scenario_b.id ? 'bg-red-500/10 border-red-500/20' : 'bg-zinc-900/50 border-zinc-800/60'}`}>
                    <div className="flex items-center gap-1.5 mb-2">
                      {duelMutation.data.more_dangerous === duelMutation.data.scenario_b.id && (
                        <ShieldExclamationIcon className="w-3.5 h-3.5 text-red-400/80" />
                      )}
                      <span className={`text-xs font-medium ${duelMutation.data.more_dangerous === duelMutation.data.scenario_b.id ? 'text-red-300' : 'text-zinc-300'}`}>
                        {duelMutation.data.scenario_b.name}
                      </span>
                    </div>
                    {duelMutation.data.scenario_b.metrics.map((m) => (
                      <div key={m.id} className="flex justify-between text-[11px] py-0.5">
                        <span className="text-zinc-500">{m.label}</span>
                        <span className={`font-mono ${
                          m.higherIsBetter
                            ? (m.after < m.before ? 'text-red-400/80' : 'text-emerald-400/80')
                            : (m.after > m.before ? 'text-red-400/80' : 'text-emerald-400/80')
                        }`}>
                          {m.format === 'currency' ? formatCurrency(m.after) : m.format === 'percent' ? `${(m.after * 100).toFixed(1)}%` : m.after}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Verdict */}
                <div className="p-3 rounded-md bg-gradient-to-r from-red-500/10 to-zinc-800 border border-red-500/20">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <ShieldExclamationIcon className="w-4 h-4 text-red-400/80" />
                    <span className="text-[10px] text-red-400/80 uppercase tracking-wider font-semibold">Verdict</span>
                    <span className="text-[10px] text-zinc-600 ml-auto">
                      Confidence: {duelMutation.data.confidence}
                    </span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">{duelMutation.data.verdict}</p>
                </div>

                {/* Hedge Recommendation */}
                <div className="p-3 rounded-md bg-zinc-900/50 border border-zinc-800/60">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <CheckCircleIcon className="w-4 h-4 text-emerald-400/80" />
                    <span className="text-[10px] text-emerald-400/80 uppercase tracking-wider font-semibold">Hedge First</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-relaxed">{duelMutation.data.hedge_first}</p>
                </div>
              </div>
            )}

            {duelScenariosMutation.isPending && (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
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
                  className={`p-2 text-xs rounded-md border transition-colors ${
                    sensitivityMutation.variables === param
                      ? 'bg-zinc-900/80 border-zinc-800/60 text-zinc-400'
                      : 'bg-zinc-900/80 border-zinc-800/60 text-zinc-400 hover:bg-zinc-800'
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
                  <span className="text-sm text-zinc-100">
                    {sensitivityMutation.data.parameter_name.replace(/_/g, ' ')}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    sensitivityMutation.data.is_critical
                      ? 'bg-red-500/20 text-red-400/80'
                      : 'bg-emerald-500/20 text-emerald-400/80'
                  }`}>
                    {sensitivityMutation.data.is_critical ? 'Critical' : 'Normal'}
                  </span>
                </div>
                
                <SensitivityChart data={sensitivityMutation.data} />
                
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-zinc-900/80 rounded-md border border-zinc-800/60">
                    <div className="text-zinc-500 text-xs">Elasticity</div>
                    <div className="font-medium">
                      {sensitivityMutation.data.elasticity.toFixed(2)}
                    </div>
                  </div>
                  <div className="p-3 bg-zinc-900/80 rounded-md border border-zinc-800/60">
                    <div className="text-zinc-500 text-xs">Impact Range</div>
                    <div className="font-medium">
                      {formatCurrency(Math.min(...sensitivityMutation.data.output_values))} - {formatCurrency(Math.max(...sensitivityMutation.data.output_values))}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {sensitivityMutation.isPending && (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
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
            <div className="text-sm text-zinc-400">
              Optimize mitigation strategy within budget constraints
            </div>
            
            {/* Budget Selection */}
            <div className="grid grid-cols-3 gap-2">
              {[1_000_000, 5_000_000, 10_000_000].map(budget => (
                <button
                  key={budget}
                  onClick={() => optimizeMutation.mutate(budget)}
                  disabled={optimizeMutation.isPending}
                  className="p-3 bg-zinc-900/50 border border-zinc-800/60 hover:bg-zinc-800 rounded-md text-center transition-colors"
                >
                  <CurrencyDollarIcon className="w-5 h-5 mx-auto text-zinc-400 mb-1" />
                  <div className="text-sm font-medium">{formatCurrency(budget)}</div>
                  <div className="text-[10px] text-zinc-500">Budget</div>
                </button>
              ))}
            </div>
            
            {/* Results */}
            {optimizeMutation.data && (
              <div className="space-y-3 p-4 bg-zinc-900/50 rounded-md border border-zinc-800/60">
                <div className="flex items-center gap-2">
                  <SparklesIcon className="w-5 h-5 text-zinc-400" />
                  <span className="font-medium">Optimization Result</span>
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <div className="text-xs text-zinc-500">Expected Improvement</div>
                    <div className={`text-lg font-bold ${(optimizeMutation.data.expected_improvement_pct ?? 0) >= 0 ? 'text-emerald-400/80' : 'text-amber-400/80'}`}>
                      {(optimizeMutation.data.expected_improvement_pct ?? 0) >= 0 ? '+' : ''}{(optimizeMutation.data.expected_improvement_pct ?? 0).toFixed(1)}%
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-zinc-500">ROI</div>
                    <div className={`text-lg font-bold ${(optimizeMutation.data.roi_pct ?? 0) >= 0 ? 'text-zinc-400' : 'text-amber-400/80'}`}>
                      {(optimizeMutation.data.roi_pct ?? 0).toFixed(0)}%
                    </div>
                  </div>
                  <div className="col-span-2">
                    <div className="text-xs text-zinc-500">Cost of mitigation</div>
                    <div className="text-sm font-medium text-zinc-300">
                      {formatCurrency(optimizeMutation.data.cost_of_mitigation ?? 0)}
                    </div>
                  </div>
                </div>
                
                <div>
                  <div className="text-xs text-zinc-500 mb-2">Implementation Priority</div>
                  <ol className="space-y-1">
                    {optimizeMutation.data.implementation_priority.map((item: string, i: number) => (
                      <li key={i} className="text-xs text-zinc-300 flex items-center gap-2">
                        <span className="w-4 h-4 bg-zinc-900/80 border border-zinc-800/60 rounded-full text-zinc-400 font-mono text-[10px] flex items-center justify-center">
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
                <div className="w-6 h-6 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* AI Explain Modal */}
      <AnimatePresence>
        {aiOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => { setAiOpen(false); setAiLoading(false) }}
          >
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              className="w-full max-w-2xl rounded-md bg-zinc-950/90 border border-zinc-800/60 p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-sm font-display font-semibold text-zinc-300">AI Explain (What-If)</div>
                  <div className="text-[11px] text-zinc-500">Answer includes citations and sources.</div>
                </div>
                <button
                  type="button"
                  className="text-zinc-500 hover:text-zinc-300 text-xs"
                  onClick={() => setAiOpen(false)}
                >
                  Close
                </button>
              </div>

              <textarea
                value={aiQuestion}
                onChange={(e) => setAiQuestion(e.target.value)}
                className="mt-3 w-full min-h-[90px] rounded-md bg-zinc-900/80 border border-zinc-800/60 p-3 text-sm text-zinc-300 placeholder-zinc-500 font-sans focus:outline-none focus:ring-2 focus:ring-zinc-600"
                placeholder="Ask about what-if results…"
              />

              <div className="mt-3 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={aiLoading || aiQuestion.trim().length < 2}
                  className="px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-800/60 hover:bg-zinc-700 text-zinc-300 text-xs disabled:opacity-50"
                  onClick={async () => {
                    setAiLoading(true)
                    setAiError(null)
                    setAiAnswer(null)
                    setAiSources([])
                    try {
                      const ctx = {
                        whatif: {
                          base_exposure: baseExposure,
                          parameters,
                          comparison: comparisonMutation.data ?? null,
                        },
                      }
                      const res = await fetch('/api/v1/aiq/ask', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          question: aiQuestion.trim(),
                          include_overseer_status: false,
                          context: ctx,
                        }),
                      })
                      if (!res.ok) throw new Error(`aiq ask ${res.status}`)
                      const json = await res.json()
                      setAiAnswer(json?.answer ?? '')
                      setAiSources(normalizeAiqSources(json?.sources))
                    } catch (e: any) {
                      setAiError(e?.message ?? 'Failed to ask')
                    } finally {
                      setAiLoading(false)
                    }
                  }}
                >
                  {aiLoading ? 'Asking…' : 'Ask'}
                </button>
              </div>

              {aiError && <div className="mt-3 text-xs text-amber-400/80">{aiError}</div>}

              {aiAnswer != null && (
                <div className="mt-3 rounded-md bg-zinc-900/80 border border-zinc-800/60 p-3">
                  <div className="text-[11px] text-zinc-500 mb-1">Answer</div>
                  <pre className="whitespace-pre-wrap break-words text-sm text-zinc-300">{aiAnswer}</pre>

                  {normalizeAiqSources(aiSources).length > 0 && (
                    <>
                      <div className="text-[11px] text-zinc-500 mt-3 mb-1">Sources</div>
                      <ul className="space-y-1">
                        {normalizeAiqSources(aiSources).slice(0, 10).map((s, i) => (
                          <li key={s.id || i} className="text-[11px] text-zinc-500">
                            <span className="text-zinc-600">[{i + 1}]</span>{' '}
                            <span className="text-zinc-300">{s.title || s.id}</span>
                            {s.kind && <span className="text-zinc-600"> · {s.kind}</span>}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
