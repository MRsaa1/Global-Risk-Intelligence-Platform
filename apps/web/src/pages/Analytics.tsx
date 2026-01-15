/**
 * Analytics Page - Predictive ML, What-If Simulation, Cascade Analysis
 * 
 * Powered by:
 * - PhysicsNeMo for physics-informed ML
 * - PyG/NetworkX for graph analysis
 * - Monte Carlo simulation
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  ChartBarIcon,
  BeakerIcon,
  ShareIcon,
  SparklesIcon,
  CpuChipIcon,
} from '@heroicons/react/24/outline'

import { PredictivePanel, WhatIfSimulator, CascadeVisualizer } from '../components/analytics'

type TabType = 'predictive' | 'whatif' | 'cascade'

const tabs: { id: TabType; name: string; icon: React.ElementType; description: string }[] = [
  { 
    id: 'predictive', 
    name: 'Predictive Analytics', 
    icon: ChartBarIcon,
    description: 'Early Warning & Risk Forecasting'
  },
  { 
    id: 'whatif', 
    name: 'What-If Simulator', 
    icon: BeakerIcon,
    description: 'Scenario Analysis & Monte Carlo'
  },
  { 
    id: 'cascade', 
    name: 'Cascade Analysis', 
    icon: ShareIcon,
    description: 'Graph Neural Network Propagation'
  },
]

export default function Analytics() {
  const [activeTab, setActiveTab] = useState<TabType>('predictive')
  
  return (
    <div className="h-full overflow-auto p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-xl">
            <CpuChipIcon className="w-8 h-8 text-purple-400" />
          </div>
          <div>
            <h1 className="text-3xl font-display font-bold gradient-text">
              Advanced Analytics
            </h1>
            <p className="text-dark-muted mt-1 flex items-center gap-2">
              <SparklesIcon className="w-4 h-4 text-purple-400" />
              Powered by NVIDIA PhysicsNeMo & Graph Neural Networks
            </p>
          </div>
        </div>
      </motion.div>
      
      {/* Tech Stack Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="mb-6 p-4 bg-gradient-to-r from-purple-500/10 via-pink-500/10 to-cyan-500/10 rounded-xl border border-white/10"
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs text-white/60">PhysicsNeMo</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs text-white/60">Neural Operators</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs text-white/60">GNN/PyG</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-xs text-white/60">Monte Carlo</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-white/40">
            <span>10,000x faster than traditional solvers</span>
          </div>
        </div>
      </motion.div>
      
      {/* Tab Navigation */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="flex gap-2 mb-6"
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 p-4 rounded-xl border transition-all ${
              activeTab === tab.id
                ? 'bg-white/10 border-primary-500/50 shadow-lg shadow-primary-500/10'
                : 'bg-white/5 border-white/10 hover:bg-white/10'
            }`}
          >
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${
                activeTab === tab.id ? 'bg-primary-500/20' : 'bg-white/5'
              }`}>
                <tab.icon className={`w-5 h-5 ${
                  activeTab === tab.id ? 'text-primary-400' : 'text-white/40'
                }`} />
              </div>
              <div className="text-left">
                <div className={`font-medium ${
                  activeTab === tab.id ? 'text-white' : 'text-white/60'
                }`}>
                  {tab.name}
                </div>
                <div className="text-xs text-white/40">{tab.description}</div>
              </div>
            </div>
          </button>
        ))}
      </motion.div>
      
      {/* Content */}
      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {activeTab === 'predictive' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <PredictivePanel assetId="portfolio-main" />
            <PredictivePanel assetId="high-risk-cluster" />
          </div>
        )}
        
        {activeTab === 'whatif' && (
          <WhatIfSimulator baseExposure={100_000_000} />
        )}
        
        {activeTab === 'cascade' && (
          <CascadeVisualizer />
        )}
      </motion.div>
      
      {/* Info Footer */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-8 p-4 bg-white/5 rounded-xl border border-white/10"
      >
        <div className="flex items-start gap-4">
          <div className="p-2 bg-purple-500/20 rounded-lg">
            <SparklesIcon className="w-5 h-5 text-purple-400" />
          </div>
          <div className="flex-1">
            <h3 className="font-medium text-white mb-1">About NVIDIA PhysicsNeMo</h3>
            <p className="text-sm text-white/60">
              PhysicsNeMo is an open-source framework for physics-informed machine learning. 
              It combines neural operators (FNO, DeepONet) with physics constraints to create 
              surrogate models that are 10,000x faster than traditional CFD/FEM solvers while 
              maintaining scientific accuracy. Used for digital twins at Siemens Energy, 
              Wistron, and Earth-2 climate modeling.
            </p>
            <div className="flex gap-4 mt-3 text-xs">
              <a 
                href="https://developer.nvidia.com/physicsnemo" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300"
              >
                Learn More →
              </a>
              <a 
                href="https://github.com/NVIDIA/physicsnemo" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-purple-400 hover:text-purple-300"
              >
                GitHub →
              </a>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
