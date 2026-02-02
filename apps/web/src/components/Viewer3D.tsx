import { Suspense, useRef, useState, useEffect, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import {
  OrbitControls,
  Box,
  Environment,
  PerspectiveCamera,
  Grid,
  Html,
  Float,
  useGLTF,
} from '@react-three/drei'
import * as THREE from 'three'
import { motion } from 'framer-motion'
import AnnotationMarker from './scene/AnnotationMarker'

interface Viewer3DProps {
  modelUrl?: string
  assetType?: string
  riskScores?: {
    climate: number
    physical: number
    network: number
  }
  showRiskOverlay?: boolean
  /** When no GLB/BIM: use these for a more realistic procedural building */
  floorsAboveGround?: number
  grossFloorAreaM2?: number
  onObjectSelect?: (objectId: string) => void
  vr?: boolean
  onCameraUpdate?: (position: { x: number; y: number; z: number }) => void
  onWorldClick?: (point: { x: number; y: number; z: number }) => void
  annotations?: Array<{ id: string; text: string; position: { x: number; y: number; z: number } }>
  peers?: Array<{ id: string; position?: { x: number; y: number; z: number }; focus_asset_id?: string | null }>
}

// Risk color helper
function getRiskColor(score: number): string {
  if (score >= 70) return '#ef4444' // red
  if (score >= 40) return '#f59e0b' // amber
  return '#22c55e' // green
}

// Building component with risk visualization (scales by floors and area when provided)
function Building({
  riskScores = { climate: 30, physical: 20, network: 50 },
  showRiskOverlay = false,
  floorsAboveGround,
  grossFloorAreaM2,
  onObjectSelect,
  onWorldClick,
}: {
  riskScores?: { climate: number; physical: number; network: number }
  showRiskOverlay?: boolean
  floorsAboveGround?: number
  grossFloorAreaM2?: number
  onObjectSelect?: (objectId: string) => void
  onWorldClick?: (point: { x: number; y: number; z: number }) => void
}) {
  const buildingRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState<string | null>(null)
  
  useFrame((state) => {
    if (buildingRef.current && !hovered) {
      buildingRef.current.rotation.y = Math.sin(state.clock.elapsedTime * 0.1) * 0.05
    }
  })
  
  const floors = Math.max(1, Math.min(50, floorsAboveGround ?? 12))
  const floorHeight = 0.35
  // Base footprint from area: ~sqrt(area/1000) in scene units (1 unit ≈ 10m), clamp for visibility
  const baseSize = grossFloorAreaM2 != null && grossFloorAreaM2 > 0
    ? Math.sqrt(grossFloorAreaM2 / 1000) * 0.5
    : 1
  const buildingWidth = Math.max(1.5, Math.min(6, baseSize * 2))
  const buildingDepth = Math.max(1, Math.min(5, baseSize * 1.5))
  
  // Calculate composite risk for building color
  const compositeRisk = (riskScores.climate + riskScores.physical + riskScores.network) / 3
  const buildingColor = showRiskOverlay ? getRiskColor(compositeRisk) : '#0056e6'
  
  return (
    <group
      ref={buildingRef}
      onPointerDown={(e) => {
        e.stopPropagation()
        const objectId = (e.object as any)?.name || 'building'
        if ((e as any).shiftKey) {
          onWorldClick?.({ x: e.point.x, y: e.point.y, z: e.point.z })
        } else {
          onObjectSelect?.(objectId)
        }
      }}
    >
      {/* Foundation */}
      <Box
        args={[buildingWidth + 1, 0.2, buildingDepth + 1]}
        position={[0, -0.1, 0]}
        name="foundation"
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
              name={`floor-${i}`}
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
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.01, 0]}
        receiveShadow
      >
        <planeGeometry args={[100, 100]} />
        <meshStandardMaterial color="#0a0f1a" transparent opacity={0.8} />
      </mesh>
    </group>
  )
}

// Camera controls + telemetry
function CameraController({
  onCameraUpdate,
}: {
  onCameraUpdate?: (position: { x: number; y: number; z: number }) => void
}) {
  const { camera } = useThree()
  const lastSentRef = useRef<{ t: number; x: number; y: number; z: number }>({ t: 0, x: 0, y: 0, z: 0 })
  
  useEffect(() => {
    camera.position.set(8, 6, 8)
    camera.lookAt(0, 2, 0)
  }, [camera])

  useFrame(() => {
    if (!onCameraUpdate) return
    const now = performance.now()
    const last = lastSentRef.current
    if (now - last.t < 250) return
    const { x, y, z } = camera.position
    const dx = x - last.x
    const dy = y - last.y
    const dz = z - last.z
    const dist2 = dx * dx + dy * dy + dz * dz
    if (dist2 < 0.01) return
    lastSentRef.current = { t: now, x, y, z }
    onCameraUpdate({ x, y, z })
  })
  
  return null
}

function PeerMarker({
  id,
  position,
}: {
  id: string
  position: { x: number; y: number; z: number }
}) {
  return (
    <group position={[position.x, position.y, position.z]}>
      <mesh>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshStandardMaterial color="#22c55e" emissive="#22c55e" emissiveIntensity={0.6} />
      </mesh>
      <Html position={[0, 0.25, 0]} center>
        <div className="px-2 py-0.5 rounded bg-black/70 border border-white/10 text-[10px] text-white/70">
          peer:{id}
        </div>
      </Html>
    </group>
  )
}

function GltfModel({
  url,
  onObjectSelect,
  onWorldClick,
}: {
  url: string
  onObjectSelect?: (objectId: string) => void
  onWorldClick?: (point: { x: number; y: number; z: number }) => void
}) {
  const gltf = useGLTF(url)
  const ref = useRef<THREE.Group>(null)

  useEffect(() => {
    // Defensive: some GLB/GLTF assets can contain invalid index buffers that trigger
    // WebGL errors like "Vertex buffer is not big enough for the draw call".
    // We disable only the broken meshes to keep the scene usable.
    const scene = gltf?.scene
    if (!scene) return

    let disabled = 0
    scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (!mesh || !(mesh as any).isMesh) return
      const geom = mesh.geometry as THREE.BufferGeometry | undefined
      if (!geom) return

      const pos = geom.getAttribute('position') as THREE.BufferAttribute | undefined
      const idx = geom.getIndex()
      if (!pos || !idx) return

      // Find max index (fast path for typed arrays)
      const arr = idx.array as ArrayLike<number>
      let max = -1
      for (let i = 0; i < arr.length; i++) {
        const v = Number(arr[i])
        if (v > max) max = v
      }

      if (max >= pos.count) {
        disabled += 1
        mesh.visible = false
      }
    })

    if (disabled > 0) {
      console.warn(`[Viewer3D] Disabled ${disabled} invalid mesh(es) in model: ${url}`)
    }
  }, [gltf, url])

  useEffect(() => {
    const g = ref.current
    if (!g) return
    // center the loaded scene near origin (best-effort)
    const box = new THREE.Box3().setFromObject(g)
    const center = box.getCenter(new THREE.Vector3())
    g.position.sub(center)
  }, [url])

  return (
    <group
      ref={ref}
      onPointerDown={(e) => {
        e.stopPropagation()
        const objectId = (e.object as any)?.name || (e.object as any)?.uuid || 'model'
        if ((e as any).shiftKey) {
          onWorldClick?.({ x: e.point.x, y: e.point.y, z: e.point.z })
        } else {
          onObjectSelect?.(String(objectId))
        }
      }}
    >
      <primitive object={gltf.scene} />
    </group>
  )
}

export default function Viewer3D({
  modelUrl,
  assetType = 'commercial_office',
  riskScores = { climate: 45, physical: 22, network: 68 },
  showRiskOverlay = true,
  floorsAboveGround,
  grossFloorAreaM2,
  onObjectSelect,
  vr = false,
  onCameraUpdate,
  onWorldClick,
  annotations = [],
  peers = [],
}: Viewer3DProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [gl, setGl] = useState<THREE.WebGLRenderer | null>(null)
  const [vrSession, setVrSession] = useState<any>(null)
  const [contextLost, setContextLost] = useState(false)

  const vrSupported = useMemo(() => {
    return typeof navigator !== 'undefined' && typeof (navigator as any).xr?.requestSession === 'function'
  }, [])
  
  useEffect(() => {
    // Simulate loading
    const timer = setTimeout(() => setIsLoading(false), 1000)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    return () => {
      try {
        vrSession?.end?.()
      } catch {
        // ignore
      }
    }
  }, [vrSession])

  useEffect(() => {
    if (!gl?.domElement) return
    const canvas = gl.domElement
    const onContextLost = () => setContextLost(true)
    const onContextRestored = () => setContextLost(false)
    canvas.addEventListener('webglcontextlost', onContextLost, false)
    canvas.addEventListener('webglcontextrestored', onContextRestored, false)
    return () => {
      canvas.removeEventListener('webglcontextlost', onContextLost)
      canvas.removeEventListener('webglcontextrestored', onContextRestored)
      // Explicitly dispose WebGL context to free up resources
      try {
        gl.dispose()
        gl.forceContextLoss()
      } catch {
        // Ignore disposal errors
      }
    }
  }, [gl])

  const startVr = async () => {
    if (!vr || !vrSupported || !gl) return
    const xr = (navigator as any).xr
    try {
      const session = await xr.requestSession('immersive-vr', {
        optionalFeatures: ['local-floor', 'bounded-floor', 'hand-tracking'],
      })
      gl.xr.enabled = true
      await gl.xr.setSession(session)
      setVrSession(session)
      session.addEventListener('end', () => {
        setVrSession(null)
      })
    } catch (e) {
      console.warn('Failed to start VR session', e)
    }
  }

  const stopVr = async () => {
    try {
      await vrSession?.end?.()
    } catch {
      // ignore
    }
  }
  
  return (
    <div className="relative w-full h-full bg-dark-bg rounded-xl overflow-hidden">
      {contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-dark-bg/95 z-30 rounded-xl">
          <div className="text-center px-6 py-4 rounded-xl bg-white/5 border border-white/10 text-sm text-white/90">
            <p className="font-medium mb-1">3D view unavailable</p>
            <p className="text-white/60">WebGL context was lost. Refresh the page to restore.</p>
          </div>
        </div>
      )}
      {isLoading && !contextLost && (
        <div className="absolute inset-0 flex items-center justify-center bg-dark-bg z-10">
          <motion.div
            className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500"
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
          />
        </div>
      )}

      {/* VR control (Phase 5.1-5.2) */}
      {vr && (
        <div className="absolute top-3 right-3 z-20 pointer-events-auto">
          {vrSupported ? (
            <button
              onClick={vrSession ? stopVr : startVr}
              className={`px-3 py-2 rounded-xl border text-xs font-medium backdrop-blur-md transition-colors ${
                vrSession
                  ? 'bg-red-500/20 border-red-500/30 text-red-200 hover:bg-red-500/30'
                  : 'bg-white/10 border-white/15 text-white/80 hover:bg-white/15'
              }`}
            >
              {vrSession ? 'Exit VR' : 'Enter VR'}
            </button>
          ) : (
            <div className="px-3 py-2 rounded-xl border bg-white/5 border-white/10 text-xs text-white/50">
              VR not supported
            </div>
          )}
        </div>
      )}
      
      <Canvas
        shadows
        onCreated={({ gl: createdGl }) => {
          setGl(createdGl)
          setContextLost(false)
          if (vr) createdGl.xr.enabled = true
        }}
      >
        <CameraController onCameraUpdate={onCameraUpdate} />
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
        {modelUrl ? (
          <Suspense fallback={null}>
            <GltfModel url={modelUrl} onObjectSelect={onObjectSelect} onWorldClick={onWorldClick} />
          </Suspense>
        ) : (
          <Float speed={1} rotationIntensity={0.1} floatIntensity={0.1}>
            <Building
              riskScores={riskScores}
              showRiskOverlay={showRiskOverlay}
              floorsAboveGround={floorsAboveGround}
              grossFloorAreaM2={grossFloorAreaM2}
              onObjectSelect={onObjectSelect}
              onWorldClick={onWorldClick}
            />
          </Float>
        )}
        
        <Ground />

        {/* Shift+Click on ground to add annotation */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, -0.01, 0]}
          onPointerDown={(e) => {
            e.stopPropagation()
            if (!(e as any).shiftKey) return
            onWorldClick?.({ x: e.point.x, y: e.point.y, z: e.point.z })
          }}
        >
          <planeGeometry args={[100, 100]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>

        {/* Collaboration overlays */}
        {annotations.map((a) => (
          <AnnotationMarker
            key={a.id}
            text={a.text}
            position={[a.position.x, a.position.y, a.position.z]}
          />
        ))}
        {peers
          .filter((p) => p.position && typeof p.position.x === 'number')
          .map((p) => (
            <PeerMarker key={p.id} id={p.id} position={p.position as any} />
          ))}
        
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
          <span>⇧ Shift+click to annotate</span>
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
