/**
 * Animation Wrapper Component
 * ============================
 * 
 * Provides smooth animations and transitions for charts
 * - Fade-in on load
 * - Loading skeleton states
 * - Stagger animations for multiple elements
 */
import { ReactNode } from 'react'
import { motion, AnimatePresence, Variants } from 'framer-motion'
import { chartColors } from '../../lib/chartColors'

interface AnimationWrapperProps {
  children: ReactNode
  isLoading?: boolean
  delay?: number
  duration?: number
  className?: string
}

// Animation variants
const fadeInVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -10 },
}

const scaleInVariants: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
  exit: { opacity: 0, scale: 0.95 },
}

export default function AnimationWrapper({
  children,
  isLoading = false,
  delay = 0,
  duration = 0.3,
  className = '',
}: AnimationWrapperProps) {
  return (
    <AnimatePresence mode="wait">
      {isLoading ? (
        <motion.div
          key="loading"
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={fadeInVariants}
          transition={{ duration: 0.2 }}
          className={className}
        >
          <ChartSkeleton />
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={fadeInVariants}
          transition={{ duration, delay }}
          className={className}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Chart skeleton loader
export function ChartSkeleton({ height = 300 }: { height?: number }) {
  return (
    <div 
      className="relative overflow-hidden rounded-lg bg-white/5"
      style={{ height }}
    >
      {/* Animated shimmer effect */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(90deg, transparent 0%, ${chartColors.background.cardHover} 50%, transparent 100%)`,
        }}
        animate={{
          x: ['-100%', '100%'],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'linear',
        }}
      />
      
      {/* Fake chart elements */}
      <div className="absolute inset-4 flex flex-col justify-between">
        {/* Y-axis labels */}
        <div className="flex flex-col justify-between h-full py-4">
          {[...Array(5)].map((_, i) => (
            <div 
              key={i}
              className="h-2 w-8 bg-white/5 rounded"
            />
          ))}
        </div>
        
        {/* Bars placeholder */}
        <div className="absolute bottom-4 left-12 right-4 flex items-end justify-around gap-2 h-3/4">
          {[...Array(7)].map((_, i) => (
            <motion.div
              key={i}
              className="flex-1 bg-white/5 rounded-t"
              style={{ height: `${30 + Math.random() * 60}%` }}
              animate={{ opacity: [0.3, 0.5, 0.3] }}
              transition={{
                duration: 1.5,
                repeat: Infinity,
                delay: i * 0.1,
              }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Stagger container for multiple animated elements
interface StaggerContainerProps {
  children: ReactNode
  staggerDelay?: number
  className?: string
}

export function StaggerContainer({
  children,
  staggerDelay = 0.05,
  className = '',
}: StaggerContainerProps) {
  const containerVariants: Variants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: staggerDelay,
      },
    },
  }
  
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  )
}

// Stagger item for use inside StaggerContainer
interface StaggerItemProps {
  children: ReactNode
  className?: string
}

export function StaggerItem({ children, className = '' }: StaggerItemProps) {
  const itemVariants: Variants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
  }
  
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  )
}

// Number counter animation
interface CounterAnimationProps {
  value: number
  duration?: number
  format?: 'number' | 'currency' | 'percent'
  className?: string
}

export function CounterAnimation({
  value,
  duration = 1,
  format = 'number',
  className = '',
}: CounterAnimationProps) {
  return (
    <motion.span
      className={className}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      key={value}
    >
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        {formatNumber(value, format)}
      </motion.span>
    </motion.span>
  )
}

function formatNumber(value: number, format: string): string {
  switch (format) {
    case 'currency':
      if (value >= 1_000_000_000) return `€${(value / 1_000_000_000).toFixed(1)}B`
      if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
      if (value >= 1_000) return `€${(value / 1_000).toFixed(0)}K`
      return `€${value.toFixed(0)}`
    case 'percent':
      return `${(value * 100).toFixed(1)}%`
    default:
      if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
      if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`
      return value.toFixed(value % 1 === 0 ? 0 : 1)
  }
}

// Progress bar animation
interface ProgressBarProps {
  value: number // 0-100
  color?: string
  height?: number
  showLabel?: boolean
  className?: string
}

export function ProgressBar({
  value,
  color = chartColors.series.climate,
  height = 8,
  showLabel = false,
  className = '',
}: ProgressBarProps) {
  return (
    <div className={`relative ${className}`}>
      <div 
        className="w-full rounded-full overflow-hidden"
        style={{ 
          height, 
          backgroundColor: chartColors.background.card,
        }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(100, Math.max(0, value))}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      {showLabel && (
        <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-white/60 ml-2">
          {value.toFixed(0)}%
        </span>
      )}
    </div>
  )
}

// Pulse animation for live indicators
export function PulseIndicator({ 
  color = '#22c55e',
  size = 8,
}: { 
  color?: string
  size?: number 
}) {
  return (
    <span className="relative inline-flex">
      <span
        className="rounded-full"
        style={{
          width: size,
          height: size,
          backgroundColor: color,
        }}
      />
      <motion.span
        className="absolute inline-flex rounded-full opacity-75"
        style={{
          width: size,
          height: size,
          backgroundColor: color,
        }}
        animate={{
          scale: [1, 2],
          opacity: [0.75, 0],
        }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: 'easeOut',
        }}
      />
    </span>
  )
}
