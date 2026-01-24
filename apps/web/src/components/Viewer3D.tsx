import { useRef, useState, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  OrbitControls,
  Box,
  Environment,
  PerspectiveCamera,
  Grid,
  Html,
  Float,
} from '@react-three/drei'
import * as THREE from 'three'
import { motion } from 'framer-motion'

interface Viewer3DProps {
  modelUrl?: string
  assetType?: string
  riskScores?: {
    climate: number
    physical: number
    network: number
  }
  showRiskOverlay?: boolean
  onObjectSelect?: (objectId: string) => void
}

// Risk color helper
function getRiskColor(score: number): string {
  if (score >= 70) return '#ef4444' // red
  if (score >= 40) return '#f59e0b' // amber
  return '#22c55e' // green
}

// Building component with risk visualization
function Building({
  riskScores = { climate: 30, physical: 20, network: 50 },
  showRiskOverlay = false,
}: {
  riskScores?: { climate: number; physical: number; network: number }
  showRiskOverlay?: boolean
}) {
  const buildingRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  
  // Gentle rotation
  useFrame((state) => {
    if (buildingRef.current && !hovered) {
      buildingRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.1) * 0.05
    }
  })
  
  const floors = 12
  const floorHeight = 0.35
  const buildingWidth = 3
  const buildingDepth = 2
  
  // Calculate composite risk for building color
  const compositeRisk = (riskScores.climate + riskScores.physical + riskScores.network) / 3
  const buildingColor = showRiskOverlay ? getRiskColor(compositeRisk) : '#0056e6'
  
  return (
    <group ref={buildingRef}>
      {/* Foundation */}
      <Box
        args={[buildingWidth + 1, 0.2, buildingDepth + 1]}
        position={[0, -0.1, 0]}
      >
        <meshStandardMaterial color="#1f2937" />
      </Box>
      
      {/* Main building structure */}
      {[...Array(floors)].map((_, i) => {
        const floorRisk = showRiskOverlay
          ? Math.min(100, compositeRisk + (i / floors) * 20) // Risk increases with height
          : 0
        
        return (
          <group key={i} position={[0, i * floorHeight + floorHeight / 2, 0]}>
            {/* Floor slab */}
            <Box
              args={[buildingWidth, 0.05, buildingDepth]}
              position={[0, -floorHeight / 2 + 0.025, 0]}
              onPointerOver={() => setHovered(`floor-${i}`)}
              onPointerOut={() => setHovered(null)}
            >
              <meshStandardMaterial
                color={showRiskOverlay ? getRiskColor(floorRisk) : '#334155'}
                opacity={hovered === `floor-${i}` ? 1 : 0.9}
                transparent
              />
            </Box>
            
            {/* Facade panels */}
            {/* Front */}
            <Box
              args={[buildingWidth, floorHeight - 0.05, 0.02]}
              position={[0, 0, buildingDepth / 2]}
            >
              <meshStandardMaterial
                color={showRiskOverlay ? getRiskColor(floorRisk) : buildingColor}
                metalness={0.3}
                roughness={0.7}
              />
            </Box>
            
            {/* Windows */}
            {[...Array(6)].map((_, j) => (
              <Box
                key={j}
                args={[0.35, floorHeight * 0.6, 0.03]}
                position={[
                  (j - 2.5) * 0.5,
                  0,
                  buildingDepth / 2 + 0.01,
                ]}
              >
                <meshStandardMaterial
                  color="#C9A962"
                  emissive="#C9A962"
                  emissiveIntensity={0.2}
                  metalness={0.8}
                  roughness={0.2}
                />
              </Box>
            ))}
          </group>
        )
      })}
      
      {/* Roof */}
      <Box
        args={[buildingWidth + 0.2, 0.1, buildingDepth + 0.2]}
        position={[0, floors * floorHeight + 0.05, 0]}
      >
        <meshStandardMaterial color="#1e3a5f" />
      </Box>
      
      {/* HVAC units on roof */}
      <Box args={[0.5, 0.3, 0.5]} position={[-0.8, floors * floorHeight + 0.25, 0.3]}>
        <meshStandardMaterial color="#4b5563" />
      </Box>
      <Box args={[0.4, 0.4, 0.4]} position={[0.6, floors * floorHeight + 0.3, -0.2]}>
        <meshStandardMaterial color="#4b5563" />
      </Box>
      
      {/* Risk indicators (floating labels) */}
      {showRiskOverlay && (
        <>
          <Html position={[buildingWidth / 2 + 0.5, floors * floorHeight * 0.7, 0]} center>
            <div className="glass px-2 py-1 rounded text-xs whitespace-nowrap">
              <span className={`font-bold ${getRiskColor(riskScores.climate) === '#ef4444' ? 'text-red-400' : getRiskColor(riskScores.climate) === '#f59e0b' ? 'text-amber-400' : 'text-green-400'}`}>
                Climate: {riskScores.climate}
              </span>
            </div>
          </Html>
          <Html position={[buildingWidth / 2 + 0.5, floors * floorHeight * 0.5, 0]} center>
            <div className="glass px-2 py-1 rounded text-xs whitespace-nowrap">
              <span className={`font-bold ${getRiskColor(riskScores.physical) === '#ef4444' ? 'text-red-400' : getRiskColor(riskScores.physical) === '#f59e0b' ? 'text-amber-400' : 'text-green-400'}`}>
                Physical: {riskScores.physical}
              </span>
            </div>
          </Html>
          <Html position={[buildingWidth / 2 + 0.5, floors * floorHeight * 0.3, 0]} center>
            <div className="glass px-2 py-1 rounded text-xs whitespace-nowrap">
              <span className={`font-bold ${getRiskColor(riskScores.network) === '#ef4444' ? 'text-red-400' : getRiskColor(riskScores.network) === '#f59e0b' ? 'text-amber-400' : 'text-green-400'}`}>
                Network: {riskScores.network}
              </span>
            </div>
          </Html>
        </>
      )}
    </group>
  )
}

// Ground with grid
function Ground() {
  return (
    <group>
      <Grid
        infiniteGrid
        cellSize={1}
        cellThickness={0.5}
        cellColor="#1f2937"
        sectionSize={5}
        sectionThickness={1}
        sectionColor="#374151"
        fadeDistance={30}
        fadeStrength={1}
      />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#0a0f1a" transparent opacity={0.8} />
      </mesh>
    </group>
  )
}

// Camera controls with smooth animation
function CameraController() {
  const { camera } = useThree()
  
  useEffect(() => {
    camera.position.set(8, 6, 8)
    camera.lookAt(0, 2, 0)
  }, [camera])
  
  return null
}

export default function Viewer3D({
  modelUrl,
  assetType = 'commercial_office',
  riskScores = { climate: 45, physical: 22, network: 68 },
  showRiskOverlay = true,
  onObjectSelect,
}: Viewer3DProps) {
  const [isLoading, setIsLoading] = useState(true)
  
  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setIsLoading(false), 1000)
    return () => clearTimeout(timer)
  }, [])
  
  return (
    <div className="relative w-full h-full bg-dark-bg rounded-xl overflow-hidden">
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-dark-bg z-10">
          <motion.div
            className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      )}
      
      <Canvas shadows>
        <CameraController />
        <PerspectiveCamera makeDefault position={[8, 6, 8]} fov={50} />
        
        {/* Lighting */}
        <ambientLight intensity={0.4} />
        <directionalLight
          position={[10, 15, 10]}
          intensity={1}
          castShadow
          shadow-mapSize={[2048, 2048]}
        />
        <directionalLight position={[-5, 5, -5]} intensity={0.3} />
        
        {/* Scene */}
        <Float speed={1} rotationIntensity={0.1} floatIntensity={0.1}>
          <Building riskScores={riskScores} showRiskOverlay={showRiskOverlay} />
        </Float>
        
        <Ground />
        
        {/* Controls */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={5}
          maxDistance={30}
          minPolarAngle={0.2}
          maxPolarAngle={Math.PI / 2 - 0.1}
          target={[0, 2, 0]}
        />
        
        {/* Environment */}
        <Environment preset="city" />
        <fog attach="fog" args={['#0a0f1a', 20, 50]} />
      </Canvas>
      
      {/* Controls overlay */}
      <div className="absolute bottom-4 left-4 glass rounded-lg px-3 py-2 text-xs text-dark-muted">
        <div className="flex gap-4">
          <span>🖱️ Drag to rotate</span>
          <span>⚡ Scroll to zoom</span>
          <span>⇧ Shift+drag to pan</span>
        </div>
      </div>
      
      {/* Legend */}
      {showRiskOverlay && (
        <div className="absolute top-4 right-4 glass rounded-lg p-3">
          <p className="text-xs font-medium mb-2">Risk Legend</p>
          <div className="space-y-1 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-green-500" />
              <span>Low (0-39)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-amber-500" />
              <span>Medium (40-69)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded bg-red-500" />
              <span>High (70-100)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
