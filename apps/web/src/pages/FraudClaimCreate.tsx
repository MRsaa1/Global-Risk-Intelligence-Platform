/**
 * Create Fraud Claim - Form to add a new damage claim
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeftIcon, ShieldExclamationIcon } from '@heroicons/react/24/outline'
import { fraudApi, assetsApi } from '../lib/api'

const CLAIM_TYPES = [
  { value: 'insurance', label: 'Insurance' },
  { value: 'collateral', label: 'Collateral' },
  { value: 'warranty', label: 'Warranty' },
]

const DAMAGE_TYPES = [
  { value: 'flood', label: 'Flood' },
  { value: 'fire', label: 'Fire' },
  { value: 'wind', label: 'Wind' },
  { value: 'earthquake', label: 'Earthquake' },
  { value: 'structural', label: 'Structural' },
  { value: 'vandalism', label: 'Vandalism' },
  { value: 'theft', label: 'Theft' },
  { value: 'subsidence', label: 'Subsidence' },
  { value: 'other', label: 'Other' },
]

export default function FraudClaimCreate() {
  const navigate = useNavigate()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [assets, setAssets] = useState<{ id: string; name: string }[]>([])
  const [form, setForm] = useState({
    asset_id: '',
    title: '',
    description: '',
    claim_type: 'insurance',
    claimed_damage_type: 'other',
    claimed_loss_amount: '',
    claimant_name: '',
    policy_number: '',
    damage_location: '',
  })

  useEffect(() => {
    assetsApi.list({ page: 1, page_size: 100 }).then((r) => {
      setAssets(r.items.map((a) => ({ id: a.id, name: a.name || a.pars_id || a.id })))
    }).catch(() => setAssets([]))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!form.asset_id.trim()) {
      setError('Asset is required')
      return
    }
    if (!form.title.trim()) {
      setError('Title is required')
      return
    }
    const amount = form.claimed_loss_amount ? parseFloat(form.claimed_loss_amount) : 0
    if (isNaN(amount) || amount < 0) {
      setError('Claimed loss amount must be 0 or greater')
      return
    }
    setSubmitting(true)
    try {
      const created = await fraudApi.createClaim({
        asset_id: form.asset_id.trim(),
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        claim_type: form.claim_type,
        claimed_damage_type: form.claimed_damage_type,
        claimed_loss_amount: amount,
        claimant_name: form.claimant_name.trim() || undefined,
        policy_number: form.policy_number.trim() || undefined,
        damage_location: form.damage_location.trim() || undefined,
      })
      navigate('/fraud', { replace: true })
    } catch (err: any) {
      setError(err?.response?.data?.detail || err?.message || 'Failed to create claim')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-full bg-zinc-950 p-8 pb-16">
      <button
        onClick={() => navigate('/fraud')}
        className="flex items-center gap-2 text-dark-muted hover:text-zinc-100 mb-6"
      >
        <ArrowLeftIcon className="w-5 h-5" />
        Back to Fraud Detection
      </button>
      <h1 className="text-2xl font-display font-bold text-zinc-100 flex items-center gap-2 mb-6">
        <ShieldExclamationIcon className="w-8 h-8 text-red-400/80" />
        New Claim
      </h1>

      <form onSubmit={handleSubmit} className="glass rounded-md p-6 border border-zinc-800 max-w-xl">
        {error && (
          <div className="mb-4 p-3 rounded-md bg-red-500/20 border border-red-500/30 text-red-300 text-sm">
            {error}
          </div>
        )}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-zinc-200 mb-1">Asset *</label>
            <select
              required
              value={form.asset_id}
              onChange={(e) => setForm((f) => ({ ...f, asset_id: e.target.value }))}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500/50"
            >
              <option value="" className="bg-dark-card">Select asset</option>
              {assets.map((a) => (
                <option key={a.id} value={a.id} className="bg-dark-card">
                  {a.name}
                </option>
              ))}
            </select>
            {assets.length === 0 && (
              <p className="text-amber-400/80 text-xs mt-1">No assets. Create assets first in Assets.</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-200 mb-1">Title *</label>
            <input
              type="text"
              required
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/50"
              placeholder="Claim title"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-200 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/50 resize-none"
              placeholder="Damage description"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-200 mb-1">Claim type</label>
              <select
                value={form.claim_type}
                onChange={(e) => setForm((f) => ({ ...f, claim_type: e.target.value }))}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500/50"
              >
                {CLAIM_TYPES.map((o) => (
                  <option key={o.value} value={o.value} className="bg-dark-card">
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-200 mb-1">Damage type</label>
              <select
                value={form.claimed_damage_type}
                onChange={(e) => setForm((f) => ({ ...f, claimed_damage_type: e.target.value }))}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-zinc-500/50"
              >
                {DAMAGE_TYPES.map((o) => (
                  <option key={o.value} value={o.value} className="bg-dark-card">
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-200 mb-1">Claimed loss amount (€) *</label>
            <input
              type="number"
              min="0"
              step="100"
              value={form.claimed_loss_amount}
              onChange={(e) => setForm((f) => ({ ...f, claimed_loss_amount: e.target.value }))}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/50"
              placeholder="0"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-200 mb-1">Claimant name</label>
              <input
                type="text"
                value={form.claimant_name}
                onChange={(e) => setForm((f) => ({ ...f, claimant_name: e.target.value }))}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/50"
                placeholder="Name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-200 mb-1">Policy number</label>
              <input
                type="text"
                value={form.policy_number}
                onChange={(e) => setForm((f) => ({ ...f, policy_number: e.target.value }))}
                className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/50"
                placeholder="Policy #"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-200 mb-1">Damage location</label>
            <input
              type="text"
              value={form.damage_location}
              onChange={(e) => setForm((f) => ({ ...f, damage_location: e.target.value }))}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/50"
              placeholder="Address or area"
            />
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            type="submit"
            disabled={submitting}
            className="px-4 py-2 rounded-md bg-zinc-500 text-zinc-100 font-medium hover:bg-zinc-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Creating…' : 'Create Claim'}
          </button>
          <button
            type="button"
            onClick={() => navigate('/fraud')}
            className="px-4 py-2 rounded-md border border-zinc-700 text-zinc-200 hover:bg-zinc-800"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
