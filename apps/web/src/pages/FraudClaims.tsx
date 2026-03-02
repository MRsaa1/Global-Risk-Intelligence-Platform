/**
 * Fraud Claims — Damage claims verification and fraud analysis.
 * Unified Corporate Style: zinc palette, section labels font-mono text-[10px]
 * uppercase tracking-widest text-zinc-500, rounded-md only, no glass/blur. See Implementation Audit.
 */
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PlusIcon,
  ArrowPathIcon,
  ShieldExclamationIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  ArrowsRightLeftIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'
import { fraudApi, seedApi } from '../lib/api'

interface Claim {
  id: string
  claim_number: string
  asset_id: string
  claim_type: string
  status: string
  title: string
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
  evidence_requested: 'bg-zinc-700 text-zinc-300',
  verified: 'bg-zinc-500/20 text-zinc-300',
  disputed: 'bg-red-500/20 text-red-300',
  approved: 'bg-green-500/20 text-green-300',
  rejected: 'bg-red-500/20 text-red-300',
  paid: 'bg-green-500/20 text-green-300',
  closed: 'bg-zinc-700 text-zinc-300',
}

const riskColors: Record<string, string> = {
  low: 'text-green-400/80',
  medium: 'text-amber-400/80',
  high: 'text-red-400/80',
  critical: 'text-purple-400/80',
}

const damageTypeLabels: Record<string, string> = {
  flood: 'Flood',
  fire: 'Fire',
  wind: 'Wind',
  earthquake: 'Earthquake',
  structural: 'Structural',
  vandalism: 'Vandalism',
  theft: 'Theft',
  subsidence: 'Subsidence',
  other: 'Other',
}

function FraudRiskIcon({ level }: { level: string | null }) {
  if (!level) return null
  switch (level) {
    case 'low':
      return <CheckCircleIcon className="w-4 h-4 text-green-400/80" />
    case 'medium':
      return <ExclamationTriangleIcon className="w-4 h-4 text-amber-400/80" />
    case 'high':
    case 'critical':
      return <XCircleIcon className="w-4 h-4 text-red-400/80" />
    default:
      return null
  }
}

export default function FraudClaims() {
  const navigate = useNavigate()
  const [claims, setClaims] = useState<Claim[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [claimTypeFilter, setClaimTypeFilter] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [seedLoading, setSeedLoading] = useState(false)
  const [seedError, setSeedError] = useState<string | null>(null)

  useEffect(() => {
    fetchClaims()
  }, [statusFilter, claimTypeFilter])

  const fetchClaims = async () => {
    setLoading(true)
    try {
      const data = await fraudApi.listClaims({
        status: statusFilter || undefined,
        claim_type: claimTypeFilter || undefined,
      })
      setClaims(data)
    } catch (error) {
      console.error('Failed to fetch claims:', error)
      setClaims([])
    } finally {
      setLoading(false)
    }
  }

  const filteredClaims = claims.filter(
    (c) =>
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.claim_number.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.claimant_name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatCurrency = (value: number | null) => {
    if (value === null) return '-'
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(value)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  const stats = {
    total: claims.length,
    pending: claims.filter((c) =>
      ['submitted', 'under_review', 'evidence_requested'].includes(c.status)
    ).length,
    highRisk: claims.filter((c) =>
      ['high', 'critical'].includes(c.fraud_risk_level || '')
    ).length,
    totalClaimed: claims.reduce((sum, c) => sum + c.claimed_loss_amount, 0),
    totalApproved: claims.reduce((sum, c) => sum + (c.approved_amount || 0), 0),
  }

  return (
    <div className="min-h-full p-6 bg-zinc-950 pb-16">
      <div className="w-full max-w-[1920px] mx-auto">
        {/* Header — Unified Corporate Style (Strategic Modules structure) */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-zinc-800 rounded-md border border-zinc-700">
              <ShieldExclamationIcon className="w-8 h-8 text-zinc-400" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-semibold text-zinc-100">
                Fraud Detection
              </h1>
              <p className="text-zinc-500 text-sm mt-1 font-sans">
                Damage claims verification and fraud analysis
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchClaims}
              className="p-2 rounded-md bg-zinc-800 border border-zinc-700 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-100 transition-colors"
              title="Refresh"
            >
              <ArrowPathIcon className="w-5 h-5" />
            </button>
            <button
              onClick={() => navigate('/fraud/claims/new')}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 font-medium hover:bg-zinc-700 transition-colors font-sans"
            >
              <PlusIcon className="w-5 h-5" />
              New Claim
            </button>
          </div>
        </div>

        {/* Summary Cards — corp: bg-zinc-900, section labels font-mono text-[10px] */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          <div className="rounded-md p-4 border border-zinc-800 bg-zinc-900 text-center">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Total Claims</p>
            <p className="text-xl font-semibold font-mono tabular-nums text-zinc-100 mt-0.5">{stats.total}</p>
          </div>
          <div className="rounded-md p-4 border border-zinc-800 bg-zinc-900 text-center">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Pending</p>
            <p className="text-xl font-semibold font-mono tabular-nums text-amber-400/80 mt-0.5">{stats.pending}</p>
          </div>
          <div className="rounded-md p-4 border border-zinc-800 bg-zinc-900 text-center">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">High Risk</p>
            <p className="text-xl font-semibold font-mono tabular-nums text-red-400/80 mt-0.5">{stats.highRisk}</p>
          </div>
          <div className="rounded-md p-4 border border-zinc-800 bg-zinc-900 text-center">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Total Claimed</p>
            <p className="text-lg font-semibold font-mono tabular-nums text-zinc-100 mt-0.5">{formatCurrency(stats.totalClaimed)}</p>
          </div>
          <div className="rounded-md p-4 border border-zinc-800 bg-zinc-900 text-center">
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Total Approved</p>
            <p className="text-lg font-semibold font-mono tabular-nums text-green-400/80 mt-0.5">{formatCurrency(stats.totalApproved)}</p>
          </div>
        </div>

        {/* Filters — corp: bg-zinc-900, no glass, focus:border-zinc-600 */}
        <div className="rounded-md p-4 border border-zinc-800 bg-zinc-900 mb-6 flex flex-wrap items-center gap-4">
          <div className="flex-1 min-w-[200px]">
            <input
              type="text"
              placeholder="Search claims..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600 font-sans"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs font-medium focus:outline-none focus:border-zinc-600 font-sans min-w-[150px]"
            >
              <option value="">All Statuses</option>
              <option value="submitted" className="bg-zinc-900">Submitted</option>
              <option value="under_review" className="bg-zinc-900">Under Review</option>
              <option value="evidence_requested" className="bg-zinc-900">Evidence Requested</option>
              <option value="verified" className="bg-zinc-900">Verified</option>
              <option value="disputed" className="bg-zinc-900">Disputed</option>
              <option value="approved" className="bg-zinc-900">Approved</option>
              <option value="rejected" className="bg-zinc-900">Rejected</option>
              <option value="paid" className="bg-zinc-900">Paid</option>
              <option value="closed" className="bg-zinc-900">Closed</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Type:</span>
            <select
              value={claimTypeFilter}
              onChange={(e) => setClaimTypeFilter(e.target.value)}
              className="px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs font-medium focus:outline-none focus:border-zinc-600 font-sans min-w-[150px]"
            >
              <option value="">All Types</option>
              <option value="insurance" className="bg-zinc-900">Insurance</option>
              <option value="collateral" className="bg-zinc-900">Collateral</option>
              <option value="warranty" className="bg-zinc-900">Warranty</option>
            </select>
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className="h-1 rounded-full bg-zinc-700 overflow-hidden mb-6">
            <div className="h-full w-1/3 bg-zinc-500 animate-pulse" />
          </div>
        )}

        {/* Claims Table — corp: bg-zinc-900, table headers font-mono text-[10px] */}
        <div className="rounded-md border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-sans">
              <thead>
                <tr className="border-b border-zinc-700 bg-zinc-800/80">
                  <th className="text-left py-3 px-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Claim</th>
                  <th className="text-left py-3 px-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Damage</th>
                  <th className="text-left py-3 px-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Status</th>
                  <th className="text-right py-3 px-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Claimed</th>
                  <th className="text-right py-3 px-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Assessed</th>
                  <th className="text-center py-3 px-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Risk</th>
                  <th className="text-center py-3 px-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500">3D</th>
                  <th className="text-left py-3 px-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Date</th>
                  <th className="text-center py-3 px-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Actions</th>
                </tr>
              </thead>
            <tbody>
              {filteredClaims.map((claim) => (
                <tr
                  key={claim.id}
                  onClick={() => navigate(`/fraud/claims/${claim.id}`)}
                  className="border-b border-zinc-800 hover:bg-zinc-800 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-semibold text-zinc-100">{claim.claim_number}</p>
                      <p className="text-zinc-500 text-xs truncate max-w-[180px]">
                        {claim.title}
                      </p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs px-2 py-0.5 rounded-md border border-zinc-700 text-zinc-300 bg-zinc-800/80">
                      {damageTypeLabels[claim.claimed_damage_type] || claim.claimed_damage_type}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-md ${
                        statusColors[claim.status] || 'bg-zinc-700 text-zinc-300'
                      }`}
                    >
                      {claim.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-zinc-100">
                    {formatCurrency(claim.claimed_loss_amount)}
                  </td>
                  <td className="py-3 px-4 text-right text-zinc-300">
                    {formatCurrency(claim.assessed_loss_amount)}
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center gap-1">
                      <FraudRiskIcon level={claim.fraud_risk_level} />
                      {claim.fraud_score != null && (
                        <span className={riskColors[claim.fraud_risk_level || 'low']}>
                          {(claim.fraud_score * 100).toFixed(0)}%
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex gap-1 justify-center">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                          claim.has_before_data ? 'bg-green-500/20 text-green-300' : 'bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        Before
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-md font-mono ${
                          claim.has_after_data ? 'bg-green-500/20 text-green-300' : 'bg-zinc-800 text-zinc-500'
                        }`}
                      >
                        After
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-zinc-500 text-xs font-mono">
                    {formatDate(claim.reported_at)}
                  </td>
                  <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/fraud/claims/${claim.id}`)
                        }}
                        className="p-1.5 rounded-md hover:bg-zinc-700 text-zinc-300 hover:text-zinc-100"
                        title="View"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      {claim.has_before_data && claim.has_after_data && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            navigate(`/fraud/claims/${claim.id}`)
                          }}
                          className="p-1.5 rounded-md hover:bg-zinc-500/20 text-zinc-400"
                          title="View & 3D Compare"
                        >
                          <ArrowsRightLeftIcon className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        </div>

        {/* Empty State — corp: text-zinc-400/80, font-sans */}
        {!loading && filteredClaims.length === 0 && (
          <div className="text-center py-16">
            <ShieldExclamationIcon className="w-16 h-16 mx-auto text-zinc-600 mb-4" />
            <h3 className="text-lg font-display font-semibold text-zinc-200 mb-2">No claims found</h3>
            <p className="text-zinc-500/90 font-sans mb-4">Create a new claim or load sample data for demos</p>
            <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={async () => {
                setSeedError(null)
                setSeedLoading(true)
                try {
                  await seedApi.seedSampleData()
                  await fetchClaims()
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
              onClick={() => navigate('/fraud/claims/new')}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 font-medium hover:bg-zinc-700 transition-colors font-sans"
            >
              <PlusIcon className="w-5 h-5" />
              Create Claim
            </button>
            </div>
            {seedError && <p className="text-amber-400/80 text-sm mt-3 font-sans">{seedError}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
