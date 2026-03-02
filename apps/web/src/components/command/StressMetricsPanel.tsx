/**
 * StressMetricsPanel - Stress Test Key Metrics Display
 * 
 * Shows: VaR, CVaR, Capital Impact, Expected Loss
 * Live data from active stress test
 */
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import { 
  ChartBarIcon, 
  ExclamationTriangleIcon,
  ArrowTrendingDownIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline'
import { StressTestState, PortfolioState } from '../../store/platformStore'

interface StressMetricsPanelProps {
  stressTest: StressTestState | null
  portfolio: PortfolioState
}

interface StressTestResults {
  id: string
  name: string
  var_95: number
  cvar_99: number
  expected_loss: number
  capital_impact: number
  affected_assets: number
  peak_loss_time: number
  recovery_time: number
  scenario_type: string
  severity: number
}

function formatBillions(value: number): string {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}T`
  if (value >= 1) return `$${value.toFixed(1)}B`
  return `$${(value * 1000).toFixed(0)}M`
}

function formatPercent(value: number): string {
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(1)}%`
}

export default function StressMetricsPanel({ stressTest, portfolio }: StressMetricsPanelProps) {
  // Fetch stress test results if we have an active test
  const { data: results, isLoading } = useQuery<StressTestResults>({
    queryKey: ['stress-test-results', stressTest?.id],
    queryFn: async () => {
      if (!stressTest?.id) throw new Error('No stress test selected')
      const res = await fetch(`/api/v1/stress-tests/${stressTest.id}/results`)
      if (!res.ok) throw new Error('Failed to fetch results')
      return res.json()
    },
    enabled: !!stressTest?.id,
    staleTime: 10000,
    refetchInterval: 30000,
  })

  // Fallback/simulated data when no real data
  const metrics = results || {
    var_95: portfolio.atRisk * 0.85,
    cvar_99: portfolio.atRisk * 1.2,
    expected_loss: portfolio.atRisk * 0.25,
    capital_impact: -4.8,
    affected_assets: Math.round((portfolio.totalAssets || 1284) * 0.12),
    scenario_type: stressTest?.type || 'Climate Stress',
    severity: stressTest?.severity || 0.65,
  }

  const scenarioName = stressTest?.name || 'No Active Scenario'

  return (
    <div className="h-full bg-black/80 border border-zinc-800 rounded-md p-4 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <ChartBarIcon className="w-5 h-5 text-zinc-400" />
          <h3 className="text-sm font-medium text-zinc-100">Stress Metrics</h3>
        </div>
        {stressTest?.status === 'running' && (
          <span className="flex items-center gap-1.5 text-xs text-zinc-400">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-pulse" />
            Running
          </span>
        )}
      </div>

      {/* Scenario Info */}
      <div className="mb-4 p-3 bg-zinc-800 rounded-md border border-zinc-800">
        <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Active Scenario</div>
        <div className="text-sm font-medium text-zinc-100 truncate">{scenarioName}</div>
        {stressTest && (
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-zinc-500">Severity:</span>
              <span className="text-xs text-red-400/80">{((stressTest.severity || 0.65) * 100).toFixed(0)}%</span>
            </div>
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-zinc-500">Prob:</span>
              <span className="text-xs text-zinc-300">{((stressTest.probability || 0.15) * 100).toFixed(0)}%</span>
            </div>
          </div>
        )}
      </div>

      {/* Metrics Grid */}
      <div className="flex-1 grid grid-cols-2 gap-3">
        {/* VaR 95% */}
        <motion.div 
          className="p-3 bg-gradient-to-br from-red-500/10 to-transparent rounded-md border border-red-500/20"
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <ExclamationTriangleIcon className="w-3.5 h-3.5 text-red-400/80" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">VaR (95%)</span>
          </div>
          <div className="text-xl font-bold text-red-400/80">
            {formatBillions(metrics.var_95)}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Value at Risk</div>
        </motion.div>

        {/* CVaR 99% */}
        <motion.div 
          className="p-3 bg-gradient-to-br from-orange-500/10 to-transparent rounded-md border border-orange-500/20"
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.15 }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <ExclamationTriangleIcon className="w-3.5 h-3.5 text-orange-400/80" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">CVaR (99%)</span>
          </div>
          <div className="text-xl font-bold text-orange-400/80">
            {formatBillions(metrics.cvar_99)}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Conditional VaR</div>
        </motion.div>

        {/* Expected Loss */}
        <motion.div 
          className="p-3 bg-zinc-800 rounded-md border border-zinc-700"
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <BanknotesIcon className="w-3.5 h-3.5 text-amber-400/80" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Expected Loss</span>
          </div>
          <div className="text-xl font-bold text-amber-400/80">
            {formatBillions(metrics.expected_loss)}
          </div>
          {/* Progress bar */}
          <div className="mt-2 h-1 bg-zinc-700 rounded-full overflow-hidden">
            <motion.div 
              className="h-full bg-amber-500"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (metrics.expected_loss / portfolio.atRisk) * 100)}%` }}
              transition={{ delay: 0.3, duration: 0.5 }}
            />
          </div>
        </motion.div>

        {/* Capital Impact */}
        <motion.div 
          className="p-3 bg-gradient-to-br from-zinc-700/30 to-transparent rounded-md border border-zinc-700"
          initial={{ scale: 0.95 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.25 }}
        >
          <div className="flex items-center gap-1.5 mb-1">
            <ArrowTrendingDownIcon className="w-3.5 h-3.5 text-zinc-400" />
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Capital Impact</span>
          </div>
          <div className="text-xl font-bold text-zinc-400">
            {formatPercent(metrics.capital_impact)}
          </div>
          <div className="text-[10px] text-zinc-500 mt-0.5">Capital Adequacy</div>
        </motion.div>
      </div>

      {/* Footer */}
      <div className="mt-3 pt-3 border-t border-zinc-800 flex items-center justify-between text-[10px] text-zinc-500">
        <span>{metrics.affected_assets} assets affected</span>
        {isLoading && <span className="text-zinc-400">Updating...</span>}
      </div>
    </div>
  )
}
