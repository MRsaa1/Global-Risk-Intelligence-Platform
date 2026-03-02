/**
 * Chart Controls Component
 * =========================
 * 
 * Reusable controls for chart interactions
 * - Time range selector
 * - Filter buttons
 * - Export (PNG, SVG)
 * - Fullscreen toggle
 * - Zoom reset
 */
import { useState, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import html2canvas from 'html2canvas'

export type TimeRange = '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL'

interface ChartControlsProps {
  // Time range
  showTimeRange?: boolean
  timeRange?: TimeRange
  onTimeRangeChange?: (range: TimeRange) => void
  
  // Filters
  showFilters?: boolean
  filters?: string[]
  activeFilters?: string[]
  onFilterChange?: (filters: string[]) => void
  
  // Export
  showExport?: boolean
  chartRef?: React.RefObject<HTMLDivElement>
  exportFilename?: string
  
  // Fullscreen
  showFullscreen?: boolean
  onFullscreenToggle?: () => void
  isFullscreen?: boolean
  
  // Zoom
  showZoomReset?: boolean
  onZoomReset?: () => void
  
  // Refresh
  showRefresh?: boolean
  onRefresh?: () => void
  isRefreshing?: boolean
  
  className?: string
}

const timeRanges: TimeRange[] = ['1D', '1W', '1M', '3M', '1Y', 'ALL']

export default function ChartControls({
  showTimeRange = false,
  timeRange = '1M',
  onTimeRangeChange,
  showFilters = false,
  filters = [],
  activeFilters = [],
  onFilterChange,
  showExport = false,
  chartRef,
  exportFilename = 'chart',
  showFullscreen = false,
  onFullscreenToggle,
  isFullscreen = false,
  showZoomReset = false,
  onZoomReset,
  showRefresh = false,
  onRefresh,
  isRefreshing = false,
  className = '',
}: ChartControlsProps) {
  const [exportMenuOpen, setExportMenuOpen] = useState(false)
  
  // Export to PNG
  const exportToPng = useCallback(async () => {
    if (!chartRef?.current) return
    
    try {
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#09090b',
        scale: 2,
      })
      
      const link = document.createElement('a')
      link.download = `${exportFilename}_${new Date().toISOString().slice(0, 10)}.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } catch (error) {
      console.error('Export failed:', error)
    }
    
    setExportMenuOpen(false)
  }, [chartRef, exportFilename])
  
  // Export to SVG (simplified - copies inner SVG if present)
  const exportToSvg = useCallback(() => {
    if (!chartRef?.current) return
    
    const svg = chartRef.current.querySelector('svg')
    if (!svg) {
      console.error('No SVG found in chart')
      return
    }
    
    const svgData = new XMLSerializer().serializeToString(svg)
    const blob = new Blob([svgData], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    
    const link = document.createElement('a')
    link.download = `${exportFilename}_${new Date().toISOString().slice(0, 10)}.svg`
    link.href = url
    link.click()
    
    URL.revokeObjectURL(url)
    setExportMenuOpen(false)
  }, [chartRef, exportFilename])
  
  // Toggle filter
  const toggleFilter = (filter: string) => {
    const newFilters = activeFilters.includes(filter)
      ? activeFilters.filter(f => f !== filter)
      : [...activeFilters, filter]
    onFilterChange?.(newFilters)
  }
  
  const hasControls = showTimeRange || showFilters || showExport || 
                      showFullscreen || showZoomReset || showRefresh
  
  if (!hasControls) return null
  
  return (
    <div className={`flex items-center gap-2 flex-wrap ${className}`}>
      {/* Time Range Selector */}
      {showTimeRange && (
        <div className="flex bg-zinc-800 rounded-lg p-0.5">
          {timeRanges.map(range => (
            <button
              key={range}
              onClick={() => onTimeRangeChange?.(range)}
              className={`px-2 py-1 text-xs rounded transition-all ${
                timeRange === range
                  ? 'bg-zinc-700 text-zinc-100'
                  : 'text-zinc-500 hover:text-zinc-400'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      )}
      
      {/* Filters */}
      {showFilters && filters.length > 0 && (
        <div className="flex gap-1">
          {filters.map(filter => (
            <button
              key={filter}
              onClick={() => toggleFilter(filter)}
              className={`px-2 py-1 text-xs rounded transition-all ${
                activeFilters.includes(filter)
                  ? 'bg-zinc-700 text-zinc-300 border border-zinc-600'
                  : 'bg-zinc-800 text-zinc-500 border border-transparent hover:bg-zinc-700'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      )}
      
      {/* Spacer */}
      <div className="flex-1" />
      
      {/* Refresh Button */}
      {showRefresh && (
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-500 hover:text-zinc-400 transition-all disabled:opacity-50"
          title="Refresh"
        >
          <motion.svg
            className="w-4 h-4"
            animate={isRefreshing ? { rotate: 360 } : { rotate: 0 }}
            transition={isRefreshing ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </motion.svg>
        </button>
      )}
      
      {/* Zoom Reset */}
      {showZoomReset && (
        <button
          onClick={onZoomReset}
          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-500 hover:text-zinc-400 transition-all"
          title="Reset Zoom"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7" />
          </svg>
        </button>
      )}
      
      {/* Export Menu */}
      {showExport && (
        <div className="relative">
          <button
            onClick={() => setExportMenuOpen(!exportMenuOpen)}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-500 hover:text-zinc-400 transition-all"
            title="Export"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
          </button>
          
          {exportMenuOpen && (
            <>
              <div 
                className="fixed inset-0 z-40"
                onClick={() => setExportMenuOpen(false)}
              />
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute right-0 top-full mt-1 bg-[#18181b] border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden min-w-[120px]"
              >
                <button
                  onClick={exportToPng}
                  className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  Export PNG
                </button>
                <button
                  onClick={exportToSvg}
                  className="w-full px-3 py-2 text-left text-xs text-zinc-300 hover:bg-zinc-800 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  Export SVG
                </button>
              </motion.div>
            </>
          )}
        </div>
      )}
      
      {/* Fullscreen Toggle */}
      {showFullscreen && (
        <button
          onClick={onFullscreenToggle}
          className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-500 hover:text-zinc-400 transition-all"
          title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
        >
          {isFullscreen ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
            </svg>
          )}
        </button>
      )}
    </div>
  )
}

// Quick preset for common chart controls
export function QuickChartControls({
  chartRef,
  exportFilename,
}: {
  chartRef?: React.RefObject<HTMLDivElement>
  exportFilename?: string
}) {
  return (
    <ChartControls
      showExport={!!chartRef}
      chartRef={chartRef}
      exportFilename={exportFilename}
      showRefresh={false}
    />
  )
}
