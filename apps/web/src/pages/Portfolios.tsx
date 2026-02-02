/**
 * Portfolios Page - REIT and Fund Management
 * Displays list of portfolios with REIT metrics
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PlusIcon,
  ArrowPathIcon,
  BuildingOfficeIcon,
  ChartBarIcon,
  ArrowTrendingUpIcon,
} from '@heroicons/react/24/outline'
import { portfoliosApi, seedApi } from '../lib/api'

interface Portfolio {
  id: string
  name: string
  code: string
  portfolio_type: string
  base_currency: string
  manager_name: string | null
  nav: number | null
  ffo: number | null
  yield_pct: number | null
  debt_to_equity: number | null
  occupancy: number | null
  asset_count: number
  climate_risk_score: number | null
  ytd_return: number | null
  created_at: string
}

const typeLabels: Record<string, string> = {
  fund: 'Investment Fund',
  reit: 'REIT',
  pension: 'Pension Fund',
  insurance: 'Insurance Portfolio',
  sovereign: 'Sovereign Fund',
  custom: 'Custom Portfolio',
}

const typeColors: Record<string, string> = {
  fund: 'bg-primary-500/20 text-primary-300',
  reit: 'bg-purple-500/20 text-purple-300',
  pension: 'bg-blue-500/20 text-blue-300',
  insurance: 'bg-amber-500/20 text-amber-300',
  sovereign: 'bg-green-500/20 text-green-300',
  custom: 'bg-white/10 text-white/70',
}

export default function Portfolios() {
  const navigate = useNavigate()
  const [portfolios, setPortfolios] = useState<Portfolio[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [seedLoading, setSeedLoading] = useState(false)
  const [seedError, setSeedError] = useState<string | null>(null)

  useEffect(() => {
    fetchPortfolios()
  }, [typeFilter])

  const fetchPortfolios = async () => {
    setLoading(true)
    try {
      const data = await portfoliosApi.list({
        portfolio_type: typeFilter || undefined,
      })
      setPortfolios(data)
    } catch (error) {
      console.error('Failed to fetch portfolios:', error)
      setPortfolios([])
    } finally {
      setLoading(false)
    }
  }

  const filteredPortfolios = portfolios.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.code?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatCurrency = (value: number | null, currency: string) => {
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

  return (
    <div className="h-full overflow-auto p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-white flex items-center gap-2">
            <BuildingOfficeIcon className="w-8 h-8 text-emerald-400" />
            Portfolios & REIT
          </h1>
          <p className="text-dark-muted text-sm mt-1">
            Fund and REIT management with NAV, FFO, and yield analytics
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchPortfolios}
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            title="Refresh"
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => navigate('/portfolios/new')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            New Portfolio
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass rounded-2xl p-4 border border-white/5">
          <p className="text-dark-muted text-xs">Total Portfolios</p>
          <p className="text-xl font-bold text-white">{portfolios.length}</p>
        </div>
        <div className="glass rounded-2xl p-4 border border-white/5">
          <p className="text-dark-muted text-xs">Total NAV</p>
          <p className="text-xl font-bold text-white">
            {formatCurrency(portfolios.reduce((sum, p) => sum + (p.nav || 0), 0), 'EUR')}
          </p>
        </div>
        <div className="glass rounded-2xl p-4 border border-white/5">
          <p className="text-dark-muted text-xs">Total Assets</p>
          <p className="text-xl font-bold text-white">
            {portfolios.reduce((sum, p) => sum + p.asset_count, 0)}
          </p>
        </div>
        <div className="glass rounded-2xl p-4 border border-white/5">
          <p className="text-dark-muted text-xs">Avg Yield</p>
          <p className="text-xl font-bold text-green-400">
            {formatPercent(
              portfolios.filter((p) => p.yield_pct).length > 0
                ? portfolios.reduce((sum, p) => sum + (p.yield_pct || 0), 0) /
                    portfolios.filter((p) => p.yield_pct).length
                : null
            )}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass rounded-2xl p-4 border border-white/5 mb-6 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search portfolios..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-primary-500/50"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white min-w-[150px] focus:outline-none focus:ring-2 focus:ring-primary-500/50"
        >
          <option value="">All Types</option>
          {Object.entries(typeLabels).map(([value, label]) => (
            <option key={value} value={value} className="bg-dark-card">
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="h-1 rounded-full bg-white/10 overflow-hidden mb-6">
          <div className="h-full w-1/3 bg-primary-500 animate-pulse" />
        </div>
      )}

      {/* Portfolios Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredPortfolios.map((portfolio) => (
          <div
            key={portfolio.id}
            onClick={() => navigate(`/portfolios/${portfolio.id}`)}
            className="glass rounded-2xl p-5 border border-white/5 hover:border-primary-500/30 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-white truncate">{portfolio.name}</h3>
                <p className="text-dark-muted text-sm font-mono">{portfolio.code}</p>
              </div>
              <span
                className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${
                  typeColors[portfolio.portfolio_type] || 'bg-white/10 text-white/70'
                }`}
              >
                {typeLabels[portfolio.portfolio_type] || portfolio.portfolio_type}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="p-2 rounded-lg bg-white/5">
                <p className="text-dark-muted text-xs">NAV</p>
                <p className="font-semibold text-white">
                  {formatCurrency(portfolio.nav, portfolio.base_currency)}
                </p>
              </div>
              <div className="p-2 rounded-lg bg-white/5">
                <p className="text-dark-muted text-xs">FFO</p>
                <p className="font-semibold text-white">
                  {formatCurrency(portfolio.ffo, portfolio.base_currency)}
                </p>
              </div>
            </div>

            <div className="flex justify-between text-sm mb-3">
              <div className="text-center">
                <p className="text-dark-muted text-xs">Yield</p>
                <p className="font-semibold text-green-400">{formatPercent(portfolio.yield_pct)}</p>
              </div>
              <div className="text-center">
                <p className="text-dark-muted text-xs">D/E</p>
                <p className="font-semibold text-white">
                  {portfolio.debt_to_equity?.toFixed(2) || '-'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-dark-muted text-xs">Occupancy</p>
                <p className="font-semibold text-white">
                  {portfolio.occupancy ? `${(portfolio.occupancy * 100).toFixed(0)}%` : '-'}
                </p>
              </div>
              <div className="text-center">
                <p className="text-dark-muted text-xs">Assets</p>
                <p className="font-semibold text-white">{portfolio.asset_count}</p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-white/10">
              <div className="flex items-center gap-1">
                <span className="text-dark-muted text-xs">Climate Risk:</span>
                <span className={`font-semibold text-sm ${getRiskColor(portfolio.climate_risk_score)}`}>
                  {portfolio.climate_risk_score?.toFixed(0) || '-'}
                </span>
              </div>
              {portfolio.ytd_return !== null && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-full border ${
                    portfolio.ytd_return >= 0
                      ? 'border-green-500/30 text-green-400 bg-green-500/10'
                      : 'border-red-500/30 text-red-400 bg-red-500/10'
                  }`}
                >
                  <ArrowTrendingUpIcon className="w-3.5 h-3.5 inline -mr-0.5" />
                  YTD: {formatPercent(portfolio.ytd_return)}
                </span>
              )}
            </div>

            {portfolio.manager_name && (
              <p className="text-dark-muted text-xs mt-2">Manager: {portfolio.manager_name}</p>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {!loading && filteredPortfolios.length === 0 && (
        <div className="text-center py-16">
          <ChartBarIcon className="w-16 h-16 mx-auto text-dark-muted/50 mb-4" />
          <h3 className="text-lg font-semibold text-white/80 mb-2">No portfolios found</h3>
          <p className="text-dark-muted mb-4">Create your first portfolio or load sample data for demos</p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={async () => {
                setSeedError(null)
                setSeedLoading(true)
                try {
                  await seedApi.seedSampleData()
                  await fetchPortfolios()
                } catch (e: unknown) {
                  setSeedError(e instanceof Error ? e.message : 'Failed to load sample data')
                } finally {
                  setSeedLoading(false)
                }
              }}
              disabled={seedLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 text-white font-medium hover:bg-white/15 transition-colors border border-white/20 disabled:opacity-50"
            >
              {seedLoading ? (
                <ArrowPathIcon className="w-5 h-5 animate-spin" />
              ) : (
                <ArrowPathIcon className="w-5 h-5" />
              )}
              Load sample data
            </button>
            <button
              onClick={() => navigate('/portfolios/new')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              Create Portfolio
            </button>
          </div>
          {seedError && <p className="text-amber-400 text-sm mt-3">{seedError}</p>}
        </div>
      )}
    </div>
  )
}
