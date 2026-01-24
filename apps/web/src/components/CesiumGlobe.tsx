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
    return geojson.features.map((f: any) => {
      // Normalize risk_score: API returns 0-100, we need 0-1
      const rawRisk = f.properties.risk_score || 0
      const normalizedRisk = rawRisk > 1 ? rawRisk / 100 : rawRisk
      
      return {
        id: f.id,
        lat: f.geometry.coordinates[1],
        lng: f.geometry.coordinates[0],
        risk: Math.max(0, Math.min(1, normalizedRisk)), // Clamp to 0-1 range
        name: f.properties.name,
        value: f.properties.exposure,
        assets_count: f.properties.assets_count,
        pd_1y: f.properties.pd_1y,
        lgd: f.properties.lgd,
      }
    })
  } catch (e) {
    console.warn('Failed to load hotspots from API, using fallback:', e)
    return FALLBACK_HOTSPOTS
  }
}

// ===========================================
// FIERY GLOW COLOR SYSTEM - Gradient from center to edges
// ===========================================

// Fiery gradient colors for 6-layer hotspot structure
interface FireGlowColors {
  center: Cesium.Color       // White/bright yellow (innermost)
  coreInner: Cesium.Color    // Bright yellow
  coreOuter: Cesium.Color    // Yellow-orange
  glowInner: Cesium.Color    // Bright orange
  glowMiddle: Cesium.Color   // Orange
  glowOuter: Cesium.Color    // Red-orange (outermost glow)
  ring: Cesium.Color         // Red for zone rings
}

function getFireGlowColors(risk: number): FireGlowColors {
  if (risk > 0.8) {
    // CRITICAL - PURE RED
    return {
      center: Cesium.Color.fromCssColorString('#ff0000'),      // Bright red center
      coreInner: Cesium.Color.fromCssColorString('#ff1a1a'),   // Red
      coreOuter: Cesium.Color.fromCssColorString('#ff3333'),   // Light red
      glowInner: Cesium.Color.fromCssColorString('#cc0000'),   // Dark red
      glowMiddle: Cesium.Color.fromCssColorString('#990000'),  // Darker red
      glowOuter: Cesium.Color.fromCssColorString('#660000'),   // Deep red
      ring: Cesium.Color.fromCssColorString('#ff0000'),        // Pure red for rings
    }
  }
  if (risk > 0.6) {
    // HIGH - PURE ORANGE
    return {
      center: Cesium.Color.fromCssColorString('#ff6600'),      // Bright orange center
      coreInner: Cesium.Color.fromCssColorString('#ff7722'),   // Orange
      coreOuter: Cesium.Color.fromCssColorString('#ff8833'),   // Light orange
      glowInner: Cesium.Color.fromCssColorString('#cc5200'),   // Dark orange
      glowMiddle: Cesium.Color.fromCssColorString('#993d00'),  // Darker orange
      glowOuter: Cesium.Color.fromCssColorString('#662900'),   // Deep orange
      ring: Cesium.Color.fromCssColorString('#ff6600'),        // Pure orange for rings
    }
  }
  if (risk > 0.4) {
    // MEDIUM - PURE YELLOW
    return {
      center: Cesium.Color.fromCssColorString('#ffcc00'),      // Bright yellow center
      coreInner: Cesium.Color.fromCssColorString('#ffd633'),   // Yellow
      coreOuter: Cesium.Color.fromCssColorString('#ffe066'),   // Light yellow
      glowInner: Cesium.Color.fromCssColorString('#cca300'),   // Dark yellow
      glowMiddle: Cesium.Color.fromCssColorString('#997a00'),  // Darker yellow
      glowOuter: Cesium.Color.fromCssColorString('#665200'),   // Deep yellow
      ring: Cesium.Color.fromCssColorString('#ffcc00'),        // Pure yellow for rings
    }
  }
  // LOW - PURE GREEN
  return {
    center: Cesium.Color.fromCssColorString('#00cc00'),        // Bright green center
    coreInner: Cesium.Color.fromCssColorString('#33cc33'),     // Green
    coreOuter: Cesium.Color.fromCssColorString('#66cc66'),     // Light green
    glowInner: Cesium.Color.fromCssColorString('#009900'),     // Dark green
    glowMiddle: Cesium.Color.fromCssColorString('#006600'),    // Darker green
    glowOuter: Cesium.Color.fromCssColorString('#003300'),     // Deep green
    ring: Cesium.Color.fromCssColorString('#00cc00'),          // Pure green for rings
  }
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

// ===========================================
// ENHANCED FIRE GLOW CANVAS SYSTEM
// ===========================================

// Create enhanced fire glow canvas with bright white core and smooth gradient
function createEnhancedFireGlow(
  width: number,
  height: number,
  intensity: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  const centerX = width / 2
  const centerY = height / 2
  const radius = Math.min(centerX, centerY)

  // Main radial gradient with 10 color stops for smooth transition
  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius)
  
  // BRIGHT WHITE CORE - like reference image
  gradient.addColorStop(0, `rgba(255, 255, 255, ${intensity})`)
  gradient.addColorStop(0.05, `rgba(255, 255, 240, ${intensity})`)
  
  // BRIGHT YELLOW-ORANGE
  gradient.addColorStop(0.15, `rgba(255, 220, 100, ${intensity * 0.95})`)
  gradient.addColorStop(0.25, `rgba(255, 180, 60, ${intensity * 0.9})`)
  
  // SATURATED ORANGE
  gradient.addColorStop(0.4, `rgba(255, 130, 30, ${intensity * 0.8})`)
  gradient.addColorStop(0.55, `rgba(255, 90, 20, ${intensity * 0.65})`)
  
  // DEEP RED-ORANGE
  gradient.addColorStop(0.7, `rgba(220, 50, 10, ${intensity * 0.45})`)
  gradient.addColorStop(0.82, `rgba(180, 30, 5, ${intensity * 0.25})`)
  
  // DARK RED FADE TO TRANSPARENT
  gradient.addColorStop(0.92, `rgba(120, 15, 0, ${intensity * 0.1})`)
  gradient.addColorStop(1, 'rgba(80, 10, 0, 0)')

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  // Add "spark" overlays - bright points using screen blend mode
  ctx.globalCompositeOperation = 'screen'
  
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3
    const distance = radius * 0.2
    const x = centerX + Math.cos(angle) * distance
    const y = centerY + Math.sin(angle) * distance
    
    const sparkGradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 0.3)
    sparkGradient.addColorStop(0, `rgba(255, 255, 200, ${intensity * 0.4})`)
    sparkGradient.addColorStop(0.5, `rgba(255, 150, 50, ${intensity * 0.2})`)
    sparkGradient.addColorStop(1, 'rgba(255, 100, 0, 0)')
    
    ctx.fillStyle = sparkGradient
    ctx.fillRect(0, 0, width, height)
  }

  return canvas
}

// Create small sparkle canvas for particle effects
function createSparkCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  const centerX = width / 2
  const centerY = height / 2

  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, width / 2)
  gradient.addColorStop(0, 'rgba(255, 255, 200, 1)')
  gradient.addColorStop(0.3, 'rgba(255, 200, 100, 0.8)')
  gradient.addColorStop(0.6, 'rgba(255, 150, 50, 0.4)')
  gradient.addColorStop(1, 'rgba(255, 100, 0, 0)')

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  return canvas
}

// Sparkle entity with animation phase
interface SparkleEntity {
  entity: Cesium.Entity
  phase: number
}

// Add sparkle particles around a hotspot
function addSparkles(
  viewer: Cesium.Viewer,
  longitude: number,
  latitude: number,
  spotId: string,
  count: number = 20
): SparkleEntity[] {
  const sparkles: SparkleEntity[] = []

  for (let i = 0; i < count; i++) {
    // Random offset around center
    const angle = Math.random() * Math.PI * 2
    const distance = 20000 + Math.random() * 100000 // 20-120 km
    
    const offsetLon = longitude + (Math.cos(angle) * distance) / 111320
    const offsetLat = latitude + (Math.sin(angle) * distance) / 110540
    
    const sparkCanvas = createSparkCanvas(16, 16)
    
    const sparkle = viewer.entities.add({
      id: `hotspot-sparkle-${spotId}-${i}`,
      position: Cesium.Cartesian3.fromDegrees(offsetLon, offsetLat, Math.random() * 30000),
      billboard: {
        image: sparkCanvas,
        scale: 0.5 + Math.random() * 1.0,
        color: Cesium.Color.WHITE,
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      }
    })
    
    sparkles.push({ entity: sparkle, phase: Math.random() * Math.PI * 2 })
  }

  return sparkles
}

// Fire marker structure for animation
interface FireMarker {
  spotId: string
  core: Cesium.Entity
  innerGlow: Cesium.Entity
  outerGlow: Cesium.Entity
  halos: Cesium.Entity[]
  sparkles: SparkleEntity[]
}

// Animate fire halos with flicker and pulse
function animateEnhancedFireHalo(viewer: Cesium.Viewer, markers: FireMarker[]) {
  const startTime = Date.now()

  const animationCallback = () => {
    if (viewer.isDestroyed()) return
    
    const elapsed = (Date.now() - startTime) / 1000

    markers.forEach((marker, index) => {
      const offset = index * 0.4
      
      // Main pulse (slow breathing)
      const pulse = Math.sin(elapsed * 1.2 + offset) * 0.25 + 0.75 // 0.5 to 1.0
      
      // Fast flicker (fire-like)
      const flicker = Math.sin(elapsed * 8 + offset * 3) * 0.1 + 0.9 // 0.8 to 1.0
      
      // Combined intensity
      const combinedIntensity = pulse * flicker

      // Animate core (small scale: 0.3 base)
      if (marker.core?.billboard) {
        marker.core.billboard.scale = new Cesium.ConstantProperty(0.3 * combinedIntensity)
      }

      // Animate inner glow (small scale: 0.8 base)
      if (marker.innerGlow?.billboard) {
        marker.innerGlow.billboard.scale = new Cesium.ConstantProperty(0.8 * pulse)
        const alpha = 0.5 * combinedIntensity
        marker.innerGlow.billboard.color = new Cesium.ConstantProperty(
          new Cesium.Color(1.0, 0.5, 0.1, alpha)
        )
      }

      // Animate halo rings (wave expansion) - smaller radii
      marker.halos?.forEach((halo, i) => {
        if (halo?.ellipse) {
          const baseRadius = 50000 + (i * 40000)
          const wave = Math.sin(elapsed * 1.5 - i * 0.8 + offset) * 0.2 + 0.8
          halo.ellipse.semiMajorAxis = new Cesium.ConstantProperty(baseRadius * wave)
          halo.ellipse.semiMinorAxis = new Cesium.ConstantProperty(baseRadius * wave)
          
          const alpha = (0.08 - i * 0.02) * pulse // Very low alpha
          halo.ellipse.material = new Cesium.Color(1.0, 0.4, 0.1, alpha) as unknown as Cesium.MaterialProperty
        }
      })

      // Animate outer glow (small scale: 2.0 base)
      if (marker.outerGlow?.billboard) {
        const slowPulse = Math.sin(elapsed * 0.8 + offset) * 0.15 + 0.85
        marker.outerGlow.billboard.scale = new Cesium.ConstantProperty(2.0 * slowPulse)
        marker.outerGlow.billboard.color = new Cesium.ConstantProperty(
          new Cesium.Color(1.0, 0.3, 0.0, 0.15 * pulse)
        )
      }

      // Animate sparkles
      marker.sparkles?.forEach((sparkle) => {
        const sparkPulse = Math.sin(elapsed * 5 + sparkle.phase) * 0.5 + 0.5
        if (sparkle.entity?.billboard) {
          sparkle.entity.billboard.color = new Cesium.ConstantProperty(
            new Cesium.Color(1.0, 0.8, 0.4, sparkPulse)
          )
        }
      })
    })
  }

  // Register animation on preRender
  viewer.scene.preRender.addEventListener(animationCallback)
  
  return animationCallback // Return for potential cleanup
}

// Apply hotspot visibility from risk filter; reusable from init and useEffect
function applyVisibility(
  viewer: Cesium.Viewer | null,
  entityMap: Map<string, Cesium.Entity[]>,
  spots: Hotspot[],
  filter: 'critical' | 'high' | 'medium' | 'low' | null
): void {
  if (!viewer || viewer.isDestroyed()) return
  if (entityMap.size === 0) return
  const shouldShow = (risk: number): boolean => {
    if (!filter) return true
    switch (filter) {
      case 'critical': return risk > 0.8
      case 'high': return risk > 0.6 && risk <= 0.8
      case 'medium': return risk > 0.4 && risk <= 0.6
      case 'low': return risk <= 0.4
      default: return false
    }
  }
  spots.forEach((spot) => {
    const entities = entityMap.get(spot.id)
    if (!entities) return
    const visible = shouldShow(spot.risk)
    entities.forEach((e) => { e.show = visible })
  })
  viewer.scene.requestRender()
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
  type: 'bank' | 'enterprise' | 'developer' | 'insurer' | 'infrastructure' | 'military' | 'government' | 'hospital' | 'school' | 'city'
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
  activeRiskFilter?: 'critical' | 'high' | 'medium' | 'low' | null  // Filter hotspots by risk level
}

// Asset type to icon color mapping
function getAssetTypeColor(type: string): Cesium.Color {
  switch (type) {
    case 'bank': return Cesium.Color.fromCssColorString('#3b82f6') // blue
    case 'enterprise': return Cesium.Color.fromCssColorString('#8b5cf6') // purple
    case 'developer': return Cesium.Color.fromCssColorString('#C9A962') // gold
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
  paused = false,
  activeRiskFilter = null
}: CesiumGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const hotspotEntitiesRef = useRef<Map<string, Cesium.Entity[]>>(new Map())
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
          
          // Continuous render loop (requestRenderMode:true ломало отрисовку entity)
          requestRenderMode: false,
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
          
          // NASA Black Marble - city lights with balanced visibility
          const nasaBlackMarble = await Cesium.IonImageryProvider.fromAssetId(3812)
          if (!isMounted || !viewer || viewer.isDestroyed()) return
          const nightLayer = viewer.imageryLayers.addImageryProvider(nasaBlackMarble)
          nightLayer.brightness = 1.0        // Normal brightness
          nightLayer.contrast = 1.2          // Slight contrast boost
          nightLayer.saturation = 0.8        // Reduce saturation to prevent red tint
          nightLayer.gamma = 1.0             // Normal gamma
          console.log('✅ NASA Black Marble loaded (balanced settings)')
          
        } catch (e) {
          console.warn('NASA imagery failed:', e)
        }
        
        // =============================================
        // CESIUM WORLD TERRAIN (Asset ID 1) - New API
        // =============================================
        try {
          if (!isMounted || !viewer || viewer.isDestroyed()) return
          
          // Use new setTerrain API (Cesium 1.104+)
          viewer.scene.setTerrain(
            new Cesium.Terrain(
              Cesium.CesiumTerrainProvider.fromIonAssetId(1)
            )
          )
          console.log('✅ Cesium World Terrain loaded (Asset ID 1)')
        } catch (e) {
          console.warn('Cesium World Terrain failed:', e)
          // Fallback to ellipsoid terrain (smooth sphere)
          console.log('ℹ️ Using ellipsoid terrain as fallback')
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
        // CLEAN NIGHT VIEW - Visible ocean, no globe outline
        // =============================================
        
        // Disable sky atmosphere completely (no outline/glow around globe)
        if (viewer.scene.skyAtmosphere) {
          viewer.scene.skyAtmosphere.show = false
        }
        
        // Disable ground atmosphere (no rim/edge glow)
        globe.showGroundAtmosphere = false
        
        // Pure dark space background
        scene.backgroundColor = Cesium.Color.fromCssColorString('#000000')
        
        // VISIBLE BLUE OCEAN - distinct from black space
        globe.baseColor = Cesium.Color.fromCssColorString('#0a1628')
        
        // Enable depth test so ellipses don't show through the back of the globe
        globe.depthTestAgainstTerrain = true
        
        console.log('✅ Clean night visualization configured (visible ocean)')

        // =============================================
        // HOTSPOTS - HALO GLOW SYSTEM
        // =============================================
        if (!isMounted || !viewer || viewer.isDestroyed()) return
        const loadedHotspots = await loadHotspots(scenario)
        if (!isMounted || !viewer || viewer.isDestroyed()) return
        setHotspots(loadedHotspots) // Save to state for parent component
        
        // Create glowing hotspot entities with billboard + ellipse rings (no animation)
        const entityMap = new Map<string, Cesium.Entity[]>()
        
        loadedHotspots.forEach((spot) => {
          const entities: Cesium.Entity[] = []
          
          // Get fire gradient colors for center point
          const colors = getFireGlowColors(spot.risk)
          const position = Cesium.Cartesian3.fromDegrees(spot.lng, spot.lat, 0)
          
          // ========================================
          // GLOW HALO - Billboard + Ellipse rings for ALL risk levels
          // ========================================
          // Get glow color based on risk level
          const glowColor = spot.risk > 0.8 
            ? { r: 1.0, g: 0.2, b: 0.0 }   // Critical - Red
            : spot.risk > 0.6 
              ? { r: 1.0, g: 0.5, b: 0.0 } // High - Orange
              : spot.risk > 0.4 
                ? { r: 1.0, g: 0.8, b: 0.0 } // Medium - Yellow
                : { r: 0.2, g: 0.9, b: 0.3 } // Low - Green
          
          // Scale intensity by risk (higher risk = slightly brighter)
          const riskMultiplier = 0.7 + spot.risk * 0.3 // 0.7 to 1.0
          
          // --- CORE GLOW (128x128 canvas, scale 0.32) --- 1.1% intensity
          const coreCanvas = createEnhancedFireGlow(128, 128, 0.32 * riskMultiplier)
          const core = viewer!.entities.add({
            id: `hotspot-core-bb-${spot.id}`,
            position: position,
            billboard: {
              image: coreCanvas,
              scale: 0.32,
              color: new Cesium.Color(glowColor.r, glowColor.g, glowColor.b, 0.8),
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            },
          })
          entities.push(core)

          // --- INNER GLOW (256x256 canvas, scale 0.85) --- 1.1% intensity
          const innerGlowCanvas = createEnhancedFireGlow(256, 256, 0.16 * riskMultiplier)
          const innerGlow = viewer!.entities.add({
            id: `hotspot-inner-glow-${spot.id}`,
            position: position,
            billboard: {
              image: innerGlowCanvas,
              scale: 0.85,
              color: new Cesium.Color(glowColor.r, glowColor.g, glowColor.b, 0.45),
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            },
          })
          entities.push(innerGlow)

          // --- OUTER GLOW (512x512 canvas, scale 2.0) --- 1.1% intensity
          const outerGlowCanvas = createEnhancedFireGlow(512, 512, 0.06 * riskMultiplier)
          const outerGlow = viewer!.entities.add({
            id: `hotspot-outer-glow-${spot.id}`,
            position: position,
            billboard: {
              image: outerGlowCanvas,
              scale: 2.0,
              color: new Cesium.Color(glowColor.r, glowColor.g, glowColor.b, 0.12),
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            },
          })
          entities.push(outerGlow)

          // --- ELLIPSE HALO RINGS (3 rings) - on ground ---
          for (let i = 0; i < 3; i++) {
            const radius = 50000 + (i * 40000)
            const halo = viewer!.entities.add({
              id: `hotspot-halo-${i}-${spot.id}`,
              position: position,
              ellipse: {
                semiMinorAxis: radius,
                semiMajorAxis: radius,
                material: new Cesium.Color(glowColor.r, glowColor.g, glowColor.b, (0.08 - i * 0.022) * riskMultiplier),
                height: 0,
                outline: false,
              },
            })
            entities.push(halo)
          }

          console.log(`✨ Created glow for ${spot.name} (${spot.risk > 0.8 ? 'critical' : spot.risk > 0.6 ? 'high' : spot.risk > 0.4 ? 'medium' : 'low'})`)
          
          // Center point - Small, semi-transparent with subtle glow
          const centerPointSize = spot.risk > 0.8 ? 8 : spot.risk > 0.6 ? 7 : spot.risk > 0.4 ? 6 : 5
          const center = viewer!.entities.add({
            id: `hotspot-center-${spot.id}`,
            position: Cesium.Cartesian3.fromDegrees(spot.lng, spot.lat, 5000),
            point: {
              pixelSize: centerPointSize,
              color: colors.center.withAlpha(0.5),  // Semi-transparent center
              outlineColor: colors.ring.withAlpha(0.6),  // Semi-transparent outline
              outlineWidth: 1.5,
              scaleByDistance: new Cesium.NearFarScalar(1e6, 1.2, 1e8, 0.4),
            },
            label: {
              text: spot.name,
              font: '13px Inter, sans-serif',
              fillColor: Cesium.Color.WHITE.withAlpha(0.9),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -18),
              scaleByDistance: new Cesium.NearFarScalar(1e6, 1, 1e8, 0.25),
              showBackground: true,
              backgroundColor: Cesium.Color.BLACK.withAlpha(0.5),
              backgroundPadding: new Cesium.Cartesian2(6, 4),
            },
            show: false,
          })
          entities.push(center)
          
          entityMap.set(spot.id, entities)
        })
        
        hotspotEntitiesRef.current = entityMap
        // Show all immediately (filter=null) so rings are visible before first useEffect filter
        applyVisibility(viewer, entityMap, loadedHotspots, null)
        console.log(`✅ Created glow hotspots for ${loadedHotspots.length} cities (static, no animation)`)

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
            
            // Regular hotspot click - extract city ID from entity ID
            // Entity IDs have format: hotspot-center-{city_id}, hotspot-core-{city_id}, etc.
            if (entityId && !entityId.includes('-ring') && !entityId.includes('-pulse')) {
              let cityId = entityId
              if (entityId.startsWith('hotspot-center-')) {
                cityId = entityId.replace('hotspot-center-', '')
              } else if (entityId.startsWith('hotspot-core-')) {
                cityId = entityId.replace('hotspot-core-', '')
              } else if (entityId.startsWith('hotspot-')) {
                // Generic hotspot prefix
                cityId = entityId.replace(/^hotspot-[a-z]+-/, '')
              }
              
              console.log('Hotspot clicked, entity:', entityId, '-> city:', cityId)
              onAssetSelect?.(cityId)
              
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

  // Handle activeRiskFilter - show/hide hotspots based on risk level
  useEffect(() => {
    applyVisibility(viewerRef.current, hotspotEntitiesRef.current, hotspots, activeRiskFilter)
  }, [activeRiskFilter, hotspots])

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
        style={{ background: '#000000' }}
      />
      
      {/* Loading overlay */}
      {!isReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="text-amber-400 text-sm animate-pulse">
            Initializing Globe...
          </div>
        </div>
      )}
      
      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
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
