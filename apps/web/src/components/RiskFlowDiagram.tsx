/**
 * Risk Flow Diagram - Sankey visualization
 * Shows how risk events cascade through sectors to impact levels
 * 
 * ENHANCED VERSION:
 * - Animated flow effects
 * - Interactive node selection
 * - Zoom and pan controls
 * - Export functionality
 * - Loading states
 * 
 * Flow: [Risk Events] → [Affected Sectors] → [Impact Level]
 */

import { useMemo, useState, useCallback, useRef } from 'react'
import Plot from 'react-plotly.js'
import { motion, AnimatePresence } from 'framer-motion'
import html2canvas from 'html2canvas'
import { chartColors } from '../lib/chartColors'

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
  // Enhanced options
  showControls?: boolean
  showExport?: boolean
  isLoading?: boolean
  filterType?: 'all' | 'critical' | 'high' | 'medium' | 'low'
  onFilterChange?: (filter: 'all' | 'critical' | 'high' | 'medium' | 'low') => void
}

// Professional muted color palette
const COLORS = {
  // Events - muted warm tones
  eventCritical: '#8b4c4c',   // muted red
  eventHigh: '#8b6b4c',       // muted orange  
  eventMedium: '#8b834c',     // muted yellow
  eventNormal: '#4c8b5c',     // muted green
  eventAccent: '#9a8b6e',     // muted gold
  eventPurple: '#6b5c8b',     // muted purple
  
  // Sectors - professional blues/teals
  sectorPrimary: '#4a6fa5',   // slate blue
  sectorSecondary: '#5a7a9a', // steel blue
  sectorTertiary: '#6a8090',  // cadet blue
  sectorQuaternary: '#5a8a8a',// teal
  sectorQuinary: '#7a8a7a',   // sage
  sectorSenary: '#8a7a6a',    // taupe
  
  // Impact - gradient from dark to light
  impactCritical: '#7a3d3d',  // dark muted red
  impactHigh: '#8a5a3d',      // dark muted orange
  impactMedium: '#8a7a3d',    // dark muted yellow
  impactLow: '#4a7a5a',       // dark muted green
}

// Default risk flow data based on current stress test scenarios
function generateDefaultFlowData(): RiskFlowData {
  const nodes: FlowNode[] = [
    // Risk Events (Left column) - muted warm tones
    { id: 'earthquake', label: 'Seismic Events', color: COLORS.eventCritical, category: 'event' },
    { id: 'conflict', label: 'Geopolitical Conflict', color: COLORS.eventHigh, category: 'event' },
    { id: 'financial', label: 'Financial Crisis', color: COLORS.eventMedium, category: 'event' },
    { id: 'climate', label: 'Climate Shock', color: COLORS.eventNormal, category: 'event' },
    { id: 'pandemic', label: 'Pandemic', color: COLORS.eventAccent, category: 'event' },
    { id: 'cyber', label: 'Cyber Attack', color: COLORS.eventPurple, category: 'event' },
    
    // Affected Sectors (Middle column) - professional blues/teals
    { id: 'banking', label: 'Banking & Finance', color: COLORS.sectorPrimary, category: 'sector' },
    { id: 'insurance', label: 'Insurance', color: COLORS.sectorSecondary, category: 'sector' },
    { id: 'realestate', label: 'Real Estate', color: COLORS.sectorTertiary, category: 'sector' },
    { id: 'infrastructure', label: 'Infrastructure', color: COLORS.sectorQuaternary, category: 'sector' },
    { id: 'energy', label: 'Energy', color: COLORS.sectorQuinary, category: 'sector' },
    { id: 'technology', label: 'Technology', color: COLORS.sectorSenary, category: 'sector' },
    
    // Impact Levels (Right column) - muted severity gradient
    { id: 'critical', label: 'Critical Impact', color: COLORS.impactCritical, category: 'impact' },
    { id: 'high', label: 'High Impact', color: COLORS.impactHigh, category: 'impact' },
    { id: 'medium', label: 'Medium Impact', color: COLORS.impactMedium, category: 'impact' },
    { id: 'low', label: 'Low Impact', color: COLORS.impactLow, category: 'impact' },
  ]

  // Professional muted link colors
  const linkColor = (r: number, g: number, b: number, a: number) => `rgba(${r}, ${g}, ${b}, ${a})`
  
  const links: FlowLink[] = [
    // Earthquake impacts - muted red-brown
    { source: 'earthquake', target: 'insurance', value: 45, color: linkColor(139, 76, 76, 0.5) },
    { source: 'earthquake', target: 'realestate', value: 35, color: linkColor(139, 76, 76, 0.4) },
    { source: 'earthquake', target: 'infrastructure', value: 25, color: linkColor(139, 76, 76, 0.3) },
    
    // Conflict impacts - muted orange-brown
    { source: 'conflict', target: 'energy', value: 55, color: linkColor(139, 107, 76, 0.5) },
    { source: 'conflict', target: 'infrastructure', value: 40, color: linkColor(139, 107, 76, 0.4) },
    { source: 'conflict', target: 'banking', value: 30, color: linkColor(139, 107, 76, 0.3) },
    
    // Financial crisis impacts - muted gold
    { source: 'financial', target: 'banking', value: 85, color: linkColor(139, 131, 76, 0.5) },
    { source: 'financial', target: 'realestate', value: 45, color: linkColor(139, 131, 76, 0.4) },
    { source: 'financial', target: 'insurance', value: 25, color: linkColor(139, 131, 76, 0.3) },
    
    // Climate shock impacts - muted green
    { source: 'climate', target: 'insurance', value: 50, color: linkColor(76, 139, 92, 0.5) },
    { source: 'climate', target: 'realestate', value: 40, color: linkColor(76, 139, 92, 0.4) },
    { source: 'climate', target: 'infrastructure', value: 35, color: linkColor(76, 139, 92, 0.35) },
    { source: 'climate', target: 'energy', value: 20, color: linkColor(76, 139, 92, 0.3) },
    
    // Pandemic impacts - muted gold/taupe
    { source: 'pandemic', target: 'insurance', value: 40, color: linkColor(154, 139, 110, 0.5) },
    { source: 'pandemic', target: 'realestate', value: 30, color: linkColor(154, 139, 110, 0.4) },
    { source: 'pandemic', target: 'technology', value: 15, color: linkColor(154, 139, 110, 0.3) },
    
    // Cyber attack impacts - muted purple
    { source: 'cyber', target: 'technology', value: 65, color: linkColor(107, 92, 139, 0.5) },
    { source: 'cyber', target: 'banking', value: 45, color: linkColor(107, 92, 139, 0.4) },
    { source: 'cyber', target: 'infrastructure', value: 25, color: linkColor(107, 92, 139, 0.3) },
    
    // Sector to Impact flows - professional blue tones
    // Banking
    { source: 'banking', target: 'critical', value: 80, color: linkColor(74, 111, 165, 0.5) },
    { source: 'banking', target: 'high', value: 50, color: linkColor(74, 111, 165, 0.4) },
    { source: 'banking', target: 'medium', value: 30, color: linkColor(74, 111, 165, 0.3) },
    
    // Insurance
    { source: 'insurance', target: 'critical', value: 60, color: linkColor(90, 122, 154, 0.5) },
    { source: 'insurance', target: 'high', value: 70, color: linkColor(90, 122, 154, 0.4) },
    { source: 'insurance', target: 'medium', value: 30, color: linkColor(90, 122, 154, 0.3) },
    
    // Real Estate
    { source: 'realestate', target: 'high', value: 80, color: linkColor(106, 128, 144, 0.5) },
    { source: 'realestate', target: 'medium', value: 50, color: linkColor(106, 128, 144, 0.4) },
    { source: 'realestate', target: 'low', value: 20, color: linkColor(106, 128, 144, 0.3) },
    
    // Infrastructure
    { source: 'infrastructure', target: 'critical', value: 70, color: linkColor(90, 138, 138, 0.5) },
    { source: 'infrastructure', target: 'high', value: 40, color: linkColor(90, 138, 138, 0.4) },
    { source: 'infrastructure', target: 'medium', value: 15, color: linkColor(90, 138, 138, 0.3) },
    
    // Energy
    { source: 'energy', target: 'critical', value: 50, color: linkColor(122, 138, 122, 0.5) },
    { source: 'energy', target: 'high', value: 20, color: linkColor(122, 138, 122, 0.4) },
    { source: 'energy', target: 'low', value: 5, color: linkColor(122, 138, 122, 0.3) },
    
    // Technology
    { source: 'technology', target: 'high', value: 50, color: linkColor(138, 122, 106, 0.5) },
    { source: 'technology', target: 'medium', value: 25, color: linkColor(138, 122, 106, 0.4) },
    { source: 'technology', target: 'low', value: 5, color: linkColor(138, 122, 106, 0.3) },
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
    : stressTestName.toLowerCase().includes('financial') || stressTestName.toLowerCase().includes('basel') || stressTestName.toLowerCase().includes('debt') ? 'financial'
    : stressTestName.toLowerCase().includes('cyber') ? 'cyber'
    : stressTestName.toLowerCase().includes('conflict') || stressTestName.toLowerCase().includes('war') ? 'conflict'
    : 'financial'

  const eventColors: Record<string, string> = {
    earthquake: '#ef4444',
    conflict: '#f97316',
    financial: '#eab308',
    climate: '#22c55e',
    pandemic: '#C9A962',
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
  showControls = true,
  showExport = true,
  isLoading = false,
  filterType = 'all',
  onFilterChange,
}: RiskFlowDiagramProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [selectedNode, setSelectedNode] = useState<string | null>(null)
  const [isExporting, setIsExporting] = useState(false)
  const [revision, setRevision] = useState(0)
  
  // Export to PNG
  const handleExport = useCallback(async () => {
    if (!containerRef.current) return
    setIsExporting(true)
    
    try {
      const canvas = await html2canvas(containerRef.current, {
        backgroundColor: chartColors.background.dark,
        scale: 2,
      })
      
      const link = document.createElement('a')
      link.download = `risk_flow_${stressTestName || 'analysis'}_${new Date().toISOString().slice(0, 10)}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (error) {
      console.error('Export failed:', error)
    } finally {
      setIsExporting(false)
    }
  }, [stressTestName])
  
  // Reset view
  const handleResetView = useCallback(() => {
    setRevision(r => r + 1)
    setSelectedNode(null)
  }, [])
  
  const flowData = useMemo(() => {
    if (stressTestName && riskZones && riskZones.length > 0) {
      return generateFlowFromStressTest(stressTestName, riskZones)
    }
    return generateDefaultFlowData()
  }, [stressTestName, riskZones])
  
  // Filter flow data based on impact level
  const filteredFlowData = useMemo(() => {
    if (filterType === 'all') return flowData
    
    const impactNodes = ['critical', 'high', 'medium', 'low']
    const filteredImpacts = filterType === 'critical' ? ['critical']
      : filterType === 'high' ? ['critical', 'high']
      : filterType === 'medium' ? ['critical', 'high', 'medium']
      : impactNodes
    
    // Get sectors connected to filtered impacts
    const connectedSectors = new Set<string>()
    flowData.links.forEach(link => {
      if (filteredImpacts.includes(link.target)) {
        connectedSectors.add(link.source)
      }
    })
    
    // Get events connected to those sectors
    const connectedEvents = new Set<string>()
    flowData.links.forEach(link => {
      if (connectedSectors.has(link.target)) {
        connectedEvents.add(link.source)
      }
    })
    
    // Filter nodes
    const filteredNodes = flowData.nodes.filter(n => 
      filteredImpacts.includes(n.id) ||
      connectedSectors.has(n.id) ||
      connectedEvents.has(n.id)
    )
    
    // Filter links
    const nodeIds = new Set(filteredNodes.map(n => n.id))
    const filteredLinks = flowData.links.filter(l => 
      nodeIds.has(l.source) && nodeIds.has(l.target)
    )
    
    return { nodes: filteredNodes, links: filteredLinks }
  }, [flowData, filterType])

  // Convert to Plotly format
  const plotData = useMemo(() => {
    const nodeMap = new Map(filteredFlowData.nodes.map((n, i) => [n.id, i]))
    
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
        label: filteredFlowData.nodes.map(n => n.label),
        color: filteredFlowData.nodes.map(n => {
          // Highlight selected node
          if (selectedNode === n.id) {
            return n.color.replace(/[\d.]+\)$/, '1)')
          }
          return n.color
        }),
        hovertemplate: '<b>%{label}</b><br>Total Flow: €%{value:.1f}B<extra></extra>',
      },
      link: {
        source: filteredFlowData.links.map(l => nodeMap.get(l.source) ?? 0),
        target: filteredFlowData.links.map(l => nodeMap.get(l.target) ?? 0),
        value: filteredFlowData.links.map(l => l.value),
        color: filteredFlowData.links.map(l => {
          // Highlight links connected to selected node
          if (selectedNode && (l.source === selectedNode || l.target === selectedNode)) {
            return l.color?.replace(/[\d.]+\)$/, '0.7)') || 'rgba(255, 255, 255, 0.7)'
          }
          return l.color || 'rgba(255, 255, 255, 0.1)'
        }),
        hovertemplate: '<b>%{source.label}</b> → <b>%{target.label}</b><br>Exposure: €%{value:.1f}B<extra></extra>',
      },
    }]
  }, [filteredFlowData, selectedNode])

  const layout = useMemo(() => ({
    font: {
      family: '"Space Grotesk", system-ui, sans-serif',
      size: 12,
      color: chartColors.text.secondary,
    },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    margin: { l: 20, r: 20, t: 10, b: 20 },
    datarevision: revision,
    hoverlabel: {
      bgcolor: chartColors.background.card,
      bordercolor: chartColors.background.border,
      font: { color: chartColors.text.primary, size: 11 },
    },
  }), [revision])

  const config = useMemo(() => ({
    displayModeBar: false,
    responsive: true,
    scrollZoom: false,
  }), [])

  return (
    <motion.div
      ref={containerRef}
      className="relative w-full bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
    >
      {/* Loading overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-black/60 z-20"
          >
            <div className="flex flex-col items-center gap-2">
              <motion.div
                className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
              <span className="text-white/40 text-xs">Analyzing risk flows...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/10">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-white text-sm font-medium">
              {stressTestName ? `Risk Flow: ${stressTestName}` : 'Risk Flow Analysis'}
            </h3>
            <p className="text-white/40 text-xs mt-0.5">
              How risk events cascade through sectors to impact levels
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Filter controls */}
            {showControls && onFilterChange && (
              <div className="flex bg-white/5 rounded-lg p-0.5">
                {(['all', 'critical', 'high', 'medium', 'low'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => onFilterChange(f)}
                    className={`px-2 py-1 text-xs rounded transition-all capitalize ${
                      filterType === f
                        ? 'bg-white/10 text-white'
                        : 'text-white/40 hover:text-white/60'
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
            )}
            
            {/* Action buttons */}
            {showControls && (
              <div className="flex gap-1">
                <button
                  onClick={handleResetView}
                  className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/60 transition-all"
                  title="Reset View"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </button>
                
                {showExport && (
                  <button
                    onClick={handleExport}
                    disabled={isExporting}
                    className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/60 transition-all disabled:opacity-50"
                    title="Export as PNG"
                  >
                    {isExporting ? (
                      <motion.svg
                        className="w-4 h-4"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                      </motion.svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            )}
            
            {/* Legend */}
            <div className="flex items-center gap-3 text-[10px] text-white/40 ml-2">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: chartColors.risk.critical }} />
                <span>Critical</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: chartColors.risk.high }} />
                <span>High</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: chartColors.risk.medium }} />
                <span>Medium</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: chartColors.risk.low }} />
                <span>Low</span>
              </div>
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
            if (data.points?.[0]) {
              const pointIndex = data.points[0].pointNumber
              const node = filteredFlowData.nodes[pointIndex]
              if (node) {
                setSelectedNode(prev => prev === node.id ? null : node.id)
                onNodeClick?.(node)
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
          <div className="ml-auto flex items-center gap-4">
            <span>
              <span className="text-white/60 font-medium">Flow Width:</span> Exposure (€B)
            </span>
            {selectedNode && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-blue-400"
              >
                Selected: {filteredFlowData.nodes.find(n => n.id === selectedNode)?.label}
              </motion.span>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Compact version for inline display (doubled height for better visibility)
export function RiskFlowMini({ 
  riskZones,
  stressTestResults,
  stressTestName,
  height = 400 
}: { 
  riskZones?: Array<{ name: string; risk: number; exposure: number }>
  stressTestResults?: {
    zones: Array<{ name: string; loss: number; riskLevel: string }>
  }
  /** Label for the left node (e.g. scenario name). When not set, "Stress Test" or "Risk Event". */
  stressTestName?: string
  height?: number 
}) {
  const eventLabel = stressTestName || 'Stress Test'
  const flowData = useMemo(() => {
    // Handle stressTestResults format (from DigitalTwinPanel)
    if (stressTestResults && stressTestResults.zones && stressTestResults.zones.length > 0) {
      const topZones = stressTestResults.zones.slice(0, 4)
      const nodes = [
        { id: 'event', label: eventLabel, color: '#ef4444' },
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
          { id: 'event', label: eventLabel, color: '#ef4444' },
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
      { id: 'event', label: eventLabel, color: '#ef4444' },
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
  }, [riskZones, stressTestResults, eventLabel])

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
        font: { family: '"Space Grotesk"', size: 10, color: 'rgba(255,255,255,0.7)' },
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        margin: { l: 5, r: 5, t: 5, b: 5 },
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%', height: `${height}px` }}
    />
  )
}
