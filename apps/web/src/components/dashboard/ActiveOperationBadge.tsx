/**
 * Active Operation Badge
 * 
 * Shows currently running operation from Command Center.
 * Synced via platform store.
 */
import { motion } from 'framer-motion'
import { 
  BoltIcon, 
  MapPinIcon, 
  CubeTransparentIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'

interface ActiveOperationBadgeProps {
  type: 'stress_test' | 'zone_selection' | 'digital_twin' | 'simulation'
  name: string
  progress?: number
  status?: 'running' | 'completed' | 'failed'
  startedAt?: string
}

const iconMap = {
  stress_test: BoltIcon,
  zone_selection: MapPinIcon,
  digital_twin: CubeTransparentIcon,
  simulation: ClockIcon,
}

const colorMap = {
  stress_test: {
    bg: 'bg-zinc-800',
    border: 'border-zinc-700',
    text: 'text-zinc-400',
    progress: 'bg-zinc-500',
  },
  zone_selection: {
    bg: 'bg-zinc-800',
    border: 'border-zinc-700',
    text: 'text-zinc-400',
    progress: 'bg-zinc-500',
  },
  digital_twin: {
    bg: 'bg-zinc-800',
    border: 'border-zinc-700',
    text: 'text-zinc-400',
    progress: 'bg-zinc-500',
  },
  simulation: {
    bg: 'bg-zinc-800',
    border: 'border-zinc-700',
    text: 'text-zinc-400',
    progress: 'bg-zinc-500',
  },
}

export default function ActiveOperationBadge({
  type,
  name,
  progress,
  status = 'running',
  startedAt,
}: ActiveOperationBadgeProps) {
  const Icon = iconMap[type]
  const colors = colorMap[type]
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      className={`
        flex items-center gap-3 px-4 py-2 rounded-md
        ${colors.bg} border ${colors.border}
      `}
    >
      {/* Icon */}
      <Icon className={`w-5 h-5 ${colors.text} ${status === 'running' ? 'animate-pulse' : ''}`} />
      
      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${colors.text}`}>
            {name}
          </span>
          {status === 'running' && (
            <span className="text-xs text-zinc-500">Running...</span>
          )}
          {status === 'completed' && (
            <span className="text-xs text-emerald-400/80">Completed</span>
          )}
          {status === 'failed' && (
            <span className="text-xs text-red-400/80">Failed</span>
          )}
        </div>
        
        {/* Progress bar */}
        {progress !== undefined && status === 'running' && (
          <div className="mt-1.5 h-1 bg-zinc-800 rounded-full overflow-hidden">
            <motion.div
              className={`h-full ${colors.progress}`}
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        )}
      </div>
      
      {/* Progress percentage */}
      {progress !== undefined && (
        <span className="text-xs text-zinc-400 font-mono">
          {progress}%
        </span>
      )}
    </motion.div>
  )
}
