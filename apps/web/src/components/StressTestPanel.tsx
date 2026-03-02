/**
 * Stress Testing Panel
 * =====================
 * 
 * Interactive stress testing UI for Command Center:
 * - Scenario selection
 * - Severity slider
 * - Run stress test
 * - Display results (VaR, CVaR, etc.)
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const API_BASE = '/api/v1'

interface StressResult {
  scenario_type: string
  var_99: number
  expected_shortfall: number
  max_loss: number
  recovery_time_years: number
  affected_assets: number
  cascade_depth: number
  simulation_count: number
}

const SCENARIOS = [
  { id: 'climate_physical', name: 'Climate Physical', color: 'red', description: 'Floods, storms, heat waves' },
  { id: 'climate_transition', name: 'Climate Transition', color: 'orange', description: 'Carbon pricing, stranded assets' },
  { id: 'credit_shock', name: 'Credit Shock', color: 'yellow', description: 'Sudden credit deterioration' },
  { id: 'liquidity_crisis', name: 'Liquidity Crisis', color: 'purple', description: 'Market-wide liquidity freeze' },
  { id: 'correlation_spike', name: 'Correlation Spike', color: 'pink', description: 'Asset correlations surge' },
  { id: 'pandemic', name: 'Pandemic', color: 'blue', description: 'Global health crisis' },
  { id: 'geopolitical', name: 'Geopolitical', color: 'gray', description: 'Regional conflict, sanctions' },
]

interface StressTestPanelProps {
  isOpen: boolean
  onClose: () => void
  totalExposure: number
}

export default function StressTestPanel({ isOpen, onClose, totalExposure }: StressTestPanelProps) {
  const [selectedScenario, setSelectedScenario] = useState('climate_physical')
  const [severity, setSeverity] = useState(0.7)
  const [isRunning, setIsRunning] = useState(false)
  const [result, setResult] = useState<StressResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const runStressTest = async () => {
    setIsRunning(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch(`${API_BASE}/stress/portfolio`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          total_exposure: totalExposure,
          num_assets: 100,
          average_pd: 0.03,
          average_lgd: 0.45,
          scenario_type: selectedScenario,
          severity: severity,
          num_simulations: 100000,
        }),
      })

      if (!response.ok) {
        throw new Error('Stress test failed')
      }

      const data = await response.json()
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setIsRunning(false)
    }
  }

  const selectedScenarioInfo = SCENARIOS.find(s => s.id === selectedScenario)

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="absolute top-8 left-1/2 -translate-x-1/2 z-50 pointer-events-auto"
          initial={{ opacity: 0, y: -50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -50, scale: 0.95 }}
          transition={{ duration: 0.3 }}
        >
          <div className="bg-black/80 rounded-md border border-white/10 p-6 w-[500px] shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-white font-medium text-lg">Stress Testing</h2>
                <p className="text-white/40 text-xs">Monte Carlo simulation with 100,000 paths</p>
              </div>
              <button
                onClick={onClose}
                className="text-white/40 hover:text-white transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scenario Selection */}
            <div className="mb-5">
              <div className="text-white/50 text-[10px] uppercase tracking-wider mb-2">
                Stress Scenario
              </div>
              <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                <div className="grid grid-cols-2 gap-2">
                  {SCENARIOS.map((scenario) => (
                  <button
                    key={scenario.id}
                    onClick={() => setSelectedScenario(scenario.id)}
                    className={`p-2 rounded-md border text-left transition-all ${
                      selectedScenario === scenario.id
                        ? 'bg-white/10 border-amber-500/50'
                        : 'bg-white/5 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <div className="text-white text-xs font-medium">{scenario.name}</div>
                    <div className="text-white/40 text-[10px]">{scenario.description}</div>
                  </button>
                ))}
                </div>
              </div>
            </div>

            {/* Severity Slider */}
            <div className="mb-5">
              <div className="flex justify-between items-center mb-2">
                <div className="text-white/50 text-[10px] uppercase tracking-wider">
                  Severity
                </div>
                <div className="text-white text-sm font-mono">
                  {(severity * 100).toFixed(0)}%
                </div>
              </div>
              <input
                type="range"
                min="0.1"
                max="1"
                step="0.1"
                value={severity}
                onChange={(e) => setSeverity(parseFloat(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer
                  [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 
                  [&::-webkit-slider-thumb]:bg-amber-500/80 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
              />
              <div className="flex justify-between text-[10px] text-white/30 mt-1">
                <span>Mild</span>
                <span>Moderate</span>
                <span>Severe</span>
              </div>
            </div>

            {/* Run Button */}
            <button
              onClick={runStressTest}
              disabled={isRunning}
className="w-full py-3 bg-gradient-to-r from-amber-500/80 to-amber-600/80 text-white rounded-md font-medium
                hover:from-amber-400/80 hover:to-amber-500/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center justify-center gap-2"
            >
              {isRunning ? (
                <>
                  <motion.div
                    className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                  />
                  Running Simulation...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Run Stress Test
                </>
              )}
            </button>

            {/* Error */}
            {error && (
              <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-md text-red-400/80 text-sm">
                {error}
              </div>
            )}

            {/* Results */}
            <AnimatePresence>
              {result && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-5 pt-5 border-t border-white/10"
                >
                  <div className="text-white/50 text-[10px] uppercase tracking-wider mb-3">
                    Stress Test Results
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {/* VaR 99% */}
                    <div className="p-3 bg-white/5 rounded-md">
                      <div className="text-white/40 text-[10px] uppercase">VaR 99%</div>
                      <div className="text-red-400/80 text-xl font-light">
                        ${(result.var_99 / 1e9).toFixed(2)}<span className="text-sm">B</span>
                      </div>
                    </div>
                    
                    {/* Expected Shortfall */}
                    <div className="p-3 bg-white/5 rounded-md">
                      <div className="text-white/40 text-[10px] uppercase">CVaR (ES)</div>
                      <div className="text-orange-400/80 text-xl font-light">
                        ${(result.expected_shortfall / 1e9).toFixed(2)}<span className="text-sm">B</span>
                      </div>
                    </div>
                    
                    {/* Max Loss */}
                    <div className="p-3 bg-white/5 rounded-md">
                      <div className="text-white/40 text-[10px] uppercase">Max Loss</div>
                      <div className="text-red-500/80 text-xl font-light">
                        ${(result.max_loss / 1e9).toFixed(2)}<span className="text-sm">B</span>
                      </div>
                    </div>
                    
                    {/* Recovery Time */}
                    <div className="p-3 bg-white/5 rounded-md">
                      <div className="text-white/40 text-[10px] uppercase">Recovery</div>
                      <div className="text-yellow-400/80 text-xl font-light">
                        {result.recovery_time_years.toFixed(1)}<span className="text-sm"> yrs</span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Additional Info */}
                  <div className="mt-4 flex justify-between text-[10px] text-white/30">
                    <span>Affected: {result.affected_assets.toLocaleString()} simulations</span>
                    <span>Cascade depth: {result.cascade_depth}</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
