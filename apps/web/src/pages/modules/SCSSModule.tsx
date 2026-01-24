/**
 * SCSS Module - Supply Chain Sovereignty System
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon,
  LinkIcon,
  MapIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from '@heroicons/react/24/outline'
import { getModuleById } from '../../lib/modules'
import AccessGate from '../../components/modules/AccessGate'

export default function SCSSModule() {
  const navigate = useNavigate()
  const module = getModuleById('scss')

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
            {/* Supply Chain Mapping */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-6 bg-white/5 rounded-2xl border border-white/10"
            >
              <div className="flex items-center gap-3 mb-4">
                <MapIcon className="w-6 h-6 text-white/70" />
                <h3 className="text-white font-semibold">Supply Chain Mapping</h3>
              </div>
              <p className="text-white/60 text-sm mb-4">
                Map complete supply chains from raw materials to finished products. 
                Track dependencies across global networks.
              </p>
              <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg text-sm border border-white/10 transition-colors">
                Map Supply Chain
              </button>
            </motion.div>

            {/* Bottleneck Analysis */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-6 bg-white/5 rounded-2xl border border-white/10"
            >
              <div className="flex items-center gap-3 mb-4">
                <ExclamationTriangleIcon className="w-6 h-6 text-white/70" />
                <h3 className="text-white font-semibold">Bottleneck Analysis</h3>
              </div>
              <p className="text-white/60 text-sm mb-4">
                Identify critical bottlenecks and single points of failure in supply chains. 
                Understand geopolitical risks.
              </p>
              <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg text-sm border border-white/10 transition-colors">
                Analyze Bottlenecks
              </button>
            </motion.div>

            {/* Geopolitical Risk */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="p-6 bg-white/5 rounded-2xl border border-white/10"
            >
              <div className="flex items-center gap-3 mb-4">
                <LinkIcon className="w-6 h-6 text-white/70" />
                <h3 className="text-white font-semibold">Geopolitical Risk</h3>
              </div>
              <p className="text-white/60 text-sm mb-4">
                Simulate geopolitical disruptions: sanctions, conflicts, trade wars. 
                Model impact on supply chain resilience.
              </p>
              <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg text-sm border border-white/10 transition-colors">
                Run Simulation
              </button>
            </motion.div>

            {/* Alternative Suppliers */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="p-6 bg-white/5 rounded-2xl border border-white/10"
            >
              <div className="flex items-center gap-3 mb-4">
                <ArrowPathIcon className="w-6 h-6 text-white/70" />
                <h3 className="text-white font-semibold">Alternative Suppliers</h3>
              </div>
              <p className="text-white/60 text-sm mb-4">
                Find alternative suppliers and logistics routes. Get recommendations 
                for diversifying supply chains.
              </p>
              <button className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg text-sm border border-white/10 transition-colors">
                Find Alternatives
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
                <span className="px-2 py-1 bg-white/5 text-white/60 rounded text-xs">POST</span>
                <span className="text-white/80">{module.apiPrefix}/supply-chain/map</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-white/5 text-white/60 rounded text-xs">GET</span>
                <span className="text-white/80">{module.apiPrefix}/bottlenecks</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-white/5 text-white/60 rounded text-xs">POST</span>
                <span className="text-white/80">{module.apiPrefix}/scenarios/geopolitical</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="px-2 py-1 bg-white/5 text-white/60 rounded text-xs">GET</span>
                <span className="text-white/80">{module.apiPrefix}/alternatives/&#123;material_id&#125;</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </AccessGate>
  )
}
