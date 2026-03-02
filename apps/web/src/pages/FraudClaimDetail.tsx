/**
 * Fraud Claim Detail - view single claim, evidence (Before/After), and 3D Compare
 */
import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon,
  ArrowsRightLeftIcon,
  DocumentTextIcon,
  CheckCircleIcon,
  XCircleIcon,
} from '@heroicons/react/24/outline'
import { fraudApi } from '../lib/api'

interface Claim {
  id: string
  claim_number: string
  asset_id: string
  claim_type: string
  status: string
  title: string
  description?: string
  claimed_damage_type: string
  claimed_loss_amount: number
  assessed_loss_amount: number | null
  approved_amount: number | null
  fraud_risk_level: string | null
  fraud_score: number | null
  has_before_data: boolean
  has_after_data: boolean
  comparison_status: string | null
  geometry_match_score: number | null
  claimant_name: string | null
  reported_at: string
}

const statusColors: Record<string, string> = {
  submitted: 'bg-zinc-500/20 text-zinc-300',
  under_review: 'bg-zinc-500/20 text-zinc-300',
  approved: 'bg-green-500/20 text-green-300',
  rejected: 'bg-red-500/20 text-red-300',
  closed: 'bg-zinc-700 text-zinc-300',
}

const damageTypeLabels: Record<string, string> = {
  flood: 'Flood',
  fire: 'Fire',
  wind: 'Wind',
  earthquake: 'Earthquake',
  structural: 'Structural',
  other: 'Other',
}

export default function FraudClaimDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [claim, setClaim] = useState<Claim | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [compareLoading, setCompareLoading] = useState(false)
  const [compareResult, setCompareResult] = useState<Record<string, unknown> | null>(null)

  useEffect(() => {
    if (id) fetchClaim()
  }, [id])

  const fetchClaim = async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const data = await fraudApi.getClaim(id)
      setClaim(data)
      setCompareResult(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Claim not found')
      setClaim(null)
    } finally {
      setLoading(false)
    }
  }

  const runCompare = async () => {
    if (!id) return
    setCompareLoading(true)
    setCompareResult(null)
    try {
      const data = await fraudApi.compare(id)
      setCompareResult(data as Record<string, unknown>)
    } catch (e) {
      setCompareResult({ error: e instanceof Error ? e.message : 'Compare failed' })
    } finally {
      setCompareLoading(false)
    }
  }

  const formatCurrency = (value: number | null) => {
    if (value === null) return '—'
    return new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(value)
  }

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })

  if (loading) {
    return (
      <div className="min-h-full bg-zinc-950 p-8">
        <div className="h-1 rounded-full bg-zinc-700 overflow-hidden mb-4 max-w-xs">
          <div className="h-full w-1/3 bg-zinc-500 animate-pulse" />
        </div>
        <p className="text-zinc-400">Loading claim…</p>
      </div>
    )
  }

  if (error || !claim) {
    return (
      <div className="min-h-full bg-zinc-950 p-8">
        <p className="text-red-400/80 mb-4">{error || 'Claim not found'}</p>
        <button
          onClick={() => navigate('/fraud')}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-700 text-zinc-200 hover:bg-zinc-600"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          Back to claims
        </button>
      </div>
    )
  }

  return (
    <div className="min-h-full bg-zinc-950 p-8 pb-20">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/fraud')}
            className="p-2 rounded-md bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-300"
            title="Back to claims"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-xl font-display font-semibold text-zinc-100">{claim.claim_number}</h1>
            <p className="text-dark-muted text-sm">{claim.title}</p>
          </div>
        </div>
        <span
          className={`text-xs px-3 py-1 rounded-full ${statusColors[claim.status] || 'bg-zinc-700 text-zinc-300'}`}
        >
          {claim.status.replace('_', ' ')}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
        <div className="glass rounded-md border border-zinc-800 p-6">
          <h2 className="font-semibold text-zinc-100 mb-3 flex items-center gap-2">
            <DocumentTextIcon className="w-5 h-5" />
            Claim details
          </h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-dark-muted">Damage type</dt>
              <dd className="text-zinc-200">{damageTypeLabels[claim.claimed_damage_type] || claim.claimed_damage_type}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-dark-muted">Claimed</dt>
              <dd className="text-zinc-200 font-semibold">{formatCurrency(claim.claimed_loss_amount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-dark-muted">Assessed</dt>
              <dd className="text-zinc-200">{formatCurrency(claim.assessed_loss_amount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-dark-muted">Approved</dt>
              <dd className="text-zinc-200">{formatCurrency(claim.approved_amount)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-dark-muted">Reported</dt>
              <dd className="text-zinc-200">{formatDate(claim.reported_at)}</dd>
            </div>
            {claim.claimant_name && (
              <div className="flex justify-between">
                <dt className="text-dark-muted">Claimant</dt>
                <dd className="text-zinc-200">{claim.claimant_name}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="glass rounded-md border border-zinc-800 p-6">
          <h2 className="font-semibold text-zinc-100 mb-3">Risk & evidence</h2>
          <div className="flex flex-wrap gap-3 mb-4">
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                claim.has_before_data ? 'bg-green-500/20 text-green-300' : 'bg-zinc-800 text-zinc-500'
              }`}
            >
              {claim.has_before_data ? <CheckCircleIcon className="w-4 h-4" /> : <XCircleIcon className="w-4 h-4" />}
              Before
            </span>
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs ${
                claim.has_after_data ? 'bg-green-500/20 text-green-300' : 'bg-zinc-800 text-zinc-500'
              }`}
            >
              {claim.has_after_data ? <CheckCircleIcon className="w-4 h-4" /> : <XCircleIcon className="w-4 h-4" />}
              After
            </span>
            {claim.fraud_score != null && (
              <span className="text-zinc-300 text-xs">
                Fraud score: <strong>{((claim.fraud_score ?? 0) * 100).toFixed(0)}%</strong>
                {claim.fraud_risk_level && ` (${claim.fraud_risk_level})`}
              </span>
            )}
          </div>
          {claim.has_before_data && claim.has_after_data && (
            <button
              onClick={runCompare}
              disabled={compareLoading}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-700 text-zinc-200 hover:bg-zinc-600 disabled:opacity-50"
            >
              <ArrowsRightLeftIcon className="w-5 h-5" />
              {compareLoading ? 'Comparing…' : '3D Compare'}
            </button>
          )}
        </div>
      </div>

      {claim.description && (
        <div className="glass rounded-md border border-zinc-800 p-6 mb-6">
          <h2 className="font-semibold text-zinc-100 mb-2">Description</h2>
          <p className="text-zinc-300 text-sm whitespace-pre-wrap">{claim.description}</p>
        </div>
      )}

      {compareResult && (
        <div className="glass rounded-md border border-zinc-800 p-6">
          <h2 className="font-semibold text-zinc-100 mb-3">Compare result</h2>
          {'error' in compareResult ? (
            <p className="text-amber-400/80 text-sm">{String(compareResult.error)}</p>
          ) : (
            <pre className="text-xs text-zinc-400 bg-zinc-900 rounded-md p-4 overflow-auto max-h-64">
              {JSON.stringify(compareResult, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  )
}
