/**
 * ModuleCard - Card component for displaying strategic module information
 */
import { motion } from 'framer-motion'
import { ArrowRightIcon, LockClosedIcon, ClockIcon } from '@heroicons/react/24/outline'
import { useNavigate } from 'react-router-dom'
import { StrategicModule } from '../../lib/modules'
import AccessGate from './AccessGate'

interface ModuleCardProps {
  module: StrategicModule
}

const statusColors = {
  active: 'bg-white/10 text-white/80 border-white/20',
  planned: 'bg-white/5 text-white/60 border-white/10',
  locked: 'bg-white/5 text-white/40 border-white/10',
  'coming-soon': 'bg-white/5 text-white/40 border-white/10',
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
    <AccessGate accessLevel={module.accessLevel}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        whileHover={isClickable ? { scale: 1.02, y: -2 } : {}}
        className={`relative p-6 rounded-2xl border transition-all ${
          isClickable
            ? 'bg-gradient-to-br from-white/5 to-white/0 border-white/10 hover:border-white/20 cursor-pointer'
            : 'bg-white/5 border-white/10 opacity-60'
        }`}
        onClick={handleClick}
      >
        {/* Status Badge */}
        <div className="absolute top-4 right-4">
          <span className={`px-2 py-1 rounded-lg text-[10px] font-medium border ${statusColors[module.status]}`}>
            {module.status === 'active' && 'Active'}
            {module.status === 'planned' && 'Planned'}
            {module.status === 'locked' && 'Locked'}
            {module.status === 'coming-soon' && 'Coming Soon'}
          </span>
        </div>

        {/* Icon */}
        <div className="mb-4">
          <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
            <module.icon className="w-8 h-8 text-white/70" />
          </div>
        </div>

        {/* Module ID & Phase */}
        <div className="flex items-center gap-2 mb-2">
          <span className="text-white/90 font-mono text-sm font-bold">{module.name}</span>
          <span className="text-white/30 text-xs">Phase {module.phase}</span>
          <span className="px-1.5 py-0.5 bg-white/10 text-white/60 text-[10px] rounded">
            {module.priority}
          </span>
        </div>

        {/* Full Name */}
        <h3 className="text-white font-semibold mb-2">{module.fullName}</h3>

        {/* Description */}
        <p className="text-white/60 text-sm mb-4 line-clamp-2">{module.description}</p>

        {/* Access Level */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-white/40 text-xs">Access:</span>
          <span className="text-xs px-2 py-0.5 rounded bg-white/5 text-white/60">
            {accessLevelLabels[module.accessLevel]}
          </span>
        </div>

        {/* Features Preview */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          {module.features.slice(0, 2).map((feature, i) => (
            <span
              key={i}
              className="px-2 py-1 bg-white/5 text-white/50 text-[10px] rounded"
            >
              {feature}
            </span>
          ))}
          {module.features.length > 2 && (
            <span className="px-2 py-1 bg-white/5 text-white/40 text-[10px] rounded">
              +{module.features.length - 2}
            </span>
          )}
        </div>

        {/* Action Button */}
        <div className="flex items-center justify-between pt-4 border-t border-white/5">
          {module.status === 'active' && (
            <button className="flex items-center gap-2 text-white/70 hover:text-white text-sm font-medium transition-colors">
              Open Module
              <ArrowRightIcon className="w-4 h-4" />
            </button>
          )}
          {module.status === 'planned' && (
            <div className="flex items-center gap-2 text-white/50 text-sm">
              <ClockIcon className="w-4 h-4" />
              <span>Coming in Phase {module.phase}</span>
            </div>
          )}
          {module.status === 'locked' && (
            <div className="flex items-center gap-2 text-white/40 text-sm">
              <LockClosedIcon className="w-4 h-4" />
              <span>Access Restricted</span>
            </div>
          )}
          {module.status === 'coming-soon' && (
            <div className="flex items-center gap-2 text-white/40 text-sm">
              <ClockIcon className="w-4 h-4" />
              <span>Coming Soon</span>
            </div>
          )}
        </div>
      </motion.div>
    </AccessGate>
  )
}
