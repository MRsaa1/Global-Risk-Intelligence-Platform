/**
 * Create Portfolio - Form to add a new portfolio
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, BuildingOfficeIcon } from '@heroicons/react/24/outline'
import { portfoliosApi } from '../lib/api'

const PORTFOLIO_TYPES = [
  { value: 'fund', label: 'Investment Fund' },
  { value: 'reit', label: 'REIT' },
  { value: 'pension', label: 'Pension Fund' },
  { value: 'insurance', label: 'Insurance Portfolio' },
  { value: 'sovereign', label: 'Sovereign Fund' },
  { value: 'custom', label: 'Custom Portfolio' },
]

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF']

export default function PortfolioCreate() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState({
    name: '',
    description: '',
    portfolio_type: 'custom',
    base_currency: 'EUR',
    manager_name: '',
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
      const created = await portfoliosApi.create({
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        portfolio_type: form.portfolio_type,
        base_currency: form.base_currency,
        manager_name: form.manager_name.trim() || undefined,
      })
      navigate(`/portfolios/${created.id}`, { replace: true })
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to create portfolio')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-full bg-zinc-950 p-8 pb-16">
      <button
        onClick={() => navigate('/portfolios')}
        className="flex items-center gap-2 text-dark-muted hover:text-zinc-100 mb-6"
      >
        <ArrowLeftIcon className="w-5 h-5" />
        Back to Portfolios
      </button>
      <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2 mb-6">
        <BuildingOfficeIcon className="w-8 h-8 text-zinc-400" />
        New Portfolio
      </h1>

      <form onSubmit={handleSubmit} className="glass rounded-md p-6 border border-zinc-800 max-w-xl">
        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-200 mb-1">Name *</label>
            <input
              type="text"
              required
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/50"
              placeholder="Portfolio name"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-200 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/50 resize-none"
              placeholder="Short description"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-200 mb-1">Type</label>
              <select
                value={form.portfolio_type}
                onChange={(e) => setForm((f) => ({ ...f, portfolio_type: e.target.value }))}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500/50"
              >
                {PORTFOLIO_TYPES.map((o) => (
                  <option key={o.value} value={o.value} className="bg-dark-card">
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-200 mb-1">Base currency</label>
              <select
                value={form.base_currency}
                onChange={(e) => setForm((f) => ({ ...f, base_currency: e.target.value }))}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500/50"
              >
                {CURRENCIES.map((c) => (
                  <option key={c} value={c} className="bg-dark-card">
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-200 mb-1">Manager name</label>
            <input
              type="text"
              value={form.manager_name}
              onChange={(e) => setForm((f) => ({ ...f, manager_name: e.target.value }))}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/50"
              placeholder="Fund manager"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-md bg-zinc-500 text-zinc-100 font-medium hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating…' : 'Create Portfolio'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/portfolios')}
            className="px-4 py-2 rounded-md border border-zinc-700 text-zinc-200 hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
