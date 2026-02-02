/**
 * Project Detail Page - Individual project with IRR/NPV, Gantt, and 3D assets
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  BanknotesIcon,
  MapPinIcon,
  DocumentArrowDownIcon,
} from '@heroicons/react/24/outline'
import { projectsApi } from '../lib/api'

interface Project {
  id: string
  name: string
  code: string
  description: string
  project_type: string
  status: string
  currency: string
  total_capex_planned: number
  total_capex_actual: number
  annual_opex_planned: number
  annual_revenue_projected: number
  irr: number | null
  npv: number | null
  payback_period_years: number | null
  overall_completion_pct: number | null
  country_code: string
  city: string | null
  sponsor_name: string | null
  start_date: string | null
  target_completion_date: string | null
}

interface IRRResult {
  project_id: string
  project_name: string
  currency: string
  irr: number
  npv: number
  payback_period_years: number
  total_capex: number
  annual_opex: number
  annual_revenue: number
  annual_net_cashflow: number
  discount_rate: number
  irr_sensitivity: Record<string, number>
  npv_sensitivity: Record<string, number>
  breakeven_year: number | null
}

interface Phase {
  id: string
  name: string
  type: string
  start: string | null
  end: string | null
  progress: number
}

interface ProjectAsset {
  id: string
  name: string
  type: string
  is_primary: boolean
  latitude: number
  longitude: number
  valuation: number
  has_bim: boolean
}

const TABS = ['Financial Analysis', 'Schedule (Gantt)', 'Linked Assets', 'Sensitivity']

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [irrResult, setIrrResult] = useState<IRRResult | null>(null)
  const [phases, setPhases] = useState<Phase[]>([])
  const [assets, setAssets] = useState<ProjectAsset[]>([])
  const [loading, setLoading] = useState(true)
  const [tabValue, setTabValue] = useState(0)
  const [scenario, setScenario] = useState<string>('')
  const [discountRate, setDiscountRate] = useState<number>(0.08)

  useEffect(() => {
    if (id) fetchProjectData()
  }, [id])

  const fetchProjectData = async () => {
    if (!id) return
    setLoading(true)
    try {
      const [projectData, irrData, scheduleData, assetsData] = await Promise.all([
        projectsApi.get(id),
        projectsApi.getIRR(id, discountRate, scenario || undefined),
        projectsApi.getSchedule(id),
        projectsApi.getAssets(id),
      ])
      setProject(projectData)
      setIrrResult(irrData)
      setPhases(scheduleData)
      setAssets(assetsData)
    } catch (error) {
      console.error('Failed to fetch project data:', error)
    } finally {
      setLoading(false)
    }
  }

  const recalculateIRR = async () => {
    if (!id) return
    try {
      const irrData = await projectsApi.getIRR(id, discountRate, scenario || undefined)
      setIrrResult(irrData)
    } catch (error) {
      console.error('Failed to recalculate IRR:', error)
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

  if (loading) {
    return (
      <div className="h-full overflow-auto p-8">
        <div className="h-1 rounded-full bg-white/10 overflow-hidden mb-4">
          <div className="h-full w-1/3 bg-primary-500 animate-pulse" />
        </div>
        <p className="text-dark-muted">Loading project...</p>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="h-full overflow-auto p-8">
        <p className="text-white/80 mb-4">Project not found</p>
        <button
          onClick={() => navigate('/projects')}
          className="flex items-center gap-2 text-primary-400 hover:text-primary-300"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          Back to Projects
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
            onClick={() => navigate('/projects')}
            className="flex items-center gap-2 text-dark-muted hover:text-white mb-2"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            Back to Projects
          </button>
          <h1 className="text-2xl font-display font-bold text-white flex items-center gap-2">
            <BanknotesIcon className="w-8 h-8 text-amber-400" />
            {project.name}
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <span className="text-dark-muted text-sm font-mono">{project.code}</span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-300">
              {project.status}
            </span>
            <span className="text-xs px-2 py-0.5 rounded border border-white/10 text-white/70">
              {project.project_type}
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchProjectData}
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/70"
            title="Refresh"
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
          <button className="flex items-center gap-2 px-4 py-2 rounded-xl border border-white/10 text-white/80 hover:bg-white/5">
            <DocumentArrowDownIcon className="w-5 h-5" />
            Export Report
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="glass rounded-2xl p-4 border border-white/5 bg-green-500/10 border-green-500/20">
          <p className="text-green-300/80 text-xs">IRR</p>
          <p className="text-2xl font-bold text-white">
            {formatPercent(irrResult?.irr || project.irr)}
          </p>
          <p className="text-green-300/60 text-xs">Internal Rate of Return</p>
        </div>
        <div className="glass rounded-2xl p-4 border border-white/5 bg-primary-500/10 border-primary-500/20">
          <p className="text-primary-300/80 text-xs">NPV</p>
          <p className="text-xl font-bold text-white">
            {formatCurrency(irrResult?.npv || project.npv, project.currency)}
          </p>
          <p className="text-primary-300/60 text-xs">Net Present Value</p>
        </div>
        <div className="glass rounded-2xl p-4 border border-white/5">
          <p className="text-dark-muted text-xs">Payback</p>
          <p className="text-xl font-bold text-white">
            {irrResult?.payback_period_years?.toFixed(1) || '-'} yrs
          </p>
          <p className="text-dark-muted text-xs">Time to recover</p>
        </div>
        <div className="glass rounded-2xl p-4 border border-white/5">
          <p className="text-dark-muted text-xs">Total CAPEX</p>
          <p className="text-xl font-bold text-white">
            {formatCurrency(project.total_capex_planned, project.currency)}
          </p>
          <p className="text-dark-muted text-xs">
            Actual: {formatCurrency(project.total_capex_actual, project.currency)}
          </p>
        </div>
      </div>

      {/* Progress */}
      {project.overall_completion_pct !== null && (
        <div className="glass rounded-2xl p-4 border border-white/5 mb-6">
          <div className="flex justify-between mb-2">
            <span className="font-semibold text-white">Overall Progress</span>
            <span className="font-semibold text-white">{project.overall_completion_pct.toFixed(0)}%</span>
          </div>
          <div className="h-3 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full bg-primary-500 rounded-full transition-all"
              style={{ width: `${project.overall_completion_pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="glass rounded-2xl border border-white/5 overflow-hidden">
        <div className="flex border-b border-white/10">
          {TABS.map((label, i) => (
            <button
              key={label}
              onClick={() => setTabValue(i)}
              className={`px-4 py-3 text-sm font-medium transition-colors ${
                tabValue === i
                  ? 'text-primary-400 border-b-2 border-primary-500 bg-white/5'
                  : 'text-dark-muted hover:text-white/80'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {/* Tab 0: Financial */}
          {tabValue === 0 && (
            <div>
              <div className="flex flex-wrap gap-3 mb-6">
                <select
                  value={scenario}
                  onChange={(e) => setScenario(e.target.value)}
                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white min-w-[180px] focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                >
                  <option value="" className="bg-dark-card">Base Case</option>
                  <option value="low_availability" className="bg-dark-card">Low Availability (-15% revenue)</option>
                  <option value="high_cost" className="bg-dark-card">High Cost (+25% OPEX)</option>
                  <option value="delayed_construction" className="bg-dark-card">Delayed (+15% CAPEX)</option>
                </select>
                <select
                  value={discountRate}
                  onChange={(e) => setDiscountRate(Number(e.target.value))}
                  className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white min-w-[140px] focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                >
                  <option value={0.06} className="bg-dark-card">6%</option>
                  <option value={0.08} className="bg-dark-card">8%</option>
                  <option value={0.1} className="bg-dark-card">10%</option>
                  <option value={0.12} className="bg-dark-card">12%</option>
                </select>
                <button
                  onClick={recalculateIRR}
                  className="px-4 py-2 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600"
                >
                  Recalculate
                </button>
              </div>
              {irrResult && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold text-white mb-3">Cash Flow Summary</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between py-2 border-b border-white/5">
                        <span className="text-dark-muted">Total CAPEX</span>
                        <span className="text-red-400 font-semibold">-{formatCurrency(irrResult.total_capex, project.currency)}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-white/5">
                        <span className="text-dark-muted">Annual Revenue</span>
                        <span className="text-green-400">{formatCurrency(irrResult.annual_revenue, project.currency)}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-white/5">
                        <span className="text-dark-muted">Annual OPEX</span>
                        <span className="text-red-400">-{formatCurrency(irrResult.annual_opex, project.currency)}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-white/5 bg-white/5 px-2 -mx-2 rounded">
                        <span className="font-semibold text-white">Annual Net Cashflow</span>
                        <span className="font-semibold text-green-400">{formatCurrency(irrResult.annual_net_cashflow, project.currency)}</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-dark-muted">Breakeven Year</span>
                        <span>{irrResult.breakeven_year ? `Year ${irrResult.breakeven_year}` : '-'}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white mb-3">NPV Sensitivity</h3>
                    <div className="space-y-2 text-sm">
                      {Object.entries(irrResult.npv_sensitivity).map(([key, value]) => (
                        <div key={key} className="flex justify-between py-2 border-b border-white/5">
                          <span className="text-dark-muted">{key.replace('discount_', '')}</span>
                          <span className={value >= 0 ? 'text-green-400' : 'text-red-400'}>
                            {formatCurrency(value, project.currency)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 1: Schedule */}
          {tabValue === 1 && (
            <div>
              <h3 className="font-semibold text-white mb-4">Project Phases</h3>
              {phases.length === 0 ? (
                <p className="text-dark-muted">No phases defined</p>
              ) : (
                <div className="space-y-4">
                  {phases.map((phase) => (
                    <div key={phase.id} className="p-4 rounded-xl bg-white/5 border border-white/5">
                      <div className="flex justify-between mb-2">
                        <div>
                          <p className="font-semibold text-white">{phase.name}</p>
                          <p className="text-dark-muted text-sm">{phase.type}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm text-white/80">
                            {phase.start && phase.end ? `${phase.start} - ${phase.end}` : 'TBD'}
                          </p>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              phase.progress >= 100 ? 'bg-green-500/20 text-green-300' : phase.progress > 0 ? 'bg-primary-500/20 text-primary-300' : 'bg-white/10 text-white/50'
                            }`}
                          >
                            {phase.progress}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full bg-primary-500 rounded-full"
                          style={{ width: `${phase.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Assets */}
          {tabValue === 2 && (
            <div>
              <h3 className="font-semibold text-white mb-4">Linked Assets</h3>
              {assets.length === 0 ? (
                <p className="text-dark-muted">No assets linked</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {assets.map((asset) => (
                    <div
                      key={asset.id}
                      onClick={() => navigate(`/assets/${asset.id}`)}
                      className="p-4 rounded-xl border border-white/10 hover:border-primary-500/30 cursor-pointer transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-semibold text-white">{asset.name}</p>
                        {asset.is_primary && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary-500/20 text-primary-300">Primary</span>
                        )}
                      </div>
                      <p className="text-dark-muted text-sm mb-2">{asset.type}</p>
                      <div className="flex justify-between items-center pt-2 border-t border-white/10">
                        <span className="text-sm">{formatCurrency(asset.valuation, project.currency)}</span>
                        <div className="flex gap-1">
                          {asset.has_bim && <span className="text-xs px-2 py-0.5 rounded bg-blue-500/20 text-blue-300">BIM</span>}
                          <MapPinIcon className="w-4 h-4 text-white/40" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Sensitivity */}
          {tabValue === 3 && irrResult && (
            <div>
              <h3 className="font-semibold text-white mb-4">IRR Sensitivity</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(irrResult.irr_sensitivity).map(([key, value]) => {
                  const label = key.replace('_', ' ').replace(/\+/g, ' +').replace(/-/g, ' -')
                  const baseIrr = irrResult.irr
                  const diff = value - baseIrr
                  return (
                    <div key={key} className="p-4 rounded-xl border border-white/10 text-center">
                      <p className="text-dark-muted text-xs mb-1">{label}</p>
                      <p className={`text-lg font-bold ${value >= baseIrr ? 'text-green-400' : 'text-red-400'}`}>
                        {formatPercent(value)}
                      </p>
                      <p className={`text-xs ${diff >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                        {diff >= 0 ? '+' : ''}
                        {(diff * 100).toFixed(2)}%
                      </p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
