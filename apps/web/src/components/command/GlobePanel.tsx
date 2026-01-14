/**
 * Globe Panel - REALISTIC Earth globe with night lights
 * 
 * Features:
 * - Realistic Earth texture
 * - City lights on night side
 * - Fire/risk hotspots
 * - Timeline controls
 */
import { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

interface GlobePanelProps {
  data: {
    globalExposure: number
    atRisk: number
    highRisk: number
    activeScenarios: number
  }
  tabs: { id: string; label: string }[]
  activeTab: string
  onTabChange: (tab: string) => void
  timelineValue: number
  onTimelineChange: (value: number) => void
}

// Realistic Earth with textures
function RealisticEarth() {
  const meshRef = useRef<THREE.Mesh>(null)
  const cloudsRef = useRef<THREE.Mesh>(null)
  const lightsRef = useRef<THREE.Mesh>(null)
  
  // Create procedural Earth texture
  const earthTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 2048
    canvas.height = 1024
    const ctx = canvas.getContext('2d')!
    
    // Ocean base - dark blue
    const oceanGradient = ctx.createLinearGradient(0, 0, 0, 1024)
    oceanGradient.addColorStop(0, '#0a1628')
    oceanGradient.addColorStop(0.3, '#0f2847')
    oceanGradient.addColorStop(0.7, '#0f2847')
    oceanGradient.addColorStop(1, '#0a1628')
    ctx.fillStyle = oceanGradient
    ctx.fillRect(0, 0, 2048, 1024)
    
    // Continents - dark land masses
    ctx.fillStyle = '#1a2f1a'
    
    // Europe/Africa
    ctx.beginPath()
    ctx.ellipse(1100, 400, 150, 200, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(1100, 600, 120, 180, 0.2, 0, Math.PI * 2)
    ctx.fill()
    
    // Asia
    ctx.beginPath()
    ctx.ellipse(1400, 350, 250, 150, 0, 0, Math.PI * 2)
    ctx.fill()
    
    // Americas
    ctx.beginPath()
    ctx.ellipse(500, 350, 100, 200, -0.3, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(550, 600, 80, 150, 0.2, 0, Math.PI * 2)
    ctx.fill()
    
    // Australia
    ctx.beginPath()
    ctx.ellipse(1600, 650, 80, 60, 0, 0, Math.PI * 2)
    ctx.fill()
    
    return new THREE.CanvasTexture(canvas)
  }, [])

  // Night lights texture
  const lightsTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 2048
    canvas.height = 1024
    const ctx = canvas.getContext('2d')!
    
    // Black base
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, 2048, 1024)
    
    // City lights - orange/yellow dots
    const cities = [
      // Europe
      { x: 1050, y: 350, size: 12, intensity: 1 }, // London
      { x: 1080, y: 370, size: 15, intensity: 1 }, // Paris
      { x: 1120, y: 340, size: 10, intensity: 0.9 }, // Berlin
      { x: 1100, y: 400, size: 8, intensity: 0.8 }, // Madrid
      { x: 1150, y: 390, size: 10, intensity: 0.9 }, // Rome
      { x: 1130, y: 330, size: 8, intensity: 0.7 }, // Amsterdam
      // Middle East
      { x: 1250, y: 420, size: 8, intensity: 0.8 },
      { x: 1280, y: 400, size: 6, intensity: 0.7 },
      // Asia
      { x: 1450, y: 380, size: 12, intensity: 1 }, // Delhi
      { x: 1550, y: 400, size: 15, intensity: 1 }, // Shanghai
      { x: 1600, y: 380, size: 18, intensity: 1 }, // Tokyo
      { x: 1480, y: 440, size: 10, intensity: 0.9 }, // Mumbai
      // Americas
      { x: 450, y: 360, size: 15, intensity: 1 }, // NYC
      { x: 380, y: 380, size: 12, intensity: 0.9 }, // Chicago
      { x: 350, y: 420, size: 10, intensity: 0.8 }, // LA
      { x: 550, y: 580, size: 12, intensity: 0.9 }, // Sao Paulo
      // Africa
      { x: 1100, y: 520, size: 8, intensity: 0.7 },
      { x: 1150, y: 600, size: 6, intensity: 0.6 },
    ]
    
    cities.forEach(city => {
      const gradient = ctx.createRadialGradient(city.x, city.y, 0, city.x, city.y, city.size * 2)
      gradient.addColorStop(0, `rgba(255, 180, 50, ${city.intensity})`)
      gradient.addColorStop(0.3, `rgba(255, 120, 30, ${city.intensity * 0.6})`)
      gradient.addColorStop(1, 'rgba(255, 80, 20, 0)')
      ctx.fillStyle = gradient
      ctx.fillRect(city.x - city.size * 2, city.y - city.size * 2, city.size * 4, city.size * 4)
    })
    
    // Add random smaller lights
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * 2048
      const y = 200 + Math.random() * 600
      const size = 1 + Math.random() * 2
      ctx.fillStyle = `rgba(255, ${150 + Math.random() * 100}, 50, ${0.3 + Math.random() * 0.5})`
      ctx.beginPath()
      ctx.arc(x, y, size, 0, Math.PI * 2)
      ctx.fill()
    }
    
    return new THREE.CanvasTexture(canvas)
  }, [])

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.001
    }
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y += 0.0012
    }
    if (lightsRef.current) {
      lightsRef.current.rotation.y += 0.001
    }
  })

  return (
    <group>
      {/* Main Earth sphere */}
      <mesh ref={meshRef}>
        <sphereGeometry args={[2, 64, 64]} />
        <meshStandardMaterial 
          map={earthTexture}
          metalness={0.1}
          roughness={0.8}
        />
      </mesh>
      
      {/* Night lights layer */}
      <mesh ref={lightsRef} scale={1.002}>
        <sphereGeometry args={[2, 64, 64]} />
        <meshBasicMaterial 
          map={lightsTexture}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
      
      {/* Atmosphere glow */}
      <mesh scale={1.15}>
        <sphereGeometry args={[2, 32, 32]} />
        <meshBasicMaterial 
          color="#4a9eff"
          transparent
          opacity={0.08}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Risk hotspots - fire points */}
      <RiskHotspots />
    </group>
  )
}

// Animated fire hotspots
function RiskHotspots() {
  const groupRef = useRef<THREE.Group>(null)
  const [phase, setPhase] = useState(0)
  
  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += 0.001
    }
    setPhase(state.clock.elapsedTime)
  })

  const latLonToXYZ = (lat: number, lon: number, radius: number) => {
    const phi = (90 - lat) * (Math.PI / 180)
    const theta = (lon + 180) * (Math.PI / 180)
    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    )
  }

  // Fire hotspots matching reference
  const hotspots = [
    { lat: 48.8, lon: 2.3, size: 0.08 },   // Paris
    { lat: 51.5, lon: -0.1, size: 0.07 },  // London
    { lat: 52.5, lon: 13.4, size: 0.09 },  // Berlin
    { lat: 48.1, lon: 11.6, size: 0.08 },  // Munich
    { lat: 52.4, lon: 4.9, size: 0.06 },   // Amsterdam
    { lat: 50.1, lon: 14.4, size: 0.05 },  // Prague
    { lat: 41.9, lon: 12.5, size: 0.06 },  // Rome
    { lat: 40.4, lon: -3.7, size: 0.05 },  // Madrid
    { lat: 45.5, lon: 9.2, size: 0.07 },   // Milan
    { lat: 59.3, lon: 18.1, size: 0.04 },  // Stockholm
  ]

  return (
    <group ref={groupRef}>
      {hotspots.map((spot, i) => {
        const pos = latLonToXYZ(spot.lat, spot.lon, 2.03)
        const pulse = 1 + Math.sin(phase * 3 + i) * 0.3
        return (
          <group key={i} position={pos}>
            {/* Core */}
            <mesh scale={pulse}>
              <sphereGeometry args={[spot.size * 0.5, 8, 8]} />
              <meshBasicMaterial color="#ff4400" />
            </mesh>
            {/* Glow */}
            <mesh scale={pulse * 1.5}>
              <sphereGeometry args={[spot.size, 8, 8]} />
              <meshBasicMaterial color="#ff6600" transparent opacity={0.4} />
            </mesh>
            {/* Outer glow */}
            <mesh scale={pulse * 2}>
              <sphereGeometry args={[spot.size, 8, 8]} />
              <meshBasicMaterial color="#ff8800" transparent opacity={0.15} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}

// Scene with proper lighting
function Scene() {
  const { camera } = useThree()
  
  useEffect(() => {
    camera.position.set(3, 1.5, 4)
  }, [camera])
  
  return (
    <>
      <ambientLight intensity={0.15} />
      <directionalLight position={[5, 3, 5]} intensity={1.2} color="#ffffff" />
      <directionalLight position={[-5, 0, -5]} intensity={0.1} color="#4a9eff" />
      <RealisticEarth />
      <OrbitControls 
        enableZoom={false}
        enablePan={false}
        autoRotate={false}
        minPolarAngle={Math.PI / 3}
        maxPolarAngle={Math.PI / 1.8}
      />
      
      {/* Stars background */}
      <Stars />
    </>
  )
}

// Star field background
function Stars() {
  const starsRef = useRef<THREE.Points>(null)
  
  const [positions] = useMemo(() => {
    const count = 2000
    const pos = new Float32Array(count * 3)
    for (let i = 0; i < count * 3; i += 3) {
      const r = 50 + Math.random() * 50
      const theta = Math.random() * Math.PI * 2
      const phi = Math.random() * Math.PI
      pos[i] = r * Math.sin(phi) * Math.cos(theta)
      pos[i + 1] = r * Math.sin(phi) * Math.sin(theta)
      pos[i + 2] = r * Math.cos(phi)
    }
    return [pos]
  }, [])

  return (
    <points ref={starsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.1} color="#ffffff" transparent opacity={0.6} sizeAttenuation />
    </points>
  )
}

export default function GlobePanel({
  data,
  tabs,
  activeTab,
  onTabChange,
  timelineValue,
  onTimelineChange,
}: GlobePanelProps) {
  const timelineLabels = ['T0', 'T+1Y', 'T+3Y', 'T+5Y']

  return (
    <div className="h-full flex flex-col relative bg-[#000510]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1a2535] bg-[#0a0f18]/80 backdrop-blur-sm z-20">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-cyan-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.559-.5-.948-.737-1.182C10.232 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-2.003 2H8.032c.093 1.414.377 2.649.766 3.556.24.559.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556zm1.166 4.118c.454-1.147.748-2.572.837-4.118h1.946a6.004 6.004 0 01-2.783 4.118zm-6.268 0C6.412 13.97 6.118 12.546 6.03 11H4.083a6.004 6.004 0 002.783 4.118z" clipRule="evenodd" />
          </svg>
          <span className="text-white font-medium text-sm">Global Risk Command Center</span>
        </div>
        
        <div className="flex gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              className={`px-3 py-1 text-xs rounded transition-all ${
                activeTab === tab.id
                  ? 'bg-[#1a2a3a] text-cyan-400'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats overlay */}
      <div className="absolute top-14 left-4 z-10 space-y-1.5">
        <StatCard label="Global Exposure:" value={`$${data.globalExposure}B`} />
        <StatCard label="At Risk :" value={data.atRisk.toString() + "B"} valueColor="text-amber-500" />
        <StatCard label="High Risk" value={data.highRisk.toString() + "B"} valueColor="text-red-500" />
        <StatCard label="Stress Scenarios:" value={`${data.activeScenarios} Active`} />
      </div>

      {/* 3D Globe */}
      <div className="flex-1">
        <Canvas>
          <Scene />
        </Canvas>
      </div>

      {/* Timeline */}
      <div className="px-4 py-2.5 border-t border-[#1a2535] bg-[#0a0f18]/80 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            {timelineLabels.map((label, index) => (
              <button
                key={label}
                onClick={() => onTimelineChange(index)}
                className={`px-3 py-1 text-xs rounded border transition-all ${
                  timelineValue === index
                    ? 'bg-[#1a2a3a] border-cyan-500/40 text-cyan-400'
                    : 'border-[#1a2535] text-gray-500 hover:text-white'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          
          <div className="flex-1 relative h-1 bg-[#1a2535] rounded-full mx-2">
            <div 
              className="absolute h-full bg-gradient-to-r from-cyan-500 via-amber-500 to-red-500 rounded-full"
              style={{ width: `${(timelineValue / 3) * 100}%` }}
            />
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                onClick={() => onTimelineChange(i)}
                className={`absolute top-1/2 w-2.5 h-2.5 rounded-full cursor-pointer -translate-y-1/2 border-2 ${
                  i <= timelineValue 
                    ? 'bg-cyan-500 border-cyan-300' 
                    : 'bg-[#1a2535] border-[#2a3545]'
                } ${i === timelineValue ? 'w-3 h-3 bg-red-500 border-red-400' : ''}`}
                style={{ left: `${(i / 3) * 100}%`, transform: 'translate(-50%, -50%)' }}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value, valueColor = 'text-white' }: { label: string; value: string; valueColor?: string }) {
  return (
    <div className="bg-[#0a0f18]/90 backdrop-blur-sm px-3 py-1.5 rounded border border-[#1a2535]/50">
      <div className="text-gray-500 text-[10px]">{label}</div>
      <div className={`font-bold text-base ${valueColor}`}>{value}</div>
    </div>
  )
}
