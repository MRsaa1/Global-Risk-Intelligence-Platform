/**
 * 3D Bar Chart Component using Three.js
 * ======================================
 * 
 * Interactive 3D bar chart for risk assets visualization
 * Uses React Three Fiber for 3D rendering
 */
import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Text } from '@react-three/drei'
import * as THREE from 'three'
import { motion } from 'framer-motion'
import { chartColors, getRiskColor } from '../../lib/chartColors'

export interface BarDataPoint {
  label: string
  value: number
  risk?: number
  color?: string
}

interface BarChart3DProps {
  data: BarDataPoint[]
  height?: number
  showGrid?: boolean
  showLabels?: boolean
  showValues?: boolean
  title?: string
  valueFormat?: 'number' | 'currency' | 'percent'
  onBarClick?: (point: BarDataPoint) => void
  colorByRisk?: boolean
}

// 3D Bar Component
function Bar3D({
  position,
  height,
  width,
  depth,
  color,
  label,
  value,
  isHovered,
  onPointerEnter,
  onPointerLeave,
  onClick,
  showValue,
  formatValue,
}: {
  position: [number, number, number]
  height: number
  width: number
  depth: number
  color: string
  label: string
  value: number
  isHovered: boolean
  onPointerEnter: () => void
  onPointerLeave: () => void
  onClick: () => void
  showValue: boolean
  formatValue: (v: number) => string
}) {
  const meshRef = useRef<THREE.Mesh>(null)
  
  useFrame((state) => {
    if (meshRef.current && isHovered) {
      meshRef.current.position.y = position[1] + Math.sin(state.clock.elapsedTime * 3) * 0.05
    } else if (meshRef.current) {
      meshRef.current.position.y = position[1]
    }
  })
  
  return (
    <group position={position}>
      {/* Bar */}
      <mesh
        ref={meshRef}
        onPointerEnter={onPointerEnter}
        onPointerLeave={onPointerLeave}
        onClick={onClick}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={color}
          emissive={isHovered ? color : '#000000'}
          emissiveIntensity={isHovered ? 0.3 : 0}
          metalness={0.3}
          roughness={0.4}
        />
      </mesh>
      
      {/* Value label on top */}
      {showValue && (
        <Text
          position={[0, height / 2 + 0.3, 0]}
          fontSize={0.2}
          color={chartColors.text.primary}
          anchorX="center"
          anchorY="middle"
        >
          {formatValue(value)}
        </Text>
      )}
      
      {/* Label in front of bar - positioned at ground level */}
      <group position={[0, 0, depth / 2 + 0.15]}>
        {/* Background plane for better visibility */}
        <mesh position={[0, 0.1, 0]} rotation={[0, 0, 0]}>
          <planeGeometry args={[width + 0.3, 0.3]} />
          <meshBasicMaterial 
            color={chartColors.background.card} 
            transparent 
            opacity={0.95}
          />
        </mesh>
        <Text
          position={[0, 0.1, 0.01]}
          fontSize={0.2}
          color={chartColors.text.primary}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
          maxWidth={width + 0.2}
        >
          {label}
        </Text>
      </group>
    </group>
  )
}

// 3D Scene Component
function BarChartScene({
  data,
  maxValue,
  showLabels,
  showValues,
  formatValue,
  getBarColor,
  onBarClick,
  hoveredIndex,
  setHoveredIndex,
}: {
  data: BarDataPoint[]
  maxValue: number
  showLabels: boolean
  showValues: boolean
  formatValue: (v: number) => string
  getBarColor: (d: BarDataPoint) => string
  onBarClick?: (point: BarDataPoint) => void
  hoveredIndex: number | null
  setHoveredIndex: (index: number | null) => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  
  const barWidth = 0.6
  const barDepth = 0.6
  const spacing = 1.5
  const maxHeight = 4
  
  // Calculate positions
  const totalWidth = (data.length - 1) * spacing
  const startX = -totalWidth / 2
  
  return (
    <group ref={groupRef}>
      {/* Grid */}
      <gridHelper args={[totalWidth + 2, 10, chartColors.background.border, chartColors.background.border]} />
      
      {/* Bars */}
      {data.map((d, i) => {
        const x = startX + i * spacing
        const barHeight = (d.value / maxValue) * maxHeight
        const y = barHeight / 2
        const isHovered = hoveredIndex === i
        
        return (
          <Bar3D
            key={i}
            position={[x, y, 0]}
            height={barHeight}
            width={barWidth}
            depth={barDepth}
            color={getBarColor(d)}
            label={d.label}
            value={d.value}
            isHovered={isHovered}
            onPointerEnter={() => setHoveredIndex(i)}
            onPointerLeave={() => setHoveredIndex(null)}
            onClick={() => onBarClick?.(d)}
            showValue={showValues}
            formatValue={formatValue}
          />
        )
      })}
      
      {/* Y-axis labels */}
      {Array.from({ length: 5 }).map((_, i) => {
        const value = (maxValue / 4) * i
        const y = (value / maxValue) * maxHeight
        return (
          <group key={i}>
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={2}
                  array={new Float32Array([
                    startX - 0.5, y, 0,
                    startX - 0.3, y, 0,
                  ])}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial color={chartColors.background.border} />
            </line>
            <Text
              position={[startX - 0.8, y, 0]}
              fontSize={0.15}
              color={chartColors.text.muted}
              anchorX="right"
              anchorY="middle"
            >
              {formatValue(value)}
            </Text>
          </group>
        )
      })}
    </group>
  )
}

export default function BarChart3D({
  data,
  height = 400,
  showGrid = true,
  showLabels = true,
  showValues = true,
  title,
  valueFormat = 'number',
  onBarClick,
  colorByRisk = true,
}: BarChart3DProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  
  // Calculate max value
  const maxValue = useMemo(() => {
    if (!data || data.length === 0) return 100
    const max = Math.max(...data.map(d => d.value))
    return max > 0 ? max * 1.1 : 100
  }, [data])
  
  // Format value
  const formatValue = useMemo(() => {
    return (value: number) => {
      switch (valueFormat) {
        case 'currency':
          if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`
          if (value >= 1_000) return `€${(value / 1_000).toFixed(0)}K`
          return `€${value.toFixed(0)}`
        case 'percent':
          return `${(value * 100).toFixed(1)}%`
        default:
          return value.toFixed(0)
      }
    }
  }, [valueFormat])
  
  // Get bar color
  const getBarColor = useMemo(() => {
    return (d: BarDataPoint) => {
      if (colorByRisk && d.risk !== undefined) {
        return getRiskColor(d.risk)
      }
      return d.color || chartColors.series.climate
    }
  }, [colorByRisk])
  
  if (!data || data.length === 0) {
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
        <Canvas shadows camera={{ position: [10, 5, 10], fov: 45 }}>
          <PerspectiveCamera makeDefault position={[10, 5, 10]} fov={45} />
          
          {/* Lighting */}
          <ambientLight intensity={0.6} />
          <directionalLight
            position={[10, 10, 5]}
            intensity={0.9}
            castShadow
            shadow-mapSize={[1024, 1024]}
          />
          <directionalLight position={[-5, 5, -5]} intensity={0.5} />
          <pointLight position={[0, 10, 0]} intensity={0.4} />
          
          {/* 3D Bars */}
          <BarChartScene
            data={data}
            maxValue={maxValue}
            showLabels={showLabels}
            showValues={showValues}
            formatValue={formatValue}
            getBarColor={getBarColor}
            onBarClick={onBarClick}
            hoveredIndex={hoveredIndex}
            setHoveredIndex={setHoveredIndex}
          />
          
          {/* Controls */}
          <OrbitControls
            enablePan={true}
            enableZoom={true}
            enableRotate={true}
            minDistance={6}
            maxDistance={18}
            minPolarAngle={0.25}
            maxPolarAngle={Math.PI / 2 - 0.05}
            target={[0, 2, 0]}
          />
        </Canvas>
      </div>
      
      {/* Controls hint */}
      <div className="mt-2 text-center text-xs text-white/40">
        Drag to rotate • Scroll to zoom • Click bars for details
      </div>
    </motion.div>
  )
}
