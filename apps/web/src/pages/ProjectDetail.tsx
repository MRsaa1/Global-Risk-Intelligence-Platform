/**
 * Project Detail — Individual project with IRR/NPV, Gantt, and linked assets.
 * Unified Corporate Style: zinc palette, section labels font-mono text-[10px]
 * uppercase tracking-widest text-zinc-500, rounded-md only, no glass/blur. See Implementation Audit.
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
      <div className="min-h-full p-6 bg-zinc-950 pb-16">
        <div className="w-full max-w-[1920px] mx-auto">
          <div className="h-1 rounded-full bg-zinc-700 overflow-hidden mb-4">
            <div className="h-full w-1/3 bg-zinc-500 animate-pulse" />
          </div>
          <p className="text-zinc-500 font-sans">Loading project...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-full p-6 bg-zinc-950 pb-16">
        <div className="w-full max-w-[1920px] mx-auto">
          <p className="text-zinc-200 mb-4 font-sans">Project not found</p>
          <button
            onClick={() => navigate('/projects')}
            className="flex items-center gap-2 text-zinc-500 hover:text-zinc-300 font-sans"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            Back to Projects
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-full p-6 bg-zinc-950 pb-16">
      <div className="w-full max-w-[1920px] mx-auto">
        {/* Header — Unified Corporate Style */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-8">
          <div>
            <button
              onClick={() => navigate('/projects')}
              className="flex items-center gap-2 text-zinc-500 hover:text-zinc-100 mb-3 font-sans text-sm"
            >
              <ArrowLeftIcon className="w-5 h-5" />
              Back to Projects
            </button>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-zinc-800 rounded-md border border-zinc-700">
                <BanknotesIcon className="w-8 h-8 text-zinc-400" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-semibold text-zinc-100">
                  {project.name}
                </h1>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{project.code}</span>
                  <span className="text-xs px-2 py-0.5 rounded-md font-mono bg-zinc-700 text-zinc-300">
                    {project.status}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded-md font-mono border border-zinc-700 text-zinc-400">
                    {project.project_type}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchProjectData}
              className="p-2 rounded-md bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors"
              title="Refresh"
            >
              <ArrowPathIcon className="w-5 h-5" />
            </button>
            <button className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 hover:bg-zinc-700 font-sans">
              <DocumentArrowDownIcon className="w-5 h-5" />
              Export Report
            </button>
          </div>
        </div>

        {/* Key Metrics — corp: bg-zinc-900, no glass, section labels */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="rounded-md p-4 border border-zinc-800 bg-zinc-900 bg-green-500/5 border-green-500/20">
            <p className="font-mono text-[10px] uppercase tracking-widest text-green-400/80">IRR</p>
            <p className="text-2xl font-semibold font-mono tabular-nums text-zinc-100 mt-0.5">
              {formatPercent(irrResult?.irr || project.irr)}
            </p>
            <p className="text-zinc-500 text-xs mt-0.5 font-sans">Internal Rate of Return</p>
          </div>
          <div className="rounded-md p-4 border border-zinc-800 bg-zinc-900">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">NPV</p>
            <p className="text-xl font-semibold font-mono tabular-nums text-zinc-100 mt-0.5">
              {formatCurrency(irrResult?.npv || project.npv, project.currency)}
            </p>
            <p className="text-zinc-500 text-xs mt-0.5 font-sans">Net Present Value</p>
          </div>
          <div className="rounded-md p-4 border border-zinc-800 bg-zinc-900">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Payback</p>
            <p className="text-xl font-semibold font-mono tabular-nums text-zinc-100 mt-0.5">
              {irrResult?.payback_period_years?.toFixed(1) || '-'} yrs
            </p>
            <p className="text-zinc-500 text-xs mt-0.5 font-sans">Time to recover</p>
          </div>
          <div className="rounded-md p-4 border border-zinc-800 bg-zinc-900">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Total CAPEX</p>
            <p className="text-xl font-semibold font-mono tabular-nums text-zinc-100 mt-0.5">
              {formatCurrency(project.total_capex_planned, project.currency)}
            </p>
            <p className="text-zinc-500 text-xs mt-0.5 font-sans">
              Actual: {formatCurrency(project.total_capex_actual, project.currency)}
            </p>
          </div>
        </div>

        {/* Progress — corp */}
        {project.overall_completion_pct !== null && (
          <div className="rounded-md p-4 border border-zinc-800 bg-zinc-900 mb-6">
            <div className="flex justify-between mb-2">
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Overall Progress</span>
              <span className="font-semibold font-mono text-zinc-100">{project.overall_completion_pct.toFixed(0)}%</span>
            </div>
            <div className="h-3 rounded-full bg-zinc-700 overflow-hidden">
              <div
                className="h-full bg-zinc-500 rounded-full transition-all"
                style={{ width: `${project.overall_completion_pct}%` }}
              />
            </div>
          </div>
        )}

        {/* Tabs — corp: bg-zinc-900, no glass */}
        <div className="rounded-md border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="flex border-b border-zinc-800">
            {TABS.map((label, i) => (
              <button
                key={label}
                onClick={() => setTabValue(i)}
                className={`px-4 py-3 text-sm font-medium transition-colors font-sans ${
                  tabValue === i
                    ? 'text-zinc-100 border-b-2 border-zinc-500 bg-zinc-800'
                    : 'text-zinc-500 hover:text-zinc-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="p-6">
          {/* Tab 0: Financial — corp labels and selects */}
          {tabValue === 0 && (
            <div>
              <div className="flex flex-wrap items-center gap-4 mb-6">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Scenario:</span>
                  <select
                    value={scenario}
                    onChange={(e) => setScenario(e.target.value)}
                    className="px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm min-w-[180px] focus:outline-none focus:border-zinc-600 font-sans"
                  >
                    <option value="" className="bg-zinc-900">Base Case</option>
                    <option value="low_availability" className="bg-zinc-900">Low Availability (-15% revenue)</option>
                    <option value="high_cost" className="bg-zinc-900">High Cost (+25% OPEX)</option>
                    <option value="delayed_construction" className="bg-zinc-900">Delayed (+15% CAPEX)</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Discount:</span>
                  <select
                    value={discountRate}
                    onChange={(e) => setDiscountRate(Number(e.target.value))}
                    className="px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm min-w-[100px] focus:outline-none focus:border-zinc-600 font-sans"
                  >
                    <option value={0.06} className="bg-zinc-900">6%</option>
                    <option value={0.08} className="bg-zinc-900">8%</option>
                    <option value={0.1} className="bg-zinc-900">10%</option>
                    <option value={0.12} className="bg-zinc-900">12%</option>
                  </select>
                </div>
                <button
                  onClick={recalculateIRR}
                  className="px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 font-medium hover:bg-zinc-700 font-sans"
                >
                  Recalculate
                </button>
              </div>
              {irrResult && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="rounded-md border border-zinc-800 bg-zinc-800/50 p-4">
                    <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Cash Flow Summary</h3>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between py-2 border-b border-zinc-700">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Total CAPEX</span>
                        <span className="text-red-400/80 font-semibold font-mono">-{formatCurrency(irrResult.total_capex, project.currency)}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-zinc-700">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Annual Revenue</span>
                        <span className="text-green-400/80 font-mono">{formatCurrency(irrResult.annual_revenue, project.currency)}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-zinc-700">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Annual OPEX</span>
                        <span className="text-red-400/80 font-mono">-{formatCurrency(irrResult.annual_opex, project.currency)}</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-zinc-700 bg-zinc-800 px-2 -mx-2 rounded-md">
                        <span className="font-semibold text-zinc-100 font-sans">Annual Net Cashflow</span>
                        <span className="font-semibold text-green-400/80 font-mono">{formatCurrency(irrResult.annual_net_cashflow, project.currency)}</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Breakeven Year</span>
                        <span className="font-mono">{irrResult.breakeven_year ? `Year ${irrResult.breakeven_year}` : '-'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="rounded-md border border-zinc-800 bg-zinc-800/50 p-4">
                    <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">NPV Sensitivity</h3>
                    <div className="space-y-2 text-sm">
                      {Object.entries(irrResult.npv_sensitivity).map(([key, value]) => (
                        <div key={key} className="flex justify-between py-2 border-b border-zinc-700">
                          <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{key.replace('discount_', '')}</span>
                          <span className={`font-mono ${value >= 0 ? 'text-green-400/80' : 'text-red-400/80'}`}>
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

          {/* Tab 1: Schedule — corp */}
          {tabValue === 1 && (
            <div>
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-4">Project Phases</h3>
              {phases.length === 0 ? (
                <p className="text-zinc-500 font-sans">No phases defined</p>
              ) : (
                <div className="space-y-4">
                  {phases.map((phase) => (
                    <div key={phase.id} className="p-4 rounded-md bg-zinc-800 border border-zinc-700">
                      <div className="flex justify-between mb-2">
                        <div>
                          <p className="font-display font-semibold text-zinc-100">{phase.name}</p>
                          <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 mt-0.5">{phase.type}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-mono text-zinc-300">
                            {phase.start && phase.end ? `${phase.start} - ${phase.end}` : 'TBD'}
                          </p>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-md font-mono mt-1 inline-block ${
                              phase.progress >= 100 ? 'bg-green-500/20 text-green-300' : phase.progress > 0 ? 'bg-zinc-600 text-zinc-300' : 'bg-zinc-700 text-zinc-500'
                            }`}
                          >
                            {phase.progress}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-zinc-700 overflow-hidden">
                        <div
                          className="h-full bg-zinc-500 rounded-full"
                          style={{ width: `${phase.progress}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 2: Assets — corp */}
          {tabValue === 2 && (
            <div>
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-4">Linked Assets</h3>
              {assets.length === 0 ? (
                <p className="text-zinc-500 font-sans">No assets linked</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {assets.map((asset) => (
                    <div
                      key={asset.id}
                      onClick={() => navigate(`/assets/${asset.id}`)}
                      className="p-4 rounded-md border border-zinc-700 bg-zinc-800/50 hover:border-zinc-600 cursor-pointer transition-colors"
                    >
                      <div className="flex justify-between items-start mb-2">
                        <p className="font-display font-semibold text-zinc-100">{asset.name}</p>
                        {asset.is_primary && (
                          <span className="text-xs px-2 py-0.5 rounded-md font-mono bg-zinc-600 text-zinc-300">Primary</span>
                        )}
                      </div>
                      <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 mb-2">{asset.type}</p>
                      <div className="flex justify-between items-center pt-2 border-t border-zinc-700">
                        <span className="text-sm font-mono tabular-nums text-zinc-200">{formatCurrency(asset.valuation, project.currency)}</span>
                        <div className="flex gap-1">
                          {asset.has_bim && <span className="text-xs px-2 py-0.5 rounded-md font-mono bg-zinc-600 text-zinc-300">BIM</span>}
                          <MapPinIcon className="w-4 h-4 text-zinc-500" />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab 3: Sensitivity — corp */}
          {tabValue === 3 && irrResult && (
            <div>
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-4">IRR Sensitivity</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Object.entries(irrResult.irr_sensitivity).map(([key, value]) => {
                  const label = key.replace('_', ' ').replace(/\+/g, ' +').replace(/-/g, ' -')
                  const baseIrr = irrResult.irr
                  const diff = value - baseIrr
                  return (
                    <div key={key} className="p-4 rounded-md border border-zinc-700 bg-zinc-800/50 text-center">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 mb-1">{label}</p>
                      <p className={`text-lg font-semibold font-mono ${value >= baseIrr ? 'text-green-400/80' : 'text-red-400/80'}`}>
                        {formatPercent(value)}
                      </p>
                      <p className={`text-xs font-mono ${diff >= 0 ? 'text-green-400/80' : 'text-red-400/80'}`}>
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
    </div>
  )
}
