/**
 * Visualization Demo Page
 * 
 * Showcases all available visualization components:
 * - Plotly 3D (Risk Surface, Scatter, Mesh)
 * - D3.js (Force Graph, Treemap, Chord)
 * - Three.js (Particles, 3D Network, Globe)
 * - Deck.gl + Mapbox (Geospatial)
 * - IFC.js (BIM Viewer)
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  CubeIcon,
  GlobeAltIcon,
  ChartBarIcon,
  MapIcon,
  SparklesIcon,
  CloudIcon,
} from '@heroicons/react/24/outline'

// Import visualization components
import MapView from '../components/MapView'
import FinancialChart from '../components/FinancialChart'
import HeatmapChart from '../components/HeatmapChart'
import BIMViewer from '../components/BIMViewer'
import Viewer3D from '../components/Viewer3D'

// Tabs for different visualization categories
type TabType = 'plotly' | 'd3' | 'threejs' | 'deckgl' | 'nvidia'

export default function Visualizations() {
  const [activeTab, setActiveTab] = useState<TabType>('plotly')

  const tabs = [
    { id: 'plotly', name: 'Plotly 3D', icon: ChartBarIcon },
    { id: 'd3', name: 'D3.js', icon: SparklesIcon },
    { id: 'threejs', name: 'Three.js', icon: CubeIcon },
    { id: 'deckgl', name: 'Deck.gl + Mapbox', icon: MapIcon },
    { id: 'nvidia', name: 'NVIDIA AI', icon: CloudIcon },
  ]

  return (
    <div className="min-h-screen bg-dark-bg p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Visualization Stack Demo
          </h1>
          <p className="text-dark-muted">
            Physical-Financial Risk Platform visualization capabilities
          </p>
        </div>

        {/* Tabs */}
        <div className="flex space-x-2 mb-6 overflow-x-auto pb-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as TabType)}
              className={`flex items-center px-4 py-2 rounded-lg font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-primary-600 text-white'
                  : 'bg-dark-card text-dark-muted hover:text-white hover:bg-dark-card/80'
              }`}
            >
              <tab.icon className="w-5 h-5 mr-2" />
              {tab.name}
            </button>
          ))}
        </div>

        {/* Content */}
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {activeTab === 'plotly' && <PlotlySection />}
          {activeTab === 'd3' && <D3Section />}
          {activeTab === 'threejs' && <ThreeJSSection />}
          {activeTab === 'deckgl' && <DeckGLSection />}
          {activeTab === 'nvidia' && <NVIDIASection />}
        </motion.div>
      </div>
    </div>
  )
}

// ==================== PLOTLY 3D SECTION ====================
function PlotlySection() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">Plotly 3D Visualizations</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Surface */}
        <div className="bg-dark-card rounded-xl p-4">
          <h3 className="text-lg font-medium text-white mb-4">Risk Surface</h3>
          <div className="h-80">
            <FinancialChart
              type="surface"
              title="Climate Risk Surface"
              data={generateSurfaceData()}
            />
          </div>
        </div>

        {/* 3D Scatter */}
        <div className="bg-dark-card rounded-xl p-4">
          <h3 className="text-lg font-medium text-white mb-4">3D Risk Scatter</h3>
          <div className="h-80">
            <FinancialChart
              type="scatter3d"
              title="Asset Risk Distribution"
              data={generateScatterData()}
            />
          </div>
        </div>

        {/* Risk Mesh */}
        <div className="bg-dark-card rounded-xl p-4">
          <h3 className="text-lg font-medium text-white mb-4">Risk Mesh</h3>
          <div className="h-80">
            <FinancialChart
              type="mesh3d"
              title="Interconnected Risk Mesh"
              data={generateMeshData()}
            />
          </div>
        </div>

        {/* Correlation 3D */}
        <div className="bg-dark-card rounded-xl p-4">
          <h3 className="text-lg font-medium text-white mb-4">Correlation Matrix 3D</h3>
          <div className="h-80">
            <HeatmapChart
              data={generateCorrelationData()}
              xLabels={['Climate', 'Physical', 'Network', 'Financial', 'Regulatory']}
              yLabels={['Climate', 'Physical', 'Network', 'Financial', 'Regulatory']}
              title="Risk Correlations"
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== D3.JS SECTION ====================
function D3Section() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">D3.js Interactive Visualizations</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Force Graph */}
        <div className="bg-dark-card rounded-xl p-4">
          <h3 className="text-lg font-medium text-white mb-4">Force-Directed Network</h3>
          <div className="h-80 flex items-center justify-center">
            <ForceGraph />
          </div>
        </div>

        {/* Treemap */}
        <div className="bg-dark-card rounded-xl p-4">
          <h3 className="text-lg font-medium text-white mb-4">Risk Treemap</h3>
          <div className="h-80">
            <HeatmapChart
              data={generateTreemapData()}
              xLabels={['Q1', 'Q2', 'Q3', 'Q4']}
              yLabels={['Munich', 'Berlin', 'Hamburg', 'Frankfurt', 'Cologne']}
              title="Regional Risk Distribution"
            />
          </div>
        </div>

        {/* Chord Diagram placeholder */}
        <div className="bg-dark-card rounded-xl p-4">
          <h3 className="text-lg font-medium text-white mb-4">Chord Diagram</h3>
          <div className="h-80 flex items-center justify-center text-dark-muted">
            <div className="text-center">
              <SparklesIcon className="w-16 h-16 mx-auto mb-4 text-primary-400" />
              <p>Dependency Flow Visualization</p>
              <p className="text-sm mt-2">Shows risk propagation between sectors</p>
            </div>
          </div>
        </div>

        {/* Flow Diagram placeholder */}
        <div className="bg-dark-card rounded-xl p-4">
          <h3 className="text-lg font-medium text-white mb-4">Sankey Flow</h3>
          <div className="h-80 flex items-center justify-center text-dark-muted">
            <div className="text-center">
              <ChartBarIcon className="w-16 h-16 mx-auto mb-4 text-primary-400" />
              <p>Risk Flow Diagram</p>
              <p className="text-sm mt-2">Cascade propagation visualization</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Force Graph Component (D3.js)
function ForceGraph() {
  // Simplified force graph visualization
  const nodes = [
    { id: 'Asset 1', group: 1 },
    { id: 'Asset 2', group: 1 },
    { id: 'Asset 3', group: 2 },
    { id: 'Power Grid', group: 3 },
    { id: 'Water Supply', group: 3 },
  ]

  return (
    <svg viewBox="0 0 300 200" className="w-full h-full">
      {/* Links */}
      <line x1="80" y1="60" x2="150" y2="100" stroke="#4ade80" strokeWidth="2" opacity="0.6" />
      <line x1="80" y1="140" x2="150" y2="100" stroke="#4ade80" strokeWidth="2" opacity="0.6" />
      <line x1="150" y1="100" x2="220" y2="60" stroke="#f87171" strokeWidth="3" opacity="0.8" />
      <line x1="150" y1="100" x2="220" y2="140" stroke="#60a5fa" strokeWidth="2" opacity="0.6" />
      
      {/* Nodes */}
      <circle cx="80" cy="60" r="20" fill="#4ade80" className="animate-pulse" />
      <circle cx="80" cy="140" r="20" fill="#4ade80" />
      <circle cx="150" cy="100" r="25" fill="#fbbf24" />
      <circle cx="220" cy="60" r="18" fill="#f87171" />
      <circle cx="220" cy="140" r="18" fill="#60a5fa" />
      
      {/* Labels */}
      <text x="80" y="65" textAnchor="middle" fill="white" fontSize="8">Asset 1</text>
      <text x="80" y="145" textAnchor="middle" fill="white" fontSize="8">Asset 2</text>
      <text x="150" y="105" textAnchor="middle" fill="white" fontSize="8">Hub</text>
      <text x="220" y="65" textAnchor="middle" fill="white" fontSize="8">Power</text>
      <text x="220" y="145" textAnchor="middle" fill="white" fontSize="8">Water</text>
    </svg>
  )
}

// ==================== THREE.JS SECTION ====================
function ThreeJSSection() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">Three.js 3D Scenes</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 3D Viewer */}
        <div className="bg-dark-card rounded-xl p-4">
          <h3 className="text-lg font-medium text-white mb-4">Interactive 3D Asset</h3>
          <div className="h-80">
            <Viewer3D 
              riskScore={65}
              assetType="commercial_office"
            />
          </div>
        </div>

        {/* BIM Viewer */}
        <div className="bg-dark-card rounded-xl p-4">
          <h3 className="text-lg font-medium text-white mb-4">BIM Viewer (IFC.js)</h3>
          <div className="h-80">
            <BIMViewer />
          </div>
        </div>

        {/* Particle System placeholder */}
        <div className="bg-dark-card rounded-xl p-4">
          <h3 className="text-lg font-medium text-white mb-4">Particle System</h3>
          <div className="h-80 flex items-center justify-center">
            <ParticleDemo />
          </div>
        </div>

        {/* Risk Globe placeholder */}
        <div className="bg-dark-card rounded-xl p-4">
          <h3 className="text-lg font-medium text-white mb-4">Risk Globe</h3>
          <div className="h-80 flex items-center justify-center text-dark-muted">
            <div className="text-center">
              <GlobeAltIcon className="w-16 h-16 mx-auto mb-4 text-primary-400 animate-spin" style={{ animationDuration: '10s' }} />
              <p>Global Risk Distribution</p>
              <p className="text-sm mt-2">3D Earth with risk hotspots</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Particle Demo (CSS-based for now)
function ParticleDemo() {
  return (
    <div className="relative w-full h-full overflow-hidden">
      {Array.from({ length: 50 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 bg-primary-400 rounded-full animate-pulse"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            animationDelay: `${Math.random() * 2}s`,
            opacity: 0.3 + Math.random() * 0.7,
          }}
        />
      ))}
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-white font-medium">Risk Particles</span>
      </div>
    </div>
  )
}

// ==================== DECK.GL SECTION ====================
function DeckGLSection() {
  const sampleAssets = [
    { id: '1', name: 'Munich Office Tower', latitude: 48.1351, longitude: 11.5820, climate_risk_score: 45, valuation: 85000000 },
    { id: '2', name: 'Berlin Tech Campus', latitude: 52.5200, longitude: 13.4050, climate_risk_score: 62, valuation: 120000000 },
    { id: '3', name: 'Hamburg Port Facility', latitude: 53.5511, longitude: 9.9937, climate_risk_score: 78, valuation: 65000000 },
    { id: '4', name: 'Frankfurt Financial Center', latitude: 50.1109, longitude: 8.6821, climate_risk_score: 35, valuation: 200000000 },
    { id: '5', name: 'Cologne Industrial Park', latitude: 50.9375, longitude: 6.9603, climate_risk_score: 55, valuation: 45000000 },
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">Deck.gl + Mapbox Geospatial</h2>
      
      <div className="grid grid-cols-1 gap-6">
        {/* Full Map View */}
        <div className="bg-dark-card rounded-xl p-4">
          <h3 className="text-lg font-medium text-white mb-4">Asset Distribution Map</h3>
          <div className="h-[500px] rounded-lg overflow-hidden">
            <MapView 
              assets={sampleAssets}
              showRiskHeatmap={true}
            />
          </div>
        </div>

        {/* Map Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-dark-card rounded-xl p-4">
            <h4 className="font-medium text-white mb-2">🏢 3D Buildings</h4>
            <p className="text-dark-muted text-sm">Extruded building footprints with risk coloring</p>
          </div>
          <div className="bg-dark-card rounded-xl p-4">
            <h4 className="font-medium text-white mb-2">🌡️ Risk Heatmap</h4>
            <p className="text-dark-muted text-sm">Climate risk intensity visualization</p>
          </div>
          <div className="bg-dark-card rounded-xl p-4">
            <h4 className="font-medium text-white mb-2">🌊 Flood Zones</h4>
            <p className="text-dark-muted text-sm">GeoJSON overlay for hazard areas</p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== NVIDIA AI SECTION ====================
function NVIDIASection() {
  const [loading, setLoading] = useState(false)
  const [forecast, setForecast] = useState<any>(null)
  const [generatedImage, setGeneratedImage] = useState<string | null>(null)

  const testForecast = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/v1/nvidia/nim/health')
      const data = await response.json()
      setForecast(data)
    } catch (error) {
      setForecast({ error: 'API not available' })
    }
    setLoading(false)
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-white">NVIDIA AI Integration</h2>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weather Forecasting */}
        <div className="bg-dark-card rounded-xl p-4">
          <h3 className="text-lg font-medium text-white mb-4">
            <CloudIcon className="w-5 h-5 inline mr-2" />
            FourCastNet Weather Forecast
          </h3>
          <p className="text-dark-muted mb-4">Global weather forecasting AI</p>
          <button
            onClick={testForecast}
            disabled={loading}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Check NIM Status'}
          </button>
          {forecast && (
            <pre className="mt-4 p-3 bg-dark-bg rounded text-xs text-dark-muted overflow-auto">
              {JSON.stringify(forecast, null, 2)}
            </pre>
          )}
        </div>

        {/* Image Generation */}
        <div className="bg-dark-card rounded-xl p-4">
          <h3 className="text-lg font-medium text-white mb-4">
            <SparklesIcon className="w-5 h-5 inline mr-2" />
            FLUX.1-dev Image Generation
          </h3>
          <p className="text-dark-muted mb-4">AI-generated risk visualizations</p>
          <div className="h-48 bg-dark-bg rounded-lg flex items-center justify-center">
            {generatedImage ? (
              <img src={generatedImage} alt="Generated" className="max-h-full" />
            ) : (
              <div className="text-center text-dark-muted">
                <SparklesIcon className="w-12 h-12 mx-auto mb-2" />
                <p className="text-sm">Generate damage visualization</p>
              </div>
            )}
          </div>
        </div>

        {/* Agent Status */}
        <div className="bg-dark-card rounded-xl p-4 lg:col-span-2">
          <h3 className="text-lg font-medium text-white mb-4">AI Agents Status</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: 'SENTINEL', status: 'active', model: 'Llama 3.1 8B' },
              { name: 'ANALYST', status: 'active', model: 'Llama 3.1 70B' },
              { name: 'ADVISOR', status: 'active', model: 'Llama 3.1 70B' },
              { name: 'REPORTER', status: 'active', model: 'FLUX.1-dev' },
            ].map((agent) => (
              <div key={agent.name} className="bg-dark-bg rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-white">{agent.name}</span>
                  <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                </div>
                <p className="text-xs text-dark-muted">{agent.model}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

// ==================== DATA GENERATORS ====================

function generateSurfaceData() {
  const z = []
  for (let i = 0; i < 20; i++) {
    const row = []
    for (let j = 0; j < 20; j++) {
      row.push(Math.sin(i / 3) * Math.cos(j / 3) * 50 + 50)
    }
    z.push(row)
  }
  return { z, type: 'surface' }
}

function generateScatterData() {
  const n = 50
  return {
    x: Array.from({ length: n }, () => Math.random() * 100),
    y: Array.from({ length: n }, () => Math.random() * 100),
    z: Array.from({ length: n }, () => Math.random() * 100),
    mode: 'markers',
    type: 'scatter3d',
    marker: { size: 5, color: Array.from({ length: n }, () => Math.random() * 100), colorscale: 'Viridis' },
  }
}

function generateMeshData() {
  return {
    x: [0, 1, 2, 0, 1, 2, 0, 1, 2],
    y: [0, 0, 0, 1, 1, 1, 2, 2, 2],
    z: [0.5, 0.8, 0.3, 0.7, 1, 0.6, 0.4, 0.9, 0.5],
    type: 'mesh3d',
  }
}

function generateCorrelationData() {
  return [
    [1.0, 0.7, 0.5, 0.3, 0.2],
    [0.7, 1.0, 0.6, 0.4, 0.3],
    [0.5, 0.6, 1.0, 0.8, 0.5],
    [0.3, 0.4, 0.8, 1.0, 0.6],
    [0.2, 0.3, 0.5, 0.6, 1.0],
  ]
}

function generateTreemapData() {
  return [
    [45, 52, 48, 55],
    [62, 58, 65, 70],
    [78, 72, 80, 75],
    [35, 40, 38, 42],
    [55, 50, 58, 52],
  ]
}
