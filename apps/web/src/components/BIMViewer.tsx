/**
 * BIM Viewer using IFC.js for parsing and displaying IFC files.
 * 
 * Integrates:
 * - web-ifc for IFC parsing
 * - Three.js for 3D rendering
 * - React Three Fiber for React integration
 */
import { useEffect, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Grid, Html } from '@react-three/drei'
import * as THREE from 'three'
import { motion } from 'framer-motion'
import { CubeTransparentIcon } from '@heroicons/react/24/outline'

interface BIMViewerProps {
  ifcUrl?: string
  ifcData?: ArrayBuffer
  onLoad?: (metadata: any) => void
  onError?: (error: Error) => void
}

// IFC.js integration component
function IFCModel({ ifcUrl, ifcData, onLoad, onError }: BIMViewerProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [metadata, setMetadata] = useState<any>(null)

  useEffect(() => {
    let mounted = true

    async function loadIFC() {
      try {
        // Dynamic import of web-ifc (only when needed)
        const { IfcAPI } = await import('web-ifc')
        const ifcApi = new IfcAPI()
        
        // Initialize IFC.js
        await ifcApi.Init()
        
        // Load IFC file
        let modelID: number
        if (ifcData) {
          modelID = ifcApi.OpenModel(ifcData)
        } else if (ifcUrl) {
          const response = await fetch(ifcUrl)
          const buffer = await response.arrayBuffer()
          modelID = ifcApi.OpenModel(buffer)
        } else {
          throw new Error('No IFC file provided')
        }
        
        // Extract metadata
        const props = ifcApi.GetLineIDsWithType(modelID, 0)  // IFCProject
        const project = ifcApi.GetLine(modelID, props[0])
        
        const extractedMetadata = {
          projectName: project.Name?.value || 'Unknown',
          schema: ifcApi.GetModelSchema(modelID),
          elementCount: ifcApi.GetAllLines(modelID).length,
        }
        
        if (mounted) {
          setMetadata(extractedMetadata)
          setLoading(false)
          onLoad?.(extractedMetadata)
        }
        
        // TODO: Parse geometry and create Three.js meshes
        // This is a simplified version - full implementation would:
        // 1. Extract geometry from IFC
        // 2. Convert to Three.js BufferGeometry
        // 3. Create materials based on IFC properties
        // 4. Build scene graph
        
      } catch (err: any) {
        if (mounted) {
          setError(err.message)
          setLoading(false)
          onError?.(err)
        }
      }
    }

    if (ifcUrl || ifcData) {
      loadIFC()
    }

    return () => {
      mounted = false
    }
  }, [ifcUrl, ifcData, onLoad, onError])

  if (loading) {
    return (
      <Html center>
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-gradient-to-br from-primary-500 to-accent-500 animate-pulse" />
          <p className="text-sm text-dark-muted">Loading BIM model...</p>
        </div>
      </Html>
    )
  }

  if (error) {
    return (
      <Html center>
        <div className="text-center">
          <p className="text-red-400 mb-2">Error loading BIM</p>
          <p className="text-xs text-dark-muted">{error}</p>
        </div>
      </Html>
    )
  }

  // Placeholder geometry (replace with actual IFC geometry)
  return (
    <group>
      <mesh ref={meshRef}>
        <boxGeometry args={[2, 4, 2]} />
        <meshStandardMaterial color="#0056e6" metalness={0.3} roughness={0.7} />
      </mesh>
    </group>
  )
}

export default function BIMViewer({ ifcUrl, ifcData, onLoad, onError }: BIMViewerProps) {
  return (
    <div className="relative w-full h-full bg-dark-bg rounded-xl overflow-hidden">
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[10, 10, 10]} fov={50} />
        
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 15, 10]} intensity={1} castShadow />
        
        <IFCModel ifcUrl={ifcUrl} ifcData={ifcData} onLoad={onLoad} onError={onError} />
        
        <Grid infiniteGrid cellSize={1} cellThickness={0.5} />
        
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={5}
          maxDistance={50}
        />
        
        <fog attach="fog" args={['#0a0f1a', 20, 50]} />
      </Canvas>

      {/* Info overlay */}
      <div className="absolute top-4 left-4 glass rounded-xl p-3">
        <div className="flex items-center gap-2 mb-2">
          <CubeTransparentIcon className="w-5 h-5 text-primary-400" />
          <p className="text-sm font-medium">BIM Viewer</p>
        </div>
        <p className="text-xs text-dark-muted">
          Powered by IFC.js + Three.js
        </p>
      </div>
    </div>
  )
}
