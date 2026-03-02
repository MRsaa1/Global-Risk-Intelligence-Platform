/**
 * Pie Chart Component
 * ====================
 * 
 * Interactive pie/doughnut chart for risk distribution
 * - Click to filter segments
 * - Animated transitions
 * - Interactive legend
 */
import { useMemo, useRef, useState, useCallback, useId, useEffect } from 'react'
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion'
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

/** Gradient stop pairs for hero variant (id -> [light, dark]) */
const HERO_GRADIENTS: Record<string, [string, string]> = {
  critical: ['#ef4444', '#b91c1c'],
  high: ['#f97316', '#c2410c'],
  medium: ['#eab308', '#a16207'],
  low: ['#22c55e', '#15803d'],
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
  variant?: 'default' | 'hero'
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
  variant = 'default',
}: PieChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [hoveredSegment, setHoveredSegment] = useState<string | null>(null)
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null)
  const tooltip = useTooltip()
  const isHero = variant === 'hero'
  const uid = useId().replace(/:/g, '')
  
  const outerRadius = size / 2 - 10
  const innerRadiusValue = outerRadius * innerRadius
  const hoverOuterOffset = isHero ? 12 : 8
  
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
  
  // Hero: animated center counter (0 -> total)
  const countMotion = useMotionValue(0)
  const displayCount = useTransform(countMotion, (v) => Math.round(v))
  const prevTotalRef = useRef(0)
  useEffect(() => {
    if (!isHero) return
    prevTotalRef.current = total
    const ctrl = animate(countMotion, total, {
      type: 'tween',
      duration: 0.8,
      ease: [0.22, 0.61, 0.36, 1],
    })
    return () => ctrl.stop()
  }, [isHero, total, countMotion])
  
  // Hero: dominant risk (largest segment by value)
  const dominantRisk = useMemo(() => {
    if (!isHero || processedData.length === 0) return null
    const max = processedData.reduce((a, b) => (a.value >= b.value ? a : b))
    return max.value > 0 ? max : null
  }, [isHero, processedData])
  
  // Subscribe to animated count for SVG text
  const [displayCountVal, setDisplayCountVal] = useState(0)
  useEffect(() => {
    if (!isHero) return
    const unsub = displayCount.on('change', (v) => setDisplayCountVal(Math.round(v)))
    setDisplayCountVal(Math.round(countMotion.get()))
    return unsub
  }, [isHero, displayCount, countMotion])
  
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
  
  // Hover arc (slightly larger; hero uses 12px expansion)
  const hoverArcGenerator = useMemo(() => {
    return d3.arc<d3.PieArcDatum<PieDataPoint>>()
      .innerRadius(innerRadiusValue)
      .outerRadius(outerRadius + hoverOuterOffset)
      .cornerRadius(4)
  }, [innerRadiusValue, outerRadius, hoverOuterOffset])
  
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
  
  // Hero: background track ring (full circle)
  const trackRingPath = useMemo(() => {
    if (!isHero) return null
    const arc = d3.arc<{ startAngle: number; endAngle: number }>()
      .innerRadius(innerRadiusValue)
      .outerRadius(outerRadius)
      .startAngle(0)
      .endAngle(2 * Math.PI)
    return arc({ startAngle: 0, endAngle: 2 * Math.PI } as d3.PieArcDatum<PieDataPoint>)
  }, [isHero, innerRadiusValue, outerRadius])
  
  // Safe percentage for display (avoids NaN when total is 0)
  const safePct = useCallback((val: number, tot: number) =>
    tot > 0 && Number.isFinite(val) ? ((val / tot) * 100).toFixed(1) : '0', [])
  // Format value
  const formatValue = useCallback((value: number) => {
    switch (valueFormat) {
      case 'currency':
        if (value >= 1_000_000_000) return `€${(value / 1_000_000_000).toFixed(1)}B`
        if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
        if (value >= 1_000) return `€${(value / 1_000).toFixed(0)}K`
        return `€${value.toFixed(0)}`
      case 'percent':
        return `${safePct(value, total)}%`
      default:
        return value.toFixed(0)
    }
  }, [valueFormat, total, safePct])
  
  // Handle segment hover
  const handleSegmentHover = useCallback((
    e: React.MouseEvent,
    d: d3.PieArcDatum<PieDataPoint>
  ) => {
    const rect = svgRef.current?.getBoundingClientRect()
    if (!rect) return
    
    const percentage = total > 0 ? ((d.data.value / total) * 100).toFixed(1) : '0'
    
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
          <defs>
            {isHero && (
              <>
                {Object.entries(HERO_GRADIENTS).map(([id, [light, dark]]) => (
                  <linearGradient key={id} id={`grad-${uid}-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor={light} />
                    <stop offset="100%" stopColor={dark} />
                  </linearGradient>
                ))}
                <linearGradient id={`grad-${uid}-fallback`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#64748b" />
                  <stop offset="100%" stopColor="#475569" />
                </linearGradient>
                <filter id={`glow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" result="comp" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="comp" />
                  </feMerge>
                </filter>
                <filter id={`glow-hover-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" result="comp" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="comp" />
                  </feMerge>
                </filter>
              </>
            )}
          </defs>
          <g transform={`translate(${size / 2},${size / 2})`}>
            {/* Hero: background track ring */}
            {isHero && trackRingPath && (
              <path
                d={trackRingPath}
                fill="rgba(255,255,255,0.03)"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
                style={{ pointerEvents: 'none' }}
              />
            )}
            {/* Segments */}
            <AnimatePresence>
              {pieData.map((d, i) => {
                const isHovered = hoveredSegment === d.data.id
                const isSelected = selectedSegment === d.data.id
                const arc = isHovered ? hoverArcGenerator(d) : arcGenerator(d)
                const gradId = isHero && (HERO_GRADIENTS[d.data.id] ? `grad-${uid}-${d.data.id}` : `grad-${uid}-fallback`)
                const filterId = isHero ? (isHovered ? `url(#glow-hover-${uid})` : `url(#glow-${uid})`) : undefined
                
                // Ensure arc is a valid string
                const pathData = (arc && typeof arc === 'string') ? arc : ''
                if (!pathData) return null
                
                return (
                  <motion.path
                    key={`${d.data.id}-${isHovered}`}
                    d={pathData}
                    fill={isHero && gradId ? `url(#${gradId})` : (d.data.color ?? '')}
                    fillOpacity={
                      selectedSegment === null || isSelected
                        ? isHovered ? 1 : 0.9
                        : 0.3
                    }
                    filter={filterId}
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
            
            {/* Labels: hero = percentage on arc (>=5%); default = segment label */}
            {(showLabels || isHero) && pieData.map((d) => {
              const [x, y] = labelArcGenerator.centroid(d)
              const pct = total > 0 ? (d.data.value / total) * 100 : 0
              if (isHero && pct < 5) return null
              const labelText = isHero ? `${pct.toFixed(1)}%` : d.data.label
              return (
                <text
                  key={`label-${d.data.id}`}
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#fff"
                  fontSize={isHero ? 11 : 10}
                  fontWeight={600}
                  style={{ pointerEvents: 'none', textShadow: '0 0 4px rgba(0,0,0,0.8), 0 1px 2px rgba(0,0,0,0.5)' }}
                >
                  {labelText}
                </text>
              )
            })}
            {/* Hero: pulse circle on hovered segment */}
            {isHero && hoveredSegment && (() => {
              const d = pieData.find((p) => p.data.id === hoveredSegment)
              if (!d) return null
              const [cx, cy] = labelArcGenerator.centroid(d)
              return (
                <motion.circle
                  cx={cx}
                  cy={cy}
                  r={8}
                  fill="none"
                  stroke="rgba(255,255,255,0.4)"
                  strokeWidth={2}
                  initial={{ r: 8, opacity: 0.8 }}
                  animate={{ r: 24, opacity: 0 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'easeOut' }}
                  style={{ pointerEvents: 'none' }}
                />
              )
            })()}
            
            {/* Center content */}
            {innerRadius > 0 && (
              <g className="center-content" style={{ pointerEvents: 'none' }}>
                {isHero ? (
                  <>
                    <text y={-14} textAnchor="middle" fill={chartColors.text.muted} fontSize={10}>
                      Total
                    </text>
                    <text
                      y={8}
                      textAnchor="middle"
                      fill={chartColors.text.primary}
                      fontSize={24}
                      fontWeight={700}
                    >
                      {displayCountVal}
                    </text>
                    {dominantRisk && (
                      <text
                        y={28}
                        textAnchor="middle"
                        fill={dominantRisk.color ?? chartColors.text.secondary}
                        fontSize={9}
                        fontWeight={600}
                        style={{ textTransform: 'uppercase', letterSpacing: '0.05em' }}
                      >
                        {dominantRisk.label} RISK
                      </text>
                    )}
                    {/* Thin animated ring around center */}
                    <motion.circle
                      r={innerRadiusValue - 4}
                      fill="none"
                      stroke="rgba(255,255,255,0.12)"
                      strokeWidth={2}
                      strokeDasharray={2 * Math.PI * (innerRadiusValue - 4)}
                      initial={{ strokeDashoffset: 2 * Math.PI * (innerRadiusValue - 4) }}
                      animate={{ strokeDashoffset: 0 }}
                      transition={{ duration: 1, delay: 0.2, ease: [0.22, 0.61, 0.36, 1] }}
                    />
                  </>
                ) : (
                  <>
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
                  </>
                )}
              </g>
            )}
          </g>
        </svg>
        
        {/* Legend */}
        {showLegend && (
          isHero ? (
            <div className="w-full mt-4 space-y-2 max-w-[280px]">
              {processedData.map((d) => {
                const pct = total > 0 && Number.isFinite(d.value) ? (d.value / total) * 100 : 0
                const percentageStr = pct.toFixed(1)
                const isSelected = selectedSegment === d.id
                const isHovered = hoveredSegment === d.id
                const [gradStart, gradEnd] = HERO_GRADIENTS[d.id] ?? [d.color ?? '#64748b', '#475569']
                return (
                  <button
                    key={d.id}
                    type="button"
                    className={`flex items-center gap-2 w-full text-left rounded-lg px-2 py-1.5 transition-all ${
                      selectedSegment === null || isSelected ? 'opacity-100' : 'opacity-40'
                    } ${isHovered ? 'bg-white/10' : 'hover:bg-white/5'}`}
                    onClick={() => {
                      setSelectedSegment((prev) => (prev === d.id ? null : d.id))
                      onSegmentClick?.(d)
                    }}
                    onMouseEnter={() => setHoveredSegment(d.id)}
                    onMouseLeave={() => setHoveredSegment(null)}
                  >
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: d.color }}
                    />
                    <span className="text-xs font-medium text-zinc-200 w-16 flex-shrink-0">{d.label}</span>
                    <div className="flex-1 h-2 rounded-full bg-zinc-800 overflow-hidden min-w-[60px]">
                      <motion.div
                        className="h-full rounded-full"
                        style={{
                          background: `linear-gradient(90deg, ${gradStart}, ${gradEnd})`,
                        }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.8, delay: 0.1, ease: [0.22, 0.61, 0.36, 1] }}
                      />
                    </div>
                    <span className="text-xs text-zinc-400 w-10 text-right">{percentageStr}%</span>
                    <span className="text-xs text-zinc-300 font-medium w-6 text-right">{d.value}</span>
                  </button>
                )
              })}
            </div>
          ) : (
          <div className="flex flex-wrap gap-3 mt-4 justify-center max-w-[300px]">
            {processedData.map(d => {
              const isSelected = selectedSegment === d.id
              const percentage = total > 0 && Number.isFinite(d.value) ? ((d.value / total) * 100).toFixed(1) : '0'
              
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
          )
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
