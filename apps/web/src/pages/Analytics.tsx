/**
 * Analytics Page - Predictive ML, What-If Simulation, Cascade Analysis
 * 
 * Powered by:
 * - PhysicsNeMo for physics-informed ML
 * - PyG/NetworkX for graph analysis
 * - Monte Carlo simulation
 */
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import {
  ChartBarIcon,
  BeakerIcon,
  ShareIcon,
  SparklesIcon,
  CpuChipIcon,
  Square3Stack3DIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline'
import { Link } from 'react-router-dom'

import { PredictivePanel, WhatIfSimulator, CascadeVisualizer } from '../components/analytics'
import { analyticsApi, type HeadlineImpactResponse } from '../services/analyticsApi'
import SendToARINButton from '../components/SendToARINButton'
import ARINVerdictBadge from '../components/ARINVerdictBadge'

type TabType = 'predictive' | 'whatif' | 'cascade' | 'bayesian' | 'forecast'

// Scenario options for Cascade build-from-context, grouped by stress test type (aligned with cascade_gnn and stress/risk-zone)
const CASCADE_SCENARIO_GROUPS: { label: string; scenarios: { id: string; name: string }[] }[] = [
  {
    label: 'Physical & climate',
    scenarios: [
      { id: 'seismic_shock', name: 'Seismic Activity' },
      { id: 'flood_event', name: 'Flood Event' },
      { id: 'hurricane', name: 'Hurricane/Typhoon' },
      { id: 'wildfire', name: 'Wildfire' },
      { id: 'drought', name: 'Drought / Water Stress' },
      { id: 'climate_5yr', name: 'Climate Risk 5yr' },
      { id: 'climate_10yr', name: 'Climate Risk 10yr' },
      { id: 'climate_25yr', name: 'Climate Risk 25yr' },
      { id: 'sea_level_10yr', name: 'Sea Level Rise 10yr' },
      { id: 'sea_level_25yr', name: 'Sea Level Rise 25yr' },
      { id: 'extreme_temp', name: 'Extreme Temperature' },
      { id: 'landslide', name: 'Landslide / Slope Failure' },
    ],
  },
  {
    label: 'Financial & market',
    scenarios: [
      { id: 'credit_crunch', name: 'Credit Crunch' },
      { id: 'market_crash', name: 'Market Crash' },
      { id: 'liquidity_crisis', name: 'Liquidity Crisis' },
      { id: 'financial_stress_5yr', name: 'Basel Stress 5yr' },
      { id: 'sovereign_default', name: 'Sovereign Default' },
      { id: 'real_estate_collapse', name: 'Real Estate Correction' },
      { id: 'inflation_shock', name: 'Inflation Shock' },
    ],
  },
  {
    label: 'Geopolitical & conflict',
    scenarios: [
      { id: 'conflict_escalation', name: 'Conflict Escalation' },
      { id: 'sanctions_escalation', name: 'Sanctions Escalation' },
      { id: 'regional_conflict_spillover', name: 'Regional Conflict Spillover' },
      { id: 'trade_war_supply', name: 'Trade War / Supply' },
      { id: 'political_instability', name: 'Political Instability' },
      { id: 'terrorism', name: 'Terrorism / Security' },
    ],
  },
  {
    label: 'Operational & technology',
    scenarios: [
      { id: 'energy_shock', name: 'Energy Shock' },
      { id: 'supply_chain', name: 'Supply Chain Disruption' },
      { id: 'cyber_attack', name: 'Cyber Attack' },
      { id: 'tech_disruption_10yr', name: 'Tech Disruption 10yr' },
      { id: 'critical_infra_failure', name: 'Critical Infrastructure Failure' },
      { id: 'pandemic', name: 'Pandemic Outbreak' },
      { id: 'demographic_25yr', name: 'Demographic Shift 25yr' },
    ],
  },
]

const tabs: { id: TabType; name: string; icon: React.ElementType; description: string }[] = [
  { 
    id: 'predictive', 
    name: 'Predictive Analytics', 
    icon: ChartBarIcon,
    description: 'Early Warning & Risk Forecasting'
  },
  { 
    id: 'whatif', 
    name: 'What-If Simulator', 
    icon: BeakerIcon,
    description: 'Scenario Analysis & Monte Carlo'
  },
  { 
    id: 'cascade', 
    name: 'Cascade Analysis', 
    icon: ShareIcon,
    description: 'Graph Neural Network Propagation'
  },
  {
    id: 'bayesian',
    name: 'Bayesian Network',
    icon: SparklesIcon,
    description: 'Probabilistic Risk Inference'
  },
  {
    id: 'forecast',
    name: 'Scenario Forecast',
    icon: ChartBarIcon,
    description: 'Time-Series Risk Trends'
  },
]

export default function Analytics() {
  const [searchParams] = useSearchParams()
  const [activeTab, setActiveTab] = useState<TabType>('predictive')
  const [modelGovOpen, setModelGovOpen] = useState(false)
  const [predictiveContext, setPredictiveContext] = useState<'portfolio' | 'asset'>('portfolio')
  const [predictiveAssetId, setPredictiveAssetId] = useState('')
  const [cascadeCountryCode, setCascadeCountryCode] = useState('')
  const [cascadeCityId, setCascadeCityId] = useState('')
  const [cascadeScenarioId, setCascadeScenarioId] = useState('')

  // Bayesian
  const [bayesianResult, setBayesianResult] = useState<any>(null)
  const [bayesianLoading, setBayesianLoading] = useState(false)
  const [bayesianError, setBayesianError] = useState<string | null>(null)
  const [bayesianEvidence, setBayesianEvidence] = useState<Record<string, number>>({})

  const runBayesianAnalysis = useCallback(async () => {
    setBayesianLoading(true)
    setBayesianResult(null)
    setBayesianError(null)
    try {
      const res = await fetch('/api/v1/risk-engine/bayesian/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ evidence: bayesianEvidence }),
      })
      if (res.ok) {
        setBayesianResult(await res.json())
      } else {
        const text = await res.text()
        try {
          const j = JSON.parse(text)
          setBayesianError(j.detail || j.message || text || `Request failed (${res.status})`)
        } catch {
          setBayesianError(text || `Request failed (${res.status})`)
        }
      }
    } catch (e) {
      setBayesianError(e instanceof Error ? e.message : 'Network or request error')
    } finally {
      setBayesianLoading(false)
    }
  }, [bayesianEvidence])

  // Headline to PnL
  const [headlineInput, setHeadlineInput] = useState('')
  const [headlineResult, setHeadlineResult] = useState<HeadlineImpactResponse | null>(null)
  const [headlineLoading, setHeadlineLoading] = useState(false)
  const [headlineError, setHeadlineError] = useState<string | null>(null)
  const runHeadlineImpact = useCallback(async () => {
    if (!headlineInput.trim()) return
    setHeadlineLoading(true)
    setHeadlineResult(null)
    setHeadlineError(null)
    try {
      const res = await analyticsApi.postHeadlineImpact(headlineInput.trim())
      setHeadlineResult(res)
    } catch (e: any) {
      setHeadlineError(e?.message ?? e?.detail ?? 'Headline impact request failed.')
    } finally {
      setHeadlineLoading(false)
    }
  }, [headlineInput])

  // Forecast
  const [forecastResult, setForecastResult] = useState<any>(null)
  const [forecastLoading, setForecastLoading] = useState(false)
  const [forecastError, setForecastError] = useState<string | null>(null)
  const [forecastVariable, setForecastVariable] = useState('risk_score')
  const [forecastHorizon, setForecastHorizon] = useState(30)

  const runForecast = useCallback(async () => {
    setForecastLoading(true)
    setForecastResult(null)
    setForecastError(null)
    try {
      const res = await fetch(`/api/v1/risk-engine/forecast?variable=${forecastVariable}&horizon_days=${forecastHorizon}`)
      if (res.ok) {
        setForecastResult(await res.json())
      } else {
        const text = await res.text()
        try {
          const j = JSON.parse(text)
          setForecastError(j.detail || j.message || text || `Request failed (${res.status})`)
        } catch {
          setForecastError(text || `Request failed (${res.status})`)
        }
      }
    } catch (e) {
      setForecastError(e instanceof Error ? e.message : 'Network or request error')
    } finally {
      setForecastLoading(false)
    }
  }, [forecastVariable, forecastHorizon])

  const { data: portfolioSummary } = useQuery({
    queryKey: ['analytics-portfolio-summary'],
    queryFn: () => analyticsApi.getPortfolioSummary(),
    enabled: activeTab === 'predictive',
  })

  const { data: topRiskData } = useQuery({
    queryKey: ['analytics-top-risk-assets'],
    queryFn: async () => {
      const res = await fetch('/api/v1/analytics/top-risk-assets?limit=20')
      if (!res.ok) throw new Error('Failed to fetch')
      return res.json() as Promise<{ assets: Array<{ id: string; label: string; risk?: number }> }>
    },
    enabled: activeTab === 'predictive' && predictiveContext === 'asset',
  })
  const topRiskAssets = topRiskData?.assets ?? []

  // Initialize from URL when opening from Stress Test / Digital Twin "Open in Cascade"
  useEffect(() => {
    const tab = searchParams.get('tab')
    const city = searchParams.get('city')
    const scenario = searchParams.get('scenario')
    if (tab === 'cascade') setActiveTab('cascade')
    if (city) setCascadeCityId(city)
    if (scenario) setCascadeScenarioId(scenario)
  }, [searchParams])

  const { data: countriesData } = useQuery({
    queryKey: ['country-risk-countries'],
    queryFn: async () => {
      const res = await fetch('/api/v1/country-risk/')
      if (!res.ok) throw new Error('Failed to fetch countries')
      return res.json() as Promise<{ countries: Array<{ country_name: string; country_code: string; cities_count: number }> }>
    },
    enabled: activeTab === 'cascade',
  })
  const countries = countriesData?.countries ?? []

  const { data: cascadeCitiesData } = useQuery({
    queryKey: ['country-risk-cities', cascadeCountryCode],
    queryFn: async () => {
      const res = await fetch(`/api/v1/country-risk/${cascadeCountryCode}/cities`)
      if (!res.ok) throw new Error('Failed to fetch cities')
      return res.json() as Promise<{ cities: Array<{ id: string; name: string; country: string }> }>
    },
    enabled: activeTab === 'cascade' && !!cascadeCountryCode,
  })

  const { data: geodataCitiesData } = useQuery({
    queryKey: ['geodata-cities'],
    queryFn: async () => {
      const res = await fetch('/api/v1/geodata/cities')
      if (!res.ok) throw new Error('Failed to fetch cities')
      return res.json() as Promise<{ cities: Array<{ id: string; name: string; country: string }> }>
    },
    enabled: activeTab === 'cascade' && !cascadeCountryCode,
  })

  const cascadeCities = cascadeCountryCode
    ? (cascadeCitiesData?.cities ?? [])
    : (geodataCitiesData?.cities ?? [])
  
  return (
    <div className="min-h-full bg-zinc-950 p-8 pb-16">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-zinc-900/50 rounded-md border border-zinc-800/60">
            <CpuChipIcon className="w-7 h-7 text-zinc-400" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-semibold text-zinc-100 tracking-tight">
              Advanced Analytics
            </h1>
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-1 flex items-center gap-2">
              <CpuChipIcon className="w-3.5 h-3.5" />
              Powered by NVIDIA PhysicsNeMo & Graph Neural Networks
            </p>
          </div>
        </div>
      </motion.div>
      
      {/* Headline to PnL */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08 }}
        className="mb-6 p-4 rounded-md border border-zinc-800/60 bg-zinc-900/50"
      >
        <div className="flex items-center gap-2 mb-2">
          <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Headline to PnL</h3>
          <span className="text-[9px] px-1.5 py-0.5 bg-amber-500/15 text-amber-400/80 rounded-full border border-amber-500/25">
            AI-powered
          </span>
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <input
            type="text"
            placeholder="Paste a news headline..."
            value={headlineInput}
            onChange={(e) => setHeadlineInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && runHeadlineImpact()}
            className="flex-1 min-w-[200px] px-3 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-zinc-200 placeholder-zinc-500 text-sm font-sans focus:ring-1 focus:ring-amber-500/50"
          />
          <button
            type="button"
            onClick={runHeadlineImpact}
            disabled={headlineLoading || !headlineInput.trim()}
            className="px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-amber-300 text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {headlineLoading ? 'Analyzing…' : 'Analyze'}
          </button>
        </div>
        {headlineError && (
          <p className="mt-2 text-sm text-red-400/80" role="alert">{headlineError}</p>
        )}
        {headlineResult && (
          <div className="mt-3 pt-3 border-t border-zinc-800/60 text-sm space-y-3">
            {/* Direction + Volatility + Confidence */}
            <div className="flex flex-wrap gap-2 items-center">
              <span className={`px-2 py-0.5 rounded text-xs font-medium ${headlineResult.direction === 'negative' ? 'bg-red-500/20 text-red-300 border border-red-500/30' : headlineResult.direction === 'positive' ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-zinc-900/80 text-zinc-300 border border-zinc-800/60'}`}>
                {headlineResult.direction === 'negative' ? '↓' : headlineResult.direction === 'positive' ? '↑' : '→'} {headlineResult.direction}
              </span>
              <span className={`px-2 py-0.5 rounded text-xs ${headlineResult.volatility_estimate === 'high' ? 'bg-red-500/15 text-red-300' : headlineResult.volatility_estimate === 'medium' ? 'bg-amber-500/15 text-amber-300' : 'bg-zinc-900/80 text-zinc-400 border border-zinc-800/60'}`}>
                Vol: {headlineResult.volatility_estimate}
              </span>
              {headlineResult.confidence && (
                <span className="text-[10px] text-zinc-500">
                  Confidence: {headlineResult.confidence}
                </span>
              )}
              {headlineResult.portfolio_impact_pct != null && (
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${headlineResult.portfolio_impact_pct < 0 ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                  Portfolio: {headlineResult.portfolio_impact_pct > 0 ? '+' : ''}{headlineResult.portfolio_impact_pct.toFixed(2)}%
                </span>
              )}
            </div>

            {/* Sector impact table */}
            {headlineResult.sector_impacts && headlineResult.sector_impacts.length > 0 && (
              <div className="overflow-hidden rounded-md border border-zinc-800/60">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-zinc-900/80 border-b border-zinc-800/60">
                      <th className="text-left px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Sector</th>
                      <th className="text-center px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Direction</th>
                      <th className="text-right px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Impact (bps)</th>
                      <th className="text-right px-3 py-1.5 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Confidence</th>
                    </tr>
                  </thead>
                  <tbody>
                    {headlineResult.sector_impacts.map((si) => (
                      <tr key={si.name} className="border-t border-zinc-800/60">
                        <td className="px-3 py-1.5 text-zinc-300 font-medium">{si.name}</td>
                        <td className="px-3 py-1.5 text-center">
                          <span className={si.direction === 'negative' ? 'text-red-400/80' : si.direction === 'positive' ? 'text-emerald-400/80' : 'text-zinc-500'}>
                            {si.direction === 'negative' ? '↓' : si.direction === 'positive' ? '↑' : '→'}
                          </span>
                        </td>
                        <td className={`px-3 py-1.5 text-right font-mono ${si.impact_bps < 0 || si.direction === 'negative' ? 'text-red-400/80' : si.impact_bps > 0 ? 'text-emerald-400/80' : 'text-zinc-500'}`}>
                          {si.impact_bps > 0 ? '+' : ''}{si.impact_bps}
                        </td>
                        <td className="px-3 py-1.5 text-right text-zinc-500">{si.confidence}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* Fallback: simple sector badges if no sector_impacts */}
            {(!headlineResult.sector_impacts || headlineResult.sector_impacts.length === 0) && headlineResult.sectors?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                <span className="text-zinc-500 text-xs">Sectors:</span>
                {headlineResult.sectors.map((s) => (
                  <span key={s} className="px-2 py-0.5 rounded bg-zinc-900/80 border border-zinc-800/60 text-zinc-300 text-xs">{s}</span>
                ))}
              </div>
            )}

            {/* Market Context */}
            {headlineResult.market_context && (headlineResult.market_context.current_vix || headlineResult.market_context.spx) && (
              <div className="flex items-center gap-4 text-[11px] text-zinc-500">
                {headlineResult.market_context.current_vix != null && (
                  <span>VIX: <span className={headlineResult.market_context.current_vix > 25 ? 'text-red-400/80' : 'text-zinc-400'}>{headlineResult.market_context.current_vix.toFixed(1)}</span></span>
                )}
                {headlineResult.market_context.spx != null && (
                  <span>S&P 500: <span className="text-zinc-400">{headlineResult.market_context.spx.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span></span>
                )}
                {headlineResult.market_context.expected_vol_delta !== 'unchanged' && (
                  <span>Vol trend: <span className={headlineResult.market_context.expected_vol_delta === 'up' ? 'text-red-400/80' : 'text-emerald-400/80'}>{headlineResult.market_context.expected_vol_delta}</span></span>
                )}
              </div>
            )}

            {/* Historical Parallel */}
            {headlineResult.historical_parallel && headlineResult.historical_parallel.event && (
              <div className="p-2.5 rounded-md bg-zinc-900/80 border border-zinc-800/60">
                <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Historical Parallel</div>
                <div className="text-xs text-zinc-300 font-medium">
                  {headlineResult.historical_parallel.event}
                  {headlineResult.historical_parallel.date && (
                    <span className="text-zinc-500 font-normal"> ({headlineResult.historical_parallel.date})</span>
                  )}
                </div>
                {headlineResult.historical_parallel.actual_impact && (
                  <p className="text-[11px] text-zinc-400 mt-0.5">{headlineResult.historical_parallel.actual_impact}</p>
                )}
              </div>
            )}

            {/* Summary */}
            {headlineResult.summary && <p className="text-zinc-400 text-xs leading-relaxed">{headlineResult.summary}</p>}
          </div>
        )}
      </motion.div>

      {/* Tech Stack Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6 p-3 bg-zinc-900/50 rounded-md border border-zinc-800/60"
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-zinc-500/60 rounded-full" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">PhysicsNeMo</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-zinc-500/60 rounded-full" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Neural Operators</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-zinc-500/60 rounded-full" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">GNN/PyG</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-zinc-500/60 rounded-full" />
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Monte Carlo</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 font-mono text-[10px] text-zinc-500">
            <span>10,000x faster than traditional solvers</span>
          </div>
        </div>
      </motion.div>

      {/* Model governance / Validation (Gap X3) */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mb-6 rounded-md border border-zinc-800/60 bg-zinc-900/50 overflow-hidden"
      >
        <button
          type="button"
          onClick={() => setModelGovOpen((o) => !o)}
          className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-zinc-800/50 transition-colors"
        >
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Model governance / Validation</span>
          {modelGovOpen ? (
            <ChevronDownIcon className="w-4 h-4 text-zinc-500" />
          ) : (
            <ChevronRightIcon className="w-4 h-4 text-zinc-500" />
          )}
        </button>
        {modelGovOpen && (
          <div className="px-4 pb-4 pt-0 border-t border-zinc-800/60 space-y-2">
            <p className="text-xs text-zinc-500"><span className="text-zinc-400">Last validation date:</span> To be updated</p>
            <p className="text-xs text-zinc-500"><span className="text-zinc-400">Validation owner:</span> Model Validation Committee</p>
            <p className="text-xs text-zinc-500">
              Results are subject to model assumptions and data as of the calculation date. Model validation is conducted periodically. Backtesting and known limitations are documented in the methodology.
            </p>
          </div>
        )}
      </motion.div>
      
      {/* Tab Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex gap-2 mb-6"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 p-4 rounded-md border transition-all ${
              activeTab === tab.id
                ? 'bg-zinc-900/80 border-zinc-800/60 shadow-lg shadow-zinc-500/10'
                : 'bg-zinc-900/50 border-zinc-800/60 hover:bg-zinc-800/80'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-md border ${
                activeTab === tab.id ? 'bg-zinc-900/80 border-zinc-800/60' : 'bg-zinc-900/80 border-zinc-800/60'
              }`}>
                <tab.icon className={`w-5 h-5 ${
                  activeTab === tab.id ? 'text-zinc-400' : 'text-zinc-500'
                }`} />
              </div>
              <div className="text-left">
                <div className={`font-medium ${
                  activeTab === tab.id ? 'text-zinc-100' : 'text-zinc-400'
                }`}>
                  {tab.name}
                </div>
                <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{tab.description}</div>
              </div>
            </div>
          </button>
        ))}
      </motion.div>
      
      {/* Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeTab === 'predictive' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4 p-4 bg-zinc-900/50 rounded-md border border-zinc-800/60">
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Context:</span>
              {portfolioSummary && (
                <SendToARINButton
                  sourceModule="analytics"
                  objectType="portfolio"
                  objectId="portfolio_global"
                  inputData={{
                    total_assets: portfolioSummary.total_assets,
                    weighted_risk: portfolioSummary.weighted_risk,
                    critical_count: portfolioSummary.critical_count,
                  }}
                  exportEntityId="portfolio_global"
                  exportEntityType="portfolio"
                  exportAnalysisType="global_risk_assessment"
                  exportData={{
                    risk_score: (portfolioSummary.weighted_risk ?? 0) * 100,
                    risk_level: (portfolioSummary.weighted_risk ?? 0) >= 0.6 ? 'HIGH' : (portfolioSummary.weighted_risk ?? 0) >= 0.4 ? 'MEDIUM' : 'LOW',
                    summary: `Portfolio: ${portfolioSummary.total_assets ?? 0} assets, critical: ${portfolioSummary.critical_count ?? 0}, high: ${portfolioSummary.high_count ?? 0}.`,
                    recommendations: ['Review sector exposure', 'Consider hedging for high-risk assets'],
                    indicators: {
                      avg_climate_risk: portfolioSummary.avg_climate_risk,
                      avg_physical_risk: portfolioSummary.avg_physical_risk,
                      avg_network_risk: portfolioSummary.avg_network_risk,
                    },
                  }}
                  size="sm"
                />
              )}
              <ARINVerdictBadge entityId="portfolio_global" compact />
              <select
                value={predictiveContext}
                onChange={(e) => setPredictiveContext(e.target.value as 'portfolio' | 'asset')}
                className="px-3 py-2 bg-zinc-900/80 border border-zinc-800/60 rounded-md text-sm text-zinc-100 font-sans min-w-[180px]"
              >
                <option value="portfolio">Portfolio (aggregate)</option>
                <option value="asset">Specific asset</option>
              </select>
              {predictiveContext === 'asset' && (
                <select
                  value={predictiveAssetId}
                  onChange={(e) => setPredictiveAssetId(e.target.value)}
                  className="px-3 py-2 bg-zinc-900/80 border border-zinc-800/60 rounded-md text-sm text-zinc-100 font-sans min-w-[200px]"
                >
                  {(topRiskAssets ?? []).length === 0 ? (
                    <option value="">No assets — load assets to see top risk</option>
                  ) : (
                    <>
                      <option value="">Select asset...</option>
                      {topRiskAssets.slice(0, 20).map((a, i) => (
                        <option key={a.id || `asset-${i}`} value={a.id}>
                          {a.label ?? a.id} — {(a.risk ?? 0) * 100}%
                        </option>
                      ))}
                    </>
                  )}
                </select>
              )}
            </div>
            <PredictivePanel
              context={predictiveContext}
              assetId={predictiveContext === 'asset' ? predictiveAssetId : undefined}
            />
          </div>
        )}
        
        {activeTab === 'whatif' && (
          <WhatIfSimulator baseExposure={100_000_000} />
        )}
        
        {activeTab === 'cascade' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4 p-4 bg-zinc-900/50 rounded-md border border-zinc-800/60">
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Build graph from location & stress test:</span>
              <div className="flex flex-wrap items-center gap-3">
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Country</label>
                  <select
                    value={cascadeCountryCode}
                    onChange={(e) => {
                      setCascadeCountryCode(e.target.value)
                      setCascadeCityId('')
                    }}
                    className="px-3 py-2 bg-zinc-900/80 border border-zinc-800/60 rounded-md text-sm text-zinc-100 font-sans min-w-[160px]"
                  >
                    <option value="">Select country...</option>
                    {countries.map((c, i) => (
                      <option key={c.country_code || `country-${i}`} value={c.country_code}>
                        {c.country_name} ({c.cities_count})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">City</label>
                  <select
                    value={cascadeCityId}
                    onChange={(e) => setCascadeCityId(e.target.value)}
                    className="px-3 py-2 bg-zinc-900/80 border border-zinc-800/60 rounded-md text-sm text-zinc-100 font-sans min-w-[180px]"
                  >
                    <option value="">Select city...</option>
                    {cascadeCities.map((c, i) => (
                      <option key={c.id || `city-${i}`} value={c.id}>{c.name}{!cascadeCountryCode ? ` (${c.country})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 block mb-1">Stress test type</label>
                  <select
                    value={cascadeScenarioId}
                    onChange={(e) => setCascadeScenarioId(e.target.value)}
                    className="px-3 py-2 bg-zinc-900/80 border border-zinc-800/60 rounded-md text-sm text-zinc-100 font-sans min-w-[240px]"
                  >
                    <option value="">Select stress test...</option>
                    {CASCADE_SCENARIO_GROUPS.map((group) => (
                      <optgroup key={group.label} label={group.label}>
                        {group.scenarios.map((s, j) => (
                          <option key={s.id || `${group.label}-${j}`} value={s.id}>{s.name}</option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </div>
              </div>
              {(cascadeCityId && cascadeScenarioId) && (
                <span className="text-xs text-zinc-400">Graph will use city infrastructure & scenario template</span>
              )}
            </div>
            <CascadeVisualizer
              cityId={cascadeCityId || undefined}
              scenarioId={cascadeScenarioId || undefined}
            />
          </div>
        )}

        {activeTab === 'bayesian' && (
          <div className="space-y-4">
            <div className="p-5 bg-zinc-900/50 rounded-md border border-zinc-800/60">
              <h2 className="text-lg font-display font-semibold text-zinc-100 tracking-tight mb-2">Bayesian Risk Network</h2>
              <p className="text-sm text-zinc-500 mb-4">
                Probabilistic inference over cross-domain risk factors. Set evidence (observed states) and run analysis
                to get posterior probabilities, critical factors, and scenario assessments.
              </p>

              {/* Evidence inputs */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                {[
                  { key: 'climate_severity', label: 'Climate Severity' },
                  { key: 'geopolitical_tension', label: 'Geopolitical Tension' },
                  { key: 'market_volatility', label: 'Market Volatility' },
                  { key: 'cyber_threat_level', label: 'Cyber Threat Level' },
                ].map(({ key, label }) => (
                  <div key={key}>
                    <label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1 block">{label}</label>
                    <select
                      value={bayesianEvidence[key] ?? ''}
                      onChange={(e) => {
                        const val = e.target.value
                        setBayesianEvidence(prev => {
                          const next = { ...prev }
                          if (val === '') {
                            delete next[key]
                          } else {
                            next[key] = parseInt(val)
                          }
                          return next
                        })
                      }}
                      className="w-full px-3 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-zinc-100 text-sm font-sans"
                    >
                      <option value="">Unobserved</option>
                      <option value="0">Low (0)</option>
                      <option value="1">Moderate (1)</option>
                      <option value="2">High (2)</option>
                      <option value="3">Critical (3)</option>
                    </select>
                  </div>
                ))}
              </div>

              <button
                onClick={runBayesianAnalysis}
                disabled={bayesianLoading}
                className="px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-purple-300 text-sm hover:bg-zinc-700 disabled:opacity-50"
              >
                {bayesianLoading ? 'Analyzing...' : 'Run Bayesian Analysis'}
              </button>
              {bayesianError && (
                <p className="mt-3 text-sm text-red-400/80" role="alert">{bayesianError}</p>
              )}
            </div>

            {bayesianResult && (
              <div className="space-y-4">
                {/* Overall Risk */}
                {bayesianResult.overall_risk != null && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-4 rounded-md bg-zinc-900/50 border border-zinc-800/60">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Overall Risk</div>
                      <div className={`text-2xl font-bold ${
                        bayesianResult.overall_risk > 0.7 ? 'text-red-400/80' :
                        bayesianResult.overall_risk > 0.4 ? 'text-amber-400/80' : 'text-emerald-400/80'
                      }`}>
                        {(bayesianResult.overall_risk * 100).toFixed(1)}%
                      </div>
                    </div>
                    <div className="p-4 rounded-md bg-zinc-900/50 border border-zinc-800/60">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Risk Level</div>
                      <div className="text-2xl font-bold font-mono tabular-nums text-zinc-100">{bayesianResult.risk_level || '—'}</div>
                    </div>
                    <div className="p-4 rounded-md bg-zinc-900/50 border border-zinc-800/60">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Nodes</div>
                      <div className="text-2xl font-bold font-mono tabular-nums text-zinc-100">{bayesianResult.network_size?.nodes ?? '—'}</div>
                    </div>
                    <div className="p-4 rounded-md bg-zinc-900/50 border border-zinc-800/60">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Edges</div>
                      <div className="text-2xl font-bold font-mono tabular-nums text-zinc-100">{bayesianResult.network_size?.edges ?? '—'}</div>
                    </div>
                  </div>
                )}

                {/* Critical Factors — backend sends risk_score 0–100 */}
                {(bayesianResult.critical_factors || []).length > 0 && (
                  <div className="p-4 rounded-md bg-zinc-900/50 border border-zinc-800/60">
                    <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Critical Factors</h3>
                    <div className="space-y-2">
                      {bayesianResult.critical_factors.map((f: any, i: number) => {
                        const pct = f.risk_score != null ? Number(f.risk_score) : (f.severity ?? f.probability ?? 0) * 100
                        return (
                          <div key={i} className="flex items-center gap-3">
                            <span className="text-sm font-medium text-zinc-200 w-48 truncate" title={f.description}>{f.factor || f.node}</span>
                            <div className="flex-1 bg-zinc-800 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${
                                  pct >= 60 ? 'bg-red-500' : pct >= 35 ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}
                                style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
                              />
                            </div>
                            <span className="text-xs text-zinc-400 w-12 text-right">
                              {pct.toFixed(0)}%
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Scenario Probabilities — backend sends object { scenario_name: probability } */}
                {bayesianResult.scenario_probabilities && typeof bayesianResult.scenario_probabilities === 'object' && Object.keys(bayesianResult.scenario_probabilities).length > 0 && (
                  <div className="p-4 rounded-md bg-zinc-900/50 border border-zinc-800/60">
                    <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Scenario Probabilities</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Object.entries(bayesianResult.scenario_probabilities).map(([scenario, probability]: [string, any]) => {
                        const p = typeof probability === 'number' ? probability : 0
                        const label = scenario.replace(/_/g, ' ')
                        return (
                          <div key={scenario} className="p-3 bg-zinc-900/80 rounded-md border border-zinc-800/60">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm text-zinc-200 capitalize">{label}</span>
                              <span className={`text-sm font-bold ${
                                p > 0.5 ? 'text-red-400/80' : p > 0.25 ? 'text-amber-400/80' : 'text-zinc-400'
                              }`}>
                                {(p * 100).toFixed(1)}%
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Raw posteriors */}
                {bayesianResult.posteriors && (
                  <div className="p-4 rounded-md bg-zinc-900/50 border border-zinc-800/60">
                    <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Posterior Distributions</h3>
                    <pre className="text-xs text-zinc-500 overflow-x-auto max-h-60">
                      {JSON.stringify(bayesianResult.posteriors, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'forecast' && (
          <div className="space-y-4">
            <div className="p-5 bg-zinc-900/50 rounded-md border border-zinc-800/60">
              <h2 className="text-lg font-display font-semibold text-zinc-100 tracking-tight mb-2">Time-Series Risk Forecast</h2>
              <p className="text-sm text-zinc-500 mb-4">
                Predict future risk trends using exponential smoothing and linear trend models.
                Based on historical risk posture snapshots from the database.
              </p>

              <div className="flex flex-wrap items-end gap-4 mb-4">
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1 block">Variable</label>
                  <select
                    value={forecastVariable}
                    onChange={e => setForecastVariable(e.target.value)}
                    className="px-3 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-zinc-100 text-sm font-sans"
                  >
                    <option value="risk_score">Risk Score</option>
                    <option value="at_risk_exposure">At-Risk Exposure</option>
                    <option value="total_exposure">Total Exposure</option>
                    <option value="weighted_risk">Weighted Risk</option>
                  </select>
                </div>
                <div>
                  <label className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1 block">Horizon (days)</label>
                  <select
                    value={forecastHorizon}
                    onChange={e => setForecastHorizon(parseInt(e.target.value))}
                    className="px-3 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-zinc-100 text-sm font-sans"
                  >
                    <option value={7}>7 days</option>
                    <option value={14}>14 days</option>
                    <option value={30}>30 days</option>
                    <option value={60}>60 days</option>
                    <option value={90}>90 days</option>
                  </select>
                </div>
                <button
                  onClick={runForecast}
                  disabled={forecastLoading}
                  className="px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-cyan-300 text-sm hover:bg-zinc-700 disabled:opacity-50"
                >
                  {forecastLoading ? 'Forecasting...' : 'Run Forecast'}
                </button>
              </div>
              {forecastError && (
                <p className="mt-3 text-sm text-red-400/80" role="alert">{forecastError}</p>
              )}
            </div>

            {forecastResult && (
              <div className="space-y-4">
                {/* Trend Summary */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="p-4 rounded-md bg-zinc-900/50 border border-zinc-800/60">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Trend Direction</div>
                    <div className={`text-lg font-bold ${
                      (forecastResult.trend?.direction === 'increasing' || forecastResult.trend?.direction === 'up') ? 'text-red-400/80' :
                      (forecastResult.trend?.direction === 'decreasing' || forecastResult.trend?.direction === 'down') ? 'text-emerald-400/80' : 'text-zinc-300'
                    }`}>
                      {(forecastResult.trend?.direction === 'increasing' || forecastResult.trend?.direction === 'up') ? '↑ Rising' :
                       (forecastResult.trend?.direction === 'decreasing' || forecastResult.trend?.direction === 'down') ? '↓ Falling' : '→ Stable'}
                    </div>
                  </div>
                  <div className="p-4 rounded-md bg-zinc-900/50 border border-zinc-800/60">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Slope</div>
                    <div className="text-lg font-bold font-mono tabular-nums text-zinc-100">{(forecastResult.trend?.slope ?? 0).toFixed(4)}</div>
                  </div>
                  <div className="p-4 rounded-md bg-zinc-900/50 border border-zinc-800/60">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">R²</div>
                    <div className="text-lg font-bold font-mono tabular-nums text-zinc-100">{(forecastResult.trend?.r_squared ?? 0).toFixed(3)}</div>
                  </div>
                  <div className="p-4 rounded-md bg-zinc-900/50 border border-zinc-800/60">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">MoM Velocity</div>
                    <div className={`text-lg font-bold ${
                      (forecastResult.risk_velocity_mom ?? forecastResult.velocity?.mom_pct ?? 0) > 0 ? 'text-red-400/80' :
                      (forecastResult.risk_velocity_mom ?? forecastResult.velocity?.mom_pct ?? 0) < 0 ? 'text-emerald-400/80' : 'text-zinc-300'
                    }`}>
                      {(() => {
                        const mom = forecastResult.risk_velocity_mom ?? forecastResult.velocity?.mom_pct
                        return mom != null ? `${mom > 0 ? '+' : ''}${mom.toFixed(1)}%` : '—'
                      })()}
                    </div>
                  </div>
                </div>

                {/* Forecast data points */}
                {(forecastResult.forecast || []).length === 0 && (
                  <p className="text-sm text-zinc-500">No forecast data.</p>
                )}
                {(forecastResult.forecast || []).length > 0 && (
                  <div className="p-4 rounded-md bg-zinc-900/50 border border-zinc-800/60">
                    <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Forecast Points</h3>
                    <div className="h-48 flex items-end gap-px">
                      {forecastResult.forecast.map((point: any, i: number) => {
                        const allValues = forecastResult.forecast.map((p: any) => p.value ?? p.predicted ?? 0)
                        const maxVal = Math.max(...allValues, 1)
                        const val = point.value ?? point.predicted ?? 0
                        return (
                          <div
                            key={i}
                            className="flex-1 rounded-t bg-cyan-500/60"
                            style={{ height: `${Math.max(2, (val / maxVal) * 100)}%` }}
                            title={`${point.date || `Day ${i + 1}`}: ${val.toFixed(3)}`}
                          />
                        )
                      })}
                    </div>
                    <div className="flex justify-between text-xs text-zinc-600 mt-1">
                      <span>{forecastResult.forecast[0]?.date || 'Start'}</span>
                      <span>{forecastResult.forecast[forecastResult.forecast.length - 1]?.date || 'End'}</span>
                    </div>
                  </div>
                )}

                {/* Confidence interval info */}
                {forecastResult.confidence_interval && (
                  <div className="p-4 rounded-md bg-zinc-900/50 border border-zinc-800/60">
                    <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Confidence Interval (95%)</h3>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <span className="text-zinc-500">Lower bound:</span>{' '}
                        <span className="text-zinc-200">{(forecastResult.confidence_interval.lower ?? 0).toFixed(4)}</span>
                      </div>
                      <div>
                        <span className="text-zinc-500">Upper bound:</span>{' '}
                        <span className="text-zinc-200">{(forecastResult.confidence_interval.upper ?? 0).toFixed(4)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Change points */}
                {((forecastResult.trend?.change_points ?? forecastResult.change_points) || []).length > 0 && (
                  <div className="p-4 rounded-md bg-zinc-900/50 border border-zinc-800/60">
                    <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Change Points Detected</h3>
                    <div className="flex flex-wrap gap-2">
                      {(forecastResult.trend?.change_points ?? forecastResult.change_points ?? []).map((cp: any, i: number) => (
                        <span key={i} className="px-2 py-1 rounded text-xs bg-amber-500/20 text-amber-400/80 border border-amber-500/30">
                          {cp.date || `Index ${cp.index}`} — {cp.direction || 'shift'}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </motion.div>
      
      {/* Strategic Modules Integration */}
      {activeTab === 'cascade' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6 p-4 bg-zinc-900/50 rounded-md border border-zinc-800/60"
        >
          <div className="flex items-start gap-4">
            <div className="p-2 bg-zinc-900/80 rounded-md border border-zinc-800/60">
              <Square3Stack3DIcon className="w-5 h-5 text-zinc-300" />
            </div>
            <div className="flex-1">
              <h3 className="font-display font-semibold text-zinc-100 tracking-tight mb-1">Systemic Risk Observatory (SRO)</h3>
              <p className="text-sm text-zinc-400 mb-3">
                For advanced systemic risk analysis integrating financial, physical, and cyber risks, 
                explore the SRO Strategic Module. It extends cascade analysis with systemic risk 
                indicators, early warning systems, and contagion modeling.
              </p>
              <Link
                to="/modules/sro"
                className="inline-flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-800/60 hover:bg-zinc-700 text-zinc-300 rounded-md text-sm transition-colors"
              >
                <Square3Stack3DIcon className="w-4 h-4" />
                Open SRO Module
              </Link>
            </div>
          </div>
        </motion.div>
      )}

      {/* Info Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 p-4 bg-zinc-900/50 rounded-md border border-zinc-800/60"
      >
        <div className="flex items-start gap-4">
          <div className="p-2 bg-zinc-900/80 rounded-md border border-zinc-800/60">
            <SparklesIcon className="w-5 h-5 text-zinc-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-display font-semibold text-zinc-100 tracking-tight mb-1">About NVIDIA PhysicsNeMo</h3>
            <p className="text-sm text-zinc-400">
              PhysicsNeMo is an open-source framework for physics-informed machine learning. 
              It combines neural operators (FNO, DeepONet) with physics constraints to create 
              surrogate models that are 10,000x faster than traditional CFD/FEM solvers while 
              maintaining scientific accuracy. Used for digital twins at Siemens Energy, 
              Wistron, and Earth-2 climate modeling.
            </p>
            <div className="flex gap-4 mt-3 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
              <a 
                href="https://developer.nvidia.com/physicsnemo" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-zinc-400 hover:text-zinc-300"
              >
                Learn More →
              </a>
              <a 
                href="https://github.com/NVIDIA/physicsnemo" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-zinc-400 hover:text-zinc-300"
              >
                GitHub →
              </a>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
