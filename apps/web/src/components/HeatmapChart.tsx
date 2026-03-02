/**
 * Heatmap visualization using D3.js.
 * 
 * ENHANCED VERSION:
 * - Interactive tooltips with detailed information
 * - Click handlers for cell selection
 * - Smooth animations on load and hover
 * - Improved color scales
 * - Filter by value range
 * 
 * Displays:
 * - Risk correlation matrices
 * - Portfolio heatmaps
 * - Time-series heatmaps
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import * as d3 from 'd3'
import { motion, AnimatePresence } from 'framer-motion'
import { chartColors } from '../lib/chartColors'

interface HeatmapDataPoint {
  x: string
  y: string
  value: number
  metadata?: Record<string, any>
}

interface HeatmapChartProps {
  data: HeatmapDataPoint[]
  xLabels: string[]
  yLabels: string[]
  title?: string
  colorScale?: 'RdYlGn' | 'Viridis' | 'Blues' | 'Risk'
  width?: number
  height?: number
  showLegend?: boolean
  showValues?: boolean
  onCellClick?: (cell: HeatmapDataPoint) => void
  valueFormat?: 'number' | 'percent' | 'currency'
  minValue?: number
  maxValue?: number
}

// Custom risk color scale
function getRiskInterpolator(t: number): string {
  const colors = [
    chartColors.risk.low,
    chartColors.risk.medium,
    chartColors.risk.high,
    chartColors.risk.critical,
  ]
  const index = Math.min(Math.floor(t * colors.length), colors.length - 1)
  return colors[index]
}

export default function HeatmapChart({
  data,
  xLabels,
  yLabels,
  title,
  colorScale = 'RdYlGn',
  width = 600,
  height = 400,
  showLegend = true,
  showValues = false,
  onCellClick,
  valueFormat = 'number',
  minValue,
  maxValue,
}: HeatmapChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [tooltipData, setTooltipData] = useState<{
    visible: boolean
    x: number
    y: number
    data: HeatmapDataPoint | null
  }>({ visible: false, x: 0, y: 0, data: null })
  const [selectedCell, setSelectedCell] = useState<string | null>(null)
  
  // Format value for display
  const formatValue = useCallback((value: number) => {
    switch (valueFormat) {
      case 'percent':
        return `${(value * 100).toFixed(1)}%`
      case 'currency':
        if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
        if (value >= 1_000) return `€${(value / 1_000).toFixed(0)}K`
        return `€${value.toFixed(0)}`
      default:
        return value.toFixed(1)
    }
  }, [valueFormat])

  useEffect(() => {
    if (!svgRef.current || !data || data.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = { top: title ? 40 : 20, right: showLegend ? 80 : 20, bottom: 60, left: 80 }
    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Calculate value range
    const dataMin = minValue ?? d3.min(data, (d) => d.value) ?? 0
    const dataMax = maxValue ?? d3.max(data, (d) => d.value) ?? 100
    
    // Color scale
    const color = d3
      .scaleSequential()
      .domain([dataMin, dataMax])
      .interpolator(
        colorScale === 'RdYlGn'
          ? d3.interpolateRdYlGn
          : colorScale === 'Viridis'
          ? d3.interpolateViridis
          : colorScale === 'Risk'
          ? getRiskInterpolator
          : d3.interpolateBlues
      )

    // X scale
    const xScale = d3
      .scaleBand()
      .domain(xLabels)
      .range([0, chartWidth])
      .padding(0.05)

    // Y scale
    const yScale = d3
      .scaleBand()
      .domain(yLabels)
      .range([0, chartHeight])
      .padding(0.05)

    // Create cells with animation
    const cells = g.selectAll('rect.cell')
      .data(data)
      .enter()
      .append('rect')
      .attr('class', 'cell')
      .attr('x', (d) => xScale(d.x) || 0)
      .attr('y', (d) => yScale(d.y) || 0)
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('fill', (d) => color(d.value))
      .attr('stroke', chartColors.background.border)
      .attr('stroke-width', 1)
      .attr('rx', 2)
      .attr('opacity', 0)
      .style('cursor', onCellClick ? 'pointer' : 'default')
    
    // Animate cells in
    cells
      .transition()
      .duration(500)
      .delay((_, i) => i * 10)
      .attr('opacity', 1)
    
    // Hover effects
    cells
      .on('mouseenter', function(event, d) {
        d3.select(this)
          .attr('stroke', chartColors.text.primary)
          .attr('stroke-width', 2)
        
        const rect = svgRef.current?.getBoundingClientRect()
        if (rect) {
          setTooltipData({
            visible: true,
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
            data: d,
          })
        }
      })
      .on('mousemove', function(event) {
        const rect = svgRef.current?.getBoundingClientRect()
        if (rect) {
          setTooltipData(prev => ({
            ...prev,
            x: event.clientX - rect.left,
            y: event.clientY - rect.top,
          }))
        }
      })
      .on('mouseleave', function() {
        d3.select(this)
          .attr('stroke', chartColors.background.border)
          .attr('stroke-width', 1)
        
        setTooltipData(prev => ({ ...prev, visible: false }))
      })
      .on('click', function(_, d) {
        const cellKey = `${d.x}-${d.y}`
        setSelectedCell(prev => prev === cellKey ? null : cellKey)
        onCellClick?.(d)
      })

    // Show values in cells if enabled
    if (showValues && xScale.bandwidth() > 30 && yScale.bandwidth() > 20) {
      g.selectAll('text.cell-value')
        .data(data)
        .enter()
        .append('text')
        .attr('class', 'cell-value')
        .attr('x', (d) => (xScale(d.x) || 0) + xScale.bandwidth() / 2)
        .attr('y', (d) => (yScale(d.y) || 0) + yScale.bandwidth() / 2)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', (d) => {
          // Use white text on dark cells, dark text on light cells
          const normalized = (d.value - dataMin) / (dataMax - dataMin)
          return normalized > 0.5 ? chartColors.text.primary : chartColors.background.dark
        })
        .style('font-size', '10px')
        .style('pointer-events', 'none')
        .text((d) => formatValue(d.value))
        .attr('opacity', 0)
        .transition()
        .delay(500)
        .duration(300)
        .attr('opacity', 1)
    }

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .style('fill', chartColors.text.muted)
      .style('font-size', '10px')
      .attr('transform', 'rotate(-45)')
      .style('text-anchor', 'end')

    // Y axis
    g.append('g')
      .call(d3.axisLeft(yScale))
      .selectAll('text')
      .style('fill', chartColors.text.muted)
      .style('font-size', '10px')

    // Style axis lines
    g.selectAll('.domain, .tick line')
      .attr('stroke', chartColors.background.border)

    // Title
    if (title) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .style('fill', chartColors.text.secondary)
        .style('font-size', '14px')
        .style('font-weight', '500')
        .text(title)
    }

    // Color legend
    if (showLegend) {
      const legendWidth = 20
      const legendHeight = chartHeight
      const legend = g
        .append('g')
        .attr('transform', `translate(${chartWidth + 20},0)`)

      // Gradient definition
      const gradientId = `heatmap-gradient-${Math.random().toString(36).slice(2)}`
      const defs = svg.append('defs')
      const gradient = defs
        .append('linearGradient')
        .attr('id', gradientId)
        .attr('x1', '0%')
        .attr('x2', '0%')
        .attr('y1', '100%')
        .attr('y2', '0%')

      gradient
        .selectAll('stop')
        .data(d3.range(0, 1.01, 0.1))
        .enter()
        .append('stop')
        .attr('offset', (t) => `${t * 100}%`)
        .attr('stop-color', (t) => color(dataMin + t * (dataMax - dataMin)))

      legend
        .append('rect')
        .attr('width', legendWidth)
        .attr('height', legendHeight)
        .style('fill', `url(#${gradientId})`)
        .attr('rx', 2)

      // Legend axis
      const legendScale = d3
        .scaleLinear()
        .domain([dataMin, dataMax])
        .range([legendHeight, 0])

      legend
        .append('g')
        .attr('transform', `translate(${legendWidth + 4},0)`)
        .call(d3.axisRight(legendScale).ticks(5).tickFormat(d => formatValue(d as number)))
        .selectAll('text')
        .style('fill', chartColors.text.muted)
        .style('font-size', '9px')
      
      legend.selectAll('.domain, .tick line')
        .attr('stroke', chartColors.background.border)
    }
  }, [data, xLabels, yLabels, title, colorScale, width, height, showLegend, showValues, onCellClick, formatValue, minValue, maxValue])

  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative w-full h-full glass rounded-md p-4"
    >
      <svg ref={svgRef} width={width} height={height} className="overflow-visible" />
      
      {/* Custom Tooltip */}
      <AnimatePresence>
        {tooltipData.visible && tooltipData.data && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            style={{
              position: 'absolute',
              left: tooltipData.x + 15,
              top: tooltipData.y - 10,
              pointerEvents: 'none',
            }}
            className="bg-[#18181b] border border-white/10 rounded-lg px-3 py-2 shadow-xl z-50"
          >
            <div className="text-xs space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-white/40">{tooltipData.data.x}</span>
                <span className="text-white/20">×</span>
                <span className="text-white/40">{tooltipData.data.y}</span>
              </div>
              <div className="text-white font-mono font-medium">
                {formatValue(tooltipData.data.value)}
              </div>
              {tooltipData.data.metadata && Object.entries(tooltipData.data.metadata).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-4">
                  <span className="text-white/40">{key}</span>
                  <span className="text-white/70">{String(value)}</span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
