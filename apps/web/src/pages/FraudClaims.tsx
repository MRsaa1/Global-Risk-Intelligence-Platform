/**
 * Fraud Claims Page - Damage claims and fraud detection
 * Displays list of claims with fraud indicators
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
  submitted: 'bg-blue-500/20 text-blue-300',
  under_review: 'bg-amber-500/20 text-amber-300',
  evidence_requested: 'bg-white/10 text-white/70',
  verified: 'bg-primary-500/20 text-primary-300',
  disputed: 'bg-red-500/20 text-red-300',
  approved: 'bg-green-500/20 text-green-300',
  rejected: 'bg-red-500/20 text-red-300',
  paid: 'bg-green-500/20 text-green-300',
  closed: 'bg-white/10 text-white/70',
}

const riskColors: Record<string, string> = {
  low: 'text-green-400',
  medium: 'text-amber-400',
  high: 'text-red-400',
  critical: 'text-purple-400',
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
      return <CheckCircleIcon className="w-4 h-4 text-green-400" />
    case 'medium':
      return <ExclamationTriangleIcon className="w-4 h-4 text-amber-400" />
    case 'high':
    case 'critical':
      return <XCircleIcon className="w-4 h-4 text-red-400" />
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
    <div className="h-full overflow-auto p-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-display font-bold text-white flex items-center gap-2">
            <ShieldExclamationIcon className="w-8 h-8 text-red-400" />
            Fraud Detection
          </h1>
          <p className="text-dark-muted text-sm mt-1">
            Damage claims verification and fraud analysis
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={fetchClaims}
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 hover:text-white transition-colors"
            title="Refresh"
          >
            <ArrowPathIcon className="w-5 h-5" />
          </button>
          <button
            onClick={() => navigate('/fraud/claims/new')}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors"
          >
            <PlusIcon className="w-5 h-5" />
            New Claim
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <div className="glass rounded-2xl p-4 border border-white/5 text-center">
          <p className="text-dark-muted text-xs">Total Claims</p>
          <p className="text-xl font-bold text-white">{stats.total}</p>
        </div>
        <div className="glass rounded-2xl p-4 border border-white/5 text-center">
          <p className="text-dark-muted text-xs">Pending</p>
          <p className="text-xl font-bold text-amber-400">{stats.pending}</p>
        </div>
        <div className="glass rounded-2xl p-4 border border-white/5 text-center">
          <p className="text-dark-muted text-xs">High Risk</p>
          <p className="text-xl font-bold text-red-400">{stats.highRisk}</p>
        </div>
        <div className="glass rounded-2xl p-4 border border-white/5 text-center">
          <p className="text-dark-muted text-xs">Total Claimed</p>
          <p className="text-lg font-bold text-white">{formatCurrency(stats.totalClaimed)}</p>
        </div>
        <div className="glass rounded-2xl p-4 border border-white/5 text-center">
          <p className="text-dark-muted text-xs">Total Approved</p>
          <p className="text-lg font-bold text-green-400">{formatCurrency(stats.totalApproved)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="glass rounded-2xl p-4 border border-white/5 mb-6 flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search claims..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white placeholder-white/40 min-w-[200px] focus:outline-none focus:ring-2 focus:ring-primary-500/50"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white min-w-[150px] focus:outline-none focus:ring-2 focus:ring-primary-500/50"
        >
          <option value="">All Statuses</option>
          <option value="submitted" className="bg-dark-card">Submitted</option>
          <option value="under_review" className="bg-dark-card">Under Review</option>
          <option value="evidence_requested" className="bg-dark-card">Evidence Requested</option>
          <option value="verified" className="bg-dark-card">Verified</option>
          <option value="disputed" className="bg-dark-card">Disputed</option>
          <option value="approved" className="bg-dark-card">Approved</option>
          <option value="rejected" className="bg-dark-card">Rejected</option>
          <option value="paid" className="bg-dark-card">Paid</option>
          <option value="closed" className="bg-dark-card">Closed</option>
        </select>
        <select
          value={claimTypeFilter}
          onChange={(e) => setClaimTypeFilter(e.target.value)}
          className="px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-white min-w-[150px] focus:outline-none focus:ring-2 focus:ring-primary-500/50"
        >
          <option value="">All Types</option>
          <option value="insurance" className="bg-dark-card">Insurance</option>
          <option value="collateral" className="bg-dark-card">Collateral</option>
          <option value="warranty" className="bg-dark-card">Warranty</option>
        </select>
      </div>

      {/* Loading */}
      {loading && (
        <div className="h-1 rounded-full bg-white/10 overflow-hidden mb-6">
          <div className="h-full w-1/3 bg-primary-500 animate-pulse" />
        </div>
      )}

      {/* Claims Table */}
      <div className="glass rounded-2xl border border-white/5 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/5">
                <th className="text-left py-3 px-4 text-dark-muted font-medium">Claim</th>
                <th className="text-left py-3 px-4 text-dark-muted font-medium">Damage</th>
                <th className="text-left py-3 px-4 text-dark-muted font-medium">Status</th>
                <th className="text-right py-3 px-4 text-dark-muted font-medium">Claimed</th>
                <th className="text-right py-3 px-4 text-dark-muted font-medium">Assessed</th>
                <th className="text-center py-3 px-4 text-dark-muted font-medium">Risk</th>
                <th className="text-center py-3 px-4 text-dark-muted font-medium">3D</th>
                <th className="text-left py-3 px-4 text-dark-muted font-medium">Date</th>
                <th className="text-center py-3 px-4 text-dark-muted font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredClaims.map((claim) => (
                <tr
                  key={claim.id}
                  onClick={() => navigate(`/fraud/claims/${claim.id}`)}
                  className="border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                >
                  <td className="py-3 px-4">
                    <div>
                      <p className="font-semibold text-white">{claim.claim_number}</p>
                      <p className="text-dark-muted text-xs truncate max-w-[180px]">
                        {claim.title}
                      </p>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-xs px-2 py-0.5 rounded border border-white/10 text-white/80">
                      {damageTypeLabels[claim.claimed_damage_type] || claim.claimed_damage_type}
                    </span>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        statusColors[claim.status] || 'bg-white/10 text-white/70'
                      }`}
                    >
                      {claim.status.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-right font-semibold text-white">
                    {formatCurrency(claim.claimed_loss_amount)}
                  </td>
                  <td className="py-3 px-4 text-right text-white/70">
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
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          claim.has_before_data ? 'bg-green-500/20 text-green-300' : 'bg-white/5 text-white/40'
                        }`}
                      >
                        Before
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded ${
                          claim.has_after_data ? 'bg-green-500/20 text-green-300' : 'bg-white/5 text-white/40'
                        }`}
                      >
                        After
                      </span>
                    </div>
                  </td>
                  <td className="py-3 px-4 text-dark-muted text-xs">
                    {formatDate(claim.reported_at)}
                  </td>
                  <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/fraud/claims/${claim.id}`)
                        }}
                        className="p-1.5 rounded-lg hover:bg-white/10 text-white/70 hover:text-white"
                        title="View"
                      >
                        <EyeIcon className="w-4 h-4" />
                      </button>
                      {claim.has_before_data && claim.has_after_data && (
                        <button
                          onClick={(e) => e.stopPropagation()}
                          className="p-1.5 rounded-lg hover:bg-primary-500/20 text-primary-400"
                          title="Compare 3D"
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

      {/* Empty State */}
      {!loading && filteredClaims.length === 0 && (
        <div className="text-center py-16">
          <ShieldExclamationIcon className="w-16 h-16 mx-auto text-dark-muted/50 mb-4" />
          <h3 className="text-lg font-semibold text-white/80 mb-2">No claims found</h3>
          <p className="text-dark-muted mb-4">Create a new claim or load sample data for demos</p>
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
              onClick={() => navigate('/fraud/claims/new')}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 transition-colors"
            >
              <PlusIcon className="w-5 h-5" />
              Create Claim
            </button>
          </div>
          {seedError && <p className="text-amber-400 text-sm mt-3">{seedError}</p>}
        </div>
      )}
    </div>
  )
}
