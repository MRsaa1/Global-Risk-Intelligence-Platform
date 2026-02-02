/**
 * Financial Charts using Plotly for 3D visualizations.
 * 
 * ENHANCED VERSION:
 * - Improved tooltips with detailed information
 * - Better color schemes (dark mode optimized)
 * - Zoom controls with reset
 * - Animated transitions
 * - Export functionality
 * 
 * Supports:
 * - 3D scatter plots (risk vs return)
 * - Surface plots (scenario analysis)
 * - Efficient frontier charts
 */
import { useMemo, useState, useRef, useCallback } from 'react'
import Plot from 'react-plotly.js'
import { motion, AnimatePresence } from 'framer-motion'
import { chartColors } from '../lib/chartColors'

interface FinancialChartProps {
  type: 'scatter3d' | 'surface' | 'efficient_frontier' | 'mesh3d'
  data: any
  title?: string
  height?: number
  showControls?: boolean
  onPointClick?: (point: any) => void
}

// Enhanced color scale for risk visualization
const riskColorScale: [number, string][] = [
  [0, chartColors.risk.low],
  [0.4, chartColors.risk.medium],
  [0.7, chartColors.risk.high],
  [1, chartColors.risk.critical],
]

export default function FinancialChart({
  type,
  data,
  title,
  height = 400,
  showControls = true,
  onPointClick,
}: FinancialChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  
  // Handle chart load
  const handleAfterPlot = useCallback(() => {
    setIsLoading(false)
  }, [])
  
  // Reset zoom
  const handleResetZoom = useCallback(() => {
    setRevision(r => r + 1)
  }, [])
  
  // Handle point click
  const handleClick = useCallback((event: any) => {
    if (onPointClick && event.points?.[0]) {
      onPointClick(event.points[0])
    }
  }, [onPointClick])
  
  const plotData = useMemo(() => {
    // If data is already a Plotly trace object, use it directly
    if (data && data.type) {
      return [data]
    }
    
    // If data is array of trace objects
    if (Array.isArray(data) && data[0]?.type) {
      return data
    }
    
    switch (type) {
      case 'scatter3d':
        // Check if raw Plotly data
        if (data.x && data.y && data.z) {
          return [{
            type: 'scatter3d',
            mode: data.mode || 'markers',
            x: data.x,
            y: data.y,
            z: data.z,
            marker: data.marker || { size: 5, colorscale: 'Viridis' },
          }]
        }
        // Standard data format
        return [
          {
            type: 'scatter3d',
            mode: 'markers',
            x: data.map((d: any) => d.climate_risk),
            y: data.map((d: any) => d.physical_risk),
            z: data.map((d: any) => d.valuation),
            marker: {
              size: 5,
              color: data.map((d: any) => d.composite_risk),
              colorscale: 'RdYlGn',
              reversescale: true,
              colorbar: {
                title: 'Risk Score',
              },
            },
            text: data.map((d: any) => d.name),
            hovertemplate: '<b>%{text}</b><br>' +
              'Climate: %{x}<br>' +
              'Physical: %{y}<br>' +
              'Valuation: €%{z:,.0f}<br>' +
              '<extra></extra>',
          },
        ]
      
      case 'surface':
        // Check if raw Plotly data
        if (data.z && !Array.isArray(data.z[0]?.value)) {
          return [{
            type: 'surface',
            z: data.z,
            colorscale: 'Viridis',
            showscale: true,
          }]
        }
        // Surface plot for scenario analysis
        return [
          {
            type: 'surface',
            z: data.map((row: any) => row.map((cell: any) => typeof cell === 'object' ? cell.value : cell)),
            colorscale: 'Viridis',
            showscale: true,
          },
        ]
      
      case 'mesh3d':
        return [{
          type: 'mesh3d',
          x: data.x,
          y: data.y,
          z: data.z,
          intensity: data.z,
          colorscale: 'Viridis',
          opacity: 0.8,
        }]
      
      case 'efficient_frontier':
        // Efficient frontier for portfolio optimization
        return [
          {
            type: 'scatter',
            mode: 'lines',
            x: data.map((d: any) => d.risk),
            y: data.map((d: any) => d.return),
            name: 'Efficient Frontier',
            line: { color: '#0056e6', width: 2 },
          },
          {
            type: 'scatter',
            mode: 'markers',
            x: data.map((d: any) => d.risk),
            y: data.map((d: any) => d.return),
            marker: { size: 8, color: '#C9A962' },
            name: 'Portfolio',
          },
        ]
      
      default:
        return []
    }
  }, [type, data])

  const layout = useMemo(() => ({
    title: {
      text: title || '',
      font: { color: chartColors.text.secondary, size: 14 },
    },
    paper_bgcolor: 'rgba(10, 15, 26, 0)',
    plot_bgcolor: 'rgba(10, 15, 26, 0)',
    font: { color: chartColors.text.secondary, family: '"Space Grotesk", system-ui, sans-serif' },
    scene: type === 'scatter3d' || type === 'surface' || type === 'mesh3d' ? {
      xaxis: { 
        title: { text: 'Climate Risk', font: { size: 11 } }, 
        gridcolor: chartColors.background.border,
        zerolinecolor: chartColors.background.border,
        tickfont: { size: 10 },
      },
      yaxis: { 
        title: { text: 'Physical Risk', font: { size: 11 } }, 
        gridcolor: chartColors.background.border,
        zerolinecolor: chartColors.background.border,
        tickfont: { size: 10 },
      },
      zaxis: { 
        title: { text: 'Valuation', font: { size: 11 } }, 
        gridcolor: chartColors.background.border,
        zerolinecolor: chartColors.background.border,
        tickfont: { size: 10 },
      },
      bgcolor: 'rgba(10, 15, 26, 0)',
      camera: {
        eye: { x: 1.5, y: 1.5, z: 1.2 },
      },
    } : undefined,
    xaxis: type === 'efficient_frontier' ? {
      title: { text: 'Risk', font: { size: 12 } },
      gridcolor: chartColors.background.border,
      zerolinecolor: chartColors.background.border,
      tickfont: { size: 10 },
    } : undefined,
    yaxis: type === 'efficient_frontier' ? {
      title: { text: 'Return', font: { size: 12 } },
      gridcolor: chartColors.background.border,
      zerolinecolor: chartColors.background.border,
      tickfont: { size: 10 },
    } : undefined,
    margin: { l: 50, r: 30, t: title ? 50 : 20, b: 40 },
    height,
    hovermode: 'closest',
    hoverlabel: {
      bgcolor: chartColors.background.card,
      bordercolor: chartColors.background.border,
      font: { color: chartColors.text.primary, size: 11 },
    },
    datarevision: revision,
  }), [type, title, height, revision])

  const config = useMemo(() => ({
    displayModeBar: showControls,
    displaylogo: false,
    modeBarButtonsToRemove: ['pan2d', 'lasso2d', 'select2d', 'autoScale2d'] as any,
    modeBarButtonsToAdd: [],
    responsive: true,
    scrollZoom: true,
    toImageButtonOptions: {
      format: 'png',
      filename: `chart_${type}_${new Date().toISOString().slice(0, 10)}`,
      height: 800,
      width: 1200,
      scale: 2,
    },
  }), [showControls, type])

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="relative w-full h-full"
    >
      {/* Loading overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center bg-[#0a0f18]/80 rounded-xl z-10"
          >
            <div className="flex flex-col items-center gap-2">
              <motion.div
                className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              />
              <span className="text-white/40 text-xs">Loading chart...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Chart container */}
      <div className="w-full h-full glass rounded-xl p-4">
        {/* Custom controls */}
        {showControls && (
          <div className="absolute top-2 right-2 z-20 flex gap-1">
            <button
              onClick={handleResetZoom}
              className="p-1.5 rounded bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/60 transition-all"
              title="Reset View"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        )}
        
        <Plot
          data={plotData}
          layout={layout as any}
          config={config}
          style={{ width: '100%', height: '100%' }}
          onAfterPlot={handleAfterPlot}
          onClick={handleClick}
          useResizeHandler={true}
        />
      </div>
    </motion.div>
  )
}
