/**
 * Scatter Chart Component
 * =======================
 * 
 * Point/scatter plot for risk assets visualization
 */
import { useMemo, useRef, useState, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import * as d3 from 'd3'
import { chartColors, getRiskColor } from '../../lib/chartColors'
import InteractiveTooltip, { useTooltip } from './InteractiveTooltip'

export interface ScatterDataPoint {
  label: string
  value: number
  risk?: number
  color?: string
}

interface ScatterChartProps {
  data: ScatterDataPoint[]
  height?: number
  showGrid?: boolean
  showLabels?: boolean
  showValues?: boolean
  animationDuration?: number
  title?: string
  valueFormat?: 'number' | 'currency' | 'percent'
  onPointClick?: (point: ScatterDataPoint) => void
  colorByRisk?: boolean
}

export default function ScatterChart({
  data,
  height = 300,
  showGrid = true,
  showLabels = true,
  showValues = true,
  animationDuration = 600,
  title,
  valueFormat = 'number',
  onPointClick,
  colorByRisk = true,
}: ScatterChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoveredPoint, setHoveredPoint] = useState<string | null>(null)
  const [width, setWidth] = useState(600)
  const tooltip = useTooltip()
  
  const margin = { top: 20, right: 20, bottom: 100, left: 50 }
  const innerWidth = width - margin.left - margin.right
  const innerHeight = height - margin.top - margin.bottom
  
  // Calculate max value
  const maxValue = useMemo(() => {
    if (!data || data.length === 0) return 100
    const max = Math.max(...data.map(d => d.value))
    return max > 0 ? max : 100
  }, [data])
  
  // Scales
  const { xScale, yScale } = useMemo(() => {
    if (!data || data.length === 0 || innerWidth <= 0 || innerHeight <= 0) {
      return {
        xScale: d3.scalePoint().domain([]).range([0, Math.max(1, innerWidth)]),
        yScale: d3.scaleLinear().domain([0, 100]).range([Math.max(1, innerHeight), 0]),
      }
    }
    
    const validData = data.filter(d => d && typeof d.value === 'number' && isFinite(d.value))
    if (validData.length === 0) {
      return {
        xScale: d3.scalePoint().domain([]).range([0, innerWidth]),
        yScale: d3.scaleLinear().domain([0, 100]).range([innerHeight, 0]),
      }
    }
    
    const xScale = d3.scalePoint()
      .domain(validData.map((_, i) => i.toString()))
      .range([0, innerWidth])
      .padding(0.5)
    
    const validMaxValue = Math.max(...validData.map(d => d.value), 1)
    const yScale = d3.scaleLinear()
      .domain([0, validMaxValue * 1.1])
      .range([innerHeight, 0])
      .nice()
    
    return { xScale, yScale }
  }, [data, maxValue, innerWidth, innerHeight])
  
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
        return value.toFixed(0)
    }
  }, [valueFormat])
  
  // Get point color
  const getPointColor = useCallback((d: ScatterDataPoint) => {
    if (colorByRisk && d.risk !== undefined) {
      return getRiskColor(d.risk)
    }
    return d.color || chartColors.series.climate
  }, [colorByRisk])
  
  // Handle point hover
  const handlePointHover = useCallback((
    e: React.MouseEvent,
    d: ScatterDataPoint,
    index: number
  ) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    
    tooltip.show(
      { x: e.clientX - rect.left, y: e.clientY - rect.top },
      [
        { label: d.label, value: d.value, format: valueFormat },
        ...(d.risk !== undefined ? [{ label: 'Risk', value: d.risk, format: 'percent' as const }] : []),
      ]
    )
    setHoveredPoint(index.toString())
  }, [tooltip, valueFormat])
  
  // Resize observer
  const containerRefCallback = useRef<HTMLDivElement | null>(null)
  
  useEffect(() => {
    const node = containerRefCallback.current
    if (!node) return
    
    const resizeObserver = new ResizeObserver(entries => {
      setWidth(entries[0].contentRect.width)
    })
    resizeObserver.observe(node)
    
    return () => resizeObserver.disconnect()
  }, [])
  
  // Early return if no valid data
  if (!data || data.length === 0 || !data.some(d => d && typeof d.value === 'number' && isFinite(d.value))) {
    return (
      <div className="relative">
        {title && (
          <h3 className="text-white/80 text-sm font-medium mb-3">{title}</h3>
        )}
        <div className="flex items-center justify-center h-[300px] text-white/40 text-sm">
          No data available
        </div>
      </div>
    )
  }
  
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
      
      <div ref={containerRefCallback} className="w-full">
        <svg
          ref={svgRef}
          width={width}
          height={height}
          onMouseLeave={() => { tooltip.hide(); setHoveredPoint(null) }}
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
            
            {/* X Axis */}
            <g transform={`translate(0,${innerHeight})`}>
              <line x1={0} x2={innerWidth} y1={0} y2={0} stroke={chartColors.background.border} />
              {data.map((d, i) => {
                const x = xScale(i.toString())
                if (x === undefined) return null
                return (
                  <g key={i} transform={`translate(${x},0)`}>
                    <text
                      y={20}
                      textAnchor="end"
                      fill={chartColors.text.muted}
                      fontSize={9}
                      transform="rotate(-45, 0, 20)"
                      dx="-5"
                    >
                      {d.label}
                    </text>
                  </g>
                )
              })}
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
            </g>
            
            {/* Points */}
            {data && data.length > 0 && data
              .map((d, i) => ({ d, i }))
              .filter(({ d }) => d && typeof d.value === 'number' && isFinite(d.value))
              .map(({ d, i }) => {
                const x = xScale(i.toString())
                if (x === undefined || isNaN(x) || !isFinite(x)) return null
                
                const y = yScale(d.value)
                if (isNaN(y) || !isFinite(y)) return null
                
                const isHovered = hoveredPoint === i.toString()
                const pointColor = getPointColor(d)
                const radius = isHovered ? 8 : 6
                
                if (!isFinite(radius) || radius <= 0) return null
                
                return (
                  <g key={i}>
                    <motion.circle
                      key={`${i}-${isHovered}`}
                      cx={x}
                      cy={y}
                      r={radius}
                    fill={pointColor}
                    fillOpacity={isHovered ? 1 : 0.85}
                    stroke={chartColors.background.dark}
                    strokeWidth={2}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ 
                      scale: 1, 
                      opacity: 1,
                    }}
                    transition={{
                      duration: animationDuration / 1000,
                      delay: i * 0.05,
                    }}
                    onMouseEnter={(e) => {
                      setHoveredPoint(i.toString())
                      handlePointHover(e, d, i)
                    }}
                    onMouseMove={(e) => tooltip.updatePosition({
                      x: e.clientX - (svgRef.current?.getBoundingClientRect().left || 0),
                      y: e.clientY - (svgRef.current?.getBoundingClientRect().top || 0)
                    })}
                    onClick={() => onPointClick?.(d)}
                    style={{ cursor: onPointClick ? 'pointer' : 'default' }}
                  />
                  
                  {/* Value label */}
                  {showValues && (
                    <text
                      x={x}
                      y={y - 12}
                      textAnchor="middle"
                      fill={chartColors.text.secondary}
                      fontSize={10}
                      fontWeight={500}
                    >
                      {formatValue(d.value)}
                    </text>
                  )}
                </g>
              )
            })}
          </g>
        </svg>
      </div>
      
      {/* Tooltip */}
      <InteractiveTooltip
        {...tooltip.tooltipProps}
        containerRef={containerRef}
      />
    </motion.div>
  )
}
