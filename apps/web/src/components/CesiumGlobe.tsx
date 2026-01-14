/**
 * CesiumJS Globe Component
 * =========================
 * 
 * Production-level 3D globe using CesiumJS:
 * - Real WGS84 ellipsoid
 * - Level of Detail (LOD)
 * - Smooth camera transitions
 * - Risk hotspots as entities
 * 
 * Used by NASA, Lockheed Martin, NVIDIA Digital Twins
 */
import { useEffect, useRef, useState } from 'react'
import * as Cesium from 'cesium'

// Extend Window for Cesium
declare global {
  interface Window {
    CESIUM_BASE_URL: string
  }
}

// Configure Cesium - use jsDelivr CDN (supports CORS)
window.CESIUM_BASE_URL = 'https://cdn.jsdelivr.net/npm/cesium@1.124.0/Build/Cesium/'

// Cesium Ion token for NASA Black Marble
const CESIUM_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwYTExZmMxNS1jY2RhLTQ2YjctOTg0Mi02NWQxNGQxYjFhZGYiLCJpZCI6Mzc4MTk5LCJpYXQiOjE3NjgzMjc3NjJ9.neQZ3X5JRYBalv7cjUuVrq_kVw0nVyKQlwtOyxls5OM'

// API for loading geo data
const API_BASE = '/api/v1'

interface Hotspot {
  id: string
  lat: number
  lng: number
  risk: number
  name: string
  value: number
  assets_count?: number
  pd_1y?: number
  lgd?: number
}

// Hotspots for cities with 3D Tiles in Cesium Ion
const FALLBACK_HOTSPOTS: Hotspot[] = [
  { id: 'newyork', lat: 40.7128, lng: -74.0060, risk: 0.75, name: 'New York', value: 52.3 },
  { id: 'tokyo', lat: 35.6762, lng: 139.6503, risk: 0.92, name: 'Tokyo', value: 45.2 },
  { id: 'melbourne', lat: -37.8136, lng: 144.9631, risk: 0.58, name: 'Melbourne', value: 28.5 },
  { id: 'boston', lat: 42.3601, lng: -71.0589, risk: 0.62, name: 'Boston', value: 31.2 },
  { id: 'sydney', lat: -33.8688, lng: 151.2093, risk: 0.52, name: 'Sydney', value: 38.7 },
  { id: 'denver', lat: 39.7392, lng: -104.9903, risk: 0.45, name: 'Denver', value: 18.9 },
  { id: 'washington', lat: 38.9072, lng: -77.0369, risk: 0.48, name: 'Washington DC', value: 42.1 },
  { id: 'montreal', lat: 45.5017, lng: -73.5673, risk: 0.55, name: 'Montreal', value: 22.4 },
]

async function loadHotspots(scenario?: string): Promise<Hotspot[]> {
  try {
    const url = scenario 
      ? `${API_BASE}/geodata/hotspots?scenario=${scenario}`
      : `${API_BASE}/geodata/hotspots`
    const response = await fetch(url)
    if (!response.ok) throw new Error('API error')
    
    const geojson = await response.json()
    return geojson.features.map((f: any) => ({
      id: f.id,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      risk: f.properties.risk_score,
      name: f.properties.name,
      value: f.properties.exposure,
      assets_count: f.properties.assets_count,
      pd_1y: f.properties.pd_1y,
      lgd: f.properties.lgd,
    }))
  } catch (e) {
    console.warn('Failed to load hotspots from API, using fallback:', e)
    return FALLBACK_HOTSPOTS
  }
}

function getRiskColor(risk: number): Cesium.Color {
  if (risk > 0.8) return Cesium.Color.fromCssColorString('#ff2222').withAlpha(0.9)
  if (risk > 0.6) return Cesium.Color.fromCssColorString('#ff8822').withAlpha(0.9)
  if (risk > 0.4) return Cesium.Color.fromCssColorString('#ffcc22').withAlpha(0.9)
  return Cesium.Color.fromCssColorString('#22ff66').withAlpha(0.9)
}

// Zone level to color
function getZoneLevelColor(level: string): Cesium.Color {
  switch (level) {
    case 'critical': return Cesium.Color.fromCssColorString('#ff2222')
    case 'high':     return Cesium.Color.fromCssColorString('#ff8822')
    case 'medium':   return Cesium.Color.fromCssColorString('#ffcc22')
    default:         return Cesium.Color.fromCssColorString('#22ff66')
  }
}

// Risk Zone from Stress Test
export interface RiskZone {
  id: string
  name?: string
  zone_level: 'critical' | 'high' | 'medium' | 'low'
  center_latitude: number
  center_longitude: number
  radius_km: number
  risk_score: number
  affected_assets_count?: number
  total_exposure?: number
  assets?: ZoneAsset[]  // Assets within this zone
}

// Asset within a risk zone
export interface ZoneAsset {
  id: string
  name: string
  type: 'bank' | 'enterprise' | 'developer' | 'insurer' | 'infrastructure' | 'military' | 'government' | 'hospital' | 'school'
  latitude: number
  longitude: number
  exposure: number
  impactSeverity: number
}

interface CesiumGlobeProps {
  onAssetSelect?: (assetId: string | null) => void
  selectedAsset?: string | null
  scenario?: string  // Stress scenario to apply
  resetViewTrigger?: number  // Increment to trigger reset view
  onHotspotsLoaded?: (hotspots: Hotspot[]) => void  // Callback when hotspots are loaded
  riskZones?: RiskZone[]  // Risk zones from stress tests
  selectedZone?: RiskZone | null  // Currently selected zone (for zoom)
  onZoneClick?: (zone: RiskZone | null) => void  // Callback when zone is clicked
  onZoneAssetClick?: (asset: ZoneAsset | null) => void  // Callback when asset in zone is clicked
  paused?: boolean  // Pause rendering (when Digital Twin is open)
}

// Asset type to icon color mapping
function getAssetTypeColor(type: string): Cesium.Color {
  switch (type) {
    case 'bank': return Cesium.Color.fromCssColorString('#3b82f6') // blue
    case 'enterprise': return Cesium.Color.fromCssColorString('#8b5cf6') // purple
    case 'developer': return Cesium.Color.fromCssColorString('#06b6d4') // cyan
    case 'insurer': return Cesium.Color.fromCssColorString('#10b981') // emerald
    case 'infrastructure': return Cesium.Color.fromCssColorString('#f59e0b') // amber
    case 'military': return Cesium.Color.fromCssColorString('#64748b') // slate
    case 'government': return Cesium.Color.fromCssColorString('#6366f1') // indigo
    case 'hospital': return Cesium.Color.fromCssColorString('#ef4444') // red
    case 'school': return Cesium.Color.fromCssColorString('#22c55e') // green
    default: return Cesium.Color.WHITE
  }
}

export default function CesiumGlobe({ 
  onAssetSelect, 
  selectedAsset, 
  scenario, 
  resetViewTrigger, 
  onHotspotsLoaded,
  riskZones = [],
  selectedZone = null,
  onZoneClick,
  onZoneAssetClick,
  paused = false
}: CesiumGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const zoneEntitiesRef = useRef<Cesium.Entity[]>([])
  const assetEntitiesRef = useRef<Cesium.Entity[]>([])
  
  // Refs for callback access in click handler (avoids stale closure)
  const riskZonesRef = useRef(riskZones)
  const onZoneClickRef = useRef(onZoneClick)
  const onZoneAssetClickRef = useRef(onZoneAssetClick)
  const selectedZoneRef = useRef(selectedZone)
  const rotationEnabledRef = useRef(true) // Control rotation
  
  // Keep refs updated
  useEffect(() => {
    riskZonesRef.current = riskZones
    onZoneClickRef.current = onZoneClick
    onZoneAssetClickRef.current = onZoneAssetClick
  }, [riskZones, onZoneClick, onZoneAssetClick])
  
  // Update selectedZone ref and control rotation
  useEffect(() => {
    selectedZoneRef.current = selectedZone
    // Stop rotation when zone is selected, resume when deselected
    rotationEnabledRef.current = !selectedZone
    console.log('Rotation enabled:', rotationEnabledRef.current)
  }, [selectedZone])
  
  // Pause/resume rendering when Digital Twin is open
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return
    
    if (paused) {
      // Stop rendering to prevent WebGL context conflicts
      viewer.useDefaultRenderLoop = false
      console.log('CesiumGlobe: Rendering paused')
    } else {
      // Resume rendering
      viewer.useDefaultRenderLoop = true
      viewer.scene.requestRender()
      console.log('CesiumGlobe: Rendering resumed')
    }
  }, [paused])

  useEffect(() => {
    if (!containerRef.current) return

    let viewer: Cesium.Viewer | null = null
    let handler: Cesium.ScreenSpaceEventHandler | null = null
    let isMounted = true

    async function initCesium() {
      try {
        // Check if container still exists and no viewer yet
        if (!containerRef.current || !isMounted || viewerRef.current) return

        // Initialize Cesium Viewer without base layer first
        viewer = new Cesium.Viewer(containerRef.current, {
          // Minimal UI - we'll add our own
          animation: false,
          baseLayerPicker: false,
          fullscreenButton: false,
          vrButton: false,
          geocoder: false,
          homeButton: false,
          infoBox: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: false,
          navigationHelpButton: false,
          
          // No base layer initially - we'll add async
          baseLayer: false,
          
          // Performance
          requestRenderMode: true,
          maximumRenderTimeChange: Infinity,
          
          // Globe settings
          skyBox: false,
          skyAtmosphere: new Cesium.SkyAtmosphere(),
          
          // No terrain
          terrainProvider: undefined,
        })

        viewerRef.current = viewer

        // Verify viewer initialized correctly
        if (!viewer.scene || !viewer.entities) {
          throw new Error('Cesium Viewer failed to initialize properly')
        }

        // =============================================
        // GLOBE IMAGERY - Google Earth or NASA Black Marble
        // =============================================
        Cesium.Ion.defaultAccessToken = CESIUM_TOKEN
        
        // =============================================
        // NASA BLACK MARBLE - Earth at Night (only mode)
        // =============================================
        try {
          if (!isMounted || !viewer || viewer.isDestroyed()) return
          
          // NASA Black Marble - city lights
          const nasaBlackMarble = await Cesium.IonImageryProvider.fromAssetId(3812)
          if (!isMounted || !viewer || viewer.isDestroyed()) return
          const nightLayer = viewer.imageryLayers.addImageryProvider(nasaBlackMarble)
          nightLayer.brightness = 1.4
          nightLayer.contrast = 1.5
          nightLayer.saturation = 1.2
          console.log('✅ NASA Black Marble loaded (city lights)')
          
        } catch (e) {
          console.warn('NASA imagery failed:', e)
        }
        
        // =============================================
        // CESIUM WORLD TERRAIN (Asset ID 1)
        // =============================================
        try {
          if (!isMounted || !viewer || viewer.isDestroyed()) return
          const terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(1)
          if (!isMounted || !viewer || viewer.isDestroyed()) return
          viewer.terrainProvider = terrainProvider
          console.log('✅ Cesium World Terrain loaded (Asset ID 1)')
        } catch (e) {
          console.warn('Cesium World Terrain failed:', e)
        }
        
        // =============================================
        // OSM BUILDINGS - 3D buildings worldwide (Asset ID 96188)
        // =============================================
        try {
          if (!isMounted || !viewer || viewer.isDestroyed()) return
          const osmBuildings = await Cesium.Cesium3DTileset.fromIonAssetId(96188)
          if (!isMounted || !viewer || viewer.isDestroyed()) return
          viewer.scene.primitives.add(osmBuildings)
          console.log('✅ OSM Buildings loaded (Asset ID 96188) - 3D buildings worldwide!')
        } catch (e) {
          console.warn('OSM Buildings failed:', e)
        }
        
        // =============================================
        // MINIMAL GLOBE CONFIG
        // =============================================
        if (!isMounted || !viewer || viewer.isDestroyed()) return
        
        const globe = viewer.scene?.globe
        if (!globe) {
          throw new Error('Globe not available')
        }
        
        // Just disable lighting (no day/night terminator)
        globe.enableLighting = false
        
        // Hide sun/moon
        if (viewer.scene.sun) viewer.scene.sun.show = false
        if (viewer.scene.moon) viewer.scene.moon.show = false
        
        // =============================================
        // DARK SPACE VISUALIZATION (Night Earth)
        // =============================================
        const scene = viewer.scene
        
        // Disable HDR to keep pure dark imagery
        scene.highDynamicRange = false
        
        // Disable bloom - it adds blue tint
        if (scene.postProcessStages?.bloom) {
          scene.postProcessStages.bloom.enabled = false
        }
        
        // =============================================
        // NASA BLACK MARBLE VISUALIZATION - Night view (clean)
        // =============================================
        // Disable all atmosphere - pure clean view
        if (viewer.scene.skyAtmosphere) {
          viewer.scene.skyAtmosphere.show = false
        }
        globe.showGroundAtmosphere = false
        
        // Pure dark background (space)
        scene.backgroundColor = Cesium.Color.fromCssColorString('#000005')
        
        // Ocean base color - visible blue
        globe.baseColor = Cesium.Color.fromCssColorString('#0c1e35')
        
        console.log('✅ Night visualization configured')

        // =============================================
        // HOTSPOTS - Disabled for now (visual issues)
        // =============================================
        if (!isMounted || !viewer || viewer.isDestroyed()) return
        const loadedHotspots = await loadHotspots(scenario)
        if (!isMounted || !viewer || viewer.isDestroyed()) return
        setHotspots(loadedHotspots) // Save to state for parent component
        // Hotspot visual markers disabled - uncomment to enable
        // const hotspotEntities: { entity: Cesium.Entity; baseSize: number; spot: Hotspot }[] = []
        // loadedHotspots.forEach((spot, index) => { ... })
        
        // Use request render mode for better performance (only render when needed)
        viewer.scene.requestRenderMode = true
        viewer.scene.maximumRenderTimeChange = Infinity

        // Initial camera position (overview of Earth)
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(100, 20, 20000000),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-90),
            roll: 0,
          },
        })

        // Smooth rotation animation (only when no zone selected)
        let lastTime = Date.now()
        const rotationSpeed = 0.5 // degrees per second
        
        viewer.scene.preRender.addEventListener(() => {
          const now = Date.now()
          const delta = (now - lastTime) / 1000
          lastTime = now
          
          // Only rotate if:
          // 1. Rotation is enabled (no zone selected)
          // 2. Not user-interacting (flying, dragging)
          // 3. Camera is not transforming
          if (rotationEnabledRef.current && viewer && !viewer.scene.camera.isTransforming) {
            viewer.scene.camera.rotate(
              Cesium.Cartesian3.UNIT_Z,
              Cesium.Math.toRadians(rotationSpeed * delta)
            )
          }
        })

        // Click handler for hotspots, zones and zone assets
        if (!isMounted || !viewer || viewer.isDestroyed()) return
        
        handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
        handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
          if (!viewer || viewer.isDestroyed()) return
          const pickedObject = viewer.scene.pick(click.position)
          
          if (Cesium.defined(pickedObject) && pickedObject.id) {
            const entityId = pickedObject.id.id
            const entity = pickedObject.id
            
            // Check if clicked on a zone asset
            if (entityId && entityId.startsWith('zone-asset-') && !entityId.includes('-ring')) {
              console.log('Zone asset clicked:', entityId)
              // Get asset data from entity properties
              if (entity.properties && entity.properties.assetData) {
                const assetData = entity.properties.assetData.getValue()
                console.log('Asset data:', assetData)
                onZoneAssetClickRef.current?.(assetData)
              }
              return
            }
            
            // Check if clicked on a risk zone (main ellipse or center marker)
            if (entityId && (entityId.startsWith('zone-') || entityId.startsWith('zone-center-'))) {
              if (entityId.includes('-pulse') || entityId.includes('-ring')) {
                return // Ignore pulse/ring elements
              }
              
              // Extract zone id
              let zoneId = entityId
              if (entityId.startsWith('zone-center-')) {
                zoneId = entityId.replace('zone-center-', '')
              } else if (entityId.startsWith('zone-')) {
                zoneId = entityId.replace('zone-', '')
              }
              
              console.log('Zone clicked:', zoneId)
              
              // Find the zone in riskZones array (use ref for current value)
              const clickedZone = riskZonesRef.current.find(z => z.id === zoneId)
              if (clickedZone) {
                onZoneClickRef.current?.(clickedZone)
              }
              return
            }
            
            // Regular hotspot click
            if (entityId && !entityId.includes('-ring') && !entityId.includes('-pulse')) {
              onAssetSelect?.(entityId)
              
              // Fly to selected
              const hotspotEntity = viewer.entities.getById(entityId)
              if (hotspotEntity && hotspotEntity.position) {
                viewer.flyTo(hotspotEntity, {
                  duration: 2,
                  offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 2000000),
                })
              }
            }
          } else {
            onAssetSelect?.(null)
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

        if (isMounted) setIsReady(true)
      } catch (err) {
        console.error('Cesium initialization error:', err)
        setError(err instanceof Error ? err.message : 'Failed to initialize globe')
      }
    }

    initCesium()

    // Cleanup
    return () => {
      isMounted = false
      if (handler) handler.destroy()
      if (viewer && !viewer.isDestroyed()) viewer.destroy()
      viewerRef.current = null
    }
  }, [scenario]) // Reinit when scenario changes

  // Handle selected asset changes
  useEffect(() => {
    if (!viewerRef.current || !selectedAsset) return
    
    const entity = viewerRef.current.entities.getById(selectedAsset)
    if (entity) {
      viewerRef.current.flyTo(entity, {
        duration: 2,
        offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 2000000),
      })
    }
  }, [selectedAsset])

  // Handle reset view trigger - zoom out to global view
  useEffect(() => {
    if (!viewerRef.current || resetViewTrigger === undefined || resetViewTrigger === 0) return
    
    console.log('CesiumGlobe: Resetting to global view')
    viewerRef.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(20, 20, 25000000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0,
      },
      duration: 1.5,
    })
  }, [resetViewTrigger])

  // Notify parent when hotspots are loaded (only once when hotspots change)
  useEffect(() => {
    if (hotspots.length > 0) {
      onHotspotsLoaded?.(hotspots)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotspots])

  // Handle selected zone - zoom to zone and show assets
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return

    // Remove previous asset entities
    assetEntitiesRef.current.forEach(entity => {
      try {
        if (viewer.entities.contains(entity)) {
          viewer.entities.remove(entity)
        }
      } catch (e) {
        // Entity may already be removed
      }
    })
    assetEntitiesRef.current = []

    if (!selectedZone) {
      // Just return without flying - let camera stay where it is
      // User can manually navigate or select another zone
      return
    }

    console.log('CesiumGlobe: Zooming to zone', selectedZone.name)

    // Calculate camera height based on zone radius
    const zoomHeight = Math.max(selectedZone.radius_km * 1000 * 4, 100000)

    // Fly to zone center
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        selectedZone.center_longitude,
        selectedZone.center_latitude,
        zoomHeight
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-60), // Angled view to see terrain
        roll: 0,
      },
      duration: 2,
    })

    // Add assets within this zone as markers
    if (selectedZone.assets && selectedZone.assets.length > 0) {
      selectedZone.assets.forEach((asset, index) => {
        const color = getAssetTypeColor(asset.type)
        
        // Asset marker
        const assetEntity = viewer.entities.add({
          id: `zone-asset-${asset.id}`,
          name: asset.name,
          position: Cesium.Cartesian3.fromDegrees(
            asset.longitude,
            asset.latitude,
            2000
          ),
          point: {
            pixelSize: 14 + asset.impactSeverity * 10,
            color: color,
            outlineColor: Cesium.Color.WHITE.withAlpha(0.9),
            outlineWidth: 2,
            scaleByDistance: new Cesium.NearFarScalar(1e4, 1.5, 1e6, 0.5),
          },
          label: {
            text: asset.name,
            font: '11px sans-serif',
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 2,
            outlineColor: Cesium.Color.BLACK,
            fillColor: Cesium.Color.WHITE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -18),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, zoomHeight * 2),
            showBackground: true,
            backgroundColor: Cesium.Color.BLACK.withAlpha(0.6),
            backgroundPadding: new Cesium.Cartesian2(4, 2),
          },
          // Store asset data for click handling
          properties: {
            assetData: asset,
          },
        })
        assetEntitiesRef.current.push(assetEntity)
        
        // No extra rings - keep it simple
      })
    }

    // Force render update
    viewer.scene.requestRender()

  }, [selectedZone])

  // Handle risk zones from stress tests
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return

    // Remove previous zone entities
    zoneEntitiesRef.current.forEach(entity => {
      try {
        if (viewer.entities.contains(entity)) {
          viewer.entities.remove(entity)
        }
      } catch (e) {
        // Entity may already be removed
      }
    })
    zoneEntitiesRef.current = []

    // Add new zone entities
    if (riskZones.length === 0) return

    riskZones.forEach((zone, index) => {
      const color = getZoneLevelColor(zone.zone_level)
      const radiusMeters = zone.radius_km * 1000

      // SIMPLIFIED: Just one entity per zone - a simple circle with label
      const zoneEntity = viewer.entities.add({
        id: `zone-${zone.id}`,
        name: zone.name || `Risk Zone ${index + 1}`,
        position: Cesium.Cartesian3.fromDegrees(
          zone.center_longitude, 
          zone.center_latitude, 
          100  // Low height
        ),
        // Simple circle on ground
        ellipse: {
          semiMajorAxis: radiusMeters,
          semiMinorAxis: radiusMeters,
          height: 0,  // On ground
          material: color.withAlpha(0.2),
          outline: false,  // No outline - prevents flicker
        },
        // Point marker at center
        point: {
          pixelSize: 14,
          color: color,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
        },
        // Label
        label: {
          text: zone.name || `Zone ${index + 1}`,
          font: '13px sans-serif',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          outlineColor: Cesium.Color.BLACK,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -12),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 8000000),
        },
      })
      zoneEntitiesRef.current.push(zoneEntity)
    })

    // Force render update
    viewer.scene.requestRender()

  }, [riskZones])

  return (
    <div className="relative w-full h-full">
      {/* Cesium container */}
      <div 
        ref={containerRef} 
        className="w-full h-full"
        style={{ background: '#030810' }}
      />
      
      {/* Loading overlay */}
      {!isReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#030810]">
          <div className="text-cyan-400 text-sm animate-pulse">
            Initializing Globe...
          </div>
        </div>
      )}
      
      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#030810]">
          <div className="text-red-400 text-sm text-center p-4">
            <div className="mb-2">⚠️ Globe Error</div>
            <div className="text-xs text-gray-400">{error}</div>
          </div>
        </div>
      )}
      
      {/* Cesium CSS */}
      <style>{`
        .cesium-viewer .cesium-widget-credits {
          display: none !important;
        }
        .cesium-viewer .cesium-viewer-bottom {
          display: none !important;
        }
      `}</style>
    </div>
  )
}
