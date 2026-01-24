/**
 * Cascade Visualizer - Professional Force-Directed Graph
 * 
 * Features:
 * - Large-scale force-directed layout
 * - Professional SVG icons for asset types
 * - Animated cascade propagation
 * - Glow effects for affected nodes
 */
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useMutation } from '@tanstack/react-query'
import ForceGraph2D, { ForceGraphMethods, NodeObject, LinkObject } from 'react-force-graph-2d'
import {
  ShareIcon,
  BoltIcon,
  PlayIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'

// Types
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

// Force Graph Node/Link types
interface FGNode extends NodeObject {
  id: string
  name: string
  type: string
  value: number
  risk_score: number
  sector: string
  region: string
  color?: string
  isAffected?: boolean
  isTrigger?: boolean
  isContainment?: boolean
  impact?: number
}

interface FGLink extends LinkObject {
  source: string | FGNode
  target: string | FGNode
  type: string
  weight: number
  isActive?: boolean
}

// Format currency
function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`
  return `$${value.toFixed(0)}`
}

// Sector configuration with professional MUTED colors
const sectorConfig: Record<string, { color: string; label: string }> = {
  Energy: { color: '#8a7a5a', label: 'Energy' },         // muted gold/brown
  Finance: { color: '#4a6a8a', label: 'Finance' },       // muted steel blue
  Manufacturing: { color: '#6a5a7a', label: 'Manufacturing' }, // muted purple
  Technology: { color: '#7a8a7a', label: 'Technology' },  // muted sage
  Healthcare: { color: '#5a7a6a', label: 'Healthcare' },  // muted teal
  Logistics: { color: '#8a6a5a', label: 'Logistics' },    // muted terracotta
  Infrastructure: { color: '#5a6a7a', label: 'Infrastructure' }, // muted slate
  Default: { color: '#6a7080', label: 'Asset' },         // neutral gray
}

// Professional SVG icon paths for each sector
const sectorIcons: Record<string, (ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) => void> = {
  Energy: (ctx, x, y, size, color) => {
    // Lightning bolt
    ctx.beginPath()
    ctx.moveTo(x + size * 0.1, y - size * 0.4)
    ctx.lineTo(x - size * 0.15, y + size * 0.05)
    ctx.lineTo(x + size * 0.05, y + size * 0.05)
    ctx.lineTo(x - size * 0.1, y + size * 0.4)
    ctx.lineTo(x + size * 0.15, y - size * 0.05)
    ctx.lineTo(x - size * 0.05, y - size * 0.05)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
  },
  Finance: (ctx, x, y, size, color) => {
    // Building with columns
    ctx.fillStyle = color
    // Roof
    ctx.beginPath()
    ctx.moveTo(x - size * 0.4, y - size * 0.15)
    ctx.lineTo(x, y - size * 0.4)
    ctx.lineTo(x + size * 0.4, y - size * 0.15)
    ctx.closePath()
    ctx.fill()
    // Base
    ctx.fillRect(x - size * 0.35, y - size * 0.15, size * 0.7, size * 0.5)
    // Columns (dark)
    ctx.fillStyle = 'rgba(0,0,0,0.3)'
    ctx.fillRect(x - size * 0.25, y - size * 0.1, size * 0.08, size * 0.4)
    ctx.fillRect(x - size * 0.04, y - size * 0.1, size * 0.08, size * 0.4)
    ctx.fillRect(x + size * 0.17, y - size * 0.1, size * 0.08, size * 0.4)
  },
  Manufacturing: (ctx, x, y, size, color) => {
    // Factory with smokestacks
    ctx.fillStyle = color
    // Main building
    ctx.fillRect(x - size * 0.35, y - size * 0.1, size * 0.5, size * 0.45)
    // Roof slope
    ctx.beginPath()
    ctx.moveTo(x - size * 0.35, y - size * 0.1)
    ctx.lineTo(x - size * 0.1, y - size * 0.35)
    ctx.lineTo(x + size * 0.15, y - size * 0.1)
    ctx.fill()
    // Smokestacks
    ctx.fillRect(x + size * 0.2, y - size * 0.35, size * 0.08, size * 0.25)
    ctx.fillRect(x + size * 0.32, y - size * 0.3, size * 0.08, size * 0.2)
  },
  Technology: (ctx, x, y, size, color) => {
    // Server/Computer
    ctx.fillStyle = color
    // Monitor
    ctx.fillRect(x - size * 0.3, y - size * 0.35, size * 0.6, size * 0.45)
    ctx.fillStyle = 'rgba(0,0,0,0.4)'
    ctx.fillRect(x - size * 0.25, y - size * 0.3, size * 0.5, size * 0.35)
    // Stand
    ctx.fillStyle = color
    ctx.fillRect(x - size * 0.08, y + size * 0.1, size * 0.16, size * 0.15)
    ctx.fillRect(x - size * 0.2, y + size * 0.25, size * 0.4, size * 0.08)
  },
  Healthcare: (ctx, x, y, size, color) => {
    // Medical cross
    ctx.fillStyle = color
    ctx.fillRect(x - size * 0.1, y - size * 0.35, size * 0.2, size * 0.7)
    ctx.fillRect(x - size * 0.35, y - size * 0.1, size * 0.7, size * 0.2)
  },
  Logistics: (ctx, x, y, size, color) => {
    // Ship/Container
    ctx.fillStyle = color
    // Hull
    ctx.beginPath()
    ctx.moveTo(x - size * 0.4, y + size * 0.1)
    ctx.lineTo(x - size * 0.3, y + size * 0.35)
    ctx.lineTo(x + size * 0.3, y + size * 0.35)
    ctx.lineTo(x + size * 0.4, y + size * 0.1)
    ctx.closePath()
    ctx.fill()
    // Container
    ctx.fillRect(x - size * 0.25, y - size * 0.2, size * 0.5, size * 0.3)
    ctx.fillStyle = 'rgba(0,0,0,0.2)'
    ctx.fillRect(x - size * 0.22, y - size * 0.15, size * 0.2, size * 0.2)
    ctx.fillRect(x + size * 0.02, y - size * 0.15, size * 0.2, size * 0.2)
  },
  Infrastructure: (ctx, x, y, size, color) => {
    // Tower/Bridge
    ctx.fillStyle = color
    // Towers
    ctx.fillRect(x - size * 0.35, y - size * 0.4, size * 0.15, size * 0.75)
    ctx.fillRect(x + size * 0.2, y - size * 0.4, size * 0.15, size * 0.75)
    // Bridge deck
    ctx.fillRect(x - size * 0.4, y + size * 0.1, size * 0.8, size * 0.1)
    // Cables
    ctx.strokeStyle = color
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(x - size * 0.275, y - size * 0.35)
    ctx.quadraticCurveTo(x, y + size * 0.05, x + size * 0.275, y - size * 0.35)
    ctx.stroke()
  },
  Default: (ctx, x, y, size, color) => {
    // Office building
    ctx.fillStyle = color
    ctx.fillRect(x - size * 0.3, y - size * 0.35, size * 0.6, size * 0.7)
    // Windows
    ctx.fillStyle = 'rgba(255,255,255,0.3)'
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 2; col++) {
        ctx.fillRect(
          x - size * 0.2 + col * size * 0.25,
          y - size * 0.25 + row * size * 0.2,
          size * 0.15,
          size * 0.12
        )
      }
    }
  },
}

// Main Component
export interface CascadeVisualizerProps {
  cityId?: string
  scenarioId?: string
}

export default function CascadeVisualizer({ cityId, scenarioId }: CascadeVisualizerProps = {}) {
  const graphRef = useRef<ForceGraphMethods>()
  const containerRef = useRef<HTMLDivElement>(null)
  const [dimensions, setDimensions] = useState({ width: 1200, height: 896 })
  const [selectedNode, setSelectedNode] = useState<FGNode | null>(null)
  const [triggerNode, setTriggerNode] = useState<string>('asset_0')
  const [triggerSeverity, setTriggerSeverity] = useState(0.8)
  const [graphData, setGraphData] = useState<{ nodes: GraphNode[]; edges: GraphEdge[] }>({ nodes: [], edges: [] })
  
  // Responsive dimensions - 20% smaller height (from previous size)
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        setDimensions({ 
          width: Math.max(1000, rect.width), 
          height: Math.max(1152, (window.innerHeight * 1.5) * 0.64) 
        })
      }
    }
    updateDimensions()
    window.addEventListener('resize', updateDimensions)
    return () => window.removeEventListener('resize', updateDimensions)
  }, [])
  
  // Create sample graph
  const createGraphMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/whatif/cascade/sample?num_nodes=25', { method: 'POST' })
      if (!res.ok) throw new Error('Failed to create graph')
      return res.json()
    },
    onSuccess: () => fetchGraph(),
  })

  // Build graph from city and scenario context
  const buildFromContextMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/whatif/cascade/build-from-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city_id: cityId!, scenario_id: scenarioId! }),
      })
      if (!res.ok) throw new Error('Failed to build graph from context')
      return res.json() as Promise<{ nodes: GraphNode[]; edges: GraphEdge[] }>
    },
    onSuccess: (data) => {
      setGraphData({ nodes: data.nodes, edges: data.edges })
      if (data.nodes.length > 0) setTriggerNode(data.nodes[0].id)
      simulateMutation.reset()
    },
  })
  
  // Fetch graph
  const fetchGraph = async () => {
    const res = await fetch('/api/v1/whatif/cascade/graph')
    if (res.ok) {
      const data = await res.json()
      setGraphData(data)
      if (data.nodes.length > 0) {
        setTriggerNode(data.nodes[0].id)
      }
    }
  }
  
  // Simulate cascade
  const simulateMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/whatif/cascade/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          trigger_node_id: triggerNode,
          trigger_severity: triggerSeverity,
          max_steps: 10,
          propagation_threshold: 0.1,
        }),
      })
      if (!res.ok) throw new Error('Failed to simulate cascade')
      return res.json() as Promise<CascadeResult>
    },
  })
  
  // Vulnerability analysis
  const vulnerabilityMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/v1/whatif/cascade/vulnerability')
      if (!res.ok) throw new Error('Failed to analyze vulnerability')
      return res.json() as Promise<VulnerabilityResult>
    },
  })
  
  // Initialize: build-from-context when both cityId and scenarioId set, else sample
  useEffect(() => {
    if (cityId && scenarioId) {
      buildFromContextMutation.mutate()
    } else {
      createGraphMutation.mutate()
    }
  }, [cityId, scenarioId])
  
  // Configure force simulation after graph loads
  useEffect(() => {
    if (graphRef.current && graphData.nodes.length > 0) {
      // Increase repulsion force to spread nodes even further apart
      graphRef.current.d3Force('charge')?.strength(-2000)  // Increased for more spacing between nodes
      graphRef.current.d3Force('link')?.distance(400)  // Increased to spread nodes further apart
      // Add center force
      graphRef.current.d3Force('center')?.strength(0.05)
    }
  }, [graphData])
  
  // Prepare graph data for ForceGraph
  const forceGraphData = useMemo(() => {
    const cascadeResult = simulateMutation.data
    
    const nodes: FGNode[] = graphData.nodes.map(node => {
      const config = sectorConfig[node.sector] || sectorConfig.Default
      const isAffected = cascadeResult?.affected_nodes.includes(node.id) || false
      const isTrigger = cascadeResult?.trigger_node === node.id
      const isContainment = cascadeResult?.containment_points.includes(node.id) || false
      const impact = cascadeResult?.node_impacts[node.id] || 0
      
      return {
        ...node,
        color: isTrigger ? '#8a4a4a' : isContainment ? '#4a7a5a' : isAffected ? `rgba(138, 74, 74, ${0.5 + impact * 0.5})` : config.color,
        isAffected,
        isTrigger,
        isContainment,
        impact,
      }
    })
    
    const links: FGLink[] = graphData.edges.map(edge => {
      const isActive = cascadeResult && (
        cascadeResult.affected_nodes.includes(edge.source as string) ||
        cascadeResult.affected_nodes.includes(edge.target as string) ||
        edge.source === cascadeResult.trigger_node ||
        edge.target === cascadeResult.trigger_node
      )
      
      return {
        source: edge.source,
        target: edge.target,
        type: edge.type,
        weight: edge.weight,
        isActive,
      }
    })
    
    return { nodes, links }
  }, [graphData, simulateMutation.data])
  
  // Custom node rendering with professional icons
  const nodeCanvasObject = useCallback((node: FGNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const x = node.x || 0
    const y = node.y || 0
    const baseSize = 22 + Math.log10(node.value / 1_000_000 + 1) * 6
    const size = baseSize
    
    // Glow effect for affected/trigger nodes - MUTED
    if (node.isTrigger || node.isAffected) {
      const glowSize = size * 1.8
      const gradient = ctx.createRadialGradient(x, y, size * 0.5, x, y, glowSize)
      
      if (node.isTrigger) {
        gradient.addColorStop(0, 'rgba(138, 74, 74, 0.6)')
        gradient.addColorStop(0.5, 'rgba(138, 74, 74, 0.3)')
        gradient.addColorStop(1, 'transparent')
      } else {
        const intensity = node.impact || 0.3
        gradient.addColorStop(0, `rgba(138, 74, 74, ${intensity * 0.4})`)
        gradient.addColorStop(0.5, `rgba(138, 74, 74, ${intensity * 0.2})`)
        gradient.addColorStop(1, 'transparent')
      }
      
      ctx.beginPath()
      ctx.arc(x, y, glowSize, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()
    }
    
    // Containment point glow - MUTED green
    if (node.isContainment) {
      const glowSize = size * 1.6
      const gradient = ctx.createRadialGradient(x, y, size * 0.5, x, y, glowSize)
      gradient.addColorStop(0, 'rgba(74, 122, 90, 0.5)')
      gradient.addColorStop(0.5, 'rgba(74, 122, 90, 0.2)')
      gradient.addColorStop(1, 'transparent')
      ctx.beginPath()
      ctx.arc(x, y, glowSize, 0, Math.PI * 2)
      ctx.fillStyle = gradient
      ctx.fill()
    }
    
    // Main node circle with gradient
    const baseColor = node.color || '#6b7280'
    
    // Outer ring - subtle
    ctx.beginPath()
    ctx.arc(x, y, size + 2, 0, Math.PI * 2)
    ctx.fillStyle = node.isTrigger ? 'rgba(255,255,255,0.6)' : node.isContainment ? 'rgba(74, 122, 90, 0.6)' : 'rgba(255,255,255,0.1)'
    ctx.fill()
    
    // Main circle
    ctx.beginPath()
    ctx.arc(x, y, size, 0, Math.PI * 2)
    const nodeGradient = ctx.createRadialGradient(x - size * 0.3, y - size * 0.3, 0, x, y, size * 1.2)
    nodeGradient.addColorStop(0, lightenColor(baseColor, 40))
    nodeGradient.addColorStop(0.5, baseColor)
    nodeGradient.addColorStop(1, darkenColor(baseColor, 20))
    ctx.fillStyle = nodeGradient
    ctx.fill()
    
    // Draw sector icon
    const iconSize = size * 0.7
    const iconColor = 'rgba(255,255,255,0.9)'
    const drawIcon = sectorIcons[node.sector] || sectorIcons.Default
    drawIcon(ctx, x, y, iconSize, iconColor)
    
    // Label with background - just number
    const label = node.id.replace('asset_', '')
    const labelFontSize = 11
    ctx.font = `600 ${labelFontSize}px Inter, system-ui, sans-serif`
    const textWidth = ctx.measureText(label).width
    const padding = 6
    const labelY = y + size + 18
    
    // Label pill
    const pillHeight = labelFontSize + padding * 2
    const pillWidth = textWidth + padding * 3 + 10
    const pillX = x - pillWidth / 2
    const pillY = labelY - pillHeight / 2
    const radius = 4
    
    // Shadow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)'
    ctx.beginPath()
    roundRect(ctx, pillX + 2, pillY + 2, pillWidth, pillHeight, radius)
    ctx.fill()
    
    // Pill background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)'
    ctx.beginPath()
    roundRect(ctx, pillX, pillY, pillWidth, pillHeight, radius)
    ctx.fill()
    
    // Left border accent
    ctx.fillStyle = baseColor
    ctx.beginPath()
    roundRect(ctx, pillX, pillY, 4, pillHeight, [radius, 0, 0, radius])
    ctx.fill()
    
    // Label text
    ctx.fillStyle = '#ffffff'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.fillText(label, pillX + 10, labelY)
  }, [])
  
  // Custom link rendering
  const linkCanvasObject = useCallback((link: FGLink, ctx: CanvasRenderingContext2D, globalScale: number) => {
    const source = link.source as FGNode
    const target = link.target as FGNode
    
    if (!source.x || !source.y || !target.x || !target.y) return
    
    const isActive = link.isActive
    
    // Draw link
    ctx.beginPath()
    ctx.moveTo(source.x, source.y)
    ctx.lineTo(target.x, target.y)
    
    if (isActive) {
      // Animated glow for active links - muted
      ctx.strokeStyle = 'rgba(138, 74, 74, 0.3)'
      ctx.lineWidth = 4
      ctx.stroke()
      
      ctx.strokeStyle = 'rgba(138, 74, 74, 0.7)'
      ctx.lineWidth = 1.5
    } else {
      ctx.strokeStyle = 'rgba(100, 116, 139, 0.2)'
      ctx.lineWidth = 1
    }
    ctx.stroke()
    
    // Arrow
    const angle = Math.atan2(target.y - source.y, target.x - source.x)
    const arrowLen = 8
    const arrowPos = 0.65
    const arrowX = source.x + (target.x - source.x) * arrowPos
    const arrowY = source.y + (target.y - source.y) * arrowPos
    
    ctx.beginPath()
    ctx.moveTo(arrowX, arrowY)
    ctx.lineTo(
      arrowX - arrowLen * Math.cos(angle - Math.PI / 7),
      arrowY - arrowLen * Math.sin(angle - Math.PI / 7)
    )
    ctx.lineTo(
      arrowX - arrowLen * Math.cos(angle + Math.PI / 7),
      arrowY - arrowLen * Math.sin(angle + Math.PI / 7)
    )
    ctx.closePath()
    ctx.fillStyle = isActive ? 'rgba(138, 74, 74, 0.7)' : 'rgba(100, 116, 139, 0.3)'
    ctx.fill()
  }, [])
  
  // Handle node click
  const handleNodeClick = useCallback((node: FGNode) => {
    setSelectedNode(node)
    setTriggerNode(node.id)
    
    if (graphRef.current) {
      graphRef.current.centerAt(node.x, node.y, 800)
      graphRef.current.zoom(1.5, 800)
    }
  }, [])
  
  return (
    <div className="space-y-4">
      {/* Graph Container - FULL WIDTH */}
      <div className="glass rounded-2xl p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <ShareIcon className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-display font-semibold">Cascade Analysis</h2>
            <span className="text-[10px] px-2 py-0.5 bg-purple-500/20 text-purple-400 rounded-full">
              Force-Directed Graph
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <button
              onClick={() => vulnerabilityMutation.mutate()}
              disabled={vulnerabilityMutation.isPending}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white/60 flex items-center gap-2 transition-colors"
            >
              <ShieldCheckIcon className="w-4 h-4" />
              Analyze Vulnerability
            </button>
            <button
              onClick={() => {
                if (cityId && scenarioId) {
                  buildFromContextMutation.mutate()
                } else {
                  createGraphMutation.mutate()
                  simulateMutation.reset()
                }
              }}
              disabled={createGraphMutation.isPending || buildFromContextMutation.isPending}
              className="px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-sm text-white/60 flex items-center gap-2 transition-colors"
            >
              <ArrowPathIcon className={`w-4 h-4 ${(createGraphMutation.isPending || buildFromContextMutation.isPending) ? 'animate-spin' : ''}`} />
              Reset Graph
            </button>
          </div>
        </div>
        
        {/* Main Graph - LARGER */}
        <div 
          ref={containerRef}
          className="bg-[#050a12] rounded-xl border border-white/10 overflow-hidden relative"
          style={{ height: dimensions.height }}
        >
          {/* Grid background */}
          <div 
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage: `
                linear-gradient(rgba(59, 130, 246, 0.08) 1px, transparent 1px),
                linear-gradient(90deg, rgba(59, 130, 246, 0.08) 1px, transparent 1px)
              `,
              backgroundSize: '50px 50px',
            }}
          />
          
          {/* Radial gradient overlay */}
          <div 
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'radial-gradient(ellipse at center, transparent 30%, rgba(5, 10, 18, 0.8) 100%)',
            }}
          />
          
          {/* Force Graph */}
          {graphData.nodes.length > 0 && (
            <ForceGraph2D
              ref={graphRef}
              graphData={forceGraphData}
              width={dimensions.width}
              height={dimensions.height}
              backgroundColor="transparent"
              nodeCanvasObject={nodeCanvasObject}
              nodePointerAreaPaint={(node, color, ctx) => {
                const size = 25
                ctx.beginPath()
                ctx.arc(node.x || 0, node.y || 0, size, 0, Math.PI * 2)
                ctx.fillStyle = color
                ctx.fill()
              }}
              linkCanvasObject={linkCanvasObject}
              linkDirectionalParticles={2}
              linkDirectionalParticleSpeed={0.003}
              linkDirectionalParticleWidth={2}
              linkDirectionalParticleColor={(link: any) => link.isActive ? '#8a4a4a' : '#4a5568'}
              onNodeClick={handleNodeClick}
              cooldownTicks={200}
              d3AlphaDecay={0.01}
              d3VelocityDecay={0.2}
              warmupTicks={100}
              enableNodeDrag={true}
              enableZoomPanInteraction={true}
              minZoom={0.3}
              maxZoom={4}
            />
          )}
          
          {/* Loading overlay */}
          {(createGraphMutation.isPending || buildFromContextMutation.isPending) && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-3">
                <div className="w-10 h-10 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm text-white/60">Generating network...</span>
              </div>
            </div>
          )}
        </div>
        
        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-6 text-xs text-white/50">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#8a4a4a' }} />
            <span>Trigger Node</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: 'rgba(138, 74, 74, 0.6)' }} />
            <span>Affected</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#4a7a5a' }} />
            <span>Containment Point</span>
          </div>
          <div className="w-px h-4 bg-white/20" />
          {Object.entries(sectorConfig).slice(0, 6).map(([sector, config]) => (
            <div key={sector} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: config.color }} />
              <span>{config.label}</span>
            </div>
          ))}
        </div>
      </div>
      
      {/* Controls Row */}
      <div className="grid grid-cols-4 gap-4">
        {/* Simulation Controls */}
        <div className="glass rounded-xl p-4 space-y-4">
          <h3 className="text-sm font-medium text-white/80 flex items-center gap-2">
            <BoltIcon className="w-4 h-4 text-red-400" />
            Cascade Trigger
          </h3>
          
          <div>
            <label className="text-xs text-white/40 mb-1 block">Trigger Node</label>
            <select
              value={triggerNode}
              onChange={(e) => setTriggerNode(e.target.value)}
              className="w-full px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-white"
            >
              {graphData.nodes.map(n => (
                <option key={n.id} value={n.id}>{n.name}</option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="text-xs text-white/40 mb-1 block">
              Severity: {(triggerSeverity * 100).toFixed(0)}%
            </label>
            <input
              type="range"
              min={0.1}
              max={1}
              step={0.1}
              value={triggerSeverity}
              onChange={(e) => setTriggerSeverity(parseFloat(e.target.value))}
              className="w-full accent-red-500"
            />
          </div>
          
          <button
            onClick={() => simulateMutation.mutate()}
            disabled={simulateMutation.isPending}
            className="w-full py-3 bg-primary-500/20 hover:bg-primary-500/30 border border-primary-500/30 text-primary-300 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all"
          >
            {simulateMutation.isPending ? (
              <ArrowPathIcon className="w-4 h-4 animate-spin" />
            ) : (
              <PlayIcon className="w-4 h-4" />
            )}
            Simulate Cascade
          </button>
        </div>
        
        {/* Selected Node Info */}
        <div className="glass rounded-xl p-4">
          <h3 className="text-sm font-medium text-white/80 mb-3">Selected Node</h3>
          {selectedNode ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-medium text-white">{selectedNode.name}</span>
                <div 
                  className="w-4 h-4 rounded-full" 
                  style={{ backgroundColor: sectorConfig[selectedNode.sector]?.color || '#6b7280' }}
                />
              </div>
              
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-white/40">Value</span>
                  <div className="text-white font-medium">{formatCurrency(selectedNode.value)}</div>
                </div>
                <div>
                  <span className="text-white/40">Risk Score</span>
                  <div className="text-white font-medium">{selectedNode.risk_score.toFixed(0)}</div>
                </div>
                <div>
                  <span className="text-white/40">Sector</span>
                  <div className="text-white">{selectedNode.sector}</div>
                </div>
                <div>
                  <span className="text-white/40">Region</span>
                  <div className="text-white">{selectedNode.region}</div>
                </div>
              </div>
              
              {selectedNode.impact !== undefined && selectedNode.impact > 0 && (
                <div className="pt-3 border-t border-white/10">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-white/40">Cascade Impact</span>
                    <span className="text-white/70 font-medium">{(selectedNode.impact * 100).toFixed(0)}%</span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div 
                      className="h-full bg-accent-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${selectedNode.impact * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-white/40">Click a node to view details</p>
          )}
        </div>
        
        {/* Cascade Results */}
        <div className="glass rounded-xl p-4">
          <h3 className="text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
            <ExclamationTriangleIcon className="w-4 h-4 text-red-400" />
            Cascade Impact
          </h3>
          
          {simulateMutation.data ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="text-center p-3 bg-white/5 rounded-lg border border-white/10">
                  <div className="text-2xl font-bold text-white/80">
                    {simulateMutation.data.affected_count}
                  </div>
                  <div className="text-[10px] text-white/40">Nodes Affected</div>
                </div>
                <div className="text-center p-3 bg-white/5 rounded-lg border border-white/10">
                  <div className="text-lg font-bold text-accent-400">
                    {formatCurrency(simulateMutation.data.total_loss)}
                  </div>
                  <div className="text-[10px] text-white/40">Total Loss</div>
                </div>
              </div>
              
              {simulateMutation.data.containment_points.length > 0 && (
                <div>
                  <span className="text-xs text-white/40">Containment Points</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {simulateMutation.data.containment_points.map(p => (
                      <span key={p} className="text-xs px-2 py-0.5 bg-white/5 text-white/70 rounded border border-white/10">
                        {p.replace('asset_', 'A')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-white/40">Run simulation to see results</p>
          )}
        </div>
        
        {/* Vulnerability Analysis */}
        <div className="glass rounded-xl p-4">
          <h3 className="text-sm font-medium text-white/80 mb-3 flex items-center gap-2">
            <ShieldCheckIcon className="w-4 h-4 text-emerald-400" />
            Network Resilience
          </h3>
          
          {vulnerabilityMutation.data ? (
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-white/40">Resilience Score</span>
                  <span className="font-bold text-lg">
                    {vulnerabilityMutation.data.network_resilience_score.toFixed(0)}%
                  </span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <motion.div 
                    className={`h-full rounded-full ${
                      vulnerabilityMutation.data.network_resilience_score >= 70 ? 'bg-primary-500' :
                      vulnerabilityMutation.data.network_resilience_score >= 40 ? 'bg-accent-500' : 
                      'bg-white/40'
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${vulnerabilityMutation.data.network_resilience_score}%` }}
                    transition={{ duration: 1 }}
                  />
                </div>
              </div>
              
              {vulnerabilityMutation.data.single_points_of_failure.length > 0 && (
                <div>
                  <span className="text-xs text-white/40">Single Points of Failure</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {vulnerabilityMutation.data.single_points_of_failure.slice(0, 4).map(s => (
                      <span key={s} className="text-xs px-2 py-0.5 bg-white/5 text-white/60 rounded border border-white/10">
                        {s.replace('asset_', 'A')}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-white/40">Click Analyze to check vulnerability</p>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper: Round rect
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number | number[]) {
  const radii = Array.isArray(r) ? r : [r, r, r, r]
  ctx.moveTo(x + radii[0], y)
  ctx.lineTo(x + w - radii[1], y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + radii[1])
  ctx.lineTo(x + w, y + h - radii[2])
  ctx.quadraticCurveTo(x + w, y + h, x + w - radii[2], y + h)
  ctx.lineTo(x + radii[3], y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - radii[3])
  ctx.lineTo(x, y + radii[0])
  ctx.quadraticCurveTo(x, y, x + radii[0], y)
}

// Helper: Lighten color
function lightenColor(color: string, percent: number): string {
  if (color.startsWith('rgba')) return color
  const num = parseInt(color.replace('#', ''), 16)
  const amt = Math.round(2.55 * percent)
  const R = Math.min(255, (num >> 16) + amt)
  const G = Math.min(255, ((num >> 8) & 0x00FF) + amt)
  const B = Math.min(255, (num & 0x0000FF) + amt)
  return `rgb(${R}, ${G}, ${B})`
}

// Helper: Darken color
function darkenColor(color: string, percent: number): string {
  if (color.startsWith('rgba')) return color
  const num = parseInt(color.replace('#', ''), 16)
  const amt = Math.round(2.55 * percent)
  const R = Math.max(0, (num >> 16) - amt)
  const G = Math.max(0, ((num >> 8) & 0x00FF) - amt)
  const B = Math.max(0, (num & 0x0000FF) - amt)
  return `rgb(${R}, ${G}, ${B})`
}
