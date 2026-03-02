/**
 * Project Finance — Infrastructure and development projects with IRR/NPV analysis.
 * Unified Corporate Style: zinc palette, section labels font-mono text-[10px]
 * uppercase tracking-widest text-zinc-500, rounded-md only, no glass/blur. See Implementation Audit.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PlusIcon,
  ArrowPathIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline'
import { projectsApi, seedApi } from '../lib/api'

interface Project {
  id: string
  name: string
  code: string
  project_type: string
  status: string
  currency: string
  total_capex_planned: number
  irr: number | null
  npv: number | null
  overall_completion_pct: number | null
  country_code: string
  city: string | null
  sponsor_name: string | null
  created_at: string
}

const statusColors: Record<string, string> = {
  development: 'bg-zinc-700 text-zinc-300',
  planning: 'bg-zinc-700 text-zinc-300',
  financing: 'bg-zinc-700 text-zinc-300',
  construction: 'bg-zinc-700 text-zinc-300',
  commissioning: 'bg-zinc-700 text-zinc-300',
  operation: 'bg-green-500/20 text-green-300',
  decommissioned: 'bg-red-500/20 text-red-300',
}

const typeLabels: Record<string, string> = {
  road: 'Road',
  rail: 'Rail',
  renewable: 'Renewable Energy',
  industrial: 'Industrial',
  commercial: 'Commercial',
  residential: 'Residential',
  mixed_use: 'Mixed Use',
  port: 'Port',
  airport: 'Airport',
  utility: 'Utility',
  other: 'Other',
}

export default function Projects() {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [typeFilter, setTypeFilter] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [seedLoading, setSeedLoading] = useState(false)
  const [seedError, setSeedError] = useState<string | null>(null)

  useEffect(() => {
    fetchProjects()
  }, [typeFilter, statusFilter])

  const fetchProjects = async () => {
    setLoading(true)
    try {
      const data = await projectsApi.list({
        project_type: typeFilter || undefined,
        status: statusFilter || undefined,
      })
      setProjects(data)
    } catch (error) {
      console.error('Failed to fetch projects:', error)
      setProjects([])
    } finally {
      setLoading(false)
    }
  }

  const filteredProjects = projects.filter(
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
    return `${(value * 100).toFixed(1)}%`
  }

  return (
    <div className="min-h-full p-6 bg-zinc-950 pb-16">
      <div className="w-full max-w-[1920px] mx-auto">
        {/* Header — Unified Corporate Style */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-zinc-800 rounded-md border border-zinc-700">
              <BanknotesIcon className="w-8 h-8 text-zinc-400" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-semibold text-zinc-100">
                Project Finance
              </h1>
              <p className="text-zinc-500 text-sm mt-1 font-sans">
                Infrastructure and development projects with IRR/NPV analysis
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchProjects}
              className="p-2 rounded-md bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors"
              title="Refresh"
            >
              <ArrowPathIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/projects/new')}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 font-medium hover:bg-zinc-700 transition-colors font-sans"
            >
              <PlusIcon className="w-5 h-5" />
              New Project
            </button>
          </div>
        </div>

        {/* Filters — corp: bg-zinc-900, section labels */}
        <div className="rounded-md p-4 border border-zinc-800 bg-zinc-900 mb-6 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search projects..."
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
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs font-medium focus:outline-none focus:border-zinc-600 font-sans min-w-[150px]"
            >
              <option value="">All Statuses</option>
              <option value="development" className="bg-zinc-900">Development</option>
              <option value="planning" className="bg-zinc-900">Planning</option>
              <option value="financing" className="bg-zinc-900">Financing</option>
              <option value="construction" className="bg-zinc-900">Construction</option>
              <option value="commissioning" className="bg-zinc-900">Commissioning</option>
              <option value="operation" className="bg-zinc-900">Operation</option>
            </select>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="h-1 rounded-full bg-zinc-700 overflow-hidden mb-6">
            <div className="h-full w-1/3 bg-zinc-500 animate-pulse" />
          </div>
        )}

        {/* Projects Grid — corp: bg-zinc-900, no glass, rounded-md */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProjects.map((project) => (
            <div
              key={project.id}
              onClick={() => navigate(`/projects/${project.id}`)}
              className="rounded-md p-5 border border-zinc-700 bg-zinc-900 hover:border-zinc-600 cursor-pointer transition-all"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="min-w-0">
                  <h3 className="font-display font-semibold text-zinc-100 truncate">{project.name}</h3>
                  <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 mt-0.5">{project.code}</p>
                </div>
                <span
                  className={`shrink-0 text-xs px-2 py-0.5 rounded-md font-mono ${
                    statusColors[project.status] || 'bg-zinc-700 text-zinc-300'
                  }`}
                >
                  {project.status}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-xs px-2 py-1 rounded-md border border-zinc-700 text-zinc-400 font-mono">
                  {typeLabels[project.project_type] || project.project_type}
                </span>
                {project.city && (
                  <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">
                    {project.city}, {project.country_code}
                  </span>
                )}
              </div>

              {project.overall_completion_pct !== null && (
                <div className="mb-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Progress</span>
                    <span className="font-medium font-mono text-zinc-100">
                      {project.overall_completion_pct.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-zinc-700 overflow-hidden">
                    <div
                      className="h-full bg-zinc-500 rounded-full transition-all"
                      style={{ width: `${project.overall_completion_pct}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="grid grid-cols-6 gap-2">
                <div className="col-span-3 p-2 rounded-md bg-zinc-800 border border-zinc-700/60 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">CAPEX</p>
                  <p className="font-semibold font-mono tabular-nums text-zinc-100 text-sm mt-0.5">
                    {formatCurrency(project.total_capex_planned, project.currency)}
                  </p>
                </div>
                <div
                  className={`col-span-1.5 p-2 rounded-md text-center ${
                    project.irr ? 'bg-green-500/10 border border-green-500/30 text-green-400/90' : 'bg-zinc-800 border border-zinc-700/60 text-zinc-500'
                  }`}
                >
                  <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">IRR</p>
                  <p className="font-semibold font-mono text-sm mt-0.5">{formatPercent(project.irr)}</p>
                </div>
                <div
                  className={`col-span-1.5 p-2 rounded-md text-center bg-zinc-800 border border-zinc-700/60 ${
                    project.npv ? 'text-zinc-100' : 'text-zinc-500'
                  }`}
                >
                  <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">NPV</p>
                  <p className="font-semibold font-mono text-sm mt-0.5">
                    {project.npv ? formatCurrency(project.npv, project.currency) : '-'}
                  </p>
                </div>
              </div>

              {project.sponsor_name && (
                <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 mt-3">Sponsor: {project.sponsor_name}</p>
              )}
            </div>
          ))}
        </div>

        {/* Empty State — corp */}
        {!loading && filteredProjects.length === 0 && (
          <div className="text-center py-16">
            <BanknotesIcon className="w-16 h-16 mx-auto text-zinc-600 mb-4" />
            <h3 className="text-lg font-display font-semibold text-zinc-200 mb-2">No projects found</h3>
            <p className="text-zinc-500/90 font-sans mb-4">Create your first project or load sample data for demos</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={async () => {
                  setSeedError(null)
                  setSeedLoading(true)
                  try {
                    await seedApi.seedSampleData()
                    await fetchProjects()
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
                onClick={() => navigate('/projects/new')}
                className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 font-medium hover:bg-zinc-700 transition-colors font-sans"
              >
                <PlusIcon className="w-5 h-5" />
                Create Project
              </button>
            </div>
            {seedError && <p className="text-amber-400/80 text-sm mt-3 font-sans">{seedError}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
