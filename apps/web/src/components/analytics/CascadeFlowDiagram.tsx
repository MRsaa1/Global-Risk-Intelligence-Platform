/**
 * CascadeFlowDiagram - D3 Sankey for reports
 * Flow: Trigger → Affected nodes → Containment.
 * Uses build-from-context + simulate; renders a 3-layer Sankey.
 */
import { useRef, useEffect, useMemo, useState } from 'react'
import * as d3 from 'd3'
import { sankey, sankeyLinkHorizontal } from '@plotly/d3-sankey'
import { useMutation } from '@tanstack/react-query'

interface GraphNode {
  id: string
  name: string
  type: string
  value: number
  risk_score: number
  sector: string
  region: string
}

interface GraphEdge {
  source: string
  target: string
  type: string
  weight: number
}

interface CascadeResult {
  trigger_node: string
  trigger_severity: number
  simulation_steps: number
  affected_nodes: string[]
  affected_count: number
  total_loss: number
  peak_affected_time: number
  critical_nodes: string[]
  containment_points: string[]
  node_impacts: Record<string, number>
}

interface VulnerabilityResult {
  most_critical_nodes: Array<{ node_id: string; criticality: number }>
  single_points_of_failure: string[]
  network_resilience_score: number
  recommendations: string[]
}

const sectorConfig: Record<string, string> = {
  Energy: '#8a7a5a',
  Finance: '#4a6a8a',
  Manufacturing: '#6a5a7a',
  Technology: '#7a8a7a',
  Healthcare: '#5a7a6a',
  Logistics: '#8a6a5a',
  Infrastructure: '#5a6a7a',
  Default: '#6a7080',
}

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

export interface CascadeFlowDiagramProps {
  cityId: string
  scenarioId: string
  height?: number
}

export default function CascadeFlowDiagram({
  cityId,
  scenarioId,
  height = 500,
}: CascadeFlowDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const buildFromContextMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/whatif/cascade/build-from-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city_id: cityId, scenario_id: scenarioId }),
      })
      if (!res.ok) throw new Error('Failed to build graph from context')
      return res.json() as Promise<{ status?: string; nodes: GraphNode[]; edges: GraphEdge[] }>
    },
    onSuccess: (data) => {
      setGraphData({ nodes: data.nodes || [], edges: data.edges || [] })
      if (data.nodes?.length) {
        simulateMutation.mutate({ trigger_node_id: data.nodes[0].id, trigger_severity: 0.8 })
      }
    },
  })

  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] })

  const simulateMutation = useMutation({
    mutationFn: async (vars?: { trigger_node_id?: string; trigger_severity?: number }) => {
      const res = await fetch('/api/v1/whatif/cascade/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger_node_id: vars?.trigger_node_id ?? graphData.nodes[0]?.id,
          trigger_severity: vars?.trigger_severity ?? 0.8,
          max_steps: 10,
          propagation_threshold: 0.1,
        }),
      })
      if (!res.ok) throw new Error('Failed to simulate cascade')
      return res.json() as Promise<CascadeResult>
    },
    onSuccess: () => {
      vulnerabilityMutation.mutate()
    },
  })

  const vulnerabilityMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/whatif/cascade/vulnerability')
      if (!res.ok) throw new Error('Failed to analyze vulnerability')
      return res.json() as Promise<VulnerabilityResult>
    },
  })

  useEffect(() => {
    if (cityId && scenarioId) buildFromContextMutation.mutate()
  }, [cityId, scenarioId])

  // Build Sankey nodes/links from graphData + simulate
  const sankeyInput = useMemo(() => {
    const sim = simulateMutation.data
    const { nodes: gnodes } = graphData
    if (!sim || !gnodes.length) return null

    const triggerId = sim.trigger_node
    const affectedIds = sim.affected_nodes.filter((id) => id !== triggerId)
    const totalLoss = Math.max(1, sim.total_loss)
    const impacts = sim.node_impacts || {}

    const snodes: Array<{ id: string; name: string; _role?: string; _sector?: string; _impact?: number }> = []
    const triggerNode = gnodes.find((n) => n.id === triggerId)
    snodes.push({
      id: 'trigger',
      name: triggerNode?.name || triggerId || 'Trigger',
      _role: 'trigger',
      _impact: sim.trigger_severity,
    })

    const defaultShare = affectedIds.length ? 1 / affectedIds.length : 1
    affectedIds.forEach((id) => {
      const n = gnodes.find((nn) => nn.id === id)
      snodes.push({
        id,
        name: n?.name || id,
        _role: 'affected',
        _sector: n?.sector,
        _impact: impacts[id] ?? defaultShare,
      })
    })

    snodes.push({ id: 'containment', name: 'Containment', _role: 'containment' })

    const slinks: Array<{ source: string; target: string; value: number }> = []
    affectedIds.forEach((id) => {
      const v = (impacts[id] ?? defaultShare) * totalLoss
      const val = Math.max(0.1, v)
      slinks.push({ source: 'trigger', target: id, value: val })
      slinks.push({ source: id, target: 'containment', value: val })
    })
    if (slinks.length === 0 && totalLoss > 0) {
      slinks.push({ source: 'trigger', target: 'containment', value: totalLoss })
    }

    return { nodes: snodes, links: slinks }
  }, [graphData, simulateMutation.data])

  // D3 render
  useEffect(() => {
    if (!sankeyInput || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const w = Math.max(200, rect.width || 800)
    const h = height

    const { nodes, links } = sankeyInput
    const graph = { nodes: [...nodes], links: [...links] }

    const s = sankey()
      .nodeId((d: { id: string }) => d.id)
      .nodeWidth(20)
      .nodePadding(12)
      .extent([
        [0, 0],
        [w, h],
      ])

    s(graph)

    // Clear and draw
    d3.select(containerRef.current).selectAll('*').remove()
    const svg = d3
      .select(containerRef.current)
      .append('svg')
      .attr('width', w)
      .attr('height', h)
      .attr('viewBox', [0, 0, w, h])
      .style('background', '#09090b')

    const g = svg.append('g')

    // Links
    g.append('g')
      .attr('fill', 'none')
      .attr('stroke-opacity', 0.4)
      .selectAll('path')
      .data(graph.links)
      .join('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke', 'rgba(138,74,74,0.6)')
      .attr('stroke-width', (d: { width?: number }) => Math.max(1, d.width ?? 1))

    // Nodes
    const node = g
      .append('g')
      .selectAll('rect')
      .data(graph.nodes)
      .join('rect')
      .attr('x', (d: { x0?: number }) => d.x0 ?? 0)
      .attr('y', (d: { y0?: number }) => d.y0 ?? 0)
      .attr('height', (d: { y0?: number; y1?: number }) => Math.max(0, (d.y1 ?? 0) - (d.y0 ?? 0)))
      .attr('width', (d: { x0?: number; x1?: number }) => Math.max(0, (d.x1 ?? 0) - (d.x0 ?? 0)))
      .attr('fill', (d: { id?: string; _role?: string; _sector?: string }) => {
        if (d._role === 'trigger') return '#8a4a4a'
        if (d.id === 'containment') return '#4a7a5a'
        return sectorConfig[d._sector || ''] || sectorConfig.Default
      })
      .attr('stroke', 'rgba(255,255,255,0.2)')
      .attr('stroke-width', 1)

    // Labels
    g.append('g')
      .attr('font', '11px "JetBrains Mono", monospace')
      .attr('fill', '#a1a1aa')
      .selectAll('text')
      .data(graph.nodes)
      .join('text')
      .attr('x', (d: { x0?: number; x1?: number }) => {
        const x0 = d.x0 ?? 0
        const x1 = d.x1 ?? 0
        return (d.x0 ?? 0) < w / 2 ? (d.x1 ?? 0) + 6 : (d.x0 ?? 0) - 6
      })
      .attr('y', (d: { y0?: number; y1?: number }) => (d.y0 ?? 0) + ((d.y1 ?? 0) - (d.y0 ?? 0)) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', (d: { x0?: number }) => ((d.x0 ?? 0) < w / 2 ? 'start' : 'end'))
      .text((d: { name?: string; _impact?: number }) =>
        (d.name ?? '') + (d._impact != null ? ` · ${(d._impact * 100).toFixed(0)}%` : '')
      )
  }, [sankeyInput, height])

  const sim = simulateMutation.data
  const vuln = vulnerabilityMutation.data

  return (
    <div className="space-y-4">
      <div className="glass rounded-md p-4">
        <div className="relative">
          <div
            ref={containerRef}
            className="bg-[#09090b] rounded-md border border-zinc-700 overflow-hidden"
            style={{ width: '100%', height }}
          />
          {(buildFromContextMutation.isPending || simulateMutation.isPending) && (
            <div className="absolute inset-0 flex items-center justify-center bg-zinc-950/80 rounded-md" style={{ height }}>
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-zinc-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-zinc-400">Building flow...</span>
              </div>
            </div>
          )}
        </div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-400">
          <div className="flex flex-wrap items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#8a4a4a]" />
              <span>Trigger</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#6a7080]" />
              <span>Affected</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-[#4a7a5a]" />
              <span>Containment</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => buildFromContextMutation.mutate()}
            disabled={buildFromContextMutation.isPending || simulateMutation.isPending}
            className="px-3 py-1.5 bg-zinc-800 text-zinc-300 rounded-lg hover:bg-zinc-700 disabled:opacity-50 text-xs transition-colors"
          >
            Run Simulation
          </button>
        </div>

        {sim && (
          <div className="mt-4 space-y-4">
            <p className="text-zinc-500 text-[10px]">Flow: trigger → affected → containment (D3 Sankey).</p>
            <div className="p-3 bg-zinc-800 rounded-lg border border-zinc-700">
              <div className="text-zinc-400 text-[10px] uppercase tracking-wider mb-1.5">What it helps you understand</div>
              <p className="text-zinc-300 text-xs leading-relaxed">
                Helps you see how the trigger propagates to affected nodes, which nodes bear the highest impact, and where containment stops the cascade. Use this to prioritize hardening and verification.
              </p>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
                <div className="text-zinc-400 text-[10px] uppercase">Affected nodes</div>
                <div className="text-zinc-100 text-lg font-medium">{sim.affected_count}</div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
                <div className="text-zinc-400 text-[10px] uppercase">Est. cascade loss</div>
                <div className="text-amber-400 text-lg font-medium">{formatCurrency(sim.total_loss)}</div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
                <div className="text-zinc-400 text-[10px] uppercase">Critical path</div>
                <div className="text-red-400/90 text-lg font-medium">{sim.critical_nodes?.length ?? 0}</div>
              </div>
              <div className="bg-zinc-800 rounded-lg p-3 border border-zinc-700">
                <div className="text-zinc-400 text-[10px] uppercase">Containment points</div>
                <div className="text-green-400/90 text-lg font-medium">{sim.containment_points?.length ?? 0}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-800 rounded-lg border border-zinc-700 overflow-hidden">
                <div className="text-zinc-300 text-xs uppercase tracking-wider px-3 py-2 border-b border-zinc-700">Critical nodes</div>
                <div className="max-h-32 overflow-y-auto">
                  {(sim.critical_nodes?.length ? sim.critical_nodes : vuln?.most_critical_nodes?.slice(0, 5).map((x) => x.node_id) ?? []).map(
                    (id) => {
                      const n = graphData.nodes.find((nn) => nn.id === id)
                      const imp = sim?.node_impacts?.[id]
                      const crit = vuln?.most_critical_nodes?.find((m) => m.node_id === id)?.criticality
                      return (
                        <div key={id} className="px-3 py-1.5 flex justify-between text-xs border-b border-zinc-800">
                          <span className="text-zinc-300">{n?.name ?? id}</span>
                          <span className="text-zinc-400">
                            {(imp != null ? `${(imp * 100).toFixed(0)}%` : crit != null ? `${(crit * 100).toFixed(0)}%` : '—')} · {n?.sector ?? '—'}
                          </span>
                        </div>
                      )
                    }
                  )}
                  {!sim.critical_nodes?.length && !vuln?.most_critical_nodes?.length && (
                    <div className="px-3 py-2 text-zinc-500 text-xs">None identified</div>
                  )}
                </div>
              </div>
              <div className="bg-zinc-800 rounded-lg border border-zinc-700 overflow-hidden">
                <div className="text-zinc-300 text-xs uppercase tracking-wider px-3 py-2 border-b border-zinc-700">Containment points</div>
                <div className="max-h-32 overflow-y-auto">
                  {(sim.containment_points ?? []).map((id) => {
                    const n = graphData.nodes.find((nn) => nn.id === id)
                    return (
                      <div key={id} className="px-3 py-1.5 flex justify-between text-xs border-b border-zinc-800">
                        <span className="text-zinc-300">{n?.name ?? id}</span>
                        <span className="text-zinc-400">{n?.sector ?? '—'}</span>
                      </div>
                    )
                  })}
                  {(sim.containment_points?.length ?? 0) === 0 && <div className="px-3 py-2 text-zinc-500 text-xs">None identified</div>}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
