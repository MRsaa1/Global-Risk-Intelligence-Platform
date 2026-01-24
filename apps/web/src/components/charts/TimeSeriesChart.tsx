/**
 * Time Series Chart Component
 * ============================
 * 
 * Interactive line chart for historical risk data
 * - Multiple series support
 * - Interactive tooltip
 * - Zoom and pan
 * - Animated transitions
 */
import { useMemo, useRef, useState, useCallback } from 'react'
import { motion } from 'framer-motion'
import * as d3 from 'd3'
import { chartColors, seriesColors } from '../../lib/chartColors'
import InteractiveTooltip, { useTooltip, Crosshair } from './InteractiveTooltip'

export interface TimeSeriesDataPoint {
  date: Date | string
  value: number
}

export interface TimeSeriesSeries {
  id: string
  name: string
  data: TimeSeriesDataPoint[]
  color?: string
}

export interface ThresholdLine {
  value: number
  label: string
  color: string
  style?: 'solid' | 'dashed'
}

export interface ChartAnnotation {
  date: Date | string
  label: string
  type: 'stress-test' | 'alert' | 'event'
  color?: string
}

interface TimeSeriesChartProps {
  series: TimeSeriesSeries[]
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  showArea?: boolean
  showStatistics?: boolean
  animationDuration?: number
  title?: string
  yAxisLabel?: string
  valueFormat?: 'number' | 'currency' | 'percent'
  thresholds?: ThresholdLine[]
  annotations?: ChartAnnotation[]
}

// Default series colors
const defaultColors = Object.values(seriesColors)

export default function TimeSeriesChart({
  series,
  height = 300,
  showGrid = true,
  showLegend = true,
  showArea = true,
  showStatistics = false,
  animationDuration = 800,
  title,
  yAxisLabel,
  valueFormat = 'number',
  thresholds = [],
  annotations = [],
}: TimeSeriesChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoveredSeries, setHoveredSeries] = useState<string | null>(null)
  const tooltip = useTooltip()
  
  // Dimensions
  const margin = { top: 20, right: 20, bottom: 40, left: 50 }
  const [width, setWidth] = useState(600)
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom
  
  // Process data
  const processedData = useMemo(() => {
    return series
      .filter(s => s && s.data && Array.isArray(s.data) && s.data.length > 0)
      .map((s, i) => ({
        ...s,
        color: s.color || defaultColors[i % defaultColors.length],
        data: s.data
          .map(d => ({
            date: typeof d.date === 'string' ? new Date(d.date) : d.date,
            value: typeof d.value === 'number' && isFinite(d.value) ? d.value : 0,
          }))
          .filter(d => d.date instanceof Date && !isNaN(d.date.getTime()) && isFinite(d.value)),
      }))
      .filter(s => s.data.length > 0)
  }, [series])
  
  // Scales
  const { xScale, yScale } = useMemo(() => {
    const allDates = processedData.flatMap(s => s.data.map(d => d.date))
    const allValues = processedData.flatMap(s => s.data.map(d => d.value))
    
    const xScale = d3.scaleTime()
      .domain(d3.extent(allDates) as [Date, Date])
      .range([0, innerWidth])
    
    const yScale = d3.scaleLinear()
      .domain([0, (d3.max(allValues) || 100) * 1.1])
      .range([innerHeight, 0])
      .nice()
    
    return { xScale, yScale }
  }, [processedData, innerWidth, innerHeight])
  
  // Line generator
  const lineGenerator = useMemo(() => {
    return d3.line<{ date: Date; value: number }>()
      .x(d => xScale(d.date))
      .y(d => yScale(d.value))
      .curve(d3.curveMonotoneX)
  }, [xScale, yScale])
  
  // Area generator
  const areaGenerator = useMemo(() => {
    return d3.area<{ date: Date; value: number }>()
      .x(d => xScale(d.date))
      .y0(innerHeight)
      .y1(d => yScale(d.value))
      .curve(d3.curveMonotoneX)
  }, [xScale, yScale, innerHeight])
  
  // Calculate statistics for each series
  const statistics = useMemo(() => {
    return processedData.map(s => {
      const values = s.data.map(d => d.value)
      const min = Math.min(...values)
      const max = Math.max(...values)
      const avg = values.reduce((sum, v) => sum + v, 0) / values.length
      const current = values[values.length - 1]
      
      return {
        id: s.id,
        name: s.name,
        color: s.color,
        min: Math.round(min * 10) / 10,
        max: Math.round(max * 10) / 10,
        avg: Math.round(avg * 10) / 10,
        current: Math.round(current * 10) / 10,
      }
    })
  }, [processedData])
  
  // Format value
  const formatValue = useCallback((value: number) => {
    switch (valueFormat) {
      case 'currency':
        if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
        if (value >= 1_000) return `€${(value / 1_000).toFixed(0)}K`
        return `€${value.toFixed(0)}`
      case 'percent':
        return `${(value * 100).toFixed(1)}%`
      default:
        return value.toFixed(1)
    }
  }, [valueFormat])
  
  // Handle mouse move for tooltip
  const handleMouseMove = useCallback((e: React.MouseEvent<SVGSVGElement>) => {
    if (!svgRef.current) return
    
    const rect = svgRef.current.getBoundingClientRect()
    const x = e.clientX - rect.left - margin.left
    const y = e.clientY - rect.top - margin.top
    
    if (x < 0 || x > innerWidth || y < 0 || y > innerHeight) {
      tooltip.hide()
      return
    }
    
    // Find nearest date
    const date = xScale.invert(x)
    
    // Find values for each series at this date
    const tooltipData = processedData.map(s => {
      // Find nearest data point
      const bisect = d3.bisector((d: { date: Date }) => d.date).left
      const index = bisect(s.data, date)
      const d0 = s.data[index - 1]
      const d1 = s.data[index]
      const d = d0 && d1 
        ? (date.getTime() - d0.date.getTime() > d1.date.getTime() - date.getTime() ? d1 : d0)
        : (d0 || d1)
      
      return {
        label: s.name,
        value: d?.value || 0,
        color: s.color,
        format: valueFormat,
      }
    })
    
    tooltip.show(
      { x: e.clientX - rect.left, y: e.clientY - rect.top },
      tooltipData,
      date.toLocaleDateString()
    )
  }, [xScale, innerWidth, innerHeight, margin, processedData, tooltip, valueFormat])
  
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
      {/* Early return if no valid data */}
      {(!processedData || processedData.length === 0) && (
        <div className="flex items-center justify-center h-[300px] text-white/40 text-sm">
          No data available
        </div>
      )}
      
      {processedData && processedData.length > 0 && (
        <>
          {/* Title */}
          {title && (
            <h3 className="text-white/80 text-sm font-medium mb-3">{title}</h3>
          )}
          
          <div ref={containerCallback} className="w-full">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => tooltip.hide()}
          className="overflow-visible"
        >
          <g transform={`translate(${margin.left},${margin.top})`}>
            {/* Grid lines */}
            {showGrid && (
              <g className="grid">
                {yScale.ticks(5).map((tick, i) => (
                  <line
                    key={i}
                    x1={0}
                    x2={innerWidth}
                    y1={yScale(tick)}
                    y2={yScale(tick)}
                    stroke={chartColors.background.border}
                    strokeDasharray="4,4"
                  />
                ))}
              </g>
            )}
            
            {/* Threshold Lines */}
            {thresholds.length > 0 && (
              <g className="thresholds">
                {thresholds.map((threshold, i) => {
                  const y = yScale(threshold.value)
                  // Only render if within visible range
                  if (y < 0 || y > innerHeight) return null
                  
                  return (
                    <g key={`threshold-${i}`}>
                      <line
                        x1={0}
                        x2={innerWidth}
                        y1={y}
                        y2={y}
                        stroke={threshold.color}
                        strokeWidth={1.5}
                        strokeDasharray={threshold.style === 'dashed' ? '6,4' : undefined}
                        opacity={0.7}
                      />
                      <rect
                        x={innerWidth - 70}
                        y={y - 10}
                        width={70}
                        height={16}
                        fill={chartColors.background.card}
                        rx={3}
                      />
                      <text
                        x={innerWidth - 35}
                        y={y + 1}
                        textAnchor="middle"
                        fill={threshold.color}
                        fontSize={9}
                        fontWeight={500}
                      >
                        {threshold.label} ({threshold.value})
                      </text>
                    </g>
                  )
                })}
              </g>
            )}
            
            {/* X Axis */}
            <g transform={`translate(0,${innerHeight})`}>
              <line x1={0} x2={innerWidth} y1={0} y2={0} stroke={chartColors.background.border} />
              {xScale.ticks(6).map((tick, i) => (
                <g key={i} transform={`translate(${xScale(tick)},0)`}>
                  <line y2={6} stroke={chartColors.background.border} />
                  <text
                    y={20}
                    textAnchor="middle"
                    fill={chartColors.text.muted}
                    fontSize={10}
                  >
                    {d3.timeFormat('%b %d')(tick)}
                  </text>
                </g>
              ))}
            </g>
            
            {/* Y Axis */}
            <g>
              <line y1={0} y2={innerHeight} stroke={chartColors.background.border} />
              {yScale.ticks(5).map((tick, i) => (
                <g key={i} transform={`translate(0,${yScale(tick)})`}>
                  <line x2={-6} stroke={chartColors.background.border} />
                  <text
                    x={-10}
                    dy="0.32em"
                    textAnchor="end"
                    fill={chartColors.text.muted}
                    fontSize={10}
                  >
                    {formatValue(tick)}
                  </text>
                </g>
              ))}
              {yAxisLabel && (
                <text
                  transform={`translate(-40,${innerHeight / 2}) rotate(-90)`}
                  textAnchor="middle"
                  fill={chartColors.text.muted}
                  fontSize={11}
                >
                  {yAxisLabel}
                </text>
              )}
            </g>
            
            {/* Areas */}
            {showArea && processedData.map((s, i) => {
              if (!s.data || s.data.length === 0) return null
              
              try {
                const areaPath = areaGenerator(s.data)
                const pathData = (areaPath && typeof areaPath === 'string' && areaPath.length > 0) ? areaPath : null
                if (!pathData) return null
                
                return (
                  <motion.path
                    key={`area-${s.id}`}
                    d={pathData}
                    fill={s.color}
                    fillOpacity={hoveredSeries === null || hoveredSeries === s.id ? 0.15 : 0.05}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: animationDuration / 1000, delay: i * 0.1 }}
                  />
                )
              } catch (e) {
                console.warn('Error generating area path:', e)
                return null
              }
            })}
            
            {/* Lines */}
            {processedData.map((s, i) => {
              if (!s.data || s.data.length === 0) return null
              
              try {
                const linePath = lineGenerator(s.data)
                const pathData = (linePath && typeof linePath === 'string' && linePath.length > 0) ? linePath : null
                if (!pathData) return null
                
                return (
                  <motion.path
                    key={`line-${s.id}`}
                    d={pathData}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={hoveredSeries === null || hoveredSeries === s.id ? 2 : 1}
                    strokeOpacity={hoveredSeries === null || hoveredSeries === s.id ? 1 : 0.3}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: animationDuration / 1000, delay: i * 0.1 }}
                  />
                )
              } catch (e) {
                console.warn('Error generating line path:', e)
                return null
              }
            })}
            
            {/* Annotations */}
            {annotations.length > 0 && (
              <g className="annotations">
                {annotations.map((annotation, i) => {
                  const annotationDate = typeof annotation.date === 'string' 
                    ? new Date(annotation.date) 
                    : annotation.date
                  
                  const x = xScale(annotationDate)
                  
                  // Skip if outside visible range
                  if (x < 0 || x > innerWidth) return null
                  
                  // Get annotation color based on type
                  const color = annotation.color || (
                    annotation.type === 'stress-test' ? '#8b5cf6' :
                    annotation.type === 'alert' ? '#ef4444' :
                    '#3b82f6'
                  )
                  
                  // Get marker shape based on type
                  const getMarker = () => {
                    switch (annotation.type) {
                      case 'stress-test':
                        // Diamond
                        return (
                          <path
                            d={`M ${x} 5 L ${x + 6} 11 L ${x} 17 L ${x - 6} 11 Z`}
                            fill={color}
                            stroke={chartColors.background.card}
                            strokeWidth={1}
                          />
                        )
                      case 'alert':
                        // Triangle
                        return (
                          <path
                            d={`M ${x} 5 L ${x + 7} 17 L ${x - 7} 17 Z`}
                            fill={color}
                            stroke={chartColors.background.card}
                            strokeWidth={1}
                          />
                        )
                      default:
                        // Circle
                        return (
                          <circle
                            cx={x}
                            cy={11}
                            r={5}
                            fill={color}
                            stroke={chartColors.background.card}
                            strokeWidth={1}
                          />
                        )
                    }
                  }
                  
                  return (
                    <g key={`annotation-${i}`} className="annotation">
                      {/* Vertical line */}
                      <line
                        x1={x}
                        x2={x}
                        y1={20}
                        y2={innerHeight}
                        stroke={color}
                        strokeWidth={1}
                        strokeDasharray="3,3"
                        opacity={0.5}
                      />
                      {/* Marker */}
                      {getMarker()}
                      {/* Label on hover - using title for simplicity */}
                      <title>{annotation.label}</title>
                    </g>
                  )
                })}
              </g>
            )}
            
            {/* Crosshair */}
            <Crosshair
              visible={tooltip.visible}
              position={tooltip.position}
              width={innerWidth}
              height={innerHeight}
              showVertical={true}
              showHorizontal={false}
            />
          </g>
        </svg>
      </div>
      
      {/* Legend */}
      {showLegend && (
        <div className="flex flex-wrap gap-4 mt-3 justify-center">
          {processedData.map(s => (
            <button
              key={s.id}
              className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 transition-colors"
              onMouseEnter={() => setHoveredSeries(s.id)}
              onMouseLeave={() => setHoveredSeries(null)}
            >
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-xs text-white/60">{s.name}</span>
            </button>
          ))}
        </div>
      )}
      
      {/* Statistics */}
      {showStatistics && statistics.length > 0 && (
        <div className="mt-4 pt-3 border-t border-white/5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {statistics.map(stat => (
              <div 
                key={stat.id}
                className="bg-white/5 rounded-lg p-2.5"
              >
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div 
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: stat.color }}
                  />
                  <span className="text-xs text-white/50 truncate">{stat.name}</span>
                </div>
                <div className="grid grid-cols-3 gap-1 text-center">
                  <div>
                    <div className="text-[10px] text-white/30 uppercase">Min</div>
                    <div className="text-xs text-white/70 font-medium">{stat.min}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/30 uppercase">Avg</div>
                    <div className="text-xs text-white/90 font-medium">{stat.avg}</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/30 uppercase">Max</div>
                    <div className="text-xs text-white/70 font-medium">{stat.max}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
          {/* Tooltip */}
          <InteractiveTooltip
            {...tooltip.tooltipProps}
            containerRef={containerRef}
          />
        </>
      )}
    </motion.div>
  )
}
