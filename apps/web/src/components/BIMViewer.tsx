/**
 * BIM Viewer using IFC.js for parsing and displaying IFC files.
 * 
 * Integrates:
 * - web-ifc for IFC parsing
 * - Three.js for 3D rendering
 * - React Three Fiber for React integration
 */
import { useEffect, useRef, useState, useMemo } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Grid, Html, Center } from '@react-three/drei'
import * as THREE from 'three'
import { CubeTransparentIcon, CubeIcon, BuildingOffice2Icon, ArrowUpTrayIcon } from '@heroicons/react/24/outline'
import { assetsApi } from '../lib/api'

const SAMPLE_IFC_DOWNLOAD = 'https://github.com/buildingSMART/Sample-Test-Files'
const DOC_IFC_SOURCES = '/docs/IFC_BIM_VIEWER_SOURCES.md'

// Demo presets: raw GitHub (may be blocked by CORS; then use "Upload from disk") + optional local /samples/demo.ifc
const DEMO_PRESETS: { id: string; name: string; url: string; source: string }[] = [
  {
    id: 'local',
    name: 'Local demo',
    url: '/samples/demo.ifc',
    source: 'local',
  },
  {
    id: 'duplex-arc',
    name: 'Duplex (Architecture)',
    url: 'https://raw.githubusercontent.com/youshengCode/IfcSampleFiles/main/Ifc2x3_Duplex_Architecture.ifc',
    source: 'youshengCode',
  },
  {
    id: 'sample-castle',
    name: 'Sample castle',
    url: 'https://raw.githubusercontent.com/youshengCode/IfcSampleFiles/main/Ifc2x3_SampleCastle.ifc',
    source: 'youshengCode',
  },
  {
    id: 'basichouse',
    name: 'Basic house',
    url: 'https://raw.githubusercontent.com/andrewisen/bim-whale-ifc-samples/main/BasicHouse/IFC/BasicHouse.ifc',
    source: 'bim-whale',
  },
]

interface BIMViewerProps {
  ifcUrl?: string
  ifcData?: ArrayBuffer
  /** Asset ID for upload (enables "Upload IFC" in empty state) */
  assetId?: string
  /** Called after successful IFC upload so parent can refetch asset */
  onBimUploaded?: () => void
  onLoad?: (metadata: BIMMetadata) => void
  onError?: (error: Error) => void
  selectedElementId?: number
  onElementSelect?: (elementId: number | null, info: ElementInfo | null) => void
}

interface BIMMetadata {
  projectName: string
  schema: string
  elementCount: number
  geometryCount: number
  storeys: string[]
  categories: { [key: string]: number }
}

interface ElementInfo {
  expressID: number
  type: string
  name?: string
  description?: string
  storey?: string
}

interface ParsedGeometry {
  vertices: Float32Array
  indices: Uint32Array
  normals: Float32Array
  expressID: number
  color: { r: number; g: number; b: number; a: number }
}

// IFC type constants for common building elements
const IFC_TYPES = {
  IFCWALL: 1091909925,
  IFCWALLSTANDARDCASE: 3512223829,
  IFCSLAB: 1529196076,
  IFCROOF: 2016517767,
  IFCBEAM: 753842376,
  IFCCOLUMN: 843113511,
  IFCWINDOW: 3304561284,
  IFCDOOR: 395920057,
  IFCSTAIR: 331165859,
  IFCSTAIRFLIGHT: 4252922144,
  IFCRAILING: 2262370178,
  IFCPLATE: 3171933400,
  IFCMEMBER: 1073191201,
  IFCFURNISHINGELEMENT: 263784265,
  IFCSPACE: 3856911033,
  IFCOPENINGELEMENT: 3588315303,
  IFCBUILDINGSTOREY: 3124254112,
  IFCPROJECT: 103090709,
}

// Color mapping for different IFC types
const TYPE_COLORS: { [key: number]: { r: number; g: number; b: number } } = {
  [IFC_TYPES.IFCWALL]: { r: 0.85, g: 0.85, b: 0.85 },
  [IFC_TYPES.IFCWALLSTANDARDCASE]: { r: 0.85, g: 0.85, b: 0.85 },
  [IFC_TYPES.IFCSLAB]: { r: 0.7, g: 0.7, b: 0.75 },
  [IFC_TYPES.IFCROOF]: { r: 0.6, g: 0.3, b: 0.2 },
  [IFC_TYPES.IFCBEAM]: { r: 0.5, g: 0.5, b: 0.55 },
  [IFC_TYPES.IFCCOLUMN]: { r: 0.6, g: 0.6, b: 0.65 },
  [IFC_TYPES.IFCWINDOW]: { r: 0.5, g: 0.7, b: 0.9 },
  [IFC_TYPES.IFCDOOR]: { r: 0.55, g: 0.35, b: 0.2 },
  [IFC_TYPES.IFCSTAIR]: { r: 0.65, g: 0.65, b: 0.7 },
  [IFC_TYPES.IFCRAILING]: { r: 0.4, g: 0.4, b: 0.45 },
  [IFC_TYPES.IFCFURNISHINGELEMENT]: { r: 0.6, g: 0.5, b: 0.4 },
}

// Listen for WebGL context lost/restored (e.g. tab switch, GPU busy) to show a message instead of silent failure
function WebGLContextHandler({ onContextLost, onContextRestored }: { onContextLost?: () => void; onContextRestored?: () => void }) {
  const { gl } = useThree()
  const lostRef = useRef(onContextLost)
  const restoredRef = useRef(onContextRestored)
  lostRef.current = onContextLost
  restoredRef.current = onContextRestored
  useEffect(() => {
    const canvas = gl.domElement
    const onLost = () => lostRef.current?.()
    const onRestored = () => restoredRef.current?.()
    canvas.addEventListener('webglcontextlost', onLost)
    canvas.addEventListener('webglcontextrestored', onRestored)
    return () => {
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.removeEventListener('webglcontextrestored', onRestored)
    }
  }, [gl])
  return null
}

// Geometry renderer component
function IFCGeometry({ 
  geometries, 
  selectedId, 
  onSelect 
}: { 
  geometries: ParsedGeometry[]
  selectedId?: number
  onSelect?: (id: number | null) => void
}) {
  const groupRef = useRef<THREE.Group>(null)
  const { camera } = useThree()
  
  // Create merged geometry for performance
  const { meshes, bounds } = useMemo(() => {
    const meshes: { geometry: THREE.BufferGeometry; color: THREE.Color; expressID: number }[] = []
    const allPositions: number[] = []
    
    for (const geo of geometries) {
      if (!geo.vertices.length || !geo.indices.length) continue
      
      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.BufferAttribute(geo.vertices, 3))
      geometry.setIndex(new THREE.BufferAttribute(geo.indices, 1))
      
      if (geo.normals.length) {
        geometry.setAttribute('normal', new THREE.BufferAttribute(geo.normals, 3))
      } else {
        geometry.computeVertexNormals()
      }
      
      geometry.userData.expressID = geo.expressID
      
      const color = new THREE.Color(geo.color.r, geo.color.g, geo.color.b)
      meshes.push({ geometry, color, expressID: geo.expressID })
      
      // Collect all positions for bounds calculation
      for (let i = 0; i < geo.vertices.length; i++) {
        allPositions.push(geo.vertices[i])
      }
    }
    
    // Calculate bounding box
    const bounds = new THREE.Box3()
    if (allPositions.length) {
      const positions = new Float32Array(allPositions)
      const tempGeo = new THREE.BufferGeometry()
      tempGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      tempGeo.computeBoundingBox()
      bounds.copy(tempGeo.boundingBox!)
      tempGeo.dispose()
    }
    
    return { meshes, bounds }
  }, [geometries])
  
  // Center and scale the model
  useEffect(() => {
    if (groupRef.current && bounds.min.x !== Infinity) {
      const center = new THREE.Vector3()
      bounds.getCenter(center)
      
      const size = new THREE.Vector3()
      bounds.getSize(size)
      const maxDim = Math.max(size.x, size.y, size.z)
      const scale = maxDim > 0 ? 20 / maxDim : 1
      
      groupRef.current.scale.setScalar(scale)
      groupRef.current.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale)
    }
  }, [bounds])
  
  const handleClick = (e: THREE.Intersection) => {
    e.stopPropagation?.()
    const expressID = e.object?.userData?.expressID
    onSelect?.(expressID ?? null)
  }
  
  return (
    <group ref={groupRef}>
      {meshes.map((m, i) => (
        <mesh 
          key={i} 
          geometry={m.geometry}
          userData={{ expressID: m.expressID }}
          onClick={(e) => {
            e.stopPropagation()
            onSelect?.(m.expressID)
          }}
        >
          <meshStandardMaterial 
            color={m.expressID === selectedId ? '#00aaff' : m.color} 
            metalness={0.1} 
            roughness={0.8}
            side={THREE.DoubleSide}
            emissive={m.expressID === selectedId ? '#003366' : '#000000'}
            emissiveIntensity={m.expressID === selectedId ? 0.3 : 0}
          />
        </mesh>
      ))}
    </group>
  )
}

// Main IFC.js integration component
function IFCModel({ ifcUrl, ifcData, onLoad, onError, selectedElementId, onElementSelect }: BIMViewerProps) {
  const [loading, setLoading] = useState(true)
  const [loadingStatus, setLoadingStatus] = useState('Initializing...')
  const [error, setError] = useState<string | null>(null)
  const [geometries, setGeometries] = useState<ParsedGeometry[]>([])
  const [metadata, setMetadata] = useState<BIMMetadata | null>(null)
  const ifcApiRef = useRef<any>(null)
  const modelIdRef = useRef<number | null>(null)
  const onLoadRef = useRef(onLoad)
  const onErrorRef = useRef(onError)
  onLoadRef.current = onLoad
  onErrorRef.current = onError

  useEffect(() => {
    let mounted = true

    async function loadIFC() {
      try {
        setLoadingStatus('Loading web-ifc...')
        
        // Dynamic import of web-ifc
        const webIfc = await import('web-ifc')
        const ifcApi = new webIfc.IfcAPI()
        ifcApiRef.current = ifcApi
        
        // WASM path must match the installed web-ifc version (JS and WASM must be same release)
        ifcApi.SetWasmPath('https://unpkg.com/web-ifc@0.0.57/', true)
        
        setLoadingStatus('Initializing parser...')
        await ifcApi.Init()
        
        setLoadingStatus('Loading IFC file...')
        
        // Load IFC file
        let modelID: number
        let buffer: ArrayBuffer
        
        if (ifcData) {
          buffer = ifcData
        } else if (ifcUrl) {
          const response = await fetch(ifcUrl)
          if (!response.ok) {
            throw new Error(`Demo unavailable (${response.status}). Try another sample or download from buildingSMART.`)
          }
          buffer = await response.arrayBuffer()
        } else {
          throw new Error('No IFC file provided')
        }

        if (!buffer.byteLength) {
          throw new Error('Empty IFC file. Try another sample.')
        }

        // Ensure we have real IFC content; avoid passing HTML or invalid data to web-ifc (causes LINEWRITER_BUFFER)
        const header = new TextDecoder('ascii', { fatal: false }).decode(new Uint8Array(buffer).subarray(0, 120))
        const trimmed = header.trimStart()
        if (trimmed.startsWith('<') || trimmed.startsWith('{')) {
          throw new Error('URL returned HTML or JSON, not an IFC file. Use "Upload from disk" with a local .ifc file or try the Local demo (see samples/README.md).')
        }
        if (!trimmed.startsWith('ISO-10303-21')) {
          throw new Error('File is not a valid IFC (must start with ISO-10303-21). Try another demo or upload a local .ifc file.')
        }

        let openErr: Error | null = null
        try {
          modelID = ifcApi.OpenModel(new Uint8Array(buffer), {
            COORDINATE_TO_ORIGIN: true,
            USE_FAST_BOOLS: true,
          })
        } catch (e: any) {
          openErr = e instanceof Error ? e : new Error(String(e))
          if (/LINEWRITER_BUFFER|toWireType/i.test(openErr.message)) {
            throw new Error('This IFC file could not be parsed (format or size issue). Try a different demo or upload a small .ifc file from your computer.')
          }
          throw openErr
        }
        modelIdRef.current = modelID
        
        if (!mounted) return
        
        setLoadingStatus('Extracting metadata...')
        
        // Extract metadata
        let projectName = 'Unknown'
        const schema = ifcApi.GetModelSchema(modelID)
        const allLines = ifcApi.GetAllLines(modelID)
        
        // Get project name
        try {
          const projectIds = ifcApi.GetLineIDsWithType(modelID, IFC_TYPES.IFCPROJECT)
          if (projectIds.size() > 0) {
            const project = ifcApi.GetLine(modelID, projectIds.get(0))
            projectName = project?.Name?.value || 'Unknown'
          }
        } catch {}
        
        // Get building storeys
        const storeys: string[] = []
        try {
          const storeyIds = ifcApi.GetLineIDsWithType(modelID, IFC_TYPES.IFCBUILDINGSTOREY)
          for (let i = 0; i < storeyIds.size(); i++) {
            const storey = ifcApi.GetLine(modelID, storeyIds.get(i))
            if (storey?.Name?.value) {
              storeys.push(storey.Name.value)
            }
          }
        } catch {}
        
        // Count elements by category
        const categories: { [key: string]: number } = {}
        const typesToCheck = [
          { type: IFC_TYPES.IFCWALL, name: 'Walls' },
          { type: IFC_TYPES.IFCWALLSTANDARDCASE, name: 'Walls' },
          { type: IFC_TYPES.IFCSLAB, name: 'Slabs' },
          { type: IFC_TYPES.IFCWINDOW, name: 'Windows' },
          { type: IFC_TYPES.IFCDOOR, name: 'Doors' },
          { type: IFC_TYPES.IFCCOLUMN, name: 'Columns' },
          { type: IFC_TYPES.IFCBEAM, name: 'Beams' },
          { type: IFC_TYPES.IFCROOF, name: 'Roofs' },
        ]
        
        for (const { type, name } of typesToCheck) {
          try {
            const ids = ifcApi.GetLineIDsWithType(modelID, type)
            categories[name] = (categories[name] || 0) + ids.size()
          } catch {}
        }
        
        if (!mounted) return
        
        setLoadingStatus('Parsing geometry...')
        
        // Parse geometry using GetFlatMesh
        const parsedGeometries: ParsedGeometry[] = []
        
        // Get all meshes using the streaming geometry API
        ifcApi.StreamAllMeshes(modelID, (mesh: any) => {
          const expressID = mesh.expressID
          const placedGeometries = mesh.geometries
          
          for (let i = 0; i < placedGeometries.size(); i++) {
            const placed = placedGeometries.get(i)
            const flatMesh = ifcApi.GetGeometry(modelID, placed.geometryExpressID)
            
            // Get vertex data
            const verts = ifcApi.GetVertexArray(
              flatMesh.GetVertexData(),
              flatMesh.GetVertexDataSize()
            )
            const indices = ifcApi.GetIndexArray(
              flatMesh.GetIndexData(),
              flatMesh.GetIndexDataSize()
            )
            
            if (verts.length && indices.length) {
              // Extract position and normals (interleaved: x,y,z,nx,ny,nz per vertex)
              const vertCount = verts.length / 6
              const positions = new Float32Array(vertCount * 3)
              const normals = new Float32Array(vertCount * 3)
              
              for (let v = 0; v < vertCount; v++) {
                positions[v * 3] = verts[v * 6]
                positions[v * 3 + 1] = verts[v * 6 + 1]
                positions[v * 3 + 2] = verts[v * 6 + 2]
                normals[v * 3] = verts[v * 6 + 3]
                normals[v * 3 + 1] = verts[v * 6 + 4]
                normals[v * 3 + 2] = verts[v * 6 + 5]
              }
              
              // Apply transformation matrix
              const matrix = new THREE.Matrix4()
              matrix.fromArray(placed.flatTransformation)
              
              const tempPositions = new Float32Array(positions.length)
              const tempNormals = new Float32Array(normals.length)
              const vec = new THREE.Vector3()
              const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix)
              
              for (let v = 0; v < vertCount; v++) {
                vec.set(positions[v * 3], positions[v * 3 + 1], positions[v * 3 + 2])
                vec.applyMatrix4(matrix)
                tempPositions[v * 3] = vec.x
                tempPositions[v * 3 + 1] = vec.y
                tempPositions[v * 3 + 2] = vec.z
                
                vec.set(normals[v * 3], normals[v * 3 + 1], normals[v * 3 + 2])
                vec.applyMatrix3(normalMatrix).normalize()
                tempNormals[v * 3] = vec.x
                tempNormals[v * 3 + 1] = vec.y
                tempNormals[v * 3 + 2] = vec.z
              }
              
              // Get color from IFC or use type-based color
              let color = { r: 0.8, g: 0.8, b: 0.8, a: 1 }
              const ifcColor = placed.color
              if (ifcColor) {
                color = { r: ifcColor.x, g: ifcColor.y, b: ifcColor.z, a: ifcColor.w }
              }
              
              parsedGeometries.push({
                vertices: tempPositions,
                indices: new Uint32Array(indices),
                normals: tempNormals,
                expressID,
                color,
              })
            }
            
            flatMesh.delete()
          }
        })
        
        if (!mounted) return
        
        const finalMetadata: BIMMetadata = {
          projectName,
          schema,
          elementCount: allLines.length,
          geometryCount: parsedGeometries.length,
          storeys,
          categories,
        }
        
        setMetadata(finalMetadata)
        setGeometries(parsedGeometries)
        setLoading(false)
        onLoadRef.current?.(finalMetadata)

      } catch (err: any) {
        console.error('IFC Load Error:', err)
        if (mounted) {
          setError(err.message || 'Failed to load IFC file')
          setLoading(false)
          onErrorRef.current?.(err)
        }
      }
    }

    if (ifcUrl || ifcData) {
      loadIFC()
    } else {
      setLoading(false)
    }

    return () => {
      mounted = false
      // Cleanup
      if (ifcApiRef.current && modelIdRef.current !== null) {
        try {
          ifcApiRef.current.CloseModel(modelIdRef.current)
        } catch {}
      }
    }
  }, [ifcUrl, ifcData])
  
  // Handle element selection
  const handleElementSelect = async (expressID: number | null) => {
    if (!expressID || !ifcApiRef.current || modelIdRef.current === null) {
      onElementSelect?.(null, null)
      return
    }
    
    try {
      const element = ifcApiRef.current.GetLine(modelIdRef.current, expressID)
      const info: ElementInfo = {
        expressID,
        type: element?.constructor?.name || 'Unknown',
        name: element?.Name?.value,
        description: element?.Description?.value,
      }
      onElementSelect?.(expressID, info)
    } catch {
      onElementSelect?.(expressID, { expressID, type: 'Unknown' })
    }
  }

  if (loading) {
    return (
      <Html center>
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-3 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center">
            <BuildingOffice2Icon className="w-8 h-8 text-white animate-pulse" />
          </div>
          <p className="text-sm text-white/80 mb-1">Loading BIM model...</p>
          <p className="text-xs text-white/50">{loadingStatus}</p>
        </div>
      </Html>
    )
  }

  if (error) {
    return (
      <Html center>
        <div className="text-center max-w-xs">
          <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-red-500/20 flex items-center justify-center">
            <CubeIcon className="w-6 h-6 text-red-400" />
          </div>
          <p className="text-red-400 mb-2 font-medium">Error loading BIM</p>
          <p className="text-xs text-white/50">{error}</p>
        </div>
      </Html>
    )
  }

  if (!geometries.length && !ifcUrl && !ifcData) {
    return (
      <Html center>
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-2 rounded-xl bg-white/10 flex items-center justify-center">
            <CubeTransparentIcon className="w-6 h-6 text-white/40" />
          </div>
          <p className="text-sm text-white/60">No IFC file loaded</p>
          <p className="text-xs text-white/40 mt-1">Upload an IFC file to view</p>
        </div>
      </Html>
    )
  }

  return (
    <IFCGeometry 
      geometries={geometries} 
      selectedId={selectedElementId}
      onSelect={handleElementSelect}
    />
  )
}

export default function BIMViewer({ ifcUrl, ifcData, assetId, onBimUploaded, onLoad, onError }: BIMViewerProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [selectedInfo, setSelectedInfo] = useState<ElementInfo | null>(null)
  const [metadata, setMetadata] = useState<BIMMetadata | null>(null)
  const [showMetadata, setShowMetadata] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const [demoIfcUrl, setDemoIfcUrl] = useState<string | null>(null)
  const [demoLoadError, setDemoLoadError] = useState<string | null>(null)
  const [webglContextLost, setWebglContextLost] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const glRef = useRef<THREE.WebGLRenderer | null>(null)

  // Cleanup WebGL context on unmount
  useEffect(() => {
    return () => {
      if (glRef.current) {
        try {
          glRef.current.dispose()
          glRef.current.forceContextLoss()
        } catch {
          // Ignore disposal errors
        }
        glRef.current = null
      }
    }
  }, [])

  const effectiveIfcUrl = ifcUrl || demoIfcUrl || undefined
  const hasNoIfc = !ifcUrl && !ifcData && !demoIfcUrl

  const handleDemoError = (err: Error) => {
    if (demoIfcUrl) {
      setDemoIfcUrl(null)
      setDemoLoadError(err?.message || 'Failed to load demo')
    }
    onError?.(err)
  }

  const handleLoadDemo = (url: string) => {
    setDemoLoadError(null)
    setDemoIfcUrl(url)
  }

  const handleLoad = (meta: BIMMetadata) => {
    setMetadata(meta)
    onLoad?.(meta)
  }

  const handleElementSelect = (id: number | null, info: ElementInfo | null) => {
    setSelectedId(id)
    setSelectedInfo(info)
  }

  const handleUploadClick = () => {
    setUploadError(null)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !assetId) return
    const ext = (file.name.split('.').pop() || '').toLowerCase()
    if (ext !== 'ifc' && ext !== 'ifczip') {
      setUploadError('Only .ifc and .ifczip files are supported.')
      return
    }
    setUploading(true)
    setUploadError(null)
    try {
      await assetsApi.uploadBim(assetId, file)
      onBimUploaded?.()
    } catch (err: any) {
      setUploadError(err?.response?.data?.detail || err?.message || 'Upload failed')
      onError?.(err)
    } finally {
      setUploading(false)
    }
  }

  if (hasNoIfc) {
    return (
      <div className="relative w-full h-full min-h-[320px] bg-[#0a0f1a] rounded-xl overflow-hidden flex items-center justify-center">
        <div className="text-center px-6 py-8 max-w-lg">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-white/10 flex items-center justify-center">
            <CubeTransparentIcon className="w-8 h-8 text-white/50" />
          </div>
          <p className="text-base font-medium text-white/90 mb-1">No IFC file loaded</p>
          <p className="text-sm text-white/50 mb-4">Load a demo model or upload your own IFC file.</p>

          {demoLoadError && (
            <div className="mb-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-left">
              <p className="text-sm text-red-300 mb-2">{demoLoadError}</p>
              <p className="text-xs text-white/50 mb-2">Remote demos often fail (CORS/404). For a reliable test: use &quot;Local demo&quot; after placing a .ifc in <code className="text-cyan-400/80">public/samples/demo.ifc</code>, or use &quot;Upload from disk&quot;.</p>
              <button
                type="button"
                onClick={() => setDemoLoadError(null)}
                className="text-xs text-cyan-400 hover:text-cyan-300"
              >
                Try another
              </button>
            </div>
          )}

          <div className="mb-4">
            <p className="text-xs text-white/50 mb-2 uppercase tracking-wide">Demo models</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {DEMO_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleLoadDemo(preset.url)}
                  className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-cyan-500/20 border border-cyan-500/30 text-cyan-200 text-sm font-medium hover:bg-cyan-500/30 transition-colors"
                >
                  <CubeIcon className="w-4 h-4" />
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {assetId && (
            <div className="mb-4">
              <input
                ref={fileInputRef}
                type="file"
                accept=".ifc,.ifczip"
                className="hidden"
                onChange={handleFileChange}
                disabled={uploading}
              />
              <button
                type="button"
                onClick={handleUploadClick}
                disabled={uploading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-500 text-white font-medium hover:bg-primary-600 disabled:opacity-50 transition-colors"
              >
                <ArrowUpTrayIcon className="w-5 h-5" />
                {uploading ? 'Uploading…' : 'Upload from disk'}
              </button>
            </div>
          )}

          <p className="text-xs text-white/40">
            Don&apos;t have IFC?{' '}
            <a
              href={SAMPLE_IFC_DOWNLOAD}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 underline"
            >
              Download sample IFC files
            </a>
            {' '}(buildingSMART).{' '}
            <a
              href={DOC_IFC_SOURCES}
              target="_blank"
              rel="noopener noreferrer"
              className="text-cyan-400 hover:text-cyan-300 underline"
            >
              More sources
            </a>
          </p>
          {uploadError && (
            <p className="text-sm text-red-400 mt-2">{uploadError}</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full bg-[#0a0f1a] rounded-xl overflow-hidden">
      {webglContextLost && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-black/80 backdrop-blur-sm">
          <div className="text-center max-w-xs p-4 rounded-xl bg-amber-500/20 border border-amber-500/40">
            <p className="text-amber-200 font-medium mb-1">WebGL context lost</p>
            <p className="text-sm text-white/70 mb-3">Refresh the page or close other heavy 3D tabs to restore.</p>
            <button type="button" onClick={() => setWebglContextLost(false)} className="text-xs text-cyan-400 hover:text-cyan-300">Dismiss</button>
          </div>
        </div>
      )}
      <Canvas
        shadows
        gl={{ antialias: true, alpha: false }}
        onCreated={({ gl }) => {
          glRef.current = gl
        }}
      >
        <WebGLContextHandler onContextLost={() => setWebglContextLost(true)} onContextRestored={() => setWebglContextLost(false)} />
        <color attach="background" args={['#0a0f1a']} />
        <PerspectiveCamera makeDefault position={[15, 15, 15]} fov={50} />
        
        <ambientLight intensity={0.5} />
        <directionalLight 
          position={[20, 30, 20]} 
          intensity={1.5} 
          castShadow
          shadow-mapSize-width={2048}
          shadow-mapSize-height={2048}
        />
        <directionalLight position={[-10, 10, -10]} intensity={0.3} />
        <hemisphereLight intensity={0.3} groundColor="#0a0f1a" />
        
        <IFCModel 
          ifcUrl={effectiveIfcUrl} 
          ifcData={ifcData} 
          onLoad={handleLoad} 
          onError={handleDemoError}
          selectedElementId={selectedId ?? undefined}
          onElementSelect={handleElementSelect}
        />
        
        <Grid 
          infiniteGrid 
          cellSize={1} 
          cellThickness={0.3} 
          sectionSize={5}
          sectionThickness={0.6}
          fadeDistance={50}
          cellColor="#1a2030"
          sectionColor="#2a3040"
        />
        
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={true}
          minDistance={5}
          maxDistance={100}
          maxPolarAngle={Math.PI / 2 + 0.1}
        />
        
        <fog attach="fog" args={['#0a0f1a', 40, 100]} />
      </Canvas>

      {/* Top-left info overlay */}
      <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-sm border border-white/10 rounded-xl p-3">
        <div className="flex items-center gap-2 mb-2">
          <CubeTransparentIcon className="w-5 h-5 text-cyan-400" />
          <p className="text-sm font-medium text-white">BIM Viewer</p>
        </div>
        <p className="text-xs text-white/50">
          web-ifc + Three.js
        </p>
        {demoIfcUrl && (
          <button
            type="button"
            onClick={() => setDemoIfcUrl(null)}
            className="mt-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Close demo model
          </button>
        )}
        {metadata && (
          <button
            onClick={() => setShowMetadata(!showMetadata)}
            className="mt-2 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            {showMetadata ? 'Hide' : 'Show'} metadata
          </button>
        )}
      </div>
      
      {/* Metadata panel */}
      {metadata && showMetadata && (
        <div className="absolute top-4 left-48 bg-black/80 backdrop-blur-sm border border-white/10 rounded-xl p-4 max-w-xs">
          <h3 className="text-sm font-semibold text-white mb-3">Model Info</h3>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-white/50">Project:</span>
              <span className="text-white">{metadata.projectName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Schema:</span>
              <span className="text-white">{metadata.schema}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Elements:</span>
              <span className="text-white">{metadata.elementCount.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Geometries:</span>
              <span className="text-white">{metadata.geometryCount.toLocaleString()}</span>
            </div>
            {metadata.storeys.length > 0 && (
              <div>
                <span className="text-white/50 block mb-1">Storeys:</span>
                <div className="flex flex-wrap gap-1">
                  {metadata.storeys.map((s, i) => (
                    <span key={i} className="px-2 py-0.5 bg-white/10 rounded text-white text-xs">{s}</span>
                  ))}
                </div>
              </div>
            )}
            {Object.keys(metadata.categories).length > 0 && (
              <div className="pt-2 border-t border-white/10">
                <span className="text-white/50 block mb-1">Categories:</span>
                <div className="grid grid-cols-2 gap-1">
                  {Object.entries(metadata.categories).map(([name, count]) => (
                    <div key={name} className="flex justify-between text-xs">
                      <span className="text-white/60">{name}:</span>
                      <span className="text-white">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Selected element info */}
      {selectedInfo && (
        <div className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-sm border border-cyan-500/30 rounded-xl p-4 max-w-xs">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
            <h3 className="text-sm font-semibold text-white">Selected Element</h3>
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-white/50">ID:</span>
              <span className="text-cyan-400 font-mono">{selectedInfo.expressID}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-white/50">Type:</span>
              <span className="text-white">{selectedInfo.type}</span>
            </div>
            {selectedInfo.name && (
              <div className="flex justify-between">
                <span className="text-white/50">Name:</span>
                <span className="text-white">{selectedInfo.name}</span>
              </div>
            )}
            {selectedInfo.description && (
              <div className="pt-1">
                <span className="text-white/50 block">Description:</span>
                <span className="text-white/80">{selectedInfo.description}</span>
              </div>
            )}
          </div>
          <button
            onClick={() => {
              setSelectedId(null)
              setSelectedInfo(null)
            }}
            className="mt-3 w-full text-xs text-white/50 hover:text-white py-1 border border-white/10 rounded transition-colors"
          >
            Clear selection
          </button>
        </div>
      )}
      
      {/* Controls hint */}
      <div className="absolute bottom-4 right-4 bg-black/40 backdrop-blur-sm rounded-lg px-3 py-2">
        <p className="text-[10px] text-white/40">
          <span className="text-white/60">LMB</span> Rotate • 
          <span className="text-white/60 ml-1">RMB</span> Pan • 
          <span className="text-white/60 ml-1">Scroll</span> Zoom
        </p>
      </div>
    </div>
  )
}
