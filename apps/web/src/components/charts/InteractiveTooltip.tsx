/**
 * Interactive Tooltip Component
 * ==============================
 * 
 * Universal tooltip component for all charts
 * - Follows cursor position
 * - Supports multiple series
 * - Formats values (currency, percentages, numbers)
 * - Animated appearance
 */
import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { chartColors } from '../../lib/chartColors'

export interface TooltipDataPoint {
  label: string
  value: number | string
  color?: string
  format?: 'number' | 'currency' | 'percent' | 'date'
}

export interface TooltipPosition {
  x: number
  y: number
}

interface InteractiveTooltipProps {
  visible: boolean
  position: TooltipPosition
  title?: string
  data: TooltipDataPoint[]
  containerRef?: React.RefObject<HTMLDivElement>
}

// Format value based on type
function formatValue(value: number | string, format?: string): string {
  if (typeof value === 'string') return value
  
  switch (format) {
    case 'currency':
      if (value >= 1_000_000_000) return `€${(value / 1_000_000_000).toFixed(1)}B`
      if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
      if (value >= 1_000) return `€${(value / 1_000).toFixed(0)}K`
      return `€${value.toFixed(0)}`
    case 'percent':
      return `${(value * 100).toFixed(1)}%`
    case 'date':
      return new Date(value).toLocaleDateString()
    case 'number':
    default:
      if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
      if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
      return value.toFixed(value % 1 === 0 ? 0 : 2)
  }
}

export default function InteractiveTooltip({
  visible,
  position,
  title,
  data,
  containerRef,
}: InteractiveTooltipProps) {
  const tooltipRef = useRef<HTMLDivElement>(null)
  const [adjustedPosition, setAdjustedPosition] = useState(position)
  
  // Adjust position to stay within container bounds
  useEffect(() => {
    if (!tooltipRef.current || !visible) return
    
    const tooltip = tooltipRef.current
    const tooltipRect = tooltip.getBoundingClientRect()
    const containerRect = containerRef?.current?.getBoundingClientRect() || {
      left: 0,
      top: 0,
      right: window.innerWidth,
      bottom: window.innerHeight,
      width: window.innerWidth,
      height: window.innerHeight,
    }
    
    let x = position.x + 12 // Offset from cursor
    let y = position.y - 12
    
    // Keep within horizontal bounds
    if (x + tooltipRect.width > containerRect.width) {
      x = position.x - tooltipRect.width - 12
    }
    if (x < 0) x = 12
    
    // Keep within vertical bounds
    if (y + tooltipRect.height > containerRect.height) {
      y = containerRect.height - tooltipRect.height - 12
    }
    if (y < 0) y = 12
    
    setAdjustedPosition({ x, y })
  }, [position, visible, containerRef])
  
  return (
    <AnimatePresence>
      {visible && data.length > 0 && (
        <motion.div
          ref={tooltipRef}
          initial={{ opacity: 0, scale: 0.95, y: -5 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -5 }}
          transition={{ duration: 0.15 }}
          style={{
            position: 'absolute',
            left: adjustedPosition.x,
            top: adjustedPosition.y,
            pointerEvents: 'none',
            zIndex: 100,
          }}
          className="bg-[#1a1f2e] border border-white/10 rounded-lg shadow-xl backdrop-blur-sm min-w-[160px]"
        >
          {/* Title */}
          {title && (
            <div className="px-3 py-2 border-b border-white/10">
              <span className="text-white/80 text-xs font-medium">{title}</span>
            </div>
          )}
          
          {/* Data points */}
          <div className="px-3 py-2 space-y-1.5">
            {data.map((point, i) => (
              <div key={i} className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  {point.color && (
                    <div 
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: point.color }}
                    />
                  )}
                  <span className="text-white/60 text-xs">{point.label}</span>
                </div>
                <span className="text-white text-xs font-mono font-medium">
                  {formatValue(point.value, point.format)}
                </span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Hook for tooltip state management
export function useTooltip() {
  const [visible, setVisible] = useState(false)
  const [position, setPosition] = useState<TooltipPosition>({ x: 0, y: 0 })
  const [data, setData] = useState<TooltipDataPoint[]>([])
  const [title, setTitle] = useState<string | undefined>()
  
  const show = (
    pos: TooltipPosition,
    tooltipData: TooltipDataPoint[],
    tooltipTitle?: string
  ) => {
    setPosition(pos)
    setData(tooltipData)
    setTitle(tooltipTitle)
    setVisible(true)
  }
  
  const hide = () => {
    setVisible(false)
  }
  
  const updatePosition = (pos: TooltipPosition) => {
    setPosition(pos)
  }
  
  return {
    visible,
    position,
    data,
    title,
    show,
    hide,
    updatePosition,
    tooltipProps: {
      visible,
      position,
      data,
      title,
    },
  }
}

// Crosshair component for charts
interface CrosshairProps {
  visible: boolean
  position: TooltipPosition
  width: number
  height: number
  showVertical?: boolean
  showHorizontal?: boolean
}

export function Crosshair({
  visible,
  position,
  width,
  height,
  showVertical = true,
  showHorizontal = false,
}: CrosshairProps) {
  if (!visible) return null
  
  return (
    <g className="crosshair" style={{ pointerEvents: 'none' }}>
      {showVertical && (
        <line
          x1={position.x}
          y1={0}
          x2={position.x}
          y2={height}
          stroke={chartColors.background.border}
          strokeWidth={1}
          strokeDasharray="4,4"
        />
      )}
      {showHorizontal && (
        <line
          x1={0}
          y1={position.y}
          x2={width}
          y2={position.y}
          stroke={chartColors.background.border}
          strokeWidth={1}
          strokeDasharray="4,4"
        />
      )}
    </g>
  )
}
