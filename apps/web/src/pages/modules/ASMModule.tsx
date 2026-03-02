/**
 * ASM Module - Nuclear Safety & Monitoring
 *
 * Nuclear reactor registry, escalation ladder, nuclear winter simulation,
 * and nuclear arsenal overview.
 */
import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ShieldCheckIcon,
  PlayIcon,
} from '@heroicons/react/24/outline'
import { getModuleById } from '../../lib/modules'
import AccessGate from '../../components/modules/AccessGate'
import { getApiV1Base } from '../../config/env'

interface Reactor {
  id: string; name: string; country: string; type: string
  capacity_mw: number; status: string; commission_year: number
  risk_factors: string[]
}

interface NuclearState {
  country: string; estimated_warheads: number; deployed: number
  icbm_capable: boolean; slbm_capable: boolean
}

interface EscalationLevel {
  level: number; name: string; description: string; p_next: number
}

export default function ASMModule() {
  const navigate = useNavigate()
  const module = getModuleById('asm')
  const [loading, setLoading] = useState(true)
  const [reactors, setReactors] = useState<Reactor[]>([])
  const [nuclearStates, setNuclearStates] = useState<NuclearState[]>([])
  const [escalation, setEscalation] = useState<EscalationLevel[]>([])
  const [totalCapacity, setTotalCapacity] = useState(0)
  const [totalWarheads, setTotalWarheads] = useState(0)
  const [tab, setTab] = useState<'reactors' | 'arsenal' | 'escalation' | 'winter'>('reactors')
  const [winterResult, setWinterResult] = useState<Record<string, any> | null>(null)
  const [winterParams, setWinterParams] = useState({ warheads: 100, yield_kt: 100 })
  const [winterLoading, setWinterLoading] = useState(false)
  const [demoDataUsed, setDemoDataUsed] = useState(false)

  const setDemoData = useCallback(() => {
    setReactors([
      { id: 'nr_001', name: 'Zaporizhzhia NPP', country: 'Ukraine', type: 'VVER-1000', capacity_mw: 5700, status: 'operational', commission_year: 1984, risk_factors: ['conflict_zone', 'aging'] },
      { id: 'nr_002', name: 'Bruce Power', country: 'Canada', type: 'CANDU', capacity_mw: 6384, status: 'operational', commission_year: 1977, risk_factors: ['aging'] },
      { id: 'nr_003', name: 'Kashiwazaki-Kariwa', country: 'Japan', type: 'BWR', capacity_mw: 7965, status: 'operational', commission_year: 1985, risk_factors: ['seismic_zone'] },
    ])
    setTotalCapacity(20)
    setNuclearStates([
      { country: 'USA', estimated_warheads: 5244, deployed: 1670, icbm_capable: true, slbm_capable: true },
      { country: 'Russia', estimated_warheads: 5889, deployed: 1625, icbm_capable: true, slbm_capable: true },
    ])
    setTotalWarheads(11127)
    setEscalation([
      { level: 1, name: 'Routine', description: 'No nuclear threat', p_next: 0.01 },
      { level: 4, name: 'Nuclear threat', description: 'Explicit nuclear warning', p_next: 0.1 },
      { level: 6, name: 'Limited strike', description: 'Tactical nuclear use', p_next: 0.3 },
    ])
  }, [])

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    setDemoDataUsed(false)
    try {
      const res = await fetch(`${getApiV1Base()}/asm/dashboard`)
      if (res.ok) {
        const data = await res.json()
        setReactors(data.reactors?.registry || [])
        setTotalCapacity(data.reactors?.total_capacity_gw || 0)
        setNuclearStates(data.nuclear_weapons?.states || [])
        setTotalWarheads(data.nuclear_weapons?.total_warheads || 0)
        setEscalation(data.escalation_ladder || [])
      } else {
        setDemoDataUsed(true)
        setDemoData()
      }
    } catch (err) {
      console.error('ASM dashboard error:', err)
      setDemoDataUsed(true)
      setDemoData()
    } finally {
      setLoading(false)
    }
  }, [setDemoData])

  const runWinterSim = useCallback(async () => {
    setWinterLoading(true)
    try {
      const res = await fetch(`${getApiV1Base()}/asm/simulate/nuclear-winter`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ warheads_used: winterParams.warheads, yield_kt_avg: winterParams.yield_kt, target_type: 'mixed' }),
      })
      if (res.ok) setWinterResult(await res.json())
    } catch (err) {
      console.error('Nuclear winter sim error:', err)
    } finally {
      setWinterLoading(false)
    }
  }, [winterParams])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])

  return (
    <AccessGate moduleId="asm">
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900/95 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/modules')} className="p-2 rounded-md hover:bg-zinc-800 transition-colors" title="Back to Strategic Modules">
                <ArrowLeftIcon className="w-5 h-5 text-zinc-400" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                  <ShieldCheckIcon className="w-6 h-6 text-zinc-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-semibold text-zinc-100">{module?.fullName || 'Nuclear Safety & Monitoring'}</h1>
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
              Demo data — API unavailable or returned non-OK. Showing fallback reactor and arsenal data for demonstration.
            </div>
          )}
        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mb-6">
          <div className="bg-zinc-900 rounded-md p-4 border border-zinc-800">
            <div className="text-zinc-500 text-xs">Reactors Tracked</div>
            <div className="text-2xl font-semibold text-zinc-100 mt-1">{reactors.length}</div>
          </div>
          <div className="bg-zinc-900 rounded-md p-4 border border-zinc-800">
            <div className="text-zinc-500 text-xs">Total Capacity</div>
            <div className="text-2xl font-semibold text-zinc-100 mt-1">{totalCapacity} GW</div>
          </div>
          <div className="bg-zinc-900 rounded-md p-4 border border-risk-high/30">
            <div className="text-zinc-500 text-xs">Total Warheads</div>
            <div className="text-2xl font-semibold text-risk-high mt-1">{totalWarheads.toLocaleString()}</div>
          </div>
          <div className="bg-zinc-900 rounded-md p-4 border border-zinc-800">
            <div className="text-zinc-500 text-xs">Nuclear States</div>
            <div className="text-2xl font-semibold text-zinc-100 mt-1">{nuclearStates.length}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-zinc-800 pb-2">
          {(['reactors', 'arsenal', 'escalation', 'winter'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-t-md text-sm font-medium ${tab === t ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 border-b-transparent' : 'text-zinc-400 hover:text-zinc-200'}`}
            >{t === 'winter' ? 'Nuclear Winter Sim' : t}</button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-2 border-zinc-500 border-t-transparent rounded-full" /></div>
        ) : (
          <>
            {tab === 'reactors' && (
              <div className="space-y-3">
                {reactors.length === 0 && (
                  <div className="bg-zinc-900 rounded-md p-8 border border-zinc-800 text-center">
                    <p className="text-zinc-400 mb-3">No reactor data. Check API connection.</p>
                    <button onClick={fetchDashboard} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-md text-sm font-medium text-zinc-100 border border-zinc-600">Retry</button>
                  </div>
                )}
                {reactors.map(r => (
                  <div key={r.id} className="bg-zinc-900 rounded-md p-4 border border-zinc-800 flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${r.status === 'operational' ? 'bg-risk-low' : r.status === 'under_construction' ? 'bg-risk-medium' : 'bg-zinc-500'}`} />
                    <div className="flex-1">
                      <div className="font-medium text-zinc-100">{r.name}</div>
                      <div className="text-sm text-zinc-400">{r.country} • {r.type} • {r.capacity_mw} MW</div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(r.risk_factors || []).map(f => (
                        <span key={f} className="px-2 py-0.5 bg-risk-high/20 text-risk-high rounded text-xs">{f}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'arsenal' && (
              <div className="space-y-3">
                {nuclearStates.sort((a, b) => b.estimated_warheads - a.estimated_warheads).map(s => (
                  <div key={s.country} className="bg-zinc-900 rounded-md p-4 border border-zinc-800">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium text-zinc-100">{s.country}</span>
                      <span className="text-lg font-semibold text-zinc-100">{s.estimated_warheads.toLocaleString()}</span>
                    </div>
                    <div className="h-2 bg-zinc-800 rounded-full overflow-hidden mb-2">
                      <div className="h-full bg-zinc-500 rounded-full" style={{ width: `${(s.estimated_warheads / 6257) * 100}%` }} />
                    </div>
                    <div className="flex gap-3 text-xs text-zinc-400">
                      <span>Deployed: {s.deployed}</span>
                      {s.icbm_capable && <span className="text-zinc-500">ICBM</span>}
                      {s.slbm_capable && <span className="text-zinc-400">SLBM</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'escalation' && (
              <div className="space-y-2">
                {escalation.map(e => (
                  <div key={e.level} className={`bg-zinc-900 rounded-md p-4 border ${
                    e.level >= 6 ? 'border-risk-critical/50' : e.level >= 4 ? 'border-risk-high/50' : 'border-zinc-800'
                  }`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-zinc-100 ${
                          e.level >= 6 ? 'bg-risk-critical' : e.level >= 4 ? 'bg-risk-high' : e.level >= 2 ? 'bg-risk-medium' : 'bg-zinc-500'
                        }`}>{e.level}</div>
                        <div>
                          <div className="font-medium text-zinc-100">{e.name}</div>
                          <div className="text-sm text-zinc-400">{e.description}</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-zinc-200">{(e.p_next * 100).toFixed(0)}%</div>
                        <div className="text-xs text-zinc-500">P(next level)</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {tab === 'winter' && (
              <div className="space-y-4">
                <div className="bg-zinc-900 rounded-md p-5 border border-zinc-800">
                  <h3 className="text-base font-semibold text-zinc-200 mb-4">Nuclear Winter Simulation</h3>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <label className="text-xs text-zinc-400">Warheads Used: {winterParams.warheads}</label>
                      <input type="range" min={1} max={5000} step={10} value={winterParams.warheads}
                        onChange={e => setWinterParams(p => ({ ...p, warheads: parseInt(e.target.value) }))} className="w-full mt-1" />
                    </div>
                    <div>
                      <label className="text-xs text-zinc-400">Avg Yield (kt): {winterParams.yield_kt}</label>
                      <input type="range" min={10} max={5000} step={10} value={winterParams.yield_kt}
                        onChange={e => setWinterParams(p => ({ ...p, yield_kt: parseInt(e.target.value) }))} className="w-full mt-1" />
                    </div>
                  </div>
                  <button onClick={runWinterSim} disabled={winterLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-md text-sm font-medium text-zinc-100 border border-zinc-600 disabled:opacity-50"
                  ><PlayIcon className="w-4 h-4" />{winterLoading ? 'Simulating...' : 'Simulate Nuclear Winter'}</button>
                </div>

                {winterResult && (
                  <div className="bg-zinc-900 rounded-md p-5 border border-zinc-800">
                    <h3 className="text-base font-semibold text-zinc-200 mb-4">
                      Classification: <span className={winterResult.classification === 'nuclear_winter' ? 'text-risk-high' : 'text-risk-medium'}>
                        {winterResult.classification?.replace(/_/g, ' ').toUpperCase()}
                      </span>
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                      <div className="bg-zinc-800/50 rounded-md p-3 text-center border border-zinc-700">
                        <div className="text-xs text-zinc-400">Peak Temp Drop</div>
                        <div className="text-lg font-semibold text-zinc-300">{winterResult.effects?.peak_temp_drop_c}°C</div>
                      </div>
                      <div className="bg-zinc-800/50 rounded-md p-3 text-center border border-zinc-700">
                        <div className="text-xs text-zinc-400">Crop Loss</div>
                        <div className="text-lg font-semibold text-risk-medium">{winterResult.effects?.crop_loss_pct}%</div>
                      </div>
                      <div className="bg-zinc-800/50 rounded-md p-3 text-center border border-zinc-700">
                        <div className="text-xs text-zinc-400">Famine Deaths</div>
                        <div className="text-lg font-semibold text-risk-high">{winterResult.effects?.estimated_famine_deaths_billions}B</div>
                      </div>
                      <div className="bg-zinc-800/50 rounded-md p-3 text-center border border-zinc-700">
                        <div className="text-xs text-zinc-400">Recovery</div>
                        <div className="text-lg font-semibold text-zinc-100">{winterResult.effects?.years_to_full_recovery}y</div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {winterResult.timeline?.map((t: any) => (
                        <div key={t.year} className="flex items-center gap-2 text-sm">
                          <span className="w-12 text-zinc-500">Y+{t.year}</span>
                          <div className="flex-1 h-4 bg-zinc-800 rounded overflow-hidden">
                            <div className="h-full bg-zinc-500 rounded" style={{ width: `${Math.max(2, Math.abs(t.temp_change_c) * 10)}%` }} />
                          </div>
                          <span className="w-16 text-right text-zinc-300">{t.temp_change_c}°C</span>
                          <span className="w-20 text-right text-zinc-400">{t.crop_production_pct}% crops</span>
                        </div>
                      ))}
                    </div>
                  </div>
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
