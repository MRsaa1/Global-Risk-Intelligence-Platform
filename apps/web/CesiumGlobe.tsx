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

// Configure Cesium - use unpkg CDN for static assets (Workers, etc.)
window.CESIUM_BASE_URL = 'https://unpkg.com/cesium@1.124.0/Build/Cesium/'

// Note: Using free OpenStreetMap imagery (no Cesium Ion token needed)

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

// Fallback hotspots if API fails
const FALLBACK_HOTSPOTS: Hotspot[] = [
  { id: 'tokyo', lat: 35.68, lng: 139.65, risk: 0.92, name: 'Tokyo', value: 45.2 },
  { id: 'shanghai', lat: 31.23, lng: 121.47, risk: 0.88, name: 'Shanghai', value: 67.8 },
  { id: 'newyork', lat: 40.71, lng: -74.01, risk: 0.75, name: 'New York', value: 52.3 },
  { id: 'london', lat: 51.51, lng: -0.13, risk: 0.55, name: 'London', value: 28.4 },
  { id: 'dubai', lat: 25.20, lng: 55.27, risk: 0.45, name: 'Dubai', value: 22.1 },
  { id: 'hongkong', lat: 22.32, lng: 114.17, risk: 0.72, name: 'Hong Kong', value: 32.1 },
  { id: 'singapore', lat: 1.35, lng: 103.82, risk: 0.38, name: 'Singapore', value: 15.6 },
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

interface CesiumGlobeProps {
  onAssetSelect?: (assetId: string | null) => void
  selectedAsset?: string | null
  scenario?: string  // Stress scenario to apply
}

export default function CesiumGlobe({ onAssetSelect, selectedAsset, scenario }: CesiumGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!containerRef.current) return

    let viewer: Cesium.Viewer | null = null
    let handler: Cesium.ScreenSpaceEventHandler | null = null

    async function initCesium() {
      try {
        // Initialize Cesium Viewer without base layer first
        viewer = new Cesium.Viewer(containerRef.current!, {
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

        // Add base imagery - using free OpenStreetMap tiles (no Cesium Ion needed)
        try {
          // Use OpenStreetMap for base layer
          const osmProvider = new Cesium.OpenStreetMapImageryProvider({
            url: 'https://tile.openstreetmap.org/',
          })
          viewer.imageryLayers.addImageryProvider(osmProvider)
        } catch (e) {
          console.warn('Could not load OSM imagery:', e)
        }

        // Configure globe appearance
        const globe = viewer.scene.globe
        globe.enableLighting = true
        globe.atmosphereLightIntensity = 10
        globe.atmosphereBrightnessShift = 0.1
        globe.atmosphereHueShift = 0.0
        globe.atmosphereSaturationShift = -0.1
        
        // Dark base color
        globe.baseColor = Cesium.Color.fromCssColorString('#0a1525')

        // Load risk hotspots from API
        const hotspots = await loadHotspots(scenario)
        
        // Add risk hotspots to globe
        hotspots.forEach(spot => {
          const color = getRiskColor(spot.risk)
          const size = 200000 + spot.risk * 300000 // Size based on risk
          
          // Main point
          viewer!.entities.add({
            id: spot.id,
            name: spot.name,
            position: Cesium.Cartesian3.fromDegrees(spot.lng, spot.lat, 50000),
            point: {
              pixelSize: 15 + spot.risk * 15,
              color: color,
              outlineColor: Cesium.Color.WHITE.withAlpha(0.5),
              outlineWidth: 2,
              heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            ellipse: {
              semiMajorAxis: size,
              semiMinorAxis: size,
              height: 10000,
              material: color.withAlpha(0.2),
              outline: true,
              outlineColor: color.withAlpha(0.5),
              outlineWidth: 2,
            },
          })

          // Pulsing ring
          viewer!.entities.add({
            id: `${spot.id}-ring`,
            position: Cesium.Cartesian3.fromDegrees(spot.lng, spot.lat, 15000),
            ellipse: {
              semiMajorAxis: size * 1.5,
              semiMinorAxis: size * 1.5,
              height: 5000,
              material: color.withAlpha(0.1),
              outline: true,
              outlineColor: color.withAlpha(0.3),
              outlineWidth: 1,
            },
          })
        })

        // Initial camera position (overview of Earth)
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(100, 20, 20000000),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-90),
            roll: 0,
          },
        })

        // Smooth rotation animation
        let lastTime = Date.now()
        const rotationSpeed = 0.5 // degrees per second
        
        viewer.scene.preRender.addEventListener(() => {
          const now = Date.now()
          const delta = (now - lastTime) / 1000
          lastTime = now
          
          // Only rotate if not user-interacting
          if (viewer && !viewer.scene.camera.isTransforming) {
            viewer.scene.camera.rotate(
              Cesium.Cartesian3.UNIT_Z,
              Cesium.Math.toRadians(rotationSpeed * delta)
            )
          }
        })

        // Click handler for hotspots
        handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
        handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
          if (!viewer) return
          const pickedObject = viewer.scene.pick(click.position)
          
          if (Cesium.defined(pickedObject) && pickedObject.id) {
            const entityId = pickedObject.id.id
            if (entityId && !entityId.includes('-ring')) {
              onAssetSelect?.(entityId)
              
              // Fly to selected
              const entity = viewer.entities.getById(entityId)
              if (entity && entity.position) {
                viewer.flyTo(entity, {
                  duration: 2,
                  offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 2000000),
                })
              }
            }
          } else {
            onAssetSelect?.(null)
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

        setIsReady(true)
      } catch (err) {
        console.error('Cesium initialization error:', err)
        setError(err instanceof Error ? err.message : 'Failed to initialize globe')
      }
    }

    initCesium()

    // Cleanup
    return () => {
      if (handler) handler.destroy()
      if (viewer && !viewer.isDestroyed()) viewer.destroy()
      viewerRef.current = null
    }
  }, [onAssetSelect, scenario])

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
