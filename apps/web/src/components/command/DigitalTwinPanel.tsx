/**
 * Digital Twin Panel - REALISTIC Industrial Facility
 * 
 * Matches reference:
 * - Isometric view of industrial complex
 * - Orange/red buildings with chimneys
 * - Storage tanks
 * - Grid platform
 */
import { useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'

interface DigitalTwinPanelProps {
  asset: {
    id: string
    name: string
    valuation: number
    cashFlow: number
    loanExposure: number
    riskLevel: number
    risks: {
      operationalDowntime: number
      floodRisk: string
      fireHazard: string
    }
    impact: {
      pd: number
      loss: number
      capitalAdequacy: number
      rateHike: number
      temperature: number
    }
  }
}

// Detailed Industrial Complex
function IndustrialComplex() {
  const groupRef = useRef<THREE.Group>(null)

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.rotation.y = Math.PI / 4 + Math.sin(state.clock.elapsedTime * 0.15) * 0.1
    }
  })

  return (
    <group ref={groupRef} position={[0, -0.6, 0]}>
      {/* Ground platform with grid */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
        <planeGeometry args={[6, 5]} />
        <meshStandardMaterial color="#18181b" metalness={0.2} roughness={0.8} />
      </mesh>
      
      {/* Grid lines on ground */}
      <gridHelper args={[6, 20, '#2a3040', '#2a3040']} position={[0, 0, 0]} />
      
      {/* Main factory building - large orange */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[2.2, 1, 1.6]} />
        <meshStandardMaterial color="#ea580c" metalness={0.15} roughness={0.7} />
      </mesh>
      
      {/* Factory roof */}
      <mesh position={[0, 1.05, 0]}>
        <boxGeometry args={[2.3, 0.1, 1.7]} />
        <meshStandardMaterial color="#b45309" metalness={0.2} roughness={0.6} />
      </mesh>
      
      {/* Roof extension/vent */}
      <mesh position={[0, 1.2, 0]}>
        <boxGeometry args={[0.8, 0.2, 0.6]} />
        <meshStandardMaterial color="#9a3412" metalness={0.2} roughness={0.6} />
      </mesh>
      
      {/* Tall chimney 1 */}
      <mesh position={[-0.5, 1.6, 0]}>
        <cylinderGeometry args={[0.08, 0.12, 1.2, 8]} />
        <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[-0.5, 2.25, 0]}>
        <cylinderGeometry args={[0.1, 0.08, 0.1, 8]} />
        <meshStandardMaterial color="#1f2937" metalness={0.5} roughness={0.4} />
      </mesh>
      
      {/* Tall chimney 2 */}
      <mesh position={[0.5, 1.8, 0]}>
        <cylinderGeometry args={[0.06, 0.1, 1.5, 8]} />
        <meshStandardMaterial color="#374151" metalness={0.5} roughness={0.4} />
      </mesh>
      <mesh position={[0.5, 2.6, 0]}>
        <cylinderGeometry args={[0.08, 0.06, 0.1, 8]} />
        <meshStandardMaterial color="#1f2937" metalness={0.5} roughness={0.4} />
      </mesh>
      
      {/* Side building */}
      <mesh position={[1.5, 0.35, 0]}>
        <boxGeometry args={[0.8, 0.7, 1.2]} />
        <meshStandardMaterial color="#c2410c" metalness={0.15} roughness={0.7} />
      </mesh>
      <mesh position={[1.5, 0.75, 0]}>
        <boxGeometry args={[0.85, 0.1, 1.25]} />
        <meshStandardMaterial color="#9a3412" metalness={0.2} roughness={0.6} />
      </mesh>
      
      {/* Small building */}
      <mesh position={[-1.4, 0.25, 0.5]}>
        <boxGeometry args={[0.6, 0.5, 0.5]} />
        <meshStandardMaterial color="#d97706" metalness={0.15} roughness={0.7} />
      </mesh>
      
      {/* Storage tanks */}
      <mesh position={[-1.5, 0.35, -0.5]}>
        <cylinderGeometry args={[0.25, 0.25, 0.7, 16]} />
        <meshStandardMaterial color="#6b7280" metalness={0.6} roughness={0.3} />
      </mesh>
      <mesh position={[-1.5, 0.75, -0.5]}>
        <cylinderGeometry args={[0.27, 0.25, 0.1, 16]} />
        <meshStandardMaterial color="#4b5563" metalness={0.6} roughness={0.3} />
      </mesh>
      
      <mesh position={[1.5, 0.3, -0.8]}>
        <cylinderGeometry args={[0.2, 0.2, 0.6, 16]} />
        <meshStandardMaterial color="#6b7280" metalness={0.6} roughness={0.3} />
      </mesh>
      
      {/* Pipe connections */}
      <mesh position={[-0.9, 0.6, -0.5]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.03, 0.03, 0.6, 8]} />
        <meshStandardMaterial color="#9ca3af" metalness={0.7} roughness={0.3} />
      </mesh>
      
      {/* Small structures */}
      <mesh position={[0.8, 0.15, 1]}>
        <boxGeometry args={[0.4, 0.3, 0.4]} />
        <meshStandardMaterial color="#4b5563" metalness={0.3} roughness={0.6} />
      </mesh>
    </group>
  )
}

export default function DigitalTwinPanel({ asset }: DigitalTwinPanelProps) {
  return (
    <div className="h-full flex flex-col bg-[#09090b]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#27272a]">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h8a2 2 0 012 2v12a1 1 0 110 2h-3a1 1 0 01-1-1v-2a1 1 0 00-1-1H9a1 1 0 00-1 1v2a1 1 0 01-1 1H4a1 1 0 110-2V4zm3 1h2v2H7V5zm2 4H7v2h2V9zm2-4h2v2h-2V5zm2 4h-2v2h2V9z" clipRule="evenodd" />
          </svg>
          <span className="text-zinc-100 font-medium text-sm">{asset.name}</span>
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
      <div className="flex-1 flex">
        {/* Left - Metrics */}
        <div className="w-28 p-3 space-y-1.5 border-r border-[#27272a]">
          <div className="flex items-center gap-1 text-zinc-500 text-[10px] mb-2">
            <svg className="w-3 h-3 text-zinc-400" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
              <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
            <span>Asset Digital Twin View</span>
          </div>
          
          <MetricRow label="Valuation:" value={`$${asset.valuation}M`} />
          <MetricRow label="Cash Flow:" value={`$${asset.cashFlow}M / Year`} />
          <MetricRow label="Loan Exposure:" value={`${asset.loanExposure}M`} />
          
          <div className="pt-2">
            <div className="text-zinc-500 text-[10px] mb-1">Risk:</div>
            <div className="flex gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className={`h-2 flex-1 rounded-sm ${
                    i <= asset.riskLevel ? 'bg-red-500' : 'bg-[#27272a]'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Center - 3D View */}
        <div className="flex-1 relative">
          <Canvas camera={{ position: [4, 3, 4], fov: 35 }}>
            <ambientLight intensity={0.25} />
            <directionalLight position={[5, 8, 5]} intensity={1} color="#ffffff" />
            <directionalLight position={[-3, 4, -3]} intensity={0.3} color="#60a5fa" />
            <IndustrialComplex />
            <OrbitControls 
              enableZoom={false}
              enablePan={false}
              minPolarAngle={Math.PI / 4}
              maxPolarAngle={Math.PI / 2.5}
              autoRotate={false}
            />
          </Canvas>
        </div>

        {/* Right - Risk Indicators */}
        <div className="w-36 p-3 space-y-2 border-l border-[#27272a]">
          <RiskRow label="Operational Downtime" value={`${asset.risks.operationalDowntime}%`} icon="⚙️" />
          <RiskRow label="Flood Risk" value={asset.risks.floodRisk} status="high" />
          <RiskRow label="Fire Hazard" value={asset.risks.fireHazard} status="medium" icon="🔥" />
        </div>
      </div>

      {/* Bottom - Impact Analysis */}
      <div className="px-4 py-2 border-t border-[#27272a] bg-[#09090b]/90">
        <div className="flex items-center gap-3 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="text-zinc-500">Impact Analysis</span>
            <svg className="w-3.5 h-3.5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
            </svg>
          </div>
          
          <ImpactItem label="PD" value={`+${asset.impact.pd}%`} color="text-red-500" />
          <ImpactItem label="Loss" value={`$${asset.impact.loss}B`} color="text-red-500" icon="⚡" />
          <ImpactItem label="Capital Adequacy" value={`${asset.impact.capitalAdequacy}%`} color="text-zinc-400" icon="⚠️" />
          
          <div className="ml-auto flex gap-3 text-[10px]">
            <span className="text-zinc-500">Rate Hike + <span className="text-zinc-100">{asset.impact.rateHike}%</span></span>
            <span className="text-zinc-500">Temperature: <span className="text-zinc-400">+{asset.impact.temperature}°C</span></span>
          </div>
        </div>
      </div>
    </div>
  )
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-zinc-500 text-[10px]">{label}</div>
      <div className="text-zinc-100 text-xs font-medium">{value}</div>
    </div>
  )
}

function RiskRow({ 
  label, 
  value, 
  status,
  icon,
}: { 
  label: string
  value: string
  status?: 'low' | 'medium' | 'high'
  icon?: string
}) {
  const colors = {
    low: 'text-green-500',
    medium: 'text-zinc-400',
    high: 'text-red-500',
  }

  return (
    <div className="flex items-center justify-between text-[10px]">
      <span className="text-zinc-500">{label}</span>
      <span className={`flex items-center gap-1 ${status ? colors[status] : 'text-zinc-100'}`}>
        {value}
        {icon && <span className="text-[8px]">{icon}</span>}
      </span>
    </div>
  )
}

function ImpactItem({ label, value, color, icon }: { label: string; value: string; color: string; icon?: string }) {
  return (
    <div className="flex items-center gap-1">
      {icon && <span className="text-[10px]">{icon}</span>}
      <span className="text-zinc-500">{label}</span>
      <span className={`font-bold ${color}`}>{value}</span>
    </div>
  )
}
