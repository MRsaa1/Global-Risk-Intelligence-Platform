/**
 * Portfolio Detail Page - REIT metrics, allocations, and 3D globe view
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  BuildingOfficeIcon,
  MapIcon,
  CpuChipIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
} from '@heroicons/react/24/outline'
import { portfoliosApi } from '../lib/api'

interface Portfolio {
  id: string
  name: string
  code: string
  description: string
  portfolio_type: string
  base_currency: string
  manager_name: string | null
  nav: number | null
  ffo: number | null
  yield_pct: number | null
  asset_count: number
}

interface REITMetrics {
  portfolio_id: string
  portfolio_name: string
  as_of_date: string
  nav: number
  nav_per_share: number | null
  ffo: number
  affo: number
  dividend_yield: number
  earnings_yield: number
  debt_to_equity: number
  loan_to_value: number
  interest_coverage: number
  occupancy: number
  noi: number
  cap_rate: number
  ytd_return: number
  asset_count: number
  total_gfa_m2: number
  var_95: number
  climate_risk_score: number
  sector_allocation: Record<string, number>
  geographic_allocation: Record<string, number>
}

interface PortfolioAsset {
  id: string
  portfolio_id: string
  asset_id: string
  share_pct: number
  current_value: number | null
  target_irr: number | null
  actual_irr: number | null
  weight_pct: number | null
  investment_strategy: string | null
}

interface StressTestResult {
  scenario: string
  impact_description: string
  base_nav: number
  stressed_nav: number
  nav_change_pct: number
  base_yield: number
  stressed_yield: number
  yield_change_pct: number
}

interface OptimizationResult {
  objective: string
  current_metrics: Record<string, number>
  recommendations: Array<{ type: string; priority: string; description: string }>
  target_metrics: Record<string, number>
}

const typeLabels: Record<string, string> = {
  fund: 'Investment Fund',
  reit: 'REIT',
  pension: 'Pension Fund',
  insurance: 'Insurance Portfolio',
  sovereign: 'Sovereign Fund',
  custom: 'Custom Portfolio',
}

const TABS = ['REIT Metrics', 'Allocations', 'Stress Test', 'Optimizer', 'Assets']

export default function PortfolioDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null)
  const [metrics, setMetrics] = useState<REITMetrics | null>(null)
  const [assets, setAssets] = useState<PortfolioAsset[]>([])
  const [stressResult, setStressResult] = useState<StressTestResult | null>(null)
  const [optimization, setOptimization] = useState<OptimizationResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [tabValue, setTabValue] = useState(0)
  const [stressScenario, setStressScenario] = useState('rate_rise')

  useEffect(() => {
    if (id) fetchPortfolioData()
  }, [id])

  const fetchPortfolioData = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [portfolioData, metricsData, assetsData] = await Promise.all([
        portfoliosApi.get(id),
        portfoliosApi.getREITMetrics(id),
        portfoliosApi.listAssets(id),
      ])
      setPortfolio(portfolioData)
      setMetrics(metricsData)
      setAssets(assetsData)
    } catch (error) {
      console.error('Failed to fetch portfolio data:', error)
    } finally {
      setLoading(false)
    }
  }

  const runStressTest = async () => {
    if (!id) return
    try {
      const result = await portfoliosApi.runStressTest(id, stressScenario)
      setStressResult(result)
    } catch (error) {
      console.error('Failed to run stress test:', error)
    }
  }

  const runOptimization = async (objective: string) => {
    if (!id) return
    try {
      const result = await portfoliosApi.optimize(id, objective)
      setOptimization(result)
    } catch (error) {
      console.error('Failed to run optimization:', error)
    }
  }

  const formatCurrency = (value: number | null, currency: string = 'EUR') => {
    if (value === null) return '-'
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency,
      notation: 'compact',
      maximumFractionDigits: 1,
    }).format(value)
  }

  const formatPercent = (value: number | null) => {
    if (value === null) return '-'
    return `${(value * 100).toFixed(2)}%`
  }

  const getRiskColor = (score: number | null) => {
    if (score === null) return 'text-dark-muted'
    if (score < 30) return 'text-green-400'
    if (score < 60) return 'text-amber-400'
    return 'text-red-400'
  }

  if (loading) {
    return (
      <div className="h-full overflow-auto p-8">
        <div className="h-1 rounded-full bg-white/10 overflow-hidden mb-4">
          <div className="h-full w-1/3 bg-primary-500 animate-pulse" />
        </div>
        <p className="text-dark-muted">Loading portfolio...</p>
      </div>
    )
  }

  if (!portfolio || !metrics) {
    return (
      <div className="h-full overflow-auto p-8">
        <p className="text-white/80 mb-4">Portfolio not found</p>
        <button
          onClick={() => navigate('/portfolios')}
          className="flex items-center gap-2 text-primary-400 hover:text-primary-300"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          Back to Portfolios
        </button>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <button
            onClick={() => navigate('/portfolios')}
            className="flex items-center gap-2 text-dark-muted hover:text-white mb-2"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            Back to Portfolios
          </button>
          <h1 className="text-2xl font-display font-bold text-white flex items-center gap-2">
            <BuildingOfficeIcon className="w-8 h-8 text-emerald-400" />
            {portfolio.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-dark-muted text-sm font-mono">{portfolio.code}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-300">
              {typeLabels[portfolio.portfolio_type] || portfolio.portfolio_type}
            </span>
            {portfolio.manager_name && (
              <span className="text-dark-muted text-sm">Manager: {portfolio.manager_name}</span>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchPortfolioData}
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/70"
            title="Refresh"
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => navigate(`/portfolios/${id}/globe`)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-white/80 hover:bg-white/5"
          >
            <MapIcon className="w-5 h-5" />
            3D Globe View
          </button>
        </div>
      </div>

      {/* Key REIT Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
        <div className="glass rounded-2xl p-4 border border-primary-500/20 bg-primary-500/10 text-center">
          <p className="text-primary-300/80 text-xs">NAV</p>
          <p className="text-lg font-bold text-white">{formatCurrency(metrics.nav, portfolio.base_currency)}</p>
        </div>
        <div className="glass rounded-2xl p-4 border border-purple-500/20 bg-purple-500/10 text-center">
          <p className="text-purple-300/80 text-xs">FFO</p>
          <p className="text-lg font-bold text-white">{formatCurrency(metrics.ffo, portfolio.base_currency)}</p>
        </div>
        <div className="glass rounded-2xl p-4 border border-green-500/20 bg-green-500/10 text-center">
          <p className="text-green-300/80 text-xs">Yield</p>
          <p className="text-lg font-bold text-white">{formatPercent(metrics.dividend_yield)}</p>
        </div>
        <div className="glass rounded-2xl p-4 border border-white/5 text-center">
          <p className="text-dark-muted text-xs">D/E</p>
          <p className="text-lg font-bold text-white">{metrics.debt_to_equity.toFixed(2)}</p>
        </div>
        <div className="glass rounded-2xl p-4 border border-white/5 text-center">
          <p className="text-dark-muted text-xs">Occupancy</p>
          <p className="text-lg font-bold text-white">{(metrics.occupancy * 100).toFixed(0)}%</p>
        </div>
        <div className="glass rounded-2xl p-4 border border-white/5 text-center">
          <p className="text-dark-muted text-xs">Assets</p>
          <p className="text-lg font-bold text-white">{metrics.asset_count}</p>
        </div>
      </div>

      {/* Risk */}
      <div className="glass rounded-2xl p-4 border border-white/5 mb-6 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center gap-3">
          <CpuChipIcon className={`w-6 h-6 ${getRiskColor(metrics.climate_risk_score)}`} />
          <div>
            <p className="text-dark-muted text-sm">Climate Risk Score</p>
            <p className={`font-bold ${getRiskColor(metrics.climate_risk_score)}`}>{metrics.climate_risk_score.toFixed(0)} / 100</p>
          </div>
        </div>
        <div className="flex gap-6">
          <div className="text-right">
            <p className="text-dark-muted text-sm">VaR (95%)</p>
            <p className="font-bold text-amber-400">{formatCurrency(metrics.var_95, portfolio.base_currency)}</p>
          </div>
          <div className="text-right">
            <p className="text-dark-muted text-sm">Cap Rate</p>
            <p className="font-bold text-white">{formatPercent(metrics.cap_rate)}</p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="glass rounded-2xl border border-white/5 overflow-hidden">
        <div className="flex overflow-x-auto border-b border-white/10">
          {TABS.map((label, i) => (
            <button
              key={label}
              onClick={() => setTabValue(i)}
              className={`shrink-0 px-4 py-3 text-sm font-medium transition-colors whitespace-nowrap ${
                tabValue === i ? 'text-primary-400 border-b-2 border-primary-500 bg-white/5' : 'text-dark-muted hover:text-white/80'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tabValue === 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-white mb-3">Income Metrics</h3>
                <div className="space-y-2 text-sm">
                  {[
                    ['NOI', formatCurrency(metrics.noi, portfolio.base_currency)],
                    ['FFO', formatCurrency(metrics.ffo, portfolio.base_currency)],
                    ['AFFO', formatCurrency(metrics.affo, portfolio.base_currency)],
                    ['Dividend Yield', formatPercent(metrics.dividend_yield), 'text-green-400'],
                    ['Earnings Yield', formatPercent(metrics.earnings_yield)],
                  ].map((row) => {
                    const [k, v, cls] = row as [string, string, string?]
                    return (
                      <div key={k} className="flex justify-between py-2 border-b border-white/5">
                        <span className="text-dark-muted">{k}</span>
                        <span className={cls || 'text-white'}>{v}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div>
                <h3 className="font-semibold text-white mb-3">Leverage & Coverage</h3>
                <div className="space-y-2 text-sm">
                  {[
                    ['Debt-to-Equity', metrics.debt_to_equity.toFixed(2)],
                    ['Loan-to-Value', formatPercent(metrics.loan_to_value)],
                    ['Interest Coverage', `${metrics.interest_coverage.toFixed(2)}x`],
                    ['YTD Return', formatPercent(metrics.ytd_return), metrics.ytd_return >= 0 ? 'text-green-400' : 'text-red-400'],
                    ['Total GFA', `${metrics.total_gfa_m2.toLocaleString()} m²`],
                  ].map((row) => {
                    const [k, v, cls] = row as [string, string, string?]
                    return (
                      <div key={k} className="flex justify-between py-2 border-b border-white/5">
                        <span className="text-dark-muted">{k}</span>
                        <span className={cls || 'text-white'}>{v}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {tabValue === 1 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-semibold text-white mb-3">Sector Allocation</h3>
                {Object.entries(metrics.sector_allocation).length === 0 ? (
                  <p className="text-dark-muted">No sector data</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(metrics.sector_allocation).map(([sector, pct]) => (
                      <div key={sector}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-white/80">{sector}</span>
                          <span className="font-semibold text-white">{pct.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full bg-primary-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-semibold text-white mb-3">Geographic Allocation</h3>
                {Object.entries(metrics.geographic_allocation).length === 0 ? (
                  <p className="text-dark-muted">No geographic data</p>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(metrics.geographic_allocation).map(([country, pct]) => (
                      <div key={country}>
                        <div className="flex justify-between text-sm mb-1">
                          <span className="text-white/80">{country}</span>
                          <span className="font-semibold text-white">{pct.toFixed(1)}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                          <div className="h-full bg-purple-500 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tabValue === 2 && (
            <div>
              <div className="flex flex-wrap gap-3 mb-6">
                <select
                  value={stressScenario}
                  onChange={(e) => setStressScenario(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white min-w-[200px] focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                >
                  <option value="rate_rise" className="bg-dark-card">Rate Rise (+200bps)</option>
                  <option value="rezone" className="bg-dark-card">Regulatory Rezoning</option>
                  <option value="climate" className="bg-dark-card">Climate Stress</option>
                </select>
                <button onClick={runStressTest} className="px-4 py-2 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600">
                  Run Stress Test
                </button>
              </div>
              {stressResult && (
                <div className="space-y-4">
                  <div
                    className={`p-4 rounded-xl border ${
                      stressResult.nav_change_pct < -10
                        ? 'bg-red-500/10 border-red-500/30'
                        : stressResult.nav_change_pct < -5
                        ? 'bg-amber-500/10 border-amber-500/30'
                        : 'bg-blue-500/10 border-blue-500/30'
                    }`}
                  >
                    <p className="font-semibold text-white">{stressResult.impact_description}</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border border-white/10 text-center">
                      <p className="text-dark-muted text-sm mb-1">NAV Impact</p>
                      <p className={`text-2xl font-bold ${stressResult.nav_change_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {stressResult.nav_change_pct.toFixed(1)}%
                      </p>
                      <p className="text-sm text-white/70 mt-1">
                        {formatCurrency(stressResult.base_nav, portfolio.base_currency)} → {formatCurrency(stressResult.stressed_nav, portfolio.base_currency)}
                      </p>
                    </div>
                    <div className="p-4 rounded-xl border border-white/10 text-center">
                      <p className="text-dark-muted text-sm mb-1">Yield Impact</p>
                      <p className={`text-2xl font-bold ${stressResult.yield_change_pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {stressResult.yield_change_pct.toFixed(1)}%
                      </p>
                      <p className="text-sm text-white/70 mt-1">
                        {formatPercent(stressResult.base_yield)} → {formatPercent(stressResult.stressed_yield)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tabValue === 3 && (
            <div>
              <div className="flex flex-wrap gap-2 mb-6">
                <button onClick={() => runOptimization('maximize_yield')} className="px-4 py-2 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600">
                  Maximize Yield
                </button>
                <button onClick={() => runOptimization('minimize_risk')} className="px-4 py-2 rounded-xl border border-white/10 text-white/80 hover:bg-white/5">
                  Minimize Risk
                </button>
                <button onClick={() => runOptimization('balanced')} className="px-4 py-2 rounded-xl border border-white/10 text-white/80 hover:bg-white/5">
                  Balanced
                </button>
              </div>
              {optimization && (
                <div className="space-y-3">
                  <h3 className="font-semibold text-white">
                    Recommendations ({optimization.objective.replace('_', ' ')})
                  </h3>
                  {optimization.recommendations.length === 0 ? (
                    <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20 text-green-300">
                      Portfolio is well optimized for this objective
                    </div>
                  ) : (
                    optimization.recommendations.map((rec, i) => (
                      <div
                        key={i}
                        className={`p-4 rounded-xl border flex gap-3 ${
                          rec.priority === 'high' ? 'bg-amber-500/10 border-amber-500/20' : 'bg-blue-500/10 border-blue-500/20'
                        }`}
                      >
                        {rec.priority === 'high' ? (
                          <ExclamationTriangleIcon className="w-5 h-5 text-amber-400 shrink-0" />
                        ) : (
                          <CheckCircleIcon className="w-5 h-5 text-blue-400 shrink-0" />
                        )}
                        <p className="text-sm text-white/90">
                          <strong>[{rec.type}]</strong> {rec.description}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {tabValue === 4 && (
            <div>
              <h3 className="font-semibold text-white mb-4">Portfolio Assets</h3>
              {assets.length === 0 ? (
                <p className="text-dark-muted">No assets in portfolio</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left">
                        <th className="py-3 px-4 text-dark-muted font-medium">Asset ID</th>
                        <th className="py-3 px-4 text-dark-muted font-medium text-right">Ownership %</th>
                        <th className="py-3 px-4 text-dark-muted font-medium text-right">Value</th>
                        <th className="py-3 px-4 text-dark-muted font-medium text-right">Weight %</th>
                        <th className="py-3 px-4 text-dark-muted font-medium text-right">Target IRR</th>
                        <th className="py-3 px-4 text-dark-muted font-medium text-right">Actual IRR</th>
                        <th className="py-3 px-4 text-dark-muted font-medium">Strategy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {assets.map((asset) => (
                        <tr
                          key={asset.id}
                          onClick={() => navigate(`/assets/${asset.asset_id}`)}
                          className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
                        >
                          <td className="py-3 px-4 font-mono text-white/80">{asset.asset_id.slice(0, 8)}...</td>
                          <td className="py-3 px-4 text-right text-white">{asset.share_pct.toFixed(0)}%</td>
                          <td className="py-3 px-4 text-right text-white">{formatCurrency(asset.current_value, portfolio.base_currency)}</td>
                          <td className="py-3 px-4 text-right text-white">{asset.weight_pct?.toFixed(1) || '-'}%</td>
                          <td className="py-3 px-4 text-right text-white">{formatPercent(asset.target_irr)}</td>
                          <td
                            className={`py-3 px-4 text-right font-medium ${
                              (asset.actual_irr || 0) >= (asset.target_irr || 0) ? 'text-green-400' : 'text-red-400'
                            }`}
                          >
                            {formatPercent(asset.actual_irr)}
                          </td>
                          <td className="py-3 px-4">
                            <span className="text-xs px-2 py-0.5 rounded border border-white/10">
                              {asset.investment_strategy || 'core'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
