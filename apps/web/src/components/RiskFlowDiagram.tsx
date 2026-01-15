/**
 * Risk Flow Diagram - Sankey visualization
 * Shows how risk events cascade through sectors to impact levels
 * 
 * Flow: [Risk Events] → [Affected Sectors] → [Impact Level]
 */

import { useMemo } from 'react'
import Plot from 'react-plotly.js'
import { motion } from 'framer-motion'

// Types for flow data
interface FlowNode {
  id: string
  label: string
  color: string
  category: 'event' | 'sector' | 'impact'
}

interface FlowLink {
  source: string
  target: string
  value: number
  color?: string
}

interface RiskFlowData {
  nodes: FlowNode[]
  links: FlowLink[]
}

interface RiskFlowDiagramProps {
  // Optional: pass custom data from stress test results
  stressTestId?: string
  stressTestName?: string
  riskZones?: Array<{
    name: string
    risk: number
    exposure: number
    sector?: string
  }>
  // Callback when user clicks on a node
  onNodeClick?: (node: FlowNode) => void
  // Size
  height?: number
}

// Default risk flow data based on current stress test scenarios
function generateDefaultFlowData(): RiskFlowData {
  const nodes: FlowNode[] = [
    // Risk Events (Left column)
    { id: 'earthquake', label: 'Seismic Events', color: '#ef4444', category: 'event' },
    { id: 'conflict', label: 'Geopolitical Conflict', color: '#f97316', category: 'event' },
    { id: 'financial', label: 'Financial Crisis', color: '#eab308', category: 'event' },
    { id: 'climate', label: 'Climate Shock', color: '#22c55e', category: 'event' },
    { id: 'pandemic', label: 'Pandemic', color: '#06b6d4', category: 'event' },
    { id: 'cyber', label: 'Cyber Attack', color: '#8b5cf6', category: 'event' },
    
    // Affected Sectors (Middle column)
    { id: 'banking', label: 'Banking & Finance', color: '#3b82f6', category: 'sector' },
    { id: 'insurance', label: 'Insurance', color: '#6366f1', category: 'sector' },
    { id: 'realestate', label: 'Real Estate', color: '#a855f7', category: 'sector' },
    { id: 'infrastructure', label: 'Infrastructure', color: '#ec4899', category: 'sector' },
    { id: 'energy', label: 'Energy', color: '#14b8a6', category: 'sector' },
    { id: 'technology', label: 'Technology', color: '#f59e0b', category: 'sector' },
    
    // Impact Levels (Right column)
    { id: 'critical', label: 'Critical Impact', color: '#dc2626', category: 'impact' },
    { id: 'high', label: 'High Impact', color: '#f97316', category: 'impact' },
    { id: 'medium', label: 'Medium Impact', color: '#eab308', category: 'impact' },
    { id: 'low', label: 'Low Impact', color: '#22c55e', category: 'impact' },
  ]

  const links: FlowLink[] = [
    // Earthquake impacts
    { source: 'earthquake', target: 'insurance', value: 45, color: 'rgba(239, 68, 68, 0.4)' },
    { source: 'earthquake', target: 'realestate', value: 35, color: 'rgba(239, 68, 68, 0.4)' },
    { source: 'earthquake', target: 'infrastructure', value: 25, color: 'rgba(239, 68, 68, 0.4)' },
    
    // Conflict impacts
    { source: 'conflict', target: 'energy', value: 55, color: 'rgba(249, 115, 22, 0.4)' },
    { source: 'conflict', target: 'infrastructure', value: 40, color: 'rgba(249, 115, 22, 0.4)' },
    { source: 'conflict', target: 'banking', value: 30, color: 'rgba(249, 115, 22, 0.4)' },
    
    // Financial crisis impacts
    { source: 'financial', target: 'banking', value: 85, color: 'rgba(234, 179, 8, 0.4)' },
    { source: 'financial', target: 'realestate', value: 45, color: 'rgba(234, 179, 8, 0.4)' },
    { source: 'financial', target: 'insurance', value: 25, color: 'rgba(234, 179, 8, 0.4)' },
    
    // Climate shock impacts
    { source: 'climate', target: 'insurance', value: 50, color: 'rgba(34, 197, 94, 0.4)' },
    { source: 'climate', target: 'realestate', value: 40, color: 'rgba(34, 197, 94, 0.4)' },
    { source: 'climate', target: 'infrastructure', value: 35, color: 'rgba(34, 197, 94, 0.4)' },
    { source: 'climate', target: 'energy', value: 20, color: 'rgba(34, 197, 94, 0.4)' },
    
    // Pandemic impacts
    { source: 'pandemic', target: 'insurance', value: 40, color: 'rgba(6, 182, 212, 0.4)' },
    { source: 'pandemic', target: 'realestate', value: 30, color: 'rgba(6, 182, 212, 0.4)' },
    { source: 'pandemic', target: 'technology', value: 15, color: 'rgba(6, 182, 212, 0.4)' },
    
    // Cyber attack impacts
    { source: 'cyber', target: 'technology', value: 65, color: 'rgba(139, 92, 246, 0.4)' },
    { source: 'cyber', target: 'banking', value: 45, color: 'rgba(139, 92, 246, 0.4)' },
    { source: 'cyber', target: 'infrastructure', value: 25, color: 'rgba(139, 92, 246, 0.4)' },
    
    // Sector to Impact flows
    // Banking
    { source: 'banking', target: 'critical', value: 80, color: 'rgba(59, 130, 246, 0.4)' },
    { source: 'banking', target: 'high', value: 50, color: 'rgba(59, 130, 246, 0.3)' },
    { source: 'banking', target: 'medium', value: 30, color: 'rgba(59, 130, 246, 0.2)' },
    
    // Insurance
    { source: 'insurance', target: 'critical', value: 60, color: 'rgba(99, 102, 241, 0.4)' },
    { source: 'insurance', target: 'high', value: 70, color: 'rgba(99, 102, 241, 0.3)' },
    { source: 'insurance', target: 'medium', value: 30, color: 'rgba(99, 102, 241, 0.2)' },
    
    // Real Estate
    { source: 'realestate', target: 'high', value: 80, color: 'rgba(168, 85, 247, 0.4)' },
    { source: 'realestate', target: 'medium', value: 50, color: 'rgba(168, 85, 247, 0.3)' },
    { source: 'realestate', target: 'low', value: 20, color: 'rgba(168, 85, 247, 0.2)' },
    
    // Infrastructure
    { source: 'infrastructure', target: 'critical', value: 70, color: 'rgba(236, 72, 153, 0.4)' },
    { source: 'infrastructure', target: 'high', value: 40, color: 'rgba(236, 72, 153, 0.3)' },
    { source: 'infrastructure', target: 'medium', value: 15, color: 'rgba(236, 72, 153, 0.2)' },
    
    // Energy
    { source: 'energy', target: 'critical', value: 50, color: 'rgba(20, 184, 166, 0.4)' },
    { source: 'energy', target: 'high', value: 20, color: 'rgba(20, 184, 166, 0.3)' },
    { source: 'energy', target: 'low', value: 5, color: 'rgba(20, 184, 166, 0.2)' },
    
    // Technology
    { source: 'technology', target: 'high', value: 50, color: 'rgba(245, 158, 11, 0.4)' },
    { source: 'technology', target: 'medium', value: 25, color: 'rgba(245, 158, 11, 0.3)' },
    { source: 'technology', target: 'low', value: 5, color: 'rgba(245, 158, 11, 0.2)' },
  ]

  return { nodes, links }
}

// Generate flow data from stress test results
function generateFlowFromStressTest(
  stressTestName: string,
  riskZones: Array<{ name: string; risk: number; exposure: number; sector?: string }>
): RiskFlowData {
  // Determine event type from stress test name
  const eventType = stressTestName.toLowerCase().includes('climate') ? 'climate'
    : stressTestName.toLowerCase().includes('earthquake') || stressTestName.toLowerCase().includes('seismic') ? 'earthquake'
    : stressTestName.toLowerCase().includes('pandemic') ? 'pandemic'
    : stressTestName.toLowerCase().includes('financial') || stressTestName.toLowerCase().includes('basel') ? 'financial'
    : stressTestName.toLowerCase().includes('cyber') ? 'cyber'
    : stressTestName.toLowerCase().includes('conflict') || stressTestName.toLowerCase().includes('war') ? 'conflict'
    : 'financial'

  const eventColors: Record<string, string> = {
    earthquake: '#ef4444',
    conflict: '#f97316',
    financial: '#eab308',
    climate: '#22c55e',
    pandemic: '#06b6d4',
    cyber: '#8b5cf6',
  }

  const nodes: FlowNode[] = [
    // Single event source
    { id: 'event', label: stressTestName, color: eventColors[eventType], category: 'event' },
    
    // Cities/Regions as middle column
    ...riskZones.slice(0, 8).map((zone, i) => ({
      id: `zone_${i}`,
      label: zone.name,
      color: zone.risk > 0.8 ? '#ef4444' : zone.risk > 0.6 ? '#f97316' : zone.risk > 0.4 ? '#eab308' : '#22c55e',
      category: 'sector' as const,
    })),
    
    // Impact levels
    { id: 'critical', label: 'Critical', color: '#dc2626', category: 'impact' },
    { id: 'high', label: 'High', color: '#f97316', category: 'impact' },
    { id: 'medium', label: 'Medium', color: '#eab308', category: 'impact' },
    { id: 'low', label: 'Low', color: '#22c55e', category: 'impact' },
  ]

  const links: FlowLink[] = []
  const eventColor = eventColors[eventType]

  // Event to zones
  riskZones.slice(0, 8).forEach((zone, i) => {
    links.push({
      source: 'event',
      target: `zone_${i}`,
      value: zone.exposure || 10,
      color: `${eventColor}66`,
    })
  })

  // Zones to impact levels
  riskZones.slice(0, 8).forEach((zone, i) => {
    const impact = zone.risk > 0.8 ? 'critical' : zone.risk > 0.6 ? 'high' : zone.risk > 0.4 ? 'medium' : 'low'
    links.push({
      source: `zone_${i}`,
      target: impact,
      value: zone.exposure || 10,
      color: nodes.find(n => n.id === `zone_${i}`)?.color + '66',
    })
  })

  return { nodes, links }
}

export default function RiskFlowDiagram({
  stressTestName,
  riskZones,
  onNodeClick,
  height = 500,
}: RiskFlowDiagramProps) {
  
  const flowData = useMemo(() => {
    if (stressTestName && riskZones && riskZones.length > 0) {
      return generateFlowFromStressTest(stressTestName, riskZones)
    }
    return generateDefaultFlowData()
  }, [stressTestName, riskZones])

  // Convert to Plotly format
  const plotData = useMemo(() => {
    const nodeMap = new Map(flowData.nodes.map((n, i) => [n.id, i]))
    
    return [{
      type: 'sankey' as const,
      orientation: 'h' as const,
      arrangement: 'snap' as const,
      node: {
        pad: 20,
        thickness: 25,
        line: {
          color: 'rgba(255, 255, 255, 0.3)',
          width: 1,
        },
        label: flowData.nodes.map(n => n.label),
        color: flowData.nodes.map(n => n.color),
        hovertemplate: '%{label}<br>Total Flow: %{value:.1f}B<extra></extra>',
      },
      link: {
        source: flowData.links.map(l => nodeMap.get(l.source) ?? 0),
        target: flowData.links.map(l => nodeMap.get(l.target) ?? 0),
        value: flowData.links.map(l => l.value),
        color: flowData.links.map(l => l.color || 'rgba(255, 255, 255, 0.1)'),
        hovertemplate: '%{source.label} → %{target.label}<br>Exposure: €%{value:.1f}B<extra></extra>',
      },
    }]
  }, [flowData])

  const layout = useMemo(() => ({
    font: {
      family: 'Inter, system-ui, sans-serif',
      size: 12,
      color: 'rgba(255, 255, 255, 0.8)',
    },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    margin: { l: 20, r: 20, t: 40, b: 20 },
    title: {
      text: stressTestName 
        ? `Risk Flow: ${stressTestName}`
        : 'Risk Cascade Flow: Events → Sectors → Impact',
      font: {
        size: 14,
        color: 'rgba(255, 255, 255, 0.6)',
      },
      x: 0.5,
      xanchor: 'center' as const,
    },
  }), [stressTestName])

  const config = {
    displayModeBar: false,
    responsive: true,
  }

  return (
    <motion.div
      className="w-full bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white text-sm font-medium">Risk Flow Analysis</h3>
            <p className="text-white/40 text-xs mt-0.5">
              How risk events cascade through sectors to impact levels
            </p>
          </div>
          <div className="flex items-center gap-4 text-[10px] text-white/40">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              <span>Critical</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-orange-500" />
              <span>High</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-yellow-500" />
              <span>Medium</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              <span>Low</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sankey Diagram */}
      <div className="p-2">
        <Plot
          data={plotData}
          layout={layout}
          config={config}
          style={{ width: '100%', height: `${height}px` }}
          onClick={(data: any) => {
            if (onNodeClick && data.points?.[0]) {
              const pointIndex = data.points[0].pointNumber
              const node = flowData.nodes[pointIndex]
              if (node) {
                onNodeClick(node)
              }
            }
          }}
        />
      </div>

      {/* Footer with explanation */}
      <div className="px-4 py-3 border-t border-white/10 bg-white/5">
        <div className="flex items-start gap-6 text-[10px] text-white/40">
          <div>
            <span className="text-white/60 font-medium">Left Column:</span> Risk Events
          </div>
          <div>
            <span className="text-white/60 font-medium">Middle Column:</span> {stressTestName ? 'Affected Regions' : 'Sectors'}
          </div>
          <div>
            <span className="text-white/60 font-medium">Right Column:</span> Impact Severity
          </div>
          <div className="ml-auto">
            <span className="text-white/60 font-medium">Flow Width:</span> Exposure (€B)
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Compact version for inline display
export function RiskFlowMini({ 
  riskZones,
  stressTestResults,
  height = 200 
}: { 
  riskZones?: Array<{ name: string; risk: number; exposure: number }>
  stressTestResults?: {
    zones: Array<{ name: string; loss: number; riskLevel: string }>
  }
  height?: number 
}) {
  const flowData = useMemo(() => {
    // Handle stressTestResults format (from DigitalTwinPanel)
    if (stressTestResults && stressTestResults.zones && stressTestResults.zones.length > 0) {
      const topZones = stressTestResults.zones.slice(0, 4)
      const nodes = [
        { id: 'event', label: 'Stress Test', color: '#ef4444' },
        ...topZones.map((z, i) => ({
          id: `z${i}`,
          label: z.name,
          color: z.riskLevel === 'critical' ? '#ef4444' : z.riskLevel === 'high' ? '#f97316' : '#eab308',
        })),
        { id: 'impact', label: 'Total Loss', color: '#dc2626' },
      ]
      
      const links = [
        ...topZones.map((z, i) => ({
          source: 'event',
          target: `z${i}`,
          value: z.loss || 100,
          color: 'rgba(239, 68, 68, 0.3)',
        })),
        ...topZones.map((z, i) => ({
          source: `z${i}`,
          target: 'impact',
          value: (z.loss || 100) * (z.riskLevel === 'critical' ? 1 : z.riskLevel === 'high' ? 0.7 : 0.4),
          color: z.riskLevel === 'critical' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(249, 115, 22, 0.3)',
        })),
      ]
      
      return { nodes, links }
    }
    
    if (!riskZones || riskZones.length === 0) {
      // Simple default
      return {
        nodes: [
          { id: 'event', label: 'Risk Event', color: '#ef4444' },
          { id: 'sector1', label: 'Banking', color: '#3b82f6' },
          { id: 'sector2', label: 'Insurance', color: '#6366f1' },
          { id: 'critical', label: 'Critical', color: '#dc2626' },
          { id: 'high', label: 'High', color: '#f97316' },
        ],
        links: [
          { source: 'event', target: 'sector1', value: 50, color: 'rgba(239, 68, 68, 0.3)' },
          { source: 'event', target: 'sector2', value: 30, color: 'rgba(239, 68, 68, 0.3)' },
          { source: 'sector1', target: 'critical', value: 40, color: 'rgba(59, 130, 246, 0.3)' },
          { source: 'sector1', target: 'high', value: 10, color: 'rgba(59, 130, 246, 0.2)' },
          { source: 'sector2', target: 'high', value: 30, color: 'rgba(99, 102, 241, 0.3)' },
        ],
      }
    }
    
    // Generate from zones
    const topZones = riskZones.slice(0, 4)
    const nodes = [
      { id: 'event', label: 'Stress Test', color: '#ef4444' },
      ...topZones.map((z, i) => ({
        id: `z${i}`,
        label: z.name,
        color: z.risk > 0.7 ? '#ef4444' : z.risk > 0.5 ? '#f97316' : '#eab308',
      })),
      { id: 'impact', label: 'Total Impact', color: '#dc2626' },
    ]
    
    const links = [
      ...topZones.map((z, i) => ({
        source: 'event',
        target: `z${i}`,
        value: z.exposure,
        color: 'rgba(239, 68, 68, 0.3)',
      })),
      ...topZones.map((z, i) => ({
        source: `z${i}`,
        target: 'impact',
        value: z.exposure * z.risk,
        color: z.risk > 0.7 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(249, 115, 22, 0.3)',
      })),
    ]
    
    return { nodes, links }
  }, [riskZones, stressTestResults])

  const nodeMap = new Map(flowData.nodes.map((n, i) => [n.id, i]))

  return (
    <Plot
      data={[{
        type: 'sankey',
        orientation: 'h',
        node: {
          pad: 10,
          thickness: 15,
          line: { color: 'rgba(255,255,255,0.2)', width: 0.5 },
          label: flowData.nodes.map(n => n.label),
          color: flowData.nodes.map(n => n.color),
        },
        link: {
          source: flowData.links.map(l => nodeMap.get(l.source) ?? 0),
          target: flowData.links.map(l => nodeMap.get(l.target) ?? 0),
          value: flowData.links.map(l => l.value),
          color: flowData.links.map(l => l.color || 'rgba(255,255,255,0.1)'),
        },
      }]}
      layout={{
        font: { family: 'Inter', size: 10, color: 'rgba(255,255,255,0.7)' },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        margin: { l: 5, r: 5, t: 5, b: 5 },
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%', height: `${height}px` }}
    />
  )
}
