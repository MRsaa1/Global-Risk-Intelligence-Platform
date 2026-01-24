/**
 * Bar Chart Component
 * ====================
 * 
 * Interactive bar chart with grouped/stacked support
 * - Vertical and horizontal orientations
 * - Grouped bars for comparison
 * - Stacked bars for cumulative data
 * - Interactive hover effects
 */
import { useMemo, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import * as d3 from 'd3'
import { chartColors, seriesColors, getRiskColor } from '../../lib/chartColors'
import InteractiveTooltip, { useTooltip } from './InteractiveTooltip'

export interface BarDataPoint {
  label: string
  value: number
  color?: string
  risk?: number
}

export interface BarSeries {
  id: string
  name: string
  data: BarDataPoint[]
  color?: string
}

interface BarChartProps {
  data?: BarDataPoint[]
  series?: BarSeries[]
  height?: number
  orientation?: 'vertical' | 'horizontal'
  stacked?: boolean
  showGrid?: boolean
  showLegend?: boolean
  showValues?: boolean
  animationDuration?: number
  title?: string
  valueFormat?: 'number' | 'currency' | 'percent'
  onBarClick?: (item: BarDataPoint, index: number) => void
  colorByRisk?: boolean
}

const defaultColors = Object.values(seriesColors)

export default function BarChart({
  data,
  series,
  height = 300,
  orientation = 'vertical',
  stacked = false,
  showGrid = true,
  showLegend = true,
  showValues = false,
  animationDuration = 600,
  title,
  valueFormat = 'number',
  onBarClick,
  colorByRisk = false,
}: BarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoveredBar, setHoveredBar] = useState<string | null>(null)
  const [width, setWidth] = useState(600)
  const tooltip = useTooltip()
  
  const isVertical = orientation === 'vertical'
  const margin = { 
    top: 20, 
    right: 20, 
    bottom: isVertical ? 80 : 60, 
    left: isVertical ? 50 : 120 
  }
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom
  
  // Normalize data to series format
  const processedSeries = useMemo(() => {
    if (series) return series
    if (data) {
      return [{
        id: 'default',
        name: 'Value',
        data: data,
        color: chartColors.series.climate,
      }]
    }
    return []
  }, [data, series])
  
  // Get all labels
  const labels = useMemo(() => {
    const allLabels = new Set<string>()
    processedSeries.forEach(s => s.data.forEach(d => allLabels.add(d.label)))
    return Array.from(allLabels)
  }, [processedSeries])
  
  // Calculate max value
  const maxValue = useMemo(() => {
    if (stacked) {
      return Math.max(...labels.map(label => {
        return processedSeries.reduce((sum, s) => {
          const d = s.data.find(d => d.label === label)
          return sum + (d?.value || 0)
        }, 0)
      }))
    }
    return Math.max(...processedSeries.flatMap(s => s.data.map(d => d.value)))
  }, [processedSeries, labels, stacked])
  
  // Scales
  const { categoryScale, valueScale } = useMemo(() => {
    const categoryScale = d3.scaleBand()
      .domain(labels)
      .range(isVertical ? [0, innerWidth] : [0, innerHeight])
      .padding(0.2)
    
    const valueScale = d3.scaleLinear()
      .domain([0, maxValue * 1.1])
      .range(isVertical ? [innerHeight, 0] : [0, innerWidth])
      .nice()
    
    return { categoryScale, valueScale }
  }, [labels, maxValue, innerWidth, innerHeight, isVertical])
  
  // Bar width for grouped bars
  const barWidth = useMemo(() => {
    if (stacked || processedSeries.length === 1) {
      return categoryScale.bandwidth()
    }
    return categoryScale.bandwidth() / processedSeries.length
  }, [categoryScale, processedSeries.length, stacked])
  
  // Format value
  const formatValue = useCallback((value: number) => {
    switch (valueFormat) {
      case 'currency':
        if (value >= 1_000_000_000) return `€${(value / 1_000_000_000).toFixed(1)}B`
        if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
        if (value >= 1_000) return `€${(value / 1_000).toFixed(0)}K`
        return `€${value.toFixed(0)}`
      case 'percent':
        return `${(value * 100).toFixed(1)}%`
      default:
        return value >= 1000 ? `${(value / 1000).toFixed(1)}K` : value.toFixed(0)
    }
  }, [valueFormat])
  
  // Get bar color
  const getBarColor = useCallback((d: BarDataPoint, seriesColor?: string) => {
    if (colorByRisk && d.risk !== undefined) {
      return getRiskColor(d.risk)
    }
    return d.color || seriesColor || chartColors.series.climate
  }, [colorByRisk])
  
  // Handle bar hover
  const handleBarHover = useCallback((
    e: React.MouseEvent,
    d: BarDataPoint,
    seriesName?: string
  ) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    
    tooltip.show(
      { x: e.clientX - rect.left, y: e.clientY - rect.top },
      [
        { label: d.label, value: d.value, format: valueFormat },
        ...(d.risk !== undefined ? [{ label: 'Risk', value: d.risk, format: 'percent' as const }] : []),
      ],
      seriesName
    )
    setHoveredBar(`${seriesName}-${d.label}`)
  }, [tooltip, valueFormat])
  
  // Resize observer
  const containerCallback = useCallback((node: HTMLDivElement | null) => {
    if (!node) return
    const resizeObserver = new ResizeObserver(entries => {
      setWidth(entries[0].contentRect.width)
    })
    resizeObserver.observe(node)
    return () => resizeObserver.disconnect()
  }, [])
  
  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="relative"
    >
      {title && (
        <h3 className="text-white/80 text-sm font-medium mb-3">{title}</h3>
      )}
      
      <div ref={containerCallback} className="w-full">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          onMouseLeave={() => { tooltip.hide(); setHoveredBar(null) }}
          className="overflow-visible"
        >
          <g transform={`translate(${margin.left},${margin.top})`}>
            {/* Grid lines */}
            {showGrid && (
              <g className="grid">
                {valueScale.ticks(5).map((tick, i) => (
                  <line
                    key={i}
                    x1={isVertical ? 0 : valueScale(tick)}
                    x2={isVertical ? innerWidth : valueScale(tick)}
                    y1={isVertical ? valueScale(tick) : 0}
                    y2={isVertical ? valueScale(tick) : innerHeight}
                    stroke={chartColors.background.border}
                    strokeDasharray="4,4"
                  />
                ))}
              </g>
            )}
            
            {/* Category Axis */}
            <g transform={isVertical ? `translate(0,${innerHeight})` : ''}>
              {labels.map((label, i) => (
                <g
                  key={i}
                  transform={
                    isVertical
                      ? `translate(${(categoryScale(label) || 0) + categoryScale.bandwidth() / 2},0)`
                      : `translate(0,${(categoryScale(label) || 0) + categoryScale.bandwidth() / 2})`
                  }
                >
                  <text
                    x={isVertical ? 0 : -10}
                    y={isVertical ? 15 : 0}
                    textAnchor={isVertical ? 'middle' : 'end'}
                    dominantBaseline={isVertical ? 'hanging' : 'middle'}
                    fill={chartColors.text.muted}
                    fontSize={9}
                    className="select-none"
                    transform={isVertical ? `rotate(-45, 0, 15)` : ''}
                    transformOrigin={isVertical ? '0 15' : ''}
                  >
                    {label}
                  </text>
                </g>
              ))}
            </g>
            
            {/* Value Axis */}
            <g>
              {valueScale.ticks(5).map((tick, i) => (
                <g
                  key={i}
                  transform={
                    isVertical
                      ? `translate(0,${valueScale(tick)})`
                      : `translate(${valueScale(tick)},${innerHeight})`
                  }
                >
                  <text
                    x={isVertical ? -10 : 0}
                    y={isVertical ? 0 : 15}
                    textAnchor={isVertical ? 'end' : 'middle'}
                    dominantBaseline={isVertical ? 'middle' : 'hanging'}
                    fill={chartColors.text.muted}
                    fontSize={10}
                  >
                    {formatValue(tick)}
                  </text>
                </g>
              ))}
            </g>
            
            {/* Bars */}
            {processedSeries.map((s, si) => (
              <g key={s.id}>
                {labels.map((label, li) => {
                  const d = s.data.find(d => d.label === label)
                  if (!d) return null
                  
                  const barColor = getBarColor(d, s.color || defaultColors[si % defaultColors.length])
                  const isHovered = hoveredBar === `${s.name}-${d.label}`
                  
                  // Calculate bar position
                  let x: number, y: number, barW: number, barH: number
                  
                  if (isVertical) {
                    x = (categoryScale(label) || 0) + (stacked ? 0 : si * barWidth)
                    y = valueScale(d.value)
                    barW = barWidth
                    barH = innerHeight - valueScale(d.value)
                  } else {
                    x = 0
                    const barThickness = barWidth * 0.6 // Make bars thinner (60% of available space)
                    y = (categoryScale(label) || 0) + (stacked ? 0 : si * barWidth) + (barWidth - barThickness) / 2
                    barW = valueScale(d.value)
                    barH = barThickness
                  }
                  
                  return (
                    <motion.rect
                      key={`${s.id}-${label}`}
                      x={x}
                      y={isVertical ? innerHeight : y}
                      width={isVertical ? barW : 0}
                      height={isVertical ? 0 : barH}
                      fill={barColor}
                      fillOpacity={isHovered ? 1 : 0.85}
                      rx={3}
                      initial={false}
                      animate={{
                        y: isVertical ? y : y,
                        height: isVertical ? barH : barH,
                        width: isVertical ? barW : barW,
                        fillOpacity: isHovered ? 1 : 0.85,
                      }}
                      transition={{
                        duration: animationDuration / 1000,
                        delay: li * 0.05,
                      }}
                      onMouseEnter={(e) => handleBarHover(e, d, s.name)}
                      onMouseMove={(e) => tooltip.updatePosition({ 
                        x: e.clientX - (svgRef.current?.getBoundingClientRect().left || 0),
                        y: e.clientY - (svgRef.current?.getBoundingClientRect().top || 0)
                      })}
                      onClick={() => onBarClick?.(d, li)}
                      style={{ cursor: onBarClick ? 'pointer' : 'default' }}
                    />
                  )
                })}
              </g>
            ))}
            
            {/* Value labels */}
            {showValues && processedSeries.map((s, si) => (
              <g key={`values-${s.id}`}>
                {labels.map((label, li) => {
                  const d = s.data.find(d => d.label === label)
                  if (!d) return null
                  
                  return (
                    <text
                      key={`${s.id}-${label}-value`}
                      x={
                        isVertical
                          ? (categoryScale(label) || 0) + (stacked ? categoryScale.bandwidth() / 2 : si * barWidth + barWidth / 2)
                          : valueScale(d.value) + 5
                      }
                      y={
                        isVertical
                          ? valueScale(d.value) - 5
                          : (categoryScale(label) || 0) + (stacked ? categoryScale.bandwidth() / 2 : si * barWidth + barWidth / 2)
                      }
                      textAnchor={isVertical ? 'middle' : 'start'}
                      dominantBaseline={isVertical ? 'auto' : 'middle'}
                      fill={chartColors.text.secondary}
                      fontSize={10}
                    >
                      {formatValue(d.value)}
                    </text>
                  )
                })}
              </g>
            ))}
          </g>
        </svg>
      </div>
      
      {/* Legend */}
      {showLegend && processedSeries.length > 1 && (
        <div className="flex flex-wrap gap-4 mt-3 justify-center">
          {processedSeries.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded"
                style={{ backgroundColor: s.color || defaultColors[i % defaultColors.length] }}
              />
              <span className="text-xs text-white/60">{s.name}</span>
            </div>
          ))}
        </div>
      )}
      
      {/* Tooltip */}
      <InteractiveTooltip
        {...tooltip.tooltipProps}
        containerRef={containerRef}
      />
    </motion.div>
  )
}
