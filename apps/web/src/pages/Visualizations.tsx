/**
 * Risk Flow Visualization Page
 * 
 * Sankey diagrams showing risk cascade and propagation
 */
import { motion } from 'framer-motion'
import RiskFlowDiagram from '../components/RiskFlowDiagram'
import { Link } from 'react-router-dom'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'

export default function Visualizations() {
  // Sample stress test data for demo
  const sampleRiskZones = [
    { name: 'New York', risk: 0.85, exposure: 52.3 },
    { name: 'Tokyo', risk: 0.92, exposure: 45.2 },
    { name: 'London', risk: 0.68, exposure: 38.5 },
    { name: 'Frankfurt', risk: 0.58, exposure: 35.2 },
    { name: 'Shanghai', risk: 0.82, exposure: 55.8 },
    { name: 'Singapore', risk: 0.62, exposure: 38.9 },
    { name: 'Hong Kong', risk: 0.75, exposure: 42.5 },
    { name: 'Sydney', risk: 0.52, exposure: 38.7 },
  ]

  return (
    <div className="min-h-screen bg-[#0a0a0f] p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header with back button */}
        <div className="mb-8 flex items-center gap-4">
          <Link 
            to="/command"
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white transition-all"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-light text-white">
              Risk Flow Analysis
            </h1>
            <p className="text-white/40 text-sm">
              Risk cascade and propagation visualization
            </p>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="space-y-6"
        >
          {/* Main description */}
          <p className="text-white/60">
            Sankey diagrams showing how risk events cascade through sectors to impact levels
          </p>
          
          {/* Main Risk Flow Diagram */}
          <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 p-4">
            <h2 className="text-lg font-medium text-white mb-4">Global Risk Cascade</h2>
            <RiskFlowDiagram height={450} />
          </div>
          
          {/* Stress Test Specific Flows */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 p-4">
              <h3 className="text-lg font-medium text-white mb-4">Climate Shock Flow</h3>
              <RiskFlowDiagram 
                stressTestName="Climate Physical Shock"
                riskZones={sampleRiskZones}
                height={350}
              />
            </div>
            
            <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 p-4">
              <h3 className="text-lg font-medium text-white mb-4">Financial Crisis Flow</h3>
              <RiskFlowDiagram 
                stressTestName="Basel Full Financial Crisis"
                riskZones={[
                  { name: 'Wall Street', risk: 0.92, exposure: 85.3 },
                  { name: 'City of London', risk: 0.88, exposure: 72.5 },
                  { name: 'Frankfurt', risk: 0.78, exposure: 45.2 },
                  { name: 'Zurich', risk: 0.65, exposure: 42.5 },
                  { name: 'Singapore', risk: 0.72, exposure: 38.9 },
                  { name: 'Hong Kong', risk: 0.82, exposure: 48.5 },
                ]}
                height={350}
              />
            </div>
          </div>

          {/* Explanation */}
          <div className="bg-black/40 backdrop-blur-sm rounded-xl border border-white/10 p-6">
            <h3 className="text-lg font-medium text-white mb-4">How to Read Risk Flow Diagrams</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 rounded bg-red-500" />
                  <span className="text-white font-medium">Left Column: Risk Events</span>
                </div>
                <p className="text-white/50">
                  Source events that trigger the risk cascade (earthquakes, financial crises, pandemics, etc.)
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 rounded bg-blue-500" />
                  <span className="text-white font-medium">Middle Column: Sectors/Regions</span>
                </div>
                <p className="text-white/50">
                  Affected sectors or geographic regions that propagate the risk further
                </p>
              </div>
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-4 h-4 rounded bg-orange-500" />
                  <span className="text-white font-medium">Right Column: Impact Level</span>
                </div>
                <p className="text-white/50">
                  Final impact severity classification (Critical, High, Medium, Low)
                </p>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-white/10">
              <p className="text-white/50 text-sm">
                <strong className="text-white">Flow Width</strong> represents the exposure amount in billions of euros (€B). 
                Thicker flows indicate higher financial exposure.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
