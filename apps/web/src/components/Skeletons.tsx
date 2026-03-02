/**
 * Loading Skeleton Components
 * 
 * Provides skeleton placeholders for lazy-loaded components.
 * Matches the visual style of the actual components for smooth transitions.
 */
import { motion } from 'framer-motion'

// ==================== BASE SKELETON ====================

interface SkeletonProps {
  className?: string
  animate?: boolean
}

export function Skeleton({ className = '', animate = true }: SkeletonProps) {
  return (
    <div 
      className={`
        bg-zinc-800 rounded
        ${animate ? 'animate-pulse' : ''}
        ${className}
      `}
    />
  )
}

// ==================== CHART SKELETONS ====================

interface ChartSkeletonProps {
  height?: number
  title?: string
}

export function ChartSkeleton({ height = 300, title }: ChartSkeletonProps) {
  return (
    <div className="glass rounded-md p-6 border border-zinc-800">
      {title && (
        <Skeleton className="h-5 w-48 mb-4" />
      )}
      <div 
        className="relative bg-zinc-800 rounded-lg overflow-hidden"
        style={{ height }}
      >
        {/* Fake chart lines */}
        <div className="absolute inset-0 flex flex-col justify-center gap-8 p-4">
          <Skeleton className="h-0.5 w-full opacity-30" />
          <Skeleton className="h-0.5 w-full opacity-30" />
          <Skeleton className="h-0.5 w-full opacity-30" />
          <Skeleton className="h-0.5 w-full opacity-30" />
        </div>
        
        {/* Fake chart area */}
        <svg 
          className="absolute inset-0 w-full h-full opacity-20"
          viewBox="0 0 100 50"
          preserveAspectRatio="none"
        >
          <path
            d="M0,40 Q25,30 50,35 T100,25"
            fill="none"
            stroke="rgba(255,255,255,0.3)"
            strokeWidth="0.5"
          />
        </svg>
        
        {/* Loading indicator */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-400 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        </div>
      </div>
      
      {/* Fake legend */}
      <div className="flex gap-4 mt-4 justify-center">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-24" />
      </div>
    </div>
  )
}

export function PieChartSkeleton({ title }: { title?: string }) {
  return (
    <div className="glass rounded-md p-6 border border-zinc-800">
      {title && (
        <Skeleton className="h-5 w-40 mb-4" />
      )}
      <div className="flex items-center justify-center py-8">
        <div className="relative w-48 h-48">
          {/* Fake pie chart */}
          <svg viewBox="0 0 100 100" className="w-full h-full animate-pulse">
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="rgba(255,255,255,0.1)"
              strokeWidth="20"
            />
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="rgba(255,255,255,0.2)"
              strokeWidth="20"
              strokeDasharray="62.8 188.4"
              transform="rotate(-90 50 50)"
            />
          </svg>
          
          {/* Loading indicator in center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-400 rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>
        </div>
      </div>
      
      {/* Fake legend */}
      <div className="grid grid-cols-2 gap-2 mt-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
      </div>
    </div>
  )
}

export function BarChart3DSkeleton({ title, height = 400 }: ChartSkeletonProps) {
  return (
    <div className="glass rounded-md p-6 border border-zinc-800">
      {title && (
        <Skeleton className="h-5 w-36 mb-4" />
      )}
      <div 
        className="relative bg-zinc-900/30 rounded-lg overflow-hidden"
        style={{ height }}
      >
        {/* Fake 3D bars */}
        <div className="absolute bottom-0 left-0 right-0 flex items-end justify-around p-8">
          <Skeleton className="w-12 h-24 rounded-t" />
          <Skeleton className="w-12 h-32 rounded-t" />
          <Skeleton className="w-12 h-20 rounded-t" />
          <Skeleton className="w-12 h-40 rounded-t" />
          <Skeleton className="w-12 h-28 rounded-t" />
          <Skeleton className="w-12 h-16 rounded-t" />
        </div>
        
        {/* Loading indicator */}
        <div className="absolute inset-0 flex items-center justify-center">
          <motion.div
            className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-400 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
        </div>
      </div>
    </div>
  )
}

// ==================== TABLE SKELETONS ====================

interface TableSkeletonProps {
  rows?: number
  columns?: number
}

export function TableSkeleton({ rows = 5, columns = 4 }: TableSkeletonProps) {
  return (
    <div className="glass rounded-md overflow-hidden">
      {/* Header */}
      <div className="flex gap-4 p-4 bg-zinc-800 border-b border-zinc-800">
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div 
          key={rowIdx}
          className="flex gap-4 p-4 border-b border-zinc-800 last:border-0"
        >
          {Array.from({ length: columns }).map((_, colIdx) => (
            <Skeleton 
              key={colIdx} 
              className={`h-4 flex-1 ${colIdx === 0 ? 'w-48' : ''}`} 
            />
          ))}
        </div>
      ))}
    </div>
  )
}

// ==================== CARD SKELETONS ====================

export function StatCardSkeleton() {
  return (
    <div className="glass rounded-md p-4 border border-zinc-800">
      <div className="flex items-center gap-3">
        <Skeleton className="w-10 h-10 rounded-lg" />
        <div className="flex-1">
          <Skeleton className="h-3 w-20 mb-2" />
          <Skeleton className="h-6 w-16" />
        </div>
      </div>
    </div>
  )
}

export function AssetCardSkeleton() {
  return (
    <div className="glass rounded-md p-4 border border-zinc-800">
      <div className="flex items-start gap-4">
        <Skeleton className="w-16 h-16 rounded-lg flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <Skeleton className="h-5 w-3/4 mb-2" />
          <Skeleton className="h-3 w-1/2 mb-3" />
          <div className="flex gap-2">
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-6 w-20 rounded-full" />
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== MAP/GLOBE SKELETONS ====================

export function MapSkeleton({ height = 500 }: { height?: number }) {
  return (
    <div 
      className="relative bg-gradient-to-b from-[#09090b] to-[#18181b] rounded-md overflow-hidden"
      style={{ height }}
    >
      {/* Fake map grid */}
      <div className="absolute inset-0 opacity-20">
        <div className="grid grid-cols-8 grid-rows-6 h-full w-full">
          {Array.from({ length: 48 }).map((_, i) => (
            <div key={i} className="border border-zinc-700" />
          ))}
        </div>
      </div>
      
      {/* Fake markers */}
      <div className="absolute inset-0 flex items-center justify-center gap-24">
        <Skeleton className="w-4 h-4 rounded-full" />
        <Skeleton className="w-6 h-6 rounded-full" />
        <Skeleton className="w-4 h-4 rounded-full" />
      </div>
      
      {/* Loading indicator */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="bg-zinc-900/60 rounded-lg px-4 py-2 flex items-center gap-2">
          <motion.div
            className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-400 rounded-full"
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          />
          <span className="text-sm text-zinc-400">Loading map...</span>
        </div>
      </div>
    </div>
  )
}

export function GlobeSkeleton({ height = 600 }: { height?: number }) {
  return (
    <div 
      className="relative bg-gradient-radial from-[#18181b] to-[#09090b] rounded-md overflow-hidden"
      style={{ height }}
    >
      {/* Fake globe */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-64 h-64">
          <div className="absolute inset-0 rounded-full border-2 border-zinc-700 animate-pulse" />
          <div className="absolute inset-4 rounded-full border border-zinc-800" />
          <div className="absolute inset-8 rounded-full border border-zinc-800" />
          
          {/* Loading indicator */}
          <div className="absolute inset-0 flex items-center justify-center">
            <motion.div
              className="w-8 h-8 border-2 border-zinc-600 border-t-zinc-400 rounded-full"
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            />
          </div>
        </div>
      </div>
      
      {/* Status text */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <span className="text-xs text-zinc-500">Loading 3D globe...</span>
      </div>
    </div>
  )
}

// ==================== DASHBOARD SKELETON ====================

export function DashboardSkeleton() {
  return (
    <div className="p-8 space-y-8 animate-pulse">
      {/* Header */}
      <div className="mb-8">
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-96" />
      </div>
      
      {/* Stats row */}
      <div className="grid grid-cols-4 gap-4">
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
        <StatCardSkeleton />
      </div>
      
      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <ChartSkeleton height={350} />
        <PieChartSkeleton />
      </div>
      
      {/* More content */}
      <div className="grid grid-cols-2 gap-6">
        <BarChart3DSkeleton height={400} />
        <TableSkeleton rows={5} columns={3} />
      </div>
    </div>
  )
}

export default {
  Skeleton,
  ChartSkeleton,
  PieChartSkeleton,
  BarChart3DSkeleton,
  TableSkeleton,
  StatCardSkeleton,
  AssetCardSkeleton,
  MapSkeleton,
  GlobeSkeleton,
  DashboardSkeleton,
}
