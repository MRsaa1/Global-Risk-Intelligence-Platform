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
import { useQuery } from '@tanstack/react-query'
import {
  ChartBarIcon,
  BeakerIcon,
  ShareIcon,
  SparklesIcon,
  CpuChipIcon,
  Square3Stack3DIcon,
} from '@heroicons/react/24/outline'
import { Link } from 'react-router-dom'

import { PredictivePanel, WhatIfSimulator, CascadeVisualizer } from '../components/analytics'

type TabType = 'predictive' | 'whatif' | 'cascade'

// Scenario options for Cascade build-from-context (aligned with cascade_gnn and stress/risk-zone)
const CASCADE_SCENARIOS = [
  { id: 'seismic_shock', name: 'Seismic Activity' },
  { id: 'flood_event', name: 'Flood Event' },
  { id: 'hurricane', name: 'Hurricane/Typhoon' },
  { id: 'climate_5yr', name: 'Climate Risk 5yr' },
  { id: 'climate_10yr', name: 'Climate Risk 10yr' },
  { id: 'climate_25yr', name: 'Climate Risk 25yr' },
  { id: 'sea_level_10yr', name: 'Sea Level Rise 10yr' },
  { id: 'sea_level_25yr', name: 'Sea Level Rise 25yr' },
  { id: 'credit_crunch', name: 'Credit Crunch' },
  { id: 'market_crash', name: 'Market Crash' },
  { id: 'liquidity_crisis', name: 'Liquidity Crisis' },
  { id: 'financial_stress_5yr', name: 'Basel Stress 5yr' },
  { id: 'conflict_escalation', name: 'Conflict Escalation' },
  { id: 'sanctions_escalation', name: 'Sanctions Escalation' },
  { id: 'regional_conflict_spillover', name: 'Regional Conflict Spillover' },
  { id: 'trade_war_supply', name: 'Trade War / Supply' },
  { id: 'energy_shock', name: 'Energy Shock' },
  { id: 'supply_chain', name: 'Supply Chain Disruption' },
  { id: 'cyber_attack', name: 'Cyber Attack' },
  { id: 'tech_disruption_10yr', name: 'Tech Disruption 10yr' },
  { id: 'demographic_25yr', name: 'Demographic Shift 25yr' },
  { id: 'pandemic', name: 'Pandemic Outbreak' },
]

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
  const [cascadeCityId, setCascadeCityId] = useState('')
  const [cascadeScenarioId, setCascadeScenarioId] = useState('')

  const { data: citiesData } = useQuery({
    queryKey: ['geodata-cities'],
    queryFn: async () => {
      const res = await fetch('/api/v1/geodata/cities')
      if (!res.ok) throw new Error('Failed to fetch cities')
      return res.json() as Promise<{ cities: Array<{ id: string; name: string; country: string }> }>
    },
  })
  const cities = citiesData?.cities ?? []
  
  return (
    <div className="h-full overflow-auto p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-500/10 rounded-xl border border-primary-500/20">
            <CpuChipIcon className="w-7 h-7 text-primary-400" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-white/90">
              Advanced Analytics
            </h1>
            <p className="text-white/50 text-sm mt-1 flex items-center gap-2">
              <CpuChipIcon className="w-3.5 h-3.5 text-white/40" />
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
        className="mb-6 p-3 bg-white/5 rounded-xl border border-white/5"
      >
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-emerald-500/60 rounded-full" />
              <span className="text-xs text-white/50">PhysicsNeMo</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-primary-500/60 rounded-full" />
              <span className="text-xs text-white/50">Neural Operators</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-primary-500/60 rounded-full" />
              <span className="text-xs text-white/50">GNN/PyG</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-primary-500/60 rounded-full" />
              <span className="text-xs text-white/50">Monte Carlo</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2 text-xs text-white/30">
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
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-4 p-4 bg-white/5 rounded-xl border border-white/10">
              <span className="text-sm text-white/60">Build graph from city & scenario:</span>
              <select
                value={cascadeCityId}
                onChange={(e) => setCascadeCityId(e.target.value)}
                className="px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-white min-w-[180px]"
              >
                <option value="">Select city...</option>
                {cities.map((c) => (
                  <option key={c.id} value={c.id}>{c.name} ({c.country})</option>
                ))}
              </select>
              <select
                value={cascadeScenarioId}
                onChange={(e) => setCascadeScenarioId(e.target.value)}
                className="px-3 py-2 bg-black/30 border border-white/10 rounded-lg text-sm text-white min-w-[220px]"
              >
                <option value="">Select scenario...</option>
                {CASCADE_SCENARIOS.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              {(cascadeCityId && cascadeScenarioId) && (
                <span className="text-xs text-primary-400">Graph will use city infrastructure & scenario template</span>
              )}
            </div>
            <CascadeVisualizer
              cityId={cascadeCityId || undefined}
              scenarioId={cascadeScenarioId || undefined}
            />
          </div>
        )}
      </motion.div>
      
      {/* Strategic Modules Integration */}
      {activeTab === 'cascade' && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6 p-4 bg-white/5 rounded-xl border border-white/10"
        >
          <div className="flex items-start gap-4">
            <div className="p-2 bg-white/5 rounded-lg">
              <Square3Stack3DIcon className="w-5 h-5 text-white/70" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-white mb-1">Systemic Risk Observatory (SRO)</h3>
              <p className="text-sm text-white/60 mb-3">
                For advanced systemic risk analysis integrating financial, physical, and cyber risks, 
                explore the SRO Strategic Module. It extends cascade analysis with systemic risk 
                indicators, early warning systems, and contagion modeling.
              </p>
              <Link
                to="/modules/sro"
                className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white/70 rounded-lg text-sm border border-white/10 transition-colors"
              >
                <Square3Stack3DIcon className="w-4 h-4" />
                Open SRO Module
              </Link>
            </div>
          </div>
        </motion.div>
      )}

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
