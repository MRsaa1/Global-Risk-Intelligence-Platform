/**
 * CADAPT Module - Climate Adaptation & Local Resilience
 *
 * Municipal dashboard with adaptation measures, grant matching,
 * ROI calculator, and commission tracking (Track B revenue).
 */
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  BuildingOffice2Icon,
  MagnifyingGlassIcon,
  CurrencyDollarIcon,
  DocumentTextIcon,
  MapPinIcon,
  CloudIcon,
  SunIcon,
  BoltIcon,
  BellAlertIcon,
} from '@heroicons/react/24/outline'
import { getModuleById } from '../../lib/modules'
import AccessGate from '../../components/modules/AccessGate'
import { getApiV1Base } from '../../config/env'

interface Measure {
  id: string; name: string; category: string
  cost_per_capita: number; effectiveness_pct: number
  roi_multiplier: number; implementation_months: number
  climate_risks_addressed: string[]; co_benefits: string[]
  description: string; relevance_score?: number
  total_cost_m?: number; expected_savings_m?: number
  affordable?: boolean; risks_matched?: string[]
}

interface Grant {
  id: string; name: string; agency: string; country: string
  max_award_m: number; match_required_pct: number
  eligible_risks: string[]; success_rate_pct: number
  deadline: string; commission_pct: number; description: string
  match_score?: number; estimated_commission_m?: number
}

const RISK_OPTIONS = ['flood', 'heat', 'drought', 'hurricane', 'wildfire', 'sea_level_rise', 'storm_surge', 'earthquake', 'tornado']

export default function CADAPTModule() {
  const navigate = useNavigate()
  const module = getModuleById('cadapt')
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'overview' | 'measures' | 'grants' | 'commissions' | 'plan'>('overview')
  const [measures, setMeasures] = useState<Measure[]>([])
  const [grants, setGrants] = useState<Grant[]>([])
  const [commissions, setCommissions] = useState<Record<string, any> | null>(null)
  const [selectedRisks, setSelectedRisks] = useState<string[]>(['flood', 'heat'])
  const [population, setPopulation] = useState(150000)
  const [budget, setBudget] = useState(200)
  const [country, setCountry] = useState('USA')

  const setDemoData = useCallback(() => {
    setMeasures([
      { id: 'adp_001', name: 'Green Infrastructure Network', category: 'green_infrastructure', cost_per_capita: 150, effectiveness_pct: 30, roi_multiplier: 4.5, implementation_months: 24, climate_risks_addressed: ['flood', 'heat'], co_benefits: ['biodiversity'], description: 'Bioswales, rain gardens, permeable pavement' },
      { id: 'adp_002', name: 'Flood Barriers & Levees', category: 'physical_barrier', cost_per_capita: 500, effectiveness_pct: 70, roi_multiplier: 3.2, implementation_months: 36, climate_risks_addressed: ['flood', 'storm_surge'], co_benefits: ['property_protection'], description: 'Engineered flood protection' },
      { id: 'adp_003', name: 'Urban Tree Canopy', category: 'green_infrastructure', cost_per_capita: 80, effectiveness_pct: 40, roi_multiplier: 6.0, implementation_months: 48, climate_risks_addressed: ['heat', 'stormwater'], co_benefits: ['shade', 'carbon'], description: 'Strategic tree planting' },
    ])
    setCommissions({ total_potential_commission_m: 2.5, approved_commission_m: 0.5, pending_commission_m: 1.2, by_status: { draft: 3, submitted: 2, approved: 1 } })
  }, [])

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    try {
      const [measRes, commRes] = await Promise.all([
        fetch(`${getApiV1Base()}/cadapt/measures`),
        fetch(`${getApiV1Base()}/cadapt/commissions`),
      ])
      if (measRes.ok) {
        const m = await measRes.json()
        setMeasures(Array.isArray(m) ? m : m?.items || [])
      } else {
        setDemoData()
      }
      if (commRes.ok) {
        setCommissions(await commRes.json())
      } else {
        setCommissions(prev => prev ?? { total_potential_commission_m: 0, approved_commission_m: 0, pending_commission_m: 0, by_status: {} })
      }
    } catch (err) {
      console.error('CADAPT dashboard error:', err)
      setDemoData()
    } finally {
      setLoading(false)
    }
  }, [setDemoData])

  const fetchRecommendations = useCallback(async () => {
    try {
      const res = await fetch(`${getApiV1Base()}/cadapt/measures/recommend`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city_risks: selectedRisks, population, budget_per_capita: budget }),
      })
      if (res.ok) {
        const m = await res.json()
        setMeasures(Array.isArray(m) ? m : m?.items || [])
      } else {
        setMeasures(prev => prev.length ? prev : [{ id: 'adp_001', name: 'Green Infrastructure Network', category: 'green_infrastructure', cost_per_capita: 150, effectiveness_pct: 30, roi_multiplier: 4.5, implementation_months: 24, climate_risks_addressed: ['flood', 'heat'], co_benefits: ['biodiversity'], description: 'Demo measure', relevance_score: 85, total_cost_m: 22.5, expected_savings_m: 101, affordable: true, risks_matched: ['flood', 'heat'] }])
      }
    } catch (err) {
      console.error(err)
      setMeasures(prev => prev.length ? prev : [{ id: 'adp_demo', name: 'Green Infrastructure (demo)', category: 'green_infrastructure', cost_per_capita: 150, effectiveness_pct: 30, roi_multiplier: 4.5, implementation_months: 24, climate_risks_addressed: ['flood', 'heat'], co_benefits: ['biodiversity'], description: 'Demo — API unavailable', relevance_score: 85, total_cost_m: 22.5, expected_savings_m: 101, affordable: true, risks_matched: selectedRisks }])
    }
  }, [selectedRisks, population, budget])

  const fetchMatchedGrants = useCallback(async () => {
    try {
      const res = await fetch(`${getApiV1Base()}/cadapt/grants/match`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city_risks: selectedRisks, country, population }),
      })
      if (res.ok) {
        const g = await res.json()
        setGrants(Array.isArray(g) ? g : g?.items || [])
      } else {
        setGrants(prev => prev.length ? prev : [{ id: 'gr_001', name: 'FEMA BRIC', agency: 'FEMA', country: 'USA', max_award_m: 50, match_required_pct: 25, eligible_risks: ['flood', 'hurricane'], success_rate_pct: 15, deadline: 'Annual Q4', commission_pct: 7, description: 'Building Resilient Infrastructure', match_score: 0.6, estimated_commission_m: 1.75 }])
      }
    } catch (err) {
      console.error(err)
      setGrants(prev => prev.length ? prev : [{ id: 'gr_001', name: 'FEMA BRIC (demo)', agency: 'FEMA', country: 'USA', max_award_m: 50, match_required_pct: 25, eligible_risks: ['flood'], success_rate_pct: 15, deadline: 'Q4', commission_pct: 7, description: 'Demo grant', match_score: 0.5, estimated_commission_m: 1.75 }])
    }
  }, [selectedRisks, country, population])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])
  useEffect(() => {
    if (tab === 'measures' || tab === 'plan') fetchRecommendations()
    if (tab === 'grants') fetchMatchedGrants()
  }, [tab, fetchRecommendations, fetchMatchedGrants])

  const toggleRisk = (risk: string) => {
    setSelectedRisks(prev => prev.includes(risk) ? prev.filter(r => r !== risk) : [...prev, risk])
  }

  return (
    <AccessGate moduleId="cadapt">
      <div className="min-h-screen bg-zinc-950 text-[#fafafa] p-4 md:p-6">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/modules')} className="p-2 rounded-md bg-[#18181b] hover:bg-[#27272a] border border-[#27272a]">
            <ArrowLeftIcon className="w-5 h-5 text-[#71717a]" />
          </button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <BuildingOffice2Icon className="w-7 h-7 text-zinc-500" />
              {module?.fullName || 'Climate Adaptation & Local Resilience'}
            </h1>
            <p className="text-[#71717a] text-sm mt-1">{module?.description}</p>
          </div>
          <button onClick={fetchDashboard} className="p-2 rounded-md bg-[#18181b] hover:bg-[#27272a] border border-[#27272a]">
            <ArrowPathIcon className="w-5 h-5 text-[#71717a]" />
          </button>
        </div>

        {/* Product modules — иконки + ссылки на Municipal / Effectiveness */}
        <div className="mb-6 py-2.5 px-1 border-b border-[#27272a] bg-[#18181b]/80 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mr-1">Product modules:</span>
          <button type="button" onClick={() => navigate('/municipal?tab=risk')} className="inline-flex items-center gap-1.5 text-xs text-[#71717a] hover:text-[#fafafa]">
            <CloudIcon className="w-4 h-4 shrink-0" />
            Flood
          </button>
          <span className="text-[#52525b]">·</span>
          <button type="button" onClick={() => navigate('/municipal?tab=risk')} className="inline-flex items-center gap-1.5 text-xs text-[#71717a] hover:text-[#fafafa]">
            <SunIcon className="w-4 h-4 shrink-0" />
            Heat
          </button>
          <span className="text-[#52525b]">·</span>
          <button type="button" onClick={() => navigate('/municipal?tab=risk')} className="inline-flex items-center gap-1.5 text-xs text-[#71717a] hover:text-[#fafafa]">
            <BoltIcon className="w-4 h-4 shrink-0" />
            Drought
          </button>
          <span className="text-[#52525b]">·</span>
          <button type="button" onClick={() => navigate('/municipal?tab=grants')} className="inline-flex items-center gap-1.5 text-xs text-[#71717a] hover:text-[#fafafa]">
            <CurrencyDollarIcon className="w-4 h-4 shrink-0" />
            Grants
          </button>
          <span className="text-[#52525b]">·</span>
          <button type="button" onClick={() => navigate('/municipal?tab=alerts')} className="inline-flex items-center gap-1.5 text-xs text-[#71717a] hover:text-[#fafafa]">
            <BellAlertIcon className="w-4 h-4 shrink-0" />
            Alerts
          </button>
          <span className="text-[#52525b]">·</span>
          <button type="button" onClick={() => navigate('/effectiveness')} className="inline-flex items-center gap-1.5 text-xs text-[#71717a] hover:text-[#fafafa]">
            <ArrowTrendingUpIcon className="w-4 h-4 shrink-0" />
            Effectiveness
          </button>
        </div>

        {/* Risk Profile Selector */}
        <div className="bg-[#18181b] rounded-md p-4 border border-[#27272a] mb-6">
          <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">City Risk Profile</h3>
          <div className="flex flex-wrap gap-2 mb-3">
            {RISK_OPTIONS.map(risk => (
              <button key={risk} onClick={() => toggleRisk(risk)}
                className={`px-3 py-1 rounded-full text-xs font-medium ${
                  selectedRisks.includes(risk) ? 'bg-zinc-500 text-zinc-100' : 'bg-[#27272a] text-[#71717a] hover:bg-[#3f3f46]'
                }`}
              >{risk.replace(/_/g, ' ')}</button>
            ))}
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="text-xs text-[#71717a]">Population: {population.toLocaleString()}</label>
              <input type="range" min={10000} max={5000000} step={10000} value={population}
                onChange={e => setPopulation(parseInt(e.target.value))} className="w-full mt-1" />
            </div>
            <div>
              <label className="text-xs text-[#71717a]">Budget/Capita: ${budget}</label>
              <input type="range" min={10} max={1000} step={10} value={budget}
                onChange={e => setBudget(parseInt(e.target.value))} className="w-full mt-1" />
            </div>
            <div>
              <label className="text-xs text-[#71717a]">Country</label>
              <select value={country} onChange={e => setCountry(e.target.value)}
                className="w-full mt-1 bg-[#27272a] rounded px-2 py-1 text-sm text-[#fafafa] border border-[#27272a]"
              >
                {['USA', 'Canada', 'UK', 'EU', 'Australia', 'Japan', 'International'].map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-[#27272a] pb-2 flex-wrap">
          {(['overview', 'measures', 'grants', 'commissions', 'plan'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-t-md text-sm font-medium capitalize ${tab === t ? 'bg-[#18181b] text-[#fafafa] border border-[#27272a] border-b-transparent' : 'text-[#71717a] hover:text-[#fafafa]'}`}
            >{t === 'commissions' ? 'Commission Tracker' : t === 'measures' ? 'Adaptation Measures' : t === 'grants' ? 'Grant Finder' : t === 'plan' ? 'Adaptation Plan' : t}</button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-2 border-zinc-500 border-t-transparent rounded-full" /></div>
        ) : (
          <>
            {tab === 'overview' && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-[#18181b] rounded-md p-5 border border-[#27272a]">
                  <DocumentTextIcon className="w-8 h-8 text-zinc-500 mb-3" />
                  <h3 className="font-semibold text-lg">Adaptation Catalog</h3>
                  <p className="text-[#71717a] text-sm mt-1">{measures.length} pre-built measures with cost/ROI data</p>
                  <button onClick={() => setTab('measures')} className="mt-3 text-zinc-400 text-sm hover:underline">Browse Measures →</button>
                </div>
                <div className="bg-[#18181b] rounded-md p-5 border border-[#27272a]">
                  <MagnifyingGlassIcon className="w-8 h-8 text-zinc-500 mb-3" />
                  <h3 className="font-semibold text-lg">Grant Matching</h3>
                  <p className="text-[#71717a] text-sm mt-1">25+ funding sources matched to your risk profile</p>
                  <button onClick={() => setTab('grants')} className="mt-3 text-zinc-400 text-sm hover:underline">Find Grants →</button>
                </div>
                <div className="bg-[#18181b] rounded-md p-5 border border-[#27272a]">
                  <CurrencyDollarIcon className="w-8 h-8 text-zinc-500 mb-3" />
                  <h3 className="font-semibold text-lg">Commission Tracker</h3>
                  <p className="text-[#71717a] text-sm mt-1">7% commission on successful grant applications</p>
                  <div className="mt-3 text-xl font-bold text-zinc-500">
                    ${commissions?.total_potential_commission_m?.toFixed(2) || '0.00'}M potential
                  </div>
                </div>
              </div>
            )}

            {tab === 'measures' && (
              <div className="space-y-3">
                {measures.length === 0 && (
                  <div className="bg-[#18181b] rounded-md p-8 border border-[#27272a] text-center">
                    <p className="text-[#71717a] mb-3">No measures. Adjust filters or Retry.</p>
                    <button onClick={() => fetchRecommendations()} className="px-4 py-2 bg-zinc-500 hover:bg-zinc-400 rounded-md text-sm font-medium text-zinc-100">Load Recommendations</button>
                  </div>
                )}
                {measures.map(m => (
                  <motion.div key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="bg-[#18181b] rounded-md p-4 border border-[#27272a]"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-medium">{m.name}</div>
                        <div className="text-sm text-[#71717a]">{m.description}</div>
                      </div>
                      {m.relevance_score !== undefined && (
                        <div className="text-right">
                          <div className="text-lg font-bold text-zinc-400">{m.relevance_score.toFixed(1)}</div>
                          <div className="text-xs text-[#52525b]">relevance</div>
                        </div>
                      )}
                    </div>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      <div className="bg-[#27272a]/50 rounded p-2 text-center">
                        <div className="text-xs text-[#71717a]">Cost/Capita</div>
                        <div className="font-semibold">${m.cost_per_capita}</div>
                      </div>
                      <div className="bg-[#27272a]/50 rounded p-2 text-center">
                        <div className="text-xs text-[#71717a]">Effectiveness</div>
                        <div className="font-semibold">{m.effectiveness_pct}%</div>
                      </div>
                      <div className="bg-[#27272a]/50 rounded p-2 text-center">
                        <div className="text-xs text-[#71717a]">ROI</div>
                        <div className="font-semibold text-risk-low">{m.roi_multiplier}x</div>
                      </div>
                      <div className="bg-[#27272a]/50 rounded p-2 text-center">
                        <div className="text-xs text-[#71717a]">Timeline</div>
                        <div className="font-semibold">{m.implementation_months}mo</div>
                      </div>
                    </div>
                    {m.total_cost_m !== undefined && (
                      <div className="text-sm text-[#71717a]">
                        Total: ${m.total_cost_m?.toFixed(1)}M | Expected Savings: ${m.expected_savings_m?.toFixed(1)}M
                        {m.affordable === false && <span className="text-risk-high ml-2">(over budget)</span>}
                      </div>
                    )}
                    <div className="flex flex-wrap gap-1 mt-2">
                      {(m.risks_matched || m.climate_risks_addressed || []).map(r => (
                        <span key={r} className="px-2 py-0.5 bg-zinc-500/20 text-zinc-400 rounded text-xs">{r}</span>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {tab === 'grants' && (
              <div className="space-y-3">
                {grants.length === 0 && (
                  <div className="bg-[#18181b] rounded-md p-8 border border-[#27272a] text-center">
                    <p className="text-[#71717a] mb-3">No grants matched. Adjust risk profile or Retry.</p>
                    <button onClick={() => fetchMatchedGrants()} className="px-4 py-2 bg-zinc-500 hover:bg-zinc-400 rounded-md text-sm font-medium text-zinc-100">Find Grants</button>
                  </div>
                )}
                {grants.map(g => (
                  <motion.div key={g.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="bg-[#18181b] rounded-md p-4 border border-[#27272a]"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="font-medium">{g.name}</div>
                        <div className="text-sm text-[#71717a]">{g.agency} • {g.country}</div>
                        <div className="text-xs text-[#52525b] mt-1">{g.description}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-lg font-bold text-risk-low">${g.max_award_m}M</div>
                        <div className="text-xs text-[#52525b]">max award</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-2 mb-2">
                      <div className="bg-[#27272a]/50 rounded p-2 text-center">
                        <div className="text-xs text-[#71717a]">Match Req.</div>
                        <div className="font-semibold">{g.match_required_pct}%</div>
                      </div>
                      <div className="bg-[#27272a]/50 rounded p-2 text-center">
                        <div className="text-xs text-[#71717a]">Success Rate</div>
                        <div className="font-semibold">{g.success_rate_pct}%</div>
                      </div>
                      <div className="bg-[#27272a]/50 rounded p-2 text-center">
                        <div className="text-xs text-[#71717a]">Deadline</div>
                        <div className="font-semibold text-xs">{g.deadline}</div>
                      </div>
                      <div className="bg-[#27272a]/50 rounded p-2 text-center">
                        <div className="text-xs text-[#71717a]">Commission</div>
                        <div className="font-semibold text-zinc-500">${g.estimated_commission_m?.toFixed(3)}M</div>
                      </div>
                    </div>
                    {g.match_score !== undefined && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#71717a]">Match Score:</span>
                        <div className="flex-1 h-2 bg-[#27272a] rounded-full overflow-hidden">
                          <div className="h-full bg-zinc-500 rounded-full" style={{ width: `${Math.min(100, g.match_score * 100)}%` }} />
                        </div>
                        <span className="text-sm">{g.match_score.toFixed(2)}</span>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}

            {tab === 'plan' && (
              <div className="space-y-4">
                <div className="bg-[#18181b] rounded-md p-5 border border-[#27272a]">
                  <h3 className="text-lg font-semibold mb-2">Portfolio optimizer (constraint: budget)</h3>
                  <p className="text-[#71717a] text-sm mb-4">Maximize risk reduction within budget. Measures below are ranked by urgency (shorter timeline = higher urgency).</p>
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span className="text-sm text-[#71717a]">Budget/capita: ${budget}</span>
                    <span className="text-sm text-[#71717a]">Population: {population.toLocaleString()}</span>
                    <button onClick={() => fetchRecommendations()} className="px-3 py-1.5 rounded-md bg-zinc-600 hover:bg-zinc-500 text-zinc-100 text-sm font-medium">Re-optimize</button>
                  </div>
                  <a href="/command" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
                    <MapPinIcon className="w-4 h-4" />
                    View risk by H3 hex on globe
                  </a>
                </div>
                <div className="bg-[#18181b] rounded-md p-5 border border-[#27272a]">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Timeline by urgency (shortest first)</h3>
                  <div className="space-y-2">
                    {[...measures]
                      .sort((a, b) => a.implementation_months - b.implementation_months)
                      .map((m, i) => (
                        <div key={m.id} className="flex items-center gap-4 py-2 border-b border-[#27272a] last:border-0">
                          <span className="text-xs text-[#52525b] w-6">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-zinc-200">{m.name}</div>
                            <div className="text-xs text-[#71717a]">{m.implementation_months} months • ${m.cost_per_capita}/capita • {m.effectiveness_pct}% effectiveness</div>
                          </div>
                          <div className="shrink-0 text-right">
                            <span className="px-2 py-0.5 rounded bg-[#27272a] text-xs text-zinc-400">{m.implementation_months}mo</span>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {tab === 'commissions' && commissions && (
              <div className="bg-[#18181b] rounded-md p-5 border border-[#27272a]">
                <h3 className="text-lg font-semibold mb-4">Commission Tracking (7% per Successful Grant)</h3>
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <div className="bg-[#27272a]/50 rounded-md p-4 text-center">
                    <div className="text-[#71717a] text-xs">Total Potential</div>
                    <div className="text-2xl font-bold text-zinc-500">${commissions.total_potential_commission_m?.toFixed(2)}M</div>
                  </div>
                  <div className="bg-[#27272a]/50 rounded-md p-4 text-center">
                    <div className="text-[#71717a] text-xs">Approved</div>
                    <div className="text-2xl font-bold text-risk-low">${commissions.approved_commission_m?.toFixed(2)}M</div>
                  </div>
                  <div className="bg-[#27272a]/50 rounded-md p-4 text-center">
                    <div className="text-[#71717a] text-xs">Pending</div>
                    <div className="text-2xl font-bold text-zinc-400">${commissions.pending_commission_m?.toFixed(2)}M</div>
                  </div>
                </div>
                <div className="space-y-2">
                  {Object.entries(commissions.by_status || {}).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between bg-[#27272a]/50 rounded-md p-3">
                      <span className="capitalize text-[#71717a]">{status.replace(/_/g, ' ')}</span>
                      <span className="font-bold">{count as number}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </AccessGate>
  )
}
