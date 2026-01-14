/**
 * Digital Twin Panel
 * ===================
 * 
 * 3D visualization of a selected asset/building:
 * - Three.js 3D model viewer
 * - Risk zones highlighted
 * - Real-time sensor data
 * - Climate impact visualization
 */
import { useRef, useState, useEffect, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Box, Cylinder, Html, Environment, ContactShadows } from '@react-three/drei'
import { motion, AnimatePresence } from 'framer-motion'
import * as THREE from 'three'

interface AssetData {
  id: string
  name: string
  type: 'building' | 'infrastructure' | 'industrial'
  location: string
  value: number
  risk_score: number
  risk_factors: {
    flood: number
    earthquake: number
    fire: number
    structural: number
  }
  sensors: {
    temperature: number
    humidity: number
    vibration: number
    strain: number
  }
}

// Mock asset data
const MOCK_ASSET: AssetData = {
  id: 'building-001',
  name: 'Tokyo Tower Complex',
  type: 'building',
  location: 'Tokyo, Japan',
  value: 2.5,
  risk_score: 0.72,
  risk_factors: {
    flood: 0.45,
    earthquake: 0.85,
    fire: 0.25,
    structural: 0.35,
  },
  sensors: {
    temperature: 23.5,
    humidity: 65,
    vibration: 0.02,
    strain: 0.001,
  },
}

// 3D Building component
function Building3D({ riskScore, riskFactors }: { riskScore: number; riskFactors: AssetData['risk_factors'] }) {
  const buildingRef = useRef<THREE.Group>(null)
  
  useFrame(({ clock }) => {
    if (buildingRef.current) {
      buildingRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.1) * 0.1
    }
  })

  // Risk color based on score
  const getRiskColor = (risk: number) => {
    if (risk > 0.7) return '#ff4444'
    if (risk > 0.5) return '#ffaa44'
    if (risk > 0.3) return '#ffff44'
    return '#44ff88'
  }

  const baseColor = getRiskColor(riskScore)
  
  return (
    <group ref={buildingRef}>
      {/* Main building structure */}
      <Box args={[2, 4, 2]} position={[0, 2, 0]}>
        <meshStandardMaterial 
          color="#445566" 
          metalness={0.8} 
          roughness={0.2}
          transparent
          opacity={0.9}
        />
      </Box>
      
      {/* Risk zone - earthquake (base) */}
      {riskFactors.earthquake > 0.5 && (
        <Cylinder args={[1.5, 1.5, 0.1, 32]} position={[0, 0.05, 0]}>
          <meshBasicMaterial color="#ff6644" transparent opacity={0.5} />
        </Cylinder>
      )}
      
      {/* Risk zone - flood (lower floors) */}
      {riskFactors.flood > 0.3 && (
        <Box args={[2.2, 0.8 * riskFactors.flood, 2.2]} position={[0, 0.4 * riskFactors.flood, 0]}>
          <meshBasicMaterial color="#4488ff" transparent opacity={0.4} />
        </Box>
      )}
      
      {/* Windows */}
      {[1, 2, 3].map((floor) => (
        <group key={floor} position={[0, floor, 0]}>
          {[-0.6, 0, 0.6].map((x, i) => (
            <Box key={i} args={[0.3, 0.5, 0.05]} position={[x, 0, 1.01]}>
              <meshBasicMaterial color="#88ccff" transparent opacity={0.8} />
            </Box>
          ))}
        </group>
      ))}
      
      {/* Roof */}
      <Box args={[2.2, 0.2, 2.2]} position={[0, 4.1, 0]}>
        <meshStandardMaterial color="#334455" metalness={0.5} roughness={0.3} />
      </Box>
      
      {/* Risk indicator pulse */}
      <mesh position={[0, 5, 0]}>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshBasicMaterial color={baseColor} />
      </mesh>
      
      {/* Labels */}
      <Html position={[0, 5.5, 0]} center>
        <div className="px-2 py-1 bg-black/80 rounded text-white text-xs whitespace-nowrap">
          Risk: {(riskScore * 100).toFixed(0)}%
        </div>
      </Html>
    </group>
  )
}

interface DigitalTwinPanelProps {
  isOpen: boolean
  onClose: () => void
  assetId?: string
}

export default function DigitalTwinPanel({ isOpen, onClose, assetId }: DigitalTwinPanelProps) {
  const [asset, setAsset] = useState<AssetData>(MOCK_ASSET)
  const [activeTab, setActiveTab] = useState<'3d' | 'sensors' | 'risks'>('3d')

  // In production, load asset data from API
  useEffect(() => {
    if (assetId) {
      // fetch(`/api/v1/assets/${assetId}`).then(...)
      setAsset(MOCK_ASSET)
    }
  }, [assetId])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="absolute inset-8 z-50 pointer-events-auto"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
        >
          <div className="h-full bg-black/90 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden flex">
            {/* 3D Viewer */}
            <div className="flex-1 relative">
              <Canvas
                camera={{ position: [5, 5, 5], fov: 50 }}
                className="w-full h-full"
              >
                <ambientLight intensity={0.4} />
                <directionalLight position={[10, 10, 5]} intensity={1} />
                <pointLight position={[-10, -10, -5]} intensity={0.5} color="#4488ff" />
                
                <Suspense fallback={null}>
                  <Building3D riskScore={asset.risk_score} riskFactors={asset.risk_factors} />
                  <ContactShadows position={[0, 0, 0]} opacity={0.5} scale={10} blur={2} />
                  <Environment preset="city" />
                </Suspense>
                
                <OrbitControls 
                  enablePan={false}
                  minDistance={5}
                  maxDistance={15}
                  autoRotate
                  autoRotateSpeed={0.5}
                />
                
                {/* Grid */}
                <gridHelper args={[10, 10, '#333', '#222']} position={[0, 0, 0]} />
              </Canvas>
              
              {/* Overlay controls */}
              <div className="absolute top-4 left-4">
                <h2 className="text-white text-xl font-light">{asset.name}</h2>
                <p className="text-white/50 text-sm">{asset.location}</p>
              </div>
              
              <div className="absolute top-4 right-4">
                <button
                  onClick={onClose}
                  className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Info Panel */}
            <div className="w-80 border-l border-white/10 p-4 overflow-y-auto">
              {/* Tabs */}
              <div className="flex gap-2 mb-4">
                {(['3d', 'sensors', 'risks'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider transition-all ${
                      activeTab === tab
                        ? 'bg-cyan-500/20 text-cyan-400'
                        : 'bg-white/5 text-white/50 hover:bg-white/10'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              
              {/* Asset Value */}
              <div className="mb-6">
                <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Asset Value</div>
                <div className="text-white text-2xl font-light">
                  ${asset.value}<span className="text-sm text-white/40">B</span>
                </div>
              </div>
              
              {/* Risk Score */}
              <div className="mb-6">
                <div className="text-white/40 text-[10px] uppercase tracking-wider mb-2">Overall Risk</div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        asset.risk_score > 0.7 ? 'bg-red-500' :
                        asset.risk_score > 0.5 ? 'bg-orange-500' :
                        asset.risk_score > 0.3 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${asset.risk_score * 100}%` }}
                    />
                  </div>
                  <span className="text-white font-mono">{(asset.risk_score * 100).toFixed(0)}%</span>
                </div>
              </div>
              
              {/* Risk Factors */}
              {activeTab === 'risks' && (
                <div className="space-y-3">
                  <div className="text-white/40 text-[10px] uppercase tracking-wider mb-2">Risk Factors</div>
                  {Object.entries(asset.risk_factors).map(([key, value]) => (
                    <div key={key}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-white/70 capitalize">{key}</span>
                        <span className="text-white font-mono">{(value * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            value > 0.7 ? 'bg-red-500' :
                            value > 0.5 ? 'bg-orange-500' :
                            value > 0.3 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${value * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Sensors */}
              {activeTab === 'sensors' && (
                <div className="space-y-4">
                  <div className="text-white/40 text-[10px] uppercase tracking-wider mb-2">Live Sensors</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-white/5 rounded-lg">
                      <div className="text-white/40 text-[10px]">Temperature</div>
                      <div className="text-white text-lg">{asset.sensors.temperature}°C</div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg">
                      <div className="text-white/40 text-[10px]">Humidity</div>
                      <div className="text-white text-lg">{asset.sensors.humidity}%</div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg">
                      <div className="text-white/40 text-[10px]">Vibration</div>
                      <div className="text-white text-lg">{asset.sensors.vibration}g</div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg">
                      <div className="text-white/40 text-[10px]">Strain</div>
                      <div className="text-white text-lg">{asset.sensors.strain}ε</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-4">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-green-400/60 text-xs">All sensors online</span>
                  </div>
                </div>
              )}
              
              {/* 3D View info */}
              {activeTab === '3d' && (
                <div className="space-y-4">
                  <div className="text-white/40 text-[10px] uppercase tracking-wider mb-2">3D Model Info</div>
                  <div className="text-white/60 text-sm">
                    <p>• Drag to rotate</p>
                    <p>• Scroll to zoom</p>
                    <p>• Risk zones highlighted</p>
                  </div>
                  
                  <div className="mt-4 p-3 bg-white/5 rounded-lg">
                    <div className="text-white/40 text-[10px] uppercase mb-2">Legend</div>
                    <div className="space-y-2 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-blue-500/50" />
                        <span className="text-white/70">Flood risk zone</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded bg-orange-500/50" />
                        <span className="text-white/70">Earthquake impact</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
