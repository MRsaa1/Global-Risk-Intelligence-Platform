/**
 * Stress Test View - Climate Scenario Visualization
 * 
 * Scene-first approach:
 * - Terrain with heat/flood overlay
 * - Light represents intensity
 * - Timeline shows progression
 * - Data as visual effect, not numbers
 */
import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

// Generate terrain heightmap
function Terrain() {
  const meshRef = useRef<THREE.Mesh>(null)
  
  const { geometry, colors } = useMemo(() => {
    const size = 64
    const geo = new THREE.PlaneGeometry(10, 10, size - 1, size - 1)
    const positions = geo.attributes.position.array as Float32Array
    const colorArray = new Float32Array(positions.length)
    
    // Simple noise function
    const noise = (x: number, y: number) => {
      return Math.sin(x * 0.5) * Math.cos(y * 0.5) * 0.5 +
             Math.sin(x * 1.5) * Math.cos(y * 1.2) * 0.25 +
             Math.sin(x * 3) * Math.cos(y * 2.5) * 0.1
    }
    
    for (let i = 0; i < positions.length / 3; i++) {
      const x = positions[i * 3]
      const y = positions[i * 3 + 1]
      
      // Height
      const height = noise(x, y) * 0.8
      positions[i * 3 + 2] = height
      
      // Color based on height and risk
      const t = (height + 0.5) / 1.5
      
      // Simulate flood risk in lower areas
      if (height < -0.1) {
        // Blue for flood risk
        colorArray[i * 3] = 0.1
        colorArray[i * 3 + 1] = 0.4 + Math.abs(height) * 0.5
        colorArray[i * 3 + 2] = 0.8
      } else if (height < 0.2) {
        // Yellow/orange for medium risk
        colorArray[i * 3] = 0.9
        colorArray[i * 3 + 1] = 0.6 - height * 0.5
        colorArray[i * 3 + 2] = 0.1
      } else {
        // Green for safe
        colorArray[i * 3] = 0.2
        colorArray[i * 3 + 1] = 0.6 + height * 0.3
        colorArray[i * 3 + 2] = 0.3
      }
    }
    
    geo.setAttribute('color', new THREE.BufferAttribute(colorArray, 3))
    geo.computeVertexNormals()
    
    return { geometry: geo, colors: colorArray }
  }, [])
  
  // Animate colors to simulate scenario progression
  useFrame(({ clock }) => {
    if (!meshRef.current) return
    
    const colors = meshRef.current.geometry.attributes.color.array as Float32Array
    const positions = meshRef.current.geometry.attributes.position.array as Float32Array
    const time = clock.elapsedTime * 0.2
    
    for (let i = 0; i < positions.length / 3; i++) {
      const height = positions[i * 3 + 2]
      const wave = Math.sin(time + positions[i * 3] * 0.5 + positions[i * 3 + 1] * 0.5) * 0.5 + 0.5
      
      // Rising flood simulation
      const floodLevel = Math.sin(time * 0.5) * 0.2
      
      if (height < floodLevel) {
        colors[i * 3] = 0.1
        colors[i * 3 + 1] = 0.3 + wave * 0.3
        colors[i * 3 + 2] = 0.7 + wave * 0.3
      }
    }
    
    meshRef.current.geometry.attributes.color.needsUpdate = true
  })
  
  return (
    <mesh 
      ref={meshRef} 
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      position={[0, -0.5, 0]}
    >
      <meshStandardMaterial 
        vertexColors
        metalness={0.1}
        roughness={0.8}
      />
    </mesh>
  )
}

// Asset markers on terrain
function AssetMarkers() {
  const assets = [
    { x: 1, z: 1, risk: 0.8, name: 'Facility A' },
    { x: -2, z: 0.5, risk: 0.3, name: 'Facility B' },
    { x: 0, z: -1.5, risk: 0.9, name: 'Facility C' },
    { x: 2.5, z: -0.5, risk: 0.5, name: 'Facility D' },
  ]
  
  const groupRef = useRef<THREE.Group>(null)
  
  useFrame(({ clock }) => {
    if (!groupRef.current) return
    
    groupRef.current.children.forEach((child, i) => {
      const pulse = Math.sin(clock.elapsedTime * 3 + i) * 0.1 + 1
      child.scale.setScalar(pulse)
    })
  })
  
  return (
    <group ref={groupRef}>
      {assets.map((asset, i) => {
        const color = asset.risk > 0.7 
          ? '#ff3333' 
          : asset.risk > 0.5 
            ? '#ffaa33' 
            : '#33ff66'
        
        return (
          <group key={i} position={[asset.x, 0.1, asset.z]}>
            <mesh>
              <cylinderGeometry args={[0.15, 0.2, 0.3, 16]} />
              <meshStandardMaterial 
                color={color}
                emissive={color}
                emissiveIntensity={0.5}
              />
            </mesh>
            {/* Glow ring */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
              <ringGeometry args={[0.2, 0.4, 32]} />
              <meshBasicMaterial 
                color={color}
                transparent
                opacity={0.3}
              />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

// Scene
function Scene() {
  return (
    <>
      {/* Main light */}
      <directionalLight position={[5, 10, 5]} intensity={1} color="#ffffff" />
      
      {/* Accent lights */}
      <directionalLight position={[-5, 5, -5]} intensity={0.3} color="#aaddff" />
      
      <ambientLight intensity={0.2} />
      
      <Terrain />
      <AssetMarkers />
      
      <OrbitControls 
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.3}
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 3}
      />
    </>
  )
}

// Overlay
function Overlay() {
  return (
    <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
      <div>
        <h2 className="text-sm font-medium text-cyan-400/80">Stress Testing</h2>
        <p className="text-xs text-white/40 mt-0.5">Climate Scenario: RCP 8.5</p>
      </div>
      
      <div className="space-y-2">
        <div className="flex gap-3 text-[10px]">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-white/60">Flood Zone</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-white/60">Heat Risk</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-white/60">Safe</span>
          </div>
        </div>
        
        {/* Timeline */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-white/40">T0</span>
          <div className="flex-1 h-0.5 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full w-1/3 bg-gradient-to-r from-cyan-500 to-orange-500 animate-pulse" />
          </div>
          <span className="text-[10px] text-white/40">2050</span>
        </div>
      </div>
    </div>
  )
}

export default function StressTestView() {
  return (
    <div className="relative w-full h-full bg-gradient-to-br from-[#030810] to-[#0a1525]">
      <Canvas 
        camera={{ position: [5, 4, 5], fov: 40 }}
        gl={{ antialias: true }}
      >
        <Scene />
      </Canvas>
      <Overlay />
    </div>
  )
}
