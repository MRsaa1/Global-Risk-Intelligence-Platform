/**
 * Supply Chain Graph — Bloomberg-style network visualization.
 * Pill-shaped nodes, curved links, dark theme, clean typography.
 */
import { useMemo, useCallback, useRef, useEffect } from 'react'
import ForceGraph2D, { ForceGraphMethods } from 'react-force-graph-2d'

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

export interface SupplyChainGraphProps {
  nodes: ChainMapNode[]
  edges: ChainMapEdge[]
  rootSupplierId?: string
  width?: number
  height?: number
}

const NODE_COLOR = '#22c55e'
const PILL_HEIGHT = 26
const PILL_PADDING_X = 14
const PILL_RADIUS = PILL_HEIGHT / 2
const FONT = '11px "JetBrains Mono", monospace'
const MAX_LABEL_CHARS = 22

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  if (w < 2 * r) r = w / 2
  if (h < 2 * r) r = h / 2
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export default function SupplyChainGraph({
  nodes,
  edges,
  rootSupplierId,
  width = 800,
  height = 400,
}: SupplyChainGraphProps) {
  const graphRef = useRef<ForceGraphMethods | undefined>()

  const graphData = useMemo(() => {
    const nodeMap = new Map(nodes.map((n) => [n.id, { ...n, color: NODE_COLOR }]))
    const links = edges
      .filter((e) => nodeMap.has(e.source_id) && nodeMap.has(e.target_id))
      .map((e) => ({ source: e.source_id, target: e.target_id, transit_time_days: e.transit_time_days }))
    return {
      nodes: Array.from(nodeMap.values()),
      links,
    }
  }, [nodes, edges])

  useEffect(() => {
    if (graphRef.current && graphData.nodes.length > 0) {
      graphRef.current.d3Force('charge')?.strength(-380)
      graphRef.current.d3Force('link')?.distance(140)
      graphRef.current.d3Force('center')?.strength(0.08)
    }
  }, [graphData])

  const nodeCanvasObject = useCallback(
    (node: ChainMapNode & { x?: number; y?: number; color?: string }, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const x = node.x ?? 0
      const y = node.y ?? 0
      const raw = node.name || node.scss_id || node.id
      const label = raw.length > MAX_LABEL_CHARS ? raw.slice(0, MAX_LABEL_CHARS) + '…' : raw
      ctx.font = FONT
      const textWidth = Math.ceil(ctx.measureText(label).width)
      const pillW = Math.max(textWidth + PILL_PADDING_X * 2, 72)
      const pillH = PILL_HEIGHT
      const left = x - pillW / 2
      const top = y - pillH / 2

      // Pill (Bloomberg-style rounded rect)
      roundRect(ctx, left, top, pillW, pillH, PILL_RADIUS)
      ctx.fillStyle = node.color ?? NODE_COLOR
      ctx.fill()
      ctx.strokeStyle = node.is_critical ? 'rgba(234, 179, 8, 0.85)' : 'rgba(255,255,255,0.25)'
      ctx.lineWidth = node.is_critical ? 2 : 1
      ctx.stroke()

      // Label inside pill
      const fontSize = Math.max(9, 11 / globalScale)
      ctx.font = `${fontSize}px "JetBrains Mono", monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillStyle = 'rgba(255,255,255,0.95)'
      ctx.fillText(label, x, y)
    },
    []
  )

  const linkCanvasObject = useCallback(
    (
      link: { source: { x?: number; y?: number }; target: { x?: number; y?: number }; transit_time_days?: number },
      ctx: CanvasRenderingContext2D,
      globalScale: number
    ) => {
      const src = link.source as { x?: number; y?: number }
      const tgt = link.target as { x?: number; y?: number }
      if (src.x == null || src.y == null || tgt.x == null || tgt.y == null) return
      const midX = (src.x + tgt.x) / 2
      const midY = (src.y + tgt.y) / 2
      const curvature = 0.18
      const ctrlX = midX + (tgt.y - src.y) * curvature
      const ctrlY = midY - (tgt.x - src.x) * curvature
      ctx.beginPath()
      ctx.moveTo(src.x, src.y)
      ctx.quadraticCurveTo(ctrlX, ctrlY, tgt.x, tgt.y)
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)'
      ctx.lineWidth = Math.max(1, 1.5 / globalScale)
      ctx.stroke()

      // Arrow at target
      const dx = tgt.x - ctrlX
      const dy = tgt.y - ctrlY
      const len = Math.hypot(dx, dy) || 1
      const ux = dx / len
      const uy = dy / len
      const arrowLen = Math.min(6, 8 / globalScale)
      const ax = tgt.x - ux * arrowLen
      const ay = tgt.y - uy * arrowLen
      const perpX = -uy
      const perpY = ux
      const tip = 0.4
      ctx.beginPath()
      ctx.moveTo(tgt.x, tgt.y)
      ctx.lineTo(ax + perpX * tip * arrowLen, ay + perpY * tip * arrowLen)
      ctx.lineTo(ax - perpX * tip * arrowLen, ay - perpY * tip * arrowLen)
      ctx.closePath()
      ctx.fillStyle = 'rgba(148, 163, 184, 0.7)'
      ctx.fill()
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.5)'
      ctx.lineWidth = 1
      ctx.stroke()
    },
    []
  )

  if (graphData.nodes.length === 0) {
    return (
      <div
        className="rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/50 text-sm"
        style={{ width, height }}
      >
        No nodes to display
      </div>
    )
  }

  return (
    <div className="rounded-lg overflow-hidden bg-[#0c0f14] border border-white/10" style={{ width, height }}>
      <ForceGraph2D
        ref={graphRef}
        graphData={graphData}
        width={width}
        height={height}
        nodeId="id"
        nodeVal={(n) => 28}
        nodeLabel={(n) => {
          const node = n as ChainMapNode
          const parts = [node.name || node.scss_id, node.country_code && `(${node.country_code})`, `Tier ${node.tier}`]
          if (node.geopolitical_risk != null) parts.push(`Risk: ${node.geopolitical_risk}`)
          return parts.filter(Boolean).join(' ')
        }}
        nodeCanvasObject={nodeCanvasObject}
        linkCanvasObject={linkCanvasObject}
        linkCurvature={0}
        linkDirectionalArrowLength={0}
        linkDirectionalArrowRelPos={0}
        backgroundColor="#0c0f14"
      />
    </div>
  )
}
