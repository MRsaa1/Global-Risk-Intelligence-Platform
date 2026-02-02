/**
 * Radar Chart (Spider Chart) Component using Plotly
 * ==================================================
 * 
 * Radial/polar chart for multi-dimensional risk data visualization
 * Uses Plotly's scatterpolar for better rendering and interactivity
 */
import { useMemo, useState, useRef, useCallback } from 'react'
import Plot from 'react-plotly.js'
import { motion, AnimatePresence } from 'framer-motion'
import { chartColors, seriesColors } from '../../lib/chartColors'

export interface RadarDataPoint {
  axis: string
  value: number
}

export interface RadarSeries {
  id: string
  name: string
  data: RadarDataPoint[]
  color?: string
}

interface RadarChartProps {
  series: RadarSeries[]
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  showLabels?: boolean
  animationDuration?: number
  title?: string
  maxValue?: number
  levels?: number
}

const defaultColors = Object.values(seriesColors)

export default function RadarChart({
  series,
  height = 400,
  showGrid = true,
  showLegend = true,
  showLabels = true,
  animationDuration = 800,
  title,
  maxValue,
  levels = 5,
}: RadarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  
  // Get all axes from all series
  const axes = useMemo(() => {
    const axisSet = new Set<string>()
    series.forEach(s => s.data.forEach(d => axisSet.add(d.axis)))
    return Array.from(axisSet)
  }, [series])
  
  // Calculate max value
  const calculatedMaxValue = useMemo(() => {
    if (maxValue !== undefined) return maxValue
    return Math.max(...series.flatMap(s => s.data.map(d => d.value))) * 1.1
  }, [series, maxValue])
  
  // Process series with colors
  const processedSeries = useMemo(() => {
    return series.map((s, i) => ({
      ...s,
      color: s.color || defaultColors[i % defaultColors.length],
      // Ensure all series have data for all axes
      data: axes.map(axis => {
        const existing = s.data.find(d => d.axis === axis)
        return existing || { axis, value: 0 }
      }),
    }))
  }, [series, axes])
  
  // Convert to Plotly format
  const plotData = useMemo(() => {
    return processedSeries.map(s => ({
      type: 'scatterpolar' as const,
      r: s.data.map(d => d.value),
      theta: s.data.map(d => d.axis),
      fill: 'toself' as const,
      name: s.name,
      line: {
        color: s.color,
        width: 2,
      },
      fillcolor: s.color,
      opacity: 0.25,
      marker: {
        size: 6,
        color: s.color,
      },
      hovertemplate: '<b>%{theta}</b><br>Value: %{r}<extra></extra>',
    }))
  }, [processedSeries])
  
  const layout = useMemo(() => ({
    polar: {
      radialaxis: {
        visible: true,
        range: [0, calculatedMaxValue],
        tickmode: 'linear' as const,
        tick0: 0,
        dtick: calculatedMaxValue / levels,
        tickfont: {
          size: 10,
          color: chartColors.text.muted,
        },
        gridcolor: chartColors.background.border,
        linecolor: chartColors.background.border,
        showline: true,
      },
      angularaxis: {
        visible: true,
        tickfont: {
          size: 11,
          color: chartColors.text.secondary,
        },
        linecolor: chartColors.background.border,
        gridcolor: chartColors.background.border,
        rotation: 90,
        direction: 'counterclockwise' as const,
      },
      bgcolor: 'transparent',
    },
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: {
      color: chartColors.text.secondary,
      family: '"Space Grotesk", system-ui, sans-serif',
    },
    showlegend: showLegend,
    legend: {
      orientation: 'h' as const,
      xanchor: 'center' as const,
      x: 0.5,
      y: -0.1,
      font: {
        size: 11,
        color: chartColors.text.secondary,
      },
      bgcolor: 'transparent',
      bordercolor: chartColors.background.border,
    },
    margin: { l: 50, r: 50, t: title ? 40 : 20, b: 50 },
    height,
    hovermode: 'closest' as const,
    hoverlabel: {
      bgcolor: chartColors.background.card,
      bordercolor: chartColors.background.border,
      font: { color: chartColors.text.primary, size: 11 },
    },
    datarevision: revision,
  }), [calculatedMaxValue, levels, showLegend, title, height, revision])
  
  const config = useMemo(() => ({
    displayModeBar: false,
    responsive: true,
    scrollZoom: false,
  }), [])
  
  // Handle chart load
  const handleAfterPlot = useCallback(() => {
    setIsLoading(false)
  }, [])
  
  // Reset view
  const handleResetView = useCallback(() => {
    setRevision(r => r + 1)
  }, [])
  
  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="relative w-full"
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
      
      {/* Chart */}
      <div className="w-full h-full">
        <Plot
          data={plotData}
          layout={layout as any}
          config={config}
          style={{ width: '100%', height: '100%' }}
          onAfterPlot={handleAfterPlot}
          useResizeHandler={true}
        />
      </div>
    </motion.div>
  )
}
