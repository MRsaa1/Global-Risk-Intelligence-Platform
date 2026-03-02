/**
 * BIOSEC Module - Biosecurity & Pandemic
 *
 * BSL-4 lab map, pandemic spread simulation, airport network visualization,
 * and pathogen risk assessment.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d'
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  BeakerIcon,
  PlayIcon,
} from '@heroicons/react/24/outline'
import { getModuleById } from '../../lib/modules'
import AccessGate from '../../components/modules/AccessGate'
import { getApiV1Base } from '../../config/env'

interface Lab {
  id: string; name: string; country: string; city: string
  lat: number; lng: number; status: string; risk_rating: number
  research_focus: string[]
}

interface PandemicDay {
  day: number; susceptible: number; infected: number
  recovered: number; dead: number; r_effective: number
}

interface SpreadNetworkNode {
  id: string
  label: string
  lat: number
  lng: number
  size: number
  type: 'airport' | 'bsl4_lab'
  risk_rating?: number
}

interface SpreadNetworkEdge {
  source: string
  target: string
  weight: number
  distance_km: number
}

function SpreadNetworkGraph({
  data,
  graphRef,
}: {
  data: { nodes: SpreadNetworkNode[]; edges: SpreadNetworkEdge[] }
  graphRef: React.RefObject<ForceGraphMethods | undefined>
}) {
  const graphData = useMemo(() => ({
    nodes: data.nodes,
    links: data.edges.map((e) => ({ source: e.source, target: e.target, weight: e.weight, distance_km: e.distance_km })),
  }), [data])

  useEffect(() => {
    if (graphRef.current && graphData.nodes.length > 0) {
      graphRef.current.d3Force('charge')?.strength(-90)
      graphRef.current.d3Force('link')?.distance(320)
    }
  }, [graphData, graphRef])

  const nodeCanvasObject = useCallback(
    (node: SpreadNetworkNode & { x?: number; y?: number }, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = node.x ?? 0
      const y = node.y ?? 0
      const isLab = node.type === 'bsl4_lab'
      const r = isLab ? Math.max(2, 6 / globalScale) : Math.max(1.5, Math.min(4, (node.size || 30) / 30) / globalScale)
      ctx.beginPath()
      ctx.arc(x, y, r, 0, 2 * Math.PI)
      ctx.fillStyle = isLab ? 'rgba(245, 158, 11, 0.9)' : 'rgba(14, 165, 233, 0.85)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'
      ctx.lineWidth = 1
      ctx.stroke()
      if (globalScale > 0.5) {
        const label = (node.label || node.id).slice(0, 20) + ((node.label || node.id).length > 20 ? '…' : '')
        ctx.font = `${10 / globalScale}px system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.fillText(label, x, y + r + 2)
      }
    },
    []
  )

  return (
    <div className="w-full rounded-md border border-zinc-700 bg-zinc-900 overflow-hidden" style={{ height: 960 }}>
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        nodeCanvasObject={nodeCanvasObject}
        linkColor={() => 'rgba(113, 113, 122, 0.5)'}
        linkWidth={0.8}
        nodeLabel={(n) => `${(n as SpreadNetworkNode).label || n.id} (${(n as SpreadNetworkNode).type})`}
      />
    </div>
  )
}

export default function BIOSECModule() {
  const navigate = useNavigate()
  const module = getModuleById('biosec')
  const [loading, setLoading] = useState(true)
  const [labs, setLabs] = useState<Lab[]>([])
  const [totalLabs, setTotalLabs] = useState(0)
  const [highRisk, setHighRisk] = useState(0)
  const [tab, setTab] = useState<'labs' | 'simulation' | 'network' | 'pathogen' | 'outbreaks'>('labs')
  const [simResult, setSimResult] = useState<PandemicDay[] | null>(null)
  const [whoData, setWhoData] = useState<any>(null)
  const [whoLoading, setWhoLoading] = useState(false)
  const [simParams, setSimParams] = useState({ r0: 3.0, ifr: 0.02, containment_day: 30, containment_effectiveness: 0.5 })
  const [simLoading, setSimLoading] = useState(false)
  const [demoDataUsed, setDemoDataUsed] = useState(false)
  const [spreadNetworkData, setSpreadNetworkData] = useState<{ nodes: SpreadNetworkNode[]; edges: SpreadNetworkEdge[] } | null>(null)
  const [spreadNetworkLoading, setSpreadNetworkLoading] = useState(false)
  const spreadGraphRef = useRef<ForceGraphMethods | undefined>()
  const [labRisks, setLabRisks] = useState<Record<string, { overall_risk: number; spread_risk_score: number; containment_rating: number; nearby_airports: { code: string; city: string; distance_km: number }[] }>>({})
  const [labRisksLoading, setLabRisksLoading] = useState(false)

  const setDemoLabs = useCallback(() => {
    const demo: Lab[] = [
      { id: 'bsl4_001', name: 'Wuhan Institute of Virology', country: 'China', city: 'Wuhan', lat: 30.37, lng: 114.26, status: 'operational', risk_rating: 0.7, research_focus: ['coronaviruses', 'bat_viruses'] },
      { id: 'bsl4_002', name: 'USAMRIID', country: 'USA', city: 'Fort Detrick', lat: 39.44, lng: -77.44, status: 'operational', risk_rating: 0.5, research_focus: ['biodefense', 'ebola'] },
      { id: 'bsl4_003', name: 'CDC BSL-4', country: 'USA', city: 'Atlanta', lat: 33.8, lng: -84.32, status: 'operational', risk_rating: 0.4, research_focus: ['ebola', 'smallpox'] },
      { id: 'bsl4_004', name: 'NIBSC', country: 'UK', city: 'London', lat: 51.67, lng: -0.19, status: 'operational', risk_rating: 0.3, research_focus: ['viral_hemorrhagic_fever'] },
    ]
    setLabs(demo)
    setTotalLabs(demo.length)
    setHighRisk(demo.filter(l => l.risk_rating >= 0.5).length)
  }, [])

  const fetchDashboard = useCallback(async () => {
    setLoading(true)
    setDemoDataUsed(false)
    try {
      const res = await fetch(`${getApiV1Base()}/biosec/dashboard`)
      if (res.ok) {
        const data = await res.json()
        setLabs(data.labs || [])
        setTotalLabs(data.total_labs ?? data.labs?.length ?? 0)
        setHighRisk(data.high_risk_labs ?? 0)
      } else {
        setDemoDataUsed(true)
        setDemoLabs()
      }
    } catch (err) {
      console.error('BIOSEC dashboard error:', err)
      setDemoDataUsed(true)
      setDemoLabs()
    } finally {
      setLoading(false)
    }
  }, [setDemoLabs])

  const runSimulation = useCallback(async () => {
    setSimLoading(true)
    try {
      const res = await fetch(`${getApiV1Base()}/biosec/simulate/pandemic`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          r0: simParams.r0, ifr: simParams.ifr,
          containment_day: simParams.containment_day,
          containment_effectiveness: simParams.containment_effectiveness,
          days: 365, population: 8e9, initial_infected: 100,
        }),
      })
      if (res.ok) {
        const data = await res.json()
        setSimResult(data.timeline || [])
      }
    } catch (err) {
      console.error('Pandemic sim error:', err)
    } finally {
      setSimLoading(false)
    }
  }, [simParams])

  const fetchWhoOutbreaks = useCallback(async () => {
    setWhoLoading(true)
    try {
      const res = await fetch(`${getApiV1Base()}/risk-engine/who/outbreaks?days_back=90`)
      if (res.ok) {
        setWhoData(await res.json())
      }
    } catch (err) {
      console.error('WHO outbreaks error:', err)
    } finally {
      setWhoLoading(false)
    }
  }, [])

  const fetchSpreadNetwork = useCallback(async () => {
    setSpreadNetworkLoading(true)
    try {
      const res = await fetch(`${getApiV1Base()}/biosec/spread-network`)
      if (res.ok) {
        const data = await res.json()
        setSpreadNetworkData({ nodes: data.nodes || [], edges: data.edges || [] })
      } else {
        setSpreadNetworkData(null)
      }
    } catch (err) {
      console.error('Spread network error:', err)
      setSpreadNetworkData(null)
    } finally {
      setSpreadNetworkLoading(false)
    }
  }, [])

  const fetchLabRisks = useCallback(async () => {
    if (labs.length === 0) return
    setLabRisksLoading(true)
    setLabRisks({})
    try {
      const results = await Promise.all(
        labs.slice(0, 30).map(async (lab) => {
          try {
            const res = await fetch(`${getApiV1Base()}/biosec/labs/${encodeURIComponent(lab.id)}/risk`)
            if (!res.ok) return { id: lab.id, data: null }
            const data = await res.json()
            if (data.error) return { id: lab.id, data: null }
            return {
              id: lab.id,
              data: {
                overall_risk: data.overall_risk ?? 0,
                spread_risk_score: data.spread_risk_score ?? 0,
                containment_rating: data.containment_rating ?? 0,
                nearby_airports: data.nearby_airports ?? [],
              },
            }
          } catch {
            return { id: lab.id, data: null }
          }
        })
      )
      const next: Record<string, { overall_risk: number; spread_risk_score: number; containment_rating: number; nearby_airports: { code: string; city: string; distance_km: number }[] }> = {}
      results.forEach((r) => { if (r.data) next[r.id] = r.data })
      setLabRisks(next)
    } finally {
      setLabRisksLoading(false)
    }
  }, [labs])

  useEffect(() => { fetchDashboard() }, [fetchDashboard])
  useEffect(() => { if (tab === 'outbreaks' && !whoData) fetchWhoOutbreaks() }, [tab, whoData, fetchWhoOutbreaks])
  useEffect(() => { if (tab === 'network' && !spreadNetworkData && !spreadNetworkLoading) fetchSpreadNetwork() }, [tab, spreadNetworkData, spreadNetworkLoading, fetchSpreadNetwork])
  useEffect(() => { if (tab === 'pathogen' && labs.length > 0 && Object.keys(labRisks).length === 0 && !labRisksLoading) fetchLabRisks() }, [tab, labs.length, labRisks, labRisksLoading, fetchLabRisks])

  const maxInfected = simResult ? Math.max(...simResult.map(d => d.infected)) : 0
  const totalDead = simResult && simResult.length > 0 ? simResult[simResult.length - 1].dead : 0

  return (
    <AccessGate moduleId="biosec">
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900/95 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/modules')} className="p-2 rounded-md hover:bg-zinc-800 transition-colors" title="Back to Strategic Modules">
                <ArrowLeftIcon className="w-5 h-5 text-zinc-400" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                  <BeakerIcon className="w-6 h-6 text-zinc-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-semibold text-zinc-100">{module?.fullName || 'Biosecurity & Pandemic Module'}</h1>
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
            Demo data — API unavailable or returned non-OK. Showing fallback BSL-4 lab list for demonstration.
          </div>
        )}
        {/* Stats Banner */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-zinc-900 rounded-md p-4 border border-zinc-800">
            <div className="text-zinc-500 text-xs">BSL-4 Laboratories</div>
            <div className="text-2xl font-semibold text-zinc-100 mt-1">{totalLabs}</div>
          </div>
          <div className="bg-zinc-900 rounded-md p-4 border border-risk-high/30">
            <div className="text-zinc-500 text-xs">High-Risk Labs</div>
            <div className="text-2xl font-semibold text-risk-high mt-1">{highRisk}</div>
          </div>
          <div className="bg-zinc-900 rounded-md p-4 border border-zinc-800">
            <div className="text-zinc-500 text-xs">Countries Monitored</div>
            <div className="text-2xl font-semibold text-zinc-100 mt-1">{new Set(labs.map(l => l.country)).size}</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-zinc-800 pb-2">
          {(['labs', 'simulation', 'network', 'pathogen', 'outbreaks'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-t-md text-sm font-medium ${tab === t ? 'bg-zinc-800 text-zinc-100 border border-zinc-700 border-b-transparent' : 'text-zinc-400 hover:text-zinc-200'}`}
            >{t === 'labs' ? 'BSL-4 Labs' : t === 'simulation' ? 'Pandemic Simulation' : t === 'network' ? 'Spread Network' : t === 'pathogen' ? 'Pathogen risk' : 'WHO Outbreaks'}</button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-2 border-zinc-500 border-t-transparent rounded-full" /></div>
        ) : (
          <>
            {tab === 'labs' && (
              <div className="space-y-3">
                {labs.length === 0 && (
                  <div className="bg-zinc-900 rounded-md p-8 border border-zinc-800 text-center">
                    <p className="text-zinc-400 mb-3">No BSL-4 labs data. Check API connection.</p>
                    <button onClick={fetchDashboard} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-md text-sm font-medium text-zinc-100 border border-zinc-600">Retry</button>
                  </div>
                )}
                {labs.map(lab => (
                  <motion.div key={lab.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="bg-zinc-900 rounded-md p-4 border border-zinc-800 flex items-center gap-4"
                  >
                    <div className={`w-3 h-3 rounded-full ${lab.risk_rating >= 0.5 ? 'bg-risk-high' : lab.risk_rating >= 0.3 ? 'bg-risk-medium' : 'bg-risk-low'}`} />
                    <div className="flex-1">
                      <div className="font-medium text-zinc-100">{lab.name}</div>
                      <div className="text-sm text-zinc-400">{lab.city}, {lab.country}</div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {(lab.research_focus || []).map(f => (
                        <span key={f} className="px-2 py-0.5 bg-zinc-800 rounded text-xs text-zinc-400">{f}</span>
                      ))}
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-zinc-200">{(lab.risk_rating * 100).toFixed(0)}%</div>
                      <div className="text-xs text-zinc-500">risk</div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}

            {tab === 'simulation' && (
              <div className="space-y-4">
                <div className="bg-zinc-900 rounded-md p-5 border border-zinc-800">
                  <h3 className="text-base font-semibold text-zinc-200 mb-4">SIR Pandemic Spread Simulation</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                    {[
                      { label: 'R₀', key: 'r0', min: 0.5, max: 15, step: 0.1 },
                      { label: 'IFR', key: 'ifr', min: 0.001, max: 0.3, step: 0.001 },
                      { label: 'Containment Day', key: 'containment_day', min: 0, max: 180, step: 1 },
                      { label: 'Containment Effect', key: 'containment_effectiveness', min: 0, max: 1, step: 0.05 },
                    ].map(p => (
                      <div key={p.key}>
                        <label className="text-xs text-zinc-400">{p.label}: {(simParams as any)[p.key]}</label>
                        <input type="range" min={p.min} max={p.max} step={p.step}
                          value={(simParams as any)[p.key]}
                          onChange={e => setSimParams(prev => ({ ...prev, [p.key]: parseFloat(e.target.value) }))}
                          className="w-full mt-1"
                        />
                      </div>
                    ))}
                  </div>
                  <button onClick={runSimulation} disabled={simLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-500 hover:bg-zinc-400 rounded-md text-sm font-medium text-zinc-100 disabled:opacity-50"
                  >
                    <PlayIcon className="w-4 h-4" />
                    {simLoading ? 'Simulating...' : 'Run Simulation'}
                  </button>
                </div>

                {simResult && simResult.length > 0 && (
                  <div className="bg-zinc-900 rounded-md p-5 border border-zinc-800">
                    <h3 className="text-base font-semibold text-zinc-200 mb-4">Simulation Results</h3>
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div className="bg-zinc-800/50 rounded-md p-3 text-center border border-zinc-700">
                        <div className="text-xs text-zinc-400">Peak Infected</div>
                        <div className="text-lg font-semibold text-risk-medium">{(maxInfected / 1e6).toFixed(1)}M</div>
                      </div>
                      <div className="bg-zinc-800/50 rounded-md p-3 text-center border border-zinc-700">
                        <div className="text-xs text-zinc-400">Total Deaths</div>
                        <div className="text-lg font-semibold text-risk-high">{(totalDead / 1e6).toFixed(1)}M</div>
                      </div>
                      <div className="bg-zinc-800/50 rounded-md p-3 text-center border border-zinc-700">
                        <div className="text-xs text-zinc-400">Duration</div>
                        <div className="text-lg font-semibold text-zinc-100">{simResult[simResult.length - 1].day} days</div>
                      </div>
                    </div>
                    <div className="h-40 flex items-end gap-px">
                      {simResult.map((d, i) => (
                        <div key={i} className="flex-1 bg-zinc-500 rounded-t opacity-80" style={{
                          height: `${Math.max(1, (d.infected / maxInfected) * 100)}%`
                        }} title={`Day ${d.day}: ${(d.infected / 1e6).toFixed(1)}M infected`} />
                      ))}
                    </div>
                    <div className="flex justify-between text-xs text-zinc-500 mt-1">
                      <span>Day 0</span><span>Day {simResult[simResult.length - 1].day}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab === 'network' && (
              <div className="space-y-4">
                {spreadNetworkLoading ? (
                  <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-2 border-zinc-500 border-t-transparent rounded-full" /></div>
                ) : spreadNetworkData && spreadNetworkData.nodes.length > 0 ? (
                  <>
                    <div className="flex flex-wrap items-center gap-4 mb-2">
                      <span className="text-zinc-500 text-sm">Nodes: {spreadNetworkData.nodes.length} (airports + BSL-4 labs)</span>
                      <span className="text-zinc-500 text-sm">Edges: {spreadNetworkData.edges.length} (routes)</span>
                      <button onClick={fetchSpreadNetwork} className="text-xs text-zinc-400 hover:text-zinc-200">Refresh</button>
                    </div>
                    <SpreadNetworkGraph data={spreadNetworkData} graphRef={spreadGraphRef} />
                    <div className="flex gap-6 text-xs text-zinc-500 mb-4">
                      <span><span className="inline-block w-2 h-2 rounded-full bg-sky-500 mr-1" />Airport</span>
                      <span><span className="inline-block w-2 h-2 rounded-full bg-amber-500 mr-1" />BSL-4 lab</span>
                    </div>
                    <div className="rounded-md border border-zinc-700/80 bg-zinc-800/50 p-5 text-zinc-300 space-y-4">
                      <h3 className="text-sm font-semibold text-zinc-100">What you are seeing</h3>
                      <p className="text-sm leading-relaxed">
                        This is the <strong className="text-zinc-200">Spread Network</strong>: a single view of where high-containment labs (BSL-4) sit relative to global air travel. Each <span className="text-sky-400">blue node</span> is an airport; each <span className="text-amber-400/80">amber node</span> is a BSL-4 laboratory. Lines between nodes are <strong className="text-zinc-200">routes</strong>—either flight connections between airports or links from labs to nearby airports. The layout is force-directed: tightly connected nodes cluster together; well-connected hubs sit at the center; peripheral nodes look like “satellites.” This is not a geographic map; distance on the screen reflects connectivity and link length, not real-world km.
                      </p>
                      <h3 className="text-sm font-semibold text-zinc-100">Why it matters</h3>
                      <p className="text-sm leading-relaxed">
                        Pathogen release from a BSL-4 lab is rare but consequential. If it happens, spread is driven by human mobility—especially air travel. Labs that are well connected to major hubs (many or strong links in this graph) pose higher <em>spread risk</em>: an outbreak could reach many regions quickly. This view helps regulators and health agencies see at a glance which labs are “close” to the global network and where to prioritize surveillance, preparedness, or containment measures.
                      </p>
                      <h3 className="text-sm font-semibold text-zinc-100">How to use it</h3>
                      <ul className="text-sm leading-relaxed list-disc list-inside space-y-1 text-zinc-400">
                        <li><strong className="text-zinc-300">Hover</strong> a node to see its label and type (airport or BSL-4 lab).</li>
                        <li><strong className="text-zinc-300">Drag</strong> the canvas to pan; scroll or pinch to zoom.</li>
                        <li><strong className="text-zinc-300">Refresh</strong> reloads data from the server (node and edge counts may change).</li>
                        <li>For numeric risk per lab (overall risk, spread risk score, containment rating, nearby airports), use the <strong className="text-zinc-300">Pathogen / lab risk</strong> tab.</li>
                      </ul>
                      <p className="text-xs text-zinc-500 pt-1">
                        Data: airports and BSL-4 labs from the BIOSEC registry; routes and distances from the spread-network API. The graph is for situational awareness and planning, not real-time operational traffic.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="bg-zinc-900 rounded-md p-5 border border-zinc-800 text-center py-12">
                    <BeakerIcon className="w-12 h-12 text-zinc-500 mx-auto mb-3" />
                    <p className="text-zinc-400">No spread network data. API may be unavailable.</p>
                    <button onClick={fetchSpreadNetwork} className="mt-3 px-4 py-2 rounded-md bg-zinc-700 text-zinc-200 hover:bg-zinc-600 text-sm">Retry</button>
                  </div>
                )}
              </div>
            )}

            {tab === 'pathogen' && (
              <div className="space-y-4">
                <p className="text-zinc-400 text-sm">Pathogen / lab risk: overall risk, spread risk (proximity to airports), and containment rating per BSL-4 lab.</p>
                {labRisksLoading ? (
                  <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-2 border-zinc-500 border-t-transparent rounded-full" /></div>
                ) : labs.length === 0 ? (
                  <div className="bg-zinc-900 rounded-md p-8 border border-zinc-800 text-center text-zinc-400">No labs loaded. Open BSL-4 Labs tab first or refresh.</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr className="border-b border-zinc-700">
                          <th className="text-left py-2 px-3 text-zinc-400 font-medium">Lab</th>
                          <th className="text-right py-2 px-3 text-zinc-400 font-medium">Overall risk</th>
                          <th className="text-right py-2 px-3 text-zinc-400 font-medium">Spread risk</th>
                          <th className="text-right py-2 px-3 text-zinc-400 font-medium">Containment</th>
                          <th className="text-left py-2 px-3 text-zinc-400 font-medium">Nearby airports</th>
                        </tr>
                      </thead>
                      <tbody>
                        {labs.slice(0, 30).map((lab) => {
                          const risk = labRisks[lab.id]
                          return (
                            <tr key={lab.id} className="border-b border-zinc-800/50">
                              <td className="py-2 px-3 text-zinc-100">{lab.name}</td>
                              <td className="py-2 px-3 text-right">
                                {risk != null ? <span className={risk.overall_risk >= 0.5 ? 'text-risk-high' : risk.overall_risk >= 0.3 ? 'text-amber-400/80' : 'text-zinc-300'}>{(risk.overall_risk * 100).toFixed(1)}%</span> : '—'}
                              </td>
                              <td className="py-2 px-3 text-right text-zinc-300">{risk != null ? (risk.spread_risk_score * 100).toFixed(1) + '%' : '—'}</td>
                              <td className="py-2 px-3 text-right text-zinc-300">{risk != null ? (risk.containment_rating * 100).toFixed(0) + '%' : '—'}</td>
                              <td className="py-2 px-3 text-zinc-400">
                                {risk != null && risk.nearby_airports.length > 0
                                  ? risk.nearby_airports.slice(0, 3).map((a) => `${a.code} (${a.distance_km} km)`).join(', ') + (risk.nearby_airports.length > 3 ? '…' : '')
                                  : risk != null ? 'None' : '—'}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {labs.length > 0 && Object.keys(labRisks).length === 0 && !labRisksLoading && (
                      <button onClick={fetchLabRisks} className="mt-3 px-4 py-2 rounded-md bg-zinc-700 text-zinc-200 hover:bg-zinc-600 text-sm">Load risk assessment</button>
                    )}
                    {Object.keys(labRisks).length > 0 && <button onClick={fetchLabRisks} className="mt-3 text-xs text-zinc-500 hover:text-zinc-300">Refresh</button>}
                  </div>
                )}
              </div>
            )}

            {tab === 'outbreaks' && (
              <div className="space-y-4">
                {whoLoading ? (
                  <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-2 border-zinc-500 border-t-transparent rounded-full" /></div>
                ) : whoData ? (
                  <>
                    {/* WHO summary banner */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="bg-zinc-900 rounded-md p-4 border border-zinc-800">
                        <div className="text-zinc-500 text-xs">Active Outbreaks</div>
                        <div className="text-2xl font-semibold text-zinc-100 mt-1">{whoData.active_outbreaks ?? 0}</div>
                      </div>
                      <div className="bg-zinc-900 rounded-md p-4 border border-risk-high/30">
                        <div className="text-zinc-500 text-xs">High Severity</div>
                        <div className="text-2xl font-semibold text-risk-high mt-1">{whoData.high_severity_count ?? 0}</div>
                      </div>
                      <div className="bg-zinc-900 rounded-md p-4 border border-zinc-800">
                        <div className="text-zinc-500 text-xs">Countries Affected</div>
                        <div className="text-2xl font-semibold text-zinc-100 mt-1">{whoData.total_countries_affected ?? 0}</div>
                      </div>
                      <div className="bg-zinc-900 rounded-md p-4 border border-zinc-800">
                        <div className="text-zinc-500 text-xs">Top Diseases</div>
                        <div className="text-sm font-medium mt-1 text-zinc-300">
                          {(whoData.top_diseases || []).slice(0, 3).map((d: any) => d.disease).join(', ') || '—'}
                        </div>
                      </div>
                    </div>

                    {/* Outbreak list */}
                    <div className="space-y-2">
                      {(whoData.outbreaks || []).map((ob: any) => (
                        <motion.div key={ob.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                          className="bg-zinc-900 rounded-md p-4 border border-zinc-800"
                        >
                          <div className="flex items-start gap-3">
                            <div className={`w-3 h-3 mt-1.5 rounded-full flex-shrink-0 ${
                              ob.severity === 'critical' ? 'bg-red-500' :
                              ob.severity === 'high' ? 'bg-orange-500' :
                              ob.severity === 'moderate' ? 'bg-amber-500' : 'bg-zinc-500'
                            }`} />
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-zinc-100">{ob.title || ob.disease}</div>
                              <div className="text-sm text-zinc-400 mt-0.5">
                                {ob.country} {ob.date_published ? `— ${ob.date_published}` : ''}
                                {ob.who_grade ? ` — ${ob.who_grade}` : ''}
                              </div>
                              {(ob.cases_total > 0 || ob.deaths_total > 0) && (
                                <div className="flex gap-4 mt-1 text-xs">
                                  {ob.cases_total > 0 && <span className="text-amber-400/80">{ob.cases_total.toLocaleString()} cases</span>}
                                  {ob.deaths_total > 0 && <span className="text-red-400/80">{ob.deaths_total.toLocaleString()} deaths</span>}
                                  {ob.case_fatality_rate > 0 && <span className="text-zinc-400">CFR {(ob.case_fatality_rate * 100).toFixed(1)}%</span>}
                                </div>
                              )}
                              {ob.summary && <p className="text-xs text-zinc-500 mt-1 line-clamp-2">{ob.summary}</p>}
                            </div>
                            <div className="text-right flex-shrink-0">
                              <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                ob.severity === 'critical' ? 'bg-red-500/20 text-red-400/80' :
                                ob.severity === 'high' ? 'bg-orange-500/20 text-orange-400/80' :
                                ob.severity === 'moderate' ? 'bg-amber-500/20 text-amber-400/80' : 'bg-zinc-700 text-zinc-400'
                              }`}>{ob.severity}</span>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                      {(!whoData.outbreaks || whoData.outbreaks.length === 0) && (
                        <div className="text-center py-8 text-zinc-400">No outbreaks found in the last 90 days.</div>
                      )}
                    </div>

                    <div className="text-xs text-zinc-500 text-right">
                      Source: WHO Disease Outbreak News — fetched {whoData.fetched_at ? new Date(whoData.fetched_at).toLocaleString() : 'recently'}
                    </div>
                  </>
                ) : (
                  <div className="text-center py-12 text-zinc-400">
                    <button onClick={fetchWhoOutbreaks} className="px-4 py-2 bg-zinc-700 hover:bg-zinc-600 rounded-md text-sm text-zinc-100 border border-zinc-600">Load WHO Outbreaks</button>
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
