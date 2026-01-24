/**
 * Portfolio Risk Graph - Network visualization matching reference
 * 
 * Features:
 * - Main nodes: Office Tower (green), Oil Refinery (red), Shipping Port (orange), Data Center (green)
 * - Central orange hub
 * - Small white nodes
 * - Animated connections
 * - Results panel on right
 */
import { useState, useEffect } from 'react'

interface RiskGraphPanelProps {
  data: {
    atRisk: number
    criticalLinks: number
    cascadeDetected: boolean
    nodes: { id: string; label: string; risk: string; x: number; y: number }[]
    edges: { from: string; to: string; weight: number }[]
  }
}

export default function RiskGraphPanel({ data }: RiskGraphPanelProps) {
  const [hoveredNode, setHoveredNode] = useState<string | null>(null)
  const [animPhase, setAnimPhase] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setAnimPhase(p => (p + 0.02) % (Math.PI * 2))
    }, 50)
    return () => clearInterval(interval)
  }, [])

  // Updated node positions matching reference
  const nodes = [
    { id: 'office', label: 'Office Tower', risk: 'low', x: 80, y: 70, size: 24 },
    { id: 'refinery', label: 'Oil Refinery', risk: 'critical', x: 280, y: 55, size: 26 },
    { id: 'port', label: 'Shipping Port', risk: 'medium', x: 70, y: 170, size: 22 },
    { id: 'datacenter', label: 'Data Center', risk: 'low', x: 270, y: 190, size: 22 },
    // Central hub
    { id: 'hub', label: '', risk: 'high', x: 175, y: 115, size: 18 },
  ]

  // Small white nodes
  const smallNodes = [
    { x: 140, y: 80 },
    { x: 200, y: 75 },
    { x: 240, y: 100 },
    { x: 130, y: 120 },
    { x: 220, y: 130 },
    { x: 150, y: 150 },
    { x: 200, y: 155 },
    { x: 120, y: 180 },
    { x: 180, y: 185 },
    { x: 230, y: 165 },
  ]

  const edges = [
    { from: 'office', to: 'hub', weight: 0.7 },
    { from: 'refinery', to: 'hub', weight: 0.9 },
    { from: 'port', to: 'hub', weight: 0.6 },
    { from: 'datacenter', to: 'hub', weight: 0.5 },
    { from: 'office', to: 'refinery', weight: 0.8 },
    { from: 'port', to: 'datacenter', weight: 0.6 },
    { from: 'refinery', to: 'datacenter', weight: 0.9 },
    { from: 'office', to: 'port', weight: 0.5 },
  ]

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'critical': return '#ef4444'
      case 'high': return '#f59e0b'
      case 'medium': return '#f59e0b'
      case 'low': return '#22c55e'
      default: return '#6b7280'
    }
  }

  const getEdgeColor = (weight: number) => {
    if (weight >= 0.8) return '#ef4444'
    if (weight >= 0.6) return '#f59e0b'
    return '#C9A962'
  }

  const getNode = (id: string) => nodes.find(n => n.id === id)

  return (
    <div className="h-full flex flex-col bg-[#000510]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1a2535]">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
          </svg>
          <span className="text-white font-medium text-sm">Portfolio Risk Graph</span>
        </div>
        <div className="flex gap-2">
          <button className="p-1 text-gray-500 hover:text-white">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button className="p-1 text-gray-500 hover:text-white">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>
          <button className="p-1 text-gray-500 hover:text-white">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex">
        {/* Graph */}
        <div className="flex-1 relative p-2">
          <svg 
            viewBox="0 0 360 230" 
            className="w-full h-full"
          >
            {/* Background */}
            <rect width="100%" height="100%" fill="#050a15" />
            
            {/* Grid */}
            <defs>
              <pattern id="gridPattern" width="18" height="18" patternUnits="userSpaceOnUse">
                <path d="M 18 0 L 0 0 0 18" fill="none" stroke="#0f1520" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#gridPattern)" />

            {/* Edges */}
            {edges.map((edge, i) => {
              const from = getNode(edge.from)
              const to = getNode(edge.to)
              if (!from || !to) return null
              
              const isHovered = hoveredNode === edge.from || hoveredNode === edge.to
              const color = getEdgeColor(edge.weight)
              
              return (
                <g key={i}>
                  <line
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    stroke={color}
                    strokeWidth={isHovered ? 2.5 : 1.5}
                    opacity={isHovered ? 1 : 0.5}
                  />
                  {/* Animated particle */}
                  {edge.weight >= 0.7 && (
                    <circle r="3" fill={color}>
                      <animateMotion
                        dur={`${1.5 + i * 0.2}s`}
                        repeatCount="indefinite"
                        path={`M${from.x},${from.y} L${to.x},${to.y}`}
                      />
                    </circle>
                  )}
                </g>
              )
            })}

            {/* Small white nodes */}
            {smallNodes.map((node, i) => (
              <circle
                key={`small-${i}`}
                cx={node.x}
                cy={node.y}
                r={3}
                fill="#ffffff"
                opacity={0.6 + Math.sin(animPhase + i) * 0.3}
              />
            ))}

            {/* Main nodes */}
            {nodes.map((node) => {
              if (node.id === 'hub') {
                // Central hub - orange with glow
                return (
                  <g key={node.id}>
                    <circle cx={node.x} cy={node.y} r={node.size + 10} fill="#f59e0b" opacity={0.1} />
                    <circle cx={node.x} cy={node.y} r={node.size + 5} fill="#f59e0b" opacity={0.2} />
                    <circle cx={node.x} cy={node.y} r={node.size} fill="#f59e0b" stroke="#fbbf24" strokeWidth={2} />
                  </g>
                )
              }
              
              const color = getRiskColor(node.risk)
              const isHovered = hoveredNode === node.id
              
              return (
                <g
                  key={node.id}
                  onMouseEnter={() => setHoveredNode(node.id)}
                  onMouseLeave={() => setHoveredNode(null)}
                  style={{ cursor: 'pointer' }}
                >
                  {/* Glow */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.size + 8}
                    fill={color}
                    opacity={isHovered ? 0.3 : 0.15}
                  />
                  {/* Main circle */}
                  <circle
                    cx={node.x}
                    cy={node.y}
                    r={node.size}
                    fill={color}
                    stroke="rgba(255,255,255,0.3)"
                    strokeWidth={1.5}
                  />
                  {/* Inner highlight */}
                  <circle
                    cx={node.x - node.size * 0.25}
                    cy={node.y - node.size * 0.25}
                    r={node.size * 0.3}
                    fill="rgba(255,255,255,0.2)"
                  />
                  {/* Label */}
                  {node.label && (
                    <>
                      <rect
                        x={node.x - 35}
                        y={node.y - node.size - 20}
                        width={70}
                        height={14}
                        rx={2}
                        fill="rgba(0,0,0,0.7)"
                      />
                      <text
                        x={node.x}
                        y={node.y - node.size - 10}
                        textAnchor="middle"
                        fill="white"
                        fontSize="9"
                        fontWeight="500"
                      >
                        {node.label}
                      </text>
                    </>
                  )}
                </g>
              )
            })}
          </svg>
        </div>

        {/* Right - Metrics */}
        <div className="w-32 p-3 space-y-3 border-l border-[#1a2535]">
          <div>
            <div className="text-gray-500 text-[10px]">At Risk:</div>
            <div className="text-white text-xl font-bold">${data.atRisk}B</div>
          </div>

          <div>
            <div className="text-gray-500 text-[10px]">Critical Links:</div>
            <div className="text-amber-400 text-xl font-bold">{data.criticalLinks}</div>
          </div>

          {data.cascadeDetected && (
            <div className="text-red-500 text-[10px] font-medium leading-tight">
              Cascading Failure Detected
            </div>
          )}

          {/* Results chart */}
          <div className="pt-2 border-t border-[#1a2535]">
            <div className="text-gray-500 text-[10px] mb-2">Results</div>
            <div className="flex items-end justify-between h-16 px-1">
              {/* T0 bar */}
              <div className="flex flex-col items-center gap-1">
                <div className="w-6 bg-[#1a2535] rounded-t flex flex-col justify-end" style={{ height: '100%' }}>
                  <div className="w-full bg-gray-600 rounded-t" style={{ height: '25%' }} />
                </div>
              </div>
              {/* +1 Year bar */}
              <div className="flex flex-col items-center gap-1">
                <div className="w-6 rounded-t flex flex-col justify-end" style={{ height: '100%' }}>
                  <div className="w-full bg-amber-500 rounded-t" style={{ height: '55%' }} />
                  <div className="w-full bg-red-500" style={{ height: '15%' }} />
                </div>
              </div>
              {/* +3 Years bar */}
              <div className="flex flex-col items-center gap-1">
                <div className="w-6 rounded-t flex flex-col justify-end" style={{ height: '100%' }}>
                  <div className="w-full bg-amber-500 rounded-t" style={{ height: '45%' }} />
                  <div className="w-full bg-red-500" style={{ height: '35%' }} />
                </div>
              </div>
            </div>
            <div className="flex justify-between text-[8px] text-gray-600 mt-1 px-1">
              <span>T0</span>
              <span>+1 Year</span>
              <span>+3 Years</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
