/**
 * CrossModuleCascadeGraph — Clean institutional D3 force-directed graph.
 * No glow, smaller nodes, subtler animation, mono labels, no overlaid legend.
 */
import { useRef, useEffect, useMemo, useCallback } from 'react'
import * as d3 from 'd3'

interface GraphNode {
  id: string
  label: string
  full_name: string
  description: string
  color: string
}

interface GraphEdge {
  source: string
  target: string
  weight: number
  categories: string[]
}

interface CascadeGraphProps {
  nodes: GraphNode[]
  edges: GraphEdge[]
  simulationResult?: any
  cascadeSource?: string
  cascadeCategory?: string
  width?: number
  height?: number
}

interface SimNode extends d3.SimulationNodeDatum {
  id: string
  label: string
  full_name: string
  color: string
  impactSeverity: number
  isSource: boolean
  isOnCriticalPath: boolean
}

interface SimLink extends d3.SimulationLinkDatum<SimNode> {
  weight: number
  isActive: boolean
  isOnCriticalPath: boolean
}

const MODULE_POSITIONS: Record<string, [number, number]> = {
  cip:    [0, -1],
  scss:   [0.87, -0.5],
  sro:    [0.87, 0.5],
  biosec: [0, 1],
  erf:    [-0.87, 0.5],
  asm:    [-0.87, -0.5],
  asgi:   [0.5, -0.87],
  cadapt: [-0.5, -0.87],
}

export default function CrossModuleCascadeGraph({
  nodes,
  edges,
  simulationResult,
  cascadeSource,
  cascadeCategory,
  width = 700,
  height = 440,
}: CascadeGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const timerRef = useRef<d3.Timer | null>(null)

  const impactsMap = useMemo(() => {
    if (!simulationResult?.module_impacts) return new Map<string, any>()
    const map = new Map<string, any>()
    for (const [k, v] of Object.entries(simulationResult.module_impacts)) {
      map.set(k, v)
    }
    return map
  }, [simulationResult])

  const criticalPathSet = useMemo(() => new Set<string>(simulationResult?.critical_path || []), [simulationResult])

  const criticalEdgesSet = useMemo(() => {
    const set = new Set<string>()
    const cp = simulationResult?.critical_path || []
    for (let i = 0; i < cp.length - 1; i++) set.add(`${cp[i]}->${cp[i + 1]}`)
    return set
  }, [simulationResult])

  const activeEdgesSet = useMemo(() => {
    const set = new Set<string>()
    if (!simulationResult?.module_impacts) return set
    for (const v of Object.values(simulationResult.module_impacts) as any[]) {
      const path = v.propagation_path || []
      for (let i = 0; i < path.length - 1; i++) set.add(`${path[i]}->${path[i + 1]}`)
    }
    return set
  }, [simulationResult])

  const filteredEdges = useMemo(() => {
    if (!cascadeCategory) return edges
    return edges.filter(e => e.categories.includes(cascadeCategory))
  }, [edges, cascadeCategory])

  const drawGraph = useCallback(() => {
    if (!svgRef.current || !nodes.length) return

    if (timerRef.current) { timerRef.current.stop(); timerRef.current = null }

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const cx = width / 2
    const cy = height / 2
    const radius = Math.min(cx, cy) * 0.62

    const simNodes: SimNode[] = nodes.map(n => {
      const pos = MODULE_POSITIONS[n.id] || [0, 0]
      const impact = impactsMap.get(n.id)
      return {
        id: n.id,
        label: n.label,
        full_name: n.full_name,
        color: n.color,
        x: cx + pos[0] * radius,
        y: cy + pos[1] * radius,
        fx: cx + pos[0] * radius,
        fy: cy + pos[1] * radius,
        impactSeverity: impact?.impact_severity || 0,
        isSource: n.id === cascadeSource,
        isOnCriticalPath: criticalPathSet.has(n.id),
      }
    })

    const nodeMap = new Map(simNodes.map(n => [n.id, n]))
    const simLinks: SimLink[] = filteredEdges
      .filter(e => nodeMap.has(e.source) && nodeMap.has(e.target))
      .map(e => ({
        source: nodeMap.get(e.source)!,
        target: nodeMap.get(e.target)!,
        weight: e.weight,
        categories: e.categories,
        isActive: activeEdgesSet.has(`${e.source}->${e.target}`),
        isOnCriticalPath: criticalEdgesSet.has(`${e.source}->${e.target}`),
      }))

    const defs = svg.append('defs')

    const mkArrow = (id: string, color: string, size: number) => {
      defs.append('marker')
        .attr('id', id)
        .attr('viewBox', '0 -4 8 8')
        .attr('refX', 24)
        .attr('refY', 0)
        .attr('markerWidth', size)
        .attr('markerHeight', size)
        .attr('orient', 'auto')
        .append('path')
        .attr('d', 'M0,-3L7,0L0,3')
        .attr('fill', color)
    }
    mkArrow('arr', 'rgba(113,113,122,0.5)', 5)
    mkArrow('arr-active', 'rgba(217,176,82,0.7)', 6)
    mkArrow('arr-crit', 'rgba(185,80,80,0.8)', 6)

    const g = svg.append('g')

    // Edges - static solid lines
    const linkG = g.selectAll('.link').data(simLinks).enter().append('g').attr('class', 'link')

    linkG.append('path')
      .attr('d', (d: any) => {
        const sx = d.source.x!, sy = d.source.y!, tx = d.target.x!, ty = d.target.y!
        const dx = tx - sx, dy = ty - sy
        const dr = Math.sqrt(dx * dx + dy * dy) * 1.5
        return `M${sx},${sy}A${dr},${dr} 0 0,1 ${tx},${ty}`
      })
      .attr('fill', 'none')
      .attr('stroke', (d: any) => d.isOnCriticalPath ? 'rgba(185,80,80,0.7)' : d.isActive ? 'rgba(217,176,82,0.55)' : 'rgba(113,113,122,0.25)')
      .attr('stroke-width', (d: any) => d.isOnCriticalPath ? 2.5 : d.isActive ? 1.8 : Math.max(0.8, d.weight * 2))
      .attr('marker-end', (d: any) => d.isOnCriticalPath ? 'url(#arr-crit)' : d.isActive ? 'url(#arr-active)' : 'url(#arr)')

    // Flowing dash overlay
    const flowPaths = linkG.append('path')
      .attr('d', (d: any) => {
        const sx = d.source.x!, sy = d.source.y!, tx = d.target.x!, ty = d.target.y!
        const dx = tx - sx, dy = ty - sy
        const dr = Math.sqrt(dx * dx + dy * dy) * 1.5
        return `M${sx},${sy}A${dr},${dr} 0 0,1 ${tx},${ty}`
      })
      .attr('fill', 'none')
      .attr('stroke', (d: any) => d.isOnCriticalPath ? 'rgba(185,80,80,0.4)' : d.isActive ? 'rgba(217,176,82,0.3)' : 'rgba(113,113,122,0.12)')
      .attr('stroke-width', (d: any) => d.isOnCriticalPath ? 1.5 : d.isActive ? 1 : 0.5)
      .attr('stroke-dasharray', (d: any) => d.isOnCriticalPath ? '6,8' : d.isActive ? '4,7' : '3,8')
      .attr('opacity', (d: any) => (d.isActive || d.isOnCriticalPath) ? 0.7 : 0.3)

    timerRef.current = d3.timer((elapsed) => {
      flowPaths.attr('stroke-dashoffset', () => -(elapsed / 50))
    })

    // Weight labels on edges
    linkG.append('text')
      .attr('x', (d: any) => {
        const sx = d.source.x!, tx = d.target.x!, dy = d.target.y! - d.source.y!
        const len = Math.sqrt((tx - sx) ** 2 + dy ** 2) || 1
        return (sx + tx) / 2 + (dy / len) * 10
      })
      .attr('y', (d: any) => {
        const sy = d.source.y!, ty = d.target.y!, dx = d.target.x! - d.source.x!
        const len = Math.sqrt(dx ** 2 + (ty - sy) ** 2) || 1
        return (sy + ty) / 2 - (dx / len) * 10
      })
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', (d: any) => d.isOnCriticalPath ? 'rgba(185,80,80,0.7)' : d.isActive ? 'rgba(217,176,82,0.6)' : 'rgba(113,113,122,0.4)')
      .attr('font-size', '8px')
      .attr('font-weight', '500')
      .attr('font-family', '"JetBrains Mono", monospace')
      .text((d: any) => d.weight.toFixed(2))

    // Nodes
    const nodeG = g.selectAll('.node').data(simNodes).enter().append('g')
      .attr('class', 'node')
      .attr('transform', (d: any) => `translate(${d.x},${d.y})`)

    // Severity ring
    nodeG.filter((d: any) => d.isSource || d.impactSeverity > 0)
      .append('circle')
      .attr('r', (d: any) => d.isSource ? 22 : 20)
      .attr('fill', 'none')
      .attr('stroke', (d: any) => {
        if (d.isSource) return 'rgba(185,80,80,0.6)'
        if (d.impactSeverity > 0.6) return 'rgba(185,80,80,0.5)'
        if (d.impactSeverity > 0.3) return 'rgba(217,176,82,0.5)'
        return 'rgba(74,122,90,0.4)'
      })
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', (d: any) => d.isSource ? 'none' : '2,2')

    // Main circle
    nodeG.append('circle')
      .attr('r', (d: any) => d.isSource ? 18 : 16)
      .attr('fill', '#18181b')
      .attr('stroke', (d: any) => d.color)
      .attr('stroke-width', 1.5)

    // Abbreviation
    nodeG.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'middle')
      .attr('fill', '#d4d4d8')
      .attr('font-size', '9px')
      .attr('font-weight', '600')
      .attr('font-family', '"JetBrains Mono", monospace')
      .text((d: any) => d.label)

    // Full name below
    nodeG.append('text')
      .attr('y', 26)
      .attr('text-anchor', 'middle')
      .attr('fill', 'rgba(113,113,122,0.7)')
      .attr('font-size', '7px')
      .attr('font-family', '"JetBrains Mono", monospace')
      .text((d: any) => d.full_name)

    // Severity % above
    nodeG.filter((d: any) => d.impactSeverity > 0 || d.isSource)
      .append('text')
      .attr('y', -24)
      .attr('text-anchor', 'middle')
      .attr('fill', (d: any) => {
        if (d.isSource) return 'rgba(185,80,80,0.8)'
        if (d.impactSeverity > 0.6) return 'rgba(185,80,80,0.7)'
        if (d.impactSeverity > 0.3) return 'rgba(217,176,82,0.7)'
        return 'rgba(74,122,90,0.6)'
      })
      .attr('font-size', '8px')
      .attr('font-weight', '600')
      .attr('font-family', '"JetBrains Mono", monospace')
      .text((d: any) => d.isSource && !d.impactSeverity ? 'SRC' : `${(d.impactSeverity * 100).toFixed(0)}%`)
  }, [nodes, filteredEdges, impactsMap, criticalPathSet, criticalEdgesSet, activeEdgesSet, cascadeSource, width, height])

  useEffect(() => {
    drawGraph()
    return () => { if (timerRef.current) { timerRef.current.stop(); timerRef.current = null } }
  }, [drawGraph])

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="w-full"
      style={{ maxHeight: `${height}px` }}
    />
  )
}
