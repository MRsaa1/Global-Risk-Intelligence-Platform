/**
 * ERF Module - Existential Risk Framework
 *
 * X-Risk dashboard with extinction probability timeline,
 * domain risk contributions, cross-domain correlations,
 * and longtermist cost-effectiveness analysis.
 */
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'
import { getModuleById } from '../../lib/modules'
import AccessGate from '../../components/modules/AccessGate'
import { getApiV1Base } from '../../config/env'

interface DomainContribution {
  domain: string
  probability: number
  confidence: number
  source_module: string
  key_drivers: string[]
}

interface Correlation {
  domain_a: string
  domain_b: string
  correlation: number
  mechanism: string
}

interface TimelinePoint {
  target_year: number
  p_extinction: number
  p_catastrophe: number
  tier: string
}

// Corporate palette: primary #0056e6, accent #C9A962, risk semantic
const TIER_COLORS: Record<string, string> = {
  X: 'bg-risk-critical',
  '1': 'bg-risk-high',
  '2': 'bg-risk-medium',
  '3': 'bg-zinc-500',
  M: 'bg-risk-low',
}

const TIER_LABELS: Record<string, string> = {
  X: 'Extinction-Level',
  '1': 'Catastrophic',
  '2': 'Severe',
  '3': 'Elevated',
  M: 'Monitoring',
}

const DOMAIN_COLORS: Record<string, string> = {
  agi: '#0056e6',
  biosecurity: '#52525b',
  nuclear: '#71717a',
  climate: '#0056e6',
  financial: '#C9A962',
}

export default function ERFModule() {
  const navigate = useNavigate()
  const module = getModuleById('erf')
  const [loading, setLoading] = useState(true)
  const [domains, setDomains] = useState<DomainContribution[]>([])
  const [correlations, setCorrelations] = useState<Correlation[]>([])
  const [timeline, setTimeline] = useState<TimelinePoint[]>([])
  const [currentTier, setCurrentTier] = useState('M')
  const [tab, setTab] = useState<'overview' | 'domains' | 'correlations' | 'longtermist'>('overview')
  const [longtermist, setLongtermist] = useState<Record<string, any> | null>(null)
  const [demoDataUsed, setDemoDataUsed] = useState(false)

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    setDemoDataUsed(false)
    try {
      const res = await fetch(`${getApiV1Base()}/erf/dashboard`)
      if (res.ok) {
        setDemoDataUsed(false)
        const data = await res.json()
        setDomains(data.domains || [])
        setCorrelations(data.correlations || [])
        setTimeline(data.timeline || [])
        setCurrentTier(data.current_tier || 'M')
      } else {
        setDemoDataUsed(true)
        // Demo fallback when API unavailable
        setDomains([
          { domain: 'agi', probability: 0.1, confidence: 0.3, source_module: 'ASGI', key_drivers: ['Alignment failure'] },
          { domain: 'biosecurity', probability: 0.03, confidence: 0.4, source_module: 'BIOSEC', key_drivers: ['Engineered pathogens'] },
          { domain: 'nuclear', probability: 0.01, confidence: 0.5, source_module: 'ASM', key_drivers: ['Escalation'] },
          { domain: 'climate', probability: 0.005, confidence: 0.6, source_module: 'climate', key_drivers: ['Tipping points'] },
          { domain: 'financial', probability: 0.002, confidence: 0.5, source_module: 'SRO', key_drivers: ['Contagion'] },
        ])
        setCorrelations([
          { domain_a: 'agi', domain_b: 'financial', correlation: 0.4, mechanism: 'Algorithmic cascades' },
          { domain_a: 'nuclear', domain_b: 'climate', correlation: 0.6, mechanism: 'Nuclear winter' },
        ])
        setTimeline([
          { target_year: 2030, p_extinction: 0.0001, p_catastrophe: 0.001, tier: '3' },
          { target_year: 2050, p_extinction: 0.0003, p_catastrophe: 0.003, tier: '2' },
          { target_year: 2100, p_extinction: 0.001, p_catastrophe: 0.01, tier: '1' },
        ])
        setCurrentTier('M')
      }
    } catch (err) {
      console.error('ERF dashboard fetch error:', err)
      setDemoDataUsed(true)
      // Demo fallback on network error
      setDomains([
        { domain: 'agi', probability: 0.1, confidence: 0.3, source_module: 'ASGI', key_drivers: ['Alignment failure'] },
        { domain: 'biosecurity', probability: 0.03, confidence: 0.4, source_module: 'BIOSEC', key_drivers: ['Engineered pathogens'] },
        { domain: 'nuclear', probability: 0.01, confidence: 0.5, source_module: 'ASM', key_drivers: ['Escalation'] },
        { domain: 'climate', probability: 0.005, confidence: 0.6, source_module: 'climate', key_drivers: ['Tipping points'] },
        { domain: 'financial', probability: 0.002, confidence: 0.5, source_module: 'SRO', key_drivers: ['Contagion'] },
      ])
      setCorrelations([
        { domain_a: 'agi', domain_b: 'financial', correlation: 0.4, mechanism: 'Algorithmic cascades' },
        { domain_a: 'nuclear', domain_b: 'climate', correlation: 0.6, mechanism: 'Nuclear winter' },
      ])
      setTimeline([
        { target_year: 2030, p_extinction: 0.0001, p_catastrophe: 0.001, tier: '3' },
        { target_year: 2050, p_extinction: 0.0003, p_catastrophe: 0.003, tier: '2' },
        { target_year: 2100, p_extinction: 0.001, p_catastrophe: 0.01, tier: '1' },
      ])
      setCurrentTier('M')
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchLongtermist = useCallback(async () => {
    try {
      const res = await fetch(`${getApiV1Base()}/erf/longtermist-analysis`)
      if (res.ok) {
        setLongtermist(await res.json())
      } else {
        setLongtermist({
          current_p_extinction: 0.001,
          reduced_p_extinction: 0.0008,
          expected_lives_saved: '1.00e+12',
          cost_per_expected_life_usd: 0.01,
          recommendation: 'highly_cost_effective',
        })
      }
    } catch (err) {
      console.error('Longtermist analysis error:', err)
      setLongtermist({
        current_p_extinction: 0.001,
        reduced_p_extinction: 0.0008,
        expected_lives_saved: '1.00e+12',
        cost_per_expected_life_usd: 0.01,
        recommendation: 'highly_cost_effective',
      })
    }
  }, [])

  useEffect(() => {
    fetchDashboard()
  }, [fetchDashboard])

  useEffect(() => {
    if (tab === 'longtermist' && !longtermist) fetchLongtermist()
  }, [tab, longtermist, fetchLongtermist])

  return (
    <AccessGate moduleId="erf">
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900/95 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/modules')} className="p-2 rounded-md hover:bg-zinc-800 transition-colors" title="Back to Strategic Modules">
                <ArrowLeftIcon className="w-5 h-5 text-zinc-400" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                  <ExclamationTriangleIcon className="w-6 h-6 text-zinc-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-semibold text-zinc-100">{module?.fullName || 'Existential Risk Framework'}</h1>
                    <span className="text-zinc-500 text-xs">Phase {module?.phase ?? 1}</span>
                    <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 text-[10px] rounded border border-zinc-700">{module?.priority ?? 'P0'}</span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">{module?.description}</p>
                </div>
              </div>
            </div>
            <button onClick={fetchDashboard} className="p-2 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 transition-colors" title="Refresh">
              <ArrowPathIcon className="w-5 h-5 text-zinc-400" />
            </button>
          </div>
        </header>

        <main className="p-6 w-full max-w-full">
        {demoDataUsed && (
          <div className="mb-4 p-3 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-200 text-xs">
            Demo data — API unavailable or returned non-OK. Showing fallback values for demonstration.
          </div>
        )}
        {/* Current Risk Tier Banner */}
        <motion.div
          initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-md bg-zinc-900 border border-zinc-800"
        >
          <div className="flex items-center justify-between">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Current Global Risk Tier</span>
              <div className="text-2xl font-semibold text-zinc-100 mt-1">
                Tier {currentTier} — {TIER_LABELS[currentTier] || 'Unknown'}
              </div>
            </div>
            <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-semibold text-zinc-100 ${TIER_COLORS[currentTier] || 'bg-zinc-800'}`}>
              {currentTier}
            </div>
          </div>
        </motion.div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-zinc-800 pb-2">
          {(['overview', 'domains', 'correlations', 'longtermist'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-t-md text-sm font-medium capitalize ${tab === t ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 border-b-transparent' : 'text-zinc-400 hover:text-zinc-200'}`}
            >{t}</button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div className="animate-spin h-8 w-8 border-2 border-zinc-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <>
            {/* Overview Tab */}
            {tab === 'overview' && (
              <div className="space-y-6">
                {/* Extinction Probability Timeline */}
                <div className="bg-zinc-900 rounded-md p-5 border border-zinc-800">
                  <h3 className="text-base font-semibold text-zinc-200 mb-4 flex items-center gap-2">
                    <ChartBarIcon className="w-5 h-5 text-zinc-400" />
                    Extinction Probability Timeline
                  </h3>
                  <div className="grid grid-cols-5 gap-3">
                    {timeline.map(pt => (
                      <div key={pt.target_year} className="bg-zinc-800/50 rounded-md p-4 text-center border border-zinc-700">
                        <div className="text-zinc-400 text-sm">{pt.target_year}</div>
                        <div className="text-xl font-semibold text-zinc-100 mt-1">{(pt.p_extinction * 100).toFixed(2)}%</div>
                        <div className={`inline-block mt-2 px-2 py-0.5 rounded text-xs font-medium text-zinc-100 ${TIER_COLORS[pt.tier]}`}>
                          Tier {pt.tier}
                        </div>
                        <div className="text-zinc-500 text-xs mt-1">
                          P(catastrophe): {(pt.p_catastrophe * 100).toFixed(1)}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Domain Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                  {domains.map(d => (
                    <div key={d.domain} className="bg-zinc-900 rounded-md p-4 border border-zinc-800">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: DOMAIN_COLORS[d.domain] || 'rgb(113 113 122)' }} />
                        <span className="text-sm font-medium uppercase text-zinc-400">{d.domain}</span>
                      </div>
                      <div className="text-lg font-semibold text-zinc-100">{(d.probability * 100).toFixed(1)}%</div>
                      <div className="text-zinc-500 text-xs mt-1">
                        Source: {d.source_module} | Conf: {(d.confidence * 100).toFixed(0)}%
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Domains Tab */}
            {tab === 'domains' && (
              <div className="space-y-4">
                {domains.map(d => (
                  <div key={d.domain} className="bg-zinc-900 rounded-md p-5 border border-zinc-800">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full" style={{ backgroundColor: DOMAIN_COLORS[d.domain] || 'rgb(113 113 122)' }} />
                        <h3 className="text-base font-semibold text-zinc-100 uppercase">{d.domain}</h3>
                      </div>
                      <div className="text-xl font-semibold text-zinc-100">{(d.probability * 100).toFixed(2)}%</div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-zinc-400 mb-3">
                      <span>Module: {d.source_module}</span>
                      <span>Confidence: {(d.confidence * 100).toFixed(0)}%</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(d.key_drivers || []).map(driver => (
                        <span key={driver} className="px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-400">{driver}</span>
                      ))}
                    </div>
                    <div className="mt-3 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div className="h-full rounded-full" style={{
                        width: `${Math.min(100, d.probability * 1000)}%`,
                        backgroundColor: DOMAIN_COLORS[d.domain] || 'rgb(113 113 122)',
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Correlations Tab */}
            {tab === 'correlations' && (
              <div className="bg-zinc-900 rounded-md p-5 border border-zinc-800">
                <h3 className="text-base font-semibold text-zinc-200 mb-4">Cross-Domain Correlation Matrix</h3>
                <div className="space-y-3">
                  {correlations.map((c, i) => (
                    <div key={i} className="flex items-center gap-4 bg-zinc-800/50 rounded-md p-3 border border-zinc-700">
                      <div className="flex items-center gap-2 w-32">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: DOMAIN_COLORS[c.domain_a] || 'rgb(113 113 122)' }} />
                        <span className="text-sm uppercase text-zinc-400">{c.domain_a}</span>
                      </div>
                      <span className="text-zinc-500">↔</span>
                      <div className="flex items-center gap-2 w-32">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: DOMAIN_COLORS[c.domain_b] || 'rgb(113 113 122)' }} />
                        <span className="text-sm uppercase text-zinc-400">{c.domain_b}</span>
                      </div>
                      <div className="flex-1">
                        <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                          <div className="h-full bg-zinc-500 rounded-full" style={{ width: `${c.correlation * 100}%` }} />
                        </div>
                      </div>
                      <span className="text-sm text-zinc-300 w-12 text-right">{c.correlation.toFixed(2)}</span>
                      <span className="text-xs text-zinc-500 flex-1">{c.mechanism}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Longtermist Tab */}
            {tab === 'longtermist' && (
              <div className="bg-zinc-900 rounded-md p-5 border border-zinc-800">
                <h3 className="text-base font-semibold text-zinc-200 mb-4">Longtermist Cost-Effectiveness Analysis</h3>
                {!longtermist ? (
                  <div className="py-8 text-center">
                    <p className="text-zinc-400 mb-4">Loading longtermist analysis...</p>
                    <button onClick={fetchLongtermist} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-md text-sm font-medium text-zinc-100 border border-zinc-600">
                      Load Analysis
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                      <div className="bg-zinc-800/50 rounded-md p-4 border border-zinc-700">
                        <div className="text-zinc-400 text-xs">Current P(extinction)</div>
                        <div className="text-lg font-semibold text-zinc-100 mt-1">{(longtermist.current_p_extinction * 100).toFixed(3)}%</div>
                      </div>
                      <div className="bg-zinc-800/50 rounded-md p-4 border border-zinc-700">
                        <div className="text-zinc-400 text-xs">Reduced P(extinction)</div>
                        <div className="text-lg font-semibold text-risk-low mt-1">{(longtermist.reduced_p_extinction * 100).toFixed(3)}%</div>
                      </div>
                      <div className="bg-zinc-800/50 rounded-md p-4 border border-zinc-700">
                        <div className="text-zinc-400 text-xs">Expected Lives Saved</div>
                        <div className="text-lg font-semibold text-zinc-300 mt-1">{longtermist.expected_lives_saved}</div>
                      </div>
                      <div className="bg-zinc-800/50 rounded-md p-4 border border-zinc-700">
                        <div className="text-zinc-400 text-xs">Cost Per Expected Life</div>
                        <div className="text-lg font-semibold text-zinc-100 mt-1">${longtermist.cost_per_expected_life_usd?.toFixed(4)}</div>
                      </div>
                    </div>
                    <div className={`p-3 rounded-md text-center text-sm font-medium ${
                      longtermist.recommendation === 'highly_cost_effective' ? 'bg-zinc-700/50 text-zinc-300 border border-zinc-600' :
                      longtermist.recommendation === 'cost_effective' ? 'bg-zinc-700/50 text-zinc-300 border border-zinc-600' :
                      'bg-zinc-800 text-zinc-400 border border-zinc-700'
                    }`}>
                      Recommendation: {longtermist.recommendation?.replace(/_/g, ' ').toUpperCase()}
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
        </main>
      </div>
    </AccessGate>
  )
}
