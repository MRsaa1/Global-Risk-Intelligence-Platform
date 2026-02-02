/**
 * CommandModePanel - Main container for Command Mode 4-panel layout
 * 
 * Shows 4 interactive panels with live stress test data:
 * - StressMetricsPanel: VaR, CVaR, Capital Impact, Expected Loss
 * - ZoneMetricsPanel: Zone metrics + entity list
 * - CascadeFlowPanel: Sankey cascade diagram
 * - TimelinePredictionsPanel: Time chart + predictions
 */
import { motion } from 'framer-motion'
import { XMarkIcon } from '@heroicons/react/24/outline'
import { StressTestState, PortfolioState } from '../../store/platformStore'
import { RiskZone } from '../CesiumGlobe'
import StressMetricsPanel from './StressMetricsPanel'
import ZoneMetricsPanel from './ZoneMetricsPanel'
import CascadeFlowPanel from './CascadeFlowPanel'
import TimelinePredictionsPanel from './TimelinePredictionsPanel'

interface CommandModePanelProps {
  stressTest: StressTestState | null
  selectedZone: RiskZone | null
  portfolio: PortfolioState
  onClose: () => void
}

export default function CommandModePanel({
  stressTest,
  selectedZone,
  portfolio,
  onClose,
}: CommandModePanelProps) {
  return (
    <motion.div
      className="absolute top-0 right-0 bottom-0 w-[60%] z-40"
      initial={{ x: '100%', opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: '100%', opacity: 0 }}
      transition={{ duration: 0.5, ease: 'easeInOut' }}
    >
      {/* Glass background */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-xl" />
      
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-50 p-2 bg-white/10 hover:bg-white/20 rounded-lg border border-white/10 transition-colors"
        aria-label="Close Command Mode"
      >
        <XMarkIcon className="w-5 h-5 text-white" />
      </button>
      
      {/* 4-Panel Grid Layout */}
      <div className="relative h-full p-4 pt-14 grid grid-cols-2 grid-rows-2 gap-3">
        {/* Panel 1: Stress Metrics (Top Left) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="relative rounded-xl overflow-hidden"
        >
          <StressMetricsPanel 
            stressTest={stressTest} 
            portfolio={portfolio}
          />
        </motion.div>
        
        {/* Panel 2: Zone Metrics (Top Right) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="relative rounded-xl overflow-hidden"
        >
          <ZoneMetricsPanel selectedZone={selectedZone} />
        </motion.div>
        
        {/* Panel 3: Cascade Flow (Bottom Left) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="relative rounded-xl overflow-hidden"
        >
          <CascadeFlowPanel 
            selectedZone={selectedZone}
            stressTest={stressTest}
          />
        </motion.div>
        
        {/* Panel 4: Timeline & Predictions (Bottom Right) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="relative rounded-xl overflow-hidden"
        >
          <TimelinePredictionsPanel 
            selectedZone={selectedZone}
            stressTest={stressTest}
          />
        </motion.div>
      </div>
    </motion.div>
  )
}
