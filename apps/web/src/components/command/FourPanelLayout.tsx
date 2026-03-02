/**
 * Four-Panel Command Center Layout
 * =================================
 * 
 * 2x2 grid layout for command center:
 * ┌─────────────────┬─────────────────┐
 * │  Globe          │  Digital Twin   │
 * │  (Risk Map)     │  (3D Building)  │
 * ├─────────────────┼─────────────────┤
 * │  Stress Testing │  Risk Graph     │
 * │  (Scenarios)    │  (Network)      │
 * └─────────────────┴─────────────────┘
 * 
 * Features:
 * - Resizable panels
 * - Click to expand any panel
 * - Synchronized state across panels
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowsPointingOutIcon, 
  ArrowsPointingInIcon,
} from '@heroicons/react/24/outline'
import GlobePanel from './GlobePanel'
import RiskGraphPanel from './RiskGraphPanel'
import StressTestPanel from './StressTestPanel'
import DigitalTwinPanel from './DigitalTwinPanel'

interface FourPanelLayoutProps {
  portfolio: {
    globalExposure: number
    atRisk: number
    highRisk: number
    activeScenarios: number
  }
  stressScenarios: { id: number; name: string; value: string; active: boolean }[]
  expectedLoss: number
  capitalImpact: number
  selectedAsset: {
    id: string
    name: string
    valuation: number
    cashFlow: number
    loanExposure: number
    riskLevel: number
    risks: {
      operationalDowntime: number
      floodRisk: string
      fireHazard: string
    }
    impact: {
      pd: number
      loss: number
      capitalAdequacy: number
      rateHike: number
      temperature: number
    }
  } | null
  onPanelExpand?: (panel: 'globe' | 'twin' | 'stress' | 'graph' | null) => void
  completedStressTestId?: string | null
  onPlayTimeline?: (url: string) => void
}

type PanelId = 'globe' | 'twin' | 'stress' | 'graph'

export default function FourPanelLayout({
  portfolio,
  stressScenarios,
  expectedLoss,
  capitalImpact,
  selectedAsset,
  onPanelExpand,
  completedStressTestId,
  onPlayTimeline,
}: FourPanelLayoutProps) {
  const [expandedPanel, setExpandedPanel] = useState<PanelId | null>(null)
  const [activeGlobeTab, setActiveGlobeTab] = useState('overview')
  const [timelineValue, setTimelineValue] = useState(0)

  const handleExpand = (panel: PanelId) => {
    const newExpanded = expandedPanel === panel ? null : panel
    setExpandedPanel(newExpanded)
    onPanelExpand?.(newExpanded)
  }

  // Default asset for Digital Twin when none selected
  const defaultAsset = {
    id: 'industrial-a56',
    name: 'Industrial Facility A56',
    valuation: 125800000,
    cashFlow: 4200000,
    loanExposure: 18700000,
    riskLevel: 0.65,
    risks: {
      operationalDowntime: 15,
      floodRisk: 'High',
      fireHazard: 'Medium',
    },
    impact: {
      pd: 6.2,
      loss: 12.4,
      capitalAdequacy: -3.5,
      rateHike: 2.5,
      temperature: 3,
    },
  }

  const assetData = selectedAsset || defaultAsset

  const renderPanelContent = (panelId: PanelId) => {
    switch (panelId) {
      case 'globe':
        return (
          <GlobePanel
            data={portfolio}
            activeTab={activeGlobeTab}
            onTabChange={setActiveGlobeTab}
            timelineValue={timelineValue}
            onTimelineChange={setTimelineValue}
          />
        )
      case 'twin':
        return (
          <DigitalTwinPanel asset={assetData} />
        )
      case 'stress':
        return (
          <StressTestPanel
            data={{
              scenarios: stressScenarios,
              expectedLoss,
              capitalImpact,
            }}
            completedStressTestId={completedStressTestId}
            onPlayTimeline={onPlayTimeline}
          />
        )
      case 'graph':
        return (
          <RiskGraphPanel
            data={{
              atRisk: portfolio.atRisk,
              criticalLinks: 8,
              cascadeDetected: true,
              nodes: [],
              edges: [],
            }}
          />
        )
      default:
        return null
    }
  }

  return (
    <div className="h-full w-full bg-[#09090b]">
      {/* Expanded panel view */}
      <AnimatePresence>
        {expandedPanel && (
          <motion.div
            className="absolute inset-0 z-50 bg-[#09090b]"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
          >
            <div className="h-full relative">
              {/* Collapse button */}
              <button
                onClick={() => handleExpand(expandedPanel)}
                className="absolute top-4 right-4 z-10 p-2 bg-zinc-700 hover:bg-zinc-600 rounded-md border border-zinc-800 transition-colors"
              >
                <ArrowsPointingInIcon className="w-5 h-5 text-zinc-100" />
              </button>
              {renderPanelContent(expandedPanel)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Grid layout */}
      <div className={`h-full grid grid-cols-2 grid-rows-2 gap-px bg-zinc-800 ${expandedPanel ? 'invisible' : ''}`}>
        {/* Globe Panel - Top Left */}
        <motion.div
          className="relative bg-[#09090b] overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0 }}
        >
          {/* Expand button */}
          <button
            onClick={() => handleExpand('globe')}
            className="absolute top-2 right-2 z-20 p-1.5 bg-black/40 hover:bg-black/60 rounded transition-colors"
          >
            <ArrowsPointingOutIcon className="w-4 h-4 text-zinc-500 hover:text-zinc-100" />
          </button>
          {renderPanelContent('globe')}
        </motion.div>

        {/* Digital Twin Panel - Top Right */}
        <motion.div
          className="relative bg-[#09090b] overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <button
            onClick={() => handleExpand('twin')}
            className="absolute top-2 right-2 z-20 p-1.5 bg-black/40 hover:bg-black/60 rounded transition-colors"
          >
            <ArrowsPointingOutIcon className="w-4 h-4 text-zinc-500 hover:text-zinc-100" />
          </button>
          {renderPanelContent('twin')}
        </motion.div>

        {/* Stress Test Panel - Bottom Left */}
        <motion.div
          className="relative bg-[#09090b] overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <button
            onClick={() => handleExpand('stress')}
            className="absolute top-2 right-2 z-20 p-1.5 bg-black/40 hover:bg-black/60 rounded transition-colors"
          >
            <ArrowsPointingOutIcon className="w-4 h-4 text-zinc-500 hover:text-zinc-100" />
          </button>
          {renderPanelContent('stress')}
        </motion.div>

        {/* Risk Graph Panel - Bottom Right */}
        <motion.div
          className="relative bg-[#09090b] overflow-hidden"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <button
            onClick={() => handleExpand('graph')}
            className="absolute top-2 right-2 z-20 p-1.5 bg-black/40 hover:bg-black/60 rounded transition-colors"
          >
            <ArrowsPointingOutIcon className="w-4 h-4 text-zinc-500 hover:text-zinc-100" />
          </button>
          {renderPanelContent('graph')}
        </motion.div>
      </div>
    </div>
  )
}
