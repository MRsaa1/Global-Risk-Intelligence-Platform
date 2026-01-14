/**
 * Digital Twin View - 3D Asset Visualization
 * 
 * Scene-first approach:
 * - Building as physical object with materials
 * - Emissive zones show risk areas
 * - Soft shadows, realistic lighting
 * - Object sits in space, not on a plate
 */
import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Float } from '@react-three/drei'
import * as THREE from 'three'

// Building component - simplified industrial facility
function Building() {
  const groupRef = useRef<THREE.Group>(null)
  
  useFrame(({ clock }) => {
    if (groupRef.current) {
      // Subtle floating motion
      groupRef.current.position.y = Math.sin(clock.elapsedTime * 0.5) * 0.02
    }
  })
  
  // Materials
  const baseMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#2a3a4a',
    metalness: 0.3,
    roughness: 0.7,
  }), [])
  
  const glowMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#00aaff',
    emissive: '#0066aa',
    emissiveIntensity: 0.5,
    metalness: 0.5,
    roughness: 0.3,
  }), [])
  
  const riskMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ff4444',
    emissive: '#aa0000',
    emissiveIntensity: 0.8,
    metalness: 0.2,
    roughness: 0.5,
  }), [])
  
  const warningMaterial = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ffaa00',
    emissive: '#aa6600',
    emissiveIntensity: 0.6,
    metalness: 0.2,
    roughness: 0.5,
  }), [])
  
  return (
    <group ref={groupRef}>
      {/* Main building body */}
      <mesh position={[0, 0.5, 0]} material={baseMaterial}>
        <boxGeometry args={[2, 1, 1.5]} />
      </mesh>
      
      {/* Roof structure */}
      <mesh position={[0, 1.15, 0]} material={baseMaterial}>
        <boxGeometry args={[2.1, 0.3, 1.6]} />
      </mesh>
      
      {/* Tower/chimney */}
      <mesh position={[0.7, 1.5, 0]} material={glowMaterial}>
        <cylinderGeometry args={[0.15, 0.2, 1, 16]} />
      </mesh>
      
      {/* Windows - glowing */}
      {[-0.6, -0.2, 0.2, 0.6].map((x, i) => (
        <mesh key={i} position={[x, 0.5, 0.76]} material={glowMaterial}>
          <boxGeometry args={[0.25, 0.4, 0.02]} />
        </mesh>
      ))}
      
      {/* Risk zone - section of building */}
      <mesh position={[-0.7, 0.3, 0]} material={riskMaterial}>
        <boxGeometry args={[0.5, 0.6, 1.52]} />
      </mesh>
      
      {/* Warning zone */}
      <mesh position={[0.7, 0.3, 0.5]} material={warningMaterial}>
        <boxGeometry args={[0.4, 0.6, 0.4]} />
      </mesh>
      
      {/* Foundation/platform */}
      <mesh position={[0, -0.1, 0]}>
        <boxGeometry args={[2.5, 0.1, 2]} />
        <meshStandardMaterial color="#1a2a3a" metalness={0.5} roughness={0.5} />
      </mesh>
      
      {/* Equipment boxes */}
      <mesh position={[-0.3, 0.15, 0.9]} material={baseMaterial}>
        <boxGeometry args={[0.3, 0.3, 0.3]} />
      </mesh>
      <mesh position={[0.3, 0.15, 0.9]} material={glowMaterial}>
        <boxGeometry args={[0.2, 0.2, 0.2]} />
      </mesh>
      
      {/* Pipes */}
      <mesh position={[0.9, 0.3, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.05, 0.05, 0.6, 8]} />
        <meshStandardMaterial color="#3a4a5a" metalness={0.8} roughness={0.2} />
      </mesh>
    </group>
  )
}

// Particle effects for risk areas
function RiskParticles() {
  const particlesRef = useRef<THREE.Points>(null)
  
  const particles = useMemo(() => {
    const count = 50
    const positions = new Float32Array(count * 3)
    const colors = new Float32Array(count * 3)
    
    for (let i = 0; i < count; i++) {
      // Concentrate around risk zone
      positions[i * 3] = -0.7 + (Math.random() - 0.5) * 0.5
      positions[i * 3 + 1] = 0.3 + Math.random() * 1
      positions[i * 3 + 2] = (Math.random() - 0.5) * 1.5
      
      // Red-orange colors
      colors[i * 3] = 1
      colors[i * 3 + 1] = Math.random() * 0.5
      colors[i * 3 + 2] = 0
    }
    
    return { positions, colors }
  }, [])
  
  useFrame(({ clock }) => {
    if (!particlesRef.current) return
    
    const positions = particlesRef.current.geometry.attributes.position.array as Float32Array
    
    for (let i = 0; i < positions.length / 3; i++) {
      positions[i * 3 + 1] += 0.005
      
      // Reset when too high
      if (positions[i * 3 + 1] > 2) {
        positions[i * 3 + 1] = 0.3
      }
    }
    
    particlesRef.current.geometry.attributes.position.needsUpdate = true
  })
  
  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particles.positions.length / 3}
          array={particles.positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={particles.colors.length / 3}
          array={particles.colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.03}
        vertexColors
        transparent
        opacity={0.6}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

// Scene with proper lighting
function Scene() {
  return (
    <>
      {/* Key light */}
      <directionalLight 
        position={[5, 5, 5]} 
        intensity={1} 
        color="#ffffff"
        castShadow
      />
      
      {/* Rim light */}
      <directionalLight 
        position={[-3, 3, -3]} 
        intensity={0.4} 
        color="#aaddff"
      />
      
      {/* Fill light from below */}
      <directionalLight 
        position={[0, -3, 0]} 
        intensity={0.2} 
        color="#334455"
      />
      
      {/* Ambient */}
      <ambientLight intensity={0.15} />
      
      <Float speed={1} rotationIntensity={0.1} floatIntensity={0.2}>
        <Building />
      </Float>
      
      <RiskParticles />
      
      <OrbitControls 
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.5}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 2}
      />
    </>
  )
}

// UI Overlay
function Overlay() {
  return (
    <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
      {/* Title */}
      <div>
        <h2 className="text-sm font-medium text-cyan-400/80">Digital Twin</h2>
        <p className="text-xs text-white/40 mt-0.5">Shanghai Industrial Complex</p>
      </div>
      
      {/* Asset info */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs text-red-400">Flood Risk Zone</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-orange-500" />
          <span className="text-xs text-orange-400">Structural Warning</span>
        </div>
        <div>
          <p className="text-[10px] text-white/40">Value at Risk</p>
          <p className="text-lg text-white font-light">$67.8M</p>
        </div>
      </div>
    </div>
  )
}

export default function DigitalTwinView() {
  return (
    <div className="relative w-full h-full bg-gradient-to-br from-[#030810] to-[#0a1525]">
      <Canvas 
        camera={{ position: [3, 2, 3], fov: 40 }}
        gl={{ antialias: true }}
      >
        <Scene />
      </Canvas>
      <Overlay />
    </div>
  )
}
