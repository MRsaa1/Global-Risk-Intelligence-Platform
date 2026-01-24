/**
 * Pie Chart Component
 * ====================
 * 
 * Interactive pie/doughnut chart for risk distribution
 * - Click to filter segments
 * - Animated transitions
 * - Interactive legend
 */
import { useMemo, useRef, useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as d3 from 'd3'
import { chartColors, pieColors, getRiskColor } from '../../lib/chartColors'
import InteractiveTooltip, { useTooltip } from './InteractiveTooltip'

export interface PieDataPoint {
  id: string
  label: string
  value: number
  color?: string
  risk?: number
}

interface PieChartProps {
  data: PieDataPoint[]
  size?: number
  innerRadius?: number
  showLegend?: boolean
  showLabels?: boolean
  showValues?: boolean
  animationDuration?: number
  title?: string
  valueFormat?: 'number' | 'currency' | 'percent'
  onSegmentClick?: (segment: PieDataPoint) => void
  colorByRisk?: boolean
}

export default function PieChart({
  data,
  size = 250,
  innerRadius = 0.6,
  showLegend = true,
  showLabels = false,
  showValues = true,
  animationDuration = 800,
  title,
  valueFormat = 'number',
  onSegmentClick,
  colorByRisk = false,
}: PieChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null)
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null)
  const tooltip = useTooltip()
  
  const outerRadius = size / 2 - 10
  const innerRadiusValue = outerRadius * innerRadius
  
  // Process data with colors
  const processedData = useMemo(() => {
    return data.map((d, i) => ({
      ...d,
      color: colorByRisk && d.risk !== undefined
        ? getRiskColor(d.risk)
        : d.color || pieColors[i % pieColors.length],
    }))
  }, [data, colorByRisk])
  
  // Calculate total
  const total = useMemo(() => {
    return processedData.reduce((sum, d) => sum + d.value, 0)
  }, [processedData])
  
  // Pie generator
  const pieGenerator = useMemo(() => {
    return d3.pie<PieDataPoint>()
      .value(d => d.value)
      .sort(null)
      .padAngle(0.02)
  }, [])
  
  // Arc generator
  const arcGenerator = useMemo(() => {
    return d3.arc<d3.PieArcDatum<PieDataPoint>>()
      .innerRadius(innerRadiusValue)
      .outerRadius(outerRadius)
      .cornerRadius(4)
  }, [innerRadiusValue, outerRadius])
  
  // Hover arc (slightly larger)
  const hoverArcGenerator = useMemo(() => {
    return d3.arc<d3.PieArcDatum<PieDataPoint>>()
      .innerRadius(innerRadiusValue)
      .outerRadius(outerRadius + 8)
      .cornerRadius(4)
  }, [innerRadiusValue, outerRadius])
  
  // Label arc
  const labelArcGenerator = useMemo(() => {
    return d3.arc<d3.PieArcDatum<PieDataPoint>>()
      .innerRadius(outerRadius * 0.7)
      .outerRadius(outerRadius * 0.7)
  }, [outerRadius])
  
  // Pie data
  const pieData = useMemo(() => {
    return pieGenerator(processedData)
  }, [pieGenerator, processedData])
  
  // Format value
  const formatValue = useCallback((value: number) => {
    switch (valueFormat) {
      case 'currency':
        if (value >= 1_000_000_000) return `€${(value / 1_000_000_000).toFixed(1)}B`
        if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
        if (value >= 1_000) return `€${(value / 1_000).toFixed(0)}K`
        return `€${value.toFixed(0)}`
      case 'percent':
        return `${((value / total) * 100).toFixed(1)}%`
      default:
        return value.toFixed(0)
    }
  }, [valueFormat, total])
  
  // Handle segment hover
  const handleSegmentHover = useCallback((
    e: React.MouseEvent,
    d: d3.PieArcDatum<PieDataPoint>
  ) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    
    const percentage = ((d.data.value / total) * 100).toFixed(1)
    
    tooltip.show(
      { x: e.clientX - rect.left, y: e.clientY - rect.top },
      [
        { label: 'Value', value: d.data.value, format: valueFormat },
        { label: 'Percentage', value: `${percentage}%` },
      ],
      d.data.label
    )
    setHoveredSegment(d.data.id)
  }, [tooltip, total, valueFormat])
  
  // Handle segment click
  const handleSegmentClick = useCallback((d: d3.PieArcDatum<PieDataPoint>) => {
    setSelectedSegment(prev => prev === d.data.id ? null : d.data.id)
    onSegmentClick?.(d.data)
  }, [onSegmentClick])
  
  return (
    <motion.div
      ref={containerRef}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="relative"
    >
      {title && (
        <h3 className="text-white/80 text-sm font-medium mb-3 text-center">{title}</h3>
      )}
      
      <div className="flex flex-col items-center">
        <svg
          ref={svgRef}
          width={size}
          height={size}
          onMouseLeave={() => { tooltip.hide(); setHoveredSegment(null) }}
          className="overflow-visible"
        >
          <g transform={`translate(${size / 2},${size / 2})`}>
            {/* Segments */}
            <AnimatePresence>
              {pieData.map((d, i) => {
                const isHovered = hoveredSegment === d.data.id
                const isSelected = selectedSegment === d.data.id
                const arc = isHovered ? hoverArcGenerator(d) : arcGenerator(d)
                
                // Ensure arc is a valid string
                const pathData = (arc && typeof arc === 'string') ? arc : ''
                if (!pathData) return null
                
                return (
                  <motion.path
                    key={`${d.data.id}-${isHovered}`}
                    d={pathData}
                    fill={d.data.color}
                    fillOpacity={
                      selectedSegment === null || isSelected
                        ? isHovered ? 1 : 0.9
                        : 0.3
                    }
                    stroke={chartColors.background.dark}
                    strokeWidth={2}
                    initial={{ scale: 0, opacity: 0 }}
                    animate={{ 
                      scale: 1, 
                      opacity: 1,
                    }}
                    exit={{ scale: 0, opacity: 0 }}
                    transition={{
                      duration: animationDuration / 1000,
                      delay: i * 0.05,
                    }}
                    onMouseEnter={(e) => handleSegmentHover(e, d)}
                    onMouseMove={(e) => tooltip.updatePosition({
                      x: e.clientX - (svgRef.current?.getBoundingClientRect().left || 0),
                      y: e.clientY - (svgRef.current?.getBoundingClientRect().top || 0)
                    })}
                    onClick={() => handleSegmentClick(d)}
                    style={{ cursor: onSegmentClick ? 'pointer' : 'default' }}
                  />
                )
              })}
            </AnimatePresence>
            
            {/* Labels */}
            {showLabels && pieData.map((d, i) => {
              const [x, y] = labelArcGenerator.centroid(d)
              return (
                <text
                  key={`label-${d.data.id}`}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill={chartColors.text.primary}
                  fontSize={10}
                  fontWeight={500}
                  style={{ pointerEvents: 'none' }}
                >
                  {d.data.label}
                </text>
              )
            })}
            
            {/* Center content */}
            {innerRadius > 0 && (
              <g className="center-content">
                <text
                  y={-8}
                  textAnchor="middle"
                  fill={chartColors.text.muted}
                  fontSize={11}
                >
                  Total
                </text>
                <text
                  y={12}
                  textAnchor="middle"
                  fill={chartColors.text.primary}
                  fontSize={18}
                  fontWeight={600}
                >
                  {formatValue(total)}
                </text>
              </g>
            )}
          </g>
        </svg>
        
        {/* Legend */}
        {showLegend && (
          <div className="flex flex-wrap gap-3 mt-4 justify-center max-w-[300px]">
            {processedData.map(d => {
              const isSelected = selectedSegment === d.id
              const percentage = ((d.value / total) * 100).toFixed(1)
              
              return (
                <button
                  key={d.id}
                  className={`flex items-center gap-2 px-2 py-1 rounded transition-all ${
                    selectedSegment === null || isSelected
                      ? 'opacity-100'
                      : 'opacity-40'
                  } hover:bg-white/5`}
                  onClick={() => {
                    setSelectedSegment(prev => prev === d.id ? null : d.id)
                    onSegmentClick?.(d)
                  }}
                  onMouseEnter={() => setHoveredSegment(d.id)}
                  onMouseLeave={() => setHoveredSegment(null)}
                >
                  <div 
                    className="w-3 h-3 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: d.color }}
                  />
                  <span className="text-xs text-white/70">{d.label}</span>
                  {showValues && (
                    <span className="text-xs text-white/40">{percentage}%</span>
                  )}
                </button>
              )
            })}
          </div>
        )}
      </div>
      
      {/* Tooltip */}
      <InteractiveTooltip
        {...tooltip.tooltipProps}
        containerRef={containerRef}
      />
    </motion.div>
  )
}
