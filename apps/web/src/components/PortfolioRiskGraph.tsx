/**
 * Portfolio Risk Graph
 * ====================
 * 
 * 3D force-directed graph visualization for asset interconnections
 * and cascading risk propagation.
 */
import { useRef, useCallback, useMemo, useEffect, useState } from 'react'
import ForceGraph3D, { ForceGraphMethods } from 'react-force-graph-3d'
import { motion, AnimatePresence } from 'framer-motion'
import * as THREE from 'three'

// Node types with icons
type NodeType = 'office' | 'refinery' | 'port' | 'datacenter' | 'bank' | 'factory' | 'energy' | 'transport'

interface GraphNode {
  id: string
  name: string
  type: NodeType
  value: number  // exposure in billions
  risk: number   // 0-1
  x?: number
  y?: number
  z?: number
}

interface GraphLink {
  source: string
  target: string
  strength: number  // 0-1 correlation strength
  type: 'supply' | 'financial' | 'operational' | 'geographic'
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

interface PortfolioRiskGraphProps {
  isOpen: boolean
  onClose: () => void
  scenario?: string
  onNodeClick?: (node: GraphNode) => void
}

// Generate demo data for portfolio risk graph
function generateGraphData(scenario: string): GraphData {
  const nodes: GraphNode[] = [
    { id: 'office-1', name: 'Office Tower', type: 'office', value: 12.5, risk: 0.65 },
    { id: 'refinery-1', name: 'Oil Refinery', type: 'refinery', value: 45.2, risk: 0.82 },
    { id: 'port-1', name: 'Shipping Port', type: 'port', value: 28.7, risk: 0.71 },
    { id: 'datacenter-1', name: 'Data Center', type: 'datacenter', value: 18.3, risk: 0.45 },
    { id: 'bank-1', name: 'Investment Bank', type: 'bank', value: 67.5, risk: 0.58 },
    { id: 'factory-1', name: 'Manufacturing Plant', type: 'factory', value: 22.1, risk: 0.76 },
    { id: 'energy-1', name: 'Power Grid', type: 'energy', value: 34.8, risk: 0.89 },
    { id: 'transport-1', name: 'Logistics Hub', type: 'transport', value: 15.6, risk: 0.52 },
    { id: 'office-2', name: 'Corporate HQ', type: 'office', value: 8.9, risk: 0.38 },
    { id: 'refinery-2', name: 'Gas Terminal', type: 'refinery', value: 31.4, risk: 0.74 },
    { id: 'bank-2', name: 'Regional Bank', type: 'bank', value: 19.2, risk: 0.61 },
    { id: 'factory-2', name: 'Auto Factory', type: 'factory', value: 27.8, risk: 0.83 },
  ]
  
  const links: GraphLink[] = [
    { source: 'refinery-1', target: 'port-1', strength: 0.9, type: 'supply' },
    { source: 'refinery-1', target: 'energy-1', strength: 0.85, type: 'operational' },
    { source: 'energy-1', target: 'factory-1', strength: 0.95, type: 'operational' },
    { source: 'energy-1', target: 'datacenter-1', strength: 0.88, type: 'operational' },
    { source: 'port-1', target: 'transport-1', strength: 0.82, type: 'supply' },
    { source: 'port-1', target: 'factory-2', strength: 0.75, type: 'supply' },
    { source: 'bank-1', target: 'office-1', strength: 0.7, type: 'financial' },
    { source: 'bank-1', target: 'refinery-1', strength: 0.8, type: 'financial' },
    { source: 'bank-1', target: 'factory-1', strength: 0.65, type: 'financial' },
    { source: 'bank-2', target: 'office-2', strength: 0.72, type: 'financial' },
    { source: 'bank-2', target: 'factory-2', strength: 0.68, type: 'financial' },
    { source: 'factory-1', target: 'transport-1', strength: 0.78, type: 'supply' },
    { source: 'factory-2', target: 'transport-1', strength: 0.71, type: 'supply' },
    { source: 'datacenter-1', target: 'office-1', strength: 0.55, type: 'operational' },
    { source: 'datacenter-1', target: 'bank-1', strength: 0.6, type: 'operational' },
    { source: 'refinery-2', target: 'energy-1', strength: 0.88, type: 'supply' },
    { source: 'refinery-2', target: 'port-1', strength: 0.72, type: 'supply' },
  ]
  
  return { nodes, links }
}

// Get color based on risk level
function getRiskColor(risk: number): string {
  if (risk > 0.8) return '#ef4444'  // red
  if (risk > 0.6) return '#f97316'  // orange
  if (risk > 0.4) return '#eab308'  // yellow
  return '#22c55e'  // green
}

// Get link color based on type
function getLinkColor(type: string, strength: number): string {
  const alpha = Math.min(strength * 0.8 + 0.2, 1)
  switch (type) {
    case 'supply': return `rgba(59, 130, 246, ${alpha})`  // blue
    case 'financial': return `rgba(168, 85, 247, ${alpha})`  // purple
    case 'operational': return `rgba(249, 115, 22, ${alpha})`  // orange
    case 'geographic': return `rgba(34, 197, 94, ${alpha})`  // green
    default: return `rgba(156, 163, 175, ${alpha})`  // gray
  }
}

export default function PortfolioRiskGraph({ isOpen, onClose, scenario = 'default', onNodeClick }: PortfolioRiskGraphProps) {
  const graphRef = useRef<ForceGraphMethods>()
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] })
  
  // Calculate portfolio stats
  const stats = useMemo(() => {
    const totalExposure = graphData.nodes.reduce((sum, n) => sum + n.value, 0)
    const atRisk = graphData.nodes.reduce((sum, n) => sum + n.value * n.risk, 0)
    const criticalLinks = graphData.links.filter(l => l.strength > 0.8).length
    const hasCascade = graphData.nodes.some(n => n.risk > 0.85)
    return { totalExposure, atRisk, criticalLinks, hasCascade }
  }, [graphData])
  
  // Initialize graph data
  useEffect(() => {
    if (isOpen) {
      setGraphData(generateGraphData(scenario))
    }
  }, [isOpen, scenario])
  
  // Custom node rendering
  const nodeThreeObject = useCallback((node: GraphNode) => {
    const group = new THREE.Group()
    
    // Main sphere
    const geometry = new THREE.SphereGeometry(Math.sqrt(node.value) * 0.8 + 3, 16, 16)
    const material = new THREE.MeshPhongMaterial({
      color: getRiskColor(node.risk),
      emissive: getRiskColor(node.risk),
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.9,
    })
    const sphere = new THREE.Mesh(geometry, material)
    group.add(sphere)
    
    // Glow ring for high risk
    if (node.risk > 0.7) {
      const ringGeometry = new THREE.RingGeometry(
        Math.sqrt(node.value) * 0.8 + 5,
        Math.sqrt(node.value) * 0.8 + 7,
        32
      )
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: getRiskColor(node.risk),
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
      })
      const ring = new THREE.Mesh(ringGeometry, ringMaterial)
      ring.rotation.x = Math.PI / 2
      group.add(ring)
    }
    
    // Label
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    canvas.width = 256
    canvas.height = 64
    ctx.fillStyle = 'rgba(0,0,0,0.7)'
    ctx.fillRect(0, 0, 256, 64)
    ctx.fillStyle = 'white'
    ctx.font = 'bold 20px "JetBrains Mono", monospace'
    ctx.textAlign = 'center'
    ctx.fillText(node.name, 128, 38)
    
    const texture = new THREE.CanvasTexture(canvas)
    const labelMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true })
    const label = new THREE.Sprite(labelMaterial)
    label.scale.set(40, 10, 1)
    label.position.y = Math.sqrt(node.value) * 0.8 + 12
    group.add(label)
    
    return group
  }, [])
  
  // Handle node click
  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node)
    onNodeClick?.(node)
    
    // Zoom to node
    if (graphRef.current) {
      graphRef.current.cameraPosition(
        { x: node.x! + 80, y: node.y! + 40, z: node.z! + 80 },
        { x: node.x!, y: node.y!, z: node.z! },
        1000
      )
    }
  }, [onNodeClick])
  
  if (!isOpen) return null
  
  return (
    <AnimatePresence>
      <motion.div
        className="absolute inset-8 z-50 pointer-events-auto"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.3 }}
      >
        <div className="h-full bg-black/95 rounded-md border border-zinc-700 overflow-hidden flex">
          {/* Graph Container */}
          <div className="flex-1 relative">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 z-10 p-4 flex items-center justify-between bg-gradient-to-b from-black/80 to-transparent">
              <h2 className="text-zinc-100 text-xl font-light">Portfolio Risk Graph</h2>
              <div className="flex items-center gap-2">
                <button className="p-2 bg-zinc-700 rounded-md hover:bg-zinc-600 transition-colors">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </button>
                <button className="p-2 bg-zinc-700 rounded-md hover:bg-zinc-600 transition-colors">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* 3D Graph */}
            <ForceGraph3D
              ref={graphRef}
              graphData={graphData}
              nodeThreeObject={nodeThreeObject}
              nodeThreeObjectExtend={false}
              linkColor={(link: GraphLink) => getLinkColor(link.type, link.strength)}
              linkWidth={(link: GraphLink) => link.strength * 3}
              linkOpacity={0.6}
              linkDirectionalParticles={2}
              linkDirectionalParticleWidth={2}
              linkDirectionalParticleSpeed={0.005}
              backgroundColor="rgba(0,0,0,0)"
              onNodeClick={handleNodeClick}
              enableNodeDrag={true}
              enableNavigationControls={true}
              showNavInfo={false}
            />
            
            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-black/60 rounded-md p-3 border border-zinc-700">
              <div className="text-zinc-400 text-[10px] uppercase tracking-wider mb-2">Link Types</div>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-0.5 bg-blue-500 rounded" />
                  <span className="text-zinc-400">Supply Chain</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-0.5 bg-purple-500 rounded" />
                  <span className="text-zinc-400">Financial</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-0.5 bg-orange-500 rounded" />
                  <span className="text-zinc-400">Operational</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Sidebar - Stats & Details */}
          <div className="w-72 border-l border-zinc-700 p-4 bg-zinc-900/50 flex flex-col">
            {/* Portfolio Stats */}
            <div className="space-y-3 mb-6">
              <div className="bg-zinc-800 rounded-md p-3 border border-zinc-700">
                <div className="text-zinc-400 text-xs uppercase tracking-wider mb-1">At Risk</div>
                <div className="text-red-400/80 text-2xl font-light">${stats.atRisk.toFixed(1)}B</div>
              </div>
              <div className="bg-zinc-800 rounded-md p-3 border border-zinc-700">
                <div className="text-zinc-400 text-xs uppercase tracking-wider mb-1">Critical Links</div>
                <div className="text-orange-400/80 text-2xl font-light">{stats.criticalLinks}</div>
              </div>
              {stats.hasCascade && (
                <div className="bg-red-500/10 rounded-md p-3 border border-red-500/30">
                  <div className="text-red-400/80 text-sm font-medium flex items-center gap-2">
                    <svg className="w-4 h-4 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                    </svg>
                    Cascading Failure Detected
                  </div>
                </div>
              )}
            </div>
            
            {/* Results Chart Placeholder */}
            <div className="flex-1 bg-zinc-800 rounded-md p-3 border border-zinc-700 mb-4">
              <div className="text-zinc-400 text-xs uppercase tracking-wider mb-3">Results</div>
              <div className="flex items-end gap-2 h-24">
                <div className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-blue-500 rounded-t" style={{ height: '60%' }} />
                  <span className="text-zinc-500 text-[10px]">T0</span>
                </div>
                <div className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-orange-500 rounded-t" style={{ height: '75%' }} />
                  <span className="text-zinc-500 text-[10px]">+1 Year</span>
                </div>
                <div className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-red-500 rounded-t" style={{ height: '90%' }} />
                  <span className="text-zinc-500 text-[10px]">+3 Years</span>
                </div>
              </div>
            </div>
            
            {/* Selected Node Details */}
            {selectedNode && (
              <div className="bg-zinc-800 rounded-md p-3 border border-zinc-700 mb-4">
                <div className="text-zinc-400 text-xs uppercase tracking-wider mb-2">Selected Asset</div>
                <div className="text-zinc-100 font-medium mb-1">{selectedNode.name}</div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-zinc-500">Exposure:</span>
                    <span className="text-zinc-100 ml-1">${selectedNode.value}B</span>
                  </div>
                  <div>
                    <span className="text-zinc-500">Risk:</span>
                    <span className={`ml-1 ${selectedNode.risk > 0.7 ? 'text-red-400/80' : selectedNode.risk > 0.5 ? 'text-orange-400/80' : 'text-green-400/80'}`}>
                      {(selectedNode.risk * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Actions */}
            <div className="space-y-2">
              <button className="w-full px-4 py-2 bg-zinc-700 text-zinc-300 rounded-md border border-zinc-600 hover:bg-zinc-600 transition-colors text-sm flex items-center justify-center gap-2">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Run Cascade Simulation
              </button>
              <button className="w-full px-4 py-2 bg-zinc-800 text-zinc-400 rounded-md border border-zinc-700 hover:bg-zinc-700 transition-colors text-sm">
                Export Network Analysis
              </button>
            </div>
          </div>
          
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-zinc-700 rounded-md hover:bg-zinc-600 transition-colors z-20"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
