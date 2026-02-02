/**
 * Projects Page - Project Finance Management
 * Displays list of projects with IRR/NPV analytics
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PlusIcon,
  ArrowPathIcon,
  BanknotesIcon,
} from '@heroicons/react/24/outline'
import { projectsApi } from '../lib/api'

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
  development: 'bg-blue-500/20 text-blue-300',
  planning: 'bg-white/10 text-white/70',
  financing: 'bg-amber-500/20 text-amber-300',
  construction: 'bg-primary-500/20 text-primary-300',
  commissioning: 'bg-purple-500/20 text-purple-300',
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
    <div className="h-full overflow-auto p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-white flex items-center gap-2">
            <BanknotesIcon className="w-8 h-8 text-amber-400" />
            Project Finance
          </h1>
          <p className="text-dark-muted text-sm mt-1">
            Infrastructure and development projects with IRR/NPV analysis
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchProjects}
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            title="Refresh"
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => navigate('/projects/new')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            New Project
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="glass rounded-2xl p-4 border border-white/5 mb-6 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search projects..."
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
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white min-w-[150px] focus:outline-none focus:ring-2 focus:ring-primary-500/50"
        >
          <option value="">All Statuses</option>
          <option value="development" className="bg-dark-card">Development</option>
          <option value="planning" className="bg-dark-card">Planning</option>
          <option value="financing" className="bg-dark-card">Financing</option>
          <option value="construction" className="bg-dark-card">Construction</option>
          <option value="commissioning" className="bg-dark-card">Commissioning</option>
          <option value="operation" className="bg-dark-card">Operation</option>
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="h-1 rounded-full bg-white/10 overflow-hidden mb-6">
          <div className="h-full w-1/3 bg-primary-500 animate-pulse" />
        </div>
      )}

      {/* Projects Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredProjects.map((project) => (
          <div
            key={project.id}
            onClick={() => navigate(`/projects/${project.id}`)}
            className="glass rounded-2xl p-5 border border-white/5 hover:border-primary-500/30 cursor-pointer transition-all hover:-translate-y-0.5 hover:shadow-lg"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="min-w-0">
                <h3 className="font-semibold text-white truncate">{project.name}</h3>
                <p className="text-dark-muted text-sm font-mono">{project.code}</p>
              </div>
              <span
                className={`shrink-0 text-xs px-2 py-0.5 rounded-full ${
                  statusColors[project.status] || 'bg-white/10 text-white/70'
                }`}
              >
                {project.status}
              </span>
            </div>

            <div className="flex flex-wrap gap-2 mb-3">
              <span className="text-xs px-2 py-1 rounded-lg border border-white/10 text-white/70">
                {typeLabels[project.project_type] || project.project_type}
              </span>
              {project.city && (
                <span className="text-dark-muted text-sm">
                  {project.city}, {project.country_code}
                </span>
              )}
            </div>

            {project.overall_completion_pct !== null && (
              <div className="mb-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-dark-muted">Progress</span>
                  <span className="font-medium text-white">
                    {project.overall_completion_pct.toFixed(0)}%
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-primary-500 rounded-full transition-all"
                    style={{ width: `${project.overall_completion_pct}%` }}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-6 gap-2">
              <div className="col-span-3 p-2 rounded-lg bg-white/5 text-center">
                <p className="text-dark-muted text-xs">CAPEX</p>
                <p className="font-semibold text-white text-sm">
                  {formatCurrency(project.total_capex_planned, project.currency)}
                </p>
              </div>
              <div
                className={`col-span-1.5 p-2 rounded-lg text-center ${
                  project.irr ? 'bg-green-500/20 text-green-300' : 'bg-white/5 text-white/50'
                }`}
              >
                <p className="text-xs">IRR</p>
                <p className="font-semibold text-sm">{formatPercent(project.irr)}</p>
              </div>
              <div
                className={`col-span-1.5 p-2 rounded-lg text-center ${
                  project.npv ? 'bg-primary-500/20 text-primary-300' : 'bg-white/5 text-white/50'
                }`}
              >
                <p className="text-xs">NPV</p>
                <p className="font-semibold text-sm">
                  {project.npv ? formatCurrency(project.npv, project.currency) : '-'}
                </p>
              </div>
            </div>

            {project.sponsor_name && (
              <p className="text-dark-muted text-xs mt-3">Sponsor: {project.sponsor_name}</p>
            )}
          </div>
        ))}
      </div>

      {/* Empty State */}
      {!loading && filteredProjects.length === 0 && (
        <div className="text-center py-16">
          <BanknotesIcon className="w-16 h-16 mx-auto text-dark-muted/50 mb-4" />
          <h3 className="text-lg font-semibold text-white/80 mb-2">No projects found</h3>
          <p className="text-dark-muted mb-4">Create your first project or load sample data for demos</p>
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
              onClick={() => navigate('/projects/new')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              Create Project
            </button>
          </div>
          {seedError && <p className="text-amber-400 text-sm mt-3">{seedError}</p>}
        </div>
      )}
    </div>
  )
}
