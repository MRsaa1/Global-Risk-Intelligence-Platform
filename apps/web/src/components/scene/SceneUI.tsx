/**
 * Scene UI - Minimal overlay on top of 3D scene
 * 
 * Philosophy:
 * - UI is NOT the focus, scene is
 * - Minimal, transparent, floating
 * - Information appears when needed
 * - No boxes, no cards, no dashboard
 */
import { motion, AnimatePresence } from 'framer-motion'

interface SceneUIProps {
  activeView: 'global' | 'asset'
  onViewChange: (view: 'global' | 'asset') => void
  timelineValue: number
  onTimelineChange: (value: number) => void
  selectedAsset: string | null
}

export default function SceneUI({
  activeView,
  onViewChange,
  timelineValue,
  onTimelineChange,
  selectedAsset,
}: SceneUIProps) {
  return (
    <>
      {/* Top left - Title and key metrics (floating) */}
      <div className="absolute top-6 left-6 z-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <h1 className="text-white/90 text-2xl font-light tracking-wide mb-4">
            Global Risk Command Center
          </h1>
          
          {/* Key metrics - minimal floating style */}
          <div className="space-y-3">
            <Metric label="Global Exposure" value="$482.3B" />
            <Metric label="At Risk" value="$67.5B" variant="warning" />
            <Metric label="High Risk" value="$14.8B" variant="danger" />
          </div>
        </motion.div>
      </div>

      {/* Top right - View tabs */}
      <div className="absolute top-6 right-6 z-10">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3 }}
          className="flex gap-2"
        >
          <TabButton 
            label="Portfolio Overview" 
            active={activeView === 'global'}
            onClick={() => onViewChange('global')}
          />
          <TabButton 
            label="Stress Lab" 
            active={false}
            onClick={() => {}}
          />
          <TabButton 
            label="Reports" 
            active={false}
            onClick={() => {}}
          />
        </motion.div>
      </div>

      {/* Bottom - Timeline */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className="flex items-center gap-4"
        >
          {/* Time buttons */}
          <div className="flex gap-1.5">
            {['T0', 'T+1Y', 'T+3Y', 'T+5Y'].map((label, i) => (
              <TimeButton
                key={label}
                label={label}
                active={timelineValue === i}
                onClick={() => onTimelineChange(i)}
              />
            ))}
          </div>
          
          {/* Timeline bar */}
          <div className="w-64 h-1 bg-white/10 rounded-full relative">
            <motion.div 
              className="absolute h-full bg-gradient-to-r from-amber-500 via-amber-500 to-red-500 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${(timelineValue / 3) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
            {/* Dots */}
            {[0, 1, 2, 3].map((i) => (
              <motion.div
                key={i}
                className="absolute top-1/2 -translate-y-1/2 cursor-pointer"
                style={{ left: `${(i / 3) * 100}%`, transform: 'translate(-50%, -50%)' }}
                whileHover={{ scale: 1.3 }}
                onClick={() => onTimelineChange(i)}
              >
                <div className={`w-3 h-3 rounded-full border-2 transition-all ${
                  i <= timelineValue 
                    ? 'bg-amber-500 border-amber-300' 
                    : 'bg-white/20 border-white/30'
                } ${i === timelineValue ? 'w-4 h-4 bg-red-500 border-red-300' : ''}`} 
                />
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Bottom right - Status indicators */}
      <div className="absolute bottom-6 right-6 z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5 }}
          className="flex items-center gap-4 text-xs"
        >
          <StatusIndicator label="3 Stress Scenarios Active" variant="warning" />
          <StatusIndicator label="Live Data Connected" variant="success" />
        </motion.div>
      </div>

      {/* Selected asset panel - appears when asset selected */}
      <AnimatePresence>
        {selectedAsset && (
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            className="absolute top-24 right-6 z-10"
          >
            <AssetPanel assetId={selectedAsset} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// Minimal metric display - no boxes
function Metric({ 
  label, 
  value, 
  variant = 'default' 
}: { 
  label: string
  value: string
  variant?: 'default' | 'warning' | 'danger'
}) {
  const colors = {
    default: 'text-white',
    warning: 'text-amber-400/80',
    danger: 'text-red-400/80',
  }

  return (
    <div>
      <div className="text-white/40 text-xs tracking-wider uppercase">{label}</div>
      <div className={`text-2xl font-light ${colors[variant]}`}>{value}</div>
    </div>
  )
}

// Tab button - transparent style
function TabButton({ 
  label, 
  active, 
  onClick 
}: { 
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-2 text-sm rounded-md transition-all ${
        active
          ? 'bg-white/10 text-white border border-white/20'
          : 'text-white/40 hover:text-white/70'
      }`}
    >
      {label}
    </button>
  )
}

// Time button
function TimeButton({ 
  label, 
  active, 
  onClick 
}: { 
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 text-xs rounded transition-all ${
        active
          ? 'bg-amber-500/20 text-amber-400/80 border border-amber-500/30'
          : 'text-white/40 hover:text-white/70 border border-transparent'
      }`}
    >
      {label}
    </button>
  )
}

// Status indicator
function StatusIndicator({ 
  label, 
  variant 
}: { 
  label: string
  variant: 'success' | 'warning' | 'danger'
}) {
  const colors = {
    success: 'bg-green-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
  }

  return (
    <div className="flex items-center gap-2 text-white/60">
      <div className={`w-2 h-2 rounded-full ${colors[variant]} animate-pulse`} />
      <span>{label}</span>
    </div>
  )
}

// Asset info panel
function AssetPanel({ assetId }: { assetId: string }) {
  // In real app, fetch asset data
  const assetData = {
    name: 'Industrial Facility A56',
    valuation: '$125.8M',
    risk: 'High',
  }

  return (
    <div className="bg-black/60 rounded-md border border-white/10 p-4 w-64">
      <h3 className="text-white font-medium mb-3">{assetData.name}</h3>
      
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-white/50">Valuation</span>
          <span className="text-white">{assetData.valuation}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-white/50">Risk Level</span>
          <span className="text-red-400/80">{assetData.risk}</span>
        </div>
      </div>
      
      <button className="mt-4 w-full py-2 bg-white/10 hover:bg-white/20 rounded-md text-white text-sm transition-colors">
        View Digital Twin →
      </button>
    </div>
  )
}
