/**
 * GLOBAL RISK COMMAND CENTER
 * ===========================
 * 
 * Production-level visualization using CesiumJS:
 * - Real WGS84 Earth
 * - Level of Detail (LOD)
 * - Smooth camera transitions
 * - GPU-rendered on client
 * 
 * Architecture: Server (risk models) → Client (GPU render)
 */
import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import CesiumGlobe from '../components/CesiumGlobe'
import StressTestPanel from '../components/StressTestPanel'
import DigitalTwinPanel from '../components/DigitalTwinPanel'
import { useSimulatedWebSocket, WebSocketMessage, RiskUpdate } from '../lib/useWebSocket'

const API_BASE = '/api/v1'

interface PortfolioSummary {
  total_exposure: number
  at_risk_exposure: number
  critical_exposure: number
  weighted_risk: number
  hotspot_count: number
  total_assets: number
}

interface HotspotInfo {
  id: string
  name: string
  risk: number
  value: number
  assets_count?: number
}

function getRiskColorClass(risk: number): string {
  if (risk > 0.8) return 'text-red-400'
  if (risk > 0.6) return 'text-orange-400'
  if (risk > 0.4) return 'text-yellow-400'
  return 'text-green-400'
}

export default function CommandCenter() {
  const [selectedAsset, setSelectedAsset] = useState<string | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const [activeScenario, setActiveScenario] = useState<string | undefined>(undefined)
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null)
  const [hotspots, setHotspots] = useState<HotspotInfo[]>([])
  
  // Layer visibility controls
  const [showLayers, setShowLayers] = useState({
    heatmap: false,
    arcs: true,
    points: true,
  })
  const [showLayerPanel, setShowLayerPanel] = useState(false)
  const [showStressTest, setShowStressTest] = useState(false)
  const [showDigitalTwin, setShowDigitalTwin] = useState(false)
  const [recentUpdates, setRecentUpdates] = useState<RiskUpdate[]>([])
  
  // WebSocket for real-time updates
  const { status: wsStatus, lastMessage } = useSimulatedWebSocket((msg) => {
    if (msg.type === 'risk_update') {
      setRecentUpdates(prev => [msg as RiskUpdate, ...prev.slice(0, 4)])
    }
  })
  
  // Load portfolio summary and hotspots from API
  useEffect(() => {
    async function loadData() {
      try {
        const [summaryRes, hotspotsRes] = await Promise.all([
          fetch(`${API_BASE}/geodata/summary`),
          fetch(`${API_BASE}/geodata/hotspots${activeScenario ? `?scenario=${activeScenario}` : ''}`),
        ])
        
        if (summaryRes.ok) {
          setPortfolio(await summaryRes.json())
        }
        
        if (hotspotsRes.ok) {
          const geojson = await hotspotsRes.json()
          setHotspots(geojson.features.map((f: any) => ({
            id: f.id,
            name: f.properties.name,
            risk: f.properties.risk_score,
            value: f.properties.exposure,
            assets_count: f.properties.assets_count,
          })))
        }
      } catch (e) {
        console.warn('Failed to load data from API:', e)
      }
      setIsLoaded(true)
    }
    loadData()
  }, [activeScenario])
  
  const selectedData = selectedAsset 
    ? hotspots.find(h => h.id === selectedAsset) 
    : null
    
  const totalExposure = portfolio?.total_exposure ?? 482.3
  const atRisk = portfolio?.at_risk_exposure ?? 67.5
  const critical = portfolio?.critical_exposure ?? 14.8

  return (
    <div className="relative w-full h-full overflow-hidden" style={{ background: '#030810' }}>
      {/* CesiumJS Globe - Full screen */}
      <div className="absolute inset-0">
        <CesiumGlobe 
          onAssetSelect={setSelectedAsset}
          selectedAsset={selectedAsset}
          scenario={activeScenario}
        />
      </div>
      
      {/* HUD Overlay */}
      <AnimatePresence>
        {isLoaded && (
          <motion.div 
            className="absolute inset-0 pointer-events-none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1, delay: 0.5 }}
          >
            {/* Top Left - Key Metrics */}
            <div className="absolute top-8 left-8 pointer-events-auto">
              <motion.div
                initial={{ x: -50, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.8 }}
              >
                <div className="text-cyan-400/60 text-[10px] uppercase tracking-[0.2em] mb-1">
                  Global Exposure
                </div>
                <div className="text-white text-4xl font-extralight tracking-tight">
                  ${totalExposure.toFixed(1)}<span className="text-xl text-white/40">B</span>
                </div>
                
                <div className="mt-6 text-orange-400/70 text-[10px] uppercase tracking-[0.2em] mb-1">
                  At Risk
                </div>
                <div className="text-orange-400 text-2xl font-light">
                  ${atRisk.toFixed(1)}<span className="text-sm text-orange-400/50">B</span>
                </div>
                
                <div className="mt-4 text-red-400/70 text-[10px] uppercase tracking-[0.2em] mb-1">
                  Critical
                </div>
                <div className="text-red-400 text-2xl font-light">
                  ${critical.toFixed(1)}<span className="text-sm text-red-400/50">B</span>
                </div>
              </motion.div>
            </div>
            
            {/* Top Right - Title */}
            <motion.div 
              className="absolute top-8 right-8 text-right"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.8 }}
            >
              <div className="text-white/20 text-[10px] uppercase tracking-[0.3em]">
                Physical-Financial Risk Platform
              </div>
              <div className="text-white/70 text-lg font-light mt-1">
                Global Command Center
              </div>
              <div className="text-cyan-400/50 text-[10px] mt-2">
                Powered by CesiumJS + NVIDIA Earth-2
              </div>
            </motion.div>
            
            {/* Bottom Left - Active Scenarios */}
            <motion.div 
              className="absolute bottom-8 left-8"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 1.2 }}
            >
              <div className="text-white/30 text-[10px] uppercase tracking-[0.2em] mb-2">
                Active Stress Scenarios
              </div>
              <div className="flex gap-3 pointer-events-auto">
                <button 
                  onClick={() => setActiveScenario(activeScenario === 'climate_physical' ? undefined : 'climate_physical')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${
                    activeScenario === 'climate_physical' 
                      ? 'bg-red-500/30 border-red-500/50' 
                      : 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full bg-red-500 ${activeScenario === 'climate_physical' ? 'animate-pulse' : ''}`} />
                  <span className="text-red-400 text-xs">Climate Physical</span>
                </button>
                <button 
                  onClick={() => setActiveScenario(activeScenario === 'credit_shock' ? undefined : 'credit_shock')}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${
                    activeScenario === 'credit_shock' 
                      ? 'bg-orange-500/30 border-orange-500/50' 
                      : 'bg-orange-500/10 border-orange-500/20 hover:bg-orange-500/20'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full bg-orange-500 ${activeScenario === 'credit_shock' ? 'animate-pulse' : ''}`} />
                  <span className="text-orange-400 text-xs">Credit Shock</span>
                </button>
                <button 
                  onClick={() => setActiveScenario(undefined)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${
                    !activeScenario 
                      ? 'bg-cyan-500/30 border-cyan-500/50' 
                      : 'bg-cyan-500/10 border-cyan-500/20 hover:bg-cyan-500/20'
                  }`}
                >
                  <div className={`w-2 h-2 rounded-full bg-cyan-500 ${!activeScenario ? 'animate-pulse' : ''}`} />
                  <span className="text-cyan-400 text-xs">Baseline</span>
                </button>
              </div>
            </motion.div>
            
            {/* Controls - Top Right Corner */}
            <motion.div 
              className="absolute top-24 right-8 pointer-events-auto flex gap-2"
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 1.0 }}
            >
              {/* Stress Test Button */}
              <button
                onClick={() => setShowStressTest(!showStressTest)}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-all ${
                  showStressTest 
                    ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' 
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span className="text-xs">Stress Test</span>
              </button>
              
              {/* Digital Twin Button */}
              <button
                onClick={() => setShowDigitalTwin(!showDigitalTwin)}
                className={`flex items-center gap-2 px-3 py-2 border rounded-lg transition-all ${
                  showDigitalTwin 
                    ? 'bg-purple-500/20 border-purple-500/50 text-purple-400' 
                    : 'bg-white/5 border-white/10 text-white/60 hover:bg-white/10'
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                </svg>
                <span className="text-xs">Digital Twin</span>
              </button>
              
              {/* Layer Controls */}
              <div className="relative">
                <button
                  onClick={() => setShowLayerPanel(!showLayerPanel)}
                  className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all"
                >
                  <svg className="w-4 h-4 text-white/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                  </svg>
                  <span className="text-white/60 text-xs">Layers</span>
                </button>
              
              <AnimatePresence>
                {showLayerPanel && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="mt-2 p-3 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 min-w-[160px]"
                  >
                    <div className="text-white/40 text-[10px] uppercase tracking-wider mb-3">
                      Visualization Layers
                    </div>
                    
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={showLayers.heatmap}
                          onChange={(e) => setShowLayers(prev => ({ ...prev, heatmap: e.target.checked }))}
                          className="w-3 h-3 rounded border-white/30 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
                        />
                        <span className="text-white/70 text-xs group-hover:text-white transition-colors">
                          Risk Heatmap
                        </span>
                      </label>
                      
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={showLayers.arcs}
                          onChange={(e) => setShowLayers(prev => ({ ...prev, arcs: e.target.checked }))}
                          className="w-3 h-3 rounded border-white/30 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
                        />
                        <span className="text-white/70 text-xs group-hover:text-white transition-colors">
                          Risk Connections
                        </span>
                      </label>
                      
                      <label className="flex items-center gap-2 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={showLayers.points}
                          onChange={(e) => setShowLayers(prev => ({ ...prev, points: e.target.checked }))}
                          className="w-3 h-3 rounded border-white/30 bg-white/5 text-cyan-500 focus:ring-cyan-500/50"
                        />
                        <span className="text-white/70 text-xs group-hover:text-white transition-colors">
                          Hotspot Points
                        </span>
                      </label>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              </div>
            </motion.div>
            
            {/* Stress Test Panel */}
            <StressTestPanel
              isOpen={showStressTest}
              onClose={() => setShowStressTest(false)}
              totalExposure={totalExposure * 1e9}
            />
            
            {/* Digital Twin Panel */}
            <DigitalTwinPanel
              isOpen={showDigitalTwin}
              onClose={() => setShowDigitalTwin(false)}
              assetId={selectedAsset || undefined}
            />
            
            {/* Bottom Right - Status & Live Updates */}
            <motion.div 
              className="absolute bottom-8 right-8 flex flex-col items-end gap-2"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 1.2 }}
            >
              {/* Recent Updates */}
              {recentUpdates.length > 0 && (
                <div className="space-y-1 mb-2">
                  {recentUpdates.slice(0, 3).map((update, i) => (
                    <motion.div
                      key={`${update.hotspot_id}-${update.timestamp}`}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1 - i * 0.3, x: 0 }}
                      className="flex items-center gap-2 text-[10px]"
                    >
                      <span className={update.risk_score > update.previous_score ? 'text-red-400' : 'text-green-400'}>
                        {update.risk_score > update.previous_score ? '▲' : '▼'}
                      </span>
                      <span className="text-white/50 capitalize">{update.hotspot_id}</span>
                      <span className="text-white/70 font-mono">
                        {(update.risk_score * 100).toFixed(1)}%
                      </span>
                    </motion.div>
                  ))}
                </div>
              )}
              
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full animate-pulse ${
                    wsStatus === 'connected' ? 'bg-emerald-400' :
                    wsStatus === 'connecting' ? 'bg-yellow-400' : 'bg-red-400'
                  }`} />
                  <span className={`text-xs ${
                    wsStatus === 'connected' ? 'text-emerald-400/60' :
                    wsStatus === 'connecting' ? 'text-yellow-400/60' : 'text-red-400/60'
                  }`}>
                    {wsStatus === 'connected' ? 'Live' : wsStatus === 'connecting' ? 'Connecting...' : 'Offline'}
                  </span>
                </div>
                <div className="text-white/20 text-[10px]">
                  {new Date().toLocaleTimeString()}
                </div>
              </div>
            </motion.div>
            
            {/* Bottom Center - Legend */}
            <motion.div 
              className="absolute bottom-8 left-1/2 -translate-x-1/2 flex gap-6"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 1.4 }}
            >
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <span className="text-white/40 text-[10px]">Critical (&gt;80%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-orange-500" />
                <span className="text-white/40 text-[10px]">High (60-80%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="text-white/40 text-[10px]">Medium (40-60%)</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-white/40 text-[10px]">Low (&lt;40%)</span>
              </div>
            </motion.div>
            
            {/* Selected Asset Panel */}
            <AnimatePresence>
              {selectedData && (
                <motion.div 
                  className="absolute top-1/2 right-8 -translate-y-1/2 pointer-events-auto"
                  initial={{ x: 100, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: 100, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="bg-black/60 backdrop-blur-md rounded-xl p-6 border border-white/10 w-72">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-white font-medium">{selectedData.name}</h3>
                      <button 
                        onClick={() => setSelectedAsset(null)}
                        className="text-white/40 hover:text-white text-xs"
                      >
                        ✕
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      <div>
                        <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">
                          Risk Score
                        </div>
                        <div className={`text-3xl font-light ${getRiskColorClass(selectedData.risk)}`}>
                          {(selectedData.risk * 100).toFixed(0)}%
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">
                          Exposure
                        </div>
                        <div className="text-white text-2xl font-light">
                          ${selectedData.value}<span className="text-sm text-white/40">B</span>
                        </div>
                      </div>
                      
                      {/* Risk bar */}
                      <div>
                        <div className="text-white/40 text-[10px] uppercase tracking-wider mb-2">
                          Risk Distribution
                        </div>
                        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              selectedData.risk > 0.8 ? 'bg-red-500' :
                              selectedData.risk > 0.6 ? 'bg-orange-500' :
                              selectedData.risk > 0.4 ? 'bg-yellow-500' : 'bg-green-500'
                            }`}
                            style={{ width: `${selectedData.risk * 100}%` }}
                          />
                        </div>
                      </div>
                      
                      <button className="w-full py-2 px-4 bg-cyan-500/20 border border-cyan-500/30 rounded-lg text-cyan-400 text-sm hover:bg-cyan-500/30 transition-colors">
                        View Details →
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
            
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
