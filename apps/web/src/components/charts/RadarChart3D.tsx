/**
 * 3D Radar Chart (Spider Chart) Component using Three.js
 * =======================================================
 * 
 * Interactive 3D radial/polar chart for multi-dimensional risk data
 * Uses React Three Fiber for 3D rendering
 */
import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Text } from '@react-three/drei'
import * as THREE from 'three'
import { motion } from 'framer-motion'
import { chartColors, seriesColors } from '../../lib/chartColors'

export interface RadarDataPoint {
  axis: string
  value: number
}

export interface RadarSeries {
  id: string
  name: string
  data: RadarDataPoint[]
  color?: string
}

interface RadarChart3DProps {
  series: RadarSeries[]
  height?: number
  showGrid?: boolean
  showLegend?: boolean
  showLabels?: boolean
  title?: string
  maxValue?: number
  levels?: number
}

const defaultColors = Object.values(seriesColors)

// 3D Radar Mesh Component
function RadarMesh({
  series,
  maxValue,
  levels,
  showGrid,
  showLabels,
}: {
  series: RadarSeries[]
  maxValue: number
  levels: number
  showGrid: boolean
  showLabels: boolean
}) {
  const meshRef = useRef<THREE.Group>(null)
  const [hoveredSeries, setHoveredSeries] = useState<string | null>(null)
  
  // Get all axes
  const axes = useMemo(() => {
    const axisSet = new Set<string>()
    series.forEach(s => s.data.forEach(d => axisSet.add(d.axis)))
    return Array.from(axisSet)
  }, [series])
  
  // Process series with colors
  const processedSeries = useMemo(() => {
    return series.map((s, i) => ({
      ...s,
      color: s.color || defaultColors[i % defaultColors.length],
      data: axes.map(axis => {
        const existing = s.data.find(d => d.axis === axis)
        return existing || { axis, value: 0 }
      }),
    }))
  }, [series, axes])
  
  // Animation
  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.1
    }
  })
  
  const radius = 3
  const angleStep = (Math.PI * 2) / axes.length
  
  return (
    <group ref={meshRef}>
      {/* Grid circles */}
      {showGrid && Array.from({ length: levels }).map((_, level) => {
        const levelRadius = (radius / levels) * (level + 1)
        return (
          <mesh key={level} rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[levelRadius - 0.02, levelRadius + 0.02, 32]} />
            <meshBasicMaterial 
              color={chartColors.background.borderOpaque} 
              transparent 
              opacity={0.2}
              side={THREE.DoubleSide}
            />
          </mesh>
        )
      })}
      
      {/* Grid lines (axes) */}
      {showGrid && axes.map((axis, i) => {
        const angle = i * angleStep
        const x = Math.cos(angle) * radius
        const z = Math.sin(angle) * radius
        
        return (
          <line key={i}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={2}
                array={new Float32Array([0, 0, 0, x, 0, z])}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color={chartColors.background.borderOpaque} opacity={0.3} transparent />
          </line>
        )
      })}
      
      {/* Series meshes */}
      {processedSeries.map((s, si) => {
        const isHovered = hoveredSeries === null || hoveredSeries === s.id
        
        // Create vertices for polygon (center + perimeter points)
        const vertices: number[] = [0, 0, 0] // Center point
        const indices: number[] = []
        
        s.data.forEach((d, i) => {
          const angle = i * angleStep
          const r = (d.value / maxValue) * radius
          const x = Math.cos(angle) * r
          const z = Math.sin(angle) * r
          vertices.push(x, 0, z)
        })
        
        // Create triangle fan indices (center to each vertex pair)
        const pointCount = s.data.length
        for (let i = 1; i <= pointCount; i++) {
          const next = i === pointCount ? 1 : i + 1
          indices.push(0, i, next) // Triangle from center to two adjacent points
        }
        
        return (
          <group key={s.id}>
            {/* Polygon mesh */}
            {vertices.length > 3 && (
              <mesh
                onPointerEnter={() => setHoveredSeries(s.id)}
                onPointerLeave={() => setHoveredSeries(null)}
              >
                <bufferGeometry>
                  <bufferAttribute
                    attach="attributes-position"
                    count={vertices.length / 3}
                    array={new Float32Array(vertices)}
                    itemSize={3}
                  />
                  <bufferAttribute
                    attach="index"
                    count={indices.length}
                    array={new Uint16Array(indices)}
                    itemSize={1}
                  />
                </bufferGeometry>
                <meshBasicMaterial
                  color={s.color}
                  transparent
                  opacity={isHovered ? 0.3 : 0.15}
                  side={THREE.DoubleSide}
                />
              </mesh>
            )}
            
            {/* Line around polygon */}
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={s.data.length + 1}
                  array={new Float32Array(vertices)}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial 
                color={s.color} 
                linewidth={isHovered ? 3 : 2}
                transparent
                opacity={isHovered ? 1 : 0.7}
              />
            </line>
            
            {/* Points */}
            {s.data.map((d, di) => {
              const angle = di * angleStep
              const r = (d.value / maxValue) * radius
              const x = Math.cos(angle) * r
              const z = Math.sin(angle) * r
              
              return (
                <mesh key={di} position={[x, 0, z]}>
                  <sphereGeometry args={[0.08, 16, 16]} />
                  <meshBasicMaterial color={s.color} />
                </mesh>
              )
            })}
          </group>
        )
      })}
      
      {/* Axis labels - positioned higher and more visible */}
      {showLabels && axes.map((axis, i) => {
        const angle = i * angleStep
        const labelRadius = radius + 1.2
        const x = Math.cos(angle) * labelRadius
        const z = Math.sin(angle) * labelRadius
        
        return (
          <group key={i}>
            {/* Background plane for better visibility - larger and more opaque */}
            <mesh position={[x, 0.3, z]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[1.2, 0.5]} />
              <meshBasicMaterial 
                color="#0a0f18" 
                transparent 
                opacity={0.98}
                side={THREE.DoubleSide}
              />
            </mesh>
            {/* Border for contrast */}
            <mesh position={[x, 0.3, z]} rotation={[-Math.PI / 2, 0, 0]}>
              <planeGeometry args={[1.22, 0.52]} />
              <meshBasicMaterial 
                color="#3b82f6" 
                transparent 
                opacity={0.4}
                side={THREE.DoubleSide}
              />
            </mesh>
            <Text
              position={[x, 0.3, z]}
              fontSize={0.35}
              color="#ffffff"
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.06}
              outlineColor="#000000"
              fontWeight="700"
            >
              {axis}
            </Text>
          </group>
        )
      })}
    </group>
  )
}

export default function RadarChart3D({
  series,
  height = 400,
  showGrid = true,
  showLegend = true,
  showLabels = true,
  title,
  maxValue,
  levels = 5,
}: RadarChart3DProps) {
  // Get all axes
  const axes = useMemo(() => {
    const axisSet = new Set<string>()
    series.forEach(s => s.data.forEach(d => axisSet.add(d.axis)))
    return Array.from(axisSet)
  }, [series])
  
  // Calculate max value
  const calculatedMaxValue = useMemo(() => {
    if (maxValue !== undefined) return maxValue
    return Math.max(...series.flatMap(s => s.data.map(d => d.value))) * 1.1
  }, [series, maxValue])
  
  // Process series with colors
  const processedSeries = useMemo(() => {
    return series.map((s, i) => ({
      ...s,
      color: s.color || defaultColors[i % defaultColors.length],
      data: axes.map(axis => {
        const existing = s.data.find(d => d.axis === axis)
        return existing || { axis, value: 0 }
      }),
    }))
  }, [series, axes])
  
  if (!series || series.length === 0) {
    return (
      <div className="relative">
        {title && (
          <h3 className="text-white/80 text-sm font-medium mb-3">{title}</h3>
        )}
        <div className="flex items-center justify-center h-[400px] text-white/40 text-sm">
          No data available
        </div>
      </div>
    )
  }
  
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="relative w-full"
      style={{ height }}
    >
      {title && (
        <h3 className="text-white/80 text-sm font-medium mb-3">{title}</h3>
      )}
      
      <div className="w-full h-full bg-[#0a0f18] rounded-lg overflow-hidden">
        <Canvas camera={{ position: [6, 4, 6], fov: 55 }}>
          <PerspectiveCamera makeDefault position={[6, 4, 6]} fov={55} />
          
          {/* Lighting */}
          <ambientLight intensity={0.7} />
          <directionalLight position={[10, 10, 5]} intensity={0.9} />
          <directionalLight position={[-5, 5, -5]} intensity={0.5} />
          <pointLight position={[0, 8, 0]} intensity={0.3} />
          
          {/* 3D Radar */}
          <RadarMesh
            series={processedSeries}
            maxValue={calculatedMaxValue}
            levels={levels}
            showGrid={showGrid}
            showLabels={showLabels}
          />
          
          {/* Controls */}
          <OrbitControls
            enablePan={false}
            enableZoom={true}
            enableRotate={true}
            minDistance={4}
            maxDistance={12}
            autoRotate={false}
            minPolarAngle={0.3}
            maxPolarAngle={Math.PI / 2 - 0.1}
          />
          
          {/* Grid helper */}
          <gridHelper args={[10, 10, chartColors.background.borderOpaque, chartColors.background.borderOpaque]} />
        </Canvas>
      </div>
      
      {/* Legend */}
      {showLegend && (
        <div className="flex flex-wrap gap-4 mt-4 justify-center">
          {processedSeries.map(s => (
            <div key={s.id} className="flex items-center gap-2">
              <div 
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: s.color }}
              />
              <span className="text-xs text-white/60">{s.name}</span>
            </div>
          ))}
        </div>
      )}
      
      {/* Controls hint */}
      <div className="mt-2 text-center text-xs text-white/40">
        Drag to rotate • Scroll to zoom
      </div>
    </motion.div>
  )
}
