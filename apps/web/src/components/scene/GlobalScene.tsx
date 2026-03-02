/**
 * Global Scene - THE dominant 3D environment
 * 
 * Philosophy:
 * - Earth is not a widget, it's the SPACE
 * - Light = meaning
 * - Warm data on cold background
 * - Atmosphere is everything
 */
import { useRef, useMemo, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { 
  Stars,
  Sphere,
  useTexture,
  Html,
  Float,
} from '@react-three/drei'
import * as THREE from 'three'

interface GlobalSceneProps {
  activeView: 'global' | 'asset'
  selectedAsset: string | null
  onSelectAsset: (id: string | null) => void
}

export default function GlobalScene({ activeView, selectedAsset, onSelectAsset }: GlobalSceneProps) {
  return (
    <>
      {/* Deep space environment */}
      <color attach="background" args={['#000308']} />
      <fog attach="fog" args={['#000510', 10, 50]} />
      
      {/* Ambient - very subtle */}
      <ambientLight intensity={0.05} color="#4a6fa5" />
      
      {/* Main key light - sun simulation */}
      <directionalLight 
        position={[10, 5, 8]} 
        intensity={2} 
        color="#fff5e6"
        castShadow
      />
      
      {/* Rim light - for depth */}
      <directionalLight 
        position={[-8, 3, -5]} 
        intensity={0.3} 
        color="#4a9eff"
      />
      
      {/* Fill light - subtle */}
      <directionalLight 
        position={[0, -5, 0]} 
        intensity={0.1} 
        color="#1a3a5a"
      />
      
      {/* Stars - deep space */}
      <Stars 
        radius={100} 
        depth={50} 
        count={5000} 
        factor={4} 
        saturation={0} 
        fade 
        speed={0.5}
      />
      
      {/* THE EARTH - Central dominant object */}
      <Earth />
      
      {/* Risk hotspots - glowing data points */}
      <RiskHotspots onSelectAsset={onSelectAsset} />
      
      {/* Atmospheric glow */}
      <AtmosphericGlow />
    </>
  )
}

/**
 * Earth - The central gravitational object of the scene
 * 
 * Not a widget. THE space itself.
 */
function Earth() {
  const earthRef = useRef<THREE.Mesh>(null)
  const cloudsRef = useRef<THREE.Mesh>(null)
  const nightRef = useRef<THREE.Mesh>(null)

  // Procedural earth texture with continents
  const earthTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 2048
    canvas.height = 1024
    const ctx = canvas.getContext('2d')!
    
    // Deep ocean gradient
    const oceanGradient = ctx.createRadialGradient(1024, 512, 0, 1024, 512, 800)
    oceanGradient.addColorStop(0, '#0a2540')
    oceanGradient.addColorStop(1, '#051525')
    ctx.fillStyle = oceanGradient
    ctx.fillRect(0, 0, 2048, 1024)
    
    // Continents - subtle dark land
    ctx.fillStyle = '#0a1a15'
    
    // Europe & Africa
    drawContinent(ctx, 1050, 350, 180, 280, 0.1)
    // Asia
    drawContinent(ctx, 1400, 300, 300, 200, -0.1)
    // Americas
    drawContinent(ctx, 450, 350, 150, 300, 0.15)
    // Australia
    drawContinent(ctx, 1650, 600, 100, 80, 0)
    
    return new THREE.CanvasTexture(canvas)
  }, [])

  // Night lights - the DATA layer
  const nightTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 2048
    canvas.height = 1024
    const ctx = canvas.getContext('2d')!
    
    ctx.fillStyle = '#000000'
    ctx.fillRect(0, 0, 2048, 1024)
    
    // City lights as glowing points
    const cities = [
      // Europe - dense cluster
      { x: 1050, y: 340, intensity: 1.2, size: 20 },
      { x: 1080, y: 360, intensity: 1.0, size: 18 },
      { x: 1120, y: 330, intensity: 0.9, size: 15 },
      { x: 1140, y: 380, intensity: 0.8, size: 14 },
      { x: 1100, y: 400, intensity: 0.7, size: 12 },
      { x: 1030, y: 350, intensity: 0.9, size: 16 },
      // Asia
      { x: 1450, y: 380, intensity: 1.0, size: 18 },
      { x: 1550, y: 400, intensity: 1.2, size: 22 },
      { x: 1620, y: 360, intensity: 1.3, size: 25 },
      { x: 1480, y: 430, intensity: 0.9, size: 16 },
      // Americas
      { x: 450, y: 350, intensity: 1.1, size: 20 },
      { x: 380, y: 380, intensity: 0.9, size: 16 },
      { x: 330, y: 420, intensity: 0.8, size: 14 },
      { x: 550, y: 580, intensity: 0.9, size: 16 },
    ]
    
    // Draw city glow with multiple layers for realism
    cities.forEach(city => {
      // Outer glow
      const gradient = ctx.createRadialGradient(
        city.x, city.y, 0, 
        city.x, city.y, city.size * 3
      )
      gradient.addColorStop(0, `rgba(255, 180, 80, ${city.intensity})`)
      gradient.addColorStop(0.2, `rgba(255, 140, 50, ${city.intensity * 0.6})`)
      gradient.addColorStop(0.5, `rgba(255, 100, 30, ${city.intensity * 0.2})`)
      gradient.addColorStop(1, 'rgba(255, 80, 20, 0)')
      
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(city.x, city.y, city.size * 3, 0, Math.PI * 2)
      ctx.fill()
    })
    
    // Scatter MANY more lights for visible continents
    // Europe cluster
    for (let i = 0; i < 400; i++) {
      const x = 1000 + (Math.random() - 0.5) * 200
      const y = 300 + (Math.random() - 0.5) * 150
      const size = 0.8 + Math.random() * 2.5
      const alpha = 0.3 + Math.random() * 0.6
      ctx.fillStyle = `rgba(255, ${160 + Math.random() * 60}, 80, ${alpha})`
      ctx.beginPath()
      ctx.arc(x, y, size, 0, Math.PI * 2)
      ctx.fill()
    }
    
    // Asia cluster
    for (let i = 0; i < 500; i++) {
      const x = 1450 + (Math.random() - 0.5) * 350
      const y = 350 + (Math.random() - 0.5) * 200
      const size = 0.8 + Math.random() * 2.5
      const alpha = 0.3 + Math.random() * 0.6
      ctx.fillStyle = `rgba(255, ${160 + Math.random() * 60}, 80, ${alpha})`
      ctx.beginPath()
      ctx.arc(x, y, size, 0, Math.PI * 2)
      ctx.fill()
    }
    
    // Americas cluster
    for (let i = 0; i < 300; i++) {
      const x = 420 + (Math.random() - 0.5) * 150
      const y = 380 + (Math.random() - 0.5) * 200
      const size = 0.8 + Math.random() * 2
      const alpha = 0.3 + Math.random() * 0.5
      ctx.fillStyle = `rgba(255, ${160 + Math.random() * 60}, 80, ${alpha})`
      ctx.beginPath()
      ctx.arc(x, y, size, 0, Math.PI * 2)
      ctx.fill()
    }
    
    // Random scatter everywhere
    for (let i = 0; i < 500; i++) {
      const x = Math.random() * 2048
      const y = 150 + Math.random() * 700
      const size = 0.3 + Math.random() * 1.5
      const alpha = 0.1 + Math.random() * 0.3
      ctx.fillStyle = `rgba(255, ${140 + Math.random() * 80}, 60, ${alpha})`
      ctx.beginPath()
      ctx.arc(x, y, size, 0, Math.PI * 2)
      ctx.fill()
    }
    
    return new THREE.CanvasTexture(canvas)
  }, [])

  useFrame((state) => {
    const t = state.clock.elapsedTime
    if (earthRef.current) {
      earthRef.current.rotation.y = t * 0.02
    }
    if (cloudsRef.current) {
      cloudsRef.current.rotation.y = t * 0.025
    }
    if (nightRef.current) {
      nightRef.current.rotation.y = t * 0.02
    }
  })

  return (
    <Float speed={0.5} rotationIntensity={0.1} floatIntensity={0.2}>
      <group position={[0, 0, 0]}>
        {/* Main Earth sphere */}
        <mesh ref={earthRef}>
          <sphereGeometry args={[2.5, 128, 128]} />
          <meshStandardMaterial 
            map={earthTexture}
            metalness={0.1}
            roughness={0.8}
          />
        </mesh>
        
        {/* Night lights - additive blending */}
        <mesh ref={nightRef} scale={1.001}>
          <sphereGeometry args={[2.5, 128, 128]} />
          <meshBasicMaterial 
            map={nightTexture}
            transparent
            opacity={1}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>
        
        {/* Cloud layer */}
        <mesh ref={cloudsRef} scale={1.015}>
          <sphereGeometry args={[2.5, 64, 64]} />
          <meshStandardMaterial 
            color="#ffffff"
            transparent
            opacity={0.08}
            depthWrite={false}
          />
        </mesh>
        
        {/* Inner atmosphere glow */}
        <mesh scale={1.02}>
          <sphereGeometry args={[2.5, 32, 32]} />
          <meshBasicMaterial 
            color="#4a9eff"
            transparent
            opacity={0.05}
            side={THREE.BackSide}
            depthWrite={false}
          />
        </mesh>
        
        {/* Outer atmosphere - rim light effect */}
        <mesh scale={1.12}>
          <sphereGeometry args={[2.5, 32, 32]} />
          <meshBasicMaterial 
            color="#4a9eff"
            transparent
            opacity={0.08}
            side={THREE.BackSide}
            depthWrite={false}
          />
        </mesh>
      </group>
    </Float>
  )
}

/**
 * Risk Hotspots - Glowing data points on Earth surface
 * 
 * These are the WARM data on COLD background
 * Light = meaning
 */
function RiskHotspots({ onSelectAsset }: { onSelectAsset: (id: string | null) => void }) {
  const groupRef = useRef<THREE.Group>(null)
  const [hovered, setHovered] = useState<string | null>(null)

  const hotspots = [
    { id: 'munich', name: 'Munich', lat: 48.1, lon: 11.6, risk: 0.75 },
    { id: 'frankfurt', name: 'Frankfurt', lat: 50.1, lon: 8.7, risk: 0.45 },
    { id: 'paris', name: 'Paris', lat: 48.9, lon: 2.4, risk: 0.62 },
    { id: 'london', name: 'London', lat: 51.5, lon: -0.1, risk: 0.58 },
    { id: 'amsterdam', name: 'Amsterdam', lat: 52.4, lon: 4.9, risk: 0.82 },
    { id: 'berlin', name: 'Berlin', lat: 52.5, lon: 13.4, risk: 0.71 },
    { id: 'milan', name: 'Milan', lat: 45.5, lon: 9.2, risk: 0.55 },
  ]

  const latLonToXYZ = (lat: number, lon: number, radius: number) => {
    const phi = (90 - lat) * (Math.PI / 180)
    const theta = (lon + 180) * (Math.PI / 180)
    return new THREE.Vector3(
      -radius * Math.sin(phi) * Math.cos(theta),
      radius * Math.cos(phi),
      radius * Math.sin(phi) * Math.sin(theta)
    )
  }

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = state.clock.elapsedTime * 0.02
    }
  })

  return (
    <group ref={groupRef}>
      {hotspots.map((spot) => {
        const pos = latLonToXYZ(spot.lat, spot.lon, 2.55)
        const isHovered = hovered === spot.id
        const color = spot.risk > 0.7 ? '#ff4444' : spot.risk > 0.5 ? '#ff8800' : '#44ff44'
        
        return (
          <group 
            key={spot.id} 
            position={pos}
            onPointerEnter={() => setHovered(spot.id)}
            onPointerLeave={() => setHovered(null)}
            onClick={() => onSelectAsset(spot.id)}
          >
            {/* Core glow */}
            <mesh>
              <sphereGeometry args={[0.03, 16, 16]} />
              <meshBasicMaterial color={color} />
            </mesh>
            
            {/* Inner glow */}
            <mesh scale={isHovered ? 3 : 2}>
              <sphereGeometry args={[0.03, 16, 16]} />
              <meshBasicMaterial 
                color={color} 
                transparent 
                opacity={0.4}
              />
            </mesh>
            
            {/* Outer glow */}
            <mesh scale={isHovered ? 5 : 3}>
              <sphereGeometry args={[0.03, 16, 16]} />
              <meshBasicMaterial 
                color={color} 
                transparent 
                opacity={0.15}
              />
            </mesh>
            
            {/* Pulsing ring */}
            <PulsingRing color={color} />
            
            {/* Tooltip */}
            {isHovered && (
              <Html position={[0, 0.15, 0]} center>
                <div className="bg-black/80 px-3 py-1.5 rounded-md border border-white/10 text-white text-xs whitespace-nowrap">
                  <div className="font-medium">{spot.name}</div>
                  <div className="text-gray-400">Risk: {(spot.risk * 100).toFixed(0)}%</div>
                </div>
              </Html>
            )}
          </group>
        )
      })}
    </group>
  )
}

/**
 * Pulsing ring animation for hotspots
 */
function PulsingRing({ color }: { color: string }) {
  const ringRef = useRef<THREE.Mesh>(null)
  
  useFrame((state) => {
    if (ringRef.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.3
      ringRef.current.scale.setScalar(scale)
      ringRef.current.material.opacity = 0.3 - Math.sin(state.clock.elapsedTime * 3) * 0.2
    }
  })
  
  return (
    <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
      <ringGeometry args={[0.05, 0.07, 32]} />
      <meshBasicMaterial 
        color={color} 
        transparent 
        opacity={0.3}
        side={THREE.DoubleSide}
      />
    </mesh>
  )
}

/**
 * Atmospheric glow around Earth
 */
function AtmosphericGlow() {
  return (
    <>
      {/* Volumetric atmosphere simulation */}
      <pointLight position={[5, 0, 5]} intensity={0.3} color="#ff6600" distance={15} decay={2} />
      <pointLight position={[-5, 2, -3]} intensity={0.2} color="#0066ff" distance={12} decay={2} />
    </>
  )
}

// Helper function to draw organic continent shapes
function drawContinent(
  ctx: CanvasRenderingContext2D, 
  x: number, 
  y: number, 
  width: number, 
  height: number, 
  rotation: number
) {
  ctx.save()
  ctx.translate(x, y)
  ctx.rotate(rotation)
  ctx.beginPath()
  
  // Organic blob shape
  const points = 12
  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * Math.PI * 2
    const radiusX = width / 2 * (0.7 + Math.random() * 0.3)
    const radiusY = height / 2 * (0.7 + Math.random() * 0.3)
    const px = Math.cos(angle) * radiusX
    const py = Math.sin(angle) * radiusY
    
    if (i === 0) {
      ctx.moveTo(px, py)
    } else {
      ctx.lineTo(px, py)
    }
  }
  
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}
