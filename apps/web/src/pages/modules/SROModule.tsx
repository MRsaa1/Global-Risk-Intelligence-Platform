/**
 * SRO Module - Systemic Risk Observatory
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon,
  ChartBarIcon,
  BellIcon,
  ShareIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { getModuleById } from '../../lib/modules'
import AccessGate from '../../components/modules/AccessGate'

export default function SROModule() {
  const navigate = useNavigate()
  const module = getModuleById('sro')

  if (!module) {
    return <div>Module not found</div>
  }

  return (
    <AccessGate accessLevel={module.accessLevel}>
      <div className="h-full overflow-auto p-8">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <button
              onClick={() => navigate('/modules')}
              className="flex items-center gap-2 text-white/60 hover:text-white mb-4 transition-colors"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              <span className="text-sm">Back to Modules</span>
            </button>

            <div className="flex items-center gap-4 mb-4">
              <div className="w-16 h-16 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                <module.icon className="w-8 h-8 text-white/70" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-3xl font-display font-bold text-white/90">
                    {module.fullName}
                  </h1>
                  <span className="px-2 py-1 bg-white/10 text-white/80 text-xs rounded border border-white/20">
                    Active
                  </span>
                </div>
                <p className="text-white/60 text-sm">{module.description}</p>
              </div>
            </div>
          </motion.div>

          {/* Layer Integration */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mb-8 p-6 bg-white/5 rounded-2xl border border-white/10"
          >
            <h2 className="text-white/90 font-semibold mb-4">5-Layer Architecture Integration</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {module.layers.map((layer, i) => (
                <div key={i} className="p-3 bg-white/5 rounded-lg border border-white/10">
                  <p className="text-white/80 text-sm">{layer}</p>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Systemic Indicators */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-6 bg-white/5 rounded-2xl border border-white/10"
            >
              <div className="flex items-center gap-3 mb-4">
                <ChartBarIcon className="w-6 h-6 text-white/70" />
                <h3 className="text-white font-semibold">Systemic Indicators</h3>
              </div>
              <p className="text-white/60 text-sm mb-4">
                Real-time systemic risk metrics. Monitor financial-physical-cyber 
                risk correlations in real-time.
              </p>
              <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg text-sm border border-white/10 transition-colors">
                View Indicators
              </button>
            </motion.div>

            {/* Early Warning System */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-6 bg-white/5 rounded-2xl border border-white/10"
            >
              <div className="flex items-center gap-3 mb-4">
                <BellIcon className="w-6 h-6 text-white/70" />
                <h3 className="text-white font-semibold">Early Warning System</h3>
              </div>
              <p className="text-white/60 text-sm mb-4">
                Get early warnings of systemic risk buildup. Identify patterns that 
                preceded past crises (2008, 2020).
              </p>
              <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg text-sm border border-white/10 transition-colors">
                View Warnings
              </button>
            </motion.div>

            {/* Contagion Modeling */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="p-6 bg-white/5 rounded-2xl border border-white/10"
            >
              <div className="flex items-center gap-3 mb-4">
                <ShareIcon className="w-6 h-6 text-white/70" />
                <h3 className="text-white font-semibold">Contagion Modeling</h3>
              </div>
              <p className="text-white/60 text-sm mb-4">
                Model how risks propagate through financial-physical networks. 
                Simulate correlation breakdown scenarios.
              </p>
              <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg text-sm border border-white/10 transition-colors">
                Run Model
              </button>
            </motion.div>

            {/* Risk Correlation */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="p-6 bg-white/5 rounded-2xl border border-white/10"
            >
              <div className="flex items-center gap-3 mb-4">
                <ExclamationTriangleIcon className="w-6 h-6 text-white/70" />
                <h3 className="text-white font-semibold">Risk Correlation</h3>
              </div>
              <p className="text-white/60 text-sm mb-4">
                Analyze correlations between financial, physical, and cyber risks. 
                Identify hidden dependencies.
              </p>
              <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg text-sm border border-white/10 transition-colors">
                Analyze Correlations
              </button>
            </motion.div>
          </div>

          {/* API Documentation */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="p-6 bg-white/5 rounded-2xl border border-white/10"
          >
            <h3 className="text-white font-semibold mb-4">API Endpoints</h3>
            <div className="space-y-3 font-mono text-sm">
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-white/5 text-white/60 rounded text-xs">GET</span>
                <span className="text-white/80">{module.apiPrefix}/systemic-indicators</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-white/5 text-white/60 rounded text-xs">GET</span>
                <span className="text-white/80">{module.apiPrefix}/early-warnings</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-white/5 text-white/60 rounded text-xs">POST</span>
                <span className="text-white/80">{module.apiPrefix}/scenarios/contagion</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-white/5 text-white/60 rounded text-xs">GET</span>
                <span className="text-white/80">{module.apiPrefix}/correlations</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AccessGate>
  )
}
