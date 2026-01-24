/**
 * Risk Graph View - Network Visualization
 * 
 * Scene-first approach:
 * - Force-directed graph as 3D network
 * - Connections show dependencies
 * - Color = risk state
 * - Tension in the network visible
 */
import { useRef, useMemo, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Line } from '@react-three/drei'
import * as THREE from 'three'

// Network data
const NODES = [
  { id: 'central', label: 'Portfolio', risk: 0.5, x: 0, y: 0, z: 0, size: 0.3 },
  { id: 'asset1', label: 'Tokyo HQ', risk: 0.9, x: 2, y: 1, z: 1, size: 0.2 },
  { id: 'asset2', label: 'Shanghai Plant', risk: 0.8, x: -1.5, y: 0.5, z: 1.5, size: 0.2 },
  { id: 'asset3', label: 'London Office', risk: 0.4, x: 1, y: -1, z: -1, size: 0.15 },
  { id: 'asset4', label: 'NYC Tower', risk: 0.7, x: -1, y: 1.5, z: -1, size: 0.2 },
  { id: 'asset5', label: 'Dubai Mall', risk: 0.3, x: 2, y: -0.5, z: -1.5, size: 0.15 },
  { id: 'supplier1', label: 'Supplier A', risk: 0.6, x: 0.5, y: 2, z: 0.5, size: 0.1 },
  { id: 'supplier2', label: 'Supplier B', risk: 0.85, x: -2, y: -1, z: 0, size: 0.1 },
  { id: 'market1', label: 'EU Market', risk: 0.4, x: -0.5, y: -1.5, z: 1.5, size: 0.12 },
  { id: 'market2', label: 'Asia Market', risk: 0.7, x: 1.5, y: 0, z: 2, size: 0.12 },
]

const EDGES = [
  { from: 'central', to: 'asset1', strength: 0.8 },
  { from: 'central', to: 'asset2', strength: 0.9 },
  { from: 'central', to: 'asset3', strength: 0.5 },
  { from: 'central', to: 'asset4', strength: 0.7 },
  { from: 'central', to: 'asset5', strength: 0.4 },
  { from: 'asset1', to: 'supplier1', strength: 0.6 },
  { from: 'asset2', to: 'supplier2', strength: 0.9 },
  { from: 'asset1', to: 'market2', strength: 0.7 },
  { from: 'asset2', to: 'market2', strength: 0.8 },
  { from: 'asset3', to: 'market1', strength: 0.5 },
  { from: 'asset4', to: 'market1', strength: 0.6 },
  { from: 'supplier1', to: 'asset4', strength: 0.3 },
  { from: 'supplier2', to: 'asset1', strength: 0.4 },
]

// Get color based on risk
function getRiskColor(risk: number): THREE.Color {
  if (risk > 0.7) return new THREE.Color('#ff3333')
  if (risk > 0.5) return new THREE.Color('#ffaa33')
  if (risk > 0.3) return new THREE.Color('#ffff33')
  return new THREE.Color('#33ff66')
}

// Node component
function Node({ node, onHover }: { node: typeof NODES[0], onHover: (id: string | null) => void }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const color = getRiskColor(node.risk)
  
  useFrame(({ clock }) => {
    if (!meshRef.current) return
    
    // Pulse based on risk
    const pulse = Math.sin(clock.elapsedTime * (1 + node.risk * 2)) * 0.1 * node.risk + 1
    meshRef.current.scale.setScalar(node.size * pulse)
  })
  
  return (
    <group position={[node.x, node.y, node.z]}>
      {/* Core */}
      <mesh 
        ref={meshRef}
        onPointerOver={() => onHover(node.id)}
        onPointerOut={() => onHover(null)}
      >
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial 
          color={color}
          emissive={color}
          emissiveIntensity={0.5}
          metalness={0.3}
          roughness={0.5}
        />
      </mesh>
      
      {/* Outer glow */}
      <mesh scale={[1.5, 1.5, 1.5]}>
        <sphereGeometry args={[node.size, 16, 16]} />
        <meshBasicMaterial 
          color={color}
          transparent
          opacity={0.15}
        />
      </mesh>
    </group>
  )
}

// Edge component
function Edge({ from, to, strength }: { from: THREE.Vector3, to: THREE.Vector3, strength: number }) {
  const lineRef = useRef<any>(null)
  
  const color = strength > 0.7 ? '#ff6666' : strength > 0.5 ? '#ffaa66' : '#66aaff'
  
  return (
    <Line
      ref={lineRef}
      points={[from, to]}
      color={color}
      lineWidth={strength * 2}
      transparent
      opacity={0.4 + strength * 0.3}
    />
  )
}

// Network graph
function NetworkGraph() {
  const [hovered, setHovered] = useState<string | null>(null)
  const groupRef = useRef<THREE.Group>(null)
  
  // Animate the whole graph with subtle rotation
  useFrame(({ clock }) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.sin(clock.elapsedTime * 0.1) * 0.1
    }
  })
  
  // Create edge geometries
  const edges = useMemo(() => {
    return EDGES.map(edge => {
      const fromNode = NODES.find(n => n.id === edge.from)
      const toNode = NODES.find(n => n.id === edge.to)
      if (!fromNode || !toNode) return null
      
      return {
        from: new THREE.Vector3(fromNode.x, fromNode.y, fromNode.z),
        to: new THREE.Vector3(toNode.x, toNode.y, toNode.z),
        strength: edge.strength,
      }
    }).filter(Boolean)
  }, [])
  
  return (
    <group ref={groupRef}>
      {/* Edges first (behind nodes) */}
      {edges.map((edge, i) => edge && (
        <Edge key={i} from={edge.from} to={edge.to} strength={edge.strength} />
      ))}
      
      {/* Nodes */}
      {NODES.map(node => (
        <Node key={node.id} node={node} onHover={setHovered} />
      ))}
    </group>
  )
}

// Scene
function Scene() {
  return (
    <>
      {/* Lights */}
      <ambientLight intensity={0.3} />
      <pointLight position={[5, 5, 5]} intensity={0.5} />
      <pointLight position={[-5, -5, -5]} intensity={0.3} color="#aaddff" />
      
      <NetworkGraph />
      
      <OrbitControls 
        enableZoom={false}
        enablePan={false}
        autoRotate
        autoRotateSpeed={0.2}
      />
    </>
  )
}

// Overlay
function Overlay() {
  return (
    <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
      <div>
        <h2 className="text-sm font-medium text-amber-400/80">Risk Network</h2>
        <p className="text-xs text-white/40 mt-0.5">Portfolio Dependencies</p>
      </div>
      
      <div className="space-y-2">
        <div className="flex flex-wrap gap-2 text-[10px]">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-white/60">Critical</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-orange-500" />
            <span className="text-white/60">High</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="text-white/60">Medium</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 rounded-full bg-green-500" />
            <span className="text-white/60">Low</span>
          </div>
        </div>
        <div>
          <p className="text-[10px] text-white/40">Network Stress</p>
          <p className="text-lg text-orange-400 font-light">67%</p>
        </div>
      </div>
    </div>
  )
}

export default function RiskGraphView() {
  return (
    <div className="relative w-full h-full bg-gradient-to-br from-[#030810] to-[#0a1525]">
      <Canvas 
        camera={{ position: [5, 3, 5], fov: 40 }}
        gl={{ antialias: true }}
      >
        <Scene />
      </Canvas>
      <Overlay />
    </div>
  )
}
