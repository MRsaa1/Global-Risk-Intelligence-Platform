/**
 * Stress Test Panel - REALISTIC view of Europe from space with fire hotspots
 * 
 * Matches reference:
 * - Satellite view of Europe at night
 * - Orange/red fire hotspots
 * - Scenario controls on left
 * - Results at bottom
 */
import { useState, useRef, useMemo } from 'react'
import { getApiBase } from '../../config/env'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'

interface StressTestPanelProps {
  data: {
    scenarios: { id: number; name: string; value: string; active: boolean }[]
    expectedLoss: number
    capitalImpact: number
  }
  /** When set, show "Play 4D Timeline" button; required for timeline playback */
  completedStressTestId?: string | null
  /** Called with CZML URL when user clicks "Play 4D Timeline" */
  onPlayTimeline?: (url: string) => void
}

// Europe from space - realistic satellite view
function EuropeFromSpace() {
  const meshRef = useRef<THREE.Mesh>(null)
  const hotspotsRef = useRef<THREE.Points>(null)
  const [phase, setPhase] = useState(0)
  
  // Europe texture
  const europeTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 768
    const ctx = canvas.getContext('2d')!
    
    // Dark ocean
    ctx.fillStyle = '#050a15'
    ctx.fillRect(0, 0, 1024, 768)
    
    // Land masses - dark green/brown
    ctx.fillStyle = '#0a1510'
    
    // Scandinavia
    ctx.beginPath()
    ctx.moveTo(480, 50)
    ctx.lineTo(550, 80)
    ctx.lineTo(560, 200)
    ctx.lineTo(500, 250)
    ctx.lineTo(450, 180)
    ctx.closePath()
    ctx.fill()
    
    // UK/Ireland
    ctx.beginPath()
    ctx.ellipse(300, 250, 50, 80, -0.2, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(250, 280, 25, 40, 0, 0, Math.PI * 2)
    ctx.fill()
    
    // France
    ctx.beginPath()
    ctx.moveTo(350, 300)
    ctx.lineTo(450, 280)
    ctx.lineTo(470, 380)
    ctx.lineTo(380, 420)
    ctx.lineTo(320, 380)
    ctx.closePath()
    ctx.fill()
    
    // Iberia
    ctx.beginPath()
    ctx.moveTo(280, 420)
    ctx.lineTo(380, 400)
    ctx.lineTo(370, 520)
    ctx.lineTo(260, 520)
    ctx.closePath()
    ctx.fill()
    
    // Germany/Central Europe
    ctx.beginPath()
    ctx.moveTo(450, 250)
    ctx.lineTo(550, 240)
    ctx.lineTo(580, 340)
    ctx.lineTo(480, 360)
    ctx.closePath()
    ctx.fill()
    
    // Italy
    ctx.beginPath()
    ctx.moveTo(480, 380)
    ctx.lineTo(520, 360)
    ctx.lineTo(540, 520)
    ctx.lineTo(500, 530)
    ctx.closePath()
    ctx.fill()
    
    // Balkans
    ctx.beginPath()
    ctx.moveTo(550, 380)
    ctx.lineTo(650, 360)
    ctx.lineTo(680, 480)
    ctx.lineTo(580, 500)
    ctx.closePath()
    ctx.fill()
    
    // Eastern Europe
    ctx.beginPath()
    ctx.moveTo(580, 200)
    ctx.lineTo(750, 150)
    ctx.lineTo(800, 350)
    ctx.lineTo(650, 380)
    ctx.closePath()
    ctx.fill()
    
    // North Africa
    ctx.fillStyle = '#0c1208'
    ctx.beginPath()
    ctx.moveTo(300, 580)
    ctx.lineTo(750, 560)
    ctx.lineTo(780, 768)
    ctx.lineTo(250, 768)
    ctx.closePath()
    ctx.fill()
    
    return new THREE.CanvasTexture(canvas)
  }, [])

  // Fire hotspots
  const [positions, colors, sizes] = useMemo(() => {
    const count = 400
    const pos = new Float32Array(count * 3)
    const col = new Float32Array(count * 3)
    const siz = new Float32Array(count)
    
    // European cities as fire clusters
    const clusters = [
      { x: 0.3, y: 0.25, spread: 0.15, density: 40 }, // Western Europe
      { x: 0.5, y: 0.35, spread: 0.12, density: 50 }, // Central Europe
      { x: 0.35, y: 0.45, spread: 0.08, density: 25 }, // France
      { x: 0.55, y: 0.5, spread: 0.1, density: 30 }, // Italy
      { x: 0.7, y: 0.3, spread: 0.15, density: 35 }, // Eastern Europe
      { x: 0.48, y: 0.15, spread: 0.1, density: 20 }, // Scandinavia
    ]
    
    let idx = 0
    clusters.forEach(cluster => {
      for (let i = 0; i < cluster.density && idx < count; i++) {
        const x = (cluster.x + (Math.random() - 0.5) * cluster.spread) * 4 - 2
        const y = (cluster.y + (Math.random() - 0.5) * cluster.spread) * 3 - 1.5
        pos[idx * 3] = x
        pos[idx * 3 + 1] = y
        pos[idx * 3 + 2] = 0.01
        
        // Orange/red colors
        const intensity = 0.5 + Math.random() * 0.5
        col[idx * 3] = 1
        col[idx * 3 + 1] = 0.3 + Math.random() * 0.4
        col[idx * 3 + 2] = 0
        
        siz[idx] = 3 + Math.random() * 5
        idx++
      }
    })
    
    // Fill remaining with scattered points
    while (idx < count) {
      pos[idx * 3] = (Math.random() - 0.5) * 4
      pos[idx * 3 + 1] = (Math.random() - 0.5) * 3
      pos[idx * 3 + 2] = 0.01
      col[idx * 3] = 1
      col[idx * 3 + 1] = 0.4 + Math.random() * 0.3
      col[idx * 3 + 2] = 0
      siz[idx] = 1 + Math.random() * 3
      idx++
    }
    
    return [pos, col, siz]
  }, [])

  useFrame((state) => {
    setPhase(state.clock.elapsedTime)
    if (hotspotsRef.current) {
      // Animate hotspots
      const sizes = hotspotsRef.current.geometry.attributes.size.array as Float32Array
      for (let i = 0; i < sizes.length; i++) {
        sizes[i] = (2 + Math.random() * 4) * (1 + Math.sin(state.clock.elapsedTime * 3 + i) * 0.3)
      }
      hotspotsRef.current.geometry.attributes.size.needsUpdate = true
    }
  })

  return (
    <group>
      {/* Europe map */}
      <mesh ref={meshRef} rotation={[-0.3, 0, 0]} position={[0, -0.2, 0]}>
        <planeGeometry args={[5, 3.75]} />
        <meshBasicMaterial map={europeTexture} />
      </mesh>
      
      {/* Fire hotspots */}
      <points ref={hotspotsRef} rotation={[-0.3, 0, 0]} position={[0, -0.2, 0]}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[positions, 3]} />
          <bufferAttribute attach="attributes-color" args={[colors, 3]} />
          <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
        </bufferGeometry>
        <pointsMaterial
          vertexColors
          transparent
          opacity={0.9}
          sizeAttenuation
          blending={THREE.AdditiveBlending}
        />
      </points>
      
      {/* Atmosphere edge glow */}
      <mesh position={[0, 1.5, -0.5]}>
        <planeGeometry args={[6, 0.3]} />
        <meshBasicMaterial color="#2080ff" transparent opacity={0.15} />
      </mesh>
    </group>
  )
}


export default function StressTestPanel({ data, completedStressTestId, onPlayTimeline }: StressTestPanelProps) {
  const [scenarios, setScenarios] = useState(data.scenarios)
  const [sliderValue, setSliderValue] = useState(50)

  const toggleScenario = (id: number) => {
    setScenarios(prev =>
      prev.map(s => s.id === id ? { ...s, active: !s.active } : s)
    )
  }

  return (
    <div className="h-full flex flex-col bg-[#09090b]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#27272a]">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M7 2a1 1 0 00-.707 1.707L7 4.414v3.758a1 1 0 01-.293.707l-4 4C.817 14.769 2.156 18 4.828 18h10.343c2.673 0 4.012-3.231 2.122-5.121l-4-4A1 1 0 0113 8.172V4.414l.707-.707A1 1 0 0013 2H7zm2 6.172V4h2v4.172a3 3 0 00.879 2.12l1.027 1.028a4 4 0 00-2.171.102l-.47.156a4 4 0 01-2.53 0l-.563-.187a1.993 1.993 0 00-.114-.035l1.063-1.063A3 3 0 009 8.172z" clipRule="evenodd" />
          </svg>
          <span className="text-zinc-100 font-medium text-sm">Global Stress Testing</span>
        </div>
        <div className="flex gap-2">
          <button className="p-1 text-zinc-500 hover:text-zinc-100">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <button className="p-1 text-zinc-500 hover:text-zinc-100">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </button>
          <button className="p-1 text-zinc-500 hover:text-zinc-100">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex relative">
        {/* Left - Scenarios */}
        <div className="w-44 p-3 space-y-2 z-10">
          <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] mb-2">
            <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 animate-pulse"></div>
            <span className="text-zinc-400">Stress Lab</span>
            <span>Simulation</span>
          </div>

          {scenarios.map((scenario, index) => (
            <div
              key={scenario.id}
              onClick={() => toggleScenario(scenario.id)}
              className={`p-2 rounded border cursor-pointer transition-all ${
                scenario.active
                  ? 'border-zinc-600 bg-zinc-700'
                  : 'border-[#27272a] hover:border-zinc-600'
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className={`text-xs font-bold ${scenario.active ? 'text-zinc-400' : 'text-zinc-600'}`}>
                  {index + 1}.
                </span>
                <span className={`text-xs ${scenario.active ? 'text-zinc-400' : 'text-zinc-500'}`}>
                  {scenario.name}
                </span>
                {scenario.value && (
                  <span className={`text-xs font-medium ml-auto ${scenario.active ? 'text-zinc-100' : 'text-zinc-600'}`}>
                    {scenario.value}
                  </span>
                )}
              </div>
              {!scenario.value && (
                <div className="flex items-center gap-1 mt-1 text-zinc-600">
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Center - Map */}
        <div className="flex-1 absolute inset-0">
          <Canvas camera={{ position: [0, 0, 3], fov: 50 }}>
            <EuropeFromSpace />
          </Canvas>
        </div>
      </div>

      {/* Bottom - Controls & Results */}
      <div className="px-4 py-2.5 border-t border-[#27272a] bg-[#09090b]/90 space-y-2">
        {/* Slider */}
        <div className="flex items-center gap-3 text-xs">
          <span className="text-zinc-500 w-14">Baseline</span>
          <div className="flex-1 relative">
            <div className="h-1 bg-[#27272a] rounded-full">
              <div 
                className="h-full bg-zinc-500 rounded-full"
                style={{ width: `${sliderValue}%` }}
              />
            </div>
            <input
              type="range"
              min={0}
              max={100}
              value={sliderValue}
              onChange={(e) => setSliderValue(parseInt(e.target.value))}
              className="absolute inset-0 w-full opacity-0 cursor-pointer"
            />
            <div className="flex justify-between text-zinc-600 mt-1 text-[10px]">
              <span>Scenario A</span>
              <span>Scenario B</span>
              <span>O</span>
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-zinc-500 text-xs">Expected Loss:</span>
            <span className="text-zinc-400 font-bold">${data.expectedLoss}B</span>
          </div>

          {completedStressTestId && onPlayTimeline && (
            <button
              type="button"
              title="Load timeline on globe; controls appear at bottom of globe"
              onClick={() => {
                const base = getApiBase()
                const path = `/api/v1/stress-tests/${completedStressTestId}/czml`
                const url = base ? `${base.replace(/\/+$/, '')}${path}` : path
                onPlayTimeline(url)
              }}
              className="px-3 py-1.5 rounded text-xs font-medium bg-amber-600 hover:bg-amber-500 text-black border border-amber-500"
            >
              Play 4D Timeline
            </button>
          )}
          
          <div className="flex items-center gap-2 px-2 py-1 rounded bg-[#18181b] border border-[#27272a]">
            <span className="text-zinc-500 text-xs">Capital Impact:</span>
            <span className="text-red-500 font-bold flex items-center gap-0.5">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
              </svg>
              {data.capitalImpact}%
            </span>
          </div>
          
          {/* Mini chart */}
          <div className="ml-auto flex items-end gap-0.5 h-6">
            {[0.3, 0.45, 0.6, 0.8, 0.65].map((h, i) => (
              <div
                key={i}
                className="w-2.5 rounded-t"
                style={{ 
                  height: `${h * 100}%`,
                  background: i < 2 ? '#C9A962' : '#f59e0b'
                }}
              />
            ))}
          </div>
          <div className="flex gap-3 text-[9px] text-zinc-500">
            <span>T0</span>
            <span>+1 Year</span>
            <span>+3 Years</span>
          </div>
        </div>
      </div>
    </div>
  )
}
