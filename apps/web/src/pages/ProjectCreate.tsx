/**
 * Create Project - Form to add a new project
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, BanknotesIcon } from '@heroicons/react/24/outline'
import { projectsApi } from '../lib/api'

const PROJECT_TYPES = [
  { value: 'commercial', label: 'Commercial' },
  { value: 'residential', label: 'Residential' },
  { value: 'industrial', label: 'Industrial' },
  { value: 'road', label: 'Road' },
  { value: 'rail', label: 'Rail' },
  { value: 'renewable', label: 'Renewable Energy' },
  { value: 'mixed_use', label: 'Mixed Use' },
  { value: 'port', label: 'Port' },
  { value: 'airport', label: 'Airport' },
  { value: 'utility', label: 'Utility' },
  { value: 'other', label: 'Other' },
]

const STATUSES = [
  { value: 'development', label: 'Development' },
  { value: 'planning', label: 'Planning' },
  { value: 'financing', label: 'Financing' },
  { value: 'construction', label: 'Construction' },
  { value: 'commissioning', label: 'Commissioning' },
  { value: 'operation', label: 'Operation' },
]

export default function ProjectCreate() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    project_type: 'commercial',
    status: 'development',
    currency: 'EUR',
    country_code: 'DE',
    city: '',
    total_capex_planned: '',
    annual_revenue_projected: '',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!form.name.trim()) {
      setError('Name is required')
      return
    }
    setSubmitting(true)
    try {
      const created = await projectsApi.create({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        project_type: form.project_type,
        status: form.status,
        currency: form.currency,
        country_code: form.country_code || undefined,
        city: form.city.trim() || undefined,
        total_capex_planned: form.total_capex_planned ? parseFloat(form.total_capex_planned) : undefined,
        annual_revenue_projected: form.annual_revenue_projected ? parseFloat(form.annual_revenue_projected) : undefined,
      })
      navigate(`/projects/${created.id}`, { replace: true })
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to create project')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="h-full overflow-auto p-8">
      <button
        onClick={() => navigate('/projects')}
        className="flex items-center gap-2 text-dark-muted hover:text-white mb-6"
      >
        <ArrowLeftIcon className="w-5 h-5" />
        Back to Projects
      </button>
      <h1 className="text-2xl font-display font-bold text-white flex items-center gap-2 mb-6">
        <BanknotesIcon className="w-8 h-8 text-amber-400" />
        New Project
      </h1>

      <form onSubmit={handleSubmit} className="glass rounded-2xl p-6 border border-white/5 max-w-xl">
        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
              placeholder="Project name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-white/80 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-500/50 resize-none"
              placeholder="Short description"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">Type</label>
              <select
                value={form.project_type}
                onChange={(e) => setForm((f) => ({ ...f, project_type: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
              >
                {PROJECT_TYPES.map((o) => (
                  <option key={o.value} value={o.value} className="bg-dark-card">
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-primary-500/50"
              >
                {STATUSES.map((o) => (
                  <option key={o.value} value={o.value} className="bg-dark-card">
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">Total CAPEX (planned)</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={form.total_capex_planned}
                onChange={(e) => setForm((f) => ({ ...f, total_capex_planned: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                placeholder="e.g. 5000000"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">Annual revenue (projected)</label>
              <input
                type="number"
                min="0"
                step="1000"
                value={form.annual_revenue_projected}
                onChange={(e) => setForm((f) => ({ ...f, annual_revenue_projected: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                placeholder="e.g. 500000"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">Country</label>
              <input
                type="text"
                value={form.country_code}
                onChange={(e) => setForm((f) => ({ ...f, country_code: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                placeholder="DE"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-white/80 mb-1">City</label>
              <input
                type="text"
                value={form.city}
                onChange={(e) => setForm((f) => ({ ...f, city: e.target.value }))}
                className="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-primary-500/50"
                placeholder="City"
              />
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating…' : 'Create Project'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/projects')}
            className="px-4 py-2 rounded-xl border border-white/10 text-white/80 hover:bg-white/5"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
