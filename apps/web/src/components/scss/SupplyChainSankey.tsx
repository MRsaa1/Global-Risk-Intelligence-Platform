/**
 * Supply Chain Sankey — flow by tier (T0 → T1 → … → Tn).
 * Link width = transit_time_days or 1; node color = geopolitical risk.
 */
import { useRef, useEffect, useMemo } from 'react'
import * as d3 from 'd3'
import { sankey, sankeyLinkHorizontal } from '@plotly/d3-sankey'

export interface ChainMapNode {
  id: string
  scss_id: string
  name: string
  tier: number
  supplier_type: string
  country_code?: string
  geopolitical_risk?: number
  is_critical: boolean
}

export interface ChainMapEdge {
  id: string
  source_id: string
  target_id: string
  transport_mode?: string
  transit_time_days?: number
}

export interface SupplyChainSankeyProps {
  nodes: ChainMapNode[]
  edges: ChainMapEdge[]
  width?: number
  height?: number
}

/** All nodes green, same as map pins. */
const NODE_COLOR = '#22c55e'

export default function SupplyChainSankey({
  nodes,
  edges,
  width = 800,
  height = 380,
}: SupplyChainSankeyProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  const graph = useMemo(() => {
    if (!nodes.length) return null
    const snodes = nodes.map((n) => ({
      id: n.id,
      name: n.name || n.scss_id || n.id,
      tier: n.tier,
      _risk: n.geopolitical_risk,
      _critical: n.is_critical,
    }))
    const nodeById = new Map(snodes.map((n) => [n.id, n]))
    const maxTier = Math.max(...nodes.map((n) => n.tier), 1)
    const slinks = edges
      .filter((e) => nodeById.has(e.source_id) && nodeById.has(e.target_id))
      .map((e) => ({
        source: nodeById.get(e.source_id)!,
        target: nodeById.get(e.target_id)!,
        value: Math.max(0.1, e.transit_time_days ?? 1),
      }))
    return { nodes: snodes, links: slinks, maxTier }
  }, [nodes, edges])

  useEffect(() => {
    if (!graph || !containerRef.current) return
    const { nodes: snodes, links: slinks, maxTier } = graph
    if (slinks.length === 0) return

    const w = width
    const h = height

    const sankeyGraph = { nodes: [...snodes], links: [...slinks] }

    const s = sankey()
      .nodeId((d: { id: string }) => d.id)
      .nodeWidth(18)
      .nodePadding(10)
      .extent([
        [0, 0],
        [w, h],
      ])
      .nodeAlign((node: { tier?: number }, n: number) => Math.min(node.tier ?? 0, n - 1))

    s(sankeyGraph)

    d3.select(containerRef.current).selectAll('*').remove()
    const svg = d3
      .select(containerRef.current)
      .append('svg')
      .attr('width', w)
      .attr('height', h)
      .attr('viewBox', [0, 0, w, h])
      .style('background', '#09090b')

    const g = svg.append('g')

    g.append('g')
      .attr('fill', 'none')
      .attr('stroke-opacity', 0.5)
      .selectAll('path')
      .data(sankeyGraph.links)
      .join('path')
      .attr('d', sankeyLinkHorizontal())
      .attr('stroke', 'rgba(148, 163, 184, 0.6)')
      .attr('stroke-width', (d: { width?: number }) => Math.max(1, d.width ?? 1))

    const nodeData = sankeyGraph.nodes as Array<{
      x0?: number
      x1?: number
      y0?: number
      y1?: number
      id?: string
      name?: string
      _risk?: number
      _critical?: boolean
    }>

    g.append('g')
      .selectAll('rect')
      .data(nodeData)
      .join('rect')
      .attr('x', (d) => d.x0 ?? 0)
      .attr('y', (d) => d.y0 ?? 0)
      .attr('height', (d) => Math.max(0, (d.y1 ?? 0) - (d.y0 ?? 0)))
      .attr('width', (d) => Math.max(0, (d.x1 ?? 0) - (d.x0 ?? 0)))
      .attr('fill', NODE_COLOR)
      .attr('stroke', (d) => (d._critical ? 'rgba(234, 179, 8, 0.8)' : 'rgba(255,255,255,0.2)'))
      .attr('stroke-width', (d) => (d._critical ? 2 : 1))

    g.append('g')
      .attr('font', '11px "JetBrains Mono", monospace')
      .attr('fill', '#a1a1aa')
      .selectAll('text')
      .data(nodeData)
      .join('text')
      .attr('x', (d) => {
        const x0 = d.x0 ?? 0
        const x1 = d.x1 ?? 0
        return x0 < w / 2 ? x1 + 6 : x0 - 6
      })
      .attr('y', (d) => (d.y0 ?? 0) + ((d.y1 ?? 0) - (d.y0 ?? 0)) / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', (d) => ((d.x0 ?? 0) < w / 2 ? 'start' : 'end'))
      .text((d) => (d.name ?? '').slice(0, 20) + ((d.name?.length ?? 0) > 20 ? '…' : ''))

    return () => {
      d3.select(containerRef.current).selectAll('*').remove()
    }
  }, [graph, width, height])

  if (!nodes.length) {
    return (
      <div
        className="rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/50 text-sm"
        style={{ width, height }}
      >
        No nodes to display
      </div>
    )
  }

  if (graph && graph.links.length === 0) {
    return (
      <div
        className="rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/50 text-sm"
        style={{ width, height }}
      >
        No connections — add routes to see flow
      </div>
    )
  }

  return (
    <div
      className="rounded-lg overflow-hidden bg-zinc-900/80 border border-white/10"
      ref={containerRef}
      style={{ width, height }}
    />
  )
}
