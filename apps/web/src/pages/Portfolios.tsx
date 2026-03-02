/**
 * Portfolios & REIT — Fund and REIT management with NAV, FFO, and yield analytics.
 * Unified Corporate Style: zinc palette, section labels font-mono text-[10px]
 * uppercase tracking-widest text-zinc-500, rounded-md only, no glass/blur. See Implementation Audit.
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
  fund: 'bg-zinc-700 text-zinc-300',
  reit: 'bg-zinc-700 text-zinc-300',
  pension: 'bg-zinc-700 text-zinc-300',
  insurance: 'bg-zinc-700 text-zinc-300',
  sovereign: 'bg-zinc-700 text-zinc-300',
  custom: 'bg-zinc-700 text-zinc-300',
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
    if (score === null) return 'text-zinc-500'
    if (score < 30) return 'text-green-400/80'
    if (score < 60) return 'text-amber-400/80'
    return 'text-red-400/80'
  }

  return (
    <div className="min-h-full p-6 bg-zinc-950 pb-16">
      <div className="w-full max-w-[1920px] mx-auto">
        {/* Header — Unified Corporate Style */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-zinc-800 rounded-md border border-zinc-700">
              <BuildingOfficeIcon className="w-8 h-8 text-zinc-400" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-semibold text-zinc-100">
                Portfolios & REIT
              </h1>
              <p className="text-zinc-500 text-sm mt-1 font-sans">
                Fund and REIT management with NAV, FFO, and yield analytics
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchPortfolios}
              className="p-2 rounded-md bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors"
              title="Refresh"
            >
              <ArrowPathIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/portfolios/new')}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 font-medium hover:bg-zinc-700 transition-colors font-sans"
            >
              <PlusIcon className="w-5 h-5" />
              New Portfolio
            </button>
          </div>
        </div>

        {/* Summary Cards — corp: bg-zinc-900, no glass */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="rounded-md p-4 border border-zinc-800 bg-zinc-900">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Total Portfolios</p>
            <p className="text-xl font-semibold font-mono tabular-nums text-zinc-100 mt-0.5">{portfolios.length}</p>
          </div>
          <div className="rounded-md p-4 border border-zinc-800 bg-zinc-900">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Total NAV</p>
            <p className="text-xl font-semibold font-mono tabular-nums text-zinc-100 mt-0.5">
              {formatCurrency(portfolios.reduce((sum, p) => sum + (p.nav || 0), 0), 'EUR')}
            </p>
          </div>
          <div className="rounded-md p-4 border border-zinc-800 bg-zinc-900">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Total Assets</p>
            <p className="text-xl font-semibold font-mono tabular-nums text-zinc-100 mt-0.5">
              {portfolios.reduce((sum, p) => sum + p.asset_count, 0)}
            </p>
          </div>
          <div className="rounded-md p-4 border border-zinc-800 bg-zinc-900">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Avg Yield</p>
            <p className="text-xl font-semibold font-mono tabular-nums text-green-400/80 mt-0.5">
            {formatPercent(
              portfolios.filter((p) => p.yield_pct).length > 0
                ? portfolios.reduce((sum, p) => sum + (p.yield_pct || 0), 0) /
                    portfolios.filter((p) => p.yield_pct).length
                : null
            )}
          </p>
        </div>
      </div>

        {/* Filters — corp: bg-zinc-900, section labels */}
        <div className="rounded-md p-4 border border-zinc-800 bg-zinc-900 mb-6 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search portfolios..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 font-sans"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Type:</span>
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs font-medium focus:outline-none focus:border-zinc-600 font-sans min-w-[150px]"
            >
              <option value="">All Types</option>
              {Object.entries(typeLabels).map(([value, label]) => (
                <option key={value} value={value} className="bg-zinc-900">
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="h-1 rounded-full bg-zinc-700 overflow-hidden mb-6">
            <div className="h-full w-1/3 bg-zinc-500 animate-pulse" />
          </div>
        )}

        {/* Portfolios Grid — corp: bg-zinc-900, no glass, rounded-md */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPortfolios.map((portfolio) => (
            <div
              key={portfolio.id}
              onClick={() => navigate(`/portfolios/${portfolio.id}`)}
              className="rounded-md p-5 border border-zinc-700 bg-zinc-900 hover:border-zinc-600 cursor-pointer transition-all"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="min-w-0">
                  <h3 className="font-display font-semibold text-zinc-100 truncate">{portfolio.name}</h3>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 mt-0.5">{portfolio.code}</p>
                </div>
                <span
                  className={`shrink-0 text-xs px-2 py-0.5 rounded-md font-mono ${
                    typeColors[portfolio.portfolio_type] || 'bg-zinc-700 text-zinc-300'
                  }`}
                >
                {typeLabels[portfolio.portfolio_type] || portfolio.portfolio_type}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="p-2 rounded-md bg-zinc-800 border border-zinc-700/60">
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">NAV</p>
                <p className="font-semibold font-mono tabular-nums text-zinc-100 text-sm mt-0.5">
                  {portfolio.asset_count === 0 ? '-' : formatCurrency(portfolio.nav, portfolio.base_currency)}
                </p>
              </div>
              <div className="p-2 rounded-md bg-zinc-800 border border-zinc-700/60">
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">FFO</p>
                <p className="font-semibold font-mono tabular-nums text-zinc-100 text-sm mt-0.5">
                  {portfolio.asset_count === 0 ? '-' : formatCurrency(portfolio.ffo, portfolio.base_currency)}
                </p>
              </div>
            </div>

            <div className="flex justify-between text-sm mb-3">
              <div className="text-center">
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Yield</p>
                <p className="font-semibold font-mono text-green-400/80 text-sm mt-0.5">{portfolio.asset_count === 0 ? '-' : formatPercent(portfolio.yield_pct)}</p>
              </div>
              <div className="text-center">
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">D/E</p>
                <p className="font-semibold font-mono text-zinc-100 text-sm mt-0.5">
                  {portfolio.asset_count === 0 ? '-' : (portfolio.debt_to_equity?.toFixed(2) || '-')}
                </p>
              </div>
              <div className="text-center">
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Occupancy</p>
                <p className="font-semibold font-mono text-zinc-100 text-sm mt-0.5">
                  {portfolio.asset_count === 0 ? '-' : (portfolio.occupancy ? `${(portfolio.occupancy * 100).toFixed(0)}%` : '-')}
                </p>
              </div>
              <div className="text-center">
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Assets</p>
                <p className="font-semibold font-mono tabular-nums text-zinc-100 text-sm mt-0.5">{portfolio.asset_count}</p>
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-zinc-800">
              <div className="flex items-center gap-1">
                <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Climate Risk:</span>
                <span className={`font-semibold font-mono text-sm ${getRiskColor(portfolio.climate_risk_score)}`}>
                  {portfolio.climate_risk_score?.toFixed(0) || '-'}
                </span>
              </div>
              {portfolio.ytd_return !== null && (
                <span
                  className={`text-xs px-2 py-0.5 rounded-md font-mono border ${
                    portfolio.ytd_return >= 0
                      ? 'border-green-500/30 text-green-400/80 bg-green-500/10'
                      : 'border-red-500/30 text-red-400/80 bg-red-500/10'
                  }`}
                >
                  <ArrowTrendingUpIcon className="w-3.5 h-3.5 inline -mr-0.5" />
                  YTD: {formatPercent(portfolio.ytd_return)}
                </span>
              )}
            </div>

            {portfolio.manager_name && (
              <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 mt-2">Manager: {portfolio.manager_name}</p>
            )}
            </div>
          ))}
        </div>

        {/* Empty State — corp */}
        {!loading && filteredPortfolios.length === 0 && (
          <div className="text-center py-16">
            <ChartBarIcon className="w-16 h-16 mx-auto text-zinc-600 mb-4" />
            <h3 className="text-lg font-display font-semibold text-zinc-200 mb-2">No portfolios found</h3>
            <p className="text-zinc-500/90 font-sans mb-4">Create your first portfolio or load sample data for demos</p>
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
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 font-medium hover:bg-zinc-700 transition-colors font-sans disabled:opacity-50"
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
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 font-medium hover:bg-zinc-700 transition-colors font-sans"
              >
                <PlusIcon className="w-5 h-5" />
                Create Portfolio
              </button>
            </div>
            {seedError && <p className="text-amber-400/80 text-sm mt-3 font-sans">{seedError}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
