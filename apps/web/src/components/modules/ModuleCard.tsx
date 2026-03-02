/**
 * ModuleCard — Card for Strategic Modules. Unified Corporate Style: zinc palette,
 * rounded-md, section labels font-mono text-[10px] uppercase tracking-widest text-zinc-500.
 */
import { motion } from 'framer-motion'
import { ArrowRightIcon, LockClosedIcon, ClockIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'
import { StrategicModule } from '../../lib/modules'

interface ModuleCardProps {
  module: StrategicModule
}

const statusColors = {
  active: 'bg-zinc-700 text-zinc-200 border-zinc-600',
  planned: 'bg-zinc-800 text-zinc-500 border-zinc-700',
  locked: 'bg-zinc-800 text-zinc-500 border-zinc-700',
  'coming-soon': 'bg-zinc-800 text-zinc-500 border-zinc-700',
}

const accessLevelLabels = {
  public: 'Public',
  commercial: 'Commercial',
  classified: 'Classified',
  meta: 'Meta',
}

export default function ModuleCard({ module }: ModuleCardProps) {
  const navigate = useNavigate()

  const handleClick = () => {
    if (module.status === 'active') {
      navigate(`/modules/${module.id}`)
    }
  }

  const isClickable = module.status === 'active'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={isClickable ? { scale: 1.02, y: -2 } : {}}
      className={`relative p-6 rounded-md border transition-all ${
        isClickable
          ? 'bg-zinc-900 border-zinc-700 hover:border-zinc-600 cursor-pointer'
          : 'bg-zinc-900 border-zinc-800 opacity-80'
      }`}
      onClick={handleClick}
    >
      {/* Status Badge */}
      <div className="absolute top-4 right-4">
          <span className={`px-2 py-1 rounded-md text-[10px] font-medium border ${statusColors[module.status]}`}>
            {module.status === 'active' && 'Active'}
            {module.status === 'planned' && 'Planned'}
            {module.status === 'locked' && 'Locked'}
            {module.status === 'coming-soon' && 'Coming Soon'}
          </span>
      </div>

      {/* Icon */}
      <div className="mb-4">
          <div className="w-16 h-16 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center">
            <module.icon className="w-8 h-8 text-zinc-400" />
          </div>
      </div>

      {/* Module ID & Phase */}
      <div className="flex items-center gap-2 mb-2">
          <span className="text-zinc-100 font-mono text-sm font-semibold">{module.name}</span>
          <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">Phase {module.phase}</span>
          <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 text-[10px] rounded-md border border-zinc-700 font-mono">
            {module.priority}
          </span>
      </div>

      {/* Full Name */}
      <h3 className="text-zinc-100 font-semibold mb-2 font-display">{module.fullName}</h3>

      {/* Description */}
      <p className="text-zinc-500/90 text-sm mb-4 line-clamp-2 font-sans">{module.description}</p>

      {/* Access Level */}
      <div className="flex items-center gap-2 mb-4">
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Access:</span>
          <span className="text-xs px-2 py-0.5 rounded-md bg-zinc-800 text-zinc-400 border border-zinc-700 font-sans">
            {accessLevelLabels[module.accessLevel]}
          </span>
      </div>

      {/* Features Preview */}
      <div className="flex flex-wrap gap-1.5 mb-4">
          {module.features.slice(0, 2).map((feature, i) => (
            <span
              key={i}
              className="px-2 py-1 bg-zinc-800 text-zinc-500 text-[10px] rounded-md border border-zinc-700 font-mono"
            >
              {feature}
            </span>
          ))}
          {module.features.length > 2 && (
            <span className="px-2 py-1 bg-zinc-800 text-zinc-500 text-[10px] rounded-md border border-zinc-700 font-mono">
              +{module.features.length - 2}
            </span>
          )}
      </div>

      {/* Action Button */}
      <div className="flex items-center justify-between pt-4 border-t border-zinc-800 font-sans">
          {module.status === 'active' && (
            <button type="button" className="flex items-center gap-2 text-zinc-400 hover:text-zinc-100 text-sm font-medium transition-colors cursor-pointer">
              Open Module
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          )}
          {module.status === 'planned' && (
            <div className="flex items-center gap-2 text-zinc-500 text-sm">
              <ClockIcon className="w-4 h-4" />
              <span>Coming in Phase {module.phase}</span>
            </div>
          )}
          {module.status === 'locked' && (
            <div className="flex items-center gap-2 text-zinc-500 text-sm">
              <LockClosedIcon className="w-4 h-4" />
              <span>Access Restricted</span>
            </div>
          )}
          {module.status === 'coming-soon' && (
            <div className="flex items-center gap-2 text-zinc-500 text-sm">
              <ClockIcon className="w-4 h-4" />
              <span>Coming Soon</span>
            </div>
          )}
      </div>
    </motion.div>
  )
}
