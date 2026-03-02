/**
 * Globe View - 3D Earth with Risk Hotspots
 * 
 * Scene-first approach:
 * - Earth as physical object in space
 * - Lighting creates meaning (risks = warm glow)
 * - City lights show economic activity
 * - Hotspots pulse with risk intensity
 */
import { useRef, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Sphere, Stars } from '@react-three/drei'
import * as THREE from 'three'

// Risk hotspots data
const HOTSPOTS = [
  { lat: 35.6762, lng: 139.6503, risk: 0.9, name: 'Tokyo', value: 45.2 },
  { lat: 22.3193, lng: 114.1694, risk: 0.7, name: 'Hong Kong', value: 32.1 },
  { lat: 51.5074, lng: -0.1278, risk: 0.5, name: 'London', value: 28.4 },
  { lat: 40.7128, lng: -74.006, risk: 0.8, name: 'New York', value: 52.3 },
  { lat: 37.7749, lng: -122.4194, risk: 0.6, name: 'San Francisco', value: 18.9 },
  { lat: 1.3521, lng: 103.8198, risk: 0.4, name: 'Singapore', value: 15.6 },
  { lat: -33.8688, lng: 151.2093, risk: 0.3, name: 'Sydney', value: 12.8 },
  { lat: 25.2048, lng: 55.2708, risk: 0.5, name: 'Dubai', value: 22.1 },
  { lat: 55.7558, lng: 37.6173, risk: 0.7, name: 'Moscow', value: 19.4 },
  { lat: 31.2304, lng: 121.4737, risk: 0.85, name: 'Shanghai', value: 67.8 },
]

// Convert lat/lng to 3D position on sphere
function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  )
}

// City lights as instanced mesh for performance
function CityLights() {
  const meshRef = useRef<THREE.InstancedMesh>(null)
  
  // Generate ~2000 city positions based on real population centers
  const positions = useMemo(() => {
    const cities: THREE.Vector3[] = []
    
    // Dense clusters for major regions
    const regions = [
      // East Asia
      { lat: 35, lng: 135, spread: 15, count: 400 },
      // Europe
      { lat: 50, lng: 10, spread: 20, count: 350 },
      // North America East
      { lat: 40, lng: -75, spread: 10, count: 200 },
      // North America West
      { lat: 35, lng: -118, spread: 8, count: 150 },
      // South Asia
      { lat: 20, lng: 78, spread: 15, count: 300 },
      // Southeast Asia
      { lat: 5, lng: 110, spread: 15, count: 200 },
      // Middle East
      { lat: 30, lng: 45, spread: 15, count: 100 },
      // South America
      { lat: -23, lng: -46, spread: 10, count: 150 },
      // Australia
      { lat: -33, lng: 151, spread: 5, count: 80 },
      // Africa
      { lat: -1, lng: 36, spread: 20, count: 70 },
    ]
    
    regions.forEach(region => {
      for (let i = 0; i < region.count; i++) {
        const lat = region.lat + (Math.random() - 0.5) * region.spread * 2
        const lng = region.lng + (Math.random() - 0.5) * region.spread * 2
        cities.push(latLngToVector3(lat, lng, 2.02))
      }
    })
    
    return cities
  }, [])
  
  // Set up instanced positions
  useMemo(() => {
    if (!meshRef.current) return
    
    const dummy = new THREE.Object3D()
    const color = new THREE.Color()
    
    positions.forEach((pos, i) => {
      dummy.position.copy(pos)
      dummy.scale.setScalar(0.003 + Math.random() * 0.005)
      dummy.updateMatrix()
      meshRef.current!.setMatrixAt(i, dummy.matrix)
      
      // Warm golden color for city lights
      color.setHSL(0.12, 0.8, 0.5 + Math.random() * 0.3)
      meshRef.current!.setColorAt(i, color)
    })
    
    meshRef.current.instanceMatrix.needsUpdate = true
    if (meshRef.current.instanceColor) {
      meshRef.current.instanceColor.needsUpdate = true
    }
  }, [positions])
  
  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, positions.length]}>
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial transparent opacity={0.9} />
    </instancedMesh>
  )
}

// Risk hotspots with pulsing glow
function Hotspots() {
  const groupRef = useRef<THREE.Group>(null)
  
  useFrame(({ clock }) => {
    if (!groupRef.current) return
    
    groupRef.current.children.forEach((child, i) => {
      const pulse = Math.sin(clock.elapsedTime * 2 + i) * 0.3 + 1
      child.scale.setScalar(pulse)
    })
  })
  
  return (
    <group ref={groupRef}>
      {HOTSPOTS.map((spot, i) => {
        const pos = latLngToVector3(spot.lat, spot.lng, 2.05)
        const color = spot.risk > 0.7 
          ? new THREE.Color(0xff3333) 
          : spot.risk > 0.5 
            ? new THREE.Color(0xff9933) 
            : new THREE.Color(0x33ff66)
        
        return (
          <mesh key={i} position={pos}>
            <sphereGeometry args={[0.02 + spot.risk * 0.03, 16, 16]} />
            <meshBasicMaterial 
              color={color} 
              transparent 
              opacity={0.8}
            />
            {/* Outer glow */}
            <mesh>
              <sphereGeometry args={[0.05 + spot.risk * 0.05, 16, 16]} />
              <meshBasicMaterial 
                color={color} 
                transparent 
                opacity={0.2}
              />
            </mesh>
          </mesh>
        )
      })}
    </group>
  )
}

// Earth with atmosphere
function Earth() {
  const earthRef = useRef<THREE.Mesh>(null)
  
  useFrame(() => {
    if (earthRef.current) {
      earthRef.current.rotation.y += 0.0003
    }
  })
  
  return (
    <group>
      {/* Earth sphere */}
      <Sphere ref={earthRef} args={[2, 64, 64]}>
        <meshPhongMaterial
          color="#1a3a5c"
          emissive="#0a1a2c"
          emissiveIntensity={0.2}
          shininess={5}
        />
        <CityLights />
        <Hotspots />
      </Sphere>
      
      {/* Atmosphere glow */}
      <Sphere args={[2.1, 64, 64]}>
        <meshBasicMaterial
          color="#00aaff"
          transparent
          opacity={0.1}
          side={THREE.BackSide}
        />
      </Sphere>
      
      {/* Outer rim glow */}
      <Sphere args={[2.2, 64, 64]}>
        <meshBasicMaterial
          color="#0066aa"
          transparent
          opacity={0.05}
          side={THREE.BackSide}
        />
      </Sphere>
    </group>
  )
}

// Main scene with lighting
function Scene() {
  const { camera } = useThree()
  
  useFrame(() => {
    camera.lookAt(0, 0, 0)
  })
  
  return (
    <>
      {/* Key light - warm from top right */}
      <pointLight position={[5, 3, 5]} intensity={0.6} color="#ffddaa" />
      
      {/* Rim light - cool from behind */}
      <pointLight position={[-5, 2, -5]} intensity={0.4} color="#aaddff" />
      
      {/* Fill light */}
      <ambientLight intensity={0.1} />
      
      <Earth />
      
      <Stars 
        radius={50} 
        depth={50} 
        count={3000} 
        factor={3} 
        saturation={0} 
        fade 
        speed={0.5} 
      />
    </>
  )
}

// UI Overlay
function Overlay() {
  return (
    <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
      {/* Title */}
      <div className="pointer-events-auto">
        <h2 className="text-sm font-medium text-amber-400/80">Global View</h2>
        <p className="text-xs text-white/40 mt-0.5">Real-time risk monitoring</p>
      </div>
      
      {/* Stats */}
      <div className="space-y-2">
        <div>
          <p className="text-[10px] text-white/40 uppercase tracking-wider">Total Exposure</p>
          <p className="text-xl font-light text-white">$482.3B</p>
        </div>
        <div className="flex gap-4">
          <div>
            <p className="text-[10px] text-white/40">At Risk</p>
            <p className="text-sm text-orange-400">$67.5B</p>
          </div>
          <div>
            <p className="text-[10px] text-white/40">Critical</p>
            <p className="text-sm text-red-400">$14.8B</p>
          </div>
        </div>
      </div>
    </div>
  )
}

interface GlobeViewProps {
  timelineValue?: number
  onTimelineChange?: (value: number) => void
}

export default function GlobeView({ timelineValue, onTimelineChange }: GlobeViewProps) {
  return (
    <div className="relative w-full h-full bg-gradient-to-br from-zinc-950 to-zinc-950">
      <Canvas 
        camera={{ position: [0, 0, 5], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
      >
        <Scene />
      </Canvas>
      <Overlay />
    </div>
  )
}
